use crate::errors::{QuickSayError, QuickSayResult};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use hound::{SampleFormat as WavSampleFormat, WavSpec, WavWriter};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tempfile::NamedTempFile;

pub struct ActiveRecording {
    stop_tx: mpsc::Sender<()>,
    join_handle: Option<JoinHandle<()>>,
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    channels: u16,
}

#[derive(Debug, Clone)]
pub struct CapturedAudio {
    pub path: PathBuf,
    pub bytes: Vec<u8>,
}

impl ActiveRecording {
    pub fn start(app: AppHandle) -> QuickSayResult<Self> {
        let (ready_tx, ready_rx) = mpsc::channel::<Result<RecordingInit, String>>();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let (level_tx, level_rx) = mpsc::channel::<f32>();
        let join_handle = thread::spawn(move || {
            let result = create_stream(level_tx);
            let (stream, init) = match result {
                Ok(value) => value,
                Err(error) => {
                    let _ = ready_tx.send(Err(error.to_string()));
                    return;
                }
            };

            if let Err(error) = stream.play() {
                let _ = ready_tx.send(Err(error.to_string()));
                return;
            }

            let _ = ready_tx.send(Ok(init));
            let _keep_stream_alive = stream;
            let mut last_level = 0.0_f32;
            let mut last_emit = Instant::now();

            loop {
                match stop_rx.try_recv() {
                    Ok(_) | Err(mpsc::TryRecvError::Disconnected) => break,
                    Err(mpsc::TryRecvError::Empty) => {}
                }

                while let Ok(level) = level_rx.try_recv() {
                    last_level = level;
                }

                if last_emit.elapsed() >= Duration::from_millis(50) {
                    let _ = app.emit("voice_level", last_level);
                    last_emit = Instant::now();
                }

                thread::sleep(Duration::from_millis(16));
            }
        });

        let init = ready_rx
            .recv()
            .map_err(|error| QuickSayError::Audio(error.to_string()))?
            .map_err(QuickSayError::Audio)?;

        Ok(Self {
            stop_tx,
            join_handle: Some(join_handle),
            samples: init.samples,
            sample_rate: init.sample_rate,
            channels: init.channels,
        })
    }

    pub fn finish(mut self) -> QuickSayResult<CapturedAudio> {
        let _ = self.stop_tx.send(());
        if let Some(join_handle) = self.join_handle.take() {
            let _ = join_handle.join();
        }
        let samples = self
            .samples
            .lock()
            .map_err(|_| QuickSayError::Audio("recording buffer lock poisoned".to_string()))?
            .clone();
        write_wav(samples, self.sample_rate, self.channels)
    }

    pub fn cancel(mut self) {
        let _ = self.stop_tx.send(());
        if let Some(join_handle) = self.join_handle.take() {
            let _ = join_handle.join();
        }
    }
}

struct RecordingInit {
    samples: Arc<Mutex<Vec<i16>>>,
    sample_rate: u32,
    channels: u16,
}

fn create_stream(level_tx: mpsc::Sender<f32>) -> QuickSayResult<(cpal::Stream, RecordingInit)> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(QuickSayError::NoInputDevice)?;
    let supported_config = device
        .default_input_config()
        .map_err(|error| QuickSayError::Audio(error.to_string()))?;
    let sample_format = supported_config.sample_format();
    let config: StreamConfig = supported_config.into();
    let sample_rate = config.sample_rate.0;
    let channels = config.channels;
    let samples = Arc::new(Mutex::new(Vec::<i16>::new()));
    let writer_samples = Arc::clone(&samples);
    let i16_level_tx = level_tx.clone();
    let u16_level_tx = level_tx.clone();
    let f32_level_tx = level_tx;
    let err_fn = |error| eprintln!("Quick Say audio stream error: {error}");

    let stream = match sample_format {
        SampleFormat::I16 => device.build_input_stream(
            &config,
            move |data: &[i16], _| {
                let _ = i16_level_tx.send(voice_level_i16(data));
                push_i16(data, &writer_samples);
            },
            err_fn,
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            &config,
            move |data: &[u16], _| {
                let _ = u16_level_tx.send(voice_level_u16(data));
                push_u16(data, &writer_samples);
            },
            err_fn,
            None,
        ),
        SampleFormat::F32 => device.build_input_stream(
            &config,
            move |data: &[f32], _| {
                let _ = f32_level_tx.send(voice_level_f32(data));
                push_f32(data, &writer_samples);
            },
            err_fn,
            None,
        ),
        format => {
            return Err(QuickSayError::Audio(format!(
                "unsupported input sample format: {format:?}"
            )))
        }
    }
    .map_err(|error| QuickSayError::Audio(error.to_string()))?;

    Ok((
        stream,
        RecordingInit {
            samples,
            sample_rate,
            channels,
        },
    ))
}

pub fn write_wav(samples: Vec<i16>, sample_rate: u32, channels: u16) -> QuickSayResult<CapturedAudio> {
    if samples.is_empty() {
        return Err(QuickSayError::EmptyRecording);
    }

    let temp_file = NamedTempFile::new()
        .map_err(|error| QuickSayError::Audio(format!("failed to create temp file: {error}")))?;
    let (_file, path) = temp_file
        .keep()
        .map_err(|error| QuickSayError::Audio(format!("failed to keep temp file: {error}")))?;

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: WavSampleFormat::Int,
    };

    let mut writer = WavWriter::create(&path, spec)
        .map_err(|error| QuickSayError::Audio(format!("failed to create wav file: {error}")))?;
    for sample in &samples {
        writer
            .write_sample(*sample)
            .map_err(|error| QuickSayError::Audio(format!("failed to write wav sample: {error}")))?;
    }
    writer
        .finalize()
        .map_err(|error| QuickSayError::Audio(format!("failed to finalize wav file: {error}")))?;

    let bytes = std::fs::read(&path)
        .map_err(|error| QuickSayError::Audio(format!("failed to read wav file: {error}")))?;

    Ok(CapturedAudio {
        path,
        bytes,
    })
}

fn push_i16(data: &[i16], samples: &Arc<Mutex<Vec<i16>>>) {
    if let Ok(mut target) = samples.lock() {
        target.extend_from_slice(data);
    }
}

fn push_u16(data: &[u16], samples: &Arc<Mutex<Vec<i16>>>) {
    if let Ok(mut target) = samples.lock() {
        target.extend(data.iter().map(|sample| (*sample as i32 - 32768) as i16));
    }
}

fn push_f32(data: &[f32], samples: &Arc<Mutex<Vec<i16>>>) {
    if let Ok(mut target) = samples.lock() {
        target.extend(data.iter().map(|sample| {
            let clamped = sample.clamp(-1.0, 1.0);
            (clamped * i16::MAX as f32) as i16
        }));
    }
}

fn voice_level_i16(data: &[i16]) -> f32 {
    if data.is_empty() {
        return 0.0;
    }

    let sum = data
        .iter()
        .map(|sample| {
            let value = *sample as f32 / i16::MAX as f32;
            value * value
        })
        .sum::<f32>();

    (sum / data.len() as f32).sqrt().clamp(0.0, 1.0)
}

fn voice_level_u16(data: &[u16]) -> f32 {
    if data.is_empty() {
        return 0.0;
    }

    let sum = data
        .iter()
        .map(|sample| {
            let value = (*sample as f32 - 32768.0) / 32768.0;
            value * value
        })
        .sum::<f32>();

    (sum / data.len() as f32).sqrt().clamp(0.0, 1.0)
}

fn voice_level_f32(data: &[f32]) -> f32 {
    if data.is_empty() {
        return 0.0;
    }

    let sum = data
        .iter()
        .map(|sample| {
            let value = sample.clamp(-1.0, 1.0);
            value * value
        })
        .sum::<f32>();

    (sum / data.len() as f32).sqrt().clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_wav_rejects_empty_audio() {
        let error = write_wav(Vec::new(), 16_000, 1).unwrap_err();
        assert!(matches!(error, QuickSayError::EmptyRecording));
    }

    #[test]
    fn write_wav_creates_readable_file() {
        let audio = write_wav(vec![0, 120, -120, 0], 16_000, 1).unwrap();
        assert!(audio.path.exists());
        assert!(audio.bytes.len() > 44);
        let _ = std::fs::remove_file(audio.path);
    }

    #[test]
    fn voice_level_tracks_sample_intensity() {
        assert_eq!(voice_level_i16(&[]), 0.0);
        assert_eq!(voice_level_i16(&[0, 0, 0]), 0.0);
        assert!(voice_level_i16(&[0, i16::MAX, 0]) > 0.5);
        assert!(voice_level_f32(&[0.0, 0.25]) < voice_level_f32(&[0.0, 0.9]));
        assert!(voice_level_u16(&[32768, u16::MAX]) > 0.5);
    }
}
