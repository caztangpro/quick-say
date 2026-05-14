import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: "CommandOrControl+Shift+Space",
  uiLanguage: "en",
  transcriptionModel: "FunAudioLLM/SenseVoiceSmall",
  polishModel: "Qwen/Qwen2.5-7B-Instruct",
  polishEnabled: true,
  languageMode: "auto",
  customLanguage: "",
  pasteBehavior: "auto",
  restoreClipboard: true,
  launchAtStartup: false,
  historyEnabled: false,
};

export interface SettingsValidationMessages {
  hotkeyIncomplete: string;
  transcriptionModelRequired: string;
  polishModelRequired: string;
  customLanguageRequired: string;
}

const DEFAULT_VALIDATION_MESSAGES: SettingsValidationMessages = {
  hotkeyIncomplete: "Hotkey must include a modifier and a key.",
  transcriptionModelRequired: "Transcription model is required.",
  polishModelRequired: "Polish model is required when polishing is enabled.",
  customLanguageRequired: "Custom language is required when custom language mode is selected.",
};

const MODIFIER_KEYS = new Set([
  "Alt",
  "Command",
  "CommandOrControl",
  "Control",
  "Ctrl",
  "Meta",
  "Option",
  "Shift",
  "Super",
]);

const KEY_ALIASES: Record<string, string> = {
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  Backspace: "Backspace",
  Delete: "Delete",
  End: "End",
  Enter: "Enter",
  Escape: "Escape",
  Home: "Home",
  Insert: "Insert",
  PageDown: "PageDown",
  PageUp: "PageUp",
  Space: "Space",
  Tab: "Tab",
};

export type HotkeyKeyboardEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const migratedTranscriptionModel =
    input.transcriptionModel === "gpt-4o-transcribe"
      ? DEFAULT_SETTINGS.transcriptionModel
      : input.transcriptionModel;
  const migratedPolishModel =
    input.polishModel === "gpt-4o-mini" ? DEFAULT_SETTINGS.polishModel : input.polishModel;

  return {
    ...DEFAULT_SETTINGS,
    ...input,
    hotkey: input.hotkey?.trim() || DEFAULT_SETTINGS.hotkey,
    uiLanguage: isUiLanguage(input.uiLanguage) ? input.uiLanguage : DEFAULT_SETTINGS.uiLanguage,
    transcriptionModel:
      migratedTranscriptionModel?.trim() || DEFAULT_SETTINGS.transcriptionModel,
    polishModel: migratedPolishModel?.trim() || DEFAULT_SETTINGS.polishModel,
    customLanguage: input.customLanguage?.trim() || "",
  };
}

export function validateSettings(
  settings: AppSettings,
  messages: SettingsValidationMessages = DEFAULT_VALIDATION_MESSAGES,
): string[] {
  const errors: string[] = [];

  if (!isCompleteHotkey(settings.hotkey)) {
    errors.push(messages.hotkeyIncomplete);
  }

  if (!settings.transcriptionModel.trim()) {
    errors.push(messages.transcriptionModelRequired);
  }

  if (settings.polishEnabled && !settings.polishModel.trim()) {
    errors.push(messages.polishModelRequired);
  }

  if (settings.languageMode === "custom" && !settings.customLanguage.trim()) {
    errors.push(messages.customLanguageRequired);
  }

  return errors;
}

export function isCompleteHotkey(hotkey: string): boolean {
  const parts = hotkey
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.some((part) => MODIFIER_KEYS.has(part)) && parts.some((part) => !MODIFIER_KEYS.has(part));
}

export function formatHotkeyFromKeyboardEvent(event: HotkeyKeyboardEvent): string | null {
  const key = normalizeHotkeyKey(event);

  if (!key) {
    return null;
  }

  const modifiers: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    modifiers.push("CommandOrControl");
  }

  if (event.altKey) {
    modifiers.push("Alt");
  }

  if (event.shiftKey) {
    modifiers.push("Shift");
  }

  if (modifiers.length === 0) {
    return null;
  }

  return [...modifiers, key].join("+");
}

function normalizeHotkeyKey(event: HotkeyKeyboardEvent): string | null {
  const { code, key } = event;

  if (["Alt", "Control", "Meta", "Shift"].includes(key)) {
    return null;
  }

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code;
  }

  if (code in KEY_ALIASES) {
    return KEY_ALIASES[code];
  }

  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return key.toUpperCase();
  }

  return null;
}

function isUiLanguage(value: unknown): value is AppSettings["uiLanguage"] {
  return value === "en" || value === "zh";
}
