; UWE Windows Installer — Inno Setup script
; Build: iscc tools/windows-installer/inno/UWE-Setup.iss

#define MyAppName "UWE"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "UWE"
#define MyAppURL "https://github.com/nehmo101/uwe"
#define MyAppExeName "UWE-Installieren.cmd"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\UWE
DisableProgramGroupPage=yes
OutputDir=..\dist\exe
OutputBaseFilename=UWE-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]

[Files]
Source: "..\..\..\scripts\windows\uwe-wizard.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\..\scripts\windows\uwe-control-panel.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\..\scripts\windows\installed-launcher.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\..\scripts\windows\UWE-Installieren.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\tools\windows-installer\dist\cli.js"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "..\..\..\tools\windows-installer\dist\*.js"; DestDir: "{app}\installer"; Flags: ignoreversion recursesubdirs
Source: "..\dist\release\*"; DestDir: "{app}\release"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName} installieren"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName} installieren"; Filename: "{app}\{#MyAppExeName}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uwe-wizard.ps1"" -BundlePath ""{app}\release"" -Mode release"; Description: "UWE Installations-Assistent starten"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\UWE\app"
Type: filesandordirs; Name: "{localappdata}\UWE\config"
Type: filesandordirs; Name: "{localappdata}\UWE\logs"

[InstallDelete]
Type: files; Name: "{autodesktop}\UWE Launcher.cmd"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
