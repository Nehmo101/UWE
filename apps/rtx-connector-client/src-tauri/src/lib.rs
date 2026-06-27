use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command, Output, Stdio},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use dirs::data_local_dir;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{Manager, RunEvent, State};
use url::Url;

/// Relative path (from the monorepo root) to the Node desktop launcher that
/// runs the outbound connector work loop.
const CONNECTOR_LAUNCHER_REL: &str = "tools/uwe-rtx-connector/src/desktop-launcher.ts";
const CONNECTOR_CLIENT_CLI_REL: &str = "tools/uwe-rtx-connector/src/client-cli.ts";

/// Timeout for the host connection test request.
const HOST_TEST_TIMEOUT: Duration = Duration::from_secs(10);

const APP_VENDOR_DIR: &str = "UWE";
const APP_NAME_DIR: &str = "rtx-connector-client";
const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorClientConfig {
    host_url: String,
    token: String,
    name: String,
    queue_enabled: bool,
    wizard_completed: bool,
    auto_connect: bool,
    minimized_start: bool,
    autostart_windows: bool,
    tray_mode: String,
    /// Privacy mode — when true the connector reports only minimal metadata to
    /// the host. Defaulted for forward-compatibility with older config files.
    #[serde(default)]
    privacy_mode: bool,
}

impl Default for ConnectorClientConfig {
    fn default() -> Self {
        Self {
            host_url: String::new(),
            token: String::new(),
            name: "RTX Host Connector".to_string(),
            queue_enabled: true,
            wizard_completed: false,
            auto_connect: true,
            minimized_start: false,
            autostart_windows: false,
            tray_mode: "minimize_to_tray".to_string(),
            privacy_mode: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorRuntimeStatus {
    status: String,
    message: Option<String>,
    connection_status: String,
    last_heartbeat_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostConnectionTestResult {
    ok: bool,
    status: String,
    message: String,
    checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PullOllamaResult {
    events: Vec<serde_json::Value>,
    store: serde_json::Value,
}

#[derive(Debug, Default)]
struct ConnectorRuntimeState {
    running: bool,
    last_heartbeat_at: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Default)]
struct AppState {
    runtime: Mutex<ConnectorRuntimeState>,
    /// Handle to the spawned Node connector process, when running.
    child: Mutex<Option<Child>>,
}

fn now_timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

/// Resolve the UWE monorepo root used as the working directory for the Node
/// connector process. Prefers the `UWE_MONOREPO_ROOT` env override, otherwise
/// walks up from the current working directory looking for `pnpm-workspace.yaml`.
fn resolve_monorepo_root() -> PathBuf {
    if let Ok(root) = std::env::var("UWE_MONOREPO_ROOT") {
        let trimmed = root.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let mut current: &Path = cwd.as_path();
        loop {
            if current.join("pnpm-workspace.yaml").exists() {
                return current.to_path_buf();
            }
            match current.parent() {
                Some(parent) => current = parent,
                None => break,
            }
        }
        return cwd;
    }

    PathBuf::from(".")
}

fn build_client_cli_command(args: &[&str]) -> Result<Command, String> {
    let root = resolve_monorepo_root();
    let data_dir = connector_app_data_dir()?;

    let mut command = Command::new("node");
    command
        .arg("--import")
        .arg("tsx")
        .arg(CONNECTOR_CLIENT_CLI_REL)
        .args(args)
        .current_dir(&root)
        .env("UWE_RUNTIME_ROLE", "rtx-connector-client")
        .env("UWE_CONNECTOR_CLIENT_DATA_DIR", &data_dir);

    Ok(command)
}

fn client_cli_output_to_string(action: &str, output: Output) -> Result<String, String> {
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            "Kein Fehlertext ausgegeben.".to_string()
        };

        return Err(format!("client-cli {action} fehlgeschlagen: {detail}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn run_client_cli(args: &[&str]) -> Result<String, String> {
    let output = build_client_cli_command(args)?
        .output()
        .map_err(|error| format!("client-cli konnte nicht gestartet werden: {error}"))?;

    client_cli_output_to_string(&args.join(" "), output)
}

fn run_client_cli_with_stdin(args: &[&str], stdin_payload: &str) -> Result<String, String> {
    let mut command = build_client_cli_command(args)?;
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("client-cli konnte nicht gestartet werden: {error}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(stdin_payload.as_bytes())
            .map_err(|error| format!("client-cli stdin konnte nicht geschrieben werden: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("client-cli konnte nicht abgeschlossen werden: {error}"))?;

    client_cli_output_to_string(&args.join(" "), output)
}

fn parse_client_cli_json<T: DeserializeOwned>(raw: &str, label: &str) -> Result<T, String> {
    serde_json::from_str(raw).map_err(|error| format!("{label} konnte nicht geparst werden: {error}"))
}

/// Reconcile the runtime state with the real child process: detect a process
/// that has exited on its own and clear the handle so status reflects reality.
fn sync_runtime_with_child(child_slot: &mut Option<Child>, runtime: &mut ConnectorRuntimeState) {
    match child_slot.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(Some(status)) => {
                *child_slot = None;
                runtime.running = false;
                runtime.last_heartbeat_at = None;
                let code = status
                    .code()
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "unbekannt".to_string());
                runtime.message =
                    Some(format!("Connector-Prozess wurde beendet (Exit-Code {code})."));
            }
            Ok(None) => {
                runtime.running = true;
            }
            Err(error) => {
                *child_slot = None;
                runtime.running = false;
                runtime.message =
                    Some(format!("Connector-Prozessstatus nicht lesbar: {error}"));
            }
        },
        None => {
            runtime.running = false;
        }
    }
}

/// Kill the spawned connector process (if any) and wait for it to exit.
fn terminate_child(child_slot: &mut Option<Child>) {
    if let Some(mut child) = child_slot.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn connector_app_data_dir() -> Result<PathBuf, String> {
    let base_dir = data_local_dir()
        .ok_or_else(|| "Lokales AppData-Verzeichnis konnte nicht ermittelt werden.".to_string())?;

    Ok(base_dir.join(APP_VENDOR_DIR).join(APP_NAME_DIR))
}

fn connector_config_path() -> Result<PathBuf, String> {
    Ok(connector_app_data_dir()?.join(CONFIG_FILE_NAME))
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Konfigurationsordner konnte nicht angelegt werden: {error}"))?;
    }

    Ok(())
}

fn normalize_host_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    let parsed = Url::parse(trimmed).map_err(|_| format!("Host-URL ist ungueltig: {trimmed}"))?;
    let scheme = parsed.scheme();

    if scheme != "http" && scheme != "https" {
        return Err("Host-URL muss http:// oder https:// verwenden.".to_string());
    }

    Ok(trimmed.trim_end_matches('/').to_string())
}

fn normalize_config(mut config: ConnectorClientConfig) -> Result<ConnectorClientConfig, String> {
    config.host_url = normalize_host_url(&config.host_url)?;
    config.token = config.token.trim().to_string();
    config.name = config.name.trim().to_string();

    if config.name.is_empty() {
        config.name = "RTX Host Connector".to_string();
    }

    if config.tray_mode.is_empty() {
        config.tray_mode = "minimize_to_tray".to_string();
    }

    Ok(config)
}

fn read_config_from_disk() -> Result<ConnectorClientConfig, String> {
    let path = connector_config_path()?;

    if !path.exists() {
        return Ok(ConnectorClientConfig::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Konfiguration konnte nicht gelesen werden: {error}"))?;
    let parsed = serde_json::from_str::<ConnectorClientConfig>(&raw)
        .map_err(|error| format!("Konfiguration ist kein gueltiges JSON: {error}"))?;

    normalize_config(parsed)
}

fn write_config_to_disk(config: &ConnectorClientConfig) -> Result<(), String> {
    let path = connector_config_path()?;
    ensure_parent_dir(&path)?;

    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Konfiguration konnte nicht serialisiert werden: {error}"))?;

    fs::write(&path, json)
        .map_err(|error| format!("Konfiguration konnte nicht gespeichert werden: {error}"))?;

    Ok(())
}

fn derive_connection_status(config: &ConnectorClientConfig, running: bool) -> &'static str {
    if config.host_url.is_empty() || config.token.is_empty() {
        "not_configured"
    } else if running {
        "connected"
    } else {
        "ready"
    }
}

fn status_snapshot(
    runtime: &ConnectorRuntimeState,
    config: &ConnectorClientConfig,
) -> ConnectorRuntimeStatus {
    ConnectorRuntimeStatus {
        status: if runtime.running {
            "running".to_string()
        } else {
            "stopped".to_string()
        },
        message: runtime.message.clone().or_else(|| {
            Some(if runtime.running {
                "Connector-Stub laeuft.".to_string()
            } else {
                "Connector-Stub ist gestoppt.".to_string()
            })
        }),
        connection_status: derive_connection_status(config, runtime.running).to_string(),
        last_heartbeat_at: runtime.last_heartbeat_at.clone(),
    }
}

#[tauri::command]
fn get_model_store() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["model-store-get"])?;
    parse_client_cli_json(&raw, "Model-Store")
}

#[tauri::command]
fn save_model_store(store: serde_json::Value) -> Result<serde_json::Value, String> {
    let payload = serde_json::to_string(&store)
        .map_err(|error| format!("Model-Store konnte nicht serialisiert werden: {error}"))?;
    let raw = run_client_cli_with_stdin(&["model-store-save"], &payload)?;
    parse_client_cli_json(&raw, "Model-Store")
}

#[tauri::command]
fn scan_models() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["scan"])?;
    parse_client_cli_json(&raw, "Scan-Ergebnis")
}

#[tauri::command]
fn pull_ollama_model(name: String) -> Result<PullOllamaResult, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Ollama-Modellname darf nicht leer sein.".to_string());
    }

    let raw = run_client_cli(&["pull-ollama", trimmed])?;
    let mut events = Vec::new();
    let mut store: Option<serde_json::Value> = None;

    for line in raw.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let value: serde_json::Value = serde_json::from_str(line)
            .map_err(|error| format!("Ollama-Pull-Ausgabe ist kein gueltiges JSON: {error}"))?;

        if value.get("profiles").is_some() && value.get("scanPaths").is_some() {
            store = Some(value);
        } else {
            events.push(value);
        }
    }

    let store = store.ok_or_else(|| {
        "Ollama-Pull lieferte keinen aktualisierten Model-Store zuruueck.".to_string()
    })?;

    Ok(PullOllamaResult { events, store })
}

#[tauri::command]
fn list_connector_jobs() -> Result<Vec<serde_json::Value>, String> {
    let raw = run_client_cli(&["jobs"])?;
    parse_client_cli_json(&raw, "Job-Historie")
}

#[tauri::command]
fn list_connector_logs(category: Option<String>) -> Result<Vec<String>, String> {
    let raw = match category.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["logs", value])?,
        None => run_client_cli(&["logs"])?,
    };

    parse_client_cli_json(&raw, "Connector-Logs")
}

#[tauri::command]
fn cookbook_dashboard() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["cookbook-dashboard"])?;
    parse_client_cli_json(&raw, "Cookbook-Dashboard")
}

#[tauri::command]
fn probe_runners() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["probe-runners"])?;
    parse_client_cli_json(&raw, "Runner-Status")
}

#[tauri::command]
fn start_ollama() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["start-ollama"])?;
    parse_client_cli_json(&raw, "Ollama-Start")
}

#[tauri::command]
fn test_runner(runner: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match runner.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["test-runner", value])?,
        None => run_client_cli(&["test-runner"])?,
    };

    parse_client_cli_json(&raw, "Runner-Test")
}

#[tauri::command]
fn read_config() -> Result<ConnectorClientConfig, String> {
    read_config_from_disk()
}

#[tauri::command]
fn write_config(config: ConnectorClientConfig, app_state: State<'_, AppState>) -> Result<ConnectorClientConfig, String> {
    let normalized = normalize_config(config)?;
    write_config_to_disk(&normalized)?;

    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht aktualisiert werden.".to_string())?;

    if !runtime.running {
        runtime.last_heartbeat_at = None;
        runtime.message = Some("Konfiguration gespeichert. Connector-Stub ist gestoppt.".to_string());
    }

    Ok(normalized)
}

#[tauri::command]
fn get_connector_status(app_state: State<'_, AppState>) -> Result<ConnectorRuntimeStatus, String> {
    let config = read_config_from_disk()?;
    let mut child_slot = app_state
        .child
        .lock()
        .map_err(|_| "Connector-Prozess konnte nicht gelesen werden.".to_string())?;
    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gelesen werden.".to_string())?;

    sync_runtime_with_child(&mut child_slot, &mut runtime);

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
fn start_connector(app_state: State<'_, AppState>) -> Result<ConnectorRuntimeStatus, String> {
    let config = read_config_from_disk()?;
    let mut child_slot = app_state
        .child
        .lock()
        .map_err(|_| "Connector-Prozess konnte nicht gestartet werden.".to_string())?;
    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gestartet werden.".to_string())?;

    if config.host_url.is_empty() || config.token.is_empty() {
        terminate_child(&mut child_slot);
        runtime.running = false;
        runtime.last_heartbeat_at = None;
        runtime.message = Some(
            "Host-URL und Connector-Token muessen zuerst gespeichert werden.".to_string(),
        );

        return Ok(status_snapshot(&runtime, &config));
    }

    // Already running? Reconcile and return current status instead of spawning twice.
    sync_runtime_with_child(&mut child_slot, &mut runtime);
    if child_slot.is_some() {
        runtime.message = Some("Connector-Prozess laeuft bereits.".to_string());
        return Ok(status_snapshot(&runtime, &config));
    }

    let root = resolve_monorepo_root();
    let data_dir = connector_app_data_dir()?;
    let mut command = std::process::Command::new("node");
    command
        .arg("--import")
        .arg("tsx")
        .arg(CONNECTOR_LAUNCHER_REL)
        .current_dir(&root)
        .env("UWE_RUNTIME_ROLE", "rtx-connector")
        .env("UWE_HOST_URL", &config.host_url)
        .env("UWE_CONNECTOR_TOKEN", &config.token)
        .env("UWE_CONNECTOR_NAME", &config.name)
        .env("UWE_CONNECTOR_CLIENT_DATA_DIR", &data_dir)
        .env(
            "UWE_CONNECTOR_QUEUE_ENABLED",
            if config.queue_enabled { "true" } else { "false" },
        )
        .env(
            "UWE_CONNECTOR_PRIVACY_MODE",
            if config.privacy_mode { "true" } else { "false" },
        );

    match command.spawn() {
        Ok(child) => {
            *child_slot = Some(child);
            runtime.running = true;
            runtime.last_heartbeat_at = Some(now_timestamp());
            runtime.message =
                Some("Connector-Prozess gestartet. Outbound-Worker laeuft.".to_string());
        }
        Err(error) => {
            runtime.running = false;
            runtime.last_heartbeat_at = None;
            runtime.message = Some(format!(
                "Connector-Prozess konnte nicht gestartet werden: {error}. Ist Node.js installiert?"
            ));
            return Ok(status_snapshot(&runtime, &config));
        }
    }

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
fn stop_connector(app_state: State<'_, AppState>) -> Result<ConnectorRuntimeStatus, String> {
    let config = read_config_from_disk()?;
    let mut child_slot = app_state
        .child
        .lock()
        .map_err(|_| "Connector-Prozess konnte nicht gestoppt werden.".to_string())?;
    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gestoppt werden.".to_string())?;

    terminate_child(&mut child_slot);
    runtime.running = false;
    runtime.last_heartbeat_at = None;
    runtime.message = Some("Connector-Prozess gestoppt.".to_string());

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
async fn test_host_connection(
    host_url: String,
    token: Option<String>,
) -> Result<HostConnectionTestResult, String> {
    let checked_at = now_timestamp();

    let normalized = match normalize_host_url(&host_url) {
        Ok(value) => value,
        Err(message) => {
            return Ok(HostConnectionTestResult {
                ok: false,
                status: "error".to_string(),
                message,
                checked_at,
            });
        }
    };

    if normalized.is_empty() {
        return Ok(HostConnectionTestResult {
            ok: false,
            status: "not_configured".to_string(),
            message: "Host-URL darf nicht leer sein.".to_string(),
            checked_at,
        });
    }

    // Use the supplied token, or fall back to the saved configuration token.
    let effective_token = token
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            read_config_from_disk()
                .ok()
                .map(|config| config.token)
                .filter(|value| !value.is_empty())
        });

    let token = match effective_token {
        Some(value) => value,
        None => {
            return Ok(HostConnectionTestResult {
                ok: false,
                status: "not_configured".to_string(),
                message:
                    "Connector-Token fehlt. Token speichern oder im Test-Dialog eingeben."
                        .to_string(),
                checked_at,
            });
        }
    };

    let url = format!("{normalized}/api/connectors/config");
    let client = match reqwest::Client::builder()
        .timeout(HOST_TEST_TIMEOUT)
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            return Ok(HostConnectionTestResult {
                ok: false,
                status: "error".to_string(),
                message: format!("HTTP-Client konnte nicht erstellt werden: {error}"),
                checked_at,
            });
        }
    };

    let response = client
        .get(&url)
        .bearer_auth(&token)
        .header("Accept", "application/json")
        .send()
        .await;

    match response {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                Ok(HostConnectionTestResult {
                    ok: true,
                    status: "connected".to_string(),
                    message: format!(
                        "Verbindung erfolgreich: Host {normalized} akzeptiert das Connector-Token."
                    ),
                    checked_at,
                })
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                Ok(HostConnectionTestResult {
                    ok: false,
                    status: "error".to_string(),
                    message: format!(
                        "Host hat das Connector-Token abgelehnt (HTTP {}). Token im Studio unter System → RTX Connector pruefen.",
                        status.as_u16()
                    ),
                    checked_at,
                })
            } else {
                Ok(HostConnectionTestResult {
                    ok: false,
                    status: "error".to_string(),
                    message: format!(
                        "Host {normalized} antwortet mit HTTP {}. Ist die URL korrekt?",
                        status.as_u16()
                    ),
                    checked_at,
                })
            }
        }
        Err(error) => Ok(HostConnectionTestResult {
            ok: false,
            status: "error".to_string(),
            message: format!("Host {normalized} ist nicht erreichbar: {error}"),
            checked_at,
        }),
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_config,
            write_config,
            get_connector_status,
            start_connector,
            stop_connector,
            test_host_connection,
            get_model_store,
            save_model_store,
            scan_models,
            pull_ollama_model,
            list_connector_jobs,
            list_connector_logs,
            cookbook_dashboard,
            probe_runners,
            start_ollama,
            test_runner
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                // Ensure the spawned Node connector process is torn down with the app.
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Ok(mut child_slot) = state.child.lock() {
                        terminate_child(&mut child_slot);
                    }
                }
            }
        });
}
