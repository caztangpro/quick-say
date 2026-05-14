use crate::errors::{QuickSayError, QuickSayResult};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "Quick Say";
const KEYRING_USER: &str = "siliconflow_api_key";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub hotkey: String,
    #[serde(default = "default_ui_language")]
    pub ui_language: UiLanguage,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: ThemeMode,
    pub transcription_model: String,
    pub polish_model: String,
    pub polish_enabled: bool,
    pub language_mode: LanguageMode,
    pub custom_language: String,
    pub paste_behavior: PasteBehavior,
    pub restore_clipboard: bool,
    pub launch_at_startup: bool,
    pub history_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UiLanguage {
    En,
    Zh,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LanguageMode {
    Auto,
    English,
    Chinese,
    Japanese,
    Spanish,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PasteBehavior {
    Auto,
    ClipboardOnly,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSettingsPayload {
    pub settings: AppSettings,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPayload {
    pub settings: AppSettings,
    pub has_api_key: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: "CommandOrControl+Shift+Space".to_string(),
            ui_language: UiLanguage::En,
            theme_mode: ThemeMode::Light,
            transcription_model: "FunAudioLLM/SenseVoiceSmall".to_string(),
            polish_model: "Qwen/Qwen2.5-7B-Instruct".to_string(),
            polish_enabled: true,
            language_mode: LanguageMode::Auto,
            custom_language: String::new(),
            paste_behavior: PasteBehavior::Auto,
            restore_clipboard: true,
            launch_at_startup: false,
            history_enabled: false,
        }
    }
}

fn default_ui_language() -> UiLanguage {
    UiLanguage::En
}

fn default_theme_mode() -> ThemeMode {
    ThemeMode::Light
}

pub fn load(app: &AppHandle) -> QuickSayResult<AppSettings> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| {
        QuickSayError::Settings(format!("failed to read {}: {error}", path.display()))
    })?;

    let mut settings: AppSettings = serde_json::from_str(&contents)
        .map_err(|error| QuickSayError::Settings(format!("invalid settings file: {error}")))?;
    migrate_openai_defaults(&mut settings);
    Ok(settings)
}

pub fn save(app: &AppHandle, settings: &AppSettings) -> QuickSayResult<()> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            QuickSayError::Settings(format!("failed to create {}: {error}", parent.display()))
        })?;
    }

    let json = serde_json::to_string_pretty(settings)
        .map_err(|error| QuickSayError::Settings(format!("failed to serialize settings: {error}")))?;
    fs::write(&path, json)
        .map_err(|error| QuickSayError::Settings(format!("failed to write {}: {error}", path.display())))
}

pub fn save_api_key(api_key: &str) -> QuickSayResult<()> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|error| QuickSayError::Secret(error.to_string()))?;
    entry
        .set_password(api_key)
        .map_err(|error| QuickSayError::Secret(error.to_string()))
}

pub fn load_api_key() -> QuickSayResult<String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|error| QuickSayError::Secret(error.to_string()))?;
    entry.get_password().map_err(|error| match error {
        keyring::Error::NoEntry => QuickSayError::MissingApiKey,
        other => QuickSayError::Secret(other.to_string()),
    })
}

pub fn has_api_key() -> bool {
    load_api_key().map(|key| !key.trim().is_empty()).unwrap_or(false)
}

fn migrate_openai_defaults(settings: &mut AppSettings) {
    if settings.transcription_model == "gpt-4o-transcribe" {
        settings.transcription_model = AppSettings::default().transcription_model;
    }

    if settings.polish_model == "gpt-4o-mini" {
        settings.polish_model = AppSettings::default().polish_model;
    }
}

fn settings_path(app: &AppHandle) -> QuickSayResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| QuickSayError::Settings(error.to_string()))?;
    Ok(dir.join("settings.json"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_v1_plan() {
        let settings = AppSettings::default();
        assert_eq!(settings.hotkey, "CommandOrControl+Shift+Space");
        assert_eq!(settings.transcription_model, "FunAudioLLM/SenseVoiceSmall");
        assert_eq!(settings.polish_model, "Qwen/Qwen2.5-7B-Instruct");
        assert_eq!(settings.ui_language, UiLanguage::En);
        assert_eq!(settings.theme_mode, ThemeMode::Light);
        assert!(settings.polish_enabled);
        assert!(!settings.history_enabled);
    }

    #[test]
    fn migrates_old_openai_defaults_to_siliconflow_defaults() {
        let mut settings = AppSettings {
            transcription_model: "gpt-4o-transcribe".to_string(),
            polish_model: "gpt-4o-mini".to_string(),
            ..AppSettings::default()
        };
        migrate_openai_defaults(&mut settings);
        assert_eq!(settings.transcription_model, "FunAudioLLM/SenseVoiceSmall");
        assert_eq!(settings.polish_model, "Qwen/Qwen2.5-7B-Instruct");
    }

    #[test]
    fn deserializes_existing_settings_without_ui_language() {
        let settings: AppSettings = serde_json::from_str(
            r#"{
              "hotkey": "CommandOrControl+Shift+Space",
              "transcriptionModel": "FunAudioLLM/SenseVoiceSmall",
              "polishModel": "Qwen/Qwen2.5-7B-Instruct",
              "polishEnabled": true,
              "languageMode": "auto",
              "customLanguage": "",
              "pasteBehavior": "auto",
              "restoreClipboard": true,
              "launchAtStartup": false,
              "historyEnabled": false
            }"#,
        )
        .expect("settings without uiLanguage should still load");

        assert_eq!(settings.ui_language, UiLanguage::En);
        assert_eq!(settings.theme_mode, ThemeMode::Light);
    }
}
