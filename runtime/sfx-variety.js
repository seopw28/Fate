/* 피격·평타 효과음 변주 (v2: 공간감 · 몸통 · 잔향).
 *
 * 소리 한 번 = 여러 층의 합성:
 *   ① 몸통(body)   : 길게 울리는 기존 샘플(폭발·금속·칼) — 음높이/필터를 속성별로 달리 해서 공간감과 무게를 만든다
 *   ② 어택(accent) : Kenney Impact Sounds(CC0)의 짧은 타격음 — 매번 다른 변형을 골라 질감을 바꾼다
 *   ③ 합성 질감    : 잡음·공명(resonator) 기반 레이어 (삑 하는 순수 톤은 쓰지 않는다)
 * 그리고 공통으로
 *   - 잔향(리버브): 합성 임펄스 응답(IR)으로 만든 ConvolverNode. 강타일수록 잔향이 크다.
 *   - 스테레오 폭: 중간 이상 타격은 같은 소리를 좌우로 11ms 어긋나게 겹쳐 넓힌다 (Haas).
 *   - 압축기: 여러 층이 겹쳐도 찌그러지지 않고 하나의 소리로 묶인다.
 *   - 속성별 EQ: 불=저음 두툼, 물=고음 반짝, 대지=아주 낮게.
 * 같은 조합이 연달아 나오지 않게 하고, 음높이·볼륨·타이밍·좌우 위치를 매번 조금씩 바꾼다.
 * 샘플이 아직 로드되지 않았거나 실패해도 합성음만으로 소리가 난다. (PM 메모: 피격음의 "고급스러움"은 대부분 ①과 잔향에서 나온다)
 *
 * 사용: const api = FateSfx.init({ engine: ()=>AudioContext|null, bus: ctx=>GainNode }); api.load(); api.playHit('fire', 6, pan);
 */
(function (root) {
  'use strict';

  // assets/audio/sfx/<이름>_00<번호>.mp3  (12_tools/asset-pipeline/build-sfx.py 로 생성)
  const BANK = {
    impactBell_heavy: 5, impactGeneric_light: 5, impactGlass_heavy: 5, impactGlass_light: 5, impactGlass_medium: 5,
    impactMetal_heavy: 5, impactMetal_light: 5, impactMetal_medium: 5, impactMining: 5, impactPlank_medium: 5,
    impactPlate_heavy: 5, impactPlate_light: 5, impactPlate_medium: 5, impactPunch_heavy: 5, impactPunch_medium: 5,
    impactSoft_heavy: 5, impactSoft_medium: 5, impactTin_medium: 5, impactWood_heavy: 5, impactWood_light: 5, impactWood_medium: 5,
    // Basic Spell Impacts(CC0, 스테레오·잔향 포함): 06_assets/audio/basic-spell-impacts, 변환은 12_tools/asset-pipeline/build-spell-sfx.py
    // spell<속성>은 폭발 직전부터 자른 피격음용, spellIceCast는 차오름(약 0.5초 뒤 정점)까지 전체를 쓰는 빙결 시전음용
    // spellLightningCast는 번개가 내리치는 순간이 0.45초에 오도록 정렬한 물 공격의 번개 연출("아주르 썬더폴")용
    spellFire: 5, spellIce: 5, spellIceCast: 5, spellLightning: 5, spellLightningCast: 5, spellWater: 5
  };
  // 기존 3종 샘플(길게 울리는 몸통 소리)
  const LEGACY = { legacy_slash: 'assets/audio/sword-slash.mp3', legacy_explosion: 'assets/audio/explosion-impact.mp3', legacy_metal: 'assets/audio/metal-impact.mp3' };

  // 층 정의: s=샘플 이름, g=볼륨 배율, r=음높이 배율, lp/hp=저역/고역 필터(Hz), dur=최대 길이(초)
  const L = (s, o = {}) => Object.assign({ s }, o);

  // 속성별 조합 후보 (모든 피격은 강한 신호로 통일: 피해 강도에 따라 소리를 바꾸지 않는다).
  // 한 번 칠 때 후보 중 하나(직전 제외)를 고르고 그 안의 층을 모두 겹쳐 재생한다.
  const HIT_SETS = {
    // 불: 처음 쓰던 폭발 샘플 "원본"이 가장 불다워서 가공 없이 그대로 쓴다 (변주는 음높이·좌우 위치·볼륨의 미세한 흔들림으로만).
    fire: [
      [L('legacy_explosion', { g: 0.9 })]
    ],
    // 물: 공간감(잔향) 없이 건조하게, "물이 튀기는 소리"만. 실로폰·종처럼 음정이 들리는 유리/얼음 샘플은 쓰지 않고(빙결 전용),
    // 물 주문 샘플(spellWater)을 여러 겹으로 키워 튀는 느낌을 살린다. 샘플 팩을 끈 비교용(?sfxpack=base)에는 마지막 조합만 남는다.
    water: [
      [L('spellWater', { g: 1.1, dur: 0.6 }), L('spellWater', { g: 0.7, r: 1.15, dur: 0.4 })],
      [L('spellWater', { g: 1, r: 0.95, dur: 0.6 }), L('impactSoft_medium', { g: 0.5 })],
      [L('spellWater', { g: 1.1, r: 1.05, dur: 0.55 }), L('spellWater', { g: 0.6, r: 0.88, dur: 0.45 })],
      [L('spellWater', { g: 1, r: 1.1, dur: 0.5 }), L('spellWater', { g: 0.65, r: 1.3, dur: 0.35 }), L('impactSoft_medium', { g: 0.4, r: 1.2 })],
      [L('impactSoft_medium', { g: 0.9 }), L('impactSoft_medium', { g: 0.6, r: 1.2 })]
    ],
    // 바람(칼날): 칼 샘플을 높은 음으로 예리하게. 장난감 소리로 들리던 금속판·종 샘플은 빼고, 번개/고음 금속은 아주 얇은 어택으로만 얹는다.
    wind: [
      [L('legacy_slash', { g: 1 }), L('spellLightning', { g: 0.4, hp: 2500, dur: 0.3 })],
      [L('legacy_slash', { g: 0.95, r: 1.1 }), L('impactMetal_light', { g: 0.35, hp: 3000, dur: 0.25 })],
      [L('legacy_slash', { g: 1, r: 0.95, hp: 900 }), L('spellLightning', { g: 0.35, r: 1.2, hp: 3500, dur: 0.25 })],
      [L('legacy_slash', { g: 0.9, r: 1.2 }), L('impactGeneric_light', { g: 0.5, hp: 3500 })],
      [L('legacy_slash', { g: 1 }), L('legacy_metal', { g: 0.18, r: 1.8, hp: 3500, dur: 0.3 })],
      [L('legacy_slash', { g: 0.85, r: 1.3 })]
    ],
    earth: [
      [L('impactWood_heavy'), L('impactSoft_heavy'), L('legacy_explosion', { g: 0.55, r: 0.7, lp: 1200 })],
      [L('impactMining'), L('legacy_explosion', { g: 0.5, r: 0.65, lp: 1000 })],
      [L('impactPunch_heavy', { r: 0.85 }), L('impactMining', { g: 0.7 }), L('legacy_metal', { g: 0.25, r: 0.7 }), L('legacy_explosion', { g: 0.3, r: 0.75, lp: 1100 })],
      [L('impactMining'), L('impactPunch_heavy', { r: 0.8 }), L('impactSoft_heavy', { r: 0.7 }), L('legacy_explosion', { g: 0.85, r: 0.6, lp: 1400 })],
      [L('impactWood_heavy', { r: 0.85 }), L('impactMining', { g: 0.8 }), L('legacy_explosion', { g: 0.8, r: 0.7, lp: 1500 }), L('legacy_metal', { g: 0.3, r: 0.6 })]
    ],
    // 무속성(금속): 강철끼리 부딪히는 "깡! 쨍! 창!" — 단단하고 밝은 어택 위주, 여운은 짧게. 폭발·펀치·종 샘플은 금속으로 들리지 않아 뺐다.
    // 철판/금속 타격 샘플을 어택으로, 길게 울리는 금속 샘플은 짧게 잘라(dur) 얹고, 합성 "부딪힘"(잡음 어택 + 어긋난 고음 공명)을 더한다.
    neutral: [
      [L('impactPlate_heavy'), L('impactMetal_heavy', { g: 0.8 }), L('legacy_metal', { g: 0.5, r: 1.15, dur: 0.5 })],
      [L('impactMetal_medium', { r: 1.1 }), L('impactPlate_medium', { g: 0.8 }), L('impactTin_medium', { g: 0.4, hp: 2500 })],
      [L('impactPlate_heavy', { r: 1.12 }), L('impactMetal_light', { g: 0.7, r: 1.3, hp: 1800 }), L('legacy_metal', { g: 0.45, r: 1.3, dur: 0.45 })],
      [L('impactMetal_heavy', { r: 1.05 }), L('impactPlate_medium', { g: 0.9, r: 1.1 }), L('legacy_metal', { g: 0.55, dur: 0.5 })],
      [L('impactPlate_medium', { r: 1.2 }), L('impactMetal_medium', { g: 0.9, r: 1.15 }), L('impactTin_medium', { g: 0.5, r: 1.2 })]
    ]
  };
  // 공간·길이 설정 (wet=잔향 양, wide=좌우 폭, cap=샘플 최대 길이 초, layers=합성 질감 개수)
  // 울림 길이는 처음 설계(잔향 1.7초·꼬리 2.0초)의 70%로 줄였다: 한 턴에 타격이 연속으로 5번 나도 소리가 뭉치지 않게.
  const STRONG = { cap: 1.4, layers: 2, rate: 0.95, power: 0.85 };
  const IR_SECONDS = { long: 1.15, short: 0.4 }; // long=홀(1.7초×0.7 이하), short=작은 방(칼날·금속처럼 예리한 소리용)
  // 연속 타격 대응: 최근 CROWD_WINDOW초 안의 타격 수가 늘수록 잔향·꼬리를 줄이고, 새 타격 때 이전 잔향을 잠깐 눌러 준다
  const CROWD_WINDOW = 2.5, CROWD_STEP = 0.16, CROWD_MIN = 0.45;
  const FADE_DECIBELS_E = 6.9; // 지수 감쇠가 cap에서 e^-6.9 ≈ -60dB 가 되도록 하는 상수 (페이드 길이 ÷ 이 값 = 시정수)
  // 속성별 공간·음색: wet=잔향 양, space=잔향 종류, tail=샘플 꼬리 길이 배율(전체 cap 기준), wide=좌우 폭, hp=저음 제거(Hz), fade=꼬리 감쇠 시작 비율,
  // rate=음높이 배율, lp=고음 제한(Hz), jitter=음높이 무작위 폭, synth=합성 질감 층 수(없으면 STRONG.layers), stack=겹쳐 내기
  // 구별이 되도록 속성마다 다르게 둔다: 대지는 넓고 크게, 불은 원본 그대로, 물은 건조하게 겹쳐서, 바람(칼날)은 높고 예리하게, 무속성(금속)은 짧게.
  const ELEMENT = {
    // 불: 원본 폭발 샘플을 가공 없이 (EQ·좌우 확장·합성음 없음). 길이만 부드럽게 줄인다.
    fire: { eq: [], wet: 0.08, space: 'long', tail: 1.0, wide: 0, hp: 0, fade: 0.45, jitter: 0.06, synth: 0 },
    // 물: 공간감(잔향) 완전 제거. 처음 소리를 4번 겹쳐 튀는 물방울·물결처럼. stack: count=반복 횟수(첫 번째는 일반 재생), spacing=간격(초),
    //   decay=반복마다 곱해지는 볼륨, pitch=반복마다 올라가는 음높이, jitter=무작위 폭, spread=좌우로 번지는 정도, layers=반복할 층 수(앞쪽 층=어택), cap=반복음 길이(초)
    water: { eq: [{ type: 'highshelf', freq: 6000, gain: 3 }], wet: 0, space: 'short', tail: 0.5, wide: 0.12, hp: 0, fade: 0.4, stack: { count: 4, spacing: [0.04, 0.075], decay: 0.7, pitch: 0.03, jitter: 0.05, spread: 0.5, layers: 1, cap: 0.22 } },
    // 바람(칼날): 높고 예리하게 (음높이 +20%, 저음 600Hz 이하 제거, 고음 강조), 잔향 거의 없음. 여러 번 스치도록 3번 겹침.
    wind: { eq: [{ type: 'highshelf', freq: 4500, gain: 4 }], wet: 0.02, space: 'short', tail: 0.3, wide: 0.1, hp: 600, fade: 0.1, rate: 1.2, stack: { count: 3, spacing: [0.03, 0.055], decay: 0.74, pitch: 0.04, jitter: 0.03, spread: 0.4, layers: 1, cap: 0.16 } },
    // 대지: 더 낮고 묵직하게 — rate·lp·강한 저음 EQ. 공간감(잔향·꼬리·좌우 폭)을 크게. pitch는 합성 저음(쿵·우르릉)에도 적용된다
    earth: { eq: [{ type: 'lowshelf', freq: 140, gain: 8 }], wet: 0.38, space: 'long', tail: 1.0, wide: 0.4, hp: 0, fade: 0.4, rate: 0.82, lp: 4200 },
    // 무속성(금속): 강철 부딪힘 — 고음을 살리고 여운은 짧게(tail 0.55), "깡-깡" 두 번 연달아 부딪히는 느낌으로 2번 겹침, 합성 부딪힘 1층
    neutral: { eq: [{ type: 'highshelf', freq: 3000, gain: 4 }], wet: 0.08, space: 'short', tail: 0.55, wide: 0.2, hp: 0, fade: 0.15, synth: 1, stack: { count: 2, spacing: [0.07, 0.1], decay: 0.6, pitch: 0.06, jitter: 0.04, spread: 0.3, layers: 1, cap: 0.3 } },
  };
  // 조합별 음량 보정 (12_tools/qa/measure-sfx.py --calibrate 로 조합마다 렌더링·측정해 맞춘 값). TRIM[속성][조합 번호]
  // 목표: 속성·조합이 달라도 비슷한 크기로 들리게 한다. 값이 없으면 1.
  const TRIM = {
    fire: [0.84],
    water: [12.60, 12.60, 12.60, 12.60, 12.60], // 물 튀는 소리를 +2dB 키움 (보정 도구의 클램프 10 밖이라 직접 지정)
    wind: [8.69, 8.39, 9.49, 9.05, 8.86, 9.07],
    earth: [4.29, 4.69, 7.65, 3.37, 3.27],
    neutral: [15.00, 15.00, 15.00, 15.00, 15.00] // 금속 "깡·쨍" 조합 (보정 도구의 클램프 10 밖이라 직접 지정)
  };
  // 합성 질감 레이어 이름 (잡음·공명 기반만 사용)
  const SYNTH_NAMES = {
    fire: ['crackle', 'boom', 'sizzle'],
    water: ['splash', 'splash', 'splash'], // 음정이 들리는 drops·sparkle(실로폰처럼 들림)은 빼고 물 튀는 잡음만
    wind: ['whoosh', 'swish', 'slice'],
    earth: ['rumble', 'crack', 'thud'],
    neutral: ['clash', 'clash', 'clash'] // 강철이 부딪히는 "깡·쨍"만 사용
  };

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // 직전(last)과 다른 번호를 고른다. 후보가 1개뿐이면 0.
  function pickIndex(last, n, rnd = Math.random) {
    if (n <= 1) return 0;
    let index = Math.floor(rnd() * (n - 1));
    if (last !== undefined && last >= 0 && index >= last) index++;
    return index;
  }
  // 합성 임펄스 응답: 12ms 프리딜레이 + 초기 반사 + 고음부터 먹혀 들어가는 지수 감쇠 (RT60 ≈ seconds)
  function makeImpulse(ctx, seconds = 1.7) {
    const sr = ctx.sampleRate, length = Math.max(8, Math.floor(sr * seconds)), pre = Math.floor(sr * 0.012);
    const buffer = ctx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let y = 0;
      for (let i = pre; i < length; i++) {
        const t = (i - pre) / sr, envelope = Math.exp((-6.9 * t) / seconds), alpha = 0.5 * Math.exp(-t * 3) + 0.06;
        y += alpha * ((Math.random() * 2 - 1) - y);
        data[i] = y * envelope;
      }
      [0.017, 0.029, 0.041, 0.057, 0.073].forEach((time, k) => {
        const i = Math.floor(sr * time) + ch * 7;
        if (i < length) data[i] += (0.8 - 0.12 * k) * (k % 2 ? -1 : 1) * (ch ? 0.9 : 1);
      });
    }
    return buffer;
  }

  function init(deps) {
    const buffers = deps.buffers || {}; // 테스트·측정용: 이미 디코딩된 샘플을 공유할 수 있다
    const memory = {};
    const chains = typeof WeakMap === 'function' ? new WeakMap() : new Map();
    let loading = false;

    const pick = (key, n) => { const index = pickIndex(memory[key], n); memory[key] = index; return index; };
    const pickFrom = (key, list) => list[pick(key, list.length)];
    const ctxOrNull = () => { try { return deps.engine(); } catch (e) { return null; } };

    function load() {
      const ctx = ctxOrNull();
      if (!ctx || loading) return;
      loading = true;
      const fetchBuffer = (name, url, index) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
        .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
        .then((buffer) => { (buffers[name] = buffers[name] || [])[index] = buffer; })
        .catch(() => {});
      Object.entries(BANK).forEach(([name, count]) => { for (let i = 0; i < count; i++) fetchBuffer(name, `assets/audio/sfx/${name}_00${i}.mp3`, i); });
      Object.entries(LEGACY).forEach(([name, url]) => fetchBuffer(name, url, 0));
    }

    // 출력 체인: 직접음 → 압축기 → 효과음 버스 / 잔향 보내기 → 컨볼버 → 하이패스 → 압축기
    function chain(ctx) {
      const volumeBus = deps.bus(ctx); // 호출할 때마다 사운드 설정의 효과음 볼륨이 반영된다
      let c = chains.get(ctx);
      if (c && c.volumeBus === volumeBus) return c;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.16;
      comp.connect(volumeBus);
      const dry = ctx.createGain(); dry.gain.value = 0.85; dry.connect(comp);
      const wetGain = ctx.createGain(); wetGain.gain.value = 1; wetGain.connect(comp); // 잔향 전체의 음량(덕킹용)
      const sends = {};
      Object.entries(IR_SECONDS).forEach(([name, seconds]) => {
        const convolver = ctx.createConvolver(); convolver.buffer = makeImpulse(ctx, seconds);
        const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 220;
        const send = ctx.createGain();
        send.connect(convolver); convolver.connect(highpass); highpass.connect(wetGain);
        sends[name] = send;
      });
      c = { volumeBus, dry, sends, wetGain };
      chains.set(ctx, c);
      return c;
    }

    function out(ctx, node, pan, wet = 0, space = 'long') {
      const c = chain(ctx);
      let tail = node;
      if (pan && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = clamp(pan, -1, 1);
        node.connect(panner); tail = panner;
      }
      tail.connect(c.dry);
      if (wet > 0) { const amount = ctx.createGain(); amount.gain.value = wet; tail.connect(amount); amount.connect(c.sends[space] || c.sends.long); }
    }

    // 샘플 1개(또는 좌우로 넓힌 2개) 재생. 재생했으면 true.
    function sample(name, o = {}) {
      const ctx = ctxOrNull();
      const list = (buffers[name] || []).filter(Boolean);
      if (!ctx || !list.length) return false;
      const { gain = 0.5, rate = 1, pan = 0, delay = 0, lp = 0, hp = 0, eq = [], wet = 0, wide = 0, cap = 0, space = 'long', fade = 0.55 } = o;
      const buffer = list[pick('sample:' + name, list.length)], base = ctx.currentTime + delay;
      const play = (panValue, extra, rateMul, gainMul) => {
        const source = ctx.createBufferSource(), amp = ctx.createGain(), at = base + extra;
        source.buffer = buffer;
        source.playbackRate.value = rate * rateMul;
        amp.gain.setValueAtTime(gain * gainMul, at);
        let node = source;
        const filter = (type, freq, g) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (g !== undefined) f.gain.value = g; node.connect(f); node = f; };
        if (hp) filter('highpass', hp);
        if (lp) filter('lowpass', lp);
        eq.forEach((band) => filter(band.type, band.freq, band.gain));
        node.connect(amp);
        const length = (buffer.duration || 0) / (rate * rateMul);
        if (cap && length > cap) {
          // 너무 긴 꼬리는 줄이되 "뚝" 끊기지 않게: cap*fade 지점부터 지수적으로 서서히 줄여 cap에서 약 -60dB(사실상 무음)가 되게 한다
          // (정점 근처로 유지하다 한꺼번에 줄이면 끊김으로 들린다). 끝에서 남은 잔여는 짧게 0으로 마무리한다.
          const begin = at + cap * fade, tau = Math.max(0.01, (at + cap - begin) / FADE_DECIBELS_E);
          amp.gain.setValueAtTime(gain * gainMul, begin);
          amp.gain.setTargetAtTime(0, begin, tau);
          amp.gain.setTargetAtTime(0, at + cap - 0.02, 0.006);
          source.start(at); source.stop(at + cap + 0.08);
        } else {
          // 샘플이 자연스럽게 끝나는 경우에도 끝이 뚝 끊기지 않게 마지막 구간을 지수적으로 부드럽게 마무리한다
          // (잔향이 없는 물·바람에서는 샘플의 끝이 그대로 드러나므로 길이에 비례해 최대 100ms)
          const end = at + length, taper = Math.min(0.1, length * 0.4);
          // -80dB까지 내리면 100ms 동안 10ms당 8dB씩 떨어져 오히려 끊김처럼 들린다 → -30dB까지만 완만하게(10ms당 3dB) 내리고 마지막 4ms에만 0으로 닫는다
          if (length > 0.06) {
            const level = gain * gainMul;
            amp.gain.setValueAtTime(level, end - taper);
            amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.03), end - 0.004);
            amp.gain.linearRampToValueAtTime(0.0001, end);
          }
          source.start(at);
        }
        out(ctx, amp, panValue, wet, space);
      };
      if (wide) { play(clamp(pan - wide, -1, 1), 0, 1, 0.72); play(clamp(pan + wide, -1, 1), 0.011, 1.004, 0.72); } else play(pan, 0, 1, 1);
      return true;
    }

    function noise({ dur = 0.12, vol = 0.04, delay = 0, pan = 0, type = 'bandpass', freq = 1200, endFreq = freq, q = 0.8, attack = 0.002, wet = 0, space = 'long' } = {}) {
      const ctx = ctxOrNull();
      if (!ctx) return;
      const start = ctx.currentTime + delay, length = Math.max(1, Math.ceil(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
      source.buffer = buffer; filter.type = type; filter.Q.value = q;
      filter.frequency.setValueAtTime(Math.max(30, freq), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + dur);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      source.connect(filter); filter.connect(amp);
      out(ctx, amp, pan, wet, space);
      source.start(start);
    }

    // 저음 몸통(서브)용 사인 — 높은 음의 순수 톤은 쓰지 않는다
    function sub({ freq = 100, endFreq = 40, dur = 0.25, vol = 0.1, delay = 0, pan = 0, wet = 0, space = 'long' } = {}) {
      const ctx = ctxOrNull();
      if (!ctx) return;
      const start = ctx.currentTime + delay, osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(amp);
      out(ctx, amp, pan, wet, space);
      osc.start(start); osc.stop(start + dur + 0.03);
    }

    // 공명 합성: 짧은 잡음 한 번을 높은 Q의 대역 필터 여러 개에 통과시켜 금속·유리·종 같은 울림을 만든다
    function resonate({ freqs, q = 28, dur = 0.4, vol = 0.05, delay = 0, pan = 0, wet = 0, space = 'long' } = {}) {
      const ctx = ctxOrNull();
      if (!ctx) return;
      const start = ctx.currentTime + delay, length = Math.max(1, Math.ceil(ctx.sampleRate * 0.012));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      freqs.forEach((freq, i) => {
        const filter = ctx.createBiquadFilter(), amp = ctx.createGain(), life = dur / (1 + i * 0.35);
        filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
        amp.gain.setValueAtTime(vol * 14 / Math.pow(i + 1, 0.7), start);
        amp.gain.exponentialRampToValueAtTime(0.0001, start + life);
        source.connect(filter); filter.connect(amp);
        out(ctx, amp, pan, wet, space);
      });
      source.start(start);
    }

    // 합성 질감 레이어. p = { power: 0.3~1, pan, wet, boost }
    const SYNTH = {
      crackle(p) { const n = 3 + Math.floor(p.power * 4); for (let i = 0; i < n; i++) noise({ dur: rand(0.025, 0.07), vol: 0.05 * p.power * p.boost, delay: rand(0.02, 0.22), pan: p.pan + rand(-0.2, 0.2), wet: p.wet, space: p.space, type: 'highpass', freq: rand(2500, 6000), q: 1 }); },
      boom(p) { sub({ freq: rand(95, 125), endFreq: 38, dur: 0.3 + p.power * 0.2, vol: 0.12 * p.power * p.boost, pan: p.pan, wet: p.wet * 0.5 , space: p.space}); noise({ dur: 0.25 + p.power * 0.2, vol: 0.07 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'lowpass', freq: 500, endFreq: 120, q: 0.7, attack: 0.01 }); },
      sizzle(p) { noise({ dur: 0.2 + p.power * 0.2, vol: 0.035 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: rand(4200, 6200), endFreq: 2400, q: 1.6 }); },
      splash(p) { noise({ dur: 0.2 + p.power * 0.2, vol: 0.05 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: rand(3000, 3800), endFreq: rand(1200, 1800), q: 0.9 }); },
      drops(p) { const n = 2 + Math.floor(p.power * 3); for (let i = 0; i < n; i++) { const f = rand(700, 2200); resonate({ freqs: [f, f * 1.9], q: 18, dur: rand(0.06, 0.12), vol: 0.03 * p.power * p.boost, delay: 0.03 + i * 0.05 + rand(0, 0.03), pan: p.pan + rand(-0.3, 0.3), wet: p.wet * 1.4 , space: p.space}); } },
      sparkle(p) { resonate({ freqs: [rand(2800, 3400), rand(4200, 5200), rand(6200, 7400)], q: 30, dur: 0.35 + p.power * 0.2, vol: 0.022 * p.power * p.boost, pan: p.pan, wet: p.wet * 1.5 , space: p.space}); },
      whoosh(p) { const up = Math.random() < 0.5; noise({ dur: 0.16 + p.power * 0.14, vol: 0.065 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: up ? 700 : 4200, endFreq: up ? 4200 : 700, q: 1.4, attack: 0.03 }); },
      swish(p) { noise({ dur: 0.12, vol: 0.05 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'highpass', freq: 2500, endFreq: 6500, q: 0.8, attack: 0.02 }); },
      slice(p) { noise({ dur: 0.08, vol: 0.06 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'highpass', freq: rand(3500, 5500), q: 0.7 }); noise({ dur: 0.14, vol: 0.03 * p.power * p.boost, delay: 0.02, pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: 1800, endFreq: 600, q: 1.2 }); },
      rumble(p) { noise({ dur: 0.35 + p.power * 0.3, vol: 0.1 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'lowpass', freq: rand(240, 330) * (p.pitch || 1), endFreq: 80 * (p.pitch || 1), q: 0.7, attack: 0.012 }); },
      crack(p) { noise({ dur: 0.06, vol: 0.07 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: rand(900, 1500) * (p.pitch || 1), q: 1.2 }); noise({ dur: 0.05, vol: 0.045 * p.power * p.boost, delay: rand(0.05, 0.1), pan: p.pan, wet: p.wet, space: p.space, type: 'bandpass', freq: rand(1200, 2000), q: 1.2 }); },
      thud(p) { sub({ freq: rand(75, 95) * (p.pitch || 1), endFreq: 32 * (p.pitch || 1), dur: 0.3 + p.power * 0.2, vol: 0.14 * p.power * p.boost, pan: p.pan, wet: p.wet * 0.5 , space: p.space}); },
      ring(p) { const base = rand(520, 760); resonate({ freqs: [base, base * 2.76, base * 5.4, base * 8.9], q: 40, dur: 0.6 + p.power * 0.4, vol: 0.02 * p.power * p.boost, pan: p.pan, wet: p.wet * 1.4 , space: p.space}); },
      clash(p) { // 강철끼리 "깡·쨍" 부딪힘: 짧고 밝은 잡음 어택 + 서로 어긋난 고음 공명(0.3초 안팎)
        noise({ dur: 0.05, vol: 0.05 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space, type: 'highpass', freq: 3500, q: 0.7, attack: 0.001 });
        const f = rand(1900, 2900);
        resonate({ freqs: [f, f * 1.47, f * 2.09, f * 2.86], q: 28, dur: 0.28 + p.power * 0.12, vol: 0.03 * p.power * p.boost, pan: p.pan, wet: p.wet, space: p.space });
      },
      clink(p) { resonate({ freqs: [rand(1800, 2300), rand(3300, 4100), rand(5200, 6400)], q: 34, dur: 0.22, vol: 0.02 * p.power * p.boost, pan: p.pan, wet: p.wet , space: p.space}); },
      clang(p) { const base = rand(300, 420); resonate({ freqs: [base, base * 2.4, base * 4.1, base * 6.3], q: 22, dur: 0.45 + p.power * 0.25, vol: 0.022 * p.power * p.boost, pan: p.pan, wet: p.wet , space: p.space}); }
    };

    // 최근 타격 기록: 연속 타격일수록 잔향·꼬리를 줄이는 데 쓴다 (컨텍스트 시간 기준)
    let recent = [];
    function crowding(ctx) {
      const now = ctx.currentTime;
      recent = recent.filter((time) => now - time < CROWD_WINDOW && time <= now);
      const count = recent.length;
      recent.push(now);
      return { count, scale: clamp(1 - CROWD_STEP * count, CROWD_MIN, 1) };
    }
    // 새 타격이 들어오면 이전 타격의 잔향 꼬리를 잠깐 눌렀다가 서서히 되돌린다 (꼬리끼리 뭉치는 것을 막음)
    function duck(ctx, amount) {
      const c = chain(ctx), gain = c.wetGain.gain, now = ctx.currentTime;
      if (gain.cancelScheduledValues) gain.cancelScheduledValues(now);
      gain.setTargetAtTime(amount, now, 0.06); // 천천히 눌러 이전 잔향이 갑자기 사라지는 느낌을 없앤다
      gain.setTargetAtTime(1, now + 0.2, 0.4);
    }

    // force.combo: 측정·테스트용으로 조합 번호를 고정한다
    function playHit(element, damage, pan = 0, force = null) {
      const ctx = ctxOrNull();
      if (!ctx) return false;
      // damage는 소리를 바꾸는 데 쓰지 않는다: 모든 피격이 같은 "강한 신호"로 울린다 (조합·음높이·위치만 매번 달라짐)
      const t = STRONG, e = ELEMENT[element] || ELEMENT.neutral, power = t.power, level = 0.34 + power * 0.36;
      const combos = HIT_SETS[element] || HIT_SETS.neutral;
      // 새 샘플 팩(spell*)을 쓰는 조합을 끄고 비교하고 싶을 때(?sfxpack=base): 조합 번호(TRIM 기준)는 그대로 두고 후보에서만 뺀다
      const allowed = combos.map((c, i) => i).filter((i) => deps.spellPack !== false || !combos[i].some((layer) => layer.s.startsWith('spell')));
      const comboIndex = force && force.combo !== undefined ? force.combo % combos.length : allowed[pick(`hit:${element}`, allowed.length)];
      const combo = combos[comboIndex];
      const crowd = crowding(ctx);
      if (crowd.count) duck(ctx, 0.7);
      const wet = clamp(e.wet * crowd.scale, 0, 0.7), baseRate = t.rate * (e.rate || 1) * rand(1 - (e.jitter || 0.05), 1 + (e.jitter || 0.05)), trim = ((TRIM[element] || [])[comboIndex]) || 1;
      let played = 0;
      combo.forEach((layer, i) => {
        const legacy = layer.s.startsWith('legacy_');
        if (sample(layer.s, {
          gain: level * trim * (layer.g !== undefined ? layer.g : legacy ? 0.9 : 0.8) * rand(0.9, 1.1),
          rate: baseRate * (layer.r || 1) * rand(0.98, 1.02), pan, delay: i * 0.008 + rand(0, 0.008),
          lp: layer.lp || e.lp || 0, hp: layer.hp || e.hp || 0, eq: e.eq, wet, space: e.space, wide: e.wide * (crowd.count ? 0.8 : 1),
          cap: (layer.dur ? Math.min(layer.dur, t.cap) : t.cap) * e.tail * crowd.scale, fade: e.fade
        })) played++;
      });
      // 겹쳐 내기(stack): 어택 층만 짧은 간격으로 여러 번 — 갈수록 작아지고 음높이·좌우가 조금씩 어긋난다. 연속 타격이 쌓이면 반복 수를 줄인다.
      if (e.stack) {
        const st = e.stack, count = Math.max(1, Math.round(st.count * Math.max(0.5, crowd.scale)));
        let at = 0;
        for (let k = 1; k < count; k++) {
          at += rand(st.spacing[0], st.spacing[1]);
          const side = (k % 2 ? 1 : -1) * st.spread * (k / count);
          combo.slice(0, st.layers || 1).forEach((layer, i) => sample(layer.s, {
            gain: level * trim * (layer.g !== undefined ? layer.g : layer.s.startsWith('legacy_') ? 0.9 : 0.8) * Math.pow(st.decay, k) * rand(0.9, 1.1),
            rate: baseRate * (layer.r || 1) * (1 + st.pitch * k + rand(-st.jitter, st.jitter)), pan: clamp(pan + side, -1, 1), delay: at + i * 0.006,
            lp: layer.lp || e.lp || 0, hp: layer.hp || e.hp || 0, eq: e.eq, wet: wet * 0.5, space: e.space, wide: 0,
            cap: Math.min(st.cap || 0.22, (layer.dur || t.cap) * e.tail), fade: 0.2 // 반복음은 짧게 끊어 하나하나 구별되게
          }));
        }
      }
      const params = { power, pan, wet, space: e.space, pitch: e.rate || 1, boost: (played ? 1 : 1.8) * trim }; // 샘플이 없으면 합성음을 키운다
      const names = SYNTH_NAMES[element] || SYNTH_NAMES.neutral;
      // 합성 질감: 속성 설정이 우선(불은 0). 단 샘플이 하나도 재생되지 못했으면(아직 로드 전·실패) 소리가 비지 않게 최소 1개는 낸다
      const synthLayers = played ? (e.synth !== undefined ? e.synth : t.layers) : Math.max(1, e.synth !== undefined ? e.synth : t.layers);
      for (let i = 0; i < synthLayers; i++) SYNTH[pickFrom(`syn:${element}:${i}`, names)](params);
      return true;
    }

    // 빙결 카드 소리(프로스트 노바·빙결 사슬·한서진). 샘플이 없거나 ?sfxpack=base 면 false를 돌려줘 호출한 쪽이 합성음을 쓴다.
    //  - cast: 얼음 주문 전체(차오름 → 약 0.5초에 정점). 빙결 카드는 시전 후 약 0.45초에 피해가 들어가 시점이 맞는다. (음높이를 바꾸면 정점 시각이 달라지므로 거의 그대로 쓴다)
    //  - shatter: 시전 0.3초 뒤에 얹는 가벼운 얼음 파편음 (정점 직전이라 크게 겹치지 않게 작고 높게)
    function playFrost(kind, pan = 0) {
      const ctx = ctxOrNull();
      if (!ctx || deps.spellPack === false) return false;
      const e = ELEMENT.water, level = 0.34 + STRONG.power * 0.36;
      if (kind === 'shatter') {
        return sample('spellIce', { gain: level * 0.45, rate: rand(1.18, 1.3), pan, hp: 1500, eq: e.eq, wet: e.wet * 0.8, space: 'long', wide: e.wide, cap: 0.5, fade: 0.3 });
      }
      return sample('spellIceCast', { gain: level * 1.05, rate: rand(0.99, 1.01), pan, eq: e.eq, wet: e.wet, space: 'long', wide: e.wide, cap: 1.8, fade: 0.45 });
    }

    // 물 공격의 번개 연출("아주르 썬더폴") 소리: 연출이 뜰 때 차오르다가 약 0.45초에 번개가 내리친다 (타격 시점과 맞춤).
    // 물 피격음에서 불처럼 들리는 폭발 샘플을 뺀 대신, 번개 소리는 이 연출에 전용으로 붙인다. 샘플이 없거나 ?sfxpack=base 면 false.
    // opts.cap: 꼬리 최대 길이(초). 비교·조절용(시험실). 기본 2.7
    function playLightning(pan = 0, opts = {}) {
      const ctx = ctxOrNull();
      if (!ctx || deps.spellPack === false) return false;
      const level = 0.34 + STRONG.power * 0.36;
      // 번개는 천둥처럼 길게 울리되(원본 약 3초 중 2.7초), 공간감을 만드는 처리(잔향 전송·좌우 확장)는 넣지 않고 실제 번개 소리만 낸다 (wet 0, wide 0).
      return sample('spellLightningCast', { gain: level * 3.6, rate: rand(0.99, 1.01), pan, hp: 120, wet: 0, wide: 0, cap: opts.cap || 2.7, fade: opts.fade || 0.45 });
    }

    // 바람 공격의 연출("실피드 템페스트") 소리: 칼바람이 "슈류륙" 하고 세 번 연달아 스쳐 지나간다.
    // 한 번의 스침 = 높은 쉭 소리가 올라갔다 내려오는 대역 잡음 + 가는 휘파람 층. 세 번은 약 0.12초 간격으로 좌 → 우 → 중앙으로 움직이며 점점 높아진다.
    // 합성음이라 샘플 팩과 무관하게 항상 난다.
    function playGust(pan = 0) {
      const ctx = ctxOrNull();
      if (!ctx) return false;
      const level = 0.34 + STRONG.power * 0.36;
      [[0, -0.55, 1], [0.12, 0.55, 1.1], [0.24, 0, 1.2]].forEach(([delay, side, lift], i) => {
        const p = { pan: clamp(pan + side, -1, 1), delay, wet: 0, space: 'short' };
        const last = i === 2;
        noise({ ...p, dur: last ? 0.5 : 0.34, vol: level * 0.45, type: 'bandpass', freq: 1300 * lift, endFreq: 5000 * lift, q: 1.0, attack: 0.08 });
        noise({ ...p, dur: last ? 0.46 : 0.3, vol: level * 0.26, type: 'highpass', freq: 4800 * lift, endFreq: 7200 * lift, q: 0.7, attack: 0.06 });
        // 거친 질감: 낮은 대역의 두꺼운 잡음을 먼저 깔아 칼바람이 긁고 지나가는 느낌을 준다
        noise({ ...p, dur: last ? 0.44 : 0.28, vol: level * 0.34, type: 'bandpass', freq: 600 * lift, endFreq: 2400 * lift, q: 0.6, attack: 0.05 });
        noise({ ...p, delay: delay + 0.03, dur: last ? 0.42 : 0.26, vol: level * 0.15, type: 'bandpass', freq: 3000 * lift, endFreq: 1700 * lift, q: 6, attack: 0.1 });
      });
      return true;
    }

    // 평타 모션에 맞춘 휘두르는 소리 (피격음보다 작게, 약간의 잔향)
    function playSwing(motion, element, power = 0.5, pan = 0) {
      const ctx = ctxOrNull();
      if (!ctx) return false;
      const v = 0.8, p = { pan, wet: 0.08, space: 'short' }; // 공격력과 무관하게 같은 세기, 휘두르는 소리는 짧은 공간
      switch (motion) {
        case 'slam': noise({ dur: 0.3, vol: 0.05 * v, ...p, type: 'bandpass', freq: 400, endFreq: 2600, q: 1.1, attack: 0.09 }); break;
        case 'bash': sub({ freq: 150, endFreq: 70, dur: 0.22, vol: 0.07 * v, ...p }); noise({ dur: 0.16, vol: 0.035 * v, ...p, delay: 0.1, type: 'lowpass', freq: 500, endFreq: 200 }); break;
        case 'jab': noise({ dur: 0.05, vol: 0.05 * v, ...p, type: 'highpass', freq: 3200 }); noise({ dur: 0.05, vol: 0.05 * v, ...p, delay: 0.1, type: 'highpass', freq: 3600 }); break;
        case 'spin': noise({ dur: 0.2, vol: 0.05 * v, ...p, type: 'bandpass', freq: 900, endFreq: 3400, q: 1.5, attack: 0.04 }); noise({ dur: 0.2, vol: 0.04 * v, ...p, delay: 0.16, type: 'bandpass', freq: 3400, endFreq: 800, q: 1.5, attack: 0.02 }); break;
        case 'swoop': noise({ dur: 0.32, vol: 0.05 * v, pan: -pan * 0.6, wet: 0.08, space: 'short', type: 'bandpass', freq: 500, endFreq: 3000, q: 1.2, attack: 0.1 }); break;
        default: noise({ dur: 0.18, vol: 0.05 * v, ...p, type: 'bandpass', freq: 600, endFreq: 2500, q: 1.2, attack: 0.04 });
      }
      return true;
    }

    return { load, playHit, playFrost, playLightning, playGust, playSwing, _buffers: buffers };
  }

  const api = { BANK, LEGACY, HIT_SETS, STRONG, ELEMENT, FADE_DECIBELS_E, IR_SECONDS, CROWD_WINDOW, CROWD_STEP, CROWD_MIN, TRIM, SYNTH_NAMES, pickIndex, makeImpulse, init };
  root.FateSfx = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
