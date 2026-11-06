# 유실 작업 복구 자료

## 2026-11-07 · 난이도 자동매칭 + 튜토리얼 탭

`2026-11-07-difficulty-matching-recovery.patch`

여러 세션이 같은 파일을 동시에 고치던 중 유실된 구현이다. 어느 커밋에도
들어간 적이 없다 (`git log -S "matchEnemyDifficulty" --all` 결과 없음).
이 패치가 유일한 사본이다.

담긴 것:
- `matchEnemyDifficulty()` / `DIFFICULTY_LADDER` — 티어 점수로 난이도 자동
  결정. 배치 5전 전에는 초보자, 최근 5전 전승/전패로 한 단계 보정.
- `applyEnemyDifficulty(key)` / `applyMatchedDifficulty()` — 난이도 선택 UI를
  폐지하고 자동 적용. `key`는 QA용 `?difficulty=` 강제 지정.
- `BEGINNER_LABELS` — 상단 안내 배너·설명 토글 폐지, 조작부에 붙는 짧은
  맥락 설명으로 이관.
- `difficultyAutoMatched` 플래그와 로그 문구.

### 적용 방법

중간에 다른 커밋(c26461c)이 들어가서 `patch -p1`은 일부 hunk가 실패한다.

```sh
git apply --3way 13_recovery/2026-11-07-difficulty-matching-recovery.patch
```

### 짝 파일 (이미 커밋되었거나 미커밋 상태)

구현 없이 테스트만 커밋되어 실패 5건이 난 상태였다:
난이도 자동 결정 / 배치 전 초보자 시작 / 안내 배너 폐지 / 튜토리얼 5단계 /
튜토리얼 탭(`openCollectionDirect('tutorial')`).

관련 파일: `05_game-client/app/index.shell.html`, `styles.css`,
`11_qa/regression/beginner-help.test.js`, `enemy-difficulty.test.js`,
`12_tools/qa/check-text-overflow.py`

### 작성자 미확인

작성한 세션을 찾지 못했다. pm-ai-system-82(연출 큐·마법 소유자·궁극기 해설)와
pm-ai-system-ef(평타 연출)는 각자 자기 작업이 아님을 커밋 이력으로 확인했다.
pm-ai-system-02 / pm-ai-system-7b 에 확인 요청을 보냈다.
