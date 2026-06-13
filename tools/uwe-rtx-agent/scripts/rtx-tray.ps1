#Requires -Version 5.1
<#
.SYNOPSIS
  UWE RTX Agent — Windows tray UI for enable/disable, status, and autostart.
#>
param(
  [string] $AgentRoot = $(Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:UpdatingStatusForm = $false
$script:PollIntervalMs = 8000
$script:StatusForm = $null
$script:NotifyIcon = $null
$script:PollTimer = $null
$script:AgentProcess = $null
$script:LastStatus = $null

function Get-AgentPaths {
  $envFile = Join-Path $AgentRoot ".env"
  $entry = Join-Path $AgentRoot "dist\index.js"
  $trayLogDir = Join-Path $env:LOCALAPPDATA "UWE-RTX-Agent\logs"
  return @{
    Root = $AgentRoot
    EnvFile = $envFile
    Entry = $entry
    LogDir = $trayLogDir
  }
}

function Read-AgentEnv {
  param([string] $EnvFile)
  $values = @{
    AGENT_HOST = "127.0.0.1"
    AGENT_PORT = "8787"
    AGENT_TOKEN = ""
  }

  if (-not (Test-Path $EnvFile)) {
    throw "Konfiguration nicht gefunden: $EnvFile"
  }

  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $index = $line.IndexOf("=")
    if ($index -le 0) { return }
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim().Trim('"').Trim("'")
    if ($values.ContainsKey($key)) {
      $values[$key] = $value
    }
  }

  if (-not $values.AGENT_TOKEN) {
    throw "AGENT_TOKEN fehlt in $EnvFile"
  }

  return $values
}

function Get-AgentBaseUrl {
  param($Env)
  $hostName = if ($Env.AGENT_HOST -eq "0.0.0.0") { "127.0.0.1" } else { $Env.AGENT_HOST }
  return "http://${hostName}:$($Env.AGENT_PORT)"
}

function Get-AgentHeaders {
  param($Env)
  return @{
    Authorization = "Bearer $($Env.AGENT_TOKEN)"
    Accept = "application/json"
  }
}

function Invoke-AgentApi {
  param(
    [string] $Method = "GET",
    [string] $Path,
    [object] $Body = $null
  )

  $paths = Get-AgentPaths
  $envValues = Read-AgentEnv -EnvFile $paths.EnvFile
  $baseUrl = Get-AgentBaseUrl -Env $envValues
  $uri = "$baseUrl$Path"
  $headers = Get-AgentHeaders -Env $envValues

  $params = @{
    Method = $Method
    Uri = $uri
    Headers = $headers
    TimeoutSec = 8
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Compress)
    $params.ContentType = "application/json"
  }

  return Invoke-RestMethod @params
}

function Test-AgentReachable {
  try {
    Invoke-AgentApi -Path "/health" | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-AgentProcess {
  $paths = Get-AgentPaths
  if (-not (Test-Path $paths.Entry)) {
    throw "Agent nicht gebaut. Bitte 'pnpm --filter @uwe/rtx-agent build' ausführen."
  }

  if (Test-AgentReachable) {
    return
  }

  $env:UWE_RTX_AGENT_ROOT = $paths.Root
  $env:UWE_RTX_AGENT_ENV = $paths.EnvFile
  Read-AgentEnv -EnvFile $paths.EnvFile | Out-Null
  Get-Content $paths.EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $index = $line.IndexOf("=")
    if ($index -le 0) { return }
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$key" -Value $value
  }

  $script:AgentProcess = Start-Process `
    -FilePath "node" `
    -ArgumentList @($paths.Entry, "start") `
    -WorkingDirectory $paths.Root `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-AgentReachable) {
      return
    }
  }

  throw "Der RTX Agent konnte nicht gestartet werden. Logs prüfen."
}

function Get-StatusPresentation {
  param($Status)

  switch ($Status.status) {
    "ready" {
      return @{
        Emoji = [char]0x1F7E2
        Text = "RTX Agent aktiv – lokale KI bereit"
      }
    }
    "starting" {
      return @{
        Emoji = [char]0x1F7E0
        Text = "RTX Agent aktiv – KI startet"
      }
    }
    "error" {
      return @{
        Emoji = [char]0x1F534
        Text = "RTX Agent Fehler – Ollama nicht erreichbar"
      }
    }
    default {
      return @{
        Emoji = [char]0x26AA
        Text = "RTX Agent deaktiviert"
      }
    }
  }
}

function Format-StatusDetails {
  param($Status)
  $presentation = Get-StatusPresentation -Status $Status
  $lines = @(
    "$($presentation.Emoji) $($presentation.Text)",
    "",
    "Agent-URL: $($Status.agentUrl)",
    "Backend: $($Status.ollamaBaseUrl)",
    "Modell: $(if ($Status.model) { $Status.model } else { $Status.defaultModel })",
    "Letzter Healthcheck: $(if ($Status.lastHealthCheckAt) { $Status.lastHealthCheckAt } else { '—' })",
    "Autostart: $(if ($Status.autostart) { 'aktiv' } else { 'deaktiviert' })"
  )

  if ($Status.publicBindWarning) {
    $lines += ""
    $lines += "Warnung: $($Status.publicBindWarning)"
  }

  return ($lines -join [Environment]::NewLine)
}

function Update-TrayStatus {
  try {
    $status = Invoke-AgentApi -Path "/api/status"
    $script:LastStatus = $status
    $presentation = Get-StatusPresentation -Status $status
    $script:NotifyIcon.Text = "$($presentation.Emoji) $($presentation.Text)".Substring(0, [Math]::Min(63, "$($presentation.Emoji) $($presentation.Text)".Length))

    if ($script:StatusForm -and -not $script:StatusForm.IsDisposed) {
      Update-StatusForm -Status $status
    }
  } catch {
    $script:NotifyIcon.Text = "RTX Agent – Verbindung fehlgeschlagen"
  }
}

function Show-ErrorMessage {
  param([string] $Message)
  [System.Windows.Forms.MessageBox]::Show($Message, "UWE RTX Agent", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
}

function Invoke-AgentControl {
  param(
    [scriptblock] $Action,
    [string] $SuccessMessage = ""
  )

  try {
    & $Action
    Update-TrayStatus
    if ($SuccessMessage) {
      $script:NotifyIcon.ShowBalloonTip(3000, "UWE RTX Agent", $SuccessMessage, [System.Windows.Forms.ToolTipIcon]::Info)
    }
  } catch {
    Show-ErrorMessage $_.Exception.Message
  }
}

function Update-StatusForm {
  param($Status)

  if (-not $script:StatusForm) { return }

  $details = Format-StatusDetails -Status $Status
  $script:UpdatingStatusForm = $true
  $script:StatusForm.Controls["StatusBox"].Text = $details
  $script:StatusForm.Controls["AutostartCheck"].Checked = [bool]$Status.autostart
  $script:UpdatingStatusForm = $false
}

function Show-StatusWindow {
  if ($script:StatusForm -and -not $script:StatusForm.IsDisposed) {
    $script:StatusForm.Activate()
    return
  }

  $form = New-Object System.Windows.Forms.Form
  $form.Text = "UWE RTX Agent"
  $form.Size = New-Object System.Drawing.Size(560, 520)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.TopMost = $false

  $title = New-Object System.Windows.Forms.Label
  $title.Location = New-Object System.Drawing.Point(20, 15)
  $title.Size = New-Object System.Drawing.Size(500, 28)
  $title.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
  $title.Text = "UWE RTX Agent Status"
  $form.Controls.Add($title)

  $statusBox = New-Object System.Windows.Forms.TextBox
  $statusBox.Name = "StatusBox"
  $statusBox.Location = New-Object System.Drawing.Point(20, 55)
  $statusBox.Size = New-Object System.Drawing.Size(500, 170)
  $statusBox.Multiline = $true
  $statusBox.ReadOnly = $true
  $statusBox.ScrollBars = "Vertical"
  $form.Controls.Add($statusBox)

  $autostartCheck = New-Object System.Windows.Forms.CheckBox
  $autostartCheck.Name = "AutostartCheck"
  $autostartCheck.Location = New-Object System.Drawing.Point(20, 235)
  $autostartCheck.Size = New-Object System.Drawing.Size(500, 24)
  $autostartCheck.Text = "Beim Windows-Start ausführen"
  $autostartCheck.Add_CheckedChanged({
    if ($script:UpdatingStatusForm) { return }
    Invoke-AgentControl {
      Invoke-AgentApi -Method POST -Path "/api/control/autostart" -Body @{ enabled = $autostartCheck.Checked } | Out-Null
    }
  })
  $form.Controls.Add($autostartCheck)

  $buttons = @(
    @{ Name = "EnableBtn"; Text = "Aktivieren"; X = 20; Y = 275; Action = { Invoke-AgentApi -Method POST -Path "/api/control/enable" | Out-Null } },
    @{ Name = "DisableBtn"; Text = "Deaktivieren"; X = 150; Y = 275; Action = { Invoke-AgentApi -Method POST -Path "/api/control/disable" | Out-Null } },
    @{ Name = "RestartBtn"; Text = "KI-Backend neu starten"; X = 280; Y = 275; Action = { Invoke-AgentApi -Method POST -Path "/api/control/restart-backend" | Out-Null } },
    @{ Name = "RefreshBtn"; Text = "Status aktualisieren"; X = 20; Y = 320; Action = { Update-TrayStatus } },
    @{ Name = "LogsBtn"; Text = "Logs öffnen"; X = 150; Y = 320; Action = {
        $logDir = (Get-AgentPaths).LogDir
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
        Invoke-Item $logDir
      }
    },
    @{ Name = "ConfigBtn"; Text = "Konfiguration öffnen"; X = 280; Y = 320; Action = {
        $envFile = (Get-AgentPaths).EnvFile
        if (-not (Test-Path $envFile)) { throw "Konfiguration nicht gefunden: $envFile" }
        Start-Process notepad.exe $envFile
      }
    },
    @{ Name = "CloseBtn"; Text = "Schließen"; X = 410; Y = 430; Action = { $form.Close() } }
  )

  foreach ($btn in $buttons) {
    $button = New-Object System.Windows.Forms.Button
    $button.Name = $btn.Name
    $button.Location = New-Object System.Drawing.Point($btn.X, $btn.Y)
    $button.Size = New-Object System.Drawing.Size(130, 32)
    $button.Text = $btn.Text
    $localAction = $btn.Action
    $button.Add_Click({
      Invoke-AgentControl -Action $localAction
    })
    $form.Controls.Add($button)
  }

  $hint = New-Object System.Windows.Forms.Label
  $hint.Location = New-Object System.Drawing.Point(20, 370)
  $hint.Size = New-Object System.Drawing.Size(500, 48)
  $hint.Text = "Der Agent läuft im Hintergrund. Rechtsklick auf das Tray-Symbol für Schnellaktionen. Token und Prompts werden nicht geloggt."
  $form.Controls.Add($hint)

  $form.Add_FormClosed({
    $script:StatusForm = $null
  })

  $script:StatusForm = $form
  if ($script:LastStatus) {
    Update-StatusForm -Status $script:LastStatus
  } else {
    Update-TrayStatus
  }

  $form.Show()
}

function Initialize-TrayIcon {
  $notify = New-Object System.Windows.Forms.NotifyIcon
  $notify.Icon = [System.Drawing.SystemIcons]::Shield
  $notify.Text = "UWE RTX Agent"
  $notify.Visible = $true

  $menu = New-Object System.Windows.Forms.ContextMenuStrip

  $openItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $openItem.Text = "Status anzeigen"
  $openItem.Add_Click({ Show-StatusWindow })
  $menu.Items.Add($openItem) | Out-Null

  $enableItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $enableItem.Text = "Aktivieren"
  $enableItem.Add_Click({ Invoke-AgentControl { Invoke-AgentApi -Method POST -Path "/api/control/enable" | Out-Null } -SuccessMessage "Agent aktiviert." })
  $menu.Items.Add($enableItem) | Out-Null

  $disableItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $disableItem.Text = "Deaktivieren"
  $disableItem.Add_Click({ Invoke-AgentControl { Invoke-AgentApi -Method POST -Path "/api/control/disable" | Out-Null } -SuccessMessage "Agent deaktiviert." })
  $menu.Items.Add($disableItem) | Out-Null

  $restartItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $restartItem.Text = "KI-Backend neu starten"
  $restartItem.Add_Click({ Invoke-AgentControl { Invoke-AgentApi -Method POST -Path "/api/control/restart-backend" | Out-Null } -SuccessMessage "Backend-Neustart ausgelöst." })
  $menu.Items.Add($restartItem) | Out-Null

  $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

  $logsItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $logsItem.Text = "Logs öffnen"
  $logsItem.Add_Click({
    $logDir = (Get-AgentPaths).LogDir
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
    Invoke-Item $logDir
  })
  $menu.Items.Add($logsItem) | Out-Null

  $configItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $configItem.Text = "Konfiguration öffnen"
  $configItem.Add_Click({
    try {
      $envFile = (Get-AgentPaths).EnvFile
      Start-Process notepad.exe $envFile
    } catch {
      Show-ErrorMessage $_.Exception.Message
    }
  })
  $menu.Items.Add($configItem) | Out-Null

  $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

  $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
  $exitItem.Text = "Tray beenden"
  $exitItem.Add_Click({
    if ($script:PollTimer) { $script:PollTimer.Stop(); $script:PollTimer.Dispose() }
    $notify.Visible = $false
    $notify.Dispose()
    if ($script:StatusForm -and -not $script:StatusForm.IsDisposed) {
      $script:StatusForm.Close()
    }
    [System.Windows.Forms.Application]::Exit()
  })
  $menu.Items.Add($exitItem) | Out-Null

  $notify.ContextMenuStrip = $menu
  $notify.Add_DoubleClick({ Show-StatusWindow })

  $script:NotifyIcon = $notify
}

function Start-TrayPolling {
  $timer = New-Object System.Windows.Forms.Timer
  $timer.Interval = $script:PollIntervalMs
  $timer.Add_Tick({ Update-TrayStatus })
  $timer.Start()
  $script:PollTimer = $timer
  Update-TrayStatus
}

try {
  Start-AgentProcess
  Initialize-TrayIcon
  Start-TrayPolling
  [System.Windows.Forms.Application]::Run()
} catch {
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "UWE RTX Agent", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  exit 1
}
