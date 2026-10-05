(function (root) {
  "use strict";

  root.AiAssistantComponent = {
    props: {
      question: { type: Object, required: true },
      subject: { type: String, required: true },
      userId: { type: String, default: "" },
      selectedAnswer: { type: String, default: "" },
    },
    emits: ["note-draft"],
    setup(props, { emit }) {
      const { ref, computed, watch, nextTick, onUnmounted } = root.Vue;
      const api = root.AiAssistant;
      let store;
      try { store = api.createConversationStore(root.indexedDB); }
      catch { store = api.createConversationStore(null); }
      const open = ref(false);
      const showSettings = ref(false);
      const revealKey = ref(false);
      const draft = ref(api.normalizeConfig());
      const savedConfig = ref(api.normalizeConfig());
      const messages = ref([]);
      const backup = ref([]);
      const input = ref("");
      const error = ref("");
      const storageWarning = ref("");
      const configNotice = ref("");
      const loading = ref(true);
      const generating = ref(false);
      const messageList = ref(null);
      const followScroll = ref(true);
      let loadVersion = 0;
      let saveTimer;
      let activeRequest;
      let currentId = "";
      const ready = computed(() => Boolean(savedConfig.value.url && savedConfig.value.key && savedConfig.value.model));
      const lastReply = computed(() => [...messages.value].reverse().find((message) => message.role === "assistant" && ["complete", "truncated"].includes(message.status) && message.content));
      const statuses = { generating: "正在生成…", stopped: "已停止", error: "生成失败", truncated: "已达到模型输出上限" };

      function snapshot() {
        return { id: currentId, messages: api.restoreMessages(messages.value), backup: api.restoreMessages(backup.value), updatedAt: Date.now() };
      }
      function saveNow() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!currentId || loading.value) return;
        store.put(snapshot()).catch(() => { storageWarning.value = "对话未能保存到本机，请检查浏览器存储权限和剩余空间。当前页面仍可继续使用。"; });
      }
      function scheduleSave() {
        if (saveTimer) return;
        saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 400);
      }
      function stop() {
        if (!activeRequest) return;
        const request = activeRequest;
        activeRequest = null;
        request.controller.abort();
        request.message.status = "stopped";
        request.message.error = "已停止生成；供应商可能仍会计费。";
        generating.value = false;
        saveNow();
      }
      async function scrollToReply() {
        await nextTick();
        if (followScroll.value && messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
      }
      function trackScroll() {
        const list = messageList.value;
        if (list) followScroll.value = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      }

      watch(() => api.conversationId(props.userId, props.subject, props.question.id), async (id) => {
        stop();
        saveNow();
        const version = ++loadVersion;
        currentId = id;
        loading.value = true;
        messages.value = [];
        backup.value = [];
        input.value = "";
        error.value = "";
        storageWarning.value = "";
        configNotice.value = "";
        revealKey.value = false;
        try { savedConfig.value = api.readConfig(root.localStorage, props.userId); }
        catch (failure) { savedConfig.value = api.normalizeConfig(); storageWarning.value = failure.message; }
        draft.value = { ...savedConfig.value };
        showSettings.value = !ready.value && open.value;
        try {
          const record = await store.get(id);
          if (version !== loadVersion) return;
          messages.value = api.restoreMessages(record?.messages);
          backup.value = api.restoreMessages(record?.backup);
        } catch {
          if (version === loadVersion) storageWarning.value = "无法读取本机对话，请检查浏览器存储权限。当前页面仍可使用，对话可能无法保存。";
        } finally {
          if (version === loadVersion) { loading.value = false; followScroll.value = true; scrollToReply(); }
        }
      }, { immediate: true });

      function toggleOpen() {
        open.value = !open.value;
        if (open.value && !ready.value) showSettings.value = true;
        if (open.value) scrollToReply();
      }
      function configure() {
        open.value = true;
        showSettings.value = !showSettings.value;
        revealKey.value = false;
      }
      function saveSettings() {
        if (generating.value) return;
        try {
          savedConfig.value = api.saveConfig(root.localStorage, props.userId, draft.value);
          draft.value = { ...savedConfig.value };
          error.value = "";
          configNotice.value = "API 配置已保存到此浏览器。";
          revealKey.value = false;
          showSettings.value = false;
        } catch (failure) { error.value = failure.message; configNotice.value = ""; }
      }
      function forgetKey() {
        if (generating.value) return;
        try {
          const config = { ...savedConfig.value, key: "" };
          root.localStorage.setItem(api.configKey(props.userId), JSON.stringify(config));
          savedConfig.value = config;
          draft.value = { ...config };
          revealKey.value = false;
          error.value = "";
          configNotice.value = "已从本机配置中移除 API Key。";
        } catch { error.value = "无法移除本机 Key，请检查浏览器存储权限。"; }
      }

      async function send(text = input.value) {
        if (generating.value || loading.value || !props.question.id) return;
        const prompt = text.trim();
        if (!prompt) return;
        if (prompt.length > api.MAX_INPUT_LENGTH) { error.value = `每次提问最多 ${api.MAX_INPUT_LENGTH} 个字符。`; return; }
        try { api.validateConfig(savedConfig.value); }
        catch (failure) { error.value = failure.message; open.value = true; showSettings.value = true; return; }
        error.value = "";
        configNotice.value = "";
        open.value = true;
        generating.value = true;
        followScroll.value = true;
        messages.value.push({ id: root.crypto.randomUUID(), role: "user", content: prompt, status: "complete", createdAt: Date.now() });
        const payload = api.buildMessages(props.question, props.subject, messages.value, props.selectedAnswer);
        messages.value.push({ id: root.crypto.randomUUID(), role: "assistant", content: "", status: "generating", createdAt: Date.now() });
        const assistant = messages.value[messages.value.length - 1];
        const request = { controller: new AbortController(), message: assistant };
        activeRequest = request;
        input.value = "";
        saveNow();
        scrollToReply();
        try {
          const result = await api.requestChat({
            config: { ...savedConfig.value }, messages: payload, signal: request.controller.signal,
            onDelta(delta) {
              if (activeRequest !== request) return;
              assistant.content += delta;
              scheduleSave();
              scrollToReply();
            },
          });
          if (activeRequest !== request) return;
          assistant.status = result.finishReason === "length" ? "truncated" : "complete";
        } catch (failure) {
          if (activeRequest !== request) return;
          assistant.status = failure.code === "aborted" ? "stopped" : "error";
          assistant.error = failure.message;
          error.value = failure.message;
        } finally {
          if (activeRequest === request) {
            activeRequest = null;
            generating.value = false;
            saveNow();
            scrollToReply();
          }
        }
      }

      function clearConversation() {
        if (generating.value || !messages.value.length) return;
        backup.value = api.restoreMessages(messages.value);
        messages.value = [];
        error.value = "";
        saveNow();
      }
      function undoClear() {
        if (generating.value || !backup.value.length) return;
        // Keep any new messages created after clearing as well.
        messages.value = [...api.restoreMessages(backup.value), ...messages.value];
        backup.value = [];
        saveNow();
        followScroll.value = true;
        scrollToReply();
      }
      const saveNoteDraft = () => { if (lastReply.value) emit("note-draft", lastReply.value.content); };
      const beforeLeave = () => { stop(); saveNow(); };
      root.addEventListener("pagehide", beforeLeave);
      onUnmounted(() => { ++loadVersion; beforeLeave(); root.removeEventListener("pagehide", beforeLeave); });

      return { open, showSettings, revealKey, draft, ready, messages, backup, input, error, storageWarning, configNotice, loading, generating, messageList, lastReply, statuses, maxInput: api.MAX_INPUT_LENGTH, toggleOpen, configure, saveSettings, forgetKey, send, stop, trackScroll, clearConversation, undoClear, saveNoteDraft };
    },
    template: `
      <section data-ai-assistant data-swipe-ignore @keydown.stop class="mt-6 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-900/10 overflow-hidden">
        <div class="flex items-center justify-between gap-3 p-4 sm:p-5">
          <button type="button" @click="toggleOpen" :aria-expanded="open" class="text-left flex-1 min-w-0">
            <span class="block font-bold text-indigo-700 dark:text-indigo-300">✦ AI 解题助手 <span class="text-xs font-normal ml-2">{{ open ? '收起 ▲' : '展开 ▼' }}</span></span>
            <span class="block text-xs text-slate-500 dark:text-slate-400 mt-1">自带 API · 本机保存 · {{ ready ? '已配置' : '尚未配置' }}</span>
          </button>
          <button type="button" @click="configure" :disabled="generating" class="shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-300 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 disabled:opacity-50">API 设置</button>
        </div>
        <div v-if="open" class="px-4 pb-4 sm:px-5 sm:pb-5 space-y-4">
          <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Key、请求网址和对话保存在此浏览器，按登录账号隔离，未登录也可使用。请求直达你填写的 API 服务，需支持跨域，费用由供应商计收。清理网站数据会丢失本机记录。</p>
          <form v-if="showSettings" @submit.prevent="saveSettings" class="space-y-3 rounded-xl bg-white dark:bg-surface-800 border border-slate-200 dark:border-slate-700 p-4">
            <label class="block text-sm text-slate-700 dark:text-slate-200">完整请求网址
              <input v-model="draft.url" type="url" required autocomplete="off" spellcheck="false" maxlength="2048" placeholder="https://api.example.com/v1/chat/completions" class="block mt-1 w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
            </label>
            <p class="text-xs text-slate-500 dark:text-slate-400">支持 OpenAI 兼容的 Chat Completions 接口。填写完整请求地址，通常以 /chat/completions 结尾。</p>
            <label class="block text-sm text-slate-700 dark:text-slate-200">模型名称
              <input v-model="draft.model" type="text" required autocomplete="off" spellcheck="false" maxlength="200" placeholder="填写供应商提供的模型 ID" class="block mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
            </label>
            <label class="block text-sm text-slate-700 dark:text-slate-200">API Key
              <span class="flex mt-1 gap-2">
                <input v-model="draft.key" :type="revealKey ? 'text' : 'password'" required autocomplete="off" spellcheck="false" maxlength="8192" placeholder="输入你的 API Key" class="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                <button type="button" @click="revealKey = !revealKey" :aria-pressed="revealKey" class="shrink-0 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-600">{{ revealKey ? '隐藏' : '显示' }}</button>
              </span>
            </label>
            <p class="text-xs text-amber-700 dark:text-amber-300">Key 以明文保存在本机，浏览器同源脚本可以读取。请勿在共享设备保存高权限 Key。</p>
            <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" v-model="draft.stream">流式回复（逐字显示；不支持时可关闭）</label>
            <div class="flex items-center justify-between gap-2">
              <button type="submit" :disabled="generating" class="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">保存配置</button>
              <button v-if="ready" type="button" @click="forgetKey" :disabled="generating" class="px-2 py-2 text-xs text-red-600 dark:text-red-300 disabled:opacity-50">忘记本机 Key</button>
            </div>
          </form>
          <p v-if="configNotice" role="status" class="text-xs text-emerald-700 dark:text-emerald-300">{{ configNotice }}</p>
          <p v-if="storageWarning" role="status" class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">{{ storageWarning }}</p>
          <p v-if="error" role="alert" class="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm leading-relaxed text-red-700 dark:text-red-300">{{ error }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" @click="send('请讲解本题的考点、解题思路，并说明各选项的判断依据。')" :disabled="generating || loading" class="rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm font-bold disabled:opacity-50">讲解本题</button>
            <button type="button" @click="send('请总结本题的易错点，并给出便于记忆的方法。')" :disabled="generating || loading" class="rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 px-3 py-2 text-sm disabled:opacity-50">易错点与记忆</button>
            <button v-if="messages.length" type="button" @click="clearConversation" :disabled="generating || loading" class="ml-auto text-xs text-slate-500 dark:text-slate-400 px-2 py-2 disabled:opacity-50">清空本题对话</button>
            <button v-if="backup.length" type="button" @click="undoClear" :disabled="generating || loading" class="text-xs font-bold text-indigo-600 dark:text-indigo-300 px-2 py-2 disabled:opacity-50">撤销清空</button>
          </div>
          <div ref="messageList" @scroll="trackScroll" aria-label="本题 AI 对话记录" :aria-busy="generating || loading" class="max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
            <p v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">正在读取本机对话…</p>
            <p v-else-if="!messages.length" class="py-3 text-sm text-slate-500 dark:text-slate-400">点击“讲解本题”，或输入你的问题。当前题目、选项、参考答案、你的作答和最近 10 轮完整对话会随请求发送。</p>
            <article v-for="message in messages" :key="message.id" class="rounded-xl p-3 sm:p-4 border" :class="message.role === 'user' ? 'bg-indigo-100/60 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800/50' : 'bg-white dark:bg-surface-800 border-slate-200 dark:border-slate-700'">
              <div class="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">{{ message.role === 'user' ? '我的提问' : 'AI 回复' }} <span class="ml-2 font-normal">{{ statuses[message.status] || '' }}</span></div>
              <div class="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{{ message.content }}</div>
              <p v-if="message.error" class="mt-2 text-xs leading-relaxed text-red-600 dark:text-red-300">{{ message.error }}</p>
            </article>
          </div>
          <form @submit.prevent="send()" class="space-y-2">
            <label class="sr-only" for="ai-question-input">向 AI 提问</label>
            <textarea id="ai-question-input" v-model="input" :maxlength="maxInput" :disabled="generating || loading" @keydown.ctrl.enter.prevent="send()" @keydown.meta.enter.prevent="send()" placeholder="例如：为什么 B 选项不正确？（Ctrl / ⌘ + Enter 发送）" rows="3" class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 p-3 resize-y outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"></textarea>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-slate-400">{{ input.length }} / {{ maxInput }}</span>
              <button v-if="generating" type="button" @click="stop" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-bold">停止生成</button>
              <button v-else type="submit" :disabled="!input.trim() || loading" class="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">发送</button>
            </div>
          </form>
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>AI 解析供学习参考，请结合教材核对。</span>
            <button v-if="lastReply" type="button" @click="saveNoteDraft" :disabled="generating" class="font-bold text-indigo-600 dark:text-indigo-300 disabled:opacity-50">将最新回复加入笔记草稿</button>
          </div>
        </div>
      </section>
    `,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
