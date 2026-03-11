import json
import os
import collections

def extract_for_ai():
    # 获取项目根目录 (假设脚本在 src 目录下)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(base_dir, 'questions_with_note.json')
    output_dir = os.path.join(base_dir, 'resources')
    
    # 清空或确保 resources 目录存在
    os.makedirs(output_dir, exist_ok=True)

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 找不到文件 {input_file}")
        return

    # 按章节归类的字典
    chapter_dict = collections.defaultdict(list)
    # 定义需要提取的题型
    target_types = ['单项选择题', '多项选择题', '辨析题']

    total_extracted = 0

    for item in data:
        # 筛选：属于目标题型，且没有笔记（note为空字符串）
        if item.get('type') in target_types and not item.get('note', '').strip():
            # 获取对应的章节前缀（例如 "导论-单选-02" 提取 "导论"）
            question_id = item["id"]
            # 题号通常为 章节-题型-序号 格式，按 '-' 分割取第一部分
            chapter = question_id.split('-')[0]
            
            # 提取最精简的字段，减小体积
            extracted_item = {
                "id": question_id,
                "type": item["type"],
                "q": item["question_content"],
                "a": item["answer"]
            }
            chapter_dict[chapter].append(extracted_item)
            total_extracted += 1

    # 遍历按章节生成的字典，分别输出到文件
    print(f"一共找到了 {total_extracted} 道无笔记的题目。正在按章节拆分：")
    for chapter, questions in chapter_dict.items():
        # 给输出文件命名，例如 "导论_extracted.json"
        output_file_name = f"{chapter}_extracted.json"
        output_file_path = os.path.join(output_dir, output_file_name)
        
        with open(output_file_path, 'w', encoding='utf-8') as f:
            # ensure_ascii=False 保证中文字符不被转码
            json.dump(questions, f, ensure_ascii=False, indent=2)
            
        print(f" - [{chapter}]: 共 {len(questions)} 题 -> 保存至 {output_file_name}")

if __name__ == "__main__":
    extract_for_ai()
