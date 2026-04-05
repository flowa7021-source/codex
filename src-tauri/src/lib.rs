use tauri::{Emitter, Manager};

// ── Существующие команды ──────────────────────────────────────────────────────

// Команда: прочитать файл как байты (для PDF/DJVU/ePub)
#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

// Команда: записать файл (для сохранения PDF)
#[tauri::command]
async fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write file: {}", e))
}

// Команда: получить информацию о файле
#[tauri::command]
async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    Ok(FileInfo {
        size: metadata.len(),
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
    })
}

#[derive(serde::Serialize)]
struct FileInfo {
    size: u64,
    is_file: bool,
    is_dir: bool,
}

// Команда: получить путь к AppData для хранения настроек
#[tauri::command]
async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

// ── Контекстное меню Windows: команды ────────────────────────────────────────

/// Открыть папку в Windows Explorer и выделить файл.
/// Используется после успешной конвертации для удобства пользователя.
#[tauri::command]
async fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // На macOS/Linux — открыть директорию
        let dir = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path);
        #[cfg(target_os = "macos")]
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
        #[cfg(target_os = "linux")]
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    Ok(())
}

/// Найти свободное имя файла: если `path` занят, добавляет суффикс ` (2)`, ` (3)` и т.д.
#[tauri::command]
async fn find_free_output_path(path: String) -> String {
    if !std::path::Path::new(&path).exists() {
        return path;
    }
    let p = std::path::Path::new(&path);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let ext = p.extension().and_then(|s| s.to_str()).map(|e| format!(".{}", e)).unwrap_or_default();
    let dir = p.parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_default();
    for i in 2..=999u32 {
        let candidate = format!("{}\\{} ({}){}", dir, stem, i, ext);
        if !std::path::Path::new(&candidate).exists() {
            return candidate;
        }
    }
    // Крайний случай: добавляем временную метку
    format!("{}\\{}_{}{}", dir, stem, std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0), ext)
}

// ── CLI-аргументы для запуска из контекстного меню ───────────────────────────

#[derive(serde::Serialize, Clone)]
struct CliAction {
    action: String,
    file_path: Option<String>,
}

/// Разобрать аргументы командной строки, переданные Windows при запуске
/// из контекстного меню.
///
/// Поддерживаемые форматы (задаются в реестре через install-context-menu.ps1):
///   NovaReader.exe --convert-word  "C:\path\file.pdf"
///   NovaReader.exe --convert-excel "C:\path\file.pdf"
///   NovaReader.exe --convert-djvu  "C:\path\file.pdf"
///   NovaReader.exe --ocr           "C:\path\file.pdf"
///   NovaReader.exe --settings
fn parse_cli_action() -> Option<CliAction> {
    let args: Vec<String> = std::env::args().collect();

    // args[0] = путь к .exe, ищем флаги начиная с args[1]
    for i in 1..args.len() {
        let flag = args[i].as_str();
        match flag {
            "--convert-word" | "--convert-excel" | "--convert-djvu" | "--ocr" => {
                let action = flag.trim_start_matches("--").to_string();
                let file_path = args.get(i + 1).cloned();
                return Some(CliAction { action, file_path });
            }
            "--settings" => {
                return Some(CliAction {
                    action: "settings".to_string(),
                    file_path: None,
                });
            }
            _ => {}
        }
    }
    None
}

// ── Точка входа ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Разбираем CLI-аргументы до запуска Tauri (args доступны в любой момент)
    let cli_action = parse_cli_action();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            write_file_bytes,
            get_file_info,
            get_app_data_dir,
            reveal_in_explorer,
            find_free_output_path,
        ])
        .setup(move |app| {
            let window = app.get_webview_window("main").unwrap();

            let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));

            // Если запущены из контекстного меню — отправляем действие во фронтенд.
            // Фронтенд слушает событие "cli-action" через context-menu-handler.js.
            // Используем однократную задержку, чтобы webview успел инициализироваться.
            if let Some(action) = cli_action {
                let window_clone = window.clone();
                std::thread::spawn(move || {
                    // Небольшая задержка, пока webview загружает приложение
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let _ = window_clone.emit("cli-action", action);
                });
            }

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
