# AGENTS.md

Guidance for AI agents working in this repository.

## Scope

These instructions apply to the current project at `D:\code\quick-say` and all files under this repository unless a more specific nested `AGENTS.md` says otherwise.

## Project Snapshot

Quick Say is a free personal desktop dictation app. It uses a React/Vite frontend inside a Tauri v2 desktop shell. Users provide their own SiliconFlow API key; settings are local, API keys belong in the OS keyring, and temporary audio should not outlive the dictation request.

Core stack:

- Frontend: React 18, TypeScript, Vite 6, Vitest, jsdom.
- Desktop/backend: Tauri 2, Rust 2021, Tokio, reqwest, cpal, hound, keyring.
- Package manager: pnpm 9.14.2. Prefer pnpm over npm or yarn.

## Documentation Lookups

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service, including well-known technologies such as React, Vite, Tauri, Vitest, pnpm, Rust crates, or SiliconFlow/OpenAI-compatible APIs. Use Context7 even when the answer seems familiar, because API syntax, setup steps, and migration guidance may have changed.

Do not use Context7 for refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

When Context7 is needed:

1. Start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact `/org/project` library ID.
2. Pick the best match by exact name, relevance, snippet count, source reputation, and benchmark score.
3. Run `query-docs` with the selected library ID and the user's full question.
4. Answer or implement using the fetched docs.

## Project Layout

- `src/` contains the React app, frontend settings validation, i18n, shared TypeScript types, and Tauri invoke wrappers.
- `src/App.tsx` is the main UI and recording state machine.
- `src/settings.ts` owns frontend defaults, normalization, hotkey formatting, and validation.
- `src/i18n.ts` owns English/Chinese UI strings. Keep both languages in sync when adding user-facing text.
- `src/tauriApi.ts` is the frontend boundary for Tauri commands. Keep command names aligned with Rust handlers.
- `src-tauri/src/` contains Rust app logic:
  - `commands.rs` exposes Tauri commands.
  - `lib.rs` wires app setup, tray/window behavior, shortcuts, and events.
  - `audio.rs` records temporary WAV audio.
  - `siliconflow.rs` calls the transcription/polish provider.
  - `settings.rs` stores settings and API keys.
  - `paste.rs` handles clipboard/paste behavior.
  - `state.rs` and `errors.rs` hold shared state and app errors.
- `src-tauri/capabilities/default.json` controls Tauri permissions. Update it when frontend APIs or plugins need new permissions.
- `src-tauri/tauri.conf.json` controls app windows, build commands, bundle metadata, and security policy.

Generated or build outputs should normally be left alone: `node_modules/`, `dist/`, `target/`, `src-tauri/target/`, `src-tauri/gen/schemas/`, and `*.log`.

## Development Commands

Install dependencies:

```bash
pnpm install
```

Run the web frontend only:

```bash
pnpm dev
```

Run the desktop app:

```bash
pnpm tauri:dev
```

Useful checks:

```bash
pnpm test
pnpm build
cd src-tauri && cargo test
cd src-tauri && cargo check
```

Prefer running the smallest relevant check first, then broaden when touching shared contracts or desktop behavior.

## Coding Guidelines

- Keep TypeScript strict and explicit at app boundaries. Reuse `src/types.ts` instead of duplicating payload shapes.
- Keep frontend defaults in `src/settings.ts` aligned with Rust defaults in `src-tauri/src/settings.rs`.
- When adding or renaming a Tauri command, update the Rust command registration, the frontend wrapper in `src/tauriApi.ts`, and any related capability permissions.
- Preserve the app's privacy model: never log API keys, raw audio, full transcripts, or polished text unless the user explicitly asks for diagnostic output.
- Keep temporary audio cleanup reliable, including error paths and cancellation.
- Avoid platform-specific behavior unless it is guarded or intentionally scoped. Hotkeys should use Tauri-compatible strings such as `CommandOrControl+Shift+Space`.
- For paste behavior, preserve clipboard fallback and clipboard restoration semantics.
- Keep the UI compact and app-like. This is a desktop productivity tool, not a landing page.
- Use `lucide-react` icons for buttons and controls when adding frontend UI.
- Keep English and Chinese strings together. Add or update tests when validation, normalization, i18n, hotkey handling, provider payloads, or settings migration changes.

## Testing Notes

- Frontend unit tests use Vitest with jsdom and setup in `src/test/setup.ts`.
- Rust tests live beside Rust modules and may use `httpmock` for provider-facing behavior.
- Run `pnpm test` for frontend logic changes.
- Run `pnpm build` after TypeScript or Vite config changes.
- Run `cd src-tauri && cargo test` for Rust behavior changes.
- Run a Tauri dev build manually when changing global shortcuts, tray/window behavior, clipboard/paste, microphone capture, or provider integration.

## Safety And Review

- Treat this as a local-first privacy-sensitive app.
- Do not introduce a hosted backend, telemetry, analytics, or secret exfiltration.
- Do not commit generated build artifacts.
- Do not remove user data, settings, keyring entries, or local history unless the user explicitly requests it.
- Before changing security policy, capabilities, provider endpoints, key storage, clipboard behavior, or audio file handling, inspect the full flow and verify the smallest realistic end-to-end path.
