#!/usr/bin/env python3
"""개발용 정적 서버: dist/를 8765 포트로 서빙한다.
- 브라우저 캐시를 끈다(Cache-Control: no-store).
- index.html 에 라이브 리로드 스크립트를 끼워 넣어, dist/ 안의 파일이 바뀌면 열려 있는 탭이 스스로 새로고침된다.
- 포트가 이미 쓰이고 있으면 '누가 쓰고 있는지'를 밝히고 종료한다. 여러 세션이
  같은 저장소의 서로 다른 워크트리에서 동시에 작업하므로, 조용히 실패하면
  이미 떠 있는 '남의 트리'가 응답해 고친 내용이 반영 안 된 것처럼 보인다
  (2026-11-07 실제 사고: 8765 가 다른 세션 트리를 서빙 중이라 수정 전 번들을
  측정하고 '고쳤다'고 판단할 뻔했다).
- /__whoami 로 서빙 중인 트리의 절대경로를 돌려준다. 측정 스크립트는 이걸로
  '내 번들을 보고 있는가'를 확인할 수 있다.
사용: python3 12_tools/dev-server.py [포트]
"""
import os, sys, json, errno, socket, subprocess
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
        if path == '/__whoami':
            body = json.dumps({'root': os.path.realpath(ROOT)}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
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

def port_owner(port):
    """그 포트를 점유한 프로세스의 pid 와 작업 디렉토리를 best-effort 로 알아낸다."""
    try:
        pids = subprocess.run(['lsof', '-ti', 'tcp:%d' % port], capture_output=True, text=True, timeout=5).stdout.split()
    except Exception:
        return []
    owners = []
    for pid in pids:
        cwd = '?'
        try:
            out = subprocess.run(['lsof', '-a', '-p', pid, '-d', 'cwd', '-Fn'], capture_output=True, text=True, timeout=5).stdout
            for line in out.splitlines():
                if line.startswith('n'):
                    cwd = line[1:]; break
        except Exception:
            pass
        owners.append((pid, cwd))
    return owners

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = os.path.realpath(ROOT)
    try:
        server = ThreadingHTTPServer(('', port), Handler)
    except OSError as exc:
        if exc.errno not in (errno.EADDRINUSE,):
            raise
        # 조용히 죽으면 '남의 트리'가 계속 응답해서, 고친 내용이 반영 안 된 것처럼 보인다.
        print('[dev-server] 포트 %d 가 이미 사용 중입니다. 이 서버는 뜨지 않았습니다.' % port, file=sys.stderr)
        for pid, cwd in port_owner(port):
            mark = '  <= 이 트리와 같음' if os.path.realpath(cwd) == os.path.realpath(os.path.join(root, '..')) else '  <= 다른 트리!'
            print('[dev-server]   점유: pid %s  cwd %s%s' % (pid, cwd, mark), file=sys.stderr)
        print('[dev-server] 서빙하려던 경로: %s' % root, file=sys.stderr)
        print('[dev-server] 다른 포트를 쓰거나(예: python3 12_tools/dev-server.py 8799),', file=sys.stderr)
        print('[dev-server] 이미 뜬 서버가 내 트리를 서빙하는지 http://localhost:%d/__whoami 로 확인하세요.' % port, file=sys.stderr)
        sys.exit(2)
    print('[dev-server] http://localhost:%d  ->  %s' % (port, root), flush=True)
    server.serve_forever()
