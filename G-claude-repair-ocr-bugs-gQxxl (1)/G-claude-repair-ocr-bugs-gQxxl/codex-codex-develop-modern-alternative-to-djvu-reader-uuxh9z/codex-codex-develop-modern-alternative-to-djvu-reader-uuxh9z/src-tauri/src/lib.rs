use tauri::Manager;

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

// Точка входа — настройка Tauri приложения
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .setup(|app| {
            // Настройки окна при запуске
            let window = app.get_webview_window("main").unwrap();

            // Установить минимальный размер окна
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));

            // В debug — открыть DevTools
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
