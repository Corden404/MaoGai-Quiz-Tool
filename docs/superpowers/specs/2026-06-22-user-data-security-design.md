# User Data Security Design

## Goal

修复以下四类安全问题，同时保持现有答题、私有笔记、公开笔记、点赞、云同步和账号注销体验可用：

1. 公开笔记泄露完整邮箱与用户 UUID。
2. 公开笔记的身份、题目、点赞数和重复记录可被客户端伪造。
3. 同一浏览器中不同账号之间可能串用或同步本地进度。
4. 持有有效会话的调用者无需重新验证密码即可注销账号。

## Scope

本次修改包括：

- 浏览器端的公开笔记读取、保存、点赞、进度缓存和注销流程。
- Supabase 的公开笔记数据模型、约束、RLS、函数权限和受控 RPC。
- 一个负责重新验证密码并删除当前账号的 Supabase Edge Function。
- 针对前端行为和数据库安全契约的自动测试。

本次不包括：

- 全站 CDN、CSP、SRI 或依赖锁定整改。
- 密码最小长度和泄露密码保护设置整改。
- `report_question_attempt` 的题目白名单或限流。
- 对公开笔记进行内容审核或敏感词过滤。

## Architecture

公开笔记采用“底表私有、RPC 对外”的边界。浏览器不再直接查询或修改
`public.public_notes`，而是通过只返回必要字段的 RPC 获取笔记，并通过受控
RPC 发布、更新和点赞。数据库负责确定当前用户、匿名昵称、题目合法性和点赞数，
客户端不能提交或覆盖这些服务端字段。

账号注销采用 Edge Function。函数先验证调用者当前 JWT，再使用用户提交的当前
密码执行一次独立密码登录；只有登录结果与 JWT 中的用户完全一致时，才使用服务
端凭据删除该账号。浏览器永远不会获得 `service_role` 密钥。

进度缓存由一个独立的前端模块管理。匿名进度和每个用户的进度使用不同键名，
身份变化时先清空内存状态，再加载目标身份自己的缓存或云端数据，禁止自动将
匿名缓存或其他账号缓存合并到新账号。

## Public Note Identity

### Anonymous display name

每个用户获得一个稳定、随机且不含个人信息的公开昵称，例如 `学习者 A7K2`。

- 在不暴露给 Data API 的 `private_security` schema 中新增 `profiles` 表，
  最少包含：
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `display_name text not null unique`
  - `created_at timestamptz not null default now()`
- 昵称由数据库函数生成，不接受客户端提供的昵称。
- 昵称格式固定为 `学习者 XXXX`，四位随机部分使用
  `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`，避免 `0/O`、`1/I` 等混淆字符。
- 如发生唯一冲突，数据库函数重新生成，直到成功。
- 已有公开笔记涉及的用户在迁移时补建 profile。

公开笔记响应仅包含：

- `id`
- `question_id`
- `display_name`
- `content`
- `created_at`
- `likes`
- `is_mine`
- `is_liked_by_me`

响应不得包含：

- `user_id`
- `user_email`
- 任何认证表字段

## Public Note Data Model and Rules

### Constraints

`public.public_notes` 增加以下数据库约束：

- `unique (user_id, question_id)`：同一用户对同一道题最多一条公开笔记。
- `question_id` 外键引用 `private_security.valid_questions(question_id)`，只允许
  当前题库中的合法题号。
- `check (char_length(btrim(content)) between 1 and 2000)`。
- `check (likes >= 0)`。

`private_security.valid_questions` 由仓库中的 `questions.js` 和
`mayuan_questions.js` 生成并维护：

- `question_id text primary key`
- 每次题库增加或修改 ID 时，数据库迁移必须同步更新白名单。
- 本次迁移写入当前两套题库的全部 ID。
- 本次只把白名单用于公开笔记；全局答题统计的白名单属于另一个整改范围。

保留现有 `user_email` 列作为兼容过渡数据，但：

- 浏览器和新 RPC 不再读取或写入它。
- 对 `anon` 和 `authenticated` 撤销该列及底表的直接访问权限。
- 本次不执行不可逆的数据删除；后续确认不再需要时可在独立迁移中删除该列。

重复记录迁移策略：

- 迁移前按 `(user_id, question_id)` 分组。
- 每组保留 `created_at` 最新的一条。
- 其他重复记录移动到备份表
  `private_security.public_notes_duplicates_20260622`，而不是直接删除。
- `private_security` schema 不暴露给 Data API。`authenticated` 仅获得调用固定
  签名核心函数所需的最小 `USAGE/EXECUTE` 权限，不获得任何表权限；
  `anon` 不获得这些权限。

### Read RPC

提供公开 wrapper `get_public_notes(p_question_id text)`：

- 仅允许 `authenticated` 执行。
- 要求 `auth.uid()` 非空。
- 题号必须存在于 `private_security.valid_questions`。
- 返回上述最小字段集合。
- 按 `likes desc, created_at desc` 排序。
- 通过 profile 关联得到匿名昵称。
- `is_mine` 和 `is_liked_by_me` 在数据库中根据 `auth.uid()` 计算。
- `likes` 通过 `note_likes` 实时计数，不再信任 `public_notes.likes` 缓存列。
- wrapper 使用 `SECURITY INVOKER`，只转调 `private_security` 中固定签名的
  `SECURITY DEFINER` 核心函数。
- 特权核心函数固定安全 `search_path`，所有对象使用 schema 限定名称。
- 特权核心函数除检查 `auth.uid()` 外，还确认该 ID 仍存在于 `auth.users`，避免
  已删除账号的未过期 access token 继续调用业务 RPC。

### Upsert RPC

提供公开 wrapper `upsert_public_note(p_question_id text, p_content text)`：

- 仅允许 `authenticated` 执行。
- 服务端使用 `auth.uid()` 写入 `user_id`。
- 服务端确保当前用户已有匿名 profile。
- 题号必须存在于 `private_security.valid_questions`。
- 内容去除首尾空白后必须为 1–2000 个字符。
- 使用 `(user_id, question_id)` 冲突键更新时，只修改 `content`。
- 不接受 `likes`、`user_email`、`user_id`、`created_at` 等参数。
- wrapper 使用 `SECURITY INVOKER`，只转调未暴露 schema 中的特权核心函数。

### Like RPC

新增公开 wrapper `toggle_public_note_like(p_note_id uuid)`：

- 仅允许 `authenticated` 执行。
- 要求目标公开笔记存在。
- 点赞关系继续由 `note_likes(note_id, user_id)` 唯一约束保证幂等性。
- 在单个事务内增删点赞关系。
- 权威点赞数始终由 `note_likes` 计数得到，不更新或信任客户端可见的缓存计数。
- 函数返回最终的 `is_liked` 和权威 `likes` 值，前端以返回值校正乐观更新。
- wrapper 使用 `SECURITY INVOKER`，特权核心函数位于 `private_security` 并固定
  安全 `search_path`。
- 旧 `toggle_note_like(p_note_id uuid)` 在前端切换完成前保持原行为，避免旧静态
  资源把新的复合返回值误当成 boolean；新前端发布确认后撤销其公开执行权。

### Direct access and RLS

- 对 `anon` 和 `authenticated` 撤销
  `public_notes`、`note_likes` 和 `profiles` 的直接表权限。
- 删除允许认证用户读取整张 `public_notes` 的策略。
- 删除允许用户任意更新自己整行公开笔记的策略。
- 底表继续启用 RLS，作为纵深防御。
- `SECURITY DEFINER` 核心函数只能位于未暴露的 `private_security` schema；
  `public` schema 中的 RPC wrapper 必须是 `SECURITY INVOKER`。
- 特权函数的 owner、固定 `search_path`、schema 限定和明确的
  `REVOKE/GRANT EXECUTE` 必须同时配置。
- 先从 `PUBLIC`、`anon`、`authenticated` 撤销函数默认执行权，再只授予
  `authenticated`。

## Private Note Length

私人笔记和公开笔记都限制为最多 2000 个 Unicode code points。前端使用
`Array.from(content).length` 计算，避免代理对字符被错误计为两个字符。

- 保存前统一调用可测试的校验函数。
- 私人笔记超过 2000 字符时：
  - 不修改题目对象。
  - 不修改内存进度。
  - 不写 localStorage。
  - 不同步云端。
  - 显示明确错误提示。
- 勾选公开分享时，空白内容也显示错误并拒绝保存。
- 私人笔记允许空内容，用于清空笔记。
- 输入框显示当前字符数和 `2000` 上限。
- 数据库仍独立执行公开笔记长度检查，不能依赖前端校验。

## Account-Scoped Progress Cache

### Keys

弃用统一键 `maogai_progress_v1`，改用：

- 匿名缓存：`maogai_progress_v2:anonymous`
- 登录用户缓存：`maogai_progress_v2:user:<user_uuid>`

旧键迁移规则：

- 首次运行发现 `maogai_progress_v1` 时，仅迁移到匿名缓存。
- 迁移后删除旧键。
- 旧缓存绝不自动上传到任何登录账号。

### Auth transition

身份状态变化必须走单一入口：

1. 取消尚未执行的云同步定时器。
2. 清空当前题目中的标签、错题次数和笔记投影。
3. 将内存进度重置为空结构。
4. 设置新的当前用户。
5. 匿名状态只加载匿名缓存。
6. 登录状态只加载该 UUID 对应的缓存，然后查询该 UUID 的云端进度。
7. 云端存在数据时，以云端为账号权威数据并更新该账号缓存。
8. 云端不存在数据时，只允许上传该账号专属缓存；不得上传匿名缓存或其他账号缓存。

正常退出、会话过期、token 失效和账号删除都必须触发同一清理逻辑。退出时可保留
该用户的专属缓存供其下次登录使用，但匿名界面不得显示它。

### Sync safety

- 所有延迟同步任务在创建时捕获目标用户 ID。
- 执行前再次确认当前用户 ID 与目标 ID 相同；不同则丢弃任务。
- 页面隐藏时的立即同步遵循同样检查。
- `user_progress` 的 RLS 继续限制为 `auth.uid() = user_id`。
- 为 `user_progress.user_id` 和 `user_question_reports.user_id` 补充指向
  `auth.users(id) on delete cascade` 的外键，确保账号删除时用户数据完整清理。
- 添加外键前如发现孤儿行，将其移动到
  `private_security.user_progress_orphans_20260622` 和
  `private_security.user_question_reports_orphans_20260622` 后再移除原行。

## Account Deletion Reauthentication

### User interface

账号注销确认区域增加当前密码输入框：

- 密码为空时，确认按钮不可用。
- 五秒倒计时保留为误触保护，但不作为安全控制。
- 请求进行中禁用输入和按钮。
- 错误密码显示“当前密码不正确”。
- 网络错误或服务端错误不清除本地数据，允许用户重试。
- 注销成功后清除当前账号内存状态、该账号专属缓存和 Supabase 本地会话。

### Edge Function

新增 `delete-account` Edge Function：

1. 只接受 `POST`。
2. 要求合法的 bearer access token。
3. 使用调用者 token 获取当前用户，拒绝匿名或失效会话。
4. 请求体只接受字符串 `password`；空字符串或超过 1024 个 Unicode code
   points 时返回 `400`。
5. 使用独立的匿名 Supabase client，以当前用户邮箱和提交的密码调用
   `signInWithPassword`。
6. 验证新登录结果的用户 ID 与 bearer token 用户 ID 完全一致。
7. 使用服务端 Auth Admin API 撤销该用户的全部 refresh session。
8. 使用仅存在于 Edge Function 环境中的服务端 client 删除该用户；新增外键负责
   级联清理 `user_progress`、`user_question_reports`、公开笔记和点赞记录。
9. 返回通用错误信息，日志不得记录密码、access token 或完整邮箱。

该流程验证的是当前密码本身，而不是 JWT 的 `iat`。刷新令牌产生的新 access
token 不会被误认为重新输入过密码。

### Legacy RPC

- 从 `PUBLIC`、`anon` 和 `authenticated` 撤销
  `public.delete_user()` 的执行权限。
- 在确认 Edge Function 部署并通过验证后保留函数但不可公开调用，避免部署切换期间
  出现不可恢复的前后端不一致。
- `delete_user()` 固定安全 `search_path`，作为后续清理前的纵深防御。

## Frontend Data Flow

### Fetch public notes

前端调用 `get_public_notes`，不再执行：

```js
.from("public_notes").select("*")
```

模板只读取 `display_name`，不再读取或拆分 `user_email`，也不通过 `user_id`
判断是否为自己的笔记。

### Save note

保存流程先校验长度，再保存私有笔记。若用户选择公开分享，则调用
`upsert_public_note(question_id, content)`。RPC 失败时：

- 私有笔记已经保存的事实应明确保留。
- 界面提示“私人笔记已保存，但公开分享失败”。
- 不显示虚假的公开成功状态。

### Toggle like

前端调用 `toggle_public_note_like`，可以先乐观更新，但 RPC 返回后必须同时采用
服务端返回的 `is_liked` 和 `likes`。调用失败则恢复原状态。

## Error Handling

- 数据库校验错误映射为友好的中文提示，不直接把 SQL 错误展示给用户。
- 唯一冲突由 upsert 正常处理，不作为用户错误。
- 获取公开笔记失败时显示可重试状态，不影响私人笔记。
- 缓存 JSON 损坏时忽略该键并使用空进度，不上传损坏数据。
- 身份切换过程中禁止创建新的云同步任务，直到目标身份数据加载完成。
- Edge Function 对错误密码返回 `401`，失效会话返回 `401`，参数错误返回 `400`，
  内部错误返回 `500`。

## Testing

### Frontend unit tests

提取并测试以下纯函数或小模块：

- 笔记内容校验：
  - 私人空笔记允许。
  - 私人笔记 2000 字符允许。
  - 私人笔记 2001 字符拒绝。
  - 公开空白笔记拒绝。
- 缓存键生成和旧键迁移。
- 账号 A、账号 B、匿名三类缓存互不读取。
- 身份切换会重置内存状态。
- 延迟同步不会向已经退出或切换后的账号写入。

### Static frontend security tests

断言：

- 前端不再出现 `.from('public_notes').select('*')`。
- 公开笔记模板不再引用 `user_email` 或 `user_id`。
- 新增 RPC 名称存在。
- 注销请求包含当前密码并调用 Edge Function，而不是 `delete_user` RPC。

### Database contract tests

在部署后用 SQL 和角色模拟验证：

- `anon` 不能执行公开笔记和注销相关函数。
- `authenticated` 不能直接 select/insert/update/delete 底表。
- RPC 返回列不含邮箱与 UUID。
- 同一用户同一题只能有一条公开笔记。
- 2001 字符、空白公开内容、非法题号和负点赞数被拒绝。
- 客户端无法覆盖 `likes`、`user_id`、`question_id` 或匿名昵称。
- `toggle_public_note_like` 返回的计数与 `note_likes` 实际行数一致。

### Edge Function tests

- 无 token 拒绝。
- 空密码拒绝。
- 错误密码拒绝且账号保留。
- bearer token 与密码登录用户不一致时拒绝。
- 正确密码只删除当前账号。
- 删除后旧 access token 即使尚未自然过期，也因用户存在性检查和数据外键而不能
  再调用受保护业务 RPC 或重建用户数据。

生产账号删除测试必须使用专门创建的临时测试用户，不得使用现有真实用户。

## Deployment Order

为避免数据库和静态前端发布不同步，按以下顺序部署：

1. 建立 profile、约束、备份和新 RPC，但暂时保留旧前端所需读取能力与旧
   `toggle_note_like` 返回类型。
2. 部署并验证 `delete-account` Edge Function。
3. 发布使用新 RPC、分区缓存和密码确认的前端。
4. 确认新前端生效后，撤销底表直接权限以及旧 `delete_user`、
   `toggle_note_like` RPC 执行权。
5. 运行 Supabase Security Advisor 和数据库契约测试。
6. 观察错误日志，确认无旧客户端依赖后再考虑删除遗留邮箱列和旧函数。

如果平台无法保证静态资源快速刷新，则新旧接口应短暂并存；安全权限收紧只在新
前端发布确认后执行。

## Success Criteria

- 任何认证用户通过公开笔记 API 都无法取得其他用户邮箱或 UUID。
- 客户端不能直接伪造公开身份、题目归属、点赞数或创建同题重复笔记。
- 私人和公开笔记均无法保存超过 2000 字符的内容，且用户得到明确提示。
- 同一浏览器中账号 A、账号 B 和匿名用户的进度与笔记互不显示、互不上传。
- 直接调用旧注销 RPC 不再可行。
- 注销账号必须提供正确的当前密码，且只能删除 bearer token 对应的当前账号。
- 所有新增前端测试、数据库契约测试和 Edge Function 测试通过。
- Supabase Security Advisor 不再报告本次涉及函数的匿名执行权或可变
  `search_path` 问题。
