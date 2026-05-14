import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, DictationResult, ProviderStatus, SettingsPayload } from "./types";

export async function loadSettings(): Promise<SettingsPayload> {
  return invoke<SettingsPayload>("load_settings");
}

export async function saveSettings(settings: AppSettings, apiKey?: string): Promise<SettingsPayload> {
  return invoke<SettingsPayload>("save_settings", {
    payload: {
      settings,
      apiKey: apiKey?.trim() || null,
    },
  });
}

export async function startRecording(): Promise<void> {
  return invoke("start_recording");
}

export async function stopRecording(): Promise<DictationResult> {
  return invoke<DictationResult>("stop_recording");
}

export async function cancelRecording(): Promise<void> {
  return invoke("cancel_recording");
}

export async function pasteText(text: string): Promise<DictationResult> {
  return invoke<DictationResult>("paste_text", { text });
}

export async function testProvider(apiKey?: string): Promise<ProviderStatus> {
  return invoke<ProviderStatus>("test_provider", { apiKey: apiKey?.trim() || null });
}
