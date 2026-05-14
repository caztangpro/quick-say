mod audio;
mod commands;
mod errors;
mod siliconflow;
mod paste;
mod settings;
mod state;

use commands::{
    cancel_recording, load_settings, paste_text, save_settings, start_recording, stop_recording,
    test_provider, toggle_recording_from_hotkey,
};
use state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(desktop)]
const VOICE_OVERLAY_WIDTH: f64 = 360.0;
#[cfg(desktop)]
const VOICE_OVERLAY_HEIGHT: f64 = 112.0;
#[cfg(desktop)]
const VOICE_OVERLAY_BOTTOM_MARGIN: f64 = 64.0;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let state = AppState::default();
            app.manage(state);

            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                register_configured_hotkey(app.handle())
                    .map_err(|error| Box::<dyn std::error::Error>::from(error))?;
                create_tray(app.handle())?;
                create_voice_overlay(app.handle())?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            start_recording,
            stop_recording,
            cancel_recording,
            test_provider,
            paste_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quick Say");
}

#[cfg(desktop)]
fn create_voice_overlay(app: &tauri::AppHandle) -> tauri::Result<()> {
    if app.get_webview_window("voice-overlay").is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "voice-overlay",
        WebviewUrl::App("index.html?view=voice-overlay".into()),
    )
    .title("Quick Say Voice")
    .inner_size(VOICE_OVERLAY_WIDTH, VOICE_OVERLAY_HEIGHT)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .focused(false)
    .visible(false)
    .build()?;

    Ok(())
}

#[cfg(desktop)]
pub fn show_voice_overlay(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("voice-overlay") {
        if let Some(monitor) = monitor_for_voice_overlay(app, &window) {
            let work_area = monitor.work_area();
            let scale_factor = monitor.scale_factor();
            let overlay_width = VOICE_OVERLAY_WIDTH * scale_factor;
            let overlay_height = VOICE_OVERLAY_HEIGHT * scale_factor;
            let bottom_margin = VOICE_OVERLAY_BOTTOM_MARGIN * scale_factor;
            let x = work_area.position.x as f64
                + ((work_area.size.width as f64 - overlay_width) / 2.0).max(0.0);
            let y = work_area.position.y as f64
                + (work_area.size.height as f64 - overlay_height - bottom_margin).max(0.0);
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: x.round() as i32,
                y: y.round() as i32,
            }));
        }

        let _ = window.set_always_on_top(true);
        let _ = window.unminimize();
        let _ = window.show();
    }
}

#[cfg(desktop)]
fn monitor_for_voice_overlay(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
) -> Option<tauri::Monitor> {
    if let Ok(cursor_position) = app.cursor_position() {
        if let Ok(monitors) = app.available_monitors() {
            if let Some(monitor) = monitors.into_iter().find(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                let right = position.x as f64 + size.width as f64;
                let bottom = position.y as f64 + size.height as f64;

                cursor_position.x >= position.x as f64
                    && cursor_position.x < right
                    && cursor_position.y >= position.y as f64
                    && cursor_position.y < bottom
            }) {
                return Some(monitor);
            }
        }
    }

    window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())
}

#[cfg(not(desktop))]
pub fn show_voice_overlay(_app: &tauri::AppHandle) {}

pub fn hide_voice_overlay_later(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(900));
        hide_voice_overlay(&app);
    });
}

pub fn hide_voice_overlay(app: &tauri::AppHandle) {
    #[cfg(desktop)]
    if let Some(window) = app.get_webview_window("voice-overlay") {
        let _ = window.hide();
    }
}

#[cfg(desktop)]
pub fn register_configured_hotkey(app: &tauri::AppHandle) -> Result<(), String> {
    let hotkey = settings::load(app)
        .map(|settings| settings.hotkey)
        .unwrap_or_else(|_| "CommandOrControl+Shift+Space".to_string());

    if hotkey == "CommandOrControl+Shift+Space" {
        return register_default_hotkey(app);
    }

    let app_handle = app.clone();
    app.global_shortcut()
        .unregister_all()
        .map_err(|error| error.to_string())?;
    app.global_shortcut().on_shortcut(hotkey.as_str(), move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            toggle_recording_from_hotkey(app_handle.clone());
        }
    }).map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(not(desktop))]
pub fn register_configured_hotkey(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
fn register_default_hotkey(app: &tauri::AppHandle) -> Result<(), String> {
    let shortcut = Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::SHIFT),
        Code::Space,
    );
    let app_handle = app.clone();

    app.global_shortcut()
        .unregister_all()
        .map_err(|error| error.to_string())?;
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            toggle_recording_from_hotkey(app_handle.clone());
        }
    }).map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(desktop)]
fn create_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Quick Say", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start Recording", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &start, &quit])?;
    let window_app = app.clone();

    TrayIconBuilder::with_id("quick-say-tray")
        .tooltip("Quick Say")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "start" => {
                toggle_recording_from_hotkey(app.clone());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = window_app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
