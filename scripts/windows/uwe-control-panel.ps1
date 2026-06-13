#Requires -Version 5.1
<#
.SYNOPSIS
  UWE Control Panel — start, stop, backup, update, repair, uninstall.
#>
param(
  [ValidateSet("panel", "start", "stop", "restart", "status", "backup", "restore", "update", "doctor", "repair", "diagnostics", "uninstall", "logs", "open")]
  [string] $Action = "panel",
  [string] $InstallRoot = $(Split-Path -Parent $PSScriptRoot),
  [string] $BackupPath = "",
  [switch] $KeepData
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-InstallerCli {
  $paths = @(
    (Join-Path $InstallRoot "app\tools\windows-installer\dist\cli.js"),
    (Join-Path $InstallRoot "config\uwe-installer-cli.js")
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  throw "Installer CLI nicht gefunden. Bitte UWE neu installieren."
}

function Invoke-UweCli {
  param([string[]] $Args)
  $cli = Get-InstallerCli
  $allArgs = @($Args + @("--root", $InstallRoot))
  & node $cli @allArgs
  if ($LASTEXITCODE -ne 0) { throw "Befehl fehlgeschlagen." }
}

function Show-Status {
  param([System.Windows.Forms.TextBox] $StatusBox)
  try {
    $cli = Get-InstallerCli
    $output = & node $cli status --root $InstallRoot --json 2>&1 | Out-String
    $StatusBox.Text = $output
  } catch {
    $StatusBox.Text = $_.Exception.Message
  }
}

function Show-ControlPanel {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "UWE Steuerung"
  $form.Size = New-Object System.Drawing.Size(520, 480)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false

  $title = New-Object System.Windows.Forms.Label
  $title.Location = New-Object System.Drawing.Point(20, 15)
  $title.Size = New-Object System.Drawing.Size(460, 28)
  $title.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
  $title.Text = "UWE Steuerung"
  $form.Controls.Add($title)

  $pathLabel = New-Object System.Windows.Forms.Label
  $pathLabel.Location = New-Object System.Drawing.Point(20, 45)
  $pathLabel.Size = New-Object System.Drawing.Size(460, 20)
  $pathLabel.Text = "Installationsordner: $InstallRoot"
  $form.Controls.Add($pathLabel)

  $statusBox = New-Object System.Windows.Forms.TextBox
  $statusBox.Location = New-Object System.Drawing.Point(20, 75)
  $statusBox.Size = New-Object System.Drawing.Size(460, 80)
  $statusBox.Multiline = $true
  $statusBox.ReadOnly = $true
  $statusBox.ScrollBars = "Vertical"
  $form.Controls.Add($statusBox)

  Show-Status -StatusBox $statusBox

  $buttons = @(
    @{ Text = "UWE starten"; Action = { Invoke-UweCli @("start") } },
    @{ Text = "UWE stoppen"; Action = { Invoke-UweCli @("stop") } },
    @{ Text = "Neu starten"; Action = { Invoke-UweCli @("restart") } },
    @{ Text = "Im Browser öffnen"; Action = { Invoke-UweCli @("open") } },
    @{ Text = "Backup erstellen"; Action = { Invoke-UweCli @("backup"); [System.Windows.Forms.MessageBox]::Show("Backup erstellt.") | Out-Null } },
    @{ Text = "Update prüfen"; Action = {
        try { Invoke-UweCli @("update-check") } catch {}
        $r = [System.Windows.Forms.MessageBox]::Show("Update installieren?", "Update", "YesNo")
        if ($r -eq "Yes") { Invoke-UweCli @("update") }
      }
    },
    @{ Text = "Diagnose"; Action = { Invoke-UweCli @("doctor") } },
    @{ Text = "Reparieren"; Action = { Invoke-UweCli @("repair", "--fix-all") } },
    @{ Text = "Logs öffnen"; Action = { Invoke-Item (Join-Path $InstallRoot "logs") } },
    @{ Text = "Diagnosepaket"; Action = {
        $result = Invoke-UweCli @("diagnostics")
        [System.Windows.Forms.MessageBox]::Show("$result") | Out-Null
      }
    },
    @{ Text = "Deinstallieren"; Action = {
        $keep = [System.Windows.Forms.MessageBox]::Show(
          "Daten (Welten, Uploads) behalten?",
          "Deinstallation",
          [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
          [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($keep -eq "Cancel") { return }
        $args = @("uninstall")
        if ($keep -eq "Yes") { $args += "--keep-data" }
        Invoke-UweCli $args
        [System.Windows.Forms.MessageBox]::Show("UWE deinstalliert.") | Out-Null
        $form.Close()
      }
    }
  )

  $x = 20; $y = 170
  foreach ($btn in $buttons) {
    $button = New-Object System.Windows.Forms.Button
    $button.Location = New-Object System.Drawing.Point($x, $y)
    $button.Size = New-Object System.Drawing.Size(140, 32)
    $button.Text = $btn.Text
    $action = $btn.Action
    $button.Add_Click({
      try {
        & $action
        Show-Status -StatusBox $statusBox
      } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Fehler") | Out-Null
      }
    })
    $form.Controls.Add($button)
    $x += 150
    if ($x -gt 320) { $x = 20; $y += 40 }
  }

  $refreshBtn = New-Object System.Windows.Forms.Button
  $refreshBtn.Location = New-Object System.Drawing.Point(340, 430)
  $refreshBtn.Size = New-Object System.Drawing.Size(140, 28)
  $refreshBtn.Text = "Status aktualisieren"
  $refreshBtn.Add_Click({ Show-Status -StatusBox $statusBox })
  $form.Controls.Add($refreshBtn)

  [void]$form.ShowDialog()
}

switch ($Action) {
  "panel" { Show-ControlPanel }
  "start" { Invoke-UweCli @("start") }
  "stop" { Invoke-UweCli @("stop") }
  "restart" { Invoke-UweCli @("restart") }
  "status" { Invoke-UweCli @("status") }
  "backup" { Invoke-UweCli @("backup") }
  "restore" {
    if (-not $BackupPath) { throw "BackupPath erforderlich." }
    Invoke-UweCli @("restore", "--backup", $BackupPath)
  }
  "update" { Invoke-UweCli @("update") }
  "doctor" { Invoke-UweCli @("doctor") }
  "repair" { Invoke-UweCli @("repair", "--fix-all") }
  "diagnostics" { Invoke-UweCli @("diagnostics") }
  "uninstall" {
    $args = @("uninstall")
    if ($KeepData) { $args += "--keep-data" }
    Invoke-UweCli $args
  }
  "logs" { Invoke-Item (Join-Path $InstallRoot "logs") }
  "open" { Invoke-UweCli @("open") }
}
