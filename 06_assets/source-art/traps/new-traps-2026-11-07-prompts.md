# 신규 함정 4장 이미지 생성 프롬프트 (2026-11-07)

공통 사양: `stylized-concept`, 프리미엄 판타지 TCG 함정 카드 일러스트, 세로 2:3, 1024×1536, 중앙 가로 띠에서 핵심 피사체가 읽히는 구도, 인물·문자·숫자·로고·워터마크·카드 프레임·UI·중국풍 요소 제외. 기존 함정(매복 지뢰, 역류 장벽, 배수의 진)과 같은 톤을 유지한다.

받은 이미지는 원본 PNG를 이 폴더에 두고, 게임용 WebP를 `dist/assets/traps/generated/`에 넣은 뒤 `03_card-data/sets/core-set.json`의 `assetId`를 바꾼다. 지금은 같은 발동 계열의 기존 함정 그림을 임시로 쓰고 있다.

## 불씨 덫 — `ember-snare-v1.png`

카드: 일반 · 불 · 비용 1 · 상대 챔프가 소환되면 그 챔프에게 2 피해. 임시 그림: 매복 지뢰.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG trap card artwork, vertical 2:3 portrait
Primary request: "불씨 덫" (Ember Snare) — a small, cheap fire trap hidden on the ground that bursts into flame the moment an enemy steps onto the field
Scene/backdrop: dark scorched battlefield ground at night, cracked earth with faint smoke, no visible people
Subject: a ring of half-buried glowing embers and thin smouldering wire forming a snare loop on the ground; at the center the snare has just triggered, a compact burst of sparks and a short tongue of flame leaps upward
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: snare ring centered in the middle horizontal band, flame burst rising vertically from it, readable at thumbnail size, edge-safe
Lighting/mood: sudden, small but sharp ambush, warm glow cutting through darkness
Color palette: ember orange, glowing red, soot black, ash grey, small white-hot sparks
Materials/textures: charred wood fragments, glowing coals, metal wire, drifting sparks, smoke
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 강철 방패 — `steel-guard-v1.png`

카드: 일반 · 금속 · 비용 2 · 내 영웅이 공격받으면 그 피해를 절반으로 줄인다. 임시 그림: 역류 장벽.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG trap card artwork, vertical 2:3 portrait
Primary request: "강철 방패" (Steel Guard) — a hidden steel barrier that springs up in front of the hero and absorbs half of an incoming blow
Scene/backdrop: stormy grey battlefield with distant ruined walls, no visible people
Subject: a large polished steel tower shield materializing out of interlocking metal plates, a heavy strike (a blade arc and a burst of force) hits its center; the impact splits, half the force scattering as silver sparks, the shield dented but standing
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: shield fills the central vertical axis, impact point in the middle horizontal band, scattered sparks fan outward to both sides, readable at thumbnail size, edge-safe
Lighting/mood: sturdy, protective, grounded, cold metallic sheen against a dark sky
Color palette: steel silver, gunmetal, cool white highlights, restrained pale blue, dark slate
Materials/textures: brushed steel, rivets, overlapping metal plates, bright sparks, faint dust
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no heraldic emblems, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 늪의 속박 — `swamp-bind-v1.png`

카드: 희귀 · 대지 · 비용 2 · 상대 챔프가 소환되면 그 챔프는 다음 공격 1회를 하지 못한다. 임시 그림: 서먼 널리파이어.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG trap card artwork, vertical 2:3 portrait
Primary request: "늪의 속박" (Swamp Bind) — a trap that turns the ground into a sucking bog and binds a newly arrived enemy so it cannot attack
Scene/backdrop: murky swamp battlefield under low fog, dead reeds and twisted roots, no visible people
Subject: thick mud and dark water rising in a spiral, with gnarled roots and mud-covered vines lashing upward to wrap and hold an empty space at the center (implied captured target, not shown), bubbles and droplets frozen mid-motion
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: the binding spiral of mud and roots centered in the middle horizontal band, roots converging from bottom corners toward the center, readable at thumbnail size, edge-safe
Lighting/mood: heavy, restraining, ominous but not horror; dim green glow from beneath the water
Color palette: deep olive, moss green, mud brown, dark teal, faint sickly yellow-green glow
Materials/textures: wet mud, glossy dark water, bark, wet vines, fog
Constraints: no people, no humanoid figures, no creatures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 결속의 함성 — `rally-cry-v1.png`

카드: 희귀 · 불 · 비용 3 · 상대 챔프가 내 챔프보다 3장 이상 많아지면 내 챔프 전체 공격력 +2(이번 대전 동안). 임시 그림: 배수의 진.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG trap card artwork, vertical 2:3 portrait
Primary request: "결속의 함성" (Rally Cry) — when outnumbered, a battle cry binds the remaining allies together and sets their weapons ablaze
Scene/backdrop: ruined battlefield at dusk, a dark mass of enemy banners and spear silhouettes looming on the horizon, no visible people
Subject: a small cluster of upright blades and spears planted in the ground in a tight circle, a shockwave of fiery sound rings bursting outward from the center, each weapon igniting with rising flame as the rings pass through them
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: the weapon circle and shockwave rings centered in the middle horizontal band, flames rising vertically, the looming enemy mass small in the upper background to show being outnumbered, readable at thumbnail size, edge-safe
Lighting/mood: defiant, unifying, rising courage against overwhelming odds
Color palette: blazing orange, crimson, molten gold, smoky charcoal, dusk purple sky
Materials/textures: steel blades, fire, embers, shock rings of heat distortion, smoke
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no heraldic emblems, no watermark, no card border, no UI, no Chinese-inspired motifs
```
