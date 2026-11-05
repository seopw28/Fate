const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const Sfx = require(path.join(root, '05_game-client/battle/sfx-variety.js'));
const Motions = require(path.join(root, '05_game-client/battle/attack-motions.js'));
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');

// 재현 가능한 난수
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ───────── 효과음 ─────────
test('피격음은 피해량과 무관하게 항상 같은 "강한 신호"다 (강도 단계 없음)', () => {
  assert.equal(Sfx.hitTier, undefined, '피해 강도 단계는 없애기로 함');
  assert.ok(Sfx.STRONG && Sfx.STRONG.cap > 0 && Sfx.STRONG.power > 0.5, '강한 신호 설정이 있어야 함');
  for (const element of Object.keys(Sfx.ELEMENT)) assert.ok(['long', 'short'].includes(Sfx.ELEMENT[element].space), `${element}: 오로라별 공간 종류가 있어야 함`);
  for (const element of Object.keys(Sfx.HIT_SETS)) assert.ok(Array.isArray(Sfx.HIT_SETS[element]), `${element}: 조합 배열`);
});

test('변주: 직전과 같은 번호를 고르지 않고 나머지는 모두 나올 수 있다', () => {
  const rnd = seeded(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const last = i % 3;
    const next = Sfx.pickIndex(last, 3, rnd);
    assert.notEqual(next, last);
    seen.add(next);
  }
  assert.equal(seen.size, 3);
  assert.equal(Sfx.pickIndex(undefined, 1), 0, '후보가 1개면 0');
});

test('조합표: 오로라별 변주 후보가 있고, 쓰는 샘플이 실제로 존재한다 (불은 원본 폭발음, 물은 건조한 유리·얼음)', () => {
  const known = new Set([...Object.keys(Sfx.BANK), ...Object.keys(Sfx.LEGACY)]);
  for (const element of ['fire', 'water', 'wind', 'earth', 'neutral']) {
    const combos = Sfx.HIT_SETS[element];
    assert.ok(combos.length >= (element === 'fire' ? 1 : 4), `${element}: 변주 후보 수 (불은 원본 폭발음 하나로 충분)`);
    for (const combo of combos) {
      assert.ok(combo.length >= (element === 'fire' || element === 'wind' && combo.length === 1 ? 1 : 2), `${element}: 조합은 샘플을 겹쳐야 함`);
      for (const layer of combo) assert.ok(known.has(layer.s), `${element}: 알 수 없는 샘플 ${layer.s}`);
      if (element !== 'water' && element !== 'neutral') assert.ok(combo.some((layer) => layer.s.startsWith('legacy_') || layer.s.startsWith('spell')), `${element}: 조합에 몸통(길게 울리는) 샘플이 있어야 밋밋해지지 않음`);
    }
    assert.ok(element === 'fire' || Sfx.SYNTH_NAMES[element].length >= 3, `${element}: 합성음 후보가 3개 이상이어야 함`);
  }
});

test('불: 처음 쓰던 폭발 샘플 원본을 가공 없이 쓴다 (EQ·음높이·좌우 확장·합성음·다른 샘플 섞기 없음)', () => {
  const fire = Sfx.ELEMENT.fire;
  assert.deepEqual(fire.eq, [], 'EQ 없음');
  assert.ok(!fire.rate && !fire.lp && !fire.hp, '음높이·필터 가공 없음');
  assert.equal(fire.wide, 0, '좌우 폭을 인위적으로 넓히지 않는다 (원본이 이미 스테레오)');
  assert.equal(fire.synth, 0, '합성 질감을 얹지 않는다');
  assert.ok(fire.wet <= 0.12, '잔향을 더하지 않는다');
  assert.ok(Sfx.HIT_SETS.fire.every((combo) => combo.length === 1 && combo[0].s === 'legacy_explosion'), '불은 원본 폭발음만');
});

test('물: 공간감(잔향) 없이 건조하고, 불처럼 들리는 폭발 샘플을 섞지 않는다', () => {
  assert.equal(Sfx.ELEMENT.water.wet, 0, '잔향 0');
  assert.equal(Sfx.ELEMENT.water.space, 'short');
  for (const combo of Sfx.HIT_SETS.water) for (const layer of combo) assert.ok(!/explosion|legacy_/.test(layer.s), `물에 ${layer.s} 금지 (불처럼 들림)`);
});

test('바람: 높고 예리하게 — 음높이 상향, 저음 제거, 고음 강조, 장난감 같은 금속판·종 샘플 제외', () => {
  const wind = Sfx.ELEMENT.wind;
  assert.ok(wind.rate >= 1.15, '음높이를 올린다');
  assert.ok(wind.hp >= 500, '저음(둔한 울림)을 걷어낸다');
  const shelf = wind.eq.find((band) => band.type === 'highshelf');
  assert.ok(shelf && shelf.gain >= 3, '고음을 강조');
  for (const combo of Sfx.HIT_SETS.wind) for (const layer of combo) assert.ok(!/Plate|Bell|Tin|Punch/.test(layer.s), `바람에 ${layer.s} 금지 (장난감 같은 소리)`);
});

test('음원 파일: 목록의 모든 mp3와 CC0 라이선스 안내가 저장소에 있다', () => {
  const dir = path.join(root, 'dist/assets/audio/sfx');
  for (const [name, count] of Object.entries(Sfx.BANK)) {
    for (let i = 0; i < count; i++) assert.ok(fs.existsSync(path.join(dir, `${name}_00${i}.mp3`)), `missing ${name}_00${i}.mp3`);
  }
  for (const url of Object.values(Sfx.LEGACY)) assert.ok(fs.existsSync(path.join(root, 'dist', url)), `missing ${url}`);
  const license = fs.readFileSync(path.join(dir, 'LICENSE-kenney-impact-sounds.txt'), 'utf8');
  assert.ok(/Creative Commons Zero|CC0/.test(license), 'License notice must stay with the audio files');
});

// 최소한의 가짜 Web Audio (소리는 안 나지만 호출 구조는 그대로 실행)
function fakeAudio() {
  const stats = { started: 0, nodes: 0, panners: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => { stats.nodes++; return Object.assign({ connect() {}, start() { stats.started++; }, stop() {}, gain: param(), frequency: param(), Q: param(), pan: param() }, extra); };
  const ctx = {
    currentTime: 0, sampleRate: 8000,
    createGain: () => node(), createOscillator: () => node(), createBiquadFilter: () => node(),
    createBufferSource: () => node({ playbackRate: param(), buffer: null }),
    createDynamicsCompressor: () => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createConvolver: () => node({ buffer: null }),
    createStereoPanner: () => { stats.panners++; return node(); },
    createBuffer: (channels, length) => { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / 8000, getChannelData: (c) => data[c || 0] }; },
    decodeAudioData: (data, ok) => ok({}),
  };
  return { ctx, stats };
}

test('효과음 실행: 모든 오로라×강도 조합이 샘플 없이도(합성음만으로) 소리를 만든다', () => {
  const { ctx, stats } = fakeAudio();
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain() });
  for (const element of ['fire', 'water', 'wind', 'earth', 'neutral', 'unknown']) {
    for (const damage of [1, 5, 12, 99]) {
      const before = stats.started;
      assert.equal(api.playHit(element, damage, 0.4), true);
      assert.ok(stats.started > before, `${element}/${damage}: 소리가 하나도 시작되지 않음`);
    }
  }
  assert.ok(stats.panners > 0, '좌우 위치(pan)가 적용되어야 함');
});

test('효과음 실행: 평타 소리 6종과 오디오가 꺼진 경우', () => {
  const { ctx, stats } = fakeAudio();
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain() });
  for (const motion of ['lunge', 'slam', 'bash', 'jab', 'spin', 'swoop']) {
    const before = stats.started;
    assert.equal(api.playSwing(motion, 'fire', 0.6, 0.2), true);
    assert.ok(stats.started > before, `${motion}: 소리가 시작되지 않음`);
  }
  const off = Sfx.init({ engine: () => null, bus: () => null });
  assert.equal(off.playHit('fire', 5), false, '음소거(엔진 없음)면 아무것도 하지 않는다');
  assert.equal(off.playSwing('jab', 'fire'), false);
});

test('효과음 로딩 실패해도(네트워크 오류) 게임이 멈추지 않는다', () => {
  const { ctx } = fakeAudio();
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('offline'));
  try {
    const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain() });
    assert.doesNotThrow(() => api.load());
    assert.equal(api.playHit('water', 6), true);
  } finally { globalThis.fetch = realFetch; }
});

// ───────── 평타 모션 ─────────
const NAMES = ['lunge', 'slam', 'bash', 'jab', 'spin', 'swoop'];

test('모션 선택: 직전 동작을 연달아 반복하지 않는다', () => {
  const rnd = seeded(11);
  for (const element of ['fire', 'water', 'wind', 'earth', 'neutral']) {
    let last;
    for (let i = 0; i < 300; i++) {
      const name = Motions.pick(element, 0.5, last, rnd);
      assert.ok(NAMES.includes(name));
      assert.notEqual(name, last, `${element}: 같은 동작이 연속으로 나옴`);
      last = name;
    }
  }
});

test('모션 선택: 오로라별 스타일이 드러나고, 공격력이 높을수록 큰 동작이 늘어난다', () => {
  const share = (element, power, name) => { const rnd = seeded(5); let hit = 0; for (let i = 0; i < 4000; i++) if (Motions.pick(element, power, undefined, rnd) === name) hit++; return hit / 4000; };
  assert.ok(share('fire', 0.5, 'slam') > share('fire', 0.5, 'jab'), '불: 내려찍기가 찌르기보다 많다');
  assert.ok(share('wind', 0.5, 'jab') > share('wind', 0.5, 'bash'), '바람: 찌르기가 박치기보다 많다');
  assert.ok(share('water', 0.5, 'swoop') > share('water', 0.5, 'slam'), '물: 곡선 접근이 내려찍기보다 많다');
  assert.ok(share('earth', 0.5, 'bash') > share('earth', 0.5, 'lunge'), '대지: 박치기가 기본 돌진보다 많다');
  assert.ok(share('fire', 1, 'slam') > share('fire', 0, 'slam'), '공격력이 높을수록 내려찍기가 늘어난다');
  assert.ok(share('wind', 0, 'jab') > share('wind', 1, 'jab'), '공격력이 낮을수록 가벼운 찌르기가 늘어난다');
  assert.equal(Motions.powerFromAttack(1), 0);
  assert.equal(Motions.powerFromAttack(11), 1);
  assert.equal(Motions.powerFromAttack(99), 1);
  assert.equal(Motions.powerFromAttack('x'), 0);
});

test('모션 키프레임: 6종 모두 0에서 시작해 제자리로 돌아오고 값이 유효하다', () => {
  for (const name of NAMES) {
    for (const power of [0, 0.5, 1]) {
      for (const geometry of [{ dx: 0, dy: -300, moveX: 0, moveY: -170 }, { dx: 250, dy: -120, moveX: 90, moveY: -60 }, { dx: 0, dy: 0, moveX: 0, moveY: 0 }]) {
        const motion = Motions.build(name, { ...geometry, power, side: -1 });
        assert.equal(motion.name, name);
        assert.ok(motion.duration >= 550 && motion.duration <= 900, `${name}: 길이 ${motion.duration}ms는 공격 간격(900ms) 안에 끝나야 함`);
        assert.ok(motion.hit > 0.3 && motion.hit < 0.6, `${name}: 타격 시점 ${motion.hit}`);
        const frames = motion.keyframes;
        assert.equal(frames[0].offset, 0);
        assert.equal(frames[frames.length - 1].offset, 1);
        frames.forEach((frame, i) => {
          assert.ok(!frame.transform.includes('NaN') && !frame.transform.includes('Infinity'), `${name}: 잘못된 값 ${frame.transform}`);
          if (i) assert.ok(frame.offset >= frames[i - 1].offset, `${name}: offset은 줄어들 수 없다`);
        });
        assert.ok(frames[0].transform.startsWith('translate(0.0px,0.0px)'));
        assert.ok(frames[frames.length - 1].transform.startsWith('translate(0.0px,0.0px)'), `${name}: 끝에 제자리로 돌아와야 함`);
      }
    }
  }
  assert.equal(Motions.build('없는동작', {}).name, 'lunge', '알 수 없는 이름은 기본 돌진');
});

test('모션: 공격력이 높을수록 움직임이 크다', () => {
  const reach = (power) => { const m = Motions.build('lunge', { dx: 0, dy: -300, moveX: 0, moveY: -170, power }); return Math.abs(Number(/translate\([^,]+,(-?[\d.]+)px/.exec(m.keyframes[2].transform)[1])); };
  assert.ok(reach(1) > reach(0));
});

// ───────── 연결 (index.html) ─────────
test('연결: 스크립트 로드, 피격음 교체, 평타 모션/소리, 칸 밖 잘림 방지', () => {
  assert.ok(html.includes('<script src="runtime/sfx-variety.js"></script>') && html.includes('<script src="runtime/attack-motions.js"></script>'), 'Both modules must be loaded');
  assert.ok(html.includes("if(kind==='hit'&&soundOn){fateSfx.playHit(variant,strength,hitPan);return;}"), 'Hit sound must route through the variety engine');
  assert.ok(html.includes('hitPan=panFor(target);sfx(\'hit\',element,damage)'), 'Hit sound must be panned toward the target');
  assert.ok(html.includes('const motion=pickAttackMotion(attacker,dx,dy,moveX,moveY);attacker.animate(motion.keyframes'), 'Attacks must use the varied motion');
  assert.ok(html.includes('combatMs(Math.round(motion.duration*motion.hit))'), 'Impact must land at the motion contact point');
  assert.ok(html.includes('.summon-zone:has(.field-attacker) { overflow:visible; }'), 'Attack motion must not be clipped by the field');
  const build = fs.readFileSync(path.join(root, '12_tools/build-scripts/build-runtime.mjs'), 'utf8');
  assert.ok(build.includes('sfx-variety.js') && build.includes('attack-motions.js'), 'Runtime build must publish both modules');
  assert.ok(fs.existsSync(path.join(root, 'dist/runtime/sfx-variety.js')) && fs.existsSync(path.join(root, 'dist/runtime/attack-motions.js')), 'Run npm run build:runtime');
});

// ───────── 공간감·품질 (v2) ─────────
test('잔향: 합성 임펄스 응답이 스테레오이고 시간이 지날수록 작아진다', () => {
  const { ctx } = fakeAudio();
  ctx.sampleRate = 8000;
  const ir = Sfx.makeImpulse(ctx, 1.0);
  const left = ir.getChannelData(0), right = ir.getChannelData(1);
  assert.ok(left.length >= 8000 && right.length === left.length);
  const energy = (data, from, to) => { let sum = 0; for (let i = from; i < to; i++) sum += data[i] * data[i]; return sum; };
  assert.ok(energy(left, 0, 1500) > energy(left, 6000, 7500) * 20, '초반 에너지가 후반보다 훨씬 커야 함 (감쇠)');
  assert.notDeepEqual(Array.from(left.slice(500, 700)), Array.from(right.slice(500, 700)), '좌우가 서로 달라야 공간감이 생김');
  assert.equal(left[10], 0, '프리딜레이 구간은 비어 있어야 함');
});

test('공간감: 효과음은 압축기와 잔향(컨볼버) 체인을 통과한다', () => {
  const made = [];
  const { ctx } = fakeAudio();
  ['createDynamicsCompressor', 'createConvolver'].forEach((name) => { const original = ctx[name]; ctx[name] = () => { made.push(name); return original(); }; });
  const bus = ctx.createGain(); // 게임의 sfxBus처럼 항상 같은 노드를 돌려준다 (호출할 때마다 볼륨 설정을 반영)
  const api = Sfx.init({ engine: () => ctx, bus: () => bus });
  api.playHit('fire', 9, 0);
  api.playHit('water', 3, 0);
  assert.equal(made.filter((n) => n === 'createDynamicsCompressor').length, 1, '체인은 컨텍스트당 한 번만 만든다');
  assert.equal(made.filter((n) => n === 'createConvolver').length, Object.keys(Sfx.IR_SECONDS).length, '잔향 종류(홀/작은 방)마다 컨볼버 하나');
});

test('음량 보정표: 모든 조합에 값이 있고 유효하다', () => {
  for (const element of Object.keys(Sfx.HIT_SETS)) {
    const trims = Sfx.TRIM[element];
    assert.ok(Array.isArray(trims) && trims.length === Sfx.HIT_SETS[element].length, `${element}: 조합 수만큼 보정값이 있어야 함 (python3 -I 12_tools/qa/measure-sfx.py --calibrate 로 다시 측정)`);
    trims.forEach((value) => assert.ok(value >= 0.3 && value <= 16, `${element}: 보정값 ${value}`));
  }
});

test('디코딩된 샘플을 공유하면 그대로 재생한다 (몸통 샘플 우선)', () => {
  const { ctx, stats } = fakeAudio();
  const buffers = {};
  for (const name of [...Object.keys(Sfx.BANK), ...Object.keys(Sfx.LEGACY)]) buffers[name] = [{ duration: 1 }];
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain(), buffers });
  const before = stats.started;
  api.playHit('earth', 12, 0, { combo: 0 });
  assert.ok(stats.started - before >= 8, '샘플은 좌우로 넓혀 2번씩 재생되므로 시작 수가 충분히 많아야 함');
  const fireBefore = stats.started;
  api.playHit('fire', 12, 0, { combo: 0 });
  assert.equal(stats.started - fireBefore, 1, '불은 원본 폭발음 하나만 가공 없이 한 번 재생');
});

test('조합 고정(force.combo)과 연속 반복 금지가 함께 동작한다', () => {
  const { ctx } = fakeAudio();
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain() });
  assert.equal(api.playHit('earth', 8, 0, { combo: 1 }), true);
  assert.equal(api.playHit('earth', 8, 0, { combo: 99 }), true, '범위를 넘는 번호도 안전하게 처리');
});

// ───────── 공간감 구별·연속 타격 ─────────
test('공간감 구별: 대지는 가장 넓은 홀 잔향, 칼날·금속은 건조, 물은 잔향 대신 소리를 겹쳐 낸다', () => {
  const E = Sfx.ELEMENT;
  for (const sharp of ['wind', 'neutral']) {
    assert.equal(E[sharp].space, 'short', `${sharp}: 작은 방 잔향`);
    assert.ok(E[sharp].wet <= 0.15, `${sharp}: 잔향이 적어야 예리함이 산다`);
    assert.ok(E[sharp].tail <= (sharp === 'neutral' ? 0.9 : 0.5), `${sharp}: 꼬리가 짧아야 함 (금속은 "띵!" 여운을 위해 0.9까지)`);
  }
  assert.equal(E.earth.space, 'long');
  assert.ok(E.earth.wet >= 0.3 && E.earth.tail >= 0.9 && E.earth.wide >= 0.35, '대지는 공간감을 크게 쓴다');
  for (const other of ['fire', 'water', 'wind', 'neutral']) assert.ok(E.earth.wet > E[other].wet, `대지(${E.earth.wet})가 ${other}(${E[other].wet})보다 잔향이 많아야 구별된다`);
  assert.ok(E.wind.tail < E.earth.tail && E.wind.wet < E.earth.wet, '바람은 대지보다 훨씬 건조해야 구별이 된다');
  for (const element of ['water', 'wind']) {
    const st = E[element].stack;
    assert.ok(st && st.count >= 3 && st.count <= 5, `${element}: 겹쳐 내기 3~5회`);
    assert.ok(st.decay > 0.4 && st.decay < 0.9 && st.spacing[0] >= 0.02 && st.spacing[1] <= 0.1, `${element}: 갈수록 작아지고 30~70ms 안팎 간격`);
    assert.ok(E[element].wet <= 0.15, `${element}: 잔향 대신 겹쳐 내기`);
  }
  assert.ok(E.water.stack.count >= E.wind.stack.count, '물이 더 많이 튄다');
  assert.ok(!E.neutral.stack && E.neutral.synth === 0, '금속(무오로라)은 "쓰윽" 칼 스치는 소리만: 겹쳐 내기·합성 층 없음');
  for (const element of ['fire', 'earth']) assert.ok(!E[element].stack, `${element}: 겹쳐 내기를 쓰지 않는다`);
});

test('울림 길이: 처음 설계(잔향 1.7초, 꼬리 2.0초)의 70% 이하', () => {
  assert.ok(Sfx.IR_SECONDS.long <= 1.7 * 0.7 + 1e-9, `홀 잔향 ${Sfx.IR_SECONDS.long}초`);
  assert.ok(Sfx.IR_SECONDS.short < Sfx.IR_SECONDS.long);
  assert.ok(Sfx.STRONG.cap <= 2.0 * 0.7 + 1e-9, `샘플 꼬리 ${Sfx.STRONG.cap}초`);
  for (const element of Object.keys(Sfx.ELEMENT)) assert.ok(Sfx.STRONG.cap * Sfx.ELEMENT[element].tail <= 1.4, `${element}: 최종 꼬리`);
  for (const combo of Sfx.HIT_SETS.wind) assert.ok(!combo.some((layer) => layer.s === 'legacy_explosion'), '칼날 조합에는 길게 울리는 폭발 몸통을 쓰지 않는다');
});

test('연속 타격: 같은 시간에 쌓일수록 잔향을 줄이고, 새 타격마다 이전 잔향을 눌러 준다', () => {
  const { ctx } = fakeAudio();
  const wets = [], ducks = [];
  const realGain = ctx.createGain;
  ctx.createGain = () => { const node = realGain(); const setTarget = node.gain.setTargetAtTime; node.gain.setTargetAtTime = (value, ...rest) => { ducks.push(value); return setTarget(value, ...rest); }; return node; };
  const bus = ctx.createGain();
  const api = Sfx.init({ engine: () => ctx, bus: () => bus });
  ducks.length = 0;
  for (let i = 0; i < 5; i++) { ctx.currentTime = i * 0.9; api.playHit('fire', 8, 0); }
  assert.ok(ducks.includes(0.7), '두 번째 타격부터 이전 잔향을 눌러야 함');
  assert.ok(Sfx.CROWD_STEP > 0 && Sfx.CROWD_MIN >= 0.4 && Sfx.CROWD_MIN < 1);
  // 시간이 충분히 흐르면 다시 처음처럼 (덕킹 없음)
  const quiet = fakeAudio();
  const ducksQuiet = [];
  const g2 = quiet.ctx.createGain;
  quiet.ctx.createGain = () => { const node = g2(); const st = node.gain.setTargetAtTime; node.gain.setTargetAtTime = (v, ...r) => { ducksQuiet.push(v); return st(v, ...r); }; return node; };
  const bus2 = quiet.ctx.createGain();
  const api2 = Sfx.init({ engine: () => quiet.ctx, bus: () => bus2 });
  ducksQuiet.length = 0;
  quiet.ctx.currentTime = 0; api2.playHit('fire', 8, 0);
  quiet.ctx.currentTime = 10; api2.playHit('fire', 8, 0);
  assert.ok(!ducksQuiet.includes(0.7), '간격이 충분하면 덕킹하지 않는다');
});

// ───────── 페이드아웃 (뚝 끊김 방지) ─────────
test('페이드아웃: 긴 꼬리는 일찍부터 지수적으로 완만하게 줄이고 끝에서 클릭 없이 마무리한다', () => {
  const { ctx } = fakeAudio();
  const calls = [];
  const realGain = ctx.createGain;
  ctx.createGain = () => {
    const node = realGain();
    const original = node.gain.setTargetAtTime;
    node.gain.setTargetAtTime = (target, time, tau) => { calls.push({ target, time, tau }); return original(target, time, tau); };
    return node;
  };
  const bus = ctx.createGain();
  const buffers = { legacy_explosion: [{ duration: 4.6 }], impactPunch_heavy: [{ duration: 0.65 }], impactSoft_heavy: [{ duration: 0.5 }] };
  const api = Sfx.init({ engine: () => ctx, bus: () => bus, buffers });
  calls.length = 0;
  api.playHit('fire', 8, 0, { combo: 0 }); // 첫 타격: 덕킹 없음
  const fades = calls.filter((c) => c.target === 0);
  const cap = Sfx.STRONG.cap * Sfx.ELEMENT.fire.tail;
  const body = fades.find((c) => c.tau >= 0.05);
  assert.ok(body, '길게 울리는 몸통 샘플은 완만한 지수 감쇠(시정수 0.05초 이상)로 줄어야 함');
  assert.ok(body.time >= cap * Sfx.ELEMENT.fire.fade - 0.02 && body.time < cap * 0.7, `감쇠 시작 ${body.time.toFixed(2)}초: 꼬리 길이(${cap.toFixed(2)}초)의 중간 이전에 시작해야 함`);
  assert.ok(body.tau * Sfx.FADE_DECIBELS_E <= cap - body.time + 0.01, '감쇠가 cap 안에서 끝나야 함');
  const finish = fades.find((c) => c.tau < 0.02);
  assert.ok(finish && finish.time >= cap - 0.05 && finish.time < cap, '끝에서 남은 잔여를 짧게 0으로 마무리');
});

test('페이드아웃: 오로라별 시작 시점 — 칼날은 일찍(예리하게 사라짐), 나머지는 공간감을 위해 늦게', () => {
  const E = Sfx.ELEMENT;
  assert.ok(E.wind.fade <= 0.2, '칼날은 일찍 줄기 시작해야 날카롭게 끝난다');
  for (const roomy of ['fire', 'water', 'earth', 'neutral']) assert.ok(E[roomy].fade >= 0.3 && E[roomy].fade <= 0.6, `${roomy}: 너무 일찍(공간감 손실)·너무 늦게(뚝 끊김) 줄이지 않는다`);
  assert.ok(Sfx.FADE_DECIBELS_E >= 6, '감쇠는 사실상 무음(-52dB 이하)까지 내려가야 마지막 단차가 안 들린다');
});

// ───────── 주문 샘플 팩 (Basic Spell Impacts, CC0) ─────────
test('주문 팩: 불·물·바람 조합에 쓰이고, 원본·출처 기록이 저장소에 있다', () => {
  const used = (element) => Sfx.HIT_SETS[element].filter((combo) => combo.some((layer) => layer.s.startsWith('spell')));
  assert.ok(used('water').length >= 2, '물에는 새 주문 샘플(물·얼음) 조합이 있어야 함');
  assert.equal(used('fire').length, 0, '불은 처음 쓰던 원본 폭발음만 쓴다');
  assert.ok(used('wind').length >= 1, '바람에는 번개 샘플이 예리한 어택으로 얹힌다');
  assert.equal(used('earth').length, 0, '이 팩에 없는 오로라은 바꾸지 않는다');
  const dir = path.join(root, '06_assets/audio/basic-spell-impacts');
  assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith('.wav')).length, 20, '원본 WAV 20개');
  const source = fs.readFileSync(path.join(dir, 'SOURCE.md'), 'utf8');
  assert.ok(/CC0/.test(source) && source.includes('lentikula.itch.io'), '출처와 라이선스 기록');
  for (const name of ['spellFire', 'spellIce', 'spellIceCast', 'spellLightning', 'spellWater']) assert.equal(Sfx.BANK[name], 5, `${name} 변형 5개`);
});

test('주문 팩: ?sfxpack=base 이면 새 샘플 조합을 쓰지 않는다 (소리 비교용)', () => {
  const { ctx } = fakeAudio();
  const used = new Set();
  const realSource = ctx.createBufferSource;
  ctx.createBufferSource = () => { const node = realSource(); const start = node.start; node.start = (...args) => { if (node.buffer && node.buffer.tag) used.add(node.buffer.tag); return start(...args); }; return node; };
  const buffers = {};
  for (const name of [...Object.keys(Sfx.BANK), ...Object.keys(Sfx.LEGACY)]) buffers[name] = [{ tag: name, duration: 1 }];
  const bus = ctx.createGain();
  for (const [flag, expectSpell] of [[false, false], [true, true]]) {
    used.clear();
    const api = Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: flag });
    for (let i = 0; i < 200; i++) { ctx.currentTime = i * 5; for (const element of ['fire', 'water', 'wind']) api.playHit(element, 8, 0); }
    assert.equal([...used].some((tag) => tag.startsWith('spell')), expectSpell, `spellPack=${flag}`);
  }
});

test('빙결 소리: 얼음 샘플을 쓰고, 팩이 꺼져 있거나 샘플이 없으면 false (합성음으로 대체)', () => {
  const { ctx, stats } = fakeAudio();
  const buffers = { spellIceCast: [{ duration: 3 }], spellIce: [{ duration: 1.8 }] };
  const bus = ctx.createGain();
  const on = Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: true });
  const before = stats.started;
  assert.equal(on.playFrost('cast'), true);
  assert.equal(on.playFrost('shatter'), true);
  assert.ok(stats.started - before >= 4, '좌우로 넓혀 재생하므로 소리가 여러 개 시작');
  assert.equal(Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: false }).playFrost('cast'), false, '?sfxpack=base 면 기존 합성음');
  assert.equal(Sfx.init({ engine: () => ctx, bus: () => bus, buffers: {}, spellPack: true }).playFrost('cast'), false, '샘플 미로드면 기존 합성음');
});

test('빙결 소리 연결: index.html이 얼음 샘플을 먼저 시도하고 실패하면 기존 합성음을 쓴다', () => {
  assert.ok(html.includes("spellPack:new URLSearchParams(location.search).get('sfxpack')!=='base'"), '?sfxpack=base 비교 옵션');
  assert.ok(html.includes("(kind==='frost-cast'||kind==='frost-shatter')&&fateSfx.playFrost("), '빙결 카드 소리는 얼음 샘플 우선');
});

// ───────── 대지: 더 낮고 묵직하게 ─────────
test('대지: 다른 오로라보다 낮은 음높이와 고음 제한, 강한 저음 EQ', () => {
  const E = Sfx.ELEMENT;
  assert.ok(E.earth.rate <= 0.9, '대지는 음높이를 낮춘다');
  for (const other of ['fire', 'water', 'wind', 'neutral']) assert.ok(!E[other].rate || E[other].rate > E.earth.rate, `${other}보다 낮아야 함`);
  assert.ok(E.earth.lp > 0 && E.earth.lp <= 5000, '고음을 제한해 둔탁하게');
  const lowShelf = E.earth.eq.find((band) => band.type === 'lowshelf');
  assert.ok(lowShelf && lowShelf.gain >= 8, '저음 EQ를 강하게');
});

test('대지: 합성 저음(쿵·우르릉)도 음높이를 따라 내려간다', () => {
  const { ctx } = fakeAudio();
  const freqs = [];
  const realOsc = ctx.createOscillator;
  ctx.createOscillator = () => { const node = realOsc(); const set = node.frequency.setValueAtTime; node.frequency.setValueAtTime = (value, ...rest) => { freqs.push(value); return set(value, ...rest); }; return node; };
  const bus = ctx.createGain();
  const api = Sfx.init({ engine: () => ctx, bus: () => bus });
  freqs.length = 0;
  for (let i = 0; i < 80; i++) { ctx.currentTime = i * 5; api.playHit('earth', 8, 0); }
  const sub = freqs.filter((f) => f < 200);
  assert.ok(sub.length > 0, '저음 서브가 만들어져야 함');
  assert.ok(Math.max(...sub) <= 95 * Sfx.ELEMENT.earth.rate + 0.01, `서브 저음이 음높이 배율(${Sfx.ELEMENT.earth.rate})만큼 낮아져야 함 (최대 ${Math.max(...sub).toFixed(1)}Hz)`);
});

test('겹쳐 내기: 물·바람은 같은 어택을 연달아 여러 번 재생하고, 연속 타격이 쌓이면 줄인다', () => {
  // 합성 질감 레이어는 매번 달라 소리 개수가 흔들리므로 끄고(샘플 어택만) 비교한다
  const layers = Sfx.STRONG.layers;
  Sfx.STRONG.layers = 0;
  try {
    const run = (element, { stack = true, crowded = false } = {}) => {
      const { ctx, stats } = fakeAudio();
      const buffers = {};
      for (const name of [...Object.keys(Sfx.BANK), ...Object.keys(Sfx.LEGACY)]) buffers[name] = [{ duration: 0.4 }];
      const bus = ctx.createGain();
      const saved = Sfx.ELEMENT[element].stack;
      if (!stack) delete Sfx.ELEMENT[element].stack;
      try {
        const api = Sfx.init({ engine: () => ctx, bus: () => bus, buffers });
        if (crowded) for (let i = 0; i < 4; i++) { ctx.currentTime = i * 0.2; api.playHit(element, 8, 0, { combo: 0 }); }
        ctx.currentTime = crowded ? 0.8 : 0;
        const before = stats.started;
        api.playHit(element, 8, 0, { combo: 0 });
        return stats.started - before;
      } finally { Sfx.ELEMENT[element].stack = saved; }
    };
    for (const element of ['water', 'wind']) {
      const extra = run(element) - run(element, { stack: false });
      assert.equal(extra, Sfx.ELEMENT[element].stack.count - 1, `${element}: 반복 횟수만큼 추가 재생`);
      const crowdedExtra = run(element, { crowded: true }) - run(element, { stack: false, crowded: true });
      assert.ok(crowdedExtra > 0 && crowdedExtra < extra, `${element}: 연속 타격이 쌓이면 반복은 줄지만 사라지지는 않는다 (${crowdedExtra} < ${extra})`);
    }
  } finally { Sfx.STRONG.layers = layers; }
});

test('안전 리미터: 효과음 버스는 리미터를 거쳐 출력되어 볼륨을 올려도 찌그러지지 않는다', () => {
  assert.ok(html.includes('const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-6;'), 'sfxBus must end in a limiter');
  assert.ok(html.includes('sfxBusNode.connect(limiter);limiter.connect(ctx.destination);'), 'bus -> limiter -> destination');
});

// ───────── 물 공격 번개 연출 (아주르 썬더폴) ─────────
test('번개 소리: 물 공격의 번개 연출 전용 샘플을 쓰고, 팩이 꺼져 있거나 샘플이 없으면 false', () => {
  assert.equal(Sfx.BANK.spellLightningCast, 5, '번개 연출용 변형 5개');
  const { ctx, stats } = fakeAudio();
  const bus = ctx.createGain();
  const buffers = { spellLightningCast: [{ duration: 2.9 }] };
  const before = stats.started;
  assert.equal(Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: true }).playLightning(0), true);
  assert.equal(stats.started - before, 1, '공간감을 만드는 처리(좌우 확장)를 하지 않아 원본 소리 하나만 재생');
  assert.equal(Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: false }).playLightning(0), false, '?sfxpack=base 면 재생 안 함');
  assert.equal(Sfx.init({ engine: () => ctx, bus: () => bus, buffers: {}, spellPack: true }).playLightning(0), false, '샘플 미로드면 재생 안 함');
});

test('번개 소리 연결: 물 공격에서 아주르 썬더폴 연출이 뜰 때 번개 소리를 함께 낸다', () => {
  assert.ok(html.includes("showCinematicSkillEffect('lightning','아주르 썬더폴',1);muteSfx(['hit:water'],1200);thunderfallAt=performance.now();fateSfx.playLightning(0);}"), 'Water attack lightning cinematic must have its own thunder sound');
});

test('물 피격음에는 폭발(천둥 같은 울림) 샘플을 섞지 않는다 — 번개 소리는 연출 전용으로 분리', () => {
  for (const combo of Sfx.HIT_SETS.water) for (const layer of combo) assert.notEqual(layer.s, 'legacy_explosion');
});

test('번개 소리: 잔향 전송을 하지 않고 꼬리 길이를 조절할 수 있다', () => {
  const { ctx } = fakeAudio();
  const sends = [];
  const realGain = ctx.createGain;
  ctx.createGain = () => { const node = realGain(); node.__id = sends.length; return node; };
  const bus = ctx.createGain();
  const buffers = { spellLightningCast: [{ duration: 2.9 }] };
  const api = Sfx.init({ engine: () => ctx, bus: () => bus, buffers, spellPack: true });
  const scheduled = [];
  const realSource = ctx.createBufferSource;
  ctx.createBufferSource = () => { const node = realSource(); const stop = node.stop; node.stop = (when) => { scheduled.push(when); return stop(when); }; return node; };
  assert.equal(api.playLightning(0, { cap: 1.2 }), true);
  assert.ok(Math.max(...scheduled) < 1.4, `cap 1.2초면 약 1.3초 안에 끝난다 (${Math.max(...scheduled).toFixed(2)})`);
  scheduled.length = 0;
  assert.equal(api.playLightning(0), true);
  assert.ok(Math.max(...scheduled) > 2.5, '기본은 길게(2.7초)');
});

// ───────── 스킬 고유 소리만 (번개 계열에는 번개, 빙결 계열에는 빙결) ─────────
test('스킬 고유 소리: 아주르 썬더폴은 번개만, 빙결 계열은 빙결만 — 섞이는 일반 소리를 끈다', () => {
  assert.ok(html.includes("function muteSfx(keys,ms)") && html.includes("function sfxIsMuted(kind,variant)"), 'Temporary mute helpers must exist');
  assert.ok(html.includes("sfx=function(kind,variant='neutral',strength=3){if(soundOn&&sfxIsMuted(kind,variant))return;"), 'Every sound must pass the mute check first');
  // 아주르 썬더폴: 일반 공격음 없음 + 물 피격음 음소거 + 휘두르는 소리 없음
  assert.ok(html.includes("if(element!=='water'&&element!=='wind')sfx('attack',element,3);"), 'Thunderfall must not play the generic water attack sound');
  assert.ok(html.includes("muteSfx(['hit:water'],1200);thunderfallAt=performance.now();fateSfx.playLightning(0);"), 'Thunderfall must mute the water hit and play only lightning');
  assert.ok(html.includes("if(performance.now()-thunderfallAt>300)fateSfx.playSwing("), 'Thunderfall must not play the generic swing sound');
  // 빙결 계열(빙결 사슬 = champion-control, 프로스트 노바): 일반 마법 시전음·마법 효과음·물 피격음 끔
  assert.ok(html.includes("['champion-control','frost-nova'].includes(card?.dataset?.effect))muteSfx(['spell','magic','hit:water'],1800)"), 'Frost spells must only have frost sounds');
});

test('스킬 소리 검사 스크립트가 있다 (실제 브라우저로 소리 구성을 확인)', () => {
  const script = fs.readFileSync(path.join(root, '12_tools/qa/check-skill-sounds.py'), 'utf8');
  for (const token of ['playLightning', 'playFrost', 'playHit:water', 'frozen-chain', 'frost-nova', 'INDEX_OVERRIDE']) assert.ok(script.includes(token), `check-skill-sounds.py must cover ${token}`);
});

test('바람 연출(실피드 템페스트): 칼바람 소리가 3번 연달아 나고 일반 공격음은 빠진다', () => {
  const engine = fs.readFileSync(path.resolve(__dirname, '../../05_game-client/battle/sfx-variety.js'), 'utf8');
  const index = fs.readFileSync(path.resolve(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(/function playGust\(/.test(engine) && engine.includes('playLightning, playGust'), 'Engine must expose playGust');
  assert.ok(engine.includes('[[0, -0.55, 1], [0.15, 0.55, 1.1], [0.3, 0, 1.2]]'), 'Gust must pass three times in a row');
  assert.ok(index.includes("if(element==='wind'){showCinematicSkillEffect('gust','실피드 템페스트',1);fateSfx.playGust(0);}"), 'Wind cinematic must play the gust');
  assert.ok(index.includes("if(element!=='water'&&element!=='wind')sfx('attack',element,3);"), 'Wind must not also play the generic attack sound');
});

test('오로라 시네마틱: 불·빙결·대지·암흑 기술은 전용 투명 자산과 발동 연결을 가진다', () => {
  const assets = {
    fire: 'fire-meteor-v1.png',
    frost: 'frost-nova-v1.png',
    earth: 'earth-rupture-v1.png',
    eclipse: 'black-eclipse-v1.png'
  };
  for (const [kind, file] of Object.entries(assets)) {
    assert.ok(html.includes(`assets/vfx/cinematic/${file}`), `${kind} cinematic must reference its approved asset`);
    assert.ok(fs.existsSync(path.join(root, 'dist/assets/vfx/cinematic', file)), `${file} must be shipped`);
  }
  for (const label of ['이그니스 메테오', '니플헤임 노바', '가이아 브레이커', '페이트 이클립스']) {
    assert.ok(html.includes(label), `${label} must be connected to elemental combat`);
  }
  assert.ok(html.includes("effect==='black-flame')showCinematicSkillEffect('eclipse'"), 'Black flame must open with the eclipse cinematic');
  assert.ok(html.includes("effect==='frost-nova'||effect==='freeze-strongest'||effect==='champion-control')showCinematicSkillEffect('frost'"), 'Frost control spells must open with the frost cinematic');
});

test('보호막 이미지: 유지 오라와 파괴 버스트가 실제 피해 처리에 연결된다', () => {
  for (const file of ['shield-aura-v1.png', 'shield-break-v1.png']) {
    assert.ok(fs.existsSync(path.join(root, 'dist/assets/vfx/shield', file)), `${file} must be shipped`);
  }
  assert.ok(html.includes("attributeFilter:['data-shield']"), 'Shield aura must follow shield state changes');
  assert.ok(html.includes("plating.className='shield-armor-vfx'"), 'Shielded cards must receive visible armor on both top corners');
  assert.ok(html.includes("armor?.remove()"), 'Corner armor must disappear when the shield breaks');
  assert.ok(html.includes("burst.src='assets/vfx/shield/shield-break-v1.png'"), 'Shield break must use the generated burst asset');
});

test('마법 시네마틱: 회복·아케인·보이드 계열은 전용 자산과 선택적 연결을 가진다', () => {
  const runtime = fs.readFileSync(path.join(root, 'dist/runtime/spell-cinematics.js'), 'utf8');
  for (const file of ['life-bloom-v1.png', 'arcane-revelation-v1.png', 'void-gate-v1.png']) {
    assert.ok(runtime.includes(`assets/vfx/cinematic/${file}`), `${file} must be registered`);
    assert.ok(fs.existsSync(path.join(root, 'dist/assets/vfx/cinematic', file)), `${file} must be shipped`);
  }
  assert.ok(html.includes("['heal-lowest','cleanse'].includes(effect))showSpellCinematicEffect('life'"), 'Healing and cleansing spells must use life bloom');
  assert.ok(html.includes("['mana-ramp','draw'].includes(effect))showSpellCinematicEffect('arcane'"), 'Mana and draw spells must use arcane revelation');
  assert.ok(html.includes("['bounce','resurrect','global-destroy'].includes(effect))showSpellCinematicEffect('void'"), 'Recall, resurrection, and destruction spells must use the void gate');
});

test('배경음악: 최후의 발악이 시작되면 각성 BGM으로 크로스페이드한다', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("awakening:new Audio('assets/audio/bgm-awakening.mp3')"), 'Awakening track must be loaded');
  assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '../../dist/assets/audio/bgm-awakening.mp3')), 'Awakening mp3 must be shipped');
  assert.ok(html.includes('if(active){switchToAwakeningBgm();'), 'Desperation start must switch the BGM');
});

test('드로우: 뒷면으로 날아와 손패 자리에서 뒤집히고, 확대 배율로 일러스트를 키우지 않는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('requestAnimationFrame(()=>drawCardFlip(card,'), 'drawCard must use the back-face flip sequence');
  assert.ok(html.includes("const back=decorateCardBack(Object.assign(document.createElement('span'),{className:'card-back-face'}),el.dataset.persona||'')") && html.includes('flipReveal(card,onDone)'), 'Real hand card must show the back face before flipping');
  assert.ok(html.includes('scale=s0+(endScale-s0)*e') && html.includes("endScale:hidden?.35:1}"), 'Flight must grow from a small scale up to 1 (no upscaling past native size)');
  assert.ok(html.includes('img.decode()') && html.includes('ready.then(()=>{flight.remove();flipReveal(card,onDone);})'), 'Front art must be decoded before it is revealed');
});

test('소환: 손패 카드가 뒷면으로 돌아서 전장으로 날아가 그 자리에서 뒤집힌다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('summonCardFlip(from,unit,'), 'Summon must use the back-face flight + flip');
  assert.ok(html.includes('flipReveal(unit,onDone)'), 'The field unit itself must flip to reveal');
  assert.ok(html.includes('summonLandingImpact(unit)'), 'Summon arrival must trigger the heavy ground impact');
  assert.ok(html.includes("playAudio('metal'") && html.includes("tone(54,.42,'sine'"), 'Summon landing must combine a metal hit with a low-frequency thump');
  assert.ok(html.includes("unit.dataset.cost=String(cost)"), 'Summon impact strength must scale with card cost');
});

test('드로우: 다른 탭으로 들어가는 카드도 그 탭으로 넘겨 손패에서 뒤집고, 여러 장은 차례로 뒤집는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("if(card.classList.contains('hand-filtered')&&card.isConnected&&!ultimateArmed&&!document.querySelector('.hand .card.selected'))setHandFilter(cardCategory(card));"), 'Hidden-tab draws must switch to that tab so the flip is visible');
  assert.ok(html.includes('queueDrawFlip(card,'), 'Consecutive draws must be queued one by one');
});

test('효과 표시: 돌아가는 원+글자(rush) 대신 카드 테두리 임팩트로 표시한다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes("if(kind==='rush'){borderImpact(target);return;}"), 'rush skill effect must be replaced by the border impact');
  assert.ok(html.includes('function borderImpact(target,'), 'Border impact helper must exist');
});

test('타격: 영웅을 직접 쳐도 아바타 자리에 오로라 타격 이펙트가 나온다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(!html.includes("if(target.classList.contains('avatar')){heroHealthImpact(target,damage);return;}"), 'impact() must not return early for hero avatars');
  assert.ok(html.includes("const hero=target.classList.contains('avatar');if(hero)heroHealthImpact(target,damage);"), 'Hero hits keep the HP bar feedback and add hit VFX');
});

test('합성 실패: 마법진이 무너지는 실패 연출과 잃은 재료·다음 확률 안내를 보여 준다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  assert.ok(html.includes('revealSynthStage(outcome.index,true);}else{renderCollection();revealSynthFail(slots,count);}'), 'Synthesis failure must show the fail stage instead of closing silently');
  assert.ok(html.includes('function revealSynthFail(slots,count)'), 'Fail stage helper must exist');
});
