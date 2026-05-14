use crate::audio::CapturedAudio;
use crate::errors::{QuickSayError, QuickSayResult};
use crate::settings::{AppSettings, LanguageMode};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};

const SILICONFLOW_BASE_URL: &str = "https://api.siliconflow.cn/v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptResult {
    pub text: String,
    pub model: String,
}

#[derive(Clone)]
pub struct SiliconFlowClient {
    client: reqwest::Client,
    base_url: String,
}

impl Default for SiliconFlowClient {
    fn default() -> Self {
        Self::new(SILICONFLOW_BASE_URL)
    }
}

impl SiliconFlowClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.into(),
        }
    }

    pub async fn transcribe(
        &self,
        api_key: &str,
        audio: &CapturedAudio,
        settings: &AppSettings,
    ) -> QuickSayResult<TranscriptResult> {
        let part = Part::bytes(audio.bytes.clone())
            .file_name("quick-say-dictation.wav")
            .mime_str("audio/wav")
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;
        let form = Form::new()
            .text("model", settings.transcription_model.clone())
            .part("file", part);

        let response = self
            .client
            .post(format!("{}/audio/transcriptions", self.base_url))
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;

        if !status.is_success() {
            return Err(QuickSayError::Provider(format!(
                "transcription failed with {status}: {}",
                summarize_provider_body(&body)
            )));
        }

        let parsed: TranscriptionResponse = serde_json::from_str(&body)
            .map_err(|error| QuickSayError::Provider(format!("invalid transcription response: {error}")))?;

        Ok(TranscriptResult {
            text: parsed.text.trim().to_string(),
            model: settings.transcription_model.clone(),
        })
    }

    pub async fn polish(
        &self,
        api_key: &str,
        text: &str,
        settings: &AppSettings,
    ) -> QuickSayResult<String> {
        if !settings.polish_enabled || text.trim().is_empty() {
            return Ok(text.to_string());
        }

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .bearer_auth(api_key)
            .json(&ChatCompletionRequest {
                model: settings.polish_model.clone(),
                temperature: 0.1,
                messages: vec![
                    ChatMessage {
                        role: "system",
                        content: build_polish_prompt(settings),
                    },
                    ChatMessage {
                        role: "user",
                        content: text.to_string(),
                    },
                ],
            })
            .send()
            .await
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;

        if !status.is_success() {
            return Err(QuickSayError::Provider(format!(
                "polish failed with {status}: {}",
                summarize_provider_body(&body)
            )));
        }

        let parsed: ChatCompletionResponse = serde_json::from_str(&body)
            .map_err(|error| QuickSayError::Provider(format!("invalid polish response: {error}")))?;

        parsed
            .choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| QuickSayError::Provider("polish response was empty".to_string()))
    }

    pub async fn test_key(&self, api_key: &str) -> QuickSayResult<()> {
        let response = self
            .client
            .get(format!("{}/models", self.base_url))
            .bearer_auth(api_key)
            .send()
            .await
            .map_err(|error| QuickSayError::Provider(error.to_string()))?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            Err(QuickSayError::Provider(format!(
                "provider check failed with {status}: {}",
                summarize_provider_body(&body)
            )))
        }
    }
}

pub fn build_polish_prompt(settings: &AppSettings) -> String {
    let language = match (&settings.language_mode, settings.custom_language.trim()) {
        (LanguageMode::Custom, custom) if !custom.is_empty() => custom.to_string(),
        (LanguageMode::English, _) => "English".to_string(),
        (LanguageMode::Chinese, _) => "Chinese".to_string(),
        (LanguageMode::Japanese, _) => "Japanese".to_string(),
        (LanguageMode::Spanish, _) => "Spanish".to_string(),
        _ => "the detected language".to_string(),
    };

    format!(
        "Clean up a dictated transcript in {language}. Fix punctuation, casing, spacing, and obvious filler words. Preserve the user's meaning. Return only the final text."
    )
}

fn summarize_provider_body(body: &str) -> String {
    if body.len() > 300 {
        format!("{}...", &body[..300])
    } else {
        body.to_string()
    }
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    text: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    temperature: f32,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: &'static str,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{AppSettings, LanguageMode};

    #[test]
    fn polish_prompt_preserves_meaning_constraint() {
        let prompt = build_polish_prompt(&AppSettings::default());
        assert!(prompt.contains("Preserve the user's meaning"));
        assert!(prompt.contains("Return only the final text"));
    }

    #[test]
    fn polish_prompt_respects_custom_language() {
        let mut settings = AppSettings::default();
        settings.language_mode = LanguageMode::Custom;
        settings.custom_language = "Korean".to_string();
        assert!(build_polish_prompt(&settings).contains("Korean"));
    }
}
