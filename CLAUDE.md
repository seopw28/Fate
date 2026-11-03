# Fate 개발 규칙

## UI 텍스트 넘침 금지 (필수)
- 글자가 버튼/패널/카드 상자 밖으로 나가거나 잘리면 안 된다. 폰트는 지마켓산스(Inter 대비 폭이 넓음)라 특히 주의.
- UI 문구·폰트·레이아웃을 건드렸으면 **완료 보고 전에 반드시** 실행:
  1. `python3 12_tools/dev-server.py` (서버 기동, 브라우저 캐시 꺼짐. `cd dist && python3 -m http.server 8765`도 동작하지만 화면이 캐시될 수 있다)
  2. `npm run qa:overflow` → `OK: 넘침 없음`이어야 통과. FAIL이면 수정 후 재실행.
- 버튼에 `white-space:nowrap` 금지(줄바꿈 허용), 고정 폭/높이 상자에는 가장 긴 문구 상태(마나 10 필요, 긴 캐릭터명 등)로 확인.
- 동적으로 바뀌는 문구는 `12_tools/qa/check-text-overflow.py`의 `STATES`에 해당 상태를 추가한다.
- `dist/index.html`의 "지마켓산스 넘침 방지" CSS 블록은 삭제 금지.
- 검사기는 pseudo-element(::before 아이콘) 겹침은 못 잡으므로 스크린샷으로 눈으로도 확인.

## 스킬/마법/궁극기 연출은 필드 기준 (필수)
- 연출 오버레이(`.cinematic-skill-fx`, `.ultimate-cutscene`, `.global-spell`, `.global-summon`, `.effect-narration`)는 화면 전체가 아니라 `.arena`(필드) 영역의 중앙에 표시한다. `syncFieldFrame()`이 `--field-left/top/width/height/cx/bottom`을 갱신한다.
- 새 연출은 `vw/vh/inset:0` 대신 `var(--field-width)`/`var(--field-height)` 기준으로 크기를 잡고, 오버레이 클래스는 `FIELD_OVERLAYS` 선택자에 추가한다.
- 연출 타이틀은 단어 단위로 줄바꿈한다(`typeSkillTitle`이 `.title-word`로 묶음). 단어 중간에서 끊기면 안 된다.

## Codex 이미지 생성 0순위 큐 (필수 상기)
- Codex(`image_gen`) 한도가 회복되면 **가장 먼저** `06_assets/art-queue.md`의 남은 항목부터 만든다 (**P0 보호막 이펙트(깨짐·유지 표시) — 사용자 지정 최우선** → P3 수호신 아이콘. 그림 없는 마법·함정, P1 중복 사용 마법, P2 토큰은 완료). 목록·프롬프트·반영 절차는 그 문서에 있다.
- 사용자가 직접 이미지를 주면 webp로 변환해 `dist/assets/spells|traps/generated/`에 넣는다. 기존 그림을 바꿀 때는 같은 파일 이름으로 덮어쓰지 말고 새 이름(`-v2` 등)을 쓴다 (브라우저 캐시).
- Fate 작업을 시작·종료할 때 사용자에게 이 미해결 큐를 한 번 상기시킨다. Claude는 이미지를 생성할 수 없고, 코드로 그린 SVG 일러스트는 쓰지 않는다.

## 여러 세션 동시 작업 안전 규칙 (필수)
- **저장소**: Fate는 독립 git 저장소다 (`github.com/seopw28/Fate`, private, `origin`). 2026-11-03 회사 저장소(product_analysis)에서 이력째 분리했다. 경로는 저장소 루트 기준(`dist/index.html`, `Fate/` 접두사 없음). 원격 푸시는 SSH(`git@github.com:seopw28/Fate.git`)를 쓴다 — HTTPS는 큰 팩에서 끊긴다.
여러 Claude 세션이 같은 `dist/index.html`을 동시에 고치고 커밋한다. 한 세션의 실수가 다른 세션들의 미커밋 작업을 지운 사고가 있었다 (2026-11-03: 파일 0바이트 덮어쓰기, 남의 작업이 섞인 커밋, 이미 커밋된 수정을 되돌린 커밋).
- **자동 보호 훅**: `.claude/settings.json`의 `12_tools/guard/index-guard.py`가 모든 도구 실행 전에 index.html을 `~/.cache/fate/index-backups/`에 백업하고, 실행 후 파일이 사라지거나·200KB 미만·직전 백업의 절반 미만·`</html>` 잘림이면 즉시 복원하고 경고한다. 경고가 뜨면 방금 명령을 멈추고 원인부터 확인한다. 일부러 크게 줄일 때만 `FATE_INDEX_GUARD=off`.
- **파일 쓰기**: 스크립트로 고칠 때는 `cp` 백업 → 끝까지 읽기 → 메모리에서 변환 → 임시 파일에 쓰기 → `os.replace` 순서만 쓴다. `open(f,'w').write(g(open(f).read()))`처럼 같은 파일을 한 줄에서 읽고 쓰는 코드는 금지 (쓰기 열기가 먼저 실행돼 파일이 비워진다).
- **커밋은 내 변경만**: `git add dist/index.html`은 다른 세션의 미커밋 작업까지 커밋한다. "HEAD 버전에 내 변경만 다시 적용한 파일"을 `git hash-object -w` → `git update-index --cacheinfo`로 올려 커밋한다. 작업 시작 시 스냅샷과의 diff를 HEAD에 덧대는 방식은, 그사이 다른 세션이 같은 파일을 고치면 남의 작업이 섞이므로 쓰지 않는다.
- **커밋 직전 확인**: ① `git log -1`로 HEAD가 작업 시작 때와 같은지 ② `git diff --cached --stat`으로 남이 스테이징한 파일이 섞이지 않았는지 ③ `git diff HEAD -- 파일`에서 내 변경만 보이는지(특히 지운 줄이 의도한 것인지) ④ `node --check`로 스크립트 문법. `patch`가 `Reversed`/`FAILED` 경고를 내면 즉시 중단한다.
- **사고가 나면**: 숨기지 말고 사용자에게 알리고, `ListAgents`로 다른 Fate 세션을 찾아 `SendMessage`로 무엇이 빠졌을 수 있는지 알린다.
