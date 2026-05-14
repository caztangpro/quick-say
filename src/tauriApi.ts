import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import type { AppSettings, DictationResult, ProviderStatus, SettingsPayload } from "./types";

export async function loadSettings(): Promise<SettingsPayload> {
  if (!isTauriRuntime()) {
    return {
      settings: DEFAULT_SETTINGS,
      hasApiKey: false,
    };
  }

  return invoke<SettingsPayload>("load_settings");
}

export async function saveSettings(settings: AppSettings, apiKey?: string): Promise<SettingsPayload> {
  if (!isTauriRuntime()) {
    return {
      settings: normalizeSettings(settings),
      hasApiKey: Boolean(apiKey?.trim()),
    };
  }

  return invoke<SettingsPayload>("save_settings", {
    payload: {
      settings,
      apiKey: apiKey?.trim() || null,
    },
  });
}

export async function startRecording(): Promise<void> {
  if (!isTauriRuntime()) {
    throw desktopOnlyError("Recording");
  }

  return invoke("start_recording");
}

export async function stopRecording(): Promise<DictationResult> {
  if (!isTauriRuntime()) {
    throw desktopOnlyError("Recording");
  }

  return invoke<DictationResult>("stop_recording");
}

export async function cancelRecording(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  return invoke("cancel_recording");
}

export async function pasteText(text: string): Promise<DictationResult> {
  if (!isTauriRuntime()) {
    return {
      transcript: text,
      polishedText: text,
      pasted: false,
      clipboardOnly: true,
    };
  }

  return invoke<DictationResult>("paste_text", { text });
}

export async function testProvider(apiKey?: string): Promise<ProviderStatus> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      message: "Provider test runs inside the Quick Say desktop app.",
    };
  }

  return invoke<ProviderStatus>("test_provider", { apiKey: apiKey?.trim() || null });
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return "__TAURI_INTERNALS__" in window;
}

function desktopOnlyError(action: string): Error {
  return new Error(`${action} runs inside the Quick Say desktop app.`);
}
