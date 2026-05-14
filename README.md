# Quick Say

Quick Say is a free personal desktop dictation app inspired by Typeless. Press a global hotkey, speak, let your own SiliconFlow API key transcribe and optionally polish the text, then paste it into the active app.

## Goals

- Free/open-source desktop app with no hosted backend.
- User-owned SiliconFlow API key and local settings.
- Cross-platform Tauri v2 shell for Windows, macOS, and Linux.
- Transcription through SiliconFlow with `FunAudioLLM/SenseVoiceSmall`.

## Development

```bash
pnpm install
pnpm tauri:dev
```

Useful checks:

```bash
pnpm test
pnpm build
cd src-tauri && cargo test
```

## Privacy Model

Quick Say stores preferences locally and stores the SiliconFlow API key in the operating system keyring. Raw audio is written to a temporary WAV file only long enough to submit transcription, then removed after processing.
