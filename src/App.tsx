import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Keyboard,
  KeyRound,
  Loader2,
  Mic,
  RotateCcw,
  Save,
  Square,
  Wand2,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import {
  cancelRecording,
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
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);

  const locale = useMemo(() => getMessages(settings.uiLanguage), [settings.uiLanguage]);
  const validationErrors = useMemo(
    () => validateSettings(settings, locale.validation),
    [locale.validation, settings],
  );
  const messageText = useMemo(() => renderMessage(message, locale), [locale, message]);
  const canRecord = hasApiKey || apiKey.trim().length > 0;

  useEffect(() => {
    statusRef.current = status;
    apiKeyRef.current = apiKey;
    hasApiKeyRef.current = hasApiKey;
  }, [apiKey, hasApiKey, status]);

  useEffect(() => {
    document.documentElement.lang = settings.uiLanguage === "zh" ? "zh-CN" : "en";
    document.body.classList.toggle("overlay-body", isVoiceOverlay);

    return () => {
      document.body.classList.remove("overlay-body");
    };
  }, [isVoiceOverlay, settings.uiLanguage]);

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
      listen<number>("voice_level", (event) => {
        setVoiceLevel(Math.max(0, Math.min(1, event.payload)));
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

  if (isVoiceOverlay) {
    return <VoiceOverlay status={status} level={voiceLevel} message={messageText} locale={locale} />;
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">{locale.ui.appName}</p>
          <h1>{locale.ui.title}</h1>
        </div>
        <div className={`status status-${status}`}>
          {status === "recording" ? <Mic size={18} /> : status === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{locale.status[status]}</span>
        </div>
      </section>

      <section className="dictation-panel">
        <button
          className="record-button"
          type="button"
          onClick={handleToggleRecording}
          disabled={status === "transcribing" || status === "polishing"}
          aria-label={status === "recording" ? locale.ui.stopRecording : locale.ui.startRecording}
        >
          {status === "recording" ? <Square size={30} /> : status === "transcribing" || status === "polishing" ? <Loader2 className="spin" size={30} /> : <Mic size={30} />}
        </button>
        <div className="dictation-copy">
          <p>{messageText}</p>
          <span>{settings.hotkey}</span>
        </div>
        {status === "recording" && (
          <button className="secondary-button" type="button" onClick={handleCancel}>
            {locale.ui.cancel}
          </button>
        )}
      </section>

      <div className="content-grid">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <KeyRound size={20} />
            <h2>{locale.ui.settings}</h2>
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

          <div className="field-row">
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
                checked={settings.polishEnabled}
                onChange={(event) => setSettings({ ...settings, polishEnabled: event.target.checked })}
              />
              {locale.ui.polishToggle}
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.restoreClipboard}
                onChange={(event) => setSettings({ ...settings, restoreClipboard: event.target.checked })}
              />
              {locale.ui.restoreClipboard}
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.historyEnabled}
                onChange={(event) => setSettings({ ...settings, historyEnabled: event.target.checked })}
              />
              {locale.ui.historyToggle}
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

          {validationErrors.length > 0 && (
            <div className="validation">
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
            <Clipboard size={20} />
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
            <p className="empty">{locale.ui.emptyResult}</p>
          )}
        </section>
      </div>
    </main>
  );
}

interface VoiceOverlayProps {
  status: DictationStatus;
  level: number;
  message: string;
  locale: ReturnType<typeof getMessages>;
}

function VoiceOverlay({ status, level, message, locale }: VoiceOverlayProps) {
  const bars = [0.22, 0.48, 0.72, 0.95, 0.64, 0.38, 0.78, 0.52, 0.28];
  const isWorking = status === "transcribing" || status === "polishing";
  const displayLevel = status === "recording" ? Math.max(level, 0.06) : isWorking ? 0.28 : 0.08;

  return (
    <main className={`voice-overlay voice-overlay-${status}`} aria-live="polite">
      <div className="voice-mark">
        {isWorking ? <Loader2 className="spin" size={22} /> : status === "error" ? <AlertCircle size={22} /> : status === "pasted" ? <Check size={22} /> : <Mic size={22} />}
      </div>
      <div className="voice-copy">
        <p>{locale.status[status]}</p>
        <span>{message}</span>
      </div>
      <div className="voice-wave" aria-hidden="true">
        {bars.map((weight, index) => (
          <span
            key={weight}
            style={{
              "--wave-scale": (0.22 + displayLevel * weight * 2.4).toFixed(3),
              "--wave-delay": `${index * 42}ms`,
            } as CSSProperties}
          />
        ))}
      </div>
    </main>
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

export default App;
