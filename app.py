import json
import random
import os
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
JSON_FILE = 'questions.json'
TAG_FIELDS = {'tag_star', 'tag_key', 'tag_hard'}

def load_data():
    if not os.path.exists(JSON_FILE):
        return []
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/config')
def get_config():
    data = load_data()
    chapters = sorted(list(set([q.get('chapter', '未知章节') for q in data])))
    all_types = list(set([q.get('type', '未知题型') for q in data]))
    type_order = ['单项选择题', '多项选择题', '辨析题', '简答题', '材料分析题', '论述题']
    sorted_types = sorted(all_types, key=lambda x: type_order.index(x) if x in type_order else 99)
    return jsonify({'chapters': chapters, 'types': sorted_types})

@app.route('/api/get_questions', methods=['POST'])
def get_questions():
    req = request.json
    selected_chapters = req.get('chapters', [])
    selected_types = req.get('types', [])
    mode = req.get('mode', 'sequence')
    count = int(req.get('count', 20))
    try:
        mistake_min_count = int(req.get('mistake_min_count', 1))
    except (TypeError, ValueError):
        mistake_min_count = 1
    if mistake_min_count < 1:
        mistake_min_count = 1

    data = load_data()
    
    filtered = [
        q for q in data 
        if q['chapter'] in selected_chapters and q['type'] in selected_types
    ]

    if mode == 'mistake':
        filtered = [q for q in filtered if q.get('error_count', 0) >= mistake_min_count]
        filtered.sort(key=lambda x: x.get('error_count', 0), reverse=True)
    elif mode in ('star', 'key', 'hard'):
        tag_map = {
            'star': 'tag_star',
            'key': 'tag_key',
            'hard': 'tag_hard',
        }
        tag_field = tag_map[mode]
        filtered = [q for q in filtered if bool(q.get(tag_field, False))]
        # 保持原顺序
    elif mode == 'random':
        random.shuffle(filtered)
        if count < len(filtered):
            filtered = filtered[:count]
    
    return jsonify(filtered)


@app.route('/api/update_tags', methods=['POST'])
def update_tags():
    req = request.json
    q_id = req.get('id')
    updates = req.get('tags', {}) or {}
    if not q_id:
        return jsonify({'status': 'error', 'message': 'missing id'}), 400

    safe_updates = {}
    for k, v in updates.items():
        if k in TAG_FIELDS:
            safe_updates[k] = bool(v)

    if not safe_updates:
        return jsonify({'status': 'error', 'message': 'no valid tag fields'}), 400

    data = load_data()
    changed = False
    for q in data:
        if q.get('id') == q_id:
            for k, v in safe_updates.items():
                if q.get(k) != v:
                    q[k] = v
                    changed = True
            break

    if changed:
        save_data(data)
    return jsonify({'status': 'success', 'changed': changed, 'tags': safe_updates})

@app.route('/api/update_error', methods=['POST'])
def update_error():
    req = request.json
    q_id = req.get('id')
    is_wrong = req.get('is_wrong', False)
    data = load_data()
    changed = False
    for q in data:
        if q.get('id') == q_id:
            if is_wrong:
                q['error_count'] = q.get('error_count', 0) + 1
                changed = True
            break
    if changed:
        save_data(data)
    return jsonify({'status': 'success'})

@app.route('/api/update_note', methods=['POST'])
def update_note():
    req = request.json
    q_id = req.get('id')
    new_note = req.get('note', '')
    data = load_data()
    changed = False
    for q in data:
        if q.get('id') == q_id:
            q['note'] = new_note
            changed = True
            break
    if changed:
        save_data(data)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)