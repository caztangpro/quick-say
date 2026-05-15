use crate::errors::{QuickSayError, QuickSayResult};
use serde::Serialize;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::time::sleep;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasteOutcome {
    pub pasted: bool,
    pub clipboard_only: bool,
}

pub async fn paste_text(app: &AppHandle, text: &str, restore_clipboard: bool, clipboard_only: bool) -> QuickSayResult<PasteOutcome> {
    let previous_clipboard = if restore_clipboard {
        app.clipboard().read_text().ok()
    } else {
        None
    };

    app.clipboard()
        .write_text(text.to_string())
        .map_err(|error| QuickSayError::Paste(error.to_string()))?;

    if clipboard_only {
        return Ok(PasteOutcome {
            pasted: false,
            clipboard_only: true,
        });
    }

    sleep(Duration::from_millis(80)).await;
    let pasted = trigger_paste().is_ok();

    if let Some(previous) = previous_clipboard {
        let app_handle = app.clone();
        tokio::spawn(async move {
            sleep(Duration::from_millis(400)).await;
            let _ = app_handle.clipboard().write_text(previous);
        });
    }

    Ok(PasteOutcome {
        pasted,
        clipboard_only: !pasted,
    })
}

fn trigger_paste() -> QuickSayResult<()> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
            ])
            .status()
            .map_err(|error| QuickSayError::Paste(error.to_string()))?;
        return status
            .success()
            .then_some(())
            .ok_or_else(|| QuickSayError::Paste("Windows paste command failed".to_string()));
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("osascript")
            .args(["-e", "tell application \"System Events\" to keystroke \"v\" using command down"])
            .status()
            .map_err(|error| QuickSayError::Paste(error.to_string()))?;
        return status
            .success()
            .then_some(())
            .ok_or_else(|| QuickSayError::Paste("macOS paste command failed".to_string()));
    }

    #[cfg(target_os = "linux")]
    {
        for (program, args) in [
            ("wtype", vec!["-M", "ctrl", "v", "-m", "ctrl"]),
            ("xdotool", vec!["key", "ctrl+v"]),
        ] {
            if let Ok(status) = Command::new(program).args(args).status() {
                if status.success() {
                    return Ok(());
                }
            }
        }

        return Err(QuickSayError::Paste(
            "Linux paste tool not found; install wtype or xdotool, or use clipboard-only mode."
                .to_string(),
        ));
    }

    #[allow(unreachable_code)]
    Err(QuickSayError::Paste(
        "automatic paste is not supported on this platform".to_string(),
    ))
}
