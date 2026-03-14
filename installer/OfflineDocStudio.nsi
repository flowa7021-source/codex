!define APP_NAME "OfflineDocStudio"
!define APP_VERSION "1.0.0"
!define APP_EXE "offline_doc_studio.exe"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "dist\OfflineDocStudio-NSIS-Setup-${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\OfflineDocStudio"
RequestExecutionLevel user

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File "build\Release\${APP_EXE}"
  CreateDirectory "$INSTDIR\config"
  CreateDirectory "$INSTDIR\samples"
  File /oname=$INSTDIR\config\hotkeys.json "config\hotkeys.json"
  File /oname=$INSTDIR\samples\session.ods "samples\session.ods"
  File /oname=$INSTDIR\README.md "README.md"
  File /oname=$INSTDIR\UserGuide_ru.md "UserGuide_ru.md"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\OfflineDocStudio"
  CreateShortCut "$SMPROGRAMS\OfflineDocStudio\OfflineDocStudio.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$SMPROGRAMS\OfflineDocStudio\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\OfflineDocStudio\OfflineDocStudio.lnk"
  Delete "$SMPROGRAMS\OfflineDocStudio\Uninstall.lnk"
  RMDir "$SMPROGRAMS\OfflineDocStudio"

  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\config\hotkeys.json"
  Delete "$INSTDIR\samples\session.ods"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\UserGuide_ru.md"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR\config"
  RMDir "$INSTDIR\samples"
  RMDir "$INSTDIR"
SectionEnd
