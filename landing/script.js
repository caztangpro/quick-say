const root = document.documentElement;
root.classList.add("js");

const LANGUAGE_STORAGE_KEY = "quick-say-landing-language";
const supportedLanguages = ["en", "zh"];

const translations = {
  en: {
    lang: "en",
    meta: {
      title: "Quick Say - Local-first desktop dictation",
      description:
        "Quick Say is a free, local-first desktop dictation app. Press a global hotkey, speak naturally, and paste polished text anywhere.",
      ogTitle: "Quick Say - Local-first desktop dictation",
      ogDescription:
        "Press a global hotkey, speak naturally, and Quick Say transcribes, optionally polishes, then pastes the text where you are working.",
    },
    navToggle: {
      open: "Open navigation",
      close: "Close navigation",
    },
    text: {
      ".skip-link": "Skip to main content",
      ".site-nav a[href='#privacy']": "Privacy",
      ".site-nav a[href='#workflow']": "Workflow",
      ".site-nav a[href='#setup']": "Setup",
      ".site-nav .nav-cta": "GitHub source",
      ".hero .eyebrow": "Free desktop dictation for your own workflow",
      "#hero-title": "Talk anywhere. Keep the keys to yourself.",
      ".hero__lede":
        "Quick Say turns a global hotkey into polished text at your cursor. It runs as a compact Tauri desktop app, stores settings locally, and uses your own SiliconFlow API key.",
      ".hero__actions .button--primary span": "Get the source",
      ".hero__actions .button--ghost span": "See the flow",
      "#why-title": "A voice tool that behaves like a personal utility.",
      "#why-title + p":
        "Quick Say is built for people who want the speed of dictation without signing into another hosted writing product.",
      ".section--light:not(.product-section) .section__header .eyebrow": "Why it exists",
      ".feature-card:nth-child(1) h3": "Fast capture",
      ".feature-card:nth-child(1) p":
        "Start dictation from the keyboard or microphone button, then return to the app you were using.",
      ".feature-card:nth-child(2) h3": "Local-first privacy",
      ".feature-card:nth-child(2) p":
        "Preferences stay on-device, API keys go to the OS keyring, and temporary WAV files are cleaned up.",
      ".feature-card:nth-child(3) h3": "Text that lands cleanly",
      ".feature-card:nth-child(3) p":
        "Use transcription only, or let the polish step turn spoken thoughts into ready-to-paste text.",
      "#workflow .eyebrow": "Workflow",
      "#workflow-title": "A small loop for everyday writing.",
      "#workflow-title + p":
        "Quick Say keeps the main path short: capture voice, transcribe it, polish when useful, and send the result to your clipboard or active cursor.",
      "[data-replay-flow]": "Replay flow",
      ".timeline__item:nth-child(1) h3": "Press the global hotkey",
      ".timeline__item:nth-child(1) p":
        "Use CommandOrControl+Shift+Space, or start from the compact app window.",
      ".timeline__item:nth-child(2) h3": "Speak naturally",
      ".timeline__item:nth-child(2) p":
        "Audio is recorded temporarily, sent for transcription, then removed after processing.",
      ".timeline__item:nth-child(3) h3": "Paste or copy",
      ".timeline__item:nth-child(3) p":
        "Auto paste into the active app, or use clipboard-only mode when that is better.",
      ".product-section .eyebrow": "Desktop app",
      "#product-title": "Compact controls, visible settings, no account bundle.",
      "#product-title + p":
        "The app is intentionally plain-spoken: set your provider key, choose the model defaults, pick paste behavior, and dictate when you need it.",
      ".product-shot__title": "Quick Say desktop preview",
      ".product-shot__status": "Source build",
      ".product-shot figcaption":
        "Current early-development interface, framed around the main dictation path.",
      ".product-shot__notes li:nth-child(1) strong": "Hotkey-first",
      ".product-shot__notes li:nth-child(1) p": "Start capture from anywhere.",
      ".product-shot__notes li:nth-child(2) strong": "Visible settings",
      ".product-shot__notes li:nth-child(2) p":
        "Models and paste behavior stay easy to inspect.",
      ".product-shot__notes li:nth-child(3) strong": "Local control",
      ".product-shot__notes li:nth-child(3) p":
        "Bring your own key, no bundled account.",
      "#privacy .eyebrow": "Privacy model",
      "#privacy-title": "Private by architecture, clear about provider calls.",
      "#privacy-title + p":
        "Quick Say does not run a hosted backend or include a shared API account. Transcription and polishing still use your configured SiliconFlow account.",
      ".privacy-card:nth-child(1) h3": "Your key stays out of project files",
      ".privacy-card:nth-child(1) p":
        "API keys belong in the operating system keyring, not in logs or plaintext config.",
      ".privacy-card:nth-child(2) h3": "Temporary audio is temporary",
      ".privacy-card:nth-child(2) p":
        "Raw audio is only kept long enough to complete the dictation request, including error paths.",
      ".privacy-card:nth-child(3) h3": "No Quick Say telemetry",
      ".privacy-card:nth-child(3) p":
        "The project avoids analytics, tracking, bundled accounts, and hosted app services.",
      "#setup .eyebrow": "From source",
      "#setup-title": "Run it locally while packaged releases mature.",
      "#setup-title + p":
        "Quick Say is early, but the core flow works from source for contributors and curious users.",
      ".setup-card .button span": "Open README",
      ".final-cta .eyebrow": "Quick Say",
      "#final-title": "A dictation app you can inspect, run, and keep personal.",
      ".final-cta .button span": "View project on GitHub",
      ".site-footer p": "Quick Say is released under the MIT License.",
      ".site-footer a": "GitHub",
    },
    html: {
      ".proof-strip__inner p:nth-child(1)":
        "<strong>Hotkey</strong> CommandOrControl+Shift+Space.",
      ".proof-strip__inner p:nth-child(2)":
        "<strong>Store</strong> settings locally and keys in the OS keyring.",
      ".proof-strip__inner p:nth-child(3)":
        "<strong>Paste</strong> polished text without changing context.",
      ".setup-card li:nth-child(1)":
        "Install Node.js, pnpm 9.14.2, Rust, and Tauri v2 system dependencies.",
      ".setup-card li:nth-child(2)":
        "Clone the repository and run <code>pnpm install</code>.",
      ".setup-card li:nth-child(3)":
        "Start the desktop app with <code>pnpm tauri:dev</code>.",
      ".setup-card li:nth-child(4)":
        "Add your SiliconFlow API key in Settings, then press the hotkey.",
    },
    attrs: {
      ".brand": { "aria-label": "Quick Say home" },
      ".site-nav": { "aria-label": "Primary navigation" },
      ".language-switch": { "aria-label": "Language" },
      ".hero__image": {
        alt: "Quick Say desktop app window showing dictation controls and settings",
      },
      ".hero__actions": { "aria-label": "Primary actions" },
      ".proof-strip": { "aria-label": "Quick Say promise" },
      ".flow-demo": { "aria-label": "Animated dictation workflow" },
      ".timeline": { "aria-label": "Quick Say workflow steps" },
      ".product-shot__viewport img": {
        alt: "Quick Say application interface showing global hotkey dictation, provider settings, and the last dictation panel",
      },
      ".product-shot__notes": { "aria-label": "Screenshot highlights" },
    },
    flowStates: [
      {
        status: "Listening for speech",
        text: "Draft the release note for Quick Say and keep the tone calm.",
        step: 0,
        playing: true,
        delay: 1700,
      },
      {
        status: "Transcribing with SenseVoiceSmall",
        text: "Draft the release note for Quick Say and keep the tone calm.",
        step: 1,
        playing: true,
        delay: 1700,
      },
      {
        status: "Polishing with Qwen",
        text: "Write a calm release note for Quick Say that explains the privacy model and source build.",
        step: 1,
        playing: false,
        delay: 2300,
      },
      {
        status: "Ready to paste",
        text: "Quick Say is source-ready: local settings, keyring storage, temporary audio cleanup, and no hosted backend.",
        step: 2,
        playing: false,
        delay: 2600,
      },
    ],
  },
  zh: {
    lang: "zh-Hans",
    meta: {
      title: "Quick Say - 本地优先的桌面听写工具",
      description:
        "Quick Say 是一款免费、本地优先的桌面听写应用。按下全局快捷键，自然说话，然后把润色后的文字粘贴到任意位置。",
      ogTitle: "Quick Say - 本地优先的桌面听写工具",
      ogDescription:
        "按下全局快捷键，自然说话，Quick Say 会转写、可选润色，并把文字粘贴到你正在工作的地方。",
    },
    navToggle: {
      open: "打开导航",
      close: "关闭导航",
    },
    text: {
      ".skip-link": "跳到主要内容",
      ".site-nav a[href='#privacy']": "隐私",
      ".site-nav a[href='#workflow']": "工作流",
      ".site-nav a[href='#setup']": "运行",
      ".site-nav .nav-cta": "GitHub 源码",
      ".hero .eyebrow": "为你自己的工作流准备的免费桌面听写",
      "#hero-title": "随处开口，密钥由你掌控。",
      ".hero__lede":
        "Quick Say 将全局快捷键变成光标处的高质量文字。它以紧凑的 Tauri 桌面应用运行，设置保存在本地，并使用你自己的 SiliconFlow API Key。",
      ".hero__actions .button--primary span": "获取源码",
      ".hero__actions .button--ghost span": "查看流程",
      "#why-title": "一个像个人工具一样安静可靠的语音应用。",
      "#why-title + p":
        "Quick Say 面向想要听写速度、但不想再登录另一个托管写作产品的人。",
      ".section--light:not(.product-section) .section__header .eyebrow": "为什么做它",
      ".feature-card:nth-child(1) h3": "快速捕捉",
      ".feature-card:nth-child(1) p":
        "用键盘或麦克风按钮开始听写，然后回到你正在使用的应用。",
      ".feature-card:nth-child(2) h3": "本地优先隐私",
      ".feature-card:nth-child(2) p":
        "偏好设置留在设备上，API Key 写入操作系统密钥环，临时 WAV 文件会被清理。",
      ".feature-card:nth-child(3) h3": "干净落地的文字",
      ".feature-card:nth-child(3) p":
        "只使用转写，或让润色步骤把口语想法整理成可直接粘贴的文本。",
      "#workflow .eyebrow": "工作流",
      "#workflow-title": "日常写作的一小段闭环。",
      "#workflow-title + p":
        "Quick Say 把主路径保持得很短：捕捉语音、完成转写、在需要时润色，然后把结果送到剪贴板或当前光标。",
      "[data-replay-flow]": "重播流程",
      ".timeline__item:nth-child(1) h3": "按下全局快捷键",
      ".timeline__item:nth-child(1) p":
        "使用 CommandOrControl+Shift+Space，或从紧凑的应用窗口开始。",
      ".timeline__item:nth-child(2) h3": "自然说话",
      ".timeline__item:nth-child(2) p":
        "音频会被临时录制、发送转写，然后在处理完成后删除。",
      ".timeline__item:nth-child(3) h3": "粘贴或复制",
      ".timeline__item:nth-child(3) p":
        "自动粘贴到当前应用，或者在更合适时使用仅剪贴板模式。",
      ".product-section .eyebrow": "桌面应用",
      "#product-title": "紧凑控制、清晰设置，没有内置账号。",
      "#product-title + p":
        "这个应用有意保持直接：设置服务商密钥、确认模型默认值、选择粘贴行为，然后在需要时听写。",
      ".product-shot__title": "Quick Say 桌面预览",
      ".product-shot__status": "源码构建",
      ".product-shot figcaption": "当前早期开发界面，围绕主要听写路径进行展示。",
      ".product-shot__notes li:nth-child(1) strong": "快捷键优先",
      ".product-shot__notes li:nth-child(1) p": "在任何地方开始捕捉。",
      ".product-shot__notes li:nth-child(2) strong": "设置清楚可见",
      ".product-shot__notes li:nth-child(2) p": "模型和粘贴行为都方便检查。",
      ".product-shot__notes li:nth-child(3) strong": "本地控制",
      ".product-shot__notes li:nth-child(3) p": "使用你自己的密钥，没有内置账号。",
      "#privacy .eyebrow": "隐私模型",
      "#privacy-title": "架构上保持私密，同时明确服务商调用。",
      "#privacy-title + p":
        "Quick Say 不运行托管后端，也不包含共享 API 账号。转写和润色仍会使用你配置的 SiliconFlow 账号。",
      ".privacy-card:nth-child(1) h3": "你的密钥不会进入项目文件",
      ".privacy-card:nth-child(1) p":
        "API Key 属于操作系统密钥环，不应出现在日志或明文配置里。",
      ".privacy-card:nth-child(2) h3": "临时音频只短暂存在",
      ".privacy-card:nth-child(2) p":
        "原始音频只保留到听写请求完成所需的时间，包括出错路径。",
      ".privacy-card:nth-child(3) h3": "没有 Quick Say 遥测",
      ".privacy-card:nth-child(3) p":
        "项目避免分析、追踪、内置账号和托管应用服务。",
      "#setup .eyebrow": "从源码运行",
      "#setup-title": "在打包发布成熟前，先本地运行。",
      "#setup-title + p":
        "Quick Say 还处于早期阶段，但核心流程已经可以从源码运行，适合贡献者和好奇用户。",
      ".setup-card .button span": "打开 README",
      ".final-cta .eyebrow": "Quick Say",
      "#final-title": "一个你能检查、运行，并保持个人化的听写应用。",
      ".final-cta .button span": "在 GitHub 查看项目",
      ".site-footer p": "Quick Say 基于 MIT License 发布。",
      ".site-footer a": "GitHub",
    },
    html: {
      ".proof-strip__inner p:nth-child(1)":
        "<strong>快捷键</strong> CommandOrControl+Shift+Space。",
      ".proof-strip__inner p:nth-child(2)":
        "<strong>存储</strong> 设置保存在本地，密钥进入 OS 密钥环。",
      ".proof-strip__inner p:nth-child(3)":
        "<strong>粘贴</strong> 不打断上下文，把润色后的文字送到当前位置。",
      ".setup-card li:nth-child(1)":
        "安装 Node.js、pnpm 9.14.2、Rust 和 Tauri v2 系统依赖。",
      ".setup-card li:nth-child(2)":
        "克隆仓库并运行 <code>pnpm install</code>。",
      ".setup-card li:nth-child(3)":
        "使用 <code>pnpm tauri:dev</code> 启动桌面应用。",
      ".setup-card li:nth-child(4)":
        "在设置中添加你的 SiliconFlow API Key，然后按下快捷键。",
    },
    attrs: {
      ".brand": { "aria-label": "Quick Say 首页" },
      ".site-nav": { "aria-label": "主导航" },
      ".language-switch": { "aria-label": "语言" },
      ".hero__image": {
        alt: "Quick Say 桌面应用窗口，显示听写控制和设置",
      },
      ".hero__actions": { "aria-label": "主要操作" },
      ".proof-strip": { "aria-label": "Quick Say 承诺" },
      ".flow-demo": { "aria-label": "动态听写流程" },
      ".timeline": { "aria-label": "Quick Say 工作流步骤" },
      ".product-shot__viewport img": {
        alt: "Quick Say 应用界面，显示全局快捷键听写、服务商设置和最近一次听写面板",
      },
      ".product-shot__notes": { "aria-label": "截图重点" },
    },
    flowStates: [
      {
        status: "正在聆听语音",
        text: "为 Quick Say 起草发布说明，语气保持沉稳。",
        step: 0,
        playing: true,
        delay: 1700,
      },
      {
        status: "正在使用 SenseVoiceSmall 转写",
        text: "为 Quick Say 起草发布说明，语气保持沉稳。",
        step: 1,
        playing: true,
        delay: 1700,
      },
      {
        status: "正在使用 Qwen 润色",
        text: "写一段沉稳的 Quick Say 发布说明，解释隐私模型和源码构建方式。",
        step: 1,
        playing: false,
        delay: 2300,
      },
      {
        status: "可粘贴",
        text: "Quick Say 已可从源码运行：本地设置、密钥环存储、临时音频清理，并且没有托管后端。",
        step: 2,
        playing: false,
        delay: 2600,
      },
    ],
  },
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const languageButtons = Array.from(document.querySelectorAll("[data-language-option]"));

let currentLanguage = getInitialLanguage();

function getInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  const requestedLanguage = normalizeLanguage(params.get("lang"));
  const savedLanguage = normalizeLanguage(getSavedLanguage());
  const browserLanguage = normalizeLanguage(window.navigator.language);

  return requestedLanguage || savedLanguage || browserLanguage || "en";
}

function getSavedLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return "";
  }
}

function saveLanguage(language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language switching should still work when storage is unavailable.
  }
}

function updateLanguageUrl(language) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState({}, "", url);
  } catch {
    // File previews and strict browser settings may block history updates.
  }
}

function normalizeLanguage(language) {
  if (!language) return "";
  const normalized = language.toLowerCase();

  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  return supportedLanguages.includes(normalized) ? normalized : "";
}

function setHeaderState() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 10);
}

function setNavToggleLabel(isOpen) {
  if (!navToggle) return;
  const labels = translations[currentLanguage].navToggle;
  navToggle.setAttribute("aria-label", isOpen ? labels.close : labels.open);
}

function closeNav() {
  if (!nav || !navToggle || !header) return;
  nav.classList.remove("is-open");
  header.classList.remove("is-open");
  document.body.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
  setNavToggleLabel(false);
}

function setMetaContent(selector, content) {
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute("content", content);
  }
}

function setTextContent(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.textContent = value;
  }
}

function setHtmlContent(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.innerHTML = value;
  }
}

function setAttributes(selector, attrs) {
  const node = document.querySelector(selector);
  if (!node) return;

  Object.entries(attrs).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
}

function applyLanguage(language) {
  const nextLanguage = normalizeLanguage(language) || "en";
  const dictionary = translations[nextLanguage];

  currentLanguage = nextLanguage;
  root.lang = dictionary.lang;
  document.title = dictionary.meta.title;
  setMetaContent("meta[name='description']", dictionary.meta.description);
  setMetaContent("meta[property='og:title']", dictionary.meta.ogTitle);
  setMetaContent("meta[property='og:description']", dictionary.meta.ogDescription);

  Object.entries(dictionary.text).forEach(([selector, value]) => {
    setTextContent(selector, value);
  });

  Object.entries(dictionary.html).forEach(([selector, value]) => {
    setHtmlContent(selector, value);
  });

  Object.entries(dictionary.attrs).forEach(([selector, attrs]) => {
    setAttributes(selector, attrs);
  });

  languageButtons.forEach((button) => {
    const isActive = button.dataset.languageOption === nextLanguage;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  setNavToggleLabel(navToggle?.getAttribute("aria-expanded") === "true");
  renderFlow();
}

function setLanguage(language) {
  const nextLanguage = normalizeLanguage(language) || "en";
  saveLanguage(nextLanguage);
  updateLanguageUrl(nextLanguage);
  applyLanguage(nextLanguage);
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.languageOption);
  });
});

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

if (nav && navToggle && header) {
  navToggle.addEventListener("click", () => {
    const nextState = navToggle.getAttribute("aria-expanded") !== "true";
    nav.classList.toggle("is-open", nextState);
    header.classList.toggle("is-open", nextState);
    document.body.classList.toggle("nav-open", nextState);
    navToggle.setAttribute("aria-expanded", String(nextState));
    setNavToggleLabel(nextState);
  });

  nav.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      closeNav();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
    }
  });
}

const revealItems = Array.from(document.querySelectorAll(".reveal"));

if (reducedMotion.matches || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12,
    },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

const flowDemo = document.querySelector(".flow-demo");
const flowStatus = document.querySelector("[data-flow-status]");
const flowText = document.querySelector("[data-flow-text]");
const flowSteps = Array.from(document.querySelectorAll("[data-flow-step]"));
const replayButton = document.querySelector("[data-replay-flow]");

let flowIndex = 0;
let flowTimer = 0;

function getFlowStates() {
  return translations[currentLanguage].flowStates;
}

function renderFlow() {
  const flowStates = getFlowStates();
  const state = flowStates[flowIndex] || flowStates[0];

  if (flowStatus) {
    flowStatus.textContent = state.status;
  }

  if (flowText) {
    flowText.textContent = state.text;
  }

  if (flowDemo) {
    flowDemo.classList.toggle("is-playing", state.playing && !reducedMotion.matches);
  }

  flowSteps.forEach((step, index) => {
    step.classList.toggle("is-active", index === state.step);
  });
}

function scheduleFlow() {
  window.clearTimeout(flowTimer);

  if (reducedMotion.matches) return;

  const flowStates = getFlowStates();
  const state = flowStates[flowIndex] || flowStates[0];

  flowTimer = window.setTimeout(() => {
    flowIndex = (flowIndex + 1) % flowStates.length;
    renderFlow();
    scheduleFlow();
  }, state.delay);
}

function restartFlow() {
  flowIndex = 0;
  renderFlow();
  scheduleFlow();
}

if (flowDemo && flowStatus && flowText) {
  applyLanguage(currentLanguage);
  scheduleFlow();
} else {
  applyLanguage(currentLanguage);
}

if (replayButton) {
  replayButton.addEventListener("click", restartFlow);
}

reducedMotion.addEventListener("change", () => {
  revealItems.forEach((item) => item.classList.add("is-visible"));
  renderFlow();
  scheduleFlow();
});

const hero = document.querySelector(".hero");
let rafId = 0;

if (hero && !reducedMotion.matches && window.matchMedia("(pointer: fine)").matches) {
  hero.addEventListener(
    "mousemove",
    (event) => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const bounds = hero.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        hero.style.setProperty("--hero-shift-x", `${x * -10}px`);
        hero.style.setProperty("--hero-shift-y", `${y * -8}px`);
      });
    },
    { passive: true },
  );

  hero.addEventListener("mouseleave", () => {
    hero.style.setProperty("--hero-shift-x", "0px");
    hero.style.setProperty("--hero-shift-y", "0px");
  });
}
