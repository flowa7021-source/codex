; Inno Setup script for OfflineDocStudio
#define MyAppName "OfflineDocStudio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "OfflineDocStudio Project"
#define MyAppExeName "offline_doc_studio.exe"

[Setup]
AppId={{A5BFC7C8-8A44-4DA5-A611-4C1FD0F7B6C1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=OfflineDocStudio-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "registerassoc"; Description: "Register file associations (.pdf/.djvu/.djv/.cbz/.epub) for current user"; Flags: unchecked

[Files]
Source: "..\build\Release\offline_doc_studio.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\config\hotkeys.json"; DestDir: "{app}\config"; Flags: ignoreversion
Source: "..\samples\session.ods"; DestDir: "{app}\samples"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\UserGuide_ru.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\register_file_associations.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\register_file_associations.ps1"" -AppPath ""{app}\{#MyAppExeName}"""; Tasks: registerassoc; Flags: postinstall runhidden
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
