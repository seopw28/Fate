# 다른 카드 그림을 빌려 쓰는 마법 4장 이미지 생성 프롬프트 (2026-11-08)

아래 4장은 자기 그림 없이 다른 카드의 그림을 같이 쓰고 있어 도감과 손패에서 두 카드가 구분되지 않는다. 각 카드는 발동할 때 전면 컷인 연출(괄호 안 이름)이 붙으므로 그림도 그 연출과 같은 이미지로 맞춘다.

공통 사양: `stylized-concept`, 프리미엄 판타지 TCG 마법 카드 일러스트, 세로 2:3, 1024×1536, 중앙 가로 띠에서 핵심 피사체가 읽히는 구도, 인물·문자·숫자·로고·워터마크·카드 프레임·UI·중국풍 요소 제외.

받은 이미지는 원본 PNG를 이 폴더에 두고, 게임용 WebP를 `dist/assets/spells/generated/`에 넣은 뒤 `03_card-data/sets/core-set.json`의 `assetId`를 바꾼다.

## 실피드 템페스트 — `sylphid-tempest-v1.png`

카드: 희귀 · 바람(나무) · 비용 5 · 아군 포함 모든 유닛에게 4 피해. 지금 그림: 질풍 회오리와 공유. 발동 컷인: 칼바람(gust).

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "실피드 템페스트" (Sylphid Tempest) — a storm summoned by wind spirits that slices across the whole battlefield, hurting friend and foe alike
Scene/backdrop: open grassland battlefield under a churning green-grey sky, torn banners and debris flying, no visible people
Subject: a vast horizontal wall of razor-sharp wind blades sweeping across the field, faint translucent sylph-like wisps of light (abstract, not human figures) riding inside the gale, grass and stones ripped upward
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: the blade storm crosses the middle horizontal band from left to right, readable at thumbnail size, edge-safe
Lighting/mood: overwhelming, indiscriminate, wild
Color palette: jade green, pale mint, silver white wind streaks, storm grey
Materials/textures: crescent wind blades, flying leaves and dust, swirling air currents, light motion blur
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 가이아 브레이커 — `gaia-breaker-v1.png`

카드: 희귀 · 대지 · 비용 5 · 아군 포함 모든 유닛에게 5 피해. 지금 그림: 대지 균열과 공유. 발동 컷인: 대지(earth).

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "가이아 브레이커" (Gaia Breaker) — the earth itself erupts and shatters the entire battlefield in one blow
Scene/backdrop: wide rocky battlefield seen from a low angle, dust-filled amber sky, no visible people
Subject: the ground splitting open in a huge radial fracture, massive slabs of rock heaved upward and breaking apart, glowing molten-gold light pouring out of the cracks at the center
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: fracture center in the middle horizontal band, rock slabs radiating outward, readable at thumbnail size, edge-safe
Lighting/mood: crushing, seismic, unstoppable
Color palette: deep umber, sandstone, burnt amber, glowing gold cracks, dust haze
Materials/textures: granite slabs, flying gravel, dust clouds, glowing fissures
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 아주르 썬더폴 — `azure-thunderfall-v1.png`

카드: 희귀 · 물 · 비용 4 · 모든 적에게 연쇄 번개 5 피해. 지금 그림: 연쇄 번개와 공유. 발동 컷인: 번개(lightning).

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "아주르 썬더폴" (Azure Thunderfall) — a waterfall of blue lightning pours down from storm clouds and jumps from enemy to enemy
Scene/backdrop: dark rain-soaked battlefield under a deep blue thunderstorm, puddles reflecting light, no visible people
Subject: a cascading column of azure lightning falling like a waterfall from the clouds, splitting at the ground into several branching arcs that leap sideways in a chain
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: lightning column centered, chain arcs spreading across the middle horizontal band, readable at thumbnail size, edge-safe
Lighting/mood: sudden, electric, precise
Color palette: azure blue, electric cyan, white-hot core, deep navy storm, rain silver
Materials/textures: rain streaks, crackling plasma, water splashes, glowing reflections
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 볼트 레퀴엠 — `volt-requiem-v1.png`

카드: 전설 · 물 · 비용 6 · 모든 적에게 연쇄 번개 7 피해. 지금 그림: 낙뢰와 공유. 발동 컷인: 번개(lightning).

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "볼트 레퀴엠" (Volt Requiem) — a solemn, legendary thunder ritual that ends the battle with a final storm of lightning
Scene/backdrop: ruined gothic sanctuary open to a violet-blue thundersky, broken pillars, no visible people
Subject: a giant floating ring of runic lightning above the ruins, from which many thick bolts strike down simultaneously in a symmetrical pattern, the air filled with glowing static motes
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art, legendary-tier grandeur
Composition/framing: lightning ring in the upper middle, bolts reaching down across the middle horizontal band, readable at thumbnail size, edge-safe
Lighting/mood: grand, mournful, final
Color palette: indigo, electric blue, violet, white-hot highlights, dark stone grey
Materials/textures: cracked marble pillars, rune circle of light, crackling bolts, floating sparks
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```
