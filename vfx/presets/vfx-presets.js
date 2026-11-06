(function (global) {
  const elements = {
    fire: { label: '화염', icon: '🔥', color: '#ff6b3d', accent: '#ffd36a' },
    water: { label: '물', icon: '💧', color: '#52d9ff', accent: '#d9fbff' },
    wind: { label: '바람', icon: '🌪️', color: '#72f2bd', accent: '#e1fff3' },
    earth: { label: '대지', icon: '🪨', color: '#d4a15d', accent: '#f3dfad' },
    arcane: { label: '비전', icon: '✦', color: '#c88cff', accent: '#f2dcff' }
  };

  const presets = [
    { id: 'fire-slash', name: '홍련 참격', element: 'fire', action: 'slash', intensity: 2, asset: 'fireSlash', shake: 8, particles: 24, note: '짧고 날카로운 근접 타격' },
    { id: 'water-slash', name: '유수 절단', element: 'water', action: 'slash', intensity: 2, asset: 'waterRise', shake: 4, particles: 18, note: '휘어지는 물결형 참격' },
    { id: 'wind-slash', name: '질풍 연참', element: 'wind', action: 'slash', intensity: 2, asset: null, shake: 5, particles: 30, note: '세 갈래 고속 연속 베기' },
    { id: 'earth-slash', name: '암반 파쇄', element: 'earth', action: 'slash', intensity: 3, asset: 'earthBurst', shake: 12, particles: 20, note: '무겁게 내려찍는 파쇄 타격' },
    { id: 'fire-projectile', name: '홍염탄', element: 'fire', action: 'projectile', intensity: 2, asset: 'fireBall', shake: 8, particles: 28, note: '비행 궤적 뒤 폭발' },
    { id: 'water-projectile', name: '빙결 창', element: 'water', action: 'projectile', intensity: 2, asset: 'waterRise', shake: 5, particles: 22, note: '관통 후 서리 파편' },
    { id: 'wind-projectile', name: '진공 칼날', element: 'wind', action: 'projectile', intensity: 1, asset: null, shake: 3, particles: 26, note: '거의 보이지 않는 고속 탄체' },
    { id: 'earth-projectile', name: '낙석 포격', element: 'earth', action: 'projectile', intensity: 3, asset: 'earthBurst', shake: 14, particles: 24, note: '포물선 낙하와 지면 충돌' },
    { id: 'healing-spring', name: '회복의 샘', element: 'water', action: 'heal', intensity: 2, asset: 'waterRise', shake: 0, particles: 20, note: '상승 입자와 회복 파동' },
    { id: 'flame-infusion', name: '화염 각인', element: 'fire', action: 'buff', intensity: 2, asset: null, shake: 2, particles: 26, note: '대상 주위를 감싸는 강화 고리' },
    { id: 'counter-barrier', name: '역류 장벽', element: 'arcane', action: 'shield', intensity: 2, asset: null, shake: 2, particles: 18, note: '육각 장벽과 반사 파동' },
    { id: 'arcane-circle-medium', name: '아케인 서클', element: 'arcane', action: 'cinematic', intensity: 2, asset: 'arcaneCircleMedium', shake: 4, particles: 18, duration: 1250, note: '삼중 마법진 회전과 중심 응축' },
    { id: 'dark-orb-medium', name: '어비스 오브', element: 'arcane', action: 'cinematic', intensity: 2, asset: 'darkOrbMedium', shake: 7, particles: 20, duration: 1180, note: '암흑 구체 수축 후 중력 폭발' },
    { id: 'light-blades-medium', name: '루미너스 블레이드', element: 'water', action: 'cinematic', intensity: 2, asset: 'lightBladesMedium', shake: 8, particles: 22, duration: 920, note: '세 갈래 빛의 칼날 교차 참격' },
    { id: 'flame-pillar-medium', name: '인페르노 필러', element: 'fire', action: 'cinematic', intensity: 2, asset: 'flamePillarMedium', shake: 11, particles: 28, duration: 1080, note: '지면에서 솟구치는 수직 화염 기둥' },
    { id: 'sky-gust-v1', name: '천공 돌풍 I', element: 'wind', action: 'cinematic', intensity: 3, asset: 'windGustV1', shake: 7, particles: 18, duration: 1000, note: '원형으로 응축되는 회전 회오리' },
    { id: 'sky-gust-v2', name: '천공 돌풍 II', element: 'wind', action: 'cinematic', intensity: 3, asset: 'windGustV2', shake: 8, particles: 20, duration: 1000, note: '두 갈래가 교차하는 횡풍 칼날' },
    { id: 'sky-gust-v3', name: '천공 돌풍 III', element: 'wind', action: 'cinematic', intensity: 3, asset: 'windGustV3', shake: 9, particles: 22, duration: 1000, note: '위로 솟구치는 수직 나선 폭풍' },
    { id: 'judgment-lightning-v1', name: '심판의 낙뢰 I', element: 'water', action: 'cinematic', intensity: 3, asset: 'lightningStrikeV1', shake: 12, particles: 14, duration: 1000, note: '굵은 단일 낙뢰와 집중 충돌' },
    { id: 'judgment-lightning-v2', name: '심판의 낙뢰 II', element: 'water', action: 'cinematic', intensity: 3, asset: 'lightningStrikeV2', shake: 13, particles: 16, duration: 1000, note: 'Y자로 갈라져 합류하는 분기 낙뢰' },
    { id: 'judgment-lightning-v3', name: '심판의 낙뢰 III', element: 'water', action: 'cinematic', intensity: 3, asset: 'lightningStrikeV3', shake: 14, particles: 18, duration: 1000, note: '세 지점에 연속으로 떨어지는 다중 낙뢰' },
    { id: 'cataclysm', name: '대지 붕괴', element: 'earth', action: 'aoe', intensity: 3, asset: 'earthBurst', shake: 18, particles: 42, note: '다중 균열과 광역 충격파' }
  ];

  const assets = {
    fireSlash: { count: 35, path: i => `assets/vfx/fire/fx2_swordFire/spell_decap_1_zoomblur_${i}.png`, fps: 24 },
    fireBall: { count: 20, path: i => `assets/vfx/fire/fx3_fireBall/spell_decap_2_ball_${i}.png`, fps: 22 },
    waterRise: { count: 22, path: i => `assets/vfx/water/fx1_blue_topEffect/spell_bluetop_1_${i}.png`, fps: 24 },
    earthBurst: { count: 19, path: i => `assets/vfx/earth/fx10_blackExplosion/smoke_black_1_19_${i}.png`, fps: 22 },
    windGustV1: { static: true, path: () => 'assets/vfx/cinematic/wind-gust-v1.png' },
    windGustV2: { static: true, path: () => 'assets/vfx/cinematic/wind-gust-v2.png' },
    windGustV3: { static: true, path: () => 'assets/vfx/cinematic/wind-gust-v3.png' },
    lightningStrikeV1: { static: true, path: () => 'assets/vfx/cinematic/lightning-strike-v1.png' },
    lightningStrikeV2: { static: true, path: () => 'assets/vfx/cinematic/lightning-strike-v2.png' },
    lightningStrikeV3: { static: true, path: () => 'assets/vfx/cinematic/lightning-strike-v3.png' },
    arcaneCircleMedium: { static: true, path: () => 'assets/vfx/medium/arcane-circle-v1.png' },
    darkOrbMedium: { static: true, path: () => 'assets/vfx/medium/dark-orb-v1.png' },
    lightBladesMedium: { static: true, path: () => 'assets/vfx/medium/light-blades-v1.png' },
    flamePillarMedium: { static: true, path: () => 'assets/vfx/medium/flame-pillar-v1.png' }
  };

  global.TCG_VFX = { elements, presets, assets };
})(window);
