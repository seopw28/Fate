# 드로우 마법 대체 2장 이미지 생성 프롬프트 (2026-11-08)

카드를 뽑는 마법(아케인 인사이트, 프리즘 계시)은 카드 뽑기 기능과 겹쳐 다른 효과로 바꿨다. cardId는 저장 데이터 호환을 위해 그대로 두고 이름, 효과, 그림만 바꾼다.

공통 사양: `stylized-concept`, 프리미엄 판타지 TCG 마법 카드 일러스트, 세로 2:3, 1024×1536, 중앙 가로 띠에서 핵심 피사체가 읽히는 구도, 인물·문자·숫자·로고·워터마크·카드 프레임·UI·중국풍 요소 제외.

받은 이미지는 원본 PNG를 이 폴더에 두고, 게임용 WebP(`cwebp -q 88`)를 `dist/assets/spells/generated/`에 넣은 뒤 카드 데이터의 `assetId`를 바꾼다. 지금은 원래 카드 그림을 임시로 쓰고 있다.

## 마력 흡수 — `mana-drain-v1.png`

카드: 일반 · 물 · 비용 2 · 가장 강한 상대 하수인의 공격력을 3 영구히 낮춘다. cardId `tower.arcane-insight`(`core-set.json`). 임시 그림: 아케인 인사이트.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "마력 흡수" (Mana Drain) — a water-arcane spell that siphons the fighting power out of the strongest enemy, leaving its weapon dull and weak
Scene/backdrop: dim moonlit battlefield shrouded in thin blue mist, no visible people
Subject: a heavy enchanted greatsword planted in the ground, its red battle aura being pulled out of the blade in spiralling streams and drawn into a swirling sphere of deep blue water magic floating beside it; the blade's glow fading to grey where the power has been drained
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: sword and drain sphere side by side in the middle horizontal band, energy streams arcing between them, readable at thumbnail size, edge-safe
Lighting/mood: quiet, eerie, draining weakness
Color palette: deep ocean blue, cyan glow, fading crimson streaks, cold grey steel
Materials/textures: flowing liquid-light ribbons, water droplets suspended in air, rusted dulled metal, faint runes
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```

## 프리즘 탄막 — `prism-barrage-v1.png`

카드: 일반 · 금속 · 비용 2 · 무작위 상대 하수인에게 2 피해를 3번 준다. cardId `arcana.prism-revelation`(`character-expansions.json`). 임시 그림: 프리즘 계시.

```text
Use case: stylized-concept
Asset type: premium fantasy TCG spell card artwork, vertical 2:3 portrait
Primary request: "프리즘 탄막" (Prism Barrage) — a floating crystal prism splits light into several sharp beams that rain down on random enemies
Scene/backdrop: twilight battlefield with scattered rocks, faint dust in the air, no visible people
Subject: a large faceted metallic-crystal prism hovering in the upper center, refracting one bright beam into three rainbow-edged light bolts that streak downward at different angles and strike the ground in small bursts
Style/medium: polished high-detail fantasy game illustration, painterly, premium collectible card art
Composition/framing: prism in the upper middle, three beams fanning across the middle horizontal band, readable at thumbnail size, edge-safe
Lighting/mood: dazzling, quick, scattered strikes
Color palette: silver chrome, prismatic rainbow edges, white-hot beam cores, deep twilight violet background
Materials/textures: polished crystal facets, metallic frame, light flares, sparks and small craters
Constraints: no people, no humanoid figures, no readable text, no letters, no numbers, no logos, no watermark, no card border, no UI, no Chinese-inspired motifs
```
