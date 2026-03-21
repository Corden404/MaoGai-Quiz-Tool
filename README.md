# 刷题助手 (MaoGai-Quiz-Tool)

这是一个基于 **Vue 3 + Tailwind CSS + Supabase** 的轻量级、跨平台纯前端刷题工具。整个应用作为一个静态页面运行，通过 Supabase 提供后端云服务（BaaS），实现用户认证、数据同步和社区互动。

👉 **[点击这里在线体验网站：scau-test.top](https://scau-test.top)**

![Icon](icon.png)

## 📸 界面预览

<p align="center">
  <img src="宣传图1.png" width="60%" />
  <img src="宣传图2.png" width="60%" />
  <img src="宣传图3.png" width="60%" />
</p>

## 🌟 核心特性

- **多科目支持**：
  - 现已支持《毛泽东思想和中国特色社会主义理论体系概论》(毛概) 与《马克思主义基本原理》(马原) 双科目。
  - 科目间数据完全隔离，支持页面内无缝热切换。
- **智能化刷题模式**：
  - 按章节、题型精准筛选组件。
  - 顺序练习与真随机洗牌。
  - 重点/难记/星标专项复习。
  - **全网易错模式**：支持自定义错误率阈值，拉取真实全网作答统计，智能避开陷阱题。
- **题目智能评判**：
  - 客观题自动判别，主观题需自评（支持多种特殊题型判别机制）。
- **解题广场互动与 AI 笔记**：
  - 每道题均已配备 **AI 智能生成的参考解析**，保底提供思路指引。
  - 用户可以将个人优质笔记分享至公共“解题广场”，支持点赞并按热度降序排列。
- **云端同步与安全隔离**：
  - 完整的邮箱与密码登录闭环。
  - 防丢双保险：本地秒级缓存 + 基于时间戳的比对合并，页面卸载前自动抢救未同步进度。
  - 基于 Supabase RLS (Row Level Security) 策略确保私有进度绝对安全。
- **双重防刷机制**：
  - 前端 `reported_questions` 本地缓存防抖。
  - 后端基于 `user_id` 与 `question_id` 联合主键的物理拦截，杜绝易错榜刷榜行为。
- **极致首屏性能 (秒开优化)**：
  - 核心架构保持极简纯前端，开发环境免配置即可实时预览。
  - 生产环境引入了局部构建流程，自动化剥离 Tailwind CDN 并提取静态 CSS，实现无感冷启动。

## 📁 项目结构

```text
.
├── index.html            # 项目主入口：包含所有的 UI 视图、Vue 3 业务逻辑、以及 Supabase 云端对接
├── config.js             # 全局配置：存储 Supabase 连接信息 (URL & KEY)
├── questions.js          # 《毛概》题库数据，作为全局变量挂载（规避跨域限制）
├── mayuan_questions.js   # 《马原》题库数据，作为全局变量挂载
├── package.json          # Node 脚本及构建依赖，提供自动化打包指令
├── tailwind.config.js    # Tailwind 配置文件
├── style.css             # (构建产物) 提纯后的生产环境静态样式表
├── icon.png              # 网站 Favicon 图标
└── README.md             # 项目详细说明文档与部署指南
```

## 🚀 部署与运行指南

### 1. 本地免环境开发与体验

确保 `config.js` 中的密钥正确，不需要装复杂的 Node.js 环境或启动服务，**直接在浏览器中双击打开 `index.html`** 即可体验完整的跨设备刷题与云端功能。代码改动保存后刷新页面即可生效。

### 2. 配置专属的云端数据库 (Supabase)

即使是静态项目，也需云端数据库来支撑核心进度同步和广场互助功能：
1. 注册并在 [Supabase](https://supabase.com/) 创建新项目。
2. 按照表结构（`user_progress`, `public_notes`, `note_likes`, `global_question_stats`, `user_question_reports`）建表。
3. 配置好 **RLS 策略** 和以下 **RPC 函数**，供纯前端直接调用（SECURITY DEFINER 提权运行）：
   - `report_question_attempt` (上报答题防刷校验)
   - `get_high_error_questions` (查询全网易错题排行榜)
   - `toggle_note_like` (解题广场笔记点赞)
   - `delete_user` (安全注销账号)
4. 修改代码根目录下的 `config.js` 文件：
   ```javascript
   window.APP_CONFIG = {
     SUPABASE_URL: "https://<你的_PROJECT_ID>.supabase.co",
     SUPABASE_KEY: "<你的_anon_public_key>",
   };
   ```

### 3. 公网部署 (推荐使用 Cloudflare Pages)

1. **提交代码至 GitHub** 并连接托管平台。
2. **正确配置构建指令** (重点，实现秒开优化的关键)：
   - **Build command (构建命令)**: `npm run build`
   - **Build output directory (输出目录)**: `/` (根目录，因打包脚本原地覆写了 HTML 的依赖引入)
3. **完成配置闭环**:
   获取公网域名后，返回 **Supabase 控制台** -> `Authentication` -> `URL Configuration`。把公网入口域名填写到 **Site URL** 和 **Redirect URLs** 中，以确保注册后的用户鉴权回调正常运作。
