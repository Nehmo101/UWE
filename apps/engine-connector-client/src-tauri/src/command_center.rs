use std::{
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Command, Stdio},
};

use serde_json::Value;
use tauri::Emitter;

use super::{
    configure_breakaway_process, configure_hidden_process, connector_app_data_dir,
    resolve_monorepo_root,
};

/// Tauri event channel for live host-action progress. The desktop host CLI emits
/// determinate `{step, total, label}` events for the long actions (setup /
/// update); the frontend renders them as a progress bar.
pub const HOST_PROGRESS_EVENT: &str = "host-action-progress";

const DESKTOP_HOST_CLI_REL: &str = "tools/uwe-host-command-center/src/desktop-host-cli.ts";

/// Fassung dieser Desktop-App, an die Host-CLI durchgereicht. Eine
/// Bundle-Installation hat keine `tauri.conf.json` neben sich — nur so weiß der
/// Update-Check, ob die App hinter dem Release-Tag liegt und der Installer
/// geöffnet werden muss. Der Release-Workflow hält `Cargo.toml` und
/// `tauri.conf.json` auf derselben Version.
const COMMAND_CENTER_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Host-Aktionen, deren CLI-Lauf Dauerprozesse hinterlässt (die abgekoppelt
/// gestarteten Next.js-Dienste). Nur diese Aufrufe müssen aus dem Job Object
/// ausbrechen, wenn die Dienste das Command Center überleben sollen.
const SERVICE_SPAWNING_HOST_ACTIONS: &[&str] = &[
    "start",
    "restart",
    "start-service",
    "restart-service",
    "update",
];

/// `stopServicesOnExit: false` heißt: Dienste und Tunnel überleben das Beenden
/// der App. Fehlt oder klemmt die Config, gilt der sichere Standard (aufräumen).
fn services_survive_app_exit() -> bool {
    !super::read_config_from_disk()
        .map(|config| config.stop_services_on_exit)
        .unwrap_or(true)
}

/// Ob der CLI-Prozess dieser Host-Aktion mit `CREATE_BREAKAWAY_FROM_JOB`
/// starten muss. `open` bricht immer aus (der geöffnete Browser darf die App
/// überleben); Dienst-startende Aktionen nur, wenn der Nutzer per
/// `stopServicesOnExit: false` will, dass die Dienste weiterlaufen — die
/// Kindprozesse erben die Nicht-Mitgliedschaft im Job Object. Trade-off: für
/// diese Dienste gibt es keine Kernel-Aufräumgarantie bei einem App-Absturz
/// mehr; das ist die bewusste Bedeutung des Schalters. Die Wirkung greift erst
/// beim nächsten Dienststart — bereits laufende Dienste bleiben im Job.
fn host_action_needs_breakaway(action: &str, services_survive_exit: bool) -> bool {
    action == "open" || (services_survive_exit && SERVICE_SPAWNING_HOST_ACTIONS.contains(&action))
}

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

/// Verzeichnis der mitgelieferten Host-Laufzeit (gebündelte CLI, node.exe,
/// Prisma-CLI). Tauri legt `bundle.resources` neben die EXE; der Pfad wird ohne
/// AppHandle aufgelöst, damit jeder Aufrufer von `build_host_command` ihn nutzen
/// kann.
fn bundled_host_runtime_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.join("resources").join("host-runtime");
    dir.is_dir().then_some(dir)
}

fn build_host_command(
    action: &str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Command, String> {
    let root = resolve_requested_root(root)?;
    let breakaway = host_action_needs_breakaway(action, services_survive_app_exit());
    let script = root.join(DESKTOP_HOST_CLI_REL);
    if !script.exists() {
        // Kein Entwickler-Checkout: die Bundle-Installation steuert den Host
        // über die mitgelieferte, vorgebündelte CLI und die mitgelieferte
        // Node-Laufzeit — der Zielrechner braucht weder das Repo noch ein
        // installiertes Node.
        if let Some(runtime) = bundled_host_runtime_dir() {
            let cli = runtime.join("host-cli.cjs");
            if cli.exists() {
                let node = runtime.join(if cfg!(windows) { "node.exe" } else { "node" });
                let mut command = if node.exists() {
                    Command::new(node)
                } else {
                    Command::new("node")
                };
                if breakaway {
                    configure_breakaway_process(&mut command);
                } else {
                    configure_hidden_process(&mut command);
                }
                command
                    .arg(cli)
                    .arg(action)
                    .current_dir(&runtime)
                    .env(
                        "UWE_COMMAND_CENTER_DATA_DIR",
                        connector_app_data_dir()?.join("host"),
                    )
                    .env("UWE_COMMAND_CENTER_VERSION", COMMAND_CENTER_VERSION);
                if let Some(target) = target {
                    command.arg("--target").arg(target);
                }
                return Ok(command);
            }
        }
        return Err(format!(
            "Host-Steuerung nicht gefunden: {}. Bitte einen aktuellen UWE-Projektordner auswählen.",
            script.display()
        ));
    }

    let mut command = Command::new("node");
    // `open` startet über die CLI einen Browser bzw. Explorer — dieser Teilbaum
    // muss aus dem Job Object ausbrechen, sonst nimmt das Beenden des Command
    // Centers den geöffneten Browser mit. Dienst-startende Aktionen brechen nur
    // aus, wenn die Dienste das Beenden überleben sollen (siehe
    // `host_action_needs_breakaway`).
    if breakaway {
        configure_breakaway_process(&mut command);
    } else {
        configure_hidden_process(&mut command);
    }
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
        )
        .env("UWE_COMMAND_CENTER_VERSION", COMMAND_CENTER_VERSION);
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
    extract_result_payload(&stdout)
        .ok_or_else(|| "Antwort der Host-Steuerung konnte nicht gelesen werden.".to_string())
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

    result_payload.ok_or_else(|| "Host-Steuerung lieferte kein Ergebnis zurück.".to_string())
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

fn build_user_admin_command(
    action: &str,
    extra_args: &[&str],
    root: Option<String>,
) -> Result<Command, String> {
    let root = resolve_requested_root(root)?;
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

fn run_user_admin(
    action: &str,
    extra_args: &[&str],
    stdin_json: Option<String>,
    root: Option<String>,
) -> Result<Value, String> {
    let mut command = build_user_admin_command(action, extra_args, root)?;
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

    let output = child.wait_with_output().map_err(|error| {
        format!("Benutzerverwaltung konnte nicht abgeschlossen werden: {error}")
    })?;
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
    root: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let args: Vec<&str> = extra_args.iter().map(String::as_str).collect();
        run_user_admin(action, &args, stdin_json, root)
    })
    .await
    .map_err(|error| format!("Benutzerverwaltung wurde unerwartet beendet: {error}"))?
}

#[tauri::command]
pub async fn list_users(root: Option<String>) -> Result<Value, String> {
    run_user_admin_async("list", Vec::new(), None, root).await
}

#[tauri::command]
pub async fn create_user(user: Value, root: Option<String>) -> Result<Value, String> {
    let payload = serde_json::to_string(&user)
        .map_err(|error| format!("Benutzerdaten konnten nicht serialisiert werden: {error}"))?;
    run_user_admin_async("create", Vec::new(), Some(payload), root).await
}

#[tauri::command]
pub async fn set_user_password(payload: Value, root: Option<String>) -> Result<Value, String> {
    let body = serde_json::to_string(&payload)
        .map_err(|error| format!("Daten konnten nicht serialisiert werden: {error}"))?;
    run_user_admin_async("set-password", Vec::new(), Some(body), root).await
}

#[tauri::command]
pub async fn delete_user(id: String, root: Option<String>) -> Result<Value, String> {
    run_user_admin_async("delete", vec![id], None, root).await
}

// ── Cloudflare tunnel control ──────────────────────────────────────────────
// Runs/stops the local cloudflared connector for the dashboard-managed tunnel.
// The tunnel token (a secret) is stored owner-only by the CLI and passed on
// stdin for set-token; it is never returned to the frontend.

const CLOUDFLARE_CLI_REL: &str = "tools/uwe-host-command-center/src/cloudflare-tunnel-cli.ts";

fn build_cloudflare_command(action: &str, root: Option<String>) -> Result<Command, String> {
    let root = resolve_requested_root(root)?;
    let script = root.join(CLOUDFLARE_CLI_REL);
    if !script.exists() {
        return Err(format!(
            "Cloudflare-Steuerung nicht gefunden: {}. Bitte einen aktuellen UWE-Projektordner auswählen.",
            script.display()
        ));
    }
    let mut command = Command::new("node");
    // `start` hinterlässt den abgekoppelt gestarteten cloudflared. Soll der
    // Tunnel das Beenden der App überleben (`stopServicesOnExit: false`), muss
    // dieser Aufruf aus dem Job Object ausbrechen — sonst stirbt cloudflared
    // trotz Einstellung mit dem Command Center.
    if action == "start" && services_survive_app_exit() {
        configure_breakaway_process(&mut command);
    } else {
        configure_hidden_process(&mut command);
    }
    command
        .arg("--import")
        .arg("tsx")
        .arg(CLOUDFLARE_CLI_REL)
        .arg(action)
        .current_dir(&root)
        .env(
            "UWE_COMMAND_CENTER_DATA_DIR",
            connector_app_data_dir()?.join("host"),
        );
    Ok(command)
}

fn run_cloudflare(
    action: &str,
    root: Option<String>,
    stdin_json: Option<String>,
) -> Result<Value, String> {
    let mut command = build_cloudflare_command(action, root)?;
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    if stdin_json.is_some() {
        command.stdin(Stdio::piped());
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Cloudflare-Steuerung konnte nicht gestartet werden: {error}"))?;

    if let Some(payload) = stdin_json {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(payload.as_bytes())
                .map_err(|error| format!("Token konnte nicht übergeben werden: {error}"))?;
        }
    }

    let output = child.wait_with_output().map_err(|error| {
        format!("Cloudflare-Steuerung konnte nicht abgeschlossen werden: {error}")
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Cloudflare-Steuerung ist fehlgeschlagen.".to_string()
        } else {
            stderr
        });
    }

    stdout
        .lines()
        .rev()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .find_map(|line| serde_json::from_str::<Value>(line).ok())
        .ok_or_else(|| "Antwort der Cloudflare-Steuerung konnte nicht gelesen werden.".to_string())
}

async fn run_cloudflare_async(
    action: &'static str,
    root: Option<String>,
    stdin_json: Option<String>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run_cloudflare(action, root, stdin_json))
        .await
        .map_err(|error| format!("Cloudflare-Steuerung wurde unerwartet beendet: {error}"))?
}

#[tauri::command]
pub async fn cloudflare_status(root: Option<String>) -> Result<Value, String> {
    run_cloudflare_async("status", root, None).await
}

#[tauri::command]
pub async fn cloudflare_set_token(token: String, root: Option<String>) -> Result<Value, String> {
    let body = serde_json::to_string(&serde_json::json!({ "token": token }))
        .map_err(|error| format!("Token konnte nicht serialisiert werden: {error}"))?;
    run_cloudflare_async("set-token", root, Some(body)).await
}

#[tauri::command]
pub async fn cloudflare_clear_token(root: Option<String>) -> Result<Value, String> {
    run_cloudflare_async("clear-token", root, None).await
}

#[tauri::command]
pub async fn cloudflare_start(root: Option<String>) -> Result<Value, String> {
    run_cloudflare_async("start", root, None).await
}

#[tauri::command]
pub async fn cloudflare_stop(root: Option<String>) -> Result<Value, String> {
    run_cloudflare_async("stop", root, None).await
}

// ── Teardown beim Beenden ──────────────────────────────────────────────────

/// Fährt Tunnel und gehostete Dienste geordnet herunter. Blockierend, gedacht
/// für den Beenden-Pfad: erst der Tunnel (damit von außen sofort nichts mehr
/// hereinkommt), dann die Next.js-Dienste, damit laufende Anfragen nicht
/// mitten im Schreiben abgeschnitten werden.
///
/// Fehler werden gesammelt statt weitergeworfen — ein hängender Teilschritt darf
/// das Beenden nicht verhindern. Was hier liegen bleibt, fängt das Job Object aus
/// `process_guard` ab, sobald der Prozess verschwindet.
pub fn shutdown_hosted_services_blocking(root: Option<String>) -> Vec<String> {
    let mut problems = Vec::new();

    if let Err(error) = run_cloudflare("stop", root.clone(), None) {
        problems.push(format!("Cloudflare-Tunnel: {error}"));
    }
    if let Err(error) = run_host_command("stop", root, None) {
        problems.push(format!("UWE-Dienste: {error}"));
    }

    problems
}

/// Letzte Absicherung auf dem Beenden-Pfad: die vom Host-Controller
/// hinterlegten PIDs direkt abschießen, ohne Node zu starten.
///
/// Läuft in `RunEvent::Exit` — also auch für Beenden-Wege, die nicht durch
/// `exit_app` gehen (Tray-Menü) — und muss deshalb schnell und ohne
/// Fehlerbehandlung durchlaufen. Der geordnete Weg hat die PID-Dateien in der
/// Regel bereits entfernt; dann ist das hier ein No-op.
pub fn kill_tracked_service_processes() {
    let Ok(data_dir) = connector_app_data_dir() else {
        return;
    };
    let runtime_dir = data_dir.join("host").join("runtime");
    let Ok(entries) = std::fs::read_dir(&runtime_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("pid") {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(pid) = raw.trim().parse::<u32>() else {
            continue;
        };
        if pid == 0 {
            continue;
        }
        kill_process_tree(pid);
        let _ = std::fs::remove_file(&path);
    }
}

/// Beendet den Dienst hinter `pid`.
///
/// Auf Windows bewusst über die Win32-API statt über `taskkill`: Diese Funktion
/// läuft auch, während Windows herunterfährt, und dort lässt sich kein neuer
/// Prozess mehr zuverlässig starten. `taskkill.exe` scheiterte dann an der
/// DLL-Initialisierung (`0xc0000142`) und zeigte pro Dienst einen Fehlerdialog,
/// der das Herunterfahren blockierte, bis jemand ihn wegklickte.
/// `TerminateProcess` braucht keinen Prozessstart und kann so nicht scheitern.
///
/// Dass damit `taskkill /T` (ganzer Prozessbaum) entfällt, ist unkritisch: die
/// Dienste und ihre Kinder hängen im Job Object aus `process_guard`, das sie
/// spätestens mit dem Command-Center-Prozess abräumt.
fn kill_process_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        windows_kill::terminate(pid);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("kill")
            .args(["-TERM", &format!("-{pid}")])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

/// `TerminateProcess` von Hand deklariert — dieselbe Konvention wie in
/// `process_guard`, damit für zwei Aufrufe keine Windows-Crate nötig wird.
#[cfg(target_os = "windows")]
mod windows_kill {
    use std::ffi::c_void;

    type Handle = *mut c_void;

    /// `PROCESS_TERMINATE`
    const PROCESS_TERMINATE: u32 = 0x0001;

    extern "system" {
        fn OpenProcess(access: u32, inherit_handle: i32, pid: u32) -> Handle;
        fn TerminateProcess(process: Handle, exit_code: u32) -> i32;
        fn CloseHandle(handle: Handle) -> i32;
    }

    /// Fehlschläge bleiben still: ein längst beendeter Dienst liefert schlicht
    /// ein Null-Handle, und auf dem Beenden-Pfad gibt es niemanden mehr, der
    /// eine Meldung lesen könnte.
    pub fn terminate(pid: u32) {
        // SAFETY: reine Win32-Aufrufe. Das Handle stammt aus `OpenProcess`, wird
        // nur bei Erfolg benutzt und auf jedem Pfad wieder geschlossen.
        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
            if handle.is_null() {
                return;
            }
            TerminateProcess(handle, 1);
            CloseHandle(handle);
        }
    }
}

// ── Operations (Abschnitt D: was aus Studio hierher gezogen ist) ───────────
// Security, Secrets-Status, Migrationen, Audit-Log, API-Tokens, Webhooks und
// Einstellungen. Eine Brücke statt sieben: die Aktion kommt als Parameter, die
// CLI prüft sie gegen ihre eigene Whitelist. Nutzlast (teils geheim) geht über
// stdin, nie als Prozessargument.

const OPS_CLI_REL: &str = "tools/uwe-host-command-center/src/ops-cli.ts";

/// Actions the frontend may invoke. The CLI validates independently; this list
/// keeps a compromised renderer from reaching a future action it should not.
const OPS_ACTIONS: &[&str] = &[
    "security-status",
    "secrets-status",
    "migration-status",
    "audit-log",
    "api-tokens-list",
    "api-tokens-create",
    "api-tokens-revoke",
    "webhooks-list",
    "webhooks-create",
    "webhooks-delete",
    "settings-get",
    "settings-update",
    "setup-status",
    "smtp-status",
    "smtp-set",
    "smtp-clear",
    "cloudflare-challenge-status",
    "cloudflare-challenge-set",
    "cloudflare-challenge-apply",
    "cloudflare-tunnel-status",
    "cloudflare-tunnel-apply",
    "turnstile-status",
    "turnstile-set",
    "google-login-set",
    // Dokument- und Bulk-Wiki-Import: liest Markdown von einem Pfad auf dem
    // Host und legt daraus Wiki-Seiten an.
    "doc-import-targets",
    "doc-import-preview",
    "doc-import-execute",
];

fn build_ops_command(action: &str, root: Option<String>) -> Result<Command, String> {
    if !OPS_ACTIONS.contains(&action) {
        return Err(format!("Unbekannte Betriebs-Aktion: {action}"));
    }

    let root = resolve_requested_root(root)?;
    let script = root.join(OPS_CLI_REL);
    if !script.exists() {
        return Err(format!(
            "Betriebs-Werkzeuge nicht gefunden: {}. Bitte einen aktuellen UWE-Projektordner auswählen.",
            script.display()
        ));
    }

    let mut command = Command::new("node");
    configure_hidden_process(&mut command);
    command
        .arg("--import")
        .arg("tsx")
        .arg(OPS_CLI_REL)
        .arg(action)
        .current_dir(&root);
    Ok(command)
}

fn run_ops(
    action: &str,
    stdin_json: Option<String>,
    root: Option<String>,
) -> Result<Value, String> {
    let mut command = build_ops_command(action, root)?;
    // stdin immer als Pipe, auch ohne Nutzlast: die CLI liest es für Aktionen
    // mit optionalem Eingabe-Objekt (`audit-log`, `api-tokens-list`) und wartet
    // auf dessen Ende. Geerbtes stdin einer fensterlosen App liefert dieses Ende
    // nie — das Audit-Log lud dann endlos. Die Pipe wird unten geschlossen.
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Betriebs-Werkzeuge konnten nicht gestartet werden: {error}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        if let Some(payload) = stdin_json {
            stdin
                .write_all(payload.as_bytes())
                .map_err(|error| format!("Daten konnten nicht übergeben werden: {error}"))?;
        }
        // `stdin` fällt hier aus dem Gültigkeitsbereich: die Pipe wird
        // geschlossen, die CLI sieht EOF. Ohne dieses Schließen würde sie auch
        // mit übergebener Nutzlast weiterlesen.
        drop(stdin);
    }

    let output = child.wait_with_output().map_err(|error| {
        format!("Betriebs-Werkzeuge konnten nicht abgeschlossen werden: {error}")
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Betriebs-Werkzeuge sind fehlgeschlagen.".to_string()
        } else {
            stderr
        });
    }

    stdout
        .lines()
        .rev()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .find_map(|line| serde_json::from_str::<Value>(line).ok())
        .ok_or_else(|| "Antwort der Betriebs-Werkzeuge konnte nicht gelesen werden.".to_string())
}

#[tauri::command]
pub async fn ops_invoke(
    action: String,
    payload: Option<Value>,
    root: Option<String>,
) -> Result<Value, String> {
    let stdin_json = match payload {
        Some(value) => Some(
            serde_json::to_string(&value)
                .map_err(|error| format!("Daten konnten nicht serialisiert werden: {error}"))?,
        ),
        None => None,
    };

    tauri::async_runtime::spawn_blocking(move || run_ops(&action, stdin_json, root))
        .await
        .map_err(|error| format!("Betriebs-Werkzeuge wurden unerwartet beendet: {error}"))?
}

// ── Host env editor ────────────────────────────────────────────────────────
// get/set allow-listed keys in the monorepo .env (ports, public URLs, auth, AI,
// SMTP). set-env receives the update map on stdin.

fn run_host_command_with_stdin(
    action: &str,
    root: Option<String>,
    stdin_json: String,
) -> Result<Value, String> {
    let mut command = build_host_command(action, root, None)?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("Host-Aktion konnte nicht gestartet werden: {error}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(stdin_json.as_bytes())
            .map_err(|error| format!("Eingabe konnte nicht übergeben werden: {error}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Host-Aktion konnte nicht abgeschlossen werden: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Host-Aktion ist fehlgeschlagen.".to_string()
        } else {
            stderr
        });
    }
    extract_result_payload(&stdout)
        .ok_or_else(|| "Antwort der Host-Steuerung konnte nicht gelesen werden.".to_string())
}

#[tauri::command]
pub async fn get_host_env(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("get-env", root, None).await
}

// ── Install selection ──────────────────────────────────────────────────────
// Which UWE apps this installation runs (Studio / Portal / Brain / Family /
// landing page) plus the demo-seed choice. Written once by the first-run
// install wizard and read by setup, status, start and stop.

#[tauri::command]
pub async fn get_install_selection(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("get-install-selection", root, None).await
}

#[tauri::command]
pub async fn set_install_selection(
    root: Option<String>,
    selection: Value,
) -> Result<Value, String> {
    let body = serde_json::to_string(&selection)
        .map_err(|error| format!("App-Auswahl konnte nicht serialisiert werden: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || {
        run_host_command_with_stdin("set-install-selection", root, body)
    })
    .await
    .map_err(|error| format!("Host-Aktion wurde unerwartet beendet: {error}"))?
}

#[tauri::command]
pub async fn set_host_env(root: Option<String>, updates: Value) -> Result<Value, String> {
    let body = serde_json::to_string(&updates)
        .map_err(|error| format!("Einstellungen konnten nicht serialisiert werden: {error}"))?;
    tauri::async_runtime::spawn_blocking(move || run_host_command_with_stdin("set-env", root, body))
        .await
        .map_err(|error| format!("Host-Aktion wurde unerwartet beendet: {error}"))?
}

// ── Per-service control ────────────────────────────────────────────────────
// Start / stop / restart a single host service (studio | portal | brain) via the
// --target arg, without cycling the whole host.

#[tauri::command]
pub async fn start_service(root: Option<String>, service: String) -> Result<Value, String> {
    run_host_command_async("start-service", root, Some(service)).await
}

#[tauri::command]
pub async fn stop_service(root: Option<String>, service: String) -> Result<Value, String> {
    run_host_command_async("stop-service", root, Some(service)).await
}

#[tauri::command]
pub async fn restart_service(root: Option<String>, service: String) -> Result<Value, String> {
    run_host_command_async("restart-service", root, Some(service)).await
}

#[tauri::command]
pub async fn update_user(user: Value, root: Option<String>) -> Result<Value, String> {
    let payload = serde_json::to_string(&user)
        .map_err(|error| format!("Benutzerdaten konnten nicht serialisiert werden: {error}"))?;
    run_user_admin_async("update", Vec::new(), Some(payload), root).await
}

// ── Backups ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_backups(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("list-backups", root, None).await
}

#[tauri::command]
pub async fn restore_backup(root: Option<String>, name: String) -> Result<Value, String> {
    run_host_command_async("restore-backup", root, Some(name)).await
}

#[cfg(test)]
mod breakaway_tests {
    use super::host_action_needs_breakaway;

    /// `open` muss immer ausbrechen — der geöffnete Browser darf nie mit dem
    /// Command Center sterben, unabhängig von `stopServicesOnExit`.
    #[test]
    fn open_always_breaks_away() {
        assert!(host_action_needs_breakaway("open", false));
        assert!(host_action_needs_breakaway("open", true));
    }

    /// Kern des Fixes für `stopServicesOnExit: false`: Dienst-startende
    /// Aktionen brechen aus dem Job Object aus, damit die abgekoppelt
    /// gestarteten Dienste das Beenden der App überleben.
    #[test]
    fn service_spawning_actions_break_away_when_services_survive_exit() {
        for action in [
            "start",
            "restart",
            "start-service",
            "restart-service",
            "update",
        ] {
            assert!(
                host_action_needs_breakaway(action, true),
                "{action} muss bei stopServicesOnExit=false ausbrechen"
            );
            assert!(
                !host_action_needs_breakaway(action, false),
                "{action} muss bei stopServicesOnExit=true im Job Object bleiben"
            );
        }
    }

    /// Aktionen ohne Dauerprozesse bleiben immer im Job Object — sie brauchen
    /// die Kernel-Aufräumgarantie und hinterlassen nichts, das überleben soll.
    #[test]
    fn short_lived_actions_stay_in_the_job() {
        for action in [
            "status",
            "stop",
            "stop-service",
            "setup",
            "backup",
            "logs",
            "get-env",
        ] {
            assert!(!host_action_needs_breakaway(action, true));
            assert!(!host_action_needs_breakaway(action, false));
        }
    }
}
