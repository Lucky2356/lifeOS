/// Точка входа десктоп-оболочки Life OS. Общий UI грузится как frontendDist; вся логика и все
/// данные — на устройстве (ADR 0006). Здесь только нативное окно и системная интеграция.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Запоминает размер/позицию/развёрнутость окна между запусками.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Запись резервной копии в «Загрузки» (единственная файловая операция приложения).
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Ошибка запуска Life OS Desktop");
}
