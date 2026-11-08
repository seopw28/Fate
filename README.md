# Fate (크랙 CCG) 브라우저 목업

크랙 캐릭터 카드로 컴퓨터와 대전하는 CCG의 **정적 브라우저 목업**이다. 서버 없이 `dist/index.html` 한 장으로 돈다.
제품 코드의 출발점이 아니라 **"정답 동작"과 연출의 기준**으로 쓴다. FE 인수 범위와 이관 순서는 [docs/frontend-handoff.md](docs/frontend-handoff.md)에 있다.

## 빠른 시작

```bash
npm ci
npm run build          # 05_game-client/app + 카드 데이터 → dist/
python3 12_tools/dev-server.py   # http://localhost:8765 (캐시 끔, 파일이 바뀌면 자동 새로고침)
npm test               # 빌드 + 카드·효과 검증 + 엔진·플랫폼·UI 계약 테스트
```

- 아무 정적 서버로 `dist/`를 띄워도 된다. `file://`로 직접 열면 일부 fetch가 막힌다.
- 재현용 주소 옵션: `?skipIntro&guardian=baekho&seed=abc&difficulty=normal` 등. 전체 목록은 [08-controls-and-dev.md](02_game-design/game-rules/08-controls-and-dev.md).

## 폴더 지도

FE가 읽어야 하는 곳부터 적었다.

| 폴더 | 내용 | FE에게 |
|---|---|---|
| `05_game-client/app/` | HTML 셸, CSS, 앱 모듈 5개 (**화면·규칙 코드의 정본**) | 필수 |
| `05_game-client/battle/` | 사운드 변주, 공격 모션, 마법 시네마틱 런타임 | 필수 |
| `03_card-data/` | 카드 219장 정의(JSON)와 검증기 | 필수 |
| `02_game-design/game-rules/` | 게임 규칙 문서 (턴·전투·카드·궁극기·경제·AI) | 필수 |
| `docs/` | FE 인수 가이드 | 필수 |
| `dist/` | 빌드 결과물과 실행용 에셋(`dist/assets/`, WebP·MP3·WOFF2) | 참고 (직접 수정 금지) |
| `04_game-engine/` | 순수 함수 엔진 (난수, 피해 계산 일부만 사용 중) | 참고 |
| `07_vfx-motion/` | VFX 프리셋과 실험 페이지 (`dist/vfx`가 이 폴더를 가리키는 링크) | 참고 |
| `10_platform/`, `shared/` | 인벤토리 원장 시제품, 이벤트·카드 스키마 계약 | 참고 |
| `11_qa/`, `12_tools/qa/` | 문자열 계약 테스트, Playwright 브라우저 검사 | 참고 |
| `effects/`, `06_assets/` | 이펙트·에셋 제작 파이프라인과 고해상도 원본 | 불필요 |
| `00`·`01`·`08`·`09`·`13`, `ideation/`, `collection-sources/` | 기획·리서치·밸런스·권리 기록 | 불필요 |

## 정본과 생성물

- 화면 수정은 `05_game-client/app/`에서 하고 `npm run build`로 `dist/`에 반영한다. `dist/index.html`·`dist/runtime/`은 손으로 고치지 않는다. CI가 빌드 뒤 `dist` 차이를 검사한다.
- 실행용 에셋은 `dist/assets/`가 정본이다. 고해상도 원본은 `effects/approved/`(이펙트)와 `06_assets/source-art/`에 둔다.
- 이미지는 WebP, 폰트는 WOFF2로 둔다 (2026-11-08 정리. PNG 원본은 git 이력에 있음).

## 테스트

| 명령 | 무엇을 보나 |
|---|---|
| `npm test` | 빌드, 카드·효과 스키마, 엔진·플랫폼 단위 테스트, `11_qa/regression` 계약 테스트 |
| `npm run qa:battle` 등 `qa:*` | Playwright로 실제 브라우저에서 동작 확인 (`pip install playwright` 필요) |

`11_qa/regression`의 대부분은 빌드된 HTML에 특정 코드 문자열이 있는지 보는 **계약 테스트**다. 동작을 보장하지 않으므로 FE 재구현 때는 `qa:*` 브라우저 검사 시나리오를 기준으로 삼는다.

## 배포

`gh-pages` 브랜치에 `dist/` 내용을 올린 뒤 GitHub Actions `Deploy Fate to GitHub Pages`를 수동 실행한다. `dist/vfx`는 링크이므로 복사할 때 실제 파일로 풀어야 한다(`rsync -L`).

## 작업 방식 (기획 레포 시절의 규칙)

- Claude와 Codex가 최상위 폴더를 작업 레인으로 나눠 병렬 개발했다. 폴더 간 계약은 `shared/`에서 정의한다.
- 새 핵심 규칙은 `04_game-engine/`에 두는 것이 원칙이었지만, 현재 규칙 대부분은 `05_game-client/app/modules/`에 있다.
- 외부 에셋은 출처와 사용 권한을 `13_legal/source-register.csv`에 기록한 뒤 쓴다.
- 이미지 작업 대기열: [06_assets/art-queue.md](06_assets/art-queue.md)
