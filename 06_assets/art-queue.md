# 일러스트 생성 큐 (Codex 토큰 회복 시 이 순서대로)

> **Codex(`image_gen`) 사용 한도가 회복되면 가장 먼저 이 문서의 P0부터 만든다.**
> Claude는 이미지를 생성할 수 없다. 코드로 그린 SVG 일러스트는 품질이 낮아 쓰지 않는다.
> 마지막 확인: 2026-11-01. 이전 기록상 Codex 한도 해제 시점은 2026-11-04 15:35.
> 이 큐는 `CLAUDE.md`, `06_assets/README.md`, `02_game-design/game-rules/09-decisions-and-open-issues.md`, `npm run validate:cards`의 경고에서 가리킨다.

## P0 — 일러스트가 아예 없는 마법·함정 (도감에 ✦ 아이콘만 보임) · 7장

| 카드 | cardId | 종류/등급 | 비용 | 지금 assetId | 만들 파일 |
|---|---|---|---|---|---|
| Healing Spring | `core.spring-of-restoration` | 마법/일반 | 2 | `spells/spring-of-restoration` | `dist/assets/spells/generated/spring-of-restoration.png` |
| Crimson Bolt | `core.crimson-bolt` | 마법/일반 | 3 | `spells/crimson-bolt` | `dist/assets/spells/generated/crimson-bolt.png` |
| Glacial Chain | `core.frozen-chain` | 마법/희귀 | 3 | `spells/frozen-chain` | `dist/assets/spells/generated/frozen-chain.png` |
| Flame Sigil | `core.fire-inscription` | 마법/희귀 | 2 | `spells/fire-inscription` | `dist/assets/spells/generated/fire-inscription.png` |
| Ambush Mine | `core.ambush-mine` | 함정/희귀 | 2 | `traps/ambush-mine` | `dist/assets/traps/generated/ambush-mine.png` |
| Counterflow Barrier | `core.counter-current` | 함정/희귀 | 2 | `traps/counter-current` | `dist/assets/traps/generated/counter-current.png` |
| Last Stand | `core.last-stand` | 함정/희귀 | 2 | `traps/last-stand` | `dist/assets/traps/generated/last-stand.png` |

(참고: 프로토타입 `prototype.comeback-flare`, `chronicle.prophecy-of-ruin`도 일러스트가 없지만 출시 전 카드라 P0 뒤로 미룬다.)

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

## P1 — 임시로 다른 카드 그림을 같이 쓰는 마법 · 8장 (전용 일러스트로 교체)

| 카드 | cardId | 지금 쓰는 그림(중복) |
|---|---|---|
| 대지의 진동 | `storm.tremor` | `sacred-purge.png` (세이크리드 퍼지와 공유) |
| 화염 폭풍 | `storm.firestorm` | `meteor-fall.png` (메테오 폴과 공유) |
| 폭풍우 | `storm.tempest` | `void-recall.png` (보이드 리콜과 공유) |
| 종말의 파동 | `storm.doom-wave` | `soul-return.png` (소울 리턴과 공유) |
| 대재앙 | `storm.great-ruin` | `amaterasu.png` (아마테라스와 공유) |
| 프로스트 노바 | `tower.frost-nova` | 미국 농무부 눈결정 사진(퍼블릭 도메인, 임시) |

(이 카드들은 `storm.*`가 `character-expansions.json`, `tower.frost-nova`가 `core-set.json`에 있다. 새 파일은 `dist/assets/spells/generated/`.)

## P2 — 소환 토큰
- `마력 늑대` (`dist/assets/tokens/mana-wolf.svg`), `되살린 사령` (`necro-spirit.svg`): 코드로 그린 SVG가 마음에 들지 않아 임시로 한글 인장(늑/령)으로 교체했다. 진지한 톤의 일러스트(PNG/WebP)로 교체하고 `TOKEN_ART` 경로를 바꾼다.

## P3 — 수호신 아이콘
- 선택 화면 카드와 영웅 프로필의 수호신 아이콘(청룡·백호·주작·현무, 약자멸시)은 CSS로 그린 한글 인장(청·백·주·현·약)이다. 진지한 톤의 이미지로 교체. **한자·중국풍 연출과 귀여운 이모지 느낌은 금지**(사용자 선호).
- 코드 위치: `dist/index.html`의 `guardianEmblem()`, `.gd-emblem`, `.avatar.gd-avatar`, `updateGuardianChips()`.
