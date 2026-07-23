use std::{
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
};

use serde_json::Value;
use tauri::Emitter;

use super::{configure_hidden_process, connector_app_data_dir, resolve_monorepo_root};

/// Tauri event channel for live host-action progress. The desktop host CLI emits
/// determinate `{step, total, label}` events for the long actions (setup /
/// update); the frontend renders them as a progress bar.
pub const HOST_PROGRESS_EVENT: &str = "host-action-progress";

const DESKTOP_HOST_CLI_REL: &str = "tools/uwe-host-command-center/src/desktop-host-cli.ts";

fn resolve_requested_root(root: Option<String>) -> Result<PathBuf, String> {
    if let Some(value) = root
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let path = PathBuf::from(&value);
        if !path.is_dir() {
            return Err(format!("UWE-Projektordner nicht gefunden: {value}"));
        }
        return Ok(path);
    }
    Ok(resolve_monorepo_root())
}

fn build_host_command(
    action: &str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Command, String> {
    let root = resolve_requested_root(root)?;
    let script = root.join(DESKTOP_HOST_CLI_REL);
    if !script.exists() {
        return Err(format!(
            "Host-Steuerung nicht gefunden: {}. Bitte einen aktuellen UWE-Projektordner auswählen.",
            script.display()
        ));
    }

    let mut command = Command::new("node");
    configure_hidden_process(&mut command);
    command
        .arg(DESKTOP_HOST_CLI_REL)
        .arg(action)
        .arg("--root")
        .arg(&root)
        .current_dir(&root)
        .env("UWE_MONOREPO_ROOT", &root)
        .env(
            "UWE_COMMAND_CENTER_DATA_DIR",
            connector_app_data_dir()?.join("host"),
        );
    if let Some(target) = target {
        command.arg("--target").arg(target);
    }
    Ok(command)
}

/// The CLI wraps its return value as `{"type":"result","payload":<value>}` on the
/// last stdout line (earlier lines may be `progress` events). Pull the payload
/// out of whichever line carries it, tolerating interleaved progress lines and —
/// for forward/backward safety — a bare JSON result with no envelope.
fn extract_result_payload(stdout: &str) -> Option<Value> {
    let mut fallback: Option<Value> = None;
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        match value.get("type").and_then(Value::as_str) {
            Some("result") => return value.get("payload").cloned(),
            Some("progress") => {}
            // A bare object with no recognised envelope type — remember it as a
            // last resort so a CLI that ever stops enveloping still works.
            _ => fallback = Some(value),
        }
    }
    fallback
}

fn run_host_command(
    action: &str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    let output = build_host_command(action, root, target)?
        .output()
        .map_err(|error| format!("Host-Aktion konnte nicht gestartet werden: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(if stderr.is_empty() {
            format!("Host-Aktion {action} ist fehlgeschlagen.")
        } else {
            stderr
        });
    }
    extract_result_payload(&stdout).ok_or_else(|| {
        "Antwort der Host-Steuerung konnte nicht gelesen werden.".to_string()
    })
}

/// Like `run_host_command`, but streams the child's stdout line-by-line: every
/// `progress` line is forwarded to the frontend as a Tauri event so the UI shows
/// a live, determinate bar for the minutes-long setup/update actions. stderr is
/// drained on a background thread so a chatty build can't deadlock the reader by
/// filling its pipe buffer.
fn run_host_command_streaming(
    app: &tauri::AppHandle,
    action: &str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    let mut command = build_host_command(action, root, target)?;
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Host-Aktion konnte nicht gestartet werden: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Host-Steuerung lieferte keinen stdout-Stream.".to_string())?;
    let mut stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "Host-Steuerung lieferte keinen stderr-Stream.".to_string())?;

    let stderr_handle = std::thread::spawn(move || -> String {
        let mut buf = String::new();
        let _ = stderr_pipe.read_to_string(&mut buf);
        buf
    });

    let mut result_payload: Option<Value> = None;
    for line in BufReader::new(stdout).lines() {
        let line =
            line.map_err(|error| format!("Host-Ausgabe konnte nicht gelesen werden: {error}"))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        match value.get("type").and_then(Value::as_str) {
            Some("progress") => {
                let _ = app.emit(HOST_PROGRESS_EVENT, &value);
            }
            Some("result") => {
                result_payload = value.get("payload").cloned();
            }
            _ => {
                result_payload = Some(value);
            }
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("Host-Aktion konnte nicht abgeschlossen werden: {error}"))?;
    let stderr_text = stderr_handle.join().unwrap_or_default();

    if !status.success() {
        return Err(if stderr_text.trim().is_empty() {
            format!("Host-Aktion {action} ist fehlgeschlagen.")
        } else {
            stderr_text.trim().to_string()
        });
    }

    result_payload
        .ok_or_else(|| "Host-Steuerung lieferte kein Ergebnis zurück.".to_string())
}

async fn run_host_command_async(
    action: &'static str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run_host_command(action, root, target))
        .await
        .map_err(|error| format!("Host-Aktion wurde unerwartet beendet: {error}"))?
}

async fn run_host_command_streaming_async(
    app: tauri::AppHandle,
    action: &'static str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_host_command_streaming(&app, action, root, target)
    })
    .await
    .map_err(|error| format!("Host-Aktion wurde unerwartet beendet: {error}"))?
}

#[tauri::command]
pub async fn get_host_status(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("status", root, None).await
}

#[tauri::command]
pub async fn setup_host(app: tauri::AppHandle, root: Option<String>) -> Result<Value, String> {
    run_host_command_streaming_async(app, "setup", root, None).await
}

#[tauri::command]
pub async fn start_host(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("start", root, None).await
}

#[tauri::command]
pub async fn stop_host(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("stop", root, None).await
}

#[tauri::command]
pub async fn restart_host(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("restart", root, None).await
}

#[tauri::command]
pub async fn backup_host(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("backup", root, None).await
}

#[tauri::command]
pub async fn get_host_logs(root: Option<String>, target: Option<String>) -> Result<Value, String> {
    run_host_command_async("logs", root, target).await
}

#[tauri::command]
pub async fn open_host_target(
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    run_host_command_async("open", root, target).await
}

#[tauri::command]
pub async fn check_host_update(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("check-update", root, None).await
}

#[tauri::command]
pub async fn update_host(app: tauri::AppHandle, root: Option<String>) -> Result<Value, String> {
    run_host_command_streaming_async(app, "update", root, None).await
}

// ── User / owner administration ────────────────────────────────────────────
// The Command Center provisions the owner and all other users directly (no
// Studio web UI needed) via user-admin-cli.ts. Passwords are passed on the
// child's stdin, never as process arguments.

const USER_ADMIN_CLI_REL: &str = "tools/uwe-host-command-center/src/user-admin-cli.ts";

fn build_user_admin_command(action: &str, extra_args: &[&str]) -> Result<Command, String> {
    let root = resolve_monorepo_root();
    let script = root.join(USER_ADMIN_CLI_REL);
    if !script.exists() {
        return Err(format!(
            "Benutzerverwaltung nicht gefunden: {}. Bitte einen aktuellen UWE-Projektordner auswählen.",
            script.display()
        ));
    }
    let mut command = Command::new("node");
    configure_hidden_process(&mut command);
    command
        .arg("--import")
        .arg("tsx")
        .arg(USER_ADMIN_CLI_REL)
        .arg(action)
        .args(extra_args)
        .current_dir(&root);
    Ok(command)
}

fn run_user_admin(action: &str, extra_args: &[&str], stdin_json: Option<String>) -> Result<Value, String> {
    let mut command = build_user_admin_command(action, extra_args)?;
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    if stdin_json.is_some() {
        command.stdin(Stdio::piped());
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Benutzerverwaltung konnte nicht gestartet werden: {error}"))?;

    if let Some(payload) = stdin_json {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(payload.as_bytes())
                .map_err(|error| format!("Eingabe konnte nicht übergeben werden: {error}"))?;
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Benutzerverwaltung konnte nicht abgeschlossen werden: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Benutzerverwaltung ist fehlgeschlagen.".to_string()
        } else {
            stderr
        });
    }

    // The CLI prints a single JSON result line ({ ok, ... }); take the last one.
    let value = stdout
        .lines()
        .rev()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .find_map(|line| serde_json::from_str::<Value>(line).ok())
        .ok_or_else(|| "Antwort der Benutzerverwaltung konnte nicht gelesen werden.".to_string())?;
    Ok(value)
}

async fn run_user_admin_async(
    action: &'static str,
    extra_args: Vec<String>,
    stdin_json: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let args: Vec<&str> = extra_args.iter().map(String::as_str).collect();
        run_user_admin(action, &args, stdin_json)
    })
    .await
    .map_err(|error| format!("Benutzerverwaltung wurde unerwartet beendet: {error}"))?
}

#[tauri::command]
pub async fn list_users() -> Result<Value, String> {
    run_user_admin_async("list", Vec::new(), None).await
}

#[tauri::command]
pub async fn create_user(user: Value) -> Result<Value, String> {
    let payload = serde_json::to_string(&user)
        .map_err(|error| format!("Benutzerdaten konnten nicht serialisiert werden: {error}"))?;
    run_user_admin_async("create", Vec::new(), Some(payload)).await
}

#[tauri::command]
pub async fn set_user_password(payload: Value) -> Result<Value, String> {
    let body = serde_json::to_string(&payload)
        .map_err(|error| format!("Daten konnten nicht serialisiert werden: {error}"))?;
    run_user_admin_async("set-password", Vec::new(), Some(body)).await
}

#[tauri::command]
pub async fn delete_user(id: String) -> Result<Value, String> {
    run_user_admin_async("delete", vec![id], None).await
}
