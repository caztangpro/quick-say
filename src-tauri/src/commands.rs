use crate::audio::{ActiveRecording, CapturedAudio};
use crate::errors::{QuickSayError, QuickSayResult};
use crate::paste;
use crate::siliconflow::SiliconFlowClient;
use crate::settings::{
    self, AppSettings, PasteBehavior, SaveSettingsPayload, SettingsPayload,
};
use crate::state::AppState;
use serde::Serialize;
use std::future::Future;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;

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
    let mut cancellation = state
        .cancellation
        .lock()
        .map_err(|_| QuickSayError::Audio("cancellation state lock poisoned".to_string()))?;

    if recording.is_some() || cancellation.is_some() {
        return Err(QuickSayError::RecordingAlreadyActive);
    }

    let (cancel_tx, _) = watch::channel(false);
    *recording = Some(ActiveRecording::start(app.clone())?);
    *cancellation = Some(cancel_tx);
    drop(cancellation);
    drop(recording);

    crate::register_cancel_shortcut(&app);
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
    let mut cancel_rx = cancellation_receiver(state)?;

    let _ = app.emit("recording_stopped", ());
    let audio = match active.finish() {
        Ok(audio) => audio,
        Err(error) => {
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    if is_cancelled(&cancel_rx) {
        complete_cancelled_dictation(&app, state, Some(&audio));
        return Err(QuickSayError::DictationCancelled);
    }

    let settings = match settings::load(&app) {
        Ok(settings) => settings,
        Err(error) => {
            remove_audio_file(&audio);
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };
    let api_key = match settings::load_api_key() {
        Ok(api_key) => api_key,
        Err(error) => {
            remove_audio_file(&audio);
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };
    let client = SiliconFlowClient::default();

    let _ = app.emit("transcription_progress", "transcribing");
    let transcript = match run_until_cancelled(
        client.transcribe(&api_key, &audio, &settings),
        &mut cancel_rx,
    )
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => {
            complete_cancelled_dictation(&app, state, Some(&audio));
            return Err(QuickSayError::DictationCancelled);
        }
        Err(error) => {
            let _ = app.emit("dictation_error", error.to_string());
            remove_audio_file(&audio);
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    let _ = app.emit("transcription_progress", "polishing");
    let polished_text = match run_until_cancelled(
        client.polish(&api_key, &transcript.text, &settings),
        &mut cancel_rx,
    )
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => {
            complete_cancelled_dictation(&app, state, Some(&audio));
            return Err(QuickSayError::DictationCancelled);
        }
        Err(error) => {
            let _ = app.emit("dictation_error", error.to_string());
            remove_audio_file(&audio);
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    if is_cancelled(&cancel_rx) {
        complete_cancelled_dictation(&app, state, Some(&audio));
        return Err(QuickSayError::DictationCancelled);
    }

    let clipboard_only = settings.paste_behavior == PasteBehavior::ClipboardOnly;
    let outcome = match paste::paste_text(
        &app,
        &polished_text,
        settings.restore_clipboard,
        clipboard_only,
    )
    .await
    {
        Ok(outcome) => outcome,
        Err(error) => {
            remove_audio_file(&audio);
            clear_active_dictation(&app, state);
            crate::hide_voice_overlay_later(app.clone());
            return Err(error);
        }
    };

    remove_audio_file(&audio);
    clear_active_dictation(&app, state);

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
    let active = {
        let mut recording = state
            .recording
            .lock()
            .map_err(|_| QuickSayError::Audio("recording state lock poisoned".to_string()))?;
        recording.take()
    };
    request_cancellation(state)?;

    if let Some(active) = active {
        active.cancel();
        clear_active_dictation(app, state);
    } else {
        crate::unregister_cancel_shortcut(app);
    }

    let _ = app.emit("dictation_cancelled", ());
    crate::hide_voice_overlay(app);
    Ok(())
}

pub fn cancel_dictation_from_shortcut(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        if let Err(error) = cancel_recording_with_state(&app, &state) {
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
        }
    });
}

pub fn toggle_recording_from_hotkey(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        let recording_active = state
            .recording
            .lock()
            .map(|recording| recording.is_some())
            .unwrap_or(false);
        let dictation_active = state
            .cancellation
            .lock()
            .map(|cancellation| cancellation.is_some())
            .unwrap_or(false);

        let result = if recording_active {
            stop_recording_with_state(app.clone(), &state).await.map(|_| ())
        } else if dictation_active {
            cancel_recording_with_state(&app, &state)
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
            if matches!(error, QuickSayError::DictationCancelled) {
                return;
            }
            let _ = app.emit("dictation_error", error.to_string());
            crate::hide_voice_overlay_later(app.clone());
        }
    });
}

fn cancellation_receiver(state: &AppState) -> QuickSayResult<watch::Receiver<bool>> {
    let cancellation = state
        .cancellation
        .lock()
        .map_err(|_| QuickSayError::Audio("cancellation state lock poisoned".to_string()))?;

    if let Some(cancel_tx) = cancellation.as_ref() {
        Ok(cancel_tx.subscribe())
    } else {
        let (_, cancel_rx) = watch::channel(false);
        Ok(cancel_rx)
    }
}

fn request_cancellation(state: &AppState) -> QuickSayResult<()> {
    let cancellation = state
        .cancellation
        .lock()
        .map_err(|_| QuickSayError::Audio("cancellation state lock poisoned".to_string()))?;

    if let Some(cancel_tx) = cancellation.as_ref() {
        let _ = cancel_tx.send(true);
    }

    Ok(())
}

async fn run_until_cancelled<T, F>(
    future: F,
    cancel_rx: &mut watch::Receiver<bool>,
) -> QuickSayResult<Option<T>>
where
    F: Future<Output = QuickSayResult<T>>,
{
    if is_cancelled(cancel_rx) {
        return Ok(None);
    }

    tokio::select! {
        result = future => result.map(Some),
        _ = wait_for_cancellation(cancel_rx) => Ok(None),
    }
}

async fn wait_for_cancellation(cancel_rx: &mut watch::Receiver<bool>) {
    loop {
        if is_cancelled(cancel_rx) {
            return;
        }

        if cancel_rx.changed().await.is_err() {
            return;
        }
    }
}

fn is_cancelled(cancel_rx: &watch::Receiver<bool>) -> bool {
    *cancel_rx.borrow()
}

fn complete_cancelled_dictation(
    app: &AppHandle,
    state: &AppState,
    audio: Option<&CapturedAudio>,
) {
    if let Some(audio) = audio {
        remove_audio_file(audio);
    }
    clear_active_dictation(app, state);
    let _ = app.emit("dictation_cancelled", ());
    crate::hide_voice_overlay(app);
}

fn clear_active_dictation(app: &AppHandle, state: &AppState) {
    if let Ok(mut cancellation) = state.cancellation.lock() {
        *cancellation = None;
    }
    crate::unregister_cancel_shortcut(app);
}

fn remove_audio_file(audio: &CapturedAudio) {
    let _ = fs::remove_file(&audio.path);
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
