export type DictationStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "polishing"
  | "pasted"
  | "error";

export type PasteBehavior = "auto" | "clipboard_only";
export type LanguageMode = "auto" | "english" | "chinese" | "japanese" | "spanish" | "custom";
export type UiLanguage = "en" | "zh";

export interface AppSettings {
  hotkey: string;
  uiLanguage: UiLanguage;
  transcriptionModel: string;
  polishModel: string;
  polishEnabled: boolean;
  languageMode: LanguageMode;
  customLanguage: string;
  pasteBehavior: PasteBehavior;
  restoreClipboard: boolean;
  launchAtStartup: boolean;
  historyEnabled: boolean;
}

export interface ProviderStatus {
  ok: boolean;
  message: string;
}

export interface DictationResult {
  transcript: string;
  polishedText: string;
  pasted: boolean;
  clipboardOnly: boolean;
}

export interface SettingsPayload {
  settings: AppSettings;
  hasApiKey: boolean;
}
