# User Data Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove public-note identity leakage and client-side forgery, isolate browser progress by account, enforce a 2000-character note limit, and require the current password before account deletion.

**Architecture:** Browser-safe helpers own note validation and account-scoped localStorage behavior. Public notes become RPC-only: public invoker wrappers call privileged functions in an unexposed schema, and only minimal anonymous identity fields return to the browser. Account deletion moves to a JWT-protected Edge Function that verifies the current password before revoking sessions and deleting the caller.

**Tech Stack:** Vue 3 browser build, Node.js built-in test runner, Supabase Postgres/RLS/RPC, Supabase Edge Functions (Deno/TypeScript), Supabase MCP, Cloudflare static hosting.

## Global Constraints

- Python work, if needed, must run in `conda activate dev`.
- Deletions must be reversible: move data to `private_security` backup tables or `/.trash`; do not irreversibly delete user data during migration cleanup.
- Download packages from a Tsinghua mirror when that ecosystem provides one; otherwise use an available China mirror and record the exception.
- Follow the repository's English Conventional Commits style.
- Public and private notes are limited to 2000 Unicode code points.
- Public-note responses must never include email addresses or user UUIDs.
- Do not expose a Supabase service-role or secret key to browser code.
- Production account-deletion tests must use a dedicated temporary user only.

---

## File Structure

- Create `src/user-data-security.js`: browser/CommonJS helpers for note validation, empty progress state, scoped cache keys, legacy-cache migration, safe cache reads/writes, and stale-sync guards.
- Create `tests/user-data-security.test.js`: unit tests for validation and cache isolation.
- Create `tests/user-data-security-ui.test.js`: static integration assertions for the Vue template and Supabase calls.
- Modify `index.html`: load the helper module; use scoped caches, secure RPCs, anonymous display names, note-length UI, and password-confirmed Edge Function deletion.
- Create `scripts/generate-valid-question-sql.js`: deterministic generator for the current question-ID whitelist SQL.
- Create the CLI-generated `supabase/migrations/*_prepare_user_data_security.sql`: reversible schema/data/new-RPC migration that remains compatible with the currently deployed frontend.
- Create the CLI-generated `supabase/migrations/*_finalize_user_data_security.sql`: post-frontend-cutover privilege and legacy-RPC hardening.
- Create `tests/database-security-precutover.sql`: assertions for the additive migration.
- Create `tests/database-security-contract.sql`: final role and metadata assertions.
- Create `supabase/functions/delete-account/index.ts`: JWT and password-verified account deletion.
- Create `supabase/functions/delete-account/handler.mjs`: dependency-injected request handler shared by Edge runtime and Node tests.
- Create `supabase/functions/delete-account/deno.json`: pinned Edge Function imports.
- Create `tests/delete-account-handler.test.js`: Node tests for request validation and deletion orchestration.

### Task 1: Note Validation and Account-Scoped Cache Helpers

**Files:**
- Create: `src/user-data-security.js`
- Create: `tests/user-data-security.test.js`

**Interfaces:**
- Produces: `window.UserDataSecurity` and CommonJS exports:
  - `MAX_NOTE_LENGTH: 2000`
  - `createEmptyProgress(): Progress`
  - `countCodePoints(value: unknown): number`
  - `validateNoteContent(content: unknown, options?: { public?: boolean }): { ok: boolean, message: string }`
  - `progressStorageKey(userId?: string | null): string`
  - `migrateLegacyProgress(storage: StorageLike): void`
  - `readProgress(storage: StorageLike, userId?: string | null): Progress`
  - `writeProgress(storage: StorageLike, userId: string | null, progress: Progress): void`
  - `removeProgress(storage: StorageLike, userId: string | null): void`
  - `canSyncProgress(expectedUserId: string, currentUserId?: string | null): boolean`

- [ ] **Step 1: Write failing note-validation tests**

Add tests proving:

```js
assert.equal(validateNoteContent("", { public: false }).ok, true);
assert.equal(validateNoteContent("a".repeat(2000), { public: false }).ok, true);
assert.equal(validateNoteContent("a".repeat(2001), { public: false }).ok, false);
assert.equal(validateNoteContent("😀".repeat(2000), { public: false }).ok, true);
assert.equal(validateNoteContent("   ", { public: true }).ok, false);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/user-data-security.test.js
```

Expected: FAIL because `src/user-data-security.js` does not exist.

- [ ] **Step 3: Implement minimal note validation**

Use `Array.from(String(value ?? "")).length`; return a specific Chinese message for length overflow and for blank public content.

- [ ] **Step 4: Run note-validation tests and verify GREEN**

Run the same command. Expected: all note-validation tests pass.

- [ ] **Step 5: Add failing cache-isolation tests**

Use an in-memory Storage implementation and prove:

```js
progressStorageKey(null) === "maogai_progress_v2:anonymous"
progressStorageKey("user-a") === "maogai_progress_v2:user:user-a"
```

Also prove:

- legacy `maogai_progress_v1` migrates only to anonymous storage and is removed;
- user A cannot read user B or anonymous progress;
- malformed JSON returns a new empty progress object;
- `canSyncProgress("user-a", "user-b")` is false.

- [ ] **Step 6: Run cache tests and verify RED**

Expected: FAIL because cache helpers are missing.

- [ ] **Step 7: Implement the cache helpers**

Never merge progress from different keys. `readProgress` must return a normalized object containing `tags`, `error_counts`, `notes`, and `reported_questions`.

- [ ] **Step 8: Run helper tests and the full suite**

Run:

```powershell
node --test tests/user-data-security.test.js
node --test
```

Expected: helper tests pass and the existing 31 tests remain green.

- [ ] **Step 9: Commit**

```powershell
git add src/user-data-security.js tests/user-data-security.test.js
git commit -m "feat: add secure note and progress helpers"
```

### Task 2: Frontend Security Integration

**Files:**
- Modify: `index.html`
- Create: `tests/user-data-security-ui.test.js`

**Interfaces:**
- Consumes: `window.UserDataSecurity` from Task 1.
- Consumes RPCs created in Task 4:
  - `get_public_notes({ p_question_id })`
  - `upsert_public_note({ p_question_id, p_content })`
  - `toggle_public_note_like({ p_note_id })`
- Consumes Edge Function from Task 5: `supabaseClient.functions.invoke("delete-account", { body: { password } })`.

- [ ] **Step 1: Write failing static security tests**

Assert the desired browser contract:

```js
assert.doesNotMatch(html, /\.from\(['"]public_notes['"]\)/);
assert.doesNotMatch(publicNotesTemplate, /user_email|user_id/);
assert.match(html, /rpc\(['"]get_public_notes['"]/);
assert.match(html, /rpc\(['"]upsert_public_note['"]/);
assert.match(html, /rpc\(['"]toggle_public_note_like['"]/);
assert.match(html, /functions\.invoke\(['"]delete-account['"]/);
assert.doesNotMatch(html, /rpc\(['"]delete_user['"]/);
```

Also assert the template contains a password input for account deletion and a `2000` note counter.

- [ ] **Step 2: Run the static tests and verify RED**

Run:

```powershell
node --test tests/user-data-security-ui.test.js
```

Expected: FAIL on the old table access, email rendering, shared cache, and delete RPC.

- [ ] **Step 3: Load the helper module and implement note limits**

Add:

```html
<script src="src/user-data-security.js"></script>
```

Before mutating private notes, call `validateNoteContent`. If validation fails, show an error toast and return. Add a live code-point counter next to the note editor.

- [ ] **Step 4: Replace public-note table access with RPCs**

- `fetchPublicNotes` calls `get_public_notes`.
- The template renders `display_name`.
- `saveNote` calls `upsert_public_note` only after private-note validation.
- `toggleLike` calls `toggle_public_note_like` and consumes its authoritative `{ is_liked, likes }` result.
- The browser never sends email, UUID, likes, or created-at values for a public note.

- [ ] **Step 5: Replace shared cache and auth transitions**

Remove `LOCAL_STORAGE_KEY`. Route all progress reads/writes through Task 1 helpers.

Create one async auth transition function that:

1. cancels pending sync;
2. resets projected question state and in-memory progress;
3. changes `currentUser`;
4. loads only the target identity's cache;
5. for a signed-in user, loads cloud progress and treats cloud as authoritative when present;
6. uploads only that same user's dedicated cache when the cloud row is absent.

Each delayed sync captures `expectedUserId` and aborts when
`canSyncProgress(expectedUserId, currentUser.value?.id)` is false.

- [ ] **Step 6: Replace account deletion UI and call**

Add reactive `deletePassword` and `deleteError`. Keep the five-second accidental-click delay, but require a non-empty password. Call the Edge Function, keep local state on failure, and on success remove only the deleted user's cache and sign out locally.

- [ ] **Step 7: Run static tests and verify GREEN**

Run:

```powershell
node --test tests/user-data-security-ui.test.js
node --test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/user-data-security-ui.test.js
git commit -m "fix: isolate user data in the frontend"
```

### Task 3: Supabase Project Scaffold and Question Whitelist Generator

**Files:**
- Create: `scripts/generate-valid-question-sql.js`
- Create: `tests/question-whitelist.test.js`
- Create: `supabase/config.toml`
- Create: CLI-generated `supabase/migrations/*_prepare_user_data_security.sql`
- Create: CLI-generated `supabase/migrations/*_finalize_user_data_security.sql`

**Interfaces:**
- Produces deterministic SQL rows of the form:

```sql
insert into private_security.valid_questions (question_id)
values ('question-id')
on conflict (question_id) do nothing;
```

- [ ] **Step 1: Write a failing whitelist-generator test**

Load both question JavaScript files in a VM, call the generator, and assert:

- every local question ID appears exactly once;
- SQL quotes are escaped;
- output is stable across two runs;
- the count equals the unique combined question count.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test tests/question-whitelist.test.js
```

Expected: FAIL because the generator is missing.

- [ ] **Step 3: Implement the generator**

Export reusable functions and support:

```powershell
node scripts/generate-valid-question-sql.js
```

The CLI prints only deterministic SQL to stdout.

- [ ] **Step 4: Run and verify GREEN**

Run the generator test and confirm the unique count is 914.

- [ ] **Step 5: Scaffold Supabase with the CLI**

First discover syntax:

```powershell
npx --yes --registry=https://registry.npmmirror.com supabase@latest --help
npx --yes --registry=https://registry.npmmirror.com supabase@latest init --help
npx --yes --registry=https://registry.npmmirror.com supabase@latest migration new --help
```

The TUNA mirror does not provide an npm package registry, so the npm command uses the available China npm mirror as the documented ecosystem exception.

Then initialize if needed and create both migrations through the CLI:

```powershell
npx --yes --registry=https://registry.npmmirror.com supabase@latest init
npx --yes --registry=https://registry.npmmirror.com supabase@latest migration new prepare_user_data_security
npx --yes --registry=https://registry.npmmirror.com supabase@latest migration new finalize_user_data_security
```

- [ ] **Step 6: Seed the generated migration with the whitelist output**

Append the deterministic SQL output to the CLI-created prepare migration; do not invent migration timestamps manually.

- [ ] **Step 7: Run tests and commit**

```powershell
node --test tests/question-whitelist.test.js
git add scripts/generate-valid-question-sql.js tests/question-whitelist.test.js supabase/config.toml supabase/migrations
git commit -m "build: scaffold Supabase security migration"
```

### Task 4: Database Security Migration and Contract Tests

**Files:**
- Modify: CLI-generated `supabase/migrations/*_prepare_user_data_security.sql`
- Modify: CLI-generated `supabase/migrations/*_finalize_user_data_security.sql`
- Create: `tests/database-security-precutover.sql`
- Create: `tests/database-security-contract.sql`

**Interfaces:**
- Produces public RPC wrappers:
  - `public.get_public_notes(text)`
  - `public.upsert_public_note(text, text)`
  - `public.toggle_public_note_like(uuid)`
- Produces private tables and core functions under `private_security`.

- [ ] **Step 1: Write failing pre-cutover and final database contract SQL**

The pre-cutover SQL raises unless:

- private profiles and the 914-row valid-question whitelist exist;
- new RPC signatures, constraints, and cascade foreign keys exist;
- new RPCs do not return email or UUID fields;
- old frontend table reads and the old like RPC still remain available during cutover.

The final SQL test must raise an exception unless all conditions hold:

- RLS remains enabled on exposed tables.
- `anon` has no execute privilege on new RPCs.
- `authenticated` has execute privilege on wrappers only.
- `authenticated` cannot directly select/insert/update/delete
  `public_notes`, `note_likes`, or private profile/whitelist tables.
- public RPC result definitions contain no `user_id` or `user_email`.
- `(user_id, question_id)` is unique.
- note content and likes checks exist.
- foreign keys cascade from user-owned tables to `auth.users`.
- old `delete_user` and `toggle_note_like` are no longer executable after final hardening.
- all security-definer functions have a fixed `search_path`.

- [ ] **Step 2: Run both contracts against the current database and verify RED**

Use Supabase MCP `execute_sql` to run the read-only metadata assertions. Expected: failures matching the known vulnerabilities.

- [ ] **Step 3: Implement reversible data preparation**

In the migration:

- create unexposed `private_security`;
- create stable anonymous profiles;
- create `valid_questions`;
- move duplicates and orphan rows to dated backup tables before deleting originals;
- add missing cascade foreign keys;
- add unique and check constraints;
- preserve the legacy email and likes columns but stop treating them as authoritative.

- [ ] **Step 4: Implement private privileged functions**

Every core function:

- is in `private_security`;
- is `SECURITY DEFINER`;
- uses `SET search_path = pg_catalog, private_security`;
- references all non-catalog objects with explicit schemas;
- rejects null `auth.uid()`;
- verifies the user still exists in `auth.users`.

- [ ] **Step 5: Implement public invoker wrappers and grants**

Wrappers are `SECURITY INVOKER`, return only minimal fields, and call fixed-signature private functions. Revoke function execution from `PUBLIC` and `anon`; grant only the exact wrapper signatures to `authenticated`.

- [ ] **Step 6: Implement final table and legacy-function hardening in the second migration**

After frontend cutover:

- revoke direct table privileges;
- remove broad old RLS policies;
- revoke execution on `delete_user()` and old `toggle_note_like(uuid)`;
- set a fixed `search_path` on retained legacy functions.

- [ ] **Step 7: Apply only the prepare migration and run the pre-cutover contract**

Use Supabase MCP `execute_sql` with the exact prepare migration SQL. Then run
`tests/database-security-precutover.sql`.

Expected: the pre-cutover contract succeeds and the currently deployed frontend remains compatible.

- [ ] **Step 8: Commit**

```powershell
git add supabase/migrations tests/database-security-precutover.sql tests/database-security-contract.sql
git commit -m "fix: harden public note database access"
```

### Task 5: Password-Verified Account Deletion Edge Function

**Files:**
- Create: `supabase/functions/delete-account/deno.json`
- Create: `supabase/functions/delete-account/index.ts`
- Create: `supabase/functions/delete-account/handler.mjs`
- Create: `tests/delete-account-handler.test.js`

**Interfaces:**
- `POST /functions/v1/delete-account`
- Body: `{ "password": string }`
- Success: HTTP 200 with `{ "ok": true }`
- Invalid request: HTTP 400
- Invalid session/password/user mismatch: HTTP 401
- Internal failure: HTTP 500

- [ ] **Step 1: Write failing function tests**

Factor the handler in `handler.mjs` as:

```js
export function createDeleteAccountHandler(deps) {
  return async function handleDeleteAccount(request) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    return deps.deleteVerifiedCaller(request);
  };
}
```

Tests cover method rejection, missing bearer token, empty/overlong password, invalid token, wrong password, mismatched user, and successful session revocation plus deletion.

- [ ] **Step 2: Run tests and verify RED**

```powershell
node --test tests/delete-account-handler.test.js
```

Expected: FAIL because `handler.mjs` is missing.

- [ ] **Step 3: Implement the handler**

In `deno.json`, pin `@supabase/supabase-js` to `npm:@supabase/supabase-js@2.108.2`.
Construct:

- a caller client that validates the bearer token with `auth.getUser(token)`;
- an isolated anonymous client with `persistSession: false` that verifies email/password using `signInWithPassword`;
- an admin client that revokes sessions and deletes only the verified caller ID.

Never log password, token, or full email.

- [ ] **Step 4: Run function tests and verify GREEN**

Run:

```powershell
node --test tests/delete-account-handler.test.js
```

Expected: all handler tests pass.

- [ ] **Step 5: Deploy with JWT verification enabled**

Use the connected Supabase deployment tool with `verify_jwt: true`, including `index.ts` and `deno.json`.

- [ ] **Step 6: Verify non-destructive production cases**

Call the deployed function without a token and with an invalid token; expect `401`.
Do not run the successful-delete path against an existing real account.

- [ ] **Step 7: Commit**

```powershell
git add supabase/functions/delete-account
git commit -m "feat: require password for account deletion"
```

### Task 6: Static Frontend Deployment and Final Database Cutover

**Files:**
- No source files are changed in this task.

**Interfaces:**
- Verifies all deliverables from Tasks 1–5.

- [ ] **Step 1: Load the Cloudflare deployment skills**

Use `cloudflare:cloudflare`, `cloudflare:wrangler`, and
`cloudflare:workers-best-practices` before running Wrangler commands.

- [ ] **Step 2: Discover and verify Wrangler deployment**

```powershell
npx --yes --registry=https://registry.npmmirror.com wrangler@latest --help
npx --yes --registry=https://registry.npmmirror.com wrangler@latest whoami
npx --yes --registry=https://registry.npmmirror.com wrangler@latest deploy --dry-run
```

Expected: authenticated account and a successful dry run.

- [ ] **Step 3: Run all local tests before deployment**

```powershell
node --test
npm run build
git diff --check
```

Expected: zero test failures, build exit code 0, no whitespace errors.

- [ ] **Step 4: Verify browser-sensitive source patterns**

```powershell
rg -n "user_email|\\.from\\(['\"]public_notes|rpc\\(['\"]delete_user|maogai_progress_v1" index.html src tests
```

Expected: no production references except an intentional legacy-migration constant inside the tested helper.

- [ ] **Step 5: Deploy the new static frontend**

```powershell
npx --yes --registry=https://registry.npmmirror.com wrangler@latest deploy
```

Open `https://scau-test.top`, verify the served HTML contains
`get_public_notes`, `toggle_public_note_like`, and `delete-account`, and verify it no longer contains direct public-note table access.

- [ ] **Step 6: Apply the final hardening migration**

Use Supabase MCP `execute_sql` with the exact final migration SQL only after Step 5 verifies the new frontend is live.

- [ ] **Step 7: Run final remote database verification**

Check:

- authenticated RPC result columns;
- direct table privilege denial;
- duplicate and length constraints;
- function execute grants and fixed search paths;
- security advisor output.

- [ ] **Step 8: Verify deployed Edge Function metadata**

Confirm `delete-account` is active and `verify_jwt` is enabled.

- [ ] **Step 9: Review repository state**

Run `git status --short`, `git log --oneline`, and `git diff --check`. Do not commit generated `style.css`, which is ignored.

- [ ] **Step 10: Invoke branch-finishing workflow**

Use `superpowers:verification-before-completion`, then
`superpowers:finishing-a-development-branch`. Present merge/PR/cleanup options only after all verification evidence is fresh.
