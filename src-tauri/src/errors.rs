use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum QuickSayError {
    #[error("No microphone input device was found.")]
    NoInputDevice,
    #[error("Could not start audio capture: {0}")]
    Audio(String),
    #[error("Recording is already active.")]
    RecordingAlreadyActive,
    #[error("No recording is active.")]
    NoActiveRecording,
    #[error("Dictation cancelled.")]
    DictationCancelled,
    #[error("Recording was empty. Please try again.")]
    EmptyRecording,
    #[error("SiliconFlow API key is missing. Add it in Settings.")]
    MissingApiKey,
    #[error("Settings could not be saved: {0}")]
    Settings(String),
    #[error("Secret storage failed: {0}")]
    Secret(String),
    #[error("SiliconFlow request failed: {0}")]
    Provider(String),
    #[error("Paste failed: {0}")]
    Paste(String),
}

impl Serialize for QuickSayError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type QuickSayResult<T> = Result<T, QuickSayError>;
