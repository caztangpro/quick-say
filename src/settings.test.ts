import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  formatHotkeyFromKeyboardEvent,
  normalizeSettings,
  validateSettings,
} from "./settings";
import { getMessages, renderMessage } from "./i18n";
import type { AppSettings } from "./types";

describe("settings validation", () => {
  it("fills missing settings with defaults", () => {
    expect(normalizeSettings({ polishEnabled: false })).toEqual({
      ...DEFAULT_SETTINGS,
      polishEnabled: false,
    });
  });

  it("migrates old OpenAI defaults to SiliconFlow defaults", () => {
    expect(
      normalizeSettings({
        transcriptionModel: "gpt-4o-transcribe",
        polishModel: "gpt-4o-mini",
      }),
    ).toMatchObject({
      transcriptionModel: "FunAudioLLM/SenseVoiceSmall",
      polishModel: "Qwen/Qwen2.5-7B-Instruct",
    });
  });

  it("normalizes invalid interface language to English", () => {
    expect(
      normalizeSettings({
        uiLanguage: "fr" as AppSettings["uiLanguage"],
      }).uiLanguage,
    ).toBe("en");
  });

  it("requires a modifier-style hotkey", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, hotkey: "Space" })).toContain(
      "Hotkey must include a modifier and a key.",
    );
  });

  it("requires a non-modifier key in the hotkey", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, hotkey: "CommandOrControl+Shift" })).toContain(
      "Hotkey must include a modifier and a key.",
    );
  });

  it("formats a captured letter hotkey", () => {
    expect(
      formatHotkeyFromKeyboardEvent({
        altKey: false,
        code: "KeyK",
        ctrlKey: true,
        key: "k",
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe("CommandOrControl+Shift+K");
  });

  it("ignores modifier-only captures", () => {
    expect(
      formatHotkeyFromKeyboardEvent({
        altKey: false,
        code: "ShiftLeft",
        ctrlKey: false,
        key: "Shift",
        metaKey: false,
        shiftKey: true,
      }),
    ).toBeNull();
  });

  it("requires a custom language label when custom mode is selected", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, languageMode: "custom" })).toContain(
      "Custom language is required when custom language mode is selected.",
    );
  });

  it("returns localized validation and runtime messages", () => {
    const zh = getMessages("zh");

    expect(validateSettings({ ...DEFAULT_SETTINGS, hotkey: "Space" }, zh.validation)).toContain(
      "快捷键必须包含修饰键和普通按键。",
    );
    expect(renderMessage({ key: "settingsSaved" }, zh)).toBe("设置已保存。");
  });
});
