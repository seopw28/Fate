# 일러스트 생성 큐

> **`미완료`로 표시된 항목만 생성 대상이다. `완료` 항목은 실파일과 연결이 사라진 경우가 아니면 다시 큐에 올리지 않는다.**
> Claude는 이미지를 생성할 수 없다. 코드로 그린 SVG 일러스트는 품질이 낮아 쓰지 않는다.
> 마지막 확인: 2026-11-06 (보호막 이펙트, 역전 마법 6장, 그림 없는 마법·함정 모두 완료 상태 확인).
> 이 큐는 `CLAUDE.md`, `06_assets/README.md`, `02_game-design/game-rules/09-decisions-and-open-issues.md`, `npm run validate:cards`의 경고에서 가리킨다.

## (완료) P0 — 보호막 이펙트 (2026-11-03 요청 · 2026-11-03 Codex 반영)

**왜**: 챔프끼리 공격이 보호막에 막히면 화면에 아무 일도 없어 보여 "이펙트도 데미지도 안 들어간다"는 버그로 인식됐다(자동 전투 158회 중 15회). 2026-11-03에 코드로 임시 연출(카드 번쩍임·흔들림 + `보호막이 막음 · 피해 0` 글자)을 넣었지만, **보호막이 있다 / 깨졌다**가 한눈에 보이는 전용 이미지가 필요하다.

| 만들 것 | 쓰임 | 만들 파일 |
|---|---|---|
| ① 보호막 깨짐 (메인) | 공격이 보호막에 막히는 순간 카드 위에 0.4~0.6초 겹쳐 터지는 이펙트 | `dist/assets/vfx/shield/shield-break-v1.png` (투명 배경 PNG) |
| ② 보호막 유지 표시 | 보호막이 있는 동안 카드 테두리를 감싸는 은은한 막 — 지금은 금색 box-shadow뿐이라 잘 안 보임 | `dist/assets/vfx/shield/shield-aura-v1.png` (투명 배경, 카드 비율 세로 2:3) |
| ③ (선택) 절대방어 | 궁극기 절대방어 발동 시 아군 전체에 씌우는 더 강한 버전 | `dist/assets/vfx/shield/shield-absolute-v1.png` |

완료 기록: ① `shield-break-v1.png`, ② `shield-aura-v1.png`를 투명 PNG로 생성해 전투 런타임에 연결했다. 보호막 상태 변화는 `data-shield`를 감시해 오라를 자동 부착·제거하고, 피해 차단 시 카드 중심에 파괴 버스트를 표시한다. ③ 절대방어 전용 이미지는 선택 항목으로 남기고 현재는 동일 보호막 체계를 재사용한다.

프롬프트 (①, ②·③은 Subject만 바꿔서):
```
Use case: game VFX sprite
Asset type: premium fantasy TCG combat effect overlay, transparent background, centered, square
Primary request: a magical barrier shattering as it blocks an attack
Subject: a translucent hexagonal-cell golden-amber energy shield bursting into glowing shards at the moment of impact, bright white flash at the center, cracks radiating outward
Style/medium: polished high-detail fantasy game VFX, painterly glow, readable at small card size (~150px)
Composition/framing: effect centered, fills ~80% of frame, edges fade to fully transparent, no hard cutoff
Lighting/mood: sharp, protective, satisfying impact
Color palette: warm gold and amber with white-hot core (matches in-game shield color #d6a86a)
Constraints: transparent background (alpha), no characters, no text, no letters, no numbers, no logos, no watermark, no card border, no UI
```
②: `Subject: a thin, softly glowing golden hexagon-patterned barrier wrapping the edges of a portrait card, center fully transparent so the card art shows through` (세로 2:3).

반영 절차
1. PNG를 위 경로에 저장(투명 배경 유지 — webp로 바꿀 때 `cwebp -q 88 -exact -alpha_q 100`).
2. 코드 위치: `dist/index.html`의 `shieldBreakFx(target)`(보호막이 피해를 막을 때 호출, 지금은 `showSkillEffect('shield',…)` + 흔들림) → ① 이미지를 카드 중심에 겹쳐 scale 0.6→1.15, opacity 1→0 으로 터뜨린다. 보호막을 부여하는 곳(`dataset.shield='true'` + `boxShadow`)에 ② 오버레이를 붙이고, `damageUnit`에서 `shield='false'`가 될 때 떼어낸다.
3. `npm run qa:battle`(보호막 연출 검사 포함) → `npm run qa:overflow` → 스크린샷으로 확인.

## (완료) P0 — 역전 마법 6장 (2026-11-05 생성·반영)

상대 필드의 공격력 합·체력 합에 비례해 강해지는 마법(`reversal.*`, `03_card-data/sets/character-expansions.json`). 이미지를 받으면 `dist/assets/spells/generated/<이름>.webp`로 넣고 `assetId`를 `spells/generated/<이름>.webp`로 바꾼다. 원본은 `06_assets/source-art/spells/`.
공통: 세로 2:3, 어두운 배경, 핵심 피사체는 세로 가운데(손패는 가운데 가로 띠만 보임), 사람·글자·카드 테두리·중국풍 금지. 주제는 "강한 상대의 힘을 되돌려 역전한다".

| 카드 | 파일 이름 | 그림 방향 |
|---|---|---|
| 되돌리는 심판 (무오라·전설) | `reversal-judgment` | 적들이 쏟아낸 무수한 칼날·화살·불꽃이 거대한 빛의 거울에 부딪혀 그대로 되돌아 날아가는 장면, 금빛과 흰빛 |
| 반격의 방벽 (대지·희귀) | `reversal-bulwark` | 쏟아지는 공격을 받아내며 빛나는 거대한 고대 돌 방벽, 막아낸 힘이 금빛 생명력으로 흘러드는 장면, 호박색·금색 |
| 거인 사냥 (바람·희귀) | `reversal-giant-hunt` | 폭풍 속에 우뚝 선 거대한 바위 거인의 실루엣을 수많은 청록빛 바람 칼날이 사방에서 깎아내는 장면 |
| 무게의 대가 (화염·희귀) | `reversal-weight-toll` | 무거운 쇳덩이 저울이 한쪽으로 기울며 그 무게만큼 붉은 불길이 터져 나오는 장면, 붉은색·주황·쇠빛 |
| 생명 강탈 (물·희귀) | `reversal-life-siphon` | 적진의 붉은 생명 기운이 푸른 물줄기 소용돌이에 빨려 들어 한 점으로 모이는 장면, 심해 남색·청록·붉은 빛 |
| 역전의 지혜 (무오라·희귀) | `reversal-insight` | 어둠 속에서 펼쳐진 고서 위로 빛나는 카드들이 떠올라 부채꼴로 펼쳐지는 장면, 보라·금빛 |

완료 기록: Codex 이미지 생성 도구로 세로 2:3 원본 PNG 6장을 생성해 `06_assets/source-art/spells/`에 보존하고, 게임용 WebP를 `dist/assets/spells/generated/`에 연결했다. 실제 생성 프롬프트는 `06_assets/source-art/spells/reversal-prompts.md`에 기록했다.

## (완료) 일러스트 없는 마법·함정

> 2026-11-02: 사용자 제공 이미지로 모두 해결 — 치유의 샘·진홍의 화염구·화염 인장·빙결 사슬(숨김 해제), 함정 매복 지뢰·역류 장벽·배수의 진. 영문 카드명은 한글로 변경.

(참고: 프로토타입 `prototype.comeback-flare`(Comeback Ember), `chronicle.prophecy-of-ruin`(Omen of Ruin)은 일러스트가 없지만 출시 전 카드라 뒤로 미룬다.)

### 프롬프트 템플릿 (기존에 쓰던 형식, `/tmp`는 사라지므로 여기에 보존)
```
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, square crop
Primary request: <카드 이름>, <한 줄 효과 설명>
Scene/backdrop: <배경>
Subject: <핵심 피사체>
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: dramatic centered subject with strong silhouette, readable at thumbnail size, edge-safe
Lighting/mood: <분위기>
Color palette: <색>
Constraints: no visible people, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI
```

| 카드 | Primary request | Scene / Subject | Mood · Palette |
|---|---|---|---|
| Healing Spring | a spell that heals the weakest ally with a glowing spring | moss-covered stone grotto, a small spring spilling luminous water with floating golden motes | serene, restorative · teal, emerald, warm gold |
| Crimson Bolt | a spell that hurls a massive crimson fire bolt at the enemy hero | dark scorched battlefield under a blood-red stormy sky · a huge spear-like bolt of molten crimson fire with a white-hot core, trailing sparks and shockwave rings | explosive, aggressive · crimson, molten orange, charcoal, white-hot core |
| Glacial Chain | a spell that binds the strongest enemy with chains of ice | frozen cavern with hanging icicles · heavy chains of translucent ice lashing out and wrapping around an unseen target, frost mist | cold, restraining · icy cyan, steel blue, white highlights |
| Flame Sigil | a spell that inscribes a fire sigil to empower an ally | dark stone floor in a ritual chamber · a glowing orange rune circle hovering above the ground with rising embers | focused, empowering · amber, ember red, soot black |
| Ambush Mine | a trap that detonates when an enemy champion is summoned | cracked battlefield soil · a half-buried rune-etched mine glowing faintly under dirt and grass, a telegraphed blast ring | tense, hidden · rust brown, ember orange, dull gold |
| Counterflow Barrier | a trap that blocks an attack on the hero and reflects damage | a swirling dome of living water standing against a storm · currents flowing back toward the attacker | defensive, reflective · deep blue, aqua, silver foam |
| Last Stand | a trap that empowers a lone champion facing three enemies | ruined battlefield at dusk · a single sword planted in broken stone, wind-whipped cloak scraps, a shaft of light breaking through storm clouds | desperate, heroic · storm grey, crimson sky glow, pale gold |

### 반영 절차
1. 이미지 생성 → 위 "만들 파일" 경로에 PNG 저장 (용량이 크면 webp 변환 후 확장자만 맞춤).
2. `03_card-data/sets/core-set.json`의 해당 카드 `assetId`를 `spells/generated/<이름>.png` / `traps/generated/<이름>.png`로 교체. (※ `*.json`은 `.gitignore`에 걸려 git에 안 올라간다. 빌드 결과 `dist/runtime/cards.js`가 커밋된다.)
3. `npm run build:runtime` → `npm run validate:cards`(경고 목록이 줄어드는지) → 도감/손패에서 확인 → `npm run qa:overflow`.

## (완료) P1 — 다른 카드 그림을 같이 쓰던 마법

> 2026-11-03: 사용자 제공 이미지로 마지막 4장(낙뢰·대지의 진동·폭풍우·대재앙)까지 교체 — 이제 그림을 공유하는 마법·함정은 없다. 원본은 `06_assets/source-art/spells/`.

## P2 — 소환 토큰
- ~~`마력 늑대`, `되살린 사령`~~ **완료 (2026-11-03)**: 사용자 제공 일러스트로 교체 — `dist/assets/tokens/mana-wolf.webp`, `necro-spirit.webp` (`TOKEN_ART`). 예전 SVG는 삭제.

## (완료) P3 — 성격 오라 문양
- 제우스·포세이돈·하데스·아테나를 인물 형상 대신 번개 왕관·삼지창과 파도·명계의 문·아이기스 방패 문양으로 제작했다. 한자·중국풍·이모지 표현은 사용하지 않았다.
- 파일: `dist/assets/guardians/{zeus,poseidon,hades,athena}-sigil-v1.png`.
