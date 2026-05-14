import type { SettingsValidationMessages } from "./settings";
import type { DictationStatus, LanguageMode, PasteBehavior, UiLanguage } from "./types";

export interface LocaleMessages {
  status: Record<DictationStatus, string>;
  ui: {
    appName: string;
    title: string;
    settings: string;
    apiKey: string;
    apiKeyStored: string;
    apiKeyReady: string;
    apiKeyMissing: string;
    hotkey: string;
    interfaceLanguage: string;
    dictationLanguage: string;
    dictation: string;
    customLanguage: string;
    transcriptionModel: string;
    polishModel: string;
    connection: string;
    voiceAndLanguage: string;
    modelsAndOutput: string;
    polishToggle: string;
    darkMode: string;
    restoreClipboard: string;
    historyToggle: string;
    pasteBehavior: string;
    save: string;
    test: string;
    cancel: string;
    lastDictation: string;
    transcript: string;
    finalText: string;
    noTranscript: string;
    noFinalText: string;
    emptyResult: string;
    startRecording: string;
    stopRecording: string;
    resetHotkey: string;
    pressKeys: string;
    switchToLightMode: string;
    switchToDarkMode: string;
    workflow: string;
    workflowCue: string;
    workflowCapture: string;
    workflowRefine: string;
    workflowPlace: string;
    voiceIntensity: string;
    voiceIntensityQuiet: string;
    voiceIntensityClear: string;
    voiceIntensityStrong: string;
  };
  uiLanguage: Record<UiLanguage, string>;
  dictationLanguage: Record<LanguageMode, string>;
  pasteBehavior: Record<PasteBehavior, string>;
  validation: SettingsValidationMessages;
  messages: {
    initial: string;
    recordingStarted: string;
    recordingStopped: string;
    transcriptionWorking: string;
    transcriptionPolishing: string;
    clipboardOnly: string;
    inserted: string;
    missingApiKey: string;
    settingsSaved: string;
    recordingCancelled: string;
    pressNewHotkey: string;
    hotkeyCancelled: string;
    hotkeyReset: string;
    holdModifier: string;
    hotkeySet: string;
    providerWorks: string;
    genericError: string;
  };
}

export type MessageKey = keyof LocaleMessages["messages"];

export type AppMessage =
  | {
      key: MessageKey;
      values?: Record<string, string>;
    }
  | {
      text: string;
    };

const LOCALES: Record<UiLanguage, LocaleMessages> = {
  en: {
    status: {
      idle: "Ready",
      recording: "Listening",
      transcribing: "Transcribing",
      polishing: "Polishing",
      pasted: "Inserted",
      error: "Needs attention",
    },
    ui: {
      appName: "Quick Say",
      title: "Voice to cursor, on your terms.",
      settings: "Settings",
      apiKey: "SiliconFlow API key",
      apiKeyStored: "Stored in OS keyring",
      apiKeyReady: "Key secured",
      apiKeyMissing: "Key needed",
      hotkey: "Hotkey",
      interfaceLanguage: "Interface language",
      dictationLanguage: "Dictation language",
      dictation: "Dictation",
      customLanguage: "Custom language",
      transcriptionModel: "Transcription model",
      polishModel: "Polish model",
      connection: "Connection",
      voiceAndLanguage: "Voice & language",
      modelsAndOutput: "Models & output",
      polishToggle: "Polish punctuation and casing",
      darkMode: "Dark mode",
      restoreClipboard: "Restore clipboard after paste",
      historyToggle: "Keep local text history",
      pasteBehavior: "Paste behavior",
      save: "Save",
      test: "Test",
      cancel: "Cancel",
      lastDictation: "Last Dictation",
      transcript: "Transcript",
      finalText: "Final text",
      noTranscript: "No transcript returned.",
      noFinalText: "No final text returned.",
      emptyResult: "Your next dictation will appear here.",
      startRecording: "Start recording",
      stopRecording: "Stop recording",
      resetHotkey: "Reset hotkey",
      pressKeys: "Press keys",
      switchToLightMode: "Switch to light mode",
      switchToDarkMode: "Switch to dark mode",
      workflow: "Dictation workflow",
      workflowCue: "Cue",
      workflowCapture: "Capture",
      workflowRefine: "Refine",
      workflowPlace: "Place",
      voiceIntensity: "Intensity",
      voiceIntensityQuiet: "Quiet",
      voiceIntensityClear: "Clear",
      voiceIntensityStrong: "Strong",
    },
    uiLanguage: {
      en: "English",
      zh: "中文",
    },
    dictationLanguage: {
      auto: "Auto",
      english: "English",
      chinese: "Chinese",
      japanese: "Japanese",
      spanish: "Spanish",
      custom: "Custom",
    },
    pasteBehavior: {
      auto: "Auto paste",
      clipboard_only: "Clipboard only",
    },
    validation: {
      hotkeyIncomplete: "Hotkey must include a modifier and a key.",
      transcriptionModelRequired: "Transcription model is required.",
      polishModelRequired: "Polish model is required when polishing is enabled.",
      customLanguageRequired: "Custom language is required when custom language mode is selected.",
    },
    messages: {
      initial: "Press the hotkey or use the microphone button.",
      recordingStarted: "Speak naturally. Press stop when you are done.",
      recordingStopped: "Audio captured. Sending it for transcription.",
      transcriptionWorking: "Working on the transcript.",
      transcriptionPolishing: "Cleaning up punctuation and casing.",
      clipboardOnly: "Text is on the clipboard.",
      inserted: "Text inserted at the cursor.",
      missingApiKey: "Add a SiliconFlow API key before recording.",
      settingsSaved: "Settings saved.",
      recordingCancelled: "Dictation cancelled.",
      pressNewHotkey: "Press the new hotkey.",
      hotkeyCancelled: "Hotkey change cancelled.",
      hotkeyReset: "Hotkey reset. Save to apply.",
      holdModifier: "Hold a modifier, then press a key.",
      hotkeySet: "Hotkey set to {hotkey}. Save to apply.",
      providerWorks: "Provider connection works.",
      genericError: "Something went wrong.",
    },
  },
  zh: {
    status: {
      idle: "就绪",
      recording: "聆听中",
      transcribing: "转写中",
      polishing: "润色中",
      pasted: "已插入",
      error: "需要处理",
    },
    ui: {
      appName: "Quick Say",
      title: "语音直达光标，由你掌控。",
      settings: "设置",
      apiKey: "SiliconFlow API 密钥",
      apiKeyStored: "已存入系统钥匙串",
      apiKeyReady: "密钥已保护",
      apiKeyMissing: "需要密钥",
      hotkey: "快捷键",
      interfaceLanguage: "界面语言",
      dictationLanguage: "听写语言",
      dictation: "听写",
      customLanguage: "自定义语言",
      transcriptionModel: "转写模型",
      polishModel: "润色模型",
      connection: "连接",
      voiceAndLanguage: "语音和语言",
      modelsAndOutput: "模型和输出",
      polishToggle: "润色标点和大小写",
      darkMode: "深色模式",
      restoreClipboard: "粘贴后恢复剪贴板",
      historyToggle: "保留本地文本历史",
      pasteBehavior: "粘贴方式",
      save: "保存",
      test: "测试",
      cancel: "取消",
      lastDictation: "最近一次听写",
      transcript: "转写文本",
      finalText: "最终文本",
      noTranscript: "没有返回转写文本。",
      noFinalText: "没有返回最终文本。",
      emptyResult: "下一次听写会显示在这里。",
      startRecording: "开始录音",
      stopRecording: "停止录音",
      resetHotkey: "重置快捷键",
      pressKeys: "按下按键",
      switchToLightMode: "切换到浅色模式",
      switchToDarkMode: "切换到深色模式",
      workflow: "听写流程",
      workflowCue: "触发",
      workflowCapture: "采集",
      workflowRefine: "整理",
      workflowPlace: "放置",
      voiceIntensity: "语音强度",
      voiceIntensityQuiet: "偏弱",
      voiceIntensityClear: "清晰",
      voiceIntensityStrong: "偏强",
    },
    uiLanguage: {
      en: "English",
      zh: "中文",
    },
    dictationLanguage: {
      auto: "自动",
      english: "英语",
      chinese: "中文",
      japanese: "日语",
      spanish: "西班牙语",
      custom: "自定义",
    },
    pasteBehavior: {
      auto: "自动粘贴",
      clipboard_only: "仅复制到剪贴板",
    },
    validation: {
      hotkeyIncomplete: "快捷键必须包含修饰键和普通按键。",
      transcriptionModelRequired: "请填写转写模型。",
      polishModelRequired: "启用润色时请填写润色模型。",
      customLanguageRequired: "选择自定义语言时，请填写语言名称。",
    },
    messages: {
      initial: "按下快捷键，或使用麦克风按钮开始。",
      recordingStarted: "自然说话。完成后按停止。",
      recordingStopped: "已录音，正在发送转写。",
      transcriptionWorking: "正在生成转写文本。",
      transcriptionPolishing: "正在整理标点和大小写。",
      clipboardOnly: "文本已复制到剪贴板。",
      inserted: "文本已插入到光标位置。",
      missingApiKey: "录音前请先添加 SiliconFlow API 密钥。",
      settingsSaved: "设置已保存。",
      recordingCancelled: "听写已取消。",
      pressNewHotkey: "按下新的快捷键。",
      hotkeyCancelled: "已取消修改快捷键。",
      hotkeyReset: "快捷键已重置。保存后生效。",
      holdModifier: "按住修饰键，然后按一个普通按键。",
      hotkeySet: "快捷键已设为 {hotkey}。保存后生效。",
      providerWorks: "服务连接正常。",
      genericError: "出了点问题。",
    },
  },
};

export function getMessages(language: UiLanguage): LocaleMessages {
  return LOCALES[language] ?? LOCALES.en;
}

export function renderMessage(message: AppMessage, locale: LocaleMessages): string {
  if ("text" in message) {
    return message.text;
  }

  return formatMessage(locale.messages[message.key], message.values);
}

function formatMessage(template: string, values: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}
