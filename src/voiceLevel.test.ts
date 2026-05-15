import { describe, expect, it } from "vitest";
import { getRecordingDisplayLevel, getVoiceVisualLevel } from "./voiceLevel";

describe("voice level display calibration", () => {
  it("keeps silence and near-noise readings visually quiet", () => {
    expect(getRecordingDisplayLevel(-1)).toBe(0);
    expect(getRecordingDisplayLevel(0)).toBe(0);
    expect(getRecordingDisplayLevel(0.011)).toBe(0);
  });

  it("maps normal speech RMS into a useful display range", () => {
    expect(getRecordingDisplayLevel(0.05)).toBeGreaterThan(0.3);
    expect(getRecordingDisplayLevel(0.1)).toBeGreaterThan(0.55);
    expect(getRecordingDisplayLevel(0.18)).toBeGreaterThan(0.78);
  });

  it("caps very loud input at the top of the display range", () => {
    expect(getRecordingDisplayLevel(0.24)).toBe(1);
    expect(getRecordingDisplayLevel(1)).toBe(1);
  });

  it("keeps the recording indicator alive even before speech arrives", () => {
    expect(getVoiceVisualLevel("recording", 0)).toBe(0.06);
  });

  it("uses stable fallback levels outside active recording", () => {
    expect(getVoiceVisualLevel("idle", 1)).toBe(0.08);
    expect(getVoiceVisualLevel("transcribing", 1)).toBe(0.28);
    expect(getVoiceVisualLevel("pasted", 1)).toBe(0.18);
    expect(getVoiceVisualLevel("error", 1)).toBe(0.2);
  });
});
