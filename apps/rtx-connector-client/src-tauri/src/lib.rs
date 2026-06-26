use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use dirs::data_local_dir;
use serde::{Deserialize, Serialize};
use tauri::State;
use url::Url;

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

#[derive(Debug, Default)]
struct ConnectorRuntimeState {
    running: bool,
    last_heartbeat_at: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Default)]
struct AppState {
    runtime: Mutex<ConnectorRuntimeState>,
}

fn now_timestamp() -> String {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
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
    let runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gelesen werden.".to_string())?;

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
fn start_connector(app_state: State<'_, AppState>) -> Result<ConnectorRuntimeStatus, String> {
    let config = read_config_from_disk()?;
    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gestartet werden.".to_string())?;

    if config.host_url.is_empty() || config.token.is_empty() {
        runtime.running = false;
        runtime.last_heartbeat_at = None;
        runtime.message = Some(
            "Host-URL und Connector-Token muessen zuerst gespeichert werden.".to_string(),
        );

        return Ok(status_snapshot(&runtime, &config));
    }

    runtime.running = true;
    runtime.last_heartbeat_at = Some(now_timestamp());
    runtime.message = Some(
        "Stub: Connector-Prozess als laufend markiert. Echte Spawn-Logik folgt spaeter."
            .to_string(),
    );

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
fn stop_connector(app_state: State<'_, AppState>) -> Result<ConnectorRuntimeStatus, String> {
    let config = read_config_from_disk()?;
    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht gestoppt werden.".to_string())?;

    runtime.running = false;
    runtime.last_heartbeat_at = None;
    runtime.message = Some("Stub: Connector-Prozess als gestoppt markiert.".to_string());

    Ok(status_snapshot(&runtime, &config))
}

#[tauri::command]
fn test_host_connection(host_url: String) -> Result<HostConnectionTestResult, String> {
    let checked_at = now_timestamp();

    match normalize_host_url(&host_url) {
        Ok(normalized) if normalized.is_empty() => Ok(HostConnectionTestResult {
            ok: false,
            status: "not_configured".to_string(),
            message: "Host-URL darf nicht leer sein.".to_string(),
            checked_at,
        }),
        Ok(normalized) => Ok(HostConnectionTestResult {
            ok: true,
            status: "ready".to_string(),
            message: format!(
                "Stub: Host-URL {normalized} ist syntaktisch gueltig. Ein echter Netztest folgt spaeter."
            ),
            checked_at,
        }),
        Err(message) => Ok(HostConnectionTestResult {
            ok: false,
            status: "error".to_string(),
            message,
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
            test_host_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
