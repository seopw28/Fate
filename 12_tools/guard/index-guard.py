#!/usr/bin/env python3
"""dist/index.html 보호 훅 (Claude Code PreToolUse/PostToolUse).

여러 Claude 세션이 같은 dist/index.html을 동시에 고치기 때문에, 한 세션의 실수(파일을 0바이트로 덮어쓰기 등)가
다른 세션들의 미커밋 작업까지 지운 사고가 있었다(2026-11-03). 이 훅이 그런 일을 자동으로 막는다.

  pre  : 도구 실행 전, index.html이 정상이면 ~/.cache/fate/index-backups/ 에 백업 (내용이 바뀌었을 때만, 최근 80개 유지)
  post : 도구 실행 후, index.html이 사라졌거나 / 200KB 미만이거나 / 직전 백업의 절반 미만이거나 / 끝(</html>)이 없으면
         깨진 파일을 broken-*.html 로 보관하고 최근 정상 백업으로 즉시 복원한 뒤 경고를 낸다.

일부러 파일을 크게 줄이는 작업이라면 FATE_INDEX_GUARD=off 로 끌 수 있다.
시험용: FATE_INDEX_GUARD_TARGET(대상 파일), FATE_INDEX_GUARD_BACKUP_DIR(백업 폴더)로 경로를 바꿀 수 있다.
"""
import glob, json, os, shutil, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TARGET = os.environ.get('FATE_INDEX_GUARD_TARGET') or os.path.join(ROOT, 'dist', 'index.html')
BACKUP_DIR = os.environ.get('FATE_INDEX_GUARD_BACKUP_DIR') or os.path.expanduser('~/.cache/fate/index-backups')
MIN_BYTES = 200_000
KEEP = 80


def size(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return -1


def backups():
    return sorted(glob.glob(os.path.join(BACKUP_DIR, 'index-*.html')))


def problem(path):
    """정상이면 None, 이상하면 이유 문자열."""
    n = size(path)
    if n < 0:
        return '파일이 없음'
    if n < MIN_BYTES:
        return f'크기가 {n:,}바이트로 비정상적으로 작음'
    with open(path, 'rb') as f:
        f.seek(max(0, n - 8192))
        if b'</html>' not in f.read().lower():
            return '파일 끝(</html>)이 잘림'
    last = backups()
    if last and n < size(last[-1]) * 0.5:
        return f'직전 백업({size(last[-1]):,}바이트)의 절반 미만({n:,}바이트)으로 줄어듦'
    return None


def pre():
    if problem(TARGET):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    last = backups()
    if last and size(last[-1]) == size(TARGET):
        with open(last[-1], 'rb') as a, open(TARGET, 'rb') as b:
            if a.read() == b.read():
                return
    name = os.path.join(BACKUP_DIR, time.strftime('index-%Y%m%d-%H%M%S') + f'-{os.getpid()}.html')
    shutil.copy2(TARGET, name + '.tmp')
    os.replace(name + '.tmp', name)
    for old in backups()[:-KEEP]:
        os.remove(old)


def post():
    reason = problem(TARGET)
    if not reason:
        return
    good = [b for b in reversed(backups()) if size(b) >= MIN_BYTES]
    if not good:
        msg = f'[index-guard] dist/index.html 이상 감지({reason}) — 복원할 백업이 없습니다. 즉시 git으로 확인하세요.'
        print(json.dumps({'systemMessage': msg, 'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}, ensure_ascii=False))
        return
    stamp = time.strftime('%Y%m%d-%H%M%S')
    broken = os.path.join(BACKUP_DIR, f'broken-{stamp}-{os.getpid()}.html')
    if size(TARGET) >= 0:
        shutil.copy2(TARGET, broken)
    shutil.copy2(good[0], TARGET + '.guard-tmp')
    os.replace(TARGET + '.guard-tmp', TARGET)
    msg = (f'[index-guard] dist/index.html이 망가져서({reason}) 최근 정상 백업 {os.path.basename(good[0])} 로 자동 복원했습니다. '
           f'깨진 파일은 {broken} 에 보관했습니다. 방금 실행한 명령을 점검하고, 파일은 반드시 끝까지 읽은 뒤 임시 파일→교체 방식으로 쓰세요.')
    print(json.dumps({'systemMessage': msg, 'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}, ensure_ascii=False))


if __name__ == '__main__':
    if os.environ.get('FATE_INDEX_GUARD') == 'off':
        sys.exit(0)
    try:
        sys.stdin.read()
    except Exception:
        pass
    {'pre': pre, 'post': post}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: None)()
