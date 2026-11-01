#!/usr/bin/env python3
"""개발용 정적 서버: dist/를 8765 포트로 서빙한다.
- 브라우저 캐시를 끈다(Cache-Control: no-store).
- index.html 에 라이브 리로드 스크립트를 끼워 넣어, dist/ 안의 파일이 바뀌면 열려 있는 탭이 스스로 새로고침된다.
사용: python3 12_tools/dev-server.py [포트]
"""
import os, sys, json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')
RELOAD = b"""<script>/* dev live-reload */(function(){var last=null;setInterval(function(){fetch('/__mtime',{cache:'no-store'}).then(function(r){return r.text()}).then(function(t){if(last===null)last=t;else if(t!==last)location.reload()}).catch(function(){})},1200)})();</script>"""

def newest_mtime():
    newest = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ('audio', 'node_modules')]
        for name in files:
            if name.endswith(('.html', '.js', '.css', '.json')):
                try: newest = max(newest, os.path.getmtime(os.path.join(base, name)))
                except OSError: pass
    return str(newest)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/__mtime':
            body = newest_mtime().encode()
            self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        if path in ('/', '/index.html'):
            with open(os.path.join(ROOT, 'index.html'), 'rb') as f: html = f.read()
            html = html.replace(b'</body>', RELOAD + b'</body>', 1) if b'</body>' in html else html + RELOAD
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(html))); self.end_headers(); self.wfile.write(html); return
        super().do_GET()
    def log_message(self, *args):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('', port), Handler).serve_forever()
