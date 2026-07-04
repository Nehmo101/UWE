use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Output, Stdio},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use dirs::data_local_dir;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, State, WindowEvent,
};
use url::Url;

/// Relative path (from the monorepo root) to the Node desktop launcher that
/// runs the outbound connector work loop.
const CONNECTOR_LAUNCHER_REL: &str = "tools/uwe-rtx-connector/src/desktop-launcher.ts";
const CONNECTOR_CLIENT_CLI_REL: &str = "tools/uwe-rtx-connector/src/client-cli.ts";
const HUGGINGFACE_CLI_REL: &str = "tools/uwe-rtx-connector/src/huggingface-cli.ts";

/// Timeout for the host connection test request.
const HOST_TEST_TIMEOUT: Duration = Duration::from_secs(10);

const APP_VENDOR_DIR: &str = "UWE";
const APP_NAME_DIR: &str = "rtx-connector-client";
const CONFIG_FILE_NAME: &str = "config.json";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn configure_hidden_process(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}
#[cfg(target_os = "windows")]
const AUTOSTART_RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg(target_os = "windows")]
const AUTOSTART_VALUE_NAME: &str = "UWE RTX Connector Client";

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
    /// Spotify OAuth credentials + local executor commands (P4). Spotify auth
    /// lives only on the RTX client. All defaulted for forward-compatibility
    /// with config files written before P4.
    #[serde(default)]
    spotify_client_id: String,
    #[serde(default)]
    spotify_client_secret: String,
    #[serde(default = "default_spotify_redirect_uri")]
    spotify_redirect_uri: String,
    #[serde(default)]
    audio_command: String,
    #[serde(default)]
    image_command: String,
    #[serde(default)]
    print_command: String,
    #[serde(default)]
    default_printer_id: String,
}

fn default_spotify_redirect_uri() -> String {
    "http://127.0.0.1:8742/callback".to_string()
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
            spotify_client_id: String::new(),
            spotify_client_secret: String::new(),
            spotify_redirect_uri: default_spotify_redirect_uri(),
            audio_command: String::new(),
            image_command: String::new(),
            print_command: String::new(),
            default_printer_id: String::new(),
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
        // Only honor the override when it points at a real directory — a stale or
        // mistyped value must not become the process working directory (that
        // triggers a cryptic "os error 267" on Windows when spawning Node).
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.is_dir() {
                return path;
            }
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

fn build_node_script_command(script_rel: &str, args: &[&str]) -> Result<Command, String> {
    let root = resolve_monorepo_root();

    // Validate the working directory and script up-front so a missing monorepo
    // surfaces as an actionable message instead of a cryptic spawn failure
    // (Windows returns "os error 267 — directory name invalid" for an invalid
    // current_dir).
    if !root.is_dir() {
        return Err(format!(
            "Arbeitsverzeichnis für den Connector nicht gefunden: {}. Setze UWE_MONOREPO_ROOT auf den UWE-Projektordner.",
            root.display()
        ));
    }
    let script_path = root.join(script_rel);
    if !script_path.exists() {
        return Err(format!(
            "Connector-Skript nicht gefunden: {}. Ist das UWE-Monorepo ausgecheckt und `pnpm install` gelaufen? Ggf. UWE_MONOREPO_ROOT setzen.",
            script_path.display()
        ));
    }

    let data_dir = connector_app_data_dir()?;

    let mut command = Command::new("node");
    configure_hidden_process(&mut command);
    command
        .arg("--import")
        .arg("tsx")
        .arg(script_rel)
        .args(args)
        .current_dir(&root)
        .env("UWE_RUNTIME_ROLE", "rtx-connector-client")
        .env("UWE_CONNECTOR_CLIENT_DATA_DIR", &data_dir);

    Ok(command)
}

fn build_client_cli_command(args: &[&str]) -> Result<Command, String> {
    build_node_script_command(CONNECTOR_CLIENT_CLI_REL, args)
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

/// Node not being on PATH is by far the most common spawn failure — append a
/// hint so the desktop user knows what to install.
fn describe_spawn_error(error: &std::io::Error) -> String {
    format!("{error}. Ist Node.js installiert und im PATH?")
}

fn run_client_cli(args: &[&str]) -> Result<String, String> {
    let output = build_client_cli_command(args)?
        .output()
        .map_err(|error| format!("client-cli konnte nicht gestartet werden: {}", describe_spawn_error(&error)))?;

    client_cli_output_to_string(&args.join(" "), output)
}

/// Like `run_client_cli`, but streams stdout line-by-line as the child runs,
/// emitting each parsed JSON line as a Tauri event (`event_name`) so the
/// frontend can render live progress instead of waiting for the whole
/// process to exit. Stderr is drained on a background thread so a chatty
/// child can't deadlock the stdout reader by filling its pipe buffer.
///
/// An optional `(key, value)` `tag` is injected into every emitted event:
/// concurrent pulls all share the single `event_name` channel, so tagging each
/// event with its model name lets the frontend attribute live progress to the
/// right download when several run at once.
fn run_client_cli_streaming(
    app: &tauri::AppHandle,
    event_name: &str,
    args: &[&str],
    tag: Option<(&str, &str)>,
) -> Result<String, String> {
    let mut command = build_client_cli_command(args)?;
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("client-cli konnte nicht gestartet werden: {}", describe_spawn_error(&error)))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "client-cli lieferte keinen stdout-Stream.".to_string())?;
    let mut stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "client-cli lieferte keinen stderr-Stream.".to_string())?;

    let stderr_handle = std::thread::spawn(move || -> String {
        let mut buf = String::new();
        let _ = stderr_pipe.read_to_string(&mut buf);
        buf
    });

    let mut collected = String::new();
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|error| format!("client-cli-Ausgabe konnte nicht gelesen werden: {error}"))?;
        if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&line) {
            if let Some((key, tag_value)) = tag {
                if let Some(object) = value.as_object_mut() {
                    object.insert(key.to_string(), serde_json::Value::String(tag_value.to_string()));
                }
            }
            let _ = app.emit(event_name, &value);
        }
        collected.push_str(&line);
        collected.push('\n');
    }

    let status = child
        .wait()
        .map_err(|error| format!("client-cli konnte nicht abgeschlossen werden: {error}"))?;
    let stderr_text = stderr_handle.join().unwrap_or_default();

    if !status.success() {
        let detail = if !stderr_text.trim().is_empty() {
            stderr_text.trim().to_string()
        } else if !collected.trim().is_empty() {
            collected.trim().to_string()
        } else {
            "Kein Fehlertext ausgegeben.".to_string()
        };
        return Err(format!("client-cli {} fehlgeschlagen: {}", args.join(" "), detail));
    }

    Ok(collected.trim().to_string())
}

fn run_node_script(script_rel: &str, args: &[&str]) -> Result<String, String> {
    let output = build_node_script_command(script_rel, args)?
        .output()
        .map_err(|error| format!("{script_rel} konnte nicht gestartet werden: {}", describe_spawn_error(&error)))?;

    client_cli_output_to_string(&format!("{script_rel} {}", args.join(" ")), output)
}

fn run_client_cli_with_stdin(args: &[&str], stdin_payload: &str) -> Result<String, String> {
    let mut command = build_client_cli_command(args)?;
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("client-cli konnte nicht gestartet werden: {}", describe_spawn_error(&error)))?;

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

fn parse_model_download_output(raw: &str, label: &str) -> Result<PullOllamaResult, String> {
    let mut events = Vec::new();
    let mut store: Option<serde_json::Value> = None;

    for line in raw.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let value: serde_json::Value = serde_json::from_str(line)
            .map_err(|error| format!("{label}-Ausgabe ist kein gueltiges JSON: {error}"))?;

        if value.get("profiles").is_some() && value.get("scanPaths").is_some() {
            store = Some(value);
        } else {
            events.push(value);
        }
    }

    let store = store.ok_or_else(|| {
        format!("{label} lieferte keinen aktualisierten Model-Store zurueck.")
    })?;

    Ok(PullOllamaResult { events, store })
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

#[cfg(target_os = "windows")]
fn run_reg(args: &[&str]) -> Result<Output, String> {
    Command::new("reg")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("Windows-Registry konnte nicht aufgerufen werden: {error}"))
}

#[cfg(target_os = "windows")]
fn autostart_command_line() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|error| format!("App-Pfad fuer Autostart konnte nicht ermittelt werden: {error}"))?;
    Ok(format!("\"{}\" --minimized", exe.display()))
}

#[cfg(target_os = "windows")]
fn sync_windows_autostart(enabled: bool) -> Result<(), String> {
    if enabled {
        let command_line = autostart_command_line()?;
        let output = run_reg(&[
            "add",
            AUTOSTART_RUN_KEY,
            "/v",
            AUTOSTART_VALUE_NAME,
            "/t",
            "REG_SZ",
            "/d",
            &command_line,
            "/f",
        ])?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!(
                "Windows-Autostart konnte nicht aktiviert werden: {}",
                if stderr.is_empty() { "Registry-Fehler" } else { &stderr }
            ));
        }
        return Ok(());
    }

    let output = run_reg(&[
        "delete",
        AUTOSTART_RUN_KEY,
        "/v",
        AUTOSTART_VALUE_NAME,
        "/f",
    ])?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let text = format!("{stdout}\n{stderr}").to_lowercase();
        if text.contains("unable to find") || text.contains("nicht gefunden") || text.contains("system was unable") {
            return Ok(());
        }
        return Err("Windows-Autostart konnte nicht deaktiviert werden.".to_string());
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn sync_windows_autostart(_enabled: bool) -> Result<(), String> {
    Ok(())
}

const SPOTIFY_SESSION_FILE_NAME: &str = "spotify-session.json";

/// Subset of the connector-local Spotify session persisted by the Node CLI.
/// Read only to forward the access token + device to the connector process.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpotifySessionFile {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    device_id: Option<String>,
}

/// Best-effort read of the persisted Spotify session. A missing or corrupt file
/// is fine — Spotify is optional and the connector stays online without it.
fn read_spotify_session() -> Option<SpotifySessionFile> {
    let path = connector_app_data_dir().ok()?.join(SPOTIFY_SESSION_FILE_NAME);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<SpotifySessionFile>(&raw).ok()
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

    config.spotify_client_id = config.spotify_client_id.trim().to_string();
    config.spotify_client_secret = config.spotify_client_secret.trim().to_string();
    config.spotify_redirect_uri = config.spotify_redirect_uri.trim().to_string();
    if config.spotify_redirect_uri.is_empty() {
        config.spotify_redirect_uri = default_spotify_redirect_uri();
    }
    config.audio_command = config.audio_command.trim().to_string();
    config.image_command = config.image_command.trim().to_string();
    config.print_command = config.print_command.trim().to_string();
    config.default_printer_id = config.default_printer_id.trim().to_string();

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
                "Connector-Prozess laeuft.".to_string()
            } else {
                "Connector-Prozess ist gestoppt.".to_string()
            })
        }),
        connection_status: derive_connection_status(config, runtime.running).to_string(),
        last_heartbeat_at: runtime.last_heartbeat_at.clone(),
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn should_hide_to_tray() -> bool {
    read_config_from_disk()
        .map(|config| config.tray_mode == "minimize_to_tray" || config.tray_mode == "start_in_tray")
        .unwrap_or(true)
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "Oeffnen", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("UWE RTX Connector Client")
        .menu(&menu)
        .menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
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
fn get_printer_store() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["printer-store-get"])?;
    parse_client_cli_json(&raw, "Drucker-Store")
}

#[tauri::command]
fn save_printer_store(store: serde_json::Value) -> Result<serde_json::Value, String> {
    let payload = serde_json::to_string(&store)
        .map_err(|error| format!("Drucker-Store konnte nicht serialisiert werden: {error}"))?;
    let raw = run_client_cli_with_stdin(&["printer-store-save"], &payload)?;
    parse_client_cli_json(&raw, "Drucker-Store")
}

#[tauri::command]
fn scan_printers() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["scan-printers"])?;
    parse_client_cli_json(&raw, "Drucker-Scan")
}

#[tauri::command]
fn pull_ollama_model(name: String, app: tauri::AppHandle) -> Result<PullOllamaResult, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Ollama-Modellname darf nicht leer sein.".to_string());
    }

    let raw = run_client_cli_streaming(
        &app,
        "ollama-pull-progress",
        &["pull-ollama", trimmed],
        Some(("pullName", trimmed)),
    )?;
    parse_model_download_output(&raw, "Ollama-Pull")
}

#[tauri::command]
fn delete_ollama_model(name: String) -> Result<serde_json::Value, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Ollama-Modellname darf nicht leer sein.".to_string());
    }

    let raw = run_client_cli(&["delete-model", trimmed])?;
    parse_client_cli_json(&raw, "Modell-Löschen")
}

#[tauri::command]
fn pull_huggingface_model(
    repo_id: String,
    filename: String,
    revision: Option<String>,
) -> Result<PullOllamaResult, String> {
    let repo_id = repo_id.trim();
    let filename = filename.trim();
    let revision = revision.as_deref().map(str::trim).filter(|value| !value.is_empty());

    if repo_id.is_empty() {
        return Err("Hugging-Face-Repository darf nicht leer sein.".to_string());
    }
    if filename.is_empty() {
        return Err("Hugging-Face-Dateiname darf nicht leer sein.".to_string());
    }

    let mut args = vec!["pull", repo_id, filename];
    if let Some(value) = revision {
        args.push(value);
    }

    let raw = run_node_script(HUGGINGFACE_CLI_REL, &args)?;
    parse_model_download_output(&raw, "Hugging-Face-Download")
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
fn spotify_auth_url() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["spotify-auth-url"])?;
    parse_client_cli_json(&raw, "Spotify-Auth-URL")
}

#[tauri::command]
fn spotify_exchange_code(code: String) -> Result<serde_json::Value, String> {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return Err("Spotify-Code darf nicht leer sein.".to_string());
    }
    let raw = run_client_cli(&["spotify-exchange-code", trimmed])?;
    parse_client_cli_json(&raw, "Spotify-Code-Tausch")
}

#[tauri::command]
fn spotify_devices() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["spotify-devices"])?;
    parse_client_cli_json(&raw, "Spotify-Geräte")
}

#[tauri::command]
fn spotify_set_device(device_id: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match device_id.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["spotify-set-device", value])?,
        None => run_client_cli(&["spotify-set-device"])?,
    };
    parse_client_cli_json(&raw, "Spotify-Gerät")
}

#[tauri::command]
fn spotify_test(action: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match action.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["spotify-test", value])?,
        None => run_client_cli(&["spotify-test"])?,
    };
    parse_client_cli_json(&raw, "Spotify-Test")
}

#[tauri::command]
fn spotify_disconnect() -> Result<serde_json::Value, String> {
    let raw = run_client_cli(&["spotify-disconnect"])?;
    parse_client_cli_json(&raw, "Spotify-Trennen")
}

#[tauri::command]
fn test_audio(source: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match source.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["test-audio", value])?,
        None => run_client_cli(&["test-audio"])?,
    };
    parse_client_cli_json(&raw, "Audio-Test")
}

#[tauri::command]
fn test_image(prompt: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match prompt.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => run_client_cli(&["test-image", value])?,
        None => run_client_cli(&["test-image"])?,
    };
    parse_client_cli_json(&raw, "Image-Test")
}

#[tauri::command]
fn test_print(printer_id: Option<String>) -> Result<serde_json::Value, String> {
    let raw = match printer_id.as_deref().map(str::trim) {
        Some(id) if !id.is_empty() => run_client_cli(&["test-print", id])?,
        _ => run_client_cli(&["test-print"])?,
    };
    parse_client_cli_json(&raw, "Print-Test")
}

#[tauri::command]
fn read_config() -> Result<ConnectorClientConfig, String> {
    read_config_from_disk()
}

#[tauri::command]
fn write_config(config: ConnectorClientConfig, app_state: State<'_, AppState>) -> Result<ConnectorClientConfig, String> {
    let normalized = normalize_config(config)?;
    sync_windows_autostart(normalized.autostart_windows)?;
    write_config_to_disk(&normalized)?;

    let mut runtime = app_state
        .runtime
        .lock()
        .map_err(|_| "Connector-Zustand konnte nicht aktualisiert werden.".to_string())?;

    if !runtime.running {
        runtime.last_heartbeat_at = None;
        runtime.message = Some("Konfiguration gespeichert. Connector-Prozess ist gestoppt.".to_string());
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

    // Validate before spawning — an invalid current_dir surfaces from
    // Command::spawn() as the cryptic "os error 267" on Windows instead of an
    // actionable message.
    if !root.is_dir() {
        runtime.running = false;
        runtime.last_heartbeat_at = None;
        runtime.message = Some(format!(
            "Arbeitsverzeichnis für den Connector nicht gefunden: {}. Setze UWE_MONOREPO_ROOT auf den UWE-Projektordner.",
            root.display()
        ));
        return Ok(status_snapshot(&runtime, &config));
    }
    let launcher_path = root.join(CONNECTOR_LAUNCHER_REL);
    if !launcher_path.exists() {
        runtime.running = false;
        runtime.last_heartbeat_at = None;
        runtime.message = Some(format!(
            "Connector-Skript nicht gefunden: {}. Ist das UWE-Monorepo ausgecheckt und `pnpm install` gelaufen? Ggf. UWE_MONOREPO_ROOT setzen.",
            launcher_path.display()
        ));
        return Ok(status_snapshot(&runtime, &config));
    }

    let data_dir = connector_app_data_dir()?;
    let mut command = std::process::Command::new("node");
    configure_hidden_process(&mut command);
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

    // P4: forward the local audio/image commands and Spotify OAuth credentials
    // so the connector can execute audio/image jobs and refresh Spotify tokens.
    // Spotify auth lives only on this client; the host never sees these.
    if !config.audio_command.is_empty() {
        command.env("UWE_CONNECTOR_AUDIO_CMD", &config.audio_command);
    }
    if !config.image_command.is_empty() {
        command.env("UWE_CONNECTOR_IMAGE_CMD", &config.image_command);
    }
    if !config.print_command.is_empty() {
        command.env("UWE_CONNECTOR_PRINT_CMD", &config.print_command);
    }
    if !config.spotify_client_id.is_empty() {
        command.env("SPOTIFY_CLIENT_ID", &config.spotify_client_id);
    }
    if !config.spotify_client_secret.is_empty() {
        command.env("SPOTIFY_CLIENT_SECRET", &config.spotify_client_secret);
    }
    if !config.spotify_redirect_uri.is_empty() {
        command.env("SPOTIFY_REDIRECT_URI", &config.spotify_redirect_uri);
    }

    // Spotify token + preferred device come from the persisted session (P4
    // manual auth flow). The connector reads the same file too, but forwarding
    // here keeps the spawn env explicit and overridable.
    if let Some(session) = read_spotify_session() {
        if !session.access_token.is_empty() {
            command.env("UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN", &session.access_token);
        }
        if let Some(device_id) = session.device_id.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
            command.env("SPOTIFY_DEVICE_ID", device_id);
        }
    }

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
        .setup(|app| {
            setup_tray(app)?;
            if let Ok(config) = read_config_from_disk() {
                if config.tray_mode == "start_in_tray" || config.minimized_start {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if should_hide_to_tray() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            WindowEvent::Resized(_) => {
                let hide_when_minimized = read_config_from_disk()
                    .map(|config| config.tray_mode == "minimize_to_tray")
                    .unwrap_or(false);
                if hide_when_minimized && window.is_minimized().unwrap_or(false) {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
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
            get_printer_store,
            save_printer_store,
            scan_printers,
            pull_ollama_model,
            delete_ollama_model,
            pull_huggingface_model,
            list_connector_jobs,
            list_connector_logs,
            cookbook_dashboard,
            probe_runners,
            start_ollama,
            test_runner,
            spotify_auth_url,
            spotify_exchange_code,
            spotify_devices,
            spotify_set_device,
            spotify_test,
            spotify_disconnect,
            test_audio,
            test_image,
            test_print
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
