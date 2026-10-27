#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""柏拉图层栈 · 本地服务

    python server.py              # http://127.0.0.1:8000/bolatu4.html
    python server.py --port 8080
    python server.py --host 0.0.0.0 --port 8000

既是静态服务器（bolatu4.html / *.js），也提供场景存档 API。
存档落在脚本同级的 bolatu-saved/ 目录：
    bolatu-saved/<名字>.json   场景数据（layers + cam）
    bolatu-saved/<名字>.png    保存时截的主场景缩略图

API
    GET  /api/saves               -> {ok, items:[{name, hasThumb, thumbUrl, mtime, size}]}
    GET  /api/save?name=xxx       -> {ok, name, data}
    POST /api/save                -> {name, data, thumb}  写 json + png，回 items
"""

import argparse
import base64
import json
import os
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
SAVE_DIR = os.path.join(ROOT, 'bolatu-saved')
MAX_NAME_LEN = 60
PNG_PREFIX = 'data:image/png;base64,'

# Windows / POSIX 都不允许的字符，外加控制字符
_BAD_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def safe_name(raw):
    """把用户输入的名字收成安全的文件名（不含扩展名）。"""
    name = _BAD_CHARS.sub('_', str(raw if raw is not None else ''))
    name = name.strip().strip('.')
    name = re.sub(r'\s+', ' ', name)
    return name[:MAX_NAME_LEN].strip().strip('.')


def save_paths(name):
    return (os.path.join(SAVE_DIR, name + '.json'),
            os.path.join(SAVE_DIR, name + '.png'))


def list_saves():
    if not os.path.isdir(SAVE_DIR):
        return []
    items = []
    for fn in os.listdir(SAVE_DIR):
        if not fn.lower().endswith('.json'):
            continue
        name = fn[:-5]
        jp, pp = save_paths(name)
        if not os.path.isfile(jp):
            continue
        has_thumb = os.path.isfile(pp)
        items.append({
            'name': name,
            'hasThumb': has_thumb,
            # 带上 mtime 让浏览器缓存失效
            'thumbUrl': ('bolatu-saved/' + quote(name + '.png') + '?t=' + str(int(os.path.getmtime(pp))))
                        if has_thumb else None,
            'mtime': os.path.getmtime(jp),
            'size': os.path.getsize(jp),
        })
    items.sort(key=lambda x: -x['mtime'])
    return items


class Handler(SimpleHTTPRequestHandler):
    server_version = 'BolatuSave/1.0'

    def __init__(self, *args, **kwargs):
        kwargs['directory'] = ROOT
        super().__init__(*args, **kwargs)

    # 安静一点：只打印 API 与错误
    def log_message(self, fmt, *args):
        print('[%s] %s' % (self.log_date_time_string(), fmt % args))

    def _send_json(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    # ---------- GET ----------
    def do_GET(self):
        url = urlparse(self.path)

        if url.path == '/api/saves':
            return self._send_json({'ok': True, 'items': list_saves()})

        if url.path == '/api/save':
            qs = parse_qs(url.query)
            name = safe_name((qs.get('name') or [''])[0])
            jp, _ = save_paths(name)
            if not name or not os.path.isfile(jp):
                return self._send_json({'ok': False, 'error': '存档不存在'}, 404)
            try:
                with open(jp, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as exc:                      # noqa: BLE001
                return self._send_json({'ok': False, 'error': '读取失败: %s' % exc}, 500)
            return self._send_json({'ok': True, 'name': name, 'data': data})

        return super().do_GET()

    # ---------- POST ----------
    def do_POST(self):
        url = urlparse(self.path)
        if url.path != '/api/save':
            return self._send_json({'ok': False, 'error': '未知接口'}, 404)

        try:
            length = int(self.headers.get('Content-Length') or 0)
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception as exc:                          # noqa: BLE001
            return self._send_json({'ok': False, 'error': '请求体不是合法 JSON: %s' % exc}, 400)

        name = safe_name(payload.get('name'))
        data = payload.get('data')
        if not name:
            return self._send_json({'ok': False, 'error': '名字不合法'}, 400)
        if not isinstance(data, dict):
            return self._send_json({'ok': False, 'error': 'data 必须是对象'}, 400)

        os.makedirs(SAVE_DIR, exist_ok=True)
        jp, pp = save_paths(name)

        data.setdefault('savedAt', time.strftime('%Y-%m-%dT%H:%M:%S'))
        data['name'] = name
        tmp = jp + '.tmp'
        try:
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, jp)
        except Exception as exc:                          # noqa: BLE001
            return self._send_json({'ok': False, 'error': '写入失败: %s' % exc}, 500)

        thumb = payload.get('thumb')
        if isinstance(thumb, str) and thumb.startswith(PNG_PREFIX):
            try:
                blob = base64.b64decode(thumb[len(PNG_PREFIX):])
                with open(pp, 'wb') as f:
                    f.write(blob)
            except Exception as exc:                      # noqa: BLE001
                print('  缩略图写入失败:', exc)

        print('  已保存 %s.json%s' % (name, ' + .png' if os.path.isfile(pp) else ''))
        return self._send_json({'ok': True, 'name': name, 'items': list_saves()})


def main():
    ap = argparse.ArgumentParser(description='柏拉图层栈本地服务')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8000)
    args = ap.parse_args()

    os.makedirs(SAVE_DIR, exist_ok=True)
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print('柏拉图层栈 · 本地服务')
    print('  页面    http://%s:%d/bolatu4.html' % (args.host, args.port))
    print('  存档目录 %s' % SAVE_DIR)
    print('  Ctrl+C 停止')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
