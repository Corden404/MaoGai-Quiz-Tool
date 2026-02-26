# 毛概刷题助手

这是一个基于 **Vue 3 + Tailwind CSS + Supabase** 的轻量级、跨平台刷题工具。

## 核心特性

- **纯静态运行**：应用主体完全在浏览器中运行，无需自己维护后端服务器。
- **完善的刷题功能**：
  - 按章节、题型精准筛选
  - 顺序练习与随机洗牌
  - 主观题自评、客观题自动判分
  - 错题、星标、难记等维度的专项复习
- **云端账号与同步系统 (BaaS)**：
  - 完整的邮箱注册/密码登录闭环
  - 本地会话自动保持
  - **跨设备自动同步**：无缝拉取与上传个人刷题进度
  - **金融级安全隔离**：基于 Supabase RLS 策略确保私有数据绝对隔离，仅个人可见与修改

## 📁 项目结构

```text
.
├── index.html        # 主程序，包含所有的 UI 视图、Vue 业务逻辑以及 Auth 连接代码
├── config.js         # 本地配置文件，存储 Supabase 的访问密钥 (已加入 .gitignore)
├── questions.js      # 纯净版题库数据，作为全局变量挂载（规避跨域限制）
├── questions.json    # 原始的题目 JSON 数据（清洗后的纯净版骨架）
├── README.md         # 项目说明文档
└── GEMINI.md         # 项目的整体升级改造计划日志
```

## 部署与运行方式

### 1. 本地运行体验

在配置好本地的 `config.js` 后，直接在浏览器中双击打开 `index.html` 文件即可体验完整的刷题、登录及云端同步功能。

### 2. 账号系统配置 (Supabase)

如需自行部署这套代码，你需要在 [Supabase](https://supabase.com/) 注册一个项目，并在项目根目录创建一个 `config.js` 文件：

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "https://你的_PROJECT_ID.supabase.co",
  SUPABASE_KEY: "你的_anon_public_key",
};
```
