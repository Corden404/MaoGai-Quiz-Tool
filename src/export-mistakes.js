(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MistakeExporter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_MIN_COUNT = 1;

  const SUBJECT_NAMES = {
    maogai: "毛概",
    mayuan: "马原",
  };

  const EXPORT_SCOPES = {
    mistake: {
      label: "错题",
      collectionName: "错题本",
      conditionText: (meta) => `错题次数 >= ${normalizeMinCount(meta.minCount)}`,
    },
    star: {
      label: "星标",
      collectionName: "星标题本",
      conditionText: () => "星标题目",
      tagField: "tag_star",
    },
    key: {
      label: "重点",
      collectionName: "重点题本",
      conditionText: () => "重点题目",
      tagField: "tag_key",
    },
    hard: {
      label: "难记",
      collectionName: "难记题本",
      conditionText: () => "难记题目",
      tagField: "tag_hard",
    },
  };

  const SORT_MODES = new Set(["chapter", "mistake", "type"]);

  const pad = (value) => String(value).padStart(2, "0");

  const formatDateTime = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const subjectNameFromId = (subjectId) => SUBJECT_NAMES[subjectId] || subjectId || "当前科目";

  const normalizeMinCount = (minCount) => Math.max(DEFAULT_MIN_COUNT, Number(minCount || DEFAULT_MIN_COUNT));

  const getErrorCount = (question) => Math.max(0, Number(question?.error_count || 0));

  const parseChineseNumber = (value) => {
    const text = String(value || "").trim();
    if (/^\d+$/.test(text)) return Number(text);
    const digitMap = {
      零: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    };
    if (text === "十") return 10;
    if (text.startsWith("十")) return 10 + (digitMap[text.slice(1)] || 0);
    if (text.includes("十")) {
      const [tens, ones] = text.split("十");
      return (digitMap[tens] || 1) * 10 + (digitMap[ones] || 0);
    }
    return digitMap[text] ?? Number.MAX_SAFE_INTEGER;
  };

  const chapterOrder = (chapter) => {
    const text = String(chapter || "");
    if (text.includes("导论")) return 0;
    if (text.includes("结束语")) return 999;
    const match = text.match(/第([一二两三四五六七八九十\d]+)章/);
    return match ? parseChineseNumber(match[1]) : Number.MAX_SAFE_INTEGER;
  };

  const normalizeScopes = (value) => {
    const rawScopes = Array.isArray(value) ? value : value ? [value] : [];
    const scopes = [];
    rawScopes.forEach((scope) => {
      if (EXPORT_SCOPES[scope] && !scopes.includes(scope)) scopes.push(scope);
    });
    return scopes.length ? scopes : ["mistake"];
  };

  const normalizeSortMode = (sortMode) => (SORT_MODES.has(sortMode) ? sortMode : "chapter");

  const buildConditionText = (scopes, minCount) =>
    scopes.map((scope) => EXPORT_SCOPES[scope].conditionText({ minCount })).join("、");

  const getExportReasons = (question, scopes, minCount) =>
    scopes.reduce((reasons, scope) => {
      const scopeMeta = EXPORT_SCOPES[scope];
      if (scope === "mistake" && getErrorCount(question) >= minCount) {
        reasons.push(scopeMeta.label);
      } else if (scopeMeta.tagField && question?.[scopeMeta.tagField]) {
        reasons.push(scopeMeta.label);
      }
      return reasons;
    }, []);

  const exportReasonText = (question, meta) => {
    const reasons = Array.isArray(question?.export_reasons)
      ? question.export_reasons
      : getExportReasons(question, meta.scopes, meta.minCount);
    return reasons.filter(Boolean).join("、");
  };

  const normalizeLineBreaks = (text) => String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  const escapeHtml = (text) =>
    String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const textToHtml = (text) => escapeHtml(normalizeLineBreaks(text)).replace(/\n/g, "<br>");

  const optionEntries = (question) => {
    if (!question?.options || typeof question.options !== "object") return [];
    return Object.entries(question.options)
      .filter(([, value]) => String(value || "").trim())
      .sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
  };

  const groupBy = (questions, getTitle) => {
    const groups = [];
    const groupMap = new Map();

    questions.forEach((question) => {
      const title = getTitle(question);
      if (!groupMap.has(title)) {
        const group = { title, questions: [] };
        groupMap.set(title, group);
        groups.push(group);
      }
      groupMap.get(title).questions.push(question);
    });

    return groups;
  };

  const compareExportQuestions = (a, b, sortMode = "chapter") => {
    const normalizedMode = normalizeSortMode(sortMode);
    if (normalizedMode === "mistake") {
      const countDiff = getErrorCount(b) - getErrorCount(a);
      if (countDiff !== 0) return countDiff;
    }
    if (normalizedMode === "type") {
      const typeDiff = String(a.type || "").localeCompare(String(b.type || ""), "zh-CN");
      if (typeDiff !== 0) return typeDiff;
    }
    const chapterOrderDiff = chapterOrder(a.chapter) - chapterOrder(b.chapter);
    if (chapterOrderDiff !== 0) return chapterOrderDiff;
    const chapterDiff = String(a.chapter || "").localeCompare(String(b.chapter || ""), "zh-CN");
    if (chapterDiff !== 0) return chapterDiff;
    const typeDiff = String(a.type || "").localeCompare(String(b.type || ""), "zh-CN");
    if (typeDiff !== 0) return typeDiff;
    return String(a.id || "").localeCompare(String(b.id || ""), "zh-CN");
  };

  const sortExportQuestions = (questions, sortMode = "chapter") =>
    (Array.isArray(questions) ? questions : []).slice().sort((a, b) => compareExportQuestions(a, b, sortMode));

  const buildQuestionGroups = (questions, sortMode = "chapter") => {
    const normalizedMode = normalizeSortMode(sortMode);
    const sortedQuestions = sortExportQuestions(questions, normalizedMode);

    if (normalizedMode === "mistake") return [{ title: "", questions: sortedQuestions }];
    if (normalizedMode === "type") return groupBy(sortedQuestions, (question) => question.type || "未知题型");
    return groupBy(sortedQuestions, (question) => question.chapter || "未知章节");
  };

  const selectMistakeQuestions = (questions, options = {}) => {
    const minCount = normalizeMinCount(options.minCount);
    const chapters = Array.isArray(options.chapters) && options.chapters.length ? new Set(options.chapters) : null;
    const types = Array.isArray(options.types) && options.types.length ? new Set(options.types) : null;

    return (Array.isArray(questions) ? questions : [])
      .filter((question) => getErrorCount(question) >= minCount)
      .filter((question) => !chapters || chapters.has(question.chapter))
      .filter((question) => !types || types.has(question.type))
      .slice()
      .sort((a, b) => {
        const countDiff = getErrorCount(b) - getErrorCount(a);
        if (countDiff !== 0) return countDiff;
        const chapterDiff = String(a.chapter || "").localeCompare(String(b.chapter || ""), "zh-CN");
        if (chapterDiff !== 0) return chapterDiff;
        return String(a.id || "").localeCompare(String(b.id || ""), "zh-CN");
      });
  };

  const selectExportQuestions = (questions, options = {}) => {
    const scopes = normalizeScopes(options.scopes || options.scope);
    const minCount = normalizeMinCount(options.minCount);
    const chapters = Array.isArray(options.chapters) && options.chapters.length ? new Set(options.chapters) : null;
    const types = Array.isArray(options.types) && options.types.length ? new Set(options.types) : null;
    const sortMode = normalizeSortMode(options.sortMode);

    return (Array.isArray(questions) ? questions : [])
      .filter((question) => !chapters || chapters.has(question.chapter))
      .filter((question) => !types || types.has(question.type))
      .reduce((selected, question) => {
        const reasons = getExportReasons(question, scopes, minCount);
        if (reasons.length) selected.push({ ...question, export_reasons: reasons });
        return selected;
      }, [])
      .sort((a, b) => compareExportQuestions(a, b, sortMode));
  };

  const createExportMeta = (meta = {}) => {
    const scopes = normalizeScopes(meta.scopes || meta.scope);
    const minCount = normalizeMinCount(meta.minCount);
    const collectionName = scopes.length === 1 ? EXPORT_SCOPES[scopes[0]].collectionName : "综合题本";
    return {
      subjectName: meta.subjectName || subjectNameFromId(meta.subjectId),
      collectionName: meta.collectionName || collectionName,
      conditionText: meta.conditionText || buildConditionText(scopes, minCount),
      generatedAtText: formatDateTime(meta.generatedAt || new Date()),
      minCount,
      scope: scopes[0],
      scopes,
      includeAnswer: meta.includeAnswer !== false,
      includeNote: meta.includeNote !== false,
      sortMode: normalizeSortMode(meta.sortMode),
      chapterCount: Array.isArray(meta.chapters) ? meta.chapters.length : 0,
      typeCount: Array.isArray(meta.types) ? meta.types.length : 0,
    };
  };

  const formatMistakesMarkdown = (questions, meta = {}) => {
    const exportMeta = createExportMeta(meta);
    const groups = buildQuestionGroups(questions, exportMeta.sortMode);
    const lines = [
      `# ${exportMeta.subjectName}${exportMeta.collectionName}`,
      "",
      `生成时间：${exportMeta.generatedAtText}`,
      `筛选条件：${exportMeta.conditionText}`,
      `共 ${questions.length} 题`,
      "",
    ];

    groups.forEach((group) => {
      if (group.title) lines.push(`## ${group.title}`, "");

      group.questions.forEach((question, index) => {
        lines.push(`### ${index + 1}. [${question.type || "未知题型"}]`);
        lines.push("");
        lines.push(`**题型：** ${question.type || "未知题型"}`);
        lines.push("");
        lines.push(`**错题次数：** ${getErrorCount(question)}`);
        lines.push("");
        const reasons = exportReasonText(question, exportMeta);
        if (reasons) {
          lines.push(`**导出来源：** ${reasons}`);
          lines.push("");
        }
        lines.push(`**题目：** ${normalizeLineBreaks(question.question_content)}`);
        lines.push("");

        const options = optionEntries(question);
        if (options.length) {
          lines.push("**选项：**");
          options.forEach(([key, value]) => {
            lines.push(`${key}. ${normalizeLineBreaks(value)}`);
          });
          lines.push("");
        }

        if (exportMeta.includeAnswer) {
          lines.push(`**答案：** ${normalizeLineBreaks(question.answer) || "（无）"}`);
        }

        if (exportMeta.includeNote && normalizeLineBreaks(question.note)) {
          lines.push("");
          lines.push(`**我的笔记：** ${normalizeLineBreaks(question.note)}`);
        }

        lines.push("");
      });
    });

    return lines.join("\n").trim() + "\n";
  };

  const formatMistakesText = (questions, meta = {}) => {
    const exportMeta = createExportMeta(meta);
    const groups = buildQuestionGroups(questions, exportMeta.sortMode);
    const title = `${exportMeta.subjectName}${exportMeta.collectionName}`;
    const lines = [
      title,
      "=".repeat(title.length),
      "",
      `生成时间：${exportMeta.generatedAtText}`,
      `筛选条件：${exportMeta.conditionText}`,
      `共 ${questions.length} 题`,
      "",
    ];

    groups.forEach((group) => {
      if (group.title) lines.push(group.title, "-".repeat(group.title.length), "");

      group.questions.forEach((question, index) => {
        lines.push(`${index + 1}. [${question.type || "未知题型"}]`);
        lines.push(`题型：${question.type || "未知题型"}`);
        lines.push(`错题次数：${getErrorCount(question)}`);
        const reasons = exportReasonText(question, exportMeta);
        if (reasons) lines.push(`导出来源：${reasons}`);
        lines.push(`题目：${normalizeLineBreaks(question.question_content)}`);

        const options = optionEntries(question);
        if (options.length) {
          lines.push("选项：");
          options.forEach(([key, value]) => {
            lines.push(`${key}. ${normalizeLineBreaks(value)}`);
          });
        }

        if (exportMeta.includeAnswer) {
          lines.push(`答案：${normalizeLineBreaks(question.answer) || "（无）"}`);
        }

        if (exportMeta.includeNote && normalizeLineBreaks(question.note)) {
          lines.push(`我的笔记：${normalizeLineBreaks(question.note)}`);
        }

        lines.push("");
      });
    });

    return lines.join("\n").trim() + "\n";
  };

  const formatMistakesPrintHtml = (questions, meta = {}) => {
    const exportMeta = createExportMeta(meta);
    const groups = buildQuestionGroups(questions, exportMeta.sortMode);
    const sections = groups
      .map((group) => {
        const items = group.questions
          .map((question, index) => {
            const options = optionEntries(question)
              .map(([key, value]) => `<li><span>${escapeHtml(key)}.</span> ${textToHtml(value)}</li>`)
              .join("");
            const note = exportMeta.includeNote && normalizeLineBreaks(question.note)
              ? `<div class="answer-block note"><strong>我的笔记：</strong>${textToHtml(question.note)}</div>`
              : "";
            const answer = exportMeta.includeAnswer
              ? `<div class="answer-block"><strong>答案：</strong>${textToHtml(question.answer) || "（无）"}</div>`
              : "";
            const reasons = exportReasonText(question, exportMeta);
            const source = reasons ? `<div class="meta source">导出来源：${escapeHtml(reasons)}</div>` : "";

            return `
              <article class="question">
                <h3>${index + 1}. [${escapeHtml(question.type || "未知题型")}]</h3>
                <div class="meta">错题次数：${getErrorCount(question)}</div>
                ${source}
                <p class="stem">${textToHtml(question.question_content)}</p>
                ${options ? `<ol class="options">${options}</ol>` : ""}
                ${answer}
                ${note}
              </article>
            `;
          })
          .join("");

        return `
          <section class="chapter">
            ${group.title ? `<h2>${escapeHtml(group.title)}</h2>` : ""}
            ${items}
          </section>
        `;
      })
      .join("");

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(exportMeta.subjectName + exportMeta.collectionName)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
      line-height: 1.65;
      background: #fff;
    }
    .page { max-width: 820px; margin: 0 auto; padding: 28px 24px; }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.25; }
    .summary { color: #475569; font-size: 13px; margin-bottom: 28px; }
    .summary span { display: inline-block; margin-right: 16px; }
    h2 {
      margin: 28px 0 14px;
      padding-bottom: 6px;
      border-bottom: 2px solid #d1fae5;
      color: #047857;
      font-size: 20px;
      break-after: avoid;
    }
    .question {
      margin: 0 0 20px;
      padding: 14px 0 18px;
      border-bottom: 1px solid #e5e7eb;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    h3 { margin: 0 0 6px; font-size: 16px; color: #0f172a; }
    .meta { margin-bottom: 8px; color: #dc2626; font-size: 13px; font-weight: 700; }
    .source { color: #047857; }
    .stem { margin: 8px 0 10px; white-space: normal; }
    .options { margin: 8px 0 12px; padding-left: 0; list-style: none; }
    .options li { margin: 4px 0; }
    .options span { font-weight: 700; }
    .answer-block {
      margin-top: 10px;
      padding: 10px 12px;
      border-left: 3px solid #10b981;
      background: #f0fdf4;
    }
    .note {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }
    @media print {
      .page { max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>${escapeHtml(exportMeta.subjectName + exportMeta.collectionName)}</h1>
    <div class="summary">
      <span>生成时间：${escapeHtml(exportMeta.generatedAtText)}</span>
      <span>筛选条件：${escapeHtml(exportMeta.conditionText)}</span>
      <span>共 ${questions.length} 题</span>
    </div>
    ${sections}
  </main>
</body>
</html>`;
  };

  return {
    createExportMeta,
    formatMistakesMarkdown,
    formatMistakesPrintHtml,
    formatMistakesText,
    selectExportQuestions,
    selectMistakeQuestions,
    subjectNameFromId,
  };
});
