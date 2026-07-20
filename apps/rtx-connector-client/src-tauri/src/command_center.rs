use std::{path::PathBuf, process::Command};

use serde_json::Value;

use super::{configure_hidden_process, connector_app_data_dir, resolve_monorepo_root};

const DESKTOP_HOST_CLI_REL: &str = "tools/uwe-host-command-center/src/desktop-host.ts";

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

fn run_host_command(
    action: &str,
    root: Option<String>,
    target: Option<String>,
) -> Result<Value, String> {
    let output = build_host_command(action, root, target)?
        .output()
        .map_err(|error| format!("Host-Aktion konnte nicht gestartet werden: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(if stderr.is_empty() {
            format!("Host-Aktion {action} ist fehlgeschlagen.")
        } else {
            stderr
        });
    }
    serde_json::from_str(&stdout)
        .map_err(|error| format!("Antwort der Host-Steuerung konnte nicht gelesen werden: {error}"))
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

#[tauri::command]
pub async fn get_host_status(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("status", root, None).await
}

#[tauri::command]
pub async fn setup_host(root: Option<String>) -> Result<Value, String> {
    run_host_command_async("setup", root, None).await
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
