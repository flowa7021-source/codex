; ─── NovaReader: Windows Shell Context Menu — NSIS installer hooks ────────────
;
; Included automatically by the Tauri NSIS bundler when referenced via
; bundle.nsis.installerHooks in tauri.windows.conf.json.
;
; Таури вызывает макросы customInstall / customUnInstall в нужный момент.
; Здесь мы регистрируем и удаляем пункты контекстного меню Explorer для .pdf.
;
; Структура реестра:
;   HKCR\SystemFileAssociations\.pdf\shell\NovaReader
;       (Default)    = "NovaReader"
;       MUIVerb      = "NovaReader"
;       Icon         = "$INSTDIR\NovaReader.exe,0"
;       SubCommands  = ""                 ← активирует подменю
;       shell\
;           01_ToWord\
;               (Default) = "Конвертировать в Word (.docx)"
;               Icon      = "$INSTDIR\NovaReader.exe,1"
;               command\(Default) = '"$INSTDIR\NovaReader.exe" --convert-word "%1"'
;           02_ToExcel\  ...
;           03_ToDjVu\   ...
;           04_Sep\      (разделитель: CommandFlags = 0x40)
;           05_OCR\      ...
;           06_Settings\ ...

; ── Вспомогательный макрос ────────────────────────────────────────────────────
!macro _WriteMenuKey KEY_PATH DEFAULT_VAL ICON_IDX CMD_ARG
    WriteRegStr   HKCR "${KEY_PATH}" "" "${DEFAULT_VAL}"
    WriteRegStr   HKCR "${KEY_PATH}" "Icon" "$INSTDIR\NovaReader.exe,${ICON_IDX}"
    WriteRegStr   HKCR "${KEY_PATH}\command" "" \
        '"$INSTDIR\NovaReader.exe" ${CMD_ARG} "%1"'
!macroend

; ── Регистрация при установке ─────────────────────────────────────────────────
!macro customInstall
    DetailPrint "Регистрация контекстного меню Explorer для .pdf..."

    ; ── Корневой пункт подменю ────────────────────────────────────────────────
    WriteRegStr   HKCR "SystemFileAssociations\.pdf\shell\NovaReader" \
                       "" "NovaReader"
    WriteRegStr   HKCR "SystemFileAssociations\.pdf\shell\NovaReader" \
                       "MUIVerb" "NovaReader"
    WriteRegStr   HKCR "SystemFileAssociations\.pdf\shell\NovaReader" \
                       "Icon" "$INSTDIR\NovaReader.exe,0"
    ; Пустая строка SubCommands = разворачивает shell\ в подменю
    WriteRegStr   HKCR "SystemFileAssociations\.pdf\shell\NovaReader" \
                       "SubCommands" ""

    ; ── 01: Конвертировать в Word ─────────────────────────────────────────────
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\01_ToWord" \
                     "" "Конвертировать в Word (.docx)"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\01_ToWord" \
                     "Icon" "$INSTDIR\NovaReader.exe,1"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\01_ToWord\command" \
                     "" '"$INSTDIR\NovaReader.exe" --convert-word "%1"'

    ; ── 02: Конвертировать в Excel ────────────────────────────────────────────
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\02_ToExcel" \
                     "" "Конвертировать в Excel (.xlsx)"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\02_ToExcel" \
                     "Icon" "$INSTDIR\NovaReader.exe,2"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\02_ToExcel\command" \
                     "" '"$INSTDIR\NovaReader.exe" --convert-excel "%1"'

    ; ── 03: Конвертировать в DjVu ────────────────────────────────────────────
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\03_ToDjVu" \
                     "" "Конвертировать в DjVu"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\03_ToDjVu" \
                     "Icon" "$INSTDIR\NovaReader.exe,3"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\03_ToDjVu\command" \
                     "" '"$INSTDIR\NovaReader.exe" --convert-djvu "%1"'

    ; ── 04: Разделитель (MF_SEPARATOR = 0x40) ────────────────────────────────
    WriteRegStr  HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\04_Sep" "" ""
    WriteRegDWORD HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\04_Sep" \
                       "CommandFlags" 0x00000040

    ; ── 05: OCR ───────────────────────────────────────────────────────────────
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\05_OCR" \
                     "" "Создать PDF с текстовым слоем (OCR)"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\05_OCR" \
                     "Icon" "$INSTDIR\NovaReader.exe,4"
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\05_OCR\command" \
                     "" '"$INSTDIR\NovaReader.exe" --ocr "%1"'

    ; ── 06: Настройки ─────────────────────────────────────────────────────────
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\06_Settings" \
                     "" "Настройки..."
    WriteRegStr HKCR "SystemFileAssociations\.pdf\shell\NovaReader\shell\06_Settings\command" \
                     "" '"$INSTDIR\NovaReader.exe" --settings'

    DetailPrint "Контекстное меню зарегистрировано."
!macroend

; ── Удаление при деинсталляции ────────────────────────────────────────────────
!macro customUnInstall
    DetailPrint "Удаление контекстного меню Explorer..."
    DeleteRegKey HKCR "SystemFileAssociations\.pdf\shell\NovaReader"
    DetailPrint "Контекстное меню удалено."
!macroend
