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

// ── Python sidecar: inline PDF text editor engine ───────────────────────────

/// Find the Python interpreter command for the current platform.
/// Windows ships without `python3`; tries "python" then "py" launcher.
fn find_python_command() -> String {
    #[cfg(target_os = "windows")]
    {
        // Try "python" first (most common in PATH on Windows)
        if std::process::Command::new("python")
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return "python".to_string();
        }
        // Fall back to the Python Launcher ("py")
        "py".to_string()
    }
    #[cfg(not(target_os = "windows"))]
    {
        "python3".to_string()
    }
}

/// Run the Python PDF text editor engine with a JSON command on stdin.
/// Returns the JSON result from the engine's stdout.
#[tauri::command]
async fn run_pdf_edit_engine(app: tauri::AppHandle, json_input: String) -> Result<String, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {}", e))?;
    let script_path = resource_dir.join("scripts").join("pdf_edit_engine.py");

    // Fall back to compile-time project root in development
    let script = if script_path.exists() {
        script_path
    } else {
        // CARGO_MANIFEST_DIR points to src-tauri/, so go one level up
        let dev_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("scripts")
            .join("pdf_edit_engine.py");
        dev_path
    };

    // On Windows: try "python", then "py"; on Unix: use "python3"
    let python_cmd = find_python_command();

    let mut child = std::process::Command::new(&python_cmd)
        .arg(&script)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}", python_cmd, e))?;

    // Write JSON command to stdin
    if let Some(ref mut stdin) = child.stdin {
        use std::io::Write;
        stdin.write_all(json_input.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }
    // Close stdin by dropping
    child.stdin.take();

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to read output: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Try to extract JSON error from stdout
        if !stdout.is_empty() && stdout.starts_with('{') {
            return Ok(stdout.to_string());
        }
        return Err(format!("Engine exited with {}: {}", output.status, stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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
            run_pdf_edit_engine,
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
