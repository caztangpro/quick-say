# Quick Say

[English](../README.md)

<p align="center">
  <img src="assets/quick-say-logo.svg" alt="Quick Say logo" width="144">
</p>

Quick Say 是一款免费、本地优先的桌面听写应用。按下全局快捷键，
自然说话，Quick Say 会使用你自己的 SiliconFlow API Key 转写语音，
也可以选择对文本进行润色，然后把结果粘贴到光标所在位置，或复制到剪贴板。

这个项目受到 Typeless 等轻量语音转文字工具的启发，但它更强调个人化和本地优先：
没有托管后端、没有内置 API 账号，也没有遥测。

## 功能亮点

- 使用全局快捷键开始听写，并提供紧凑的 Tauri 桌面界面。
- 默认使用 `FunAudioLLM/SenseVoiceSmall` 进行 SiliconFlow 语音转写。
- 默认使用 `Qwen/Qwen2.5-7B-Instruct` 进行可选文本润色。
- 支持自动粘贴到当前应用，也支持仅复制到剪贴板的备用模式。
- 启用后可在粘贴完成后恢复原剪贴板内容。
- 提供英文和中文界面文本。
- 支持浅色和深色界面模式。
- 设置保存在本地，API Key 保存在操作系统密钥环中。

## 截图

![Quick Say 主窗口](assets/quick-say-screenshot.png)

## 隐私模型

Quick Say 被设计成个人使用、本地优先的效率工具。

- 你的 SiliconFlow API Key 会保存在操作系统密钥环中。
- 偏好设置由桌面应用保存在本地。
- 音频只会临时录制为 WAV 文件，并仅保留到转写请求完成所需的时间。
- 原始音频会在处理后删除，包括取消和出错路径。
- Quick Say 没有托管后端、遥测、分析或内置账号。

由于语音转写和文本润色使用 SiliconFlow，听写音频和文本会根据你的服务商账号与配置发送给 SiliconFlow。

## 当前状态

Quick Say 仍处于早期开发阶段。核心流程可以从源码运行，但可能还没有打包发布产物和安装器文档。
在应用继续成熟之前，平台权限、全局快捷键、麦克风访问和自动粘贴行为仍可能存在一些边缘问题。

## 环境要求

- Node.js 和 `pnpm` 9.14.2。
- Rust 1.77.2 或更新版本。
- 适用于你的操作系统的 Tauri v2 系统依赖。
- 一个 SiliconFlow API Key。
- 桌面应用的麦克风访问权限。

在 Linux 上，自动粘贴需要 `wtype` 或 `xdotool`。如果没有其中任一工具，请使用仅剪贴板模式。

## 快速开始

克隆仓库并安装依赖：

```bash
pnpm install
```

以开发模式运行桌面应用：

```bash
pnpm tauri:dev
```

在应用中：

1. 打开 Settings。
2. 添加你的 SiliconFlow API Key。
3. 确认转写模型和润色模型。
4. 保存设置。
5. 按下 `CommandOrControl+Shift+Space`，或使用麦克风按钮开始听写。

## 配置

Quick Say 默认配置如下：

| 设置 | 默认值 |
| --- | --- |
| 快捷键 | `CommandOrControl+Shift+Space` |
| 界面语言 | English |
| 听写语言 | Auto |
| 转写模型 | `FunAudioLLM/SenseVoiceSmall` |
| 润色模型 | `Qwen/Qwen2.5-7B-Instruct` |
| 粘贴行为 | 自动粘贴 |
| 恢复剪贴板 | 启用 |
| 本地文本历史 | 禁用 |

这些设置可以在应用界面中修改。API Key 不应被提交、记录日志，或以明文形式保存在项目文件中。

## 开发命令

只运行 Web 前端：

```bash
pnpm dev
```

运行 Tauri 桌面应用：

```bash
pnpm tauri:dev
```

构建前端：

```bash
pnpm build
```

构建桌面应用安装包：

```bash
pnpm tauri:build
```

运行前端测试：

```bash
pnpm test
```

运行 Rust 检查和测试：

```bash
cd src-tauri
cargo check
cargo test
```

## 项目结构

```text
src/
  App.tsx          主 React 界面和听写状态机
  i18n.ts          英文和中文界面文案
  settings.ts      前端默认值、校验和快捷键格式化
  tauriApi.ts      Tauri 命令的类型化封装
  types.ts         前端共享类型

src-tauri/src/
  audio.rs         临时 WAV 录音
  commands.rs      Tauri 命令处理器
  lib.rs           应用初始化、托盘、窗口和全局快捷键接线
  paste.rs         剪贴板和粘贴行为
  settings.rs      本地设置和操作系统密钥环集成
  siliconflow.rs   SiliconFlow 转写和润色客户端
```

## 测试

迭代时优先运行最小相关检查，提交变更前再扩大验证范围：

- 前端校验、设置或 UI 逻辑：`pnpm test`
- TypeScript 或 Vite 变更：`pnpm build`
- Rust 应用行为：`cd src-tauri && cargo test`
- 全局快捷键、托盘行为、剪贴板、麦克风或服务商调用流程：
  使用 `pnpm tauri:dev` 手动验证

## 贡献

欢迎贡献。请让变更保持符合本应用的本地优先隐私模型和紧凑的桌面工具体验。

在提出变更前：

1. 保持面向用户的英文和中文文案同步。
2. 避免记录 API Key、原始音频、转写文本或润色文本。
3. 确保临时音频在成功、取消和出错时都能可靠清理。
4. 修改共享设置时，同时更新前端和 Rust 的设置默认值。
5. 运行上文列出的相关测试。

## 安全

请不要为密钥、密钥处理缺陷或数据暴露问题创建公开 issue。
如果仓库配置了安全联系方式，请使用它；否则，请在公开细节前私下联系维护者。

## 许可证

Quick Say 基于 [MIT License](../LICENSE) 发布。
