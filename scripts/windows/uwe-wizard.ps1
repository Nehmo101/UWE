#Requires -Version 5.1
<#
.SYNOPSIS
  UWE One-Click Install Wizard for Windows (WinForms GUI).
.DESCRIPTION
  Guides non-technical users through system checks, prerequisite repair,
  installation, and first start with desktop shortcuts.
#>
param(
  [string] $InstallRoot = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "UWE" } else { Join-Path $env:USERPROFILE ".uwe" }),
  [ValidateSet("dev", "release")]
  [string] $Mode = "release",
  [string] $BundlePath = "",
  [string] $RepoPath = "",
  [switch] $SkipGui
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$InstallerCli = Join-Path $RepoRoot "tools\windows-installer\dist\cli.js"
$LogFile = Join-Path $InstallRoot "logs\install.log"

function Ensure-InstallerBuilt {
  if (-not (Test-Path $InstallerCli)) {
    Push-Location (Join-Path $RepoRoot "tools\windows-installer")
    pnpm run build | Out-Null
    Pop-Location
  }
}

function Write-WizardLog {
  param([string] $Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[$timestamp] $Message"
  if (-not (Test-Path (Split-Path $LogFile -Parent))) {
    New-Item -ItemType Directory -Path (Split-Path $LogFile -Parent) -Force | Out-Null
  }
  Add-Content -Path $LogFile -Value $line
}

function Invoke-UweCli {
  param(
    [string[]] $Args,
    [switch] $AllowFailure
  )
  Ensure-InstallerBuilt
  $allArgs = @($Args + @("--root", $InstallRoot))
  Write-WizardLog ("CLI: node $InstallerCli " + ($allArgs -join " "))
  $output = & node $InstallerCli @allArgs 2>&1
  $text = ($output | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
    throw $text
  }
  return $text
}

function Test-NodeInstalled {
  try {
    $version = (& node --version 2>$null).Trim()
    if ($version -match "v(\d+)") {
      return [int]$Matches[1] -ge 20
    }
  } catch {}
  return $false
}

function Repair-Prerequisites {
  param([System.Windows.Forms.TextBox] $LogBox)

  $LogBox.AppendText("Prüfe Voraussetzungen...`r`n")

  if (-not (Test-NodeInstalled)) {
    $LogBox.AppendText("Node.js fehlt oder ist zu alt.`r`n")
    $result = [System.Windows.Forms.MessageBox]::Show(
      "Node.js 20+ wird benötigt.`n`nMöchten Sie die Download-Seite öffnen?",
      "Node.js erforderlich",
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
      Start-Process "https://nodejs.org/"
    }
    return $false
  }

  $LogBox.AppendText("Node.js OK`r`n")

  try {
    $pnpmCheck = Invoke-UweCli @("check", "--mode", $Mode) -AllowFailure
    if ($LASTEXITCODE -ne 0) {
      if ($pnpmCheck -match "pnpm") {
        $LogBox.AppendText("pnpm fehlt — installiere automatisch...`r`n")
        Invoke-UweCli @("install-pnpm") | Out-Null
      }
      if ($pnpmCheck -match "PATH") {
        $LogBox.AppendText("pnpm PATH wird repariert...`r`n")
        Invoke-UweCli @("repair-pnpm-path") | Out-Null
        [System.Windows.Forms.MessageBox]::Show(
          "pnpm wurde zum Benutzer-PATH hinzugefügt.`n`nFalls die Installation danach noch fehlschlägt, bitte den Wizard einmal schließen und neu starten.",
          "PATH aktualisiert",
          [System.Windows.Forms.MessageBoxButtons]::OK,
          [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
      }
    }
  } catch {
    $LogBox.AppendText("Voraussetzungs-Check: $($_.Exception.Message)`r`n")
  }

  $finalCheck = Invoke-UweCli @("check", "--mode", $Mode) -AllowFailure
  if ($LASTEXITCODE -ne 0) {
    $LogBox.AppendText("$finalCheck`r`n")
    return $false
  }

  $LogBox.AppendText("Alle Voraussetzungen erfüllt.`r`n")
  return $true
}

function Show-InstallWizard {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "UWE Installation"
  $form.Size = New-Object System.Drawing.Size(640, 520)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false

  $title = New-Object System.Windows.Forms.Label
  $title.Location = New-Object System.Drawing.Point(20, 15)
  $title.Size = New-Object System.Drawing.Size(580, 30)
  $title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
  $title.Text = "UWE — Universeller Welten-Editor"
  $form.Controls.Add($title)

  $subtitle = New-Object System.Windows.Forms.Label
  $subtitle.Location = New-Object System.Drawing.Point(20, 48)
  $subtitle.Size = New-Object System.Drawing.Size(580, 40)
  $subtitle.Text = "Dieser Assistent installiert UWE lokal auf Ihrem PC.`nEs sind keine Terminal-Kenntnisse erforderlich."
  $form.Controls.Add($subtitle)

  $pathLabel = New-Object System.Windows.Forms.Label
  $pathLabel.Location = New-Object System.Drawing.Point(20, 95)
  $pathLabel.Size = New-Object System.Drawing.Size(120, 20)
  $pathLabel.Text = "Installationsordner:"
  $form.Controls.Add($pathLabel)

  $pathBox = New-Object System.Windows.Forms.TextBox
  $pathBox.Location = New-Object System.Drawing.Point(20, 118)
  $pathBox.Size = New-Object System.Drawing.Size(480, 24)
  $pathBox.Text = $InstallRoot
  $form.Controls.Add($pathBox)

  $browseBtn = New-Object System.Windows.Forms.Button
  $browseBtn.Location = New-Object System.Drawing.Point(510, 116)
  $browseBtn.Size = New-Object System.Drawing.Size(90, 28)
  $browseBtn.Text = "Durchsuchen"
  $browseBtn.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.SelectedPath = $pathBox.Text
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $pathBox.Text = $dialog.SelectedPath
      $script:InstallRoot = $pathBox.Text
    }
  })
  $form.Controls.Add($browseBtn)

  $demoCheck = New-Object System.Windows.Forms.CheckBox
  $demoCheck.Location = New-Object System.Drawing.Point(20, 155)
  $demoCheck.Size = New-Object System.Drawing.Size(400, 24)
  $demoCheck.Text = "Demo-Welt (Terra) mit Beispieldaten installieren"
  $demoCheck.Checked = ($Mode -eq "dev")
  $form.Controls.Add($demoCheck)

  $securityLabel = New-Object System.Windows.Forms.Label
  $securityLabel.Location = New-Object System.Drawing.Point(20, 185)
  $securityLabel.Size = New-Object System.Drawing.Size(580, 50)
  $securityLabel.ForeColor = [System.Drawing.Color]::DarkSlateGray
  $securityLabel.Text = "Sicherheit: UWE läuft standardmäßig nur auf localhost (127.0.0.1).`nÖffentlicher Netzwerkzugriff ist ohne Reverse-Proxy/VPN nicht empfohlen."
  $form.Controls.Add($securityLabel)

  $logBox = New-Object System.Windows.Forms.TextBox
  $logBox.Location = New-Object System.Drawing.Point(20, 240)
  $logBox.Size = New-Object System.Drawing.Size(580, 180)
  $logBox.Multiline = $true
  $logBox.ScrollBars = "Vertical"
  $logBox.ReadOnly = $true
  $logBox.Font = New-Object System.Drawing.Font("Consolas", 9)
  $form.Controls.Add($logBox)

  $backBtn = New-Object System.Windows.Forms.Button
  $backBtn.Location = New-Object System.Drawing.Point(20, 435)
  $backBtn.Size = New-Object System.Drawing.Size(100, 32)
  $backBtn.Text = "Abbrechen"
  $backBtn.Add_Click({ $form.Close() })
  $form.Controls.Add($backBtn)

  $installBtn = New-Object System.Windows.Forms.Button
  $installBtn.Location = New-Object System.Drawing.Point(420, 435)
  $installBtn.Size = New-Object System.Drawing.Size(180, 32)
  $installBtn.Text = "Installieren && Starten"
  $installBtn.Add_Click({
    $script:InstallRoot = $pathBox.Text
    $installBtn.Enabled = $false
    $logBox.Clear()

    try {
      if (-not (Repair-Prerequisites -LogBox $logBox)) {
        $installBtn.Enabled = $true
        return
      }

      $logBox.AppendText("Installiere UWE nach $script:InstallRoot ...`r`n")
      $installArgs = @("install", "--mode", $Mode)
      if ($BundlePath) { $installArgs += @("--bundle", $BundlePath) }
      if ($RepoPath) { $installArgs += @("--repo", $RepoPath) }
      if ($demoCheck.Checked) { $installArgs += "--seed-demo" }

      $installResult = Invoke-UweCli $installArgs
      $logBox.AppendText("$installResult`r`n")

      $logBox.AppendText("Starte UWE...`r`n")
      $startResult = Invoke-UweCli @("start")
      $logBox.AppendText("$startResult`r`n")

      [System.Windows.Forms.MessageBox]::Show(
        "UWE wurde installiert und gestartet!`n`nDer Browser öffnet sich automatisch.`nVerknüpfungen wurden auf dem Desktop und im Startmenü erstellt.",
        "Installation abgeschlossen",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
      ) | Out-Null

      $form.Close()
    } catch {
      $logBox.AppendText("FEHLER: $($_.Exception.Message)`r`n")
      $logBox.AppendText("Logs: $LogFile`r`n")
      [System.Windows.Forms.MessageBox]::Show(
        "Installation fehlgeschlagen.`n`n$($_.Exception.Message)`n`nLogs: $LogFile",
        "Fehler",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
      ) | Out-Null
      $installBtn.Enabled = $true
    }
  })
  $form.Controls.Add($installBtn)

  [void]$form.ShowDialog()
}

if ($SkipGui) {
  Ensure-InstallerBuilt
  Invoke-UweCli @("install", "--mode", $Mode) | Write-Host
  Invoke-UweCli @("start") | Write-Host
  exit 0
}

Show-InstallWizard
