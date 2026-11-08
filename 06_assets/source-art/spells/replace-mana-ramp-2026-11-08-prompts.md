# 마나 증가 마법 대체 2장 이미지 생성 프롬프트 (2026-11-08)

최대 마나를 영구히 늘리던 `마나 오버플로`와 `룬석 결정`을 다른 효과로 바꿨다. cardId는 저장 데이터 호환을 위해 그대로 두고 이름, 효과, 그림만 바꾼다.

공통 사양: `stylized-concept`, 프리미엄 판타지 TCG 마법 카드 일러스트, 세로 2:3, 1024×1536, 중앙 가로 띠에서 핵심 피사체가 읽히는 구도, 인물·문자·숫자·로고·워터마크·카드 프레임·UI·중국풍 요소 제외. 기존 마법(진홍의 화염구, 대지의 진동)과 같은 톤을 유지한다.

받은 이미지는 원본 PNG를 이 폴더에 두고, 게임용 WebP를 `dist/assets/spells/generated/`에 넣은 뒤 카드 데이터의 `assetId`를 바꾼다. 지금은 임시 그림을 쓰고 있다.

## 강철 파쇄탄 — `steel-shatter-v1.png`

카드: 희귀 · 금속 · 비용 2 · 상대 소환사에게 5 피해. cardId `tower.mana-overflow`(`core-set.json`). 임시 그림: 진홍의 화염구.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "강철 파쇄탄" (Steel Shatter Shot) — a heavy enchanted steel projectile fired straight past the battlefield to strike the enemy commander directly
Scene/backdrop: dark stormy battlefield sky, distant ruined fortress silhouette, no visible people
Subject: a large spinning shell of polished dark steel wrapped in bright silver runic light, tearing through the air toward the viewer's upper right, leaving a straight shockwave trail and shattered metal shards in its wake
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: projectile centered in the middle horizontal band, motion trail crossing diagonally, readable at thumbnail size, edge-safe
Lighting/mood: decisive, piercing, a finishing blow
Color palette: gunmetal grey, polished silver, cold white highlights, small hints of molten orange at the tip
Materials/textures: forged steel, glowing rune etchings, metal shards, air shockwave rings, sparks
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 대지의 장벽 — `earth-bulwark-v1.png`

카드: 희귀 · 대지 · 비용 2 · 내 하수인 전원에게 보호막(다음 피해 1회 무효). cardId `arcana.rune-crystal`(`character-expansions.json`). 임시 그림: 대지의 진동.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "대지의 장벽" (Earth Bulwark) — protective walls of living stone rise from the ground to shield an entire line of allies at once
Scene/backdrop: rocky highland battlefield at dusk, dust in the air, no visible people
Subject: a row of curved stone shield-walls bursting up from the earth in a wide arc, each wall carved with faint glowing amber runes, a translucent golden dome of light linking them together
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: the arc of stone walls spans the middle horizontal band, dome rising above it, readable at thumbnail size, edge-safe
Lighting/mood: steady, reassuring, unbreakable protection
Color palette: warm sandstone brown, amber gold rune light, deep earth umber, soft dusk sky
Materials/textures: rough granite, falling pebbles and dust, glowing rune carvings, translucent light barrier
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```
