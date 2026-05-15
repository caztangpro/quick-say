import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  Clipboard,
  ClipboardCheck,
  Keyboard,
  Languages,
  Loader2,
  Maximize2,
  Mic,
  Minus,
  Moon,
  PlugZap,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  Wand2,
  X,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  cancelRecording,
  isTauriRuntime,
  loadSettings,
  saveSettings,
  startRecording,
  stopRecording,
  testProvider,
} from "./tauriApi";
import {
  DEFAULT_SETTINGS,
  formatHotkeyFromKeyboardEvent,
  normalizeSettings,
  validateSettings,
} from "./settings";
import { type AppMessage, getMessages, renderMessage } from "./i18n";
import type { AppSettings, DictationResult, DictationStatus } from "./types";
import { clampVoiceLevel, getRecordingDisplayLevel, getVoiceVisualLevel } from "./voiceLevel";

const WAVE_BARS = [0.22, 0.48, 0.72, 0.95, 0.64, 0.38, 0.78, 0.52, 0.28];
const quickSayLogoUrl = new URL("./assets/quick-say-logo.png", import.meta.url).href;

function getVoiceStyle(status: DictationStatus, level: number): CSSProperties {
  const visualLevel = getVoiceVisualLevel(status, level);

  return {
    "--voice-level": visualLevel.toFixed(3),
    "--voice-meter": `${Math.round(visualLevel * 100)}%`,
    "--voice-glow": (0.16 + visualLevel * 0.42).toFixed(3),
    "--voice-ring-scale": (1 + visualLevel * 0.08).toFixed(3),
  } as CSSProperties;
}

function getVoiceIntensityLabel(
  status: DictationStatus,
  level: number,
  locale: ReturnType<typeof getMessages>,
) {
  if (status !== "recording") {
    return locale.status[status];
  }

  const displayLevel = getRecordingDisplayLevel(level);

  if (displayLevel < 0.3) {
    return locale.ui.voiceIntensityQuiet;
  }

  if (displayLevel < 0.78) {
    return locale.ui.voiceIntensityClear;
  }

  return locale.ui.voiceIntensityStrong;
}

function getVoiceIntensityValue(
  status: DictationStatus,
  level: number,
  locale: ReturnType<typeof getMessages>,
) {
  return getVoiceIntensityLabel(status, level, locale);
}

function App() {
  const isVoiceOverlay = useMemo(
    () => new URLSearchParams(window.location.search).get("view") === "voice-overlay",
    [],
  );
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [message, setMessage] = useState<AppMessage>({ key: "initial" });
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [lastResult, setLastResult] = useState<DictationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [capturingHotkey, setCapturingHotkey] = useState(false);
  const statusRef = useRef(status);
  const apiKeyRef = useRef(apiKey);
  const hasApiKeyRef = useRef(hasApiKey);
  const capturingHotkeyRef = useRef(capturingHotkey);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);

  const locale = useMemo(() => getMessages(settings.uiLanguage), [settings.uiLanguage]);
  const validationErrors = useMemo(
    () => validateSettings(settings, locale.validation),
    [locale.validation, settings],
  );
  const messageText = useMemo(() => renderMessage(message, locale), [locale, message]);
  const canRecord = hasApiKey || apiKey.trim().length > 0;
  const hasCredential = hasApiKey || apiKey.trim().length > 0;
  const isDarkMode = settings.themeMode === "dark";
  const isProcessing = status === "transcribing" || status === "polishing";
  const isCancellable = status === "recording" || isProcessing;
  const themeToggleLabel = isDarkMode ? locale.ui.switchToLightMode : locale.ui.switchToDarkMode;
  const voiceStyle = getVoiceStyle(status, voiceLevel);
  const voiceIntensityValue = getVoiceIntensityValue(status, voiceLevel, locale);
  const activeWorkflowIndex =
    status === "recording" ? 1 : isProcessing ? 2 : status === "pasted" ? 3 : 0;
  const workflowSteps = [
    { icon: <Keyboard size={15} />, label: locale.ui.workflowCue },
    { icon: <Mic size={15} />, label: locale.ui.workflowCapture },
    { icon: <Sparkles size={15} />, label: locale.ui.workflowRefine },
    { icon: <ClipboardCheck size={15} />, label: locale.ui.workflowPlace },
  ];

  useEffect(() => {
    statusRef.current = status;
    apiKeyRef.current = apiKey;
    hasApiKeyRef.current = hasApiKey;
    capturingHotkeyRef.current = capturingHotkey;
  }, [apiKey, capturingHotkey, hasApiKey, status]);

  useEffect(() => {
    document.documentElement.lang = settings.uiLanguage === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.theme = settings.themeMode;
    document.documentElement.style.colorScheme = settings.themeMode;
    document.body.classList.toggle("overlay-body", isVoiceOverlay);

    return () => {
      document.body.classList.remove("overlay-body");
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.colorScheme = "";
    };
  }, [isVoiceOverlay, settings.themeMode, settings.uiLanguage]);

  useEffect(() => {
    void loadSettings()
      .then((payload) => {
        setSettings(normalizeSettings(payload.settings));
        setHasApiKey(payload.hasApiKey);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(readableError(error));
      });

    if (!isTauriRuntime()) {
      return;
    }

    const unsubscribers = [
      listen("recording_started", () => {
        setStatus("recording");
        setVoiceLevel(0.04);
        setMessage({ key: "recordingStarted" });
      }),
      listen("recording_stopped", () => {
        setStatus("transcribing");
        setVoiceLevel(0.22);
        setMessage({ key: "recordingStopped" });
      }),
      listen<string>("transcription_progress", (event) => {
        const phase = event.payload === "polishing" ? "polishing" : "transcribing";
        setStatus(phase);
        setVoiceLevel(0.22);
        setMessage({ key: phase === "polishing" ? "transcriptionPolishing" : "transcriptionWorking" });
      }),
      listen<DictationResult>("paste_completed", (event) => {
        setStatus("pasted");
        setVoiceLevel(0);
        setLastResult(event.payload);
        setMessage({ key: event.payload.clipboardOnly ? "clipboardOnly" : "inserted" });
      }),
      listen<string>("dictation_error", (event) => {
        setStatus("error");
        setVoiceLevel(0);
        setMessage({ text: event.payload });
      }),
      listen("dictation_cancelled", () => {
        setStatus("idle");
        setVoiceLevel(0);
        setMessage({ key: "recordingCancelled" });
      }),
      listen<number>("voice_level", (event) => {
        setVoiceLevel(clampVoiceLevel(event.payload));
      }),
    ];

    if (!isVoiceOverlay) {
      unsubscribers.push(listen("quick_say_hotkey", () => {
        void handleHotkeyToggle();
      }));
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        void unsubscribe.then((fn) => fn());
      });
    };
  }, [isVoiceOverlay]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || capturingHotkeyRef.current) {
        return;
      }

      if (!["recording", "transcribing", "polishing"].includes(statusRef.current)) {
        return;
      }

      event.preventDefault();
      void handleCancel();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  async function handleHotkeyToggle() {
    try {
      if (statusRef.current === "recording") {
        const result = await stopRecording();
        setLastResult(result);
        setStatus("pasted");
        setMessage({ key: result.clipboardOnly ? "clipboardOnly" : "inserted" });
        return;
      }

      if (!hasApiKeyRef.current && !apiKeyRef.current.trim()) {
        setStatus("error");
        setMessage({ key: "missingApiKey" });
        return;
      }

      await startRecording();
    } catch (error) {
      if (isCancellationError(error)) {
        setStatus("idle");
        setVoiceLevel(0);
        setMessage({ key: "recordingCancelled" });
        return;
      }

      setStatus("error");
      setMessage(readableError(error));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = await saveSettings(settings, apiKey);
      setSettings(normalizeSettings(payload.settings));
      setHasApiKey(payload.hasApiKey);
      setApiKey("");
      setStatus("idle");
      setMessage({ key: "settingsSaved" });
    } catch (error) {
      setStatus("error");
      setMessage(readableError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestProvider() {
    setTesting(true);
    try {
      const result = await testProvider(apiKey);
      setStatus(result.ok ? "idle" : "error");
      setMessage(result.ok ? { key: "providerWorks" } : { text: result.message });
    } catch (error) {
      setStatus("error");
      setMessage(readableError(error));
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleRecording() {
    try {
      if (status === "recording") {
        const result = await stopRecording();
        setLastResult(result);
        setStatus("pasted");
        setMessage({ key: result.clipboardOnly ? "clipboardOnly" : "inserted" });
        return;
      }

      if (!canRecord) {
        setStatus("error");
        setMessage({ key: "missingApiKey" });
        return;
      }

      if (apiKey.trim()) {
        await handleSave();
      }

      await startRecording();
    } catch (error) {
      if (isCancellationError(error)) {
        setStatus("idle");
        setVoiceLevel(0);
        setMessage({ key: "recordingCancelled" });
        return;
      }

      setStatus("error");
      setMessage(readableError(error));
    }
  }

  async function handleCancel() {
    try {
      await cancelRecording();
      setStatus("idle");
      setVoiceLevel(0);
      setMessage({ key: "recordingCancelled" });
    } catch (error) {
      setStatus("error");
      setMessage(readableError(error));
    }
  }

  function startHotkeyCapture() {
    setCapturingHotkey(true);
    setMessage({ key: "pressNewHotkey" });
    window.setTimeout(() => hotkeyButtonRef.current?.focus(), 0);
  }

  function handleHotkeyCapture(event: KeyboardEvent<HTMLButtonElement>) {
    if (!capturingHotkey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setCapturingHotkey(false);
      setMessage({ key: "hotkeyCancelled" });
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      setSettings((current) => ({ ...current, hotkey: DEFAULT_SETTINGS.hotkey }));
      setCapturingHotkey(false);
      setMessage({ key: "hotkeyReset" });
      return;
    }

    const nextHotkey = formatHotkeyFromKeyboardEvent(event);

    if (!nextHotkey) {
      setMessage({ key: "holdModifier" });
      return;
    }

    setSettings((current) => ({ ...current, hotkey: nextHotkey }));
    setCapturingHotkey(false);
    setMessage({ key: "hotkeySet", values: { hotkey: nextHotkey } });
  }

  function resetHotkey() {
    setSettings((current) => ({ ...current, hotkey: DEFAULT_SETTINGS.hotkey }));
    setCapturingHotkey(false);
    setMessage({ key: "hotkeyReset" });
  }

  function toggleThemeMode() {
    setSettings((current) => ({
      ...current,
      themeMode: current.themeMode === "dark" ? "light" : "dark",
    }));
  }

  if (isVoiceOverlay) {
    return <VoiceOverlay status={status} level={voiceLevel} message={messageText} locale={locale} />;
  }

  return (
    <div className="app-frame">
      <WindowTitleBar
        locale={locale}
        status={status}
        hasCredential={hasCredential}
        isDarkMode={isDarkMode}
        isProcessing={isProcessing}
        themeToggleLabel={themeToggleLabel}
        onToggleTheme={toggleThemeMode}
      />

      <main className="shell">
      <section className={`dictation-panel dictation-panel-${status}`} style={voiceStyle} aria-live="polite">
        <div className="record-stage">
          <span className="record-halo" aria-hidden="true" />
          <button
            className={`record-button record-button-${status}`}
            type="button"
            onClick={handleToggleRecording}
            disabled={isProcessing}
            aria-label={status === "recording" ? locale.ui.stopRecording : locale.ui.startRecording}
          >
            {status === "recording" ? <Square size={30} /> : isProcessing ? <Loader2 className="spin" size={30} /> : <Mic size={30} />}
          </button>
        </div>
        <div className="dictation-copy">
          <div className="dictation-meta">
            <span>{locale.ui.dictation}</span>
            <span className="hotkey-pill">
              <Keyboard size={14} />
              {settings.hotkey}
            </span>
          </div>
          <p>{messageText}</p>
          <VoiceWave status={status} level={voiceLevel} />
        </div>
        <div className="record-actions">
          <div className="intensity-card" aria-label={`${locale.ui.voiceIntensity}: ${voiceIntensityValue}`}>
            <span className="intensity-label">{locale.ui.voiceIntensity}</span>
            <strong>{voiceIntensityValue}</strong>
            <span className="intensity-meter" aria-hidden="true">
              <span />
            </span>
          </div>
          <span className={`record-state record-state-${status}`}>
            <Activity size={15} />
            {locale.status[status]}
          </span>
          {isCancellable && (
            <button className="secondary-button" type="button" onClick={handleCancel}>
              {locale.ui.cancel}
            </button>
          )}
        </div>
      </section>

      <section className="workflow" aria-label={locale.ui.workflow}>
        {workflowSteps.map((step, index) => (
          <div
            className={`workflow-step ${index === activeWorkflowIndex ? "is-active" : ""} ${
              index < activeWorkflowIndex ? "is-done" : ""
            }`}
            key={step.label}
          >
            <span className="workflow-icon">{step.icon}</span>
            <span>{step.label}</span>
          </div>
        ))}
      </section>

      <div className="content-grid">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <span className="panel-icon">
              <SlidersHorizontal size={19} />
            </span>
            <h2>{locale.ui.settings}</h2>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <PlugZap size={17} />
              <span>{locale.ui.connection}</span>
            </div>
            <label>
              {locale.ui.apiKey}
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={hasApiKey ? locale.ui.apiKeyStored : "sk-..."}
              />
            </label>
          </div>

          <div className="form-section">
            <div className="section-heading">
              <Languages size={17} />
              <span>{locale.ui.voiceAndLanguage}</span>
            </div>
            <div className="field-row">
              <label>
                {locale.ui.interfaceLanguage}
                <select
                  value={settings.uiLanguage}
                  onChange={(event) => setSettings({ ...settings, uiLanguage: event.target.value as AppSettings["uiLanguage"] })}
                >
                  <option value="en">{locale.uiLanguage.en}</option>
                  <option value="zh">{locale.uiLanguage.zh}</option>
                </select>
              </label>
              <label>
                {locale.ui.hotkey}
                <div className="hotkey-field">
                  <button
                    ref={hotkeyButtonRef}
                    className={`hotkey-capture ${capturingHotkey ? "is-capturing" : ""}`}
                    type="button"
                    onClick={startHotkeyCapture}
                    onKeyDown={handleHotkeyCapture}
                    onBlur={() => setCapturingHotkey(false)}
                    aria-pressed={capturingHotkey}
                  >
                    <Keyboard size={18} />
                    <span>{capturingHotkey ? locale.ui.pressKeys : settings.hotkey}</span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={resetHotkey}
                    aria-label={locale.ui.resetHotkey}
                    title={locale.ui.resetHotkey}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </label>
            </div>

            <div className="field-row field-row-single">
              <label>
                {locale.ui.dictationLanguage}
                <select
                  value={settings.languageMode}
                  onChange={(event) => setSettings({ ...settings, languageMode: event.target.value as AppSettings["languageMode"] })}
                >
                  <option value="auto">{locale.dictationLanguage.auto}</option>
                  <option value="english">{locale.dictationLanguage.english}</option>
                  <option value="chinese">{locale.dictationLanguage.chinese}</option>
                  <option value="japanese">{locale.dictationLanguage.japanese}</option>
                  <option value="spanish">{locale.dictationLanguage.spanish}</option>
                  <option value="custom">{locale.dictationLanguage.custom}</option>
                </select>
              </label>
            </div>

            {settings.languageMode === "custom" && (
              <label>
                {locale.ui.customLanguage}
                <input
                  value={settings.customLanguage}
                  onChange={(event) => setSettings({ ...settings, customLanguage: event.target.value })}
                />
              </label>
            )}
          </div>

          <div className="form-section">
            <div className="section-heading">
              <Sparkles size={17} />
              <span>{locale.ui.modelsAndOutput}</span>
            </div>
            <div className="field-row">
              <label>
                {locale.ui.transcriptionModel}
                <input
                  value={settings.transcriptionModel}
                  onChange={(event) => setSettings({ ...settings, transcriptionModel: event.target.value })}
                />
              </label>
              <label>
                {locale.ui.polishModel}
                <input
                  value={settings.polishModel}
                  onChange={(event) => setSettings({ ...settings, polishModel: event.target.value })}
                  disabled={!settings.polishEnabled}
                />
              </label>
            </div>

            <div className="toggles">
              <label>
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={(event) => setSettings({ ...settings, themeMode: event.target.checked ? "dark" : "light" })}
                />
                <span>{locale.ui.darkMode}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.polishEnabled}
                  onChange={(event) => setSettings({ ...settings, polishEnabled: event.target.checked })}
                />
                <span>{locale.ui.polishToggle}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.restoreClipboard}
                  onChange={(event) => setSettings({ ...settings, restoreClipboard: event.target.checked })}
                />
                <span>{locale.ui.restoreClipboard}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.historyEnabled}
                  onChange={(event) => setSettings({ ...settings, historyEnabled: event.target.checked })}
                />
                <span>{locale.ui.historyToggle}</span>
              </label>
            </div>

            <label>
              {locale.ui.pasteBehavior}
              <select
                value={settings.pasteBehavior}
                onChange={(event) => setSettings({ ...settings, pasteBehavior: event.target.value as AppSettings["pasteBehavior"] })}
              >
                <option value="auto">{locale.pasteBehavior.auto}</option>
                <option value="clipboard_only">{locale.pasteBehavior.clipboard_only}</option>
              </select>
            </label>
          </div>

          {validationErrors.length > 0 && (
            <div className="validation" role="alert">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}

          <div className="actions">
            <button type="button" onClick={handleSave} disabled={saving || validationErrors.length > 0}>
              {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              {locale.ui.save}
            </button>
            <button className="secondary-button" type="button" onClick={handleTestProvider} disabled={testing}>
              {testing ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
              {locale.ui.test}
            </button>
          </div>
        </section>

        <section className="panel result-panel">
          <div className="panel-heading">
            <span className="panel-icon">
              <Clipboard size={19} />
            </span>
            <h2>{locale.ui.lastDictation}</h2>
          </div>
          {lastResult ? (
            <>
              <div className="result-block">
                <span>{locale.ui.transcript}</span>
                <p>{lastResult.transcript || locale.ui.noTranscript}</p>
              </div>
              <div className="result-block">
                <span>{locale.ui.finalText}</span>
                <p>{lastResult.polishedText || locale.ui.noFinalText}</p>
              </div>
            </>
          ) : (
            <div className="empty">
              <ClipboardCheck size={28} />
              <p>{locale.ui.emptyResult}</p>
            </div>
          )}
        </section>
      </div>
      </main>
    </div>
  );
}

interface WindowTitleBarProps {
  locale: ReturnType<typeof getMessages>;
  status: DictationStatus;
  hasCredential: boolean;
  isDarkMode: boolean;
  isProcessing: boolean;
  themeToggleLabel: string;
  onToggleTheme: () => void;
}

function WindowTitleBar({
  locale,
  status,
  hasCredential,
  isDarkMode,
  isProcessing,
  themeToggleLabel,
  onToggleTheme,
}: WindowTitleBarProps) {
  const showWindowControls = isTauriRuntime();

  function runWindowAction(action: (window: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
    if (!showWindowControls) {
      return;
    }

    void action(getCurrentWindow()).catch(() => undefined);
  }

  const statusIcon =
    status === "recording" ? (
      <Mic size={16} />
    ) : status === "error" ? (
      <AlertCircle size={16} />
    ) : isProcessing ? (
      <Loader2 className="spin" size={16} />
    ) : (
      <Check size={16} />
    );

  return (
    <header className="window-titlebar">
      <div
        className="window-titlebar-drag"
        data-tauri-drag-region=""
        onDoubleClick={() => runWindowAction((window) => window.toggleMaximize())}
      >
        <div className="window-titlebar-brand" data-tauri-drag-region="">
          <span className="titlebar-mark" data-tauri-drag-region="" aria-hidden="true">
            <img src={quickSayLogoUrl} alt="" data-tauri-drag-region="" />
          </span>
          <span className="window-titlebar-name" data-tauri-drag-region="">
            {locale.ui.appName}
          </span>
        </div>
        <div className="window-titlebar-center" data-tauri-drag-region="">
          <span data-tauri-drag-region="">{locale.ui.title}</span>
        </div>
      </div>

      <div className="window-titlebar-actions">
        <button
          className="theme-switch"
          type="button"
          onClick={onToggleTheme}
          aria-label={themeToggleLabel}
          aria-pressed={isDarkMode}
          title={themeToggleLabel}
        >
          {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className={`credential ${hasCredential ? "is-ready" : "is-missing"}`}>
          <ShieldCheck size={16} />
          <span>{hasCredential ? locale.ui.apiKeyReady : locale.ui.apiKeyMissing}</span>
        </div>
        <div className={`status status-${status}`}>
          {statusIcon}
          <span>{locale.status[status]}</span>
        </div>
        {showWindowControls && (
          <div className="window-controls" aria-label={locale.ui.windowControls}>
            <button
              className="window-control"
              type="button"
              onClick={() => runWindowAction((window) => window.minimize())}
              aria-label={locale.ui.minimizeWindow}
              title={locale.ui.minimizeWindow}
            >
              <Minus size={16} />
            </button>
            <button
              className="window-control"
              type="button"
              onClick={() => runWindowAction((window) => window.toggleMaximize())}
              aria-label={locale.ui.toggleMaximizeWindow}
              title={locale.ui.toggleMaximizeWindow}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="window-control window-control-close"
              type="button"
              onClick={() => runWindowAction((window) => window.hide())}
              aria-label={locale.ui.hideWindow}
              title={locale.ui.hideWindow}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

interface VoiceOverlayProps {
  status: DictationStatus;
  level: number;
  message: string;
  locale: ReturnType<typeof getMessages>;
}

function VoiceOverlay({ status, level, message, locale }: VoiceOverlayProps) {
  const isWorking = status === "transcribing" || status === "polishing";
  const voiceStyle = getVoiceStyle(status, level);
  const voiceIntensityValue = getVoiceIntensityValue(status, level, locale);

  return (
    <main className={`voice-overlay voice-overlay-${status}`} style={voiceStyle} aria-live="polite">
      <div className="voice-mark">
        {isWorking ? <Loader2 className="spin" size={22} /> : status === "error" ? <AlertCircle size={22} /> : status === "pasted" ? <Check size={22} /> : <Mic size={22} />}
      </div>
      <div className="voice-copy">
        <p>{locale.status[status]}</p>
        <span>{message}</span>
      </div>
      <div className="voice-tooltip-meter" aria-label={`${locale.ui.voiceIntensity}: ${voiceIntensityValue}`}>
        <span className="voice-tooltip-label">{locale.ui.voiceIntensity}</span>
        <strong>{voiceIntensityValue}</strong>
        <span className="voice-tooltip-rail" aria-hidden="true">
          <span />
        </span>
      </div>
      <VoiceWave status={status} level={level} compact />
    </main>
  );
}

interface VoiceWaveProps {
  status: DictationStatus;
  level: number;
  compact?: boolean;
}

function VoiceWave({ status, level, compact = false }: VoiceWaveProps) {
  const displayLevel = getVoiceVisualLevel(status, level);

  return (
    <div
      className={`voice-wave voice-wave-${status} ${compact ? "voice-wave-compact" : ""}`}
      style={getVoiceStyle(status, level)}
      aria-hidden="true"
    >
      {WAVE_BARS.map((weight, index) => (
        <span
          key={`${weight}-${index}`}
          style={{
            "--wave-scale": (0.22 + displayLevel * weight * 2.4).toFixed(3),
            "--wave-delay": `${index * 42}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

function readableError(error: unknown): AppMessage {
  if (typeof error === "string") {
    return { text: error };
  }

  if (error instanceof Error) {
    return { text: error.message };
  }

  return { key: "genericError" };
}

function isCancellationError(error: unknown): boolean {
  const message =
    typeof error === "string" ? error : error instanceof Error ? error.message : "";

  return message.toLowerCase().includes("cancelled");
}

export default App;
