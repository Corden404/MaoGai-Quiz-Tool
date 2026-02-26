# 毛概刷题助手

这是一个基于 **Vue 3 + Tailwind CSS + Supabase** 的轻量级、跨平台刷题工具。

## 核心特性

- **纯静态运行**：应用主体在浏览器中运行，无需自己维护后端服务器。
- **现代化 UI**：由 Tailwind CSS 驱动，提供美观的登录弹窗和自适应刷题界面。
- **完善的刷题功能**：
  - 按章节、题型筛选
  - 顺序练习与随机洗牌
  - 错题、星标、笔记系统
- **云端账号系统 (BaaS)**：
  - 完整的邮箱注册/登录闭环
  - 本地会话自动保持
  - 基于 Supabase Auth 的安全鉴权机制

## 📁 项目结构

`	ext
.
├── index.html        # 主程序，包含所有的 UI 视图、Vue 业务逻辑以及 Auth 连接代码
├── config.js         # 本地配置文件，存储 Supabase 的访问密钥 (已加入 .gitignore)
├── questions.js      # 纯净版题库数据，作为全局变量挂载（规避跨域限制）
├── questions.json    # 原始的题目 JSON 数据（清洗后的纯净版骨架）
├── README.md         # 项目说明文档
└── GEMINI.md         # 项目的整体升级改造计划
`

## 部署与运行方式

### 1. 本地运行体验

在配置好本地的 config.js 后，直接在浏览器中双击打开 index.html 文件即可体验完整的刷题与登录功能。

### 2. 账号系统配置 (Supabase)

如需自行部署这套代码，你需要在 [Supabase](https://supabase.com/) 注册一个项目，并在项目根目录创建一个 config.js 文件：

`javascript
window.APP_CONFIG = {
    SUPABASE_URL: "https://你的_PROJECT_ID.supabase.co",
    SUPABASE_KEY: "你的_anon_public_key"
};
`

## 后续改造计划

在 Supabase 中建立 user_progress 数据表并配置 RLS 安全策略，将用户的刷题进度（错题本、笔记）全面推上云端，实现多设备自动同步。
