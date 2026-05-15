import type { DictationStatus } from "./types";

const MIN_RECORDING_VISUAL_LEVEL = 0.06;
const WORKING_VISUAL_LEVEL = 0.28;
const PASTED_VISUAL_LEVEL = 0.18;
const ERROR_VISUAL_LEVEL = 0.2;
const IDLE_VISUAL_LEVEL = 0.08;

// The backend emits raw RMS, where normal speech lives near the bottom of 0..1.
// This curve is only for UI feedback; it does not change captured audio.
const SPEECH_NOISE_FLOOR = 0.012;
const SPEECH_DISPLAY_CEILING = 0.24;
const SPEECH_DISPLAY_CURVE = 0.55;

export function clampVoiceLevel(level: number) {
  return Math.max(0, Math.min(1, level));
}

export function getRecordingDisplayLevel(level: number) {
  const clampedLevel = clampVoiceLevel(level);

  if (clampedLevel <= SPEECH_NOISE_FLOOR) {
    return 0;
  }

  const normalizedLevel =
    (clampedLevel - SPEECH_NOISE_FLOOR) / (SPEECH_DISPLAY_CEILING - SPEECH_NOISE_FLOOR);

  return clampVoiceLevel(Math.pow(normalizedLevel, SPEECH_DISPLAY_CURVE));
}

export function getVoiceVisualLevel(status: DictationStatus, level: number) {
  const isWorking = status === "transcribing" || status === "polishing";

  if (status === "recording") {
    return Math.max(getRecordingDisplayLevel(level), MIN_RECORDING_VISUAL_LEVEL);
  }

  if (isWorking) {
    return WORKING_VISUAL_LEVEL;
  }

  if (status === "pasted") {
    return PASTED_VISUAL_LEVEL;
  }

  if (status === "error") {
    return ERROR_VISUAL_LEVEL;
  }

  return IDLE_VISUAL_LEVEL;
}
