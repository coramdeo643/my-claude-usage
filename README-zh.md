*其他语言: [English](README.md) | [한국어](README-ko.md)*

# My Claude Usage

一款超轻量级扩展，将 Claude Code 的使用量（5 小时会话 · 每周）**直接显示在 VS Code 状态栏中**。无需任何点击，剩余额度一目了然。无需单独登录，直接**复用已安装的 Claude Code 登录凭据**。

<p align="center">
  <img src="images/logo.png" alt="My Claude Usage 图标" width="128">
</p>

## 📸 预览

<p align="center">
  <img src="images/screenshot.png" alt="状态栏中显示的使用量与悬停提示" width="600">
</p>

## ✨ 为什么选择 My Claude Usage？

查看 Claude Code 的使用额度通常需要额外操作。本扩展将使用量**直接显示在状态栏中**，工作时无需移开视线即可随时查看。

- **极简**: 以 `Claude ◔ 20% ◑ 45%` 的形式，用图标显示 5 小时会话（环形图）和每周（饼图）的使用率。
- **颜色警告**: 以 5h/7d 中较高的使用率为准，用颜色提醒 — 70% 以上为黄色，90% 以上为红色。
- **简洁的悬停提示**: 鼠标悬停时，以 `5h ◔ 20% 2h 15m`、`7d ◑ 45% 4d 3h` 两行显示使用率和距离重置的剩余时间。
- 没有笨重的 Webview 或仪表盘，没有后台负担。

## 🔐 认证与隐私

扩展会**自动读取**已登录的 **Claude Code 凭据**（位置因操作系统而异）：

- **macOS**: 钥匙串（`Claude Code-credentials`）
- **Windows / Linux**: `~/.claude/.credentials.json`
- 或 `ANTHROPIC_API_KEY` 环境变量（用于 CI / 容器的备用方案）

唯一的网络请求发往**官方 Anthropic 使用量接口（`api.anthropic.com`）**，且仅使用您自己的令牌进行认证。

- 不向任何第三方服务器发送数据
- 无遥测、无追踪
- 不创建或存储新令牌（仅读取 Claude Code 的现有登录信息）
- **macOS 注意**: 首次运行时可能会弹出钥匙串访问提示 → 请点击 **"始终允许"**。

## 🪶 超轻量（~14 KB）

通过 `esbuild` 打包为单个文件，整个扩展（代码约 11 KB + 图标字体约 3 KB）仅约 14 KB。

- 除 VS Code API 外零运行时依赖
- 仅在 `onStartupFinished` 时激活，加载迅速

## ✅ 要求

- 必须已安装并登录 **Claude Code**（需要凭据才能读取使用量）。

## ⚙️ 配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `myClaudeUsage.refreshInterval` | `120` | 使用量刷新间隔（秒，30-3600） |

## ⌨️ 命令

| 命令 | 快捷键 | 说明 |
|---|---|---|
| `Claude Usage: Refresh Claude Usage` | `Ctrl/Cmd+Shift+R` | 立即刷新使用量 |

点击状态栏项目也会立即刷新。

## 🚀 安装方法

1. 打开 VS Code 扩展视图（`Ctrl+Shift+X`）。
2. 搜索 **My Claude Usage**。
3. 点击 **安装（Install）** 即可。

## 📄 许可证

[MIT License](LICENSE)
