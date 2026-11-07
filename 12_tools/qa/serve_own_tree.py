#!/usr/bin/env python3
"""측정 스크립트가 '내 트리의 번들'을 보고 있음을 보장한다.

2026-11-07 사고: 8765 포트를 다른 세션의 워크트리가 이미 점유하고 있었다.
내 dev-server 는 조용히 죽고, 측정은 남의 옛 번들을 읽었다. 테스트는 로컬
파일을 읽으니 전부 통과했고, 스크린샷을 눈으로 보기 전까지 '고쳤다'고
믿고 있었다.

재발 방지는 '조심하기'가 아니라 '틀리면 멈추기'로 한다:
  with serve_own_tree() as base:   # base = http://127.0.0.1:<port>
      ...  # 이 블록 안에서는 base 가 내 dist 라는 것이 보장된다

보장 방법 — 빈 포트를 OS 에서 받아 내 서버만 띄우고, /__whoami 로 응답하는
트리가 정말 내 dist 인지 확인한다. 하나라도 어긋나면 RuntimeError 를 던진다.
"""
import contextlib, json, os, socket, subprocess, sys, time, urllib.request

REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DIST = os.path.join(REPO, 'dist')
SERVER = os.path.join(REPO, '12_tools', 'dev-server.py')


def _free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def _whoami(base, timeout=0.5):
    with urllib.request.urlopen(base + '/__whoami', timeout=timeout) as r:
        return json.load(r).get('root')


@contextlib.contextmanager
def serve_own_tree(build=False):
    if build:
        subprocess.run(['npm', 'run', 'build'], cwd=REPO, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        raise RuntimeError('dist/index.html 이 없습니다. npm run build 를 먼저 돌리세요: ' + DIST)

    port = _free_port()
    proc = subprocess.Popen([sys.executable, '-I', SERVER, str(port)], cwd=REPO,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    base = 'http://127.0.0.1:%d' % port
    try:
        served = None
        deadline = time.time() + 15
        while time.time() < deadline:
            if proc.poll() is not None:
                raise RuntimeError('dev-server 가 떴다가 죽었습니다:\n' + (proc.stdout.read() or ''))
            try:
                served = _whoami(base)
                break
            except Exception:
                time.sleep(0.2)
        if served is None:
            raise RuntimeError('dev-server 가 %s 에서 응답하지 않습니다.' % base)
        if os.path.realpath(served) != os.path.realpath(DIST):
            raise RuntimeError(
                '다른 트리가 응답하고 있습니다. 측정을 중단합니다.\n'
                '  기대: %s\n  실제: %s' % (os.path.realpath(DIST), os.path.realpath(served)))
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    with serve_own_tree() as base:
        print('OK: %s 가 %s 를 서빙합니다.' % (base, DIST))
