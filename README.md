# 刷题助手

这是一个基于 **Vue 3 + Tailwind CSS + Supabase** 的轻量级、跨平台刷题工具。

![Icon](icon.png)

## 核心特性

- **纯静态运行**：应用主体完全在浏览器中运行，零服务器成本，可免费托管于 Cloudflare Pages / Vercel 等平台。
- **完善的刷题功能**：
  - 按章节、题型精准筛选
  - 顺序练习与随机洗牌
  - 主观题自评、客观题自动判别（支持辨析题特殊逻辑）
  - 错题、星标、难记等维度的专项复习
- **云端账号与同步系统 (BaaS)**：
  - 完整的邮箱注册/密码登录闭环
  - 账号随时注销，数据彻底清除
  - 本地会话自动保持，跨设备无缝同步练习进度
  - **金融级安全隔离**：基于 Supabase RLS 策略确保私有进度数据绝对安全
- **社区互助功能（解题广场）**：
  - 支持将个人的优质笔记分享至公共的“解题广场”。
  - 支持浏览其他同学的公开笔记。
  - **动态互动**：集成笔记点赞机制，广场笔记按点赞数热度降序排列。

## 📁 项目结构

```text
.
├── index.html        # 主程序，包含所有的 UI 视图、Vue 业务逻辑以及 Auth 连接代码
├── config.js         # 配置文件，存储 Supabase 的公开访问密钥
├── questions.js      # 纯净版题库数据，作为全局变量挂载（规避跨域限制）
├── questions.json    # 原始的题目 JSON 数据骨架
├── icon.png          # 网页书签/标签页图标
├── README.md         # 项目说明文档
└── GEMINI.md         # 项目升级改造与里程碑日志
```

## 🚀 部署与运行指南

### 1. 本地免环境体验

确保 `config.js` 中的密钥正确，直接在浏览器中双击打开 `index.html` 即可体验完整的刷题与云端功能。

### 2. 配置专属的云端数据库 (Supabase)

即使是静态部署，你依然需要自己的云端数据库来支撑账号和数据同步：
1. 注册并在 [Supabase](https://supabase.com/) 创建新项目。
2. 按照 `GEMINI.md` 或相关的 SQL 脚本建立 `user_progress`、`public_notes`、`note_likes` 等表，并务必配置好 **RLS 策略** 和 **RPC 点赞/注销函数**。
3. 修改代码根目录下的 `config.js` 文件：
   ```javascript
   window.APP_CONFIG = {
     SUPABASE_URL: "https://<你的_PROJECT_ID>.supabase.co",
     SUPABASE_KEY: "<你的_anon_public_key>",
   };
   ```

### 3. 公网部署

1. **提交代码到 Github**

2. **连接托管平台**

3. **完成配置**
   - 部署完成后，分配给你一个公网域名。
   - 返回 **Supabase 控制台** -> `Authentication` -> `URL Configuration`。把这个公网域名（如 `https://my-quiz.pages.dev`）填写到 **Site URL** 和 **Redirect URLs** 中。

