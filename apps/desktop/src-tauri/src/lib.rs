/// Точка входа оболочки Life OS. Общий PWA грузится как frontendDist; вся бизнес-логика —
/// в веб-слое (домен переиспользуется). Здесь только нативное окно и системная интеграция.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("Ошибка запуска Life OS Desktop");
}
