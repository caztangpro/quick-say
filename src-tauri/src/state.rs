use crate::audio::ActiveRecording;
use std::sync::Mutex;
use tokio::sync::watch;

#[derive(Default)]
pub struct AppState {
    pub recording: Mutex<Option<ActiveRecording>>,
    pub cancellation: Mutex<Option<watch::Sender<bool>>>,
}
