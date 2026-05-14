use crate::audio::CapturedAudio;
use crate::errors::{QuickSayError, QuickSayResult};
use crate::settings::{AppSettings, LanguageMode};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};

const SILICONFLOW_BASE_URL: &str = "https://api.siliconflow.cn/v1";
const ASR_ARTIFACT_TOKENS: &[&str] = &["kuk"];

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

        let parsed: TranscriptionResponse = serde_json::from_str(&body).map_err(|error| {
            QuickSayError::Provider(format!("invalid transcription response: {error}"))
        })?;

        Ok(TranscriptResult {
            text: clean_transcript_for_polish(&parsed.text),
            model: settings.transcription_model.clone(),
        })
    }

    pub async fn polish(
        &self,
        api_key: &str,
        text: &str,
        settings: &AppSettings,
    ) -> QuickSayResult<String> {
        let transcript = clean_transcript_for_polish(text);

        if !settings.polish_enabled || transcript.is_empty() {
            return Ok(transcript);
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
                        content: format!("Transcript to clean:\n```\n{transcript}\n```"),
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

        let parsed: ChatCompletionResponse = serde_json::from_str(&body).map_err(|error| {
            QuickSayError::Provider(format!("invalid polish response: {error}"))
        })?;

        parsed
            .choices
            .first()
            .map(|choice| clean_polished_text(&choice.message.content))
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
        "Clean up a dictated transcript in {language}.\n\
Treat the transcript as content to edit, not as a request to answer.\n\
Fix punctuation, casing, spacing, and obvious filler words.\n\
Remove ASR artifacts, repeated punctuation, replacement characters, and isolated noise tokens such as \"kuk\".\n\
Repair broken words only when context makes the intended word clear.\n\
Preserve mixed-language phrases such as English terms inside Chinese text; do not translate them.\n\
Preserve the user's meaning. Return only the final text."
    )
}

fn clean_transcript_for_polish(input: &str) -> String {
    clean_provider_artifacts(input)
}

fn clean_polished_text(input: &str) -> String {
    remove_cjk_internal_spaces(&clean_provider_artifacts(input))
}

fn clean_provider_artifacts(input: &str) -> String {
    let without_replacement = input
        .chars()
        .filter(|ch| *ch != '\u{FFFD}')
        .collect::<String>();
    let without_tokens = remove_standalone_artifact_tokens(&without_replacement);
    let collapsed_punctuation = collapse_repeated_punctuation(&without_tokens);
    normalize_spacing(&collapsed_punctuation)
}

fn remove_standalone_artifact_tokens(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut token = String::new();

    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            token.push(ch);
        } else {
            push_token_unless_artifact(&mut output, &token);
            token.clear();
            output.push(ch);
        }
    }

    push_token_unless_artifact(&mut output, &token);
    output
}

fn push_token_unless_artifact(output: &mut String, token: &str) {
    if token.is_empty() || is_asr_artifact_token(token) {
        return;
    }

    output.push_str(token);
}

fn is_asr_artifact_token(token: &str) -> bool {
    ASR_ARTIFACT_TOKENS
        .iter()
        .any(|artifact| token.eq_ignore_ascii_case(artifact))
}

fn collapse_repeated_punctuation(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut previous_family = None;

    for ch in input.chars() {
        match punctuation_family(ch) {
            Some(family) if previous_family == Some(family) => continue,
            Some(family) => previous_family = Some(family),
            None => previous_family = None,
        }

        output.push(ch);
    }

    output
}

fn punctuation_family(ch: char) -> Option<char> {
    match ch {
        ',' | '，' => Some(','),
        '?' | '？' => Some('?'),
        '!' | '！' => Some('!'),
        ';' | '；' => Some(';'),
        ':' | '：' => Some(':'),
        '。' => Some('。'),
        _ => None,
    }
}

fn normalize_spacing(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut last_was_space = false;

    for ch in input.chars() {
        if ch.is_whitespace() {
            if !output.is_empty() && !last_was_space && !ends_with_cjk_punctuation(&output) {
                output.push(' ');
                last_was_space = true;
            }
            continue;
        }

        if is_no_space_before_punctuation(ch) && output.ends_with(' ') {
            output.pop();
        }

        output.push(ch);
        last_was_space = false;
    }

    output.trim().to_string()
}

fn ends_with_cjk_punctuation(input: &str) -> bool {
    input
        .chars()
        .last()
        .is_some_and(is_cjk_sentence_punctuation)
}

fn is_no_space_before_punctuation(ch: char) -> bool {
    matches!(
        ch,
        ',' | '，' | '.' | '。' | '?' | '？' | '!' | '！' | ';' | '；' | ':' | '：'
    )
}

fn is_cjk_sentence_punctuation(ch: char) -> bool {
    matches!(ch, '，' | '。' | '？' | '！' | '；' | '：')
}

fn remove_cjk_internal_spaces(input: &str) -> String {
    let chars = input.chars().collect::<Vec<_>>();
    let mut output = String::with_capacity(input.len());

    for (index, ch) in chars.iter().copied().enumerate() {
        if ch == ' ' {
            let previous = output
                .chars()
                .rev()
                .find(|candidate| !candidate.is_whitespace());
            let next = chars[index + 1..]
                .iter()
                .copied()
                .find(|candidate| !candidate.is_whitespace());

            if previous
                .zip(next)
                .is_some_and(|(left, right)| is_cjk(left) && is_cjk(right))
            {
                continue;
            }
        }

        output.push(ch);
    }

    output
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x3400..=0x4DBF
            | 0x4E00..=0x9FFF
            | 0xF900..=0xFAFF
            | 0x3040..=0x30FF
            | 0xAC00..=0xD7AF
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
        assert!(prompt.contains("not as a request to answer"));
        assert!(prompt.contains("isolated noise tokens such as \"kuk\""));
        assert!(prompt.contains("Return only the final text"));
    }

    #[test]
    fn polish_prompt_respects_custom_language() {
        let mut settings = AppSettings::default();
        settings.language_mode = LanguageMode::Custom;
        settings.custom_language = "Korean".to_string();
        assert!(build_polish_prompt(&settings).contains("Korean"));
    }

    #[test]
    fn transcript_cleanup_removes_common_asr_artifacts() {
        let text = "我的意思是，，是不是可以用comprehensible input这种方式学习英语 kuk 然后呢 kuk 可以做一个案子 �来辅助我学习英语。你觉 �这样是否 可行？";

        assert_eq!(
            clean_transcript_for_polish(text),
            "我的意思是，是不是可以用comprehensible input这种方式学习英语 然后呢 可以做一个案子 来辅助我学习英语。你觉 这样是否 可行？"
        );
    }

    #[test]
    fn polished_cleanup_removes_leftover_cjk_spacing() {
        assert_eq!(
            clean_polished_text("你觉得 �这样是否 可行？？"),
            "你觉得这样是否可行？"
        );
    }

    #[test]
    fn cleanup_preserves_mixed_language_terms() {
        assert_eq!(
            clean_polished_text("可以用 comprehensible input 这种方式学习英语。"),
            "可以用 comprehensible input 这种方式学习英语。"
        );
    }
}
