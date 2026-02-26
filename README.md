# 毛概刷题助手（本地版）

一个基于 **Flask + Vue 3 + Tailwind CSS** 的本地刷题工具。

## 功能简介

- 按章节、题型筛选题目
- 支持顺序练习、随机抽题、只刷错题
- 支持三类标记：星标 / 重点 / 难记
- 支持主观题自评与错题累计
- 支持为每道题保存笔记

## 项目结构

- `app.py`：Flask 后端，提供页面与 API
- `templates/index.html`：前端页面（Vue 3 单页）
- `questions.json`：主题库文件（也会保存错题次数、标签、笔记）
- `add_tags_once.py`：一次性补齐标签字段（`tag_star/tag_key/tag_hard`）
- `add_note_script.py`：一次性补齐 `note` 字段
- `export_questions_only_md.py`：从题库导出仅题干的 Markdown 文件
- `材料/merge_questions_once.py`：将章节题库合并为 `材料/questions.json`

## 运行方式

1. 安装依赖：

   ```bash
   pip install flask
   ```

2. 在项目根目录启动：

   ```bash
   python app.py
   ```

3. 浏览器访问：

   ```
   http://127.0.0.1:5000
   ```

## 数据说明

题目对象常见字段：

- `id`：题目唯一标识
- `chapter`：章节
- `type`：题型
- `question_content`：题干与选项
- `answer`：参考答案
- `error_count`：错误次数
- `note`：个人笔记
- `tag_star` / `tag_key` / `tag_hard`：标签布尔值

## 脚本说明

- 合并章节题库：在 `材料/` 目录运行 `python merge_questions_once.py`
- 补齐标签字段：在根目录运行 `python add_tags_once.py`
- 补齐笔记字段：在根目录运行 `python add_note_script.py`
- 导出题干 Markdown：在根目录运行 `python export_questions_only_md.py`

## 版本管理建议

- 已在 `.gitignore` 中忽略 Python 缓存、虚拟环境、备份文件与导出产物。
- 目前 **`questions.json` 默认保留追踪**（便于直接使用与共享）。
  - 若你希望将个人刷题记录（错题次数/笔记/标签）与题库分离，可后续增加 `questions.local.json` 方案。
