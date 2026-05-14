use crate::audio::ActiveRecording;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub recording: Mutex<Option<ActiveRecording>>,
}
