use crate::audio::ActiveRecording;
use crate::errors::{QuickSayError, QuickSayResult};
use crate::siliconflow::SiliconFlowClient;
use crate::paste;
use crate::settings::{
    self, AppSettings, PasteBehavior, SaveSettingsPayload, SettingsPayload,
};
use crate::state::AppState;
use serde::Serialize;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationResult {
    pub transcript: String,
    pub polished_text: String,
    pub pasted: bool,
    pub clipboard_only: bool,
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> QuickSayResult<SettingsPayload> {
    Ok(SettingsPayload {
        settings: settings::load(&app)?,
        has_api_key: settings::has_api_key(),
    })
}

#[tauri::command]
pub fn save_settings(app: AppHandle, payload: SaveSettingsPayload) -> QuickSayResult<SettingsPayload> {
    settings::save(&app, &payload.settings)?;
    if let Some(api_key) = payload.api_key.as_deref().filter(|value| !value.trim().is_empty()) {
        settings::save_api_key(api_key.trim())?;
    }
    crate::register_configured_hotkey(&app).map_err(|error| {
        QuickSayError::Settings(format!("failed to register hotkey: {error}"))
    })?;

    Ok(SettingsPayload {
        settings: payload.settings,
        has_api_key: settings::has_api_key(),
    })
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: State<AppState>) -> QuickSayResult<()> {
    start_recording_with_state(app, &state)
}

pub fn start_recording_with_state(app: AppHandle, state: &AppState) -> QuickSayResult<()> {
    let mut recording = state
        .recording
        .lock()
        .map_err(|_| QuickSayError::Audio("recording state lock poisoned".to_string()))?;

    if recording.is_some() {
        return Err(QuickSayError::RecordingAlreadyActive);
    }

    *recording = Some(ActiveRecording::start(app.clone())?);
    crate::show_voice_overlay(&app);
    let _ = app.emit("recording_started", ());
    Ok(())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle, state: State<'_, AppState>) -> QuickSayResult<DictationResult> {
    stop_recording_with_state(app, &state).await
}

pub async fn stop_recording_with_state(app: AppHandle, state: &AppState) -> QuickSayResult<DictationResult> {
    let active = {
        let mut recording = state
            .recording
            .lock()
            .map_err(|_| QuickSayError::Audio("recording state lock poisoned".to_string()))?;
        recording.take().ok_or(QuickSayError::NoActiveRecording)?
    };

    let _ = app.emit("recording_stopped", ());
    let audio = active.finish()?;
    let settings = settings::load(&app)?;
    let api_key = settings::load_api_key()?;
    let client = SiliconFlowClient::default();

    let _ = app.emit("transcription_progress", "transcribing");
    let transcript = match client.transcribe(&api_key, &audio, &settings).await {
        Ok(value) => value,
        Err(error) => {
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    let _ = app.emit("transcription_progress", "polishing");
    let polished_text = match client.polish(&api_key, &transcript.text, &settings).await {
        Ok(value) => value,
        Err(error) => {
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    let clipboard_only = settings.paste_behavior == PasteBehavior::ClipboardOnly;
    let outcome = paste::paste_text(
        &app,
        &polished_text,
        settings.restore_clipboard,
        clipboard_only,
    )
    .await?;

    let _ = fs::remove_file(audio.path);

    let result = DictationResult {
        transcript: transcript.text,
        polished_text,
        pasted: outcome.pasted,
        clipboard_only: outcome.clipboard_only,
    };
    let _ = app.emit("paste_completed", &result);
    crate::hide_voice_overlay_later(app);
    Ok(result)
}

#[tauri::command]
pub fn cancel_recording(app: AppHandle, state: State<AppState>) -> QuickSayResult<()> {
    cancel_recording_with_state(&app, &state)
}

pub fn cancel_recording_with_state(app: &AppHandle, state: &AppState) -> QuickSayResult<()> {
    let mut recording = state
        .recording
        .lock()
        .map_err(|_| QuickSayError::Audio("recording state lock poisoned".to_string()))?;
    *recording = None;
    crate::hide_voice_overlay(app);
    Ok(())
}

pub fn toggle_recording_from_hotkey(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        let recording_active = state
            .recording
            .lock()
            .map(|recording| recording.is_some())
            .unwrap_or(false);

        let result = if recording_active {
            stop_recording_with_state(app.clone(), &state).await.map(|_| ())
        } else if settings::has_api_key() {
            start_recording_with_state(app.clone(), &state)
        } else {
            crate::show_voice_overlay(&app);
            let error = QuickSayError::MissingApiKey;
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
            Ok(())
        };

        if let Err(error) = result {
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
        }
    });
}

#[tauri::command]
pub async fn test_provider(api_key: Option<String>) -> QuickSayResult<ProviderStatus> {
    let key = match api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
    {
        Some(value) => value,
        None => settings::load_api_key()?,
    };

    match SiliconFlowClient::default().test_key(&key).await {
        Ok(()) => Ok(ProviderStatus {
            ok: true,
            message: "Provider connection works.".to_string(),
        }),
        Err(error) => Ok(ProviderStatus {
            ok: false,
            message: error.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn paste_text(app: AppHandle, text: String) -> QuickSayResult<DictationResult> {
    let settings = settings::load(&app).unwrap_or_else(|_| AppSettings::default());
    let outcome = paste::paste_text(
        &app,
        &text,
        settings.restore_clipboard,
        settings.paste_behavior == PasteBehavior::ClipboardOnly,
    )
    .await?;

    Ok(DictationResult {
        transcript: text.clone(),
        polished_text: text,
        pasted: outcome.pasted,
        clipboard_only: outcome.clipboard_only,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_status_serializes_camel_case() {
        let status = ProviderStatus {
            ok: true,
            message: "ok".to_string(),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"message\""));
    }
}
