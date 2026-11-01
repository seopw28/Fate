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
  assert.ok(Sfx.STRONG && Sfx.STRONG.wet > 0 && Sfx.STRONG.wide > 0, '강한 신호 설정(잔향·좌우 폭)이 있어야 함');
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

test('조합표: 모든 속성에 변주 후보가 4개 이상이고, 모두 길게 울리는 몸통 샘플을 포함하며, 쓰는 샘플이 실제로 존재한다', () => {
  const known = new Set([...Object.keys(Sfx.BANK), ...Object.keys(Sfx.LEGACY)]);
  for (const element of ['fire', 'water', 'wind', 'earth', 'neutral']) {
    const combos = Sfx.HIT_SETS[element];
    assert.ok(combos.length >= 4, `${element}: 변주 후보가 4개 이상이어야 함`);
    for (const combo of combos) {
      assert.ok(combo.length >= 2, `${element}: 조합은 샘플을 겹쳐야 함`);
      assert.ok(combo.some((layer) => layer.s.startsWith('legacy_')), `${element}: 모든 조합에 몸통(길게 울리는) 샘플이 있어야 밋밋해지지 않음`);
      for (const layer of combo) assert.ok(known.has(layer.s), `${element}: 알 수 없는 샘플 ${layer.s}`);
    }
    assert.ok(Sfx.SYNTH_NAMES[element].length >= 3, `${element}: 합성음 후보가 3개 이상이어야 함`);
  }
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
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
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

test('효과음 실행: 모든 속성×강도 조합이 샘플 없이도(합성음만으로) 소리를 만든다', () => {
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

test('모션 선택: 속성별 스타일이 드러나고, 공격력이 높을수록 큰 동작이 늘어난다', () => {
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
  assert.ok(html.includes("sfx=function(kind,variant='neutral',strength=3){if(kind==='hit'&&soundOn){fateSfx.playHit(variant,strength,hitPan);return;}"), 'Hit sound must route through the variety engine');
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
  assert.equal(made.filter((n) => n === 'createConvolver').length, 1);
});

test('음량 보정표: 모든 조합에 값이 있고 유효하다', () => {
  for (const element of Object.keys(Sfx.HIT_SETS)) {
    const trims = Sfx.TRIM[element];
    assert.ok(Array.isArray(trims) && trims.length === Sfx.HIT_SETS[element].length, `${element}: 조합 수만큼 보정값이 있어야 함 (python3 -I 12_tools/qa/measure-sfx.py --calibrate 로 다시 측정)`);
    trims.forEach((value) => assert.ok(value >= 0.3 && value <= 6, `${element}: 보정값 ${value}`));
  }
});

test('디코딩된 샘플을 공유하면 그대로 재생한다 (몸통 샘플 우선)', () => {
  const { ctx, stats } = fakeAudio();
  const buffers = { legacy_explosion: [{ duration: 4.5 }], impactPunch_heavy: [{ duration: 0.4 }], impactSoft_heavy: [{ duration: 0.4 }], impactMining: [{ duration: 0.9 }] };
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain(), buffers });
  const before = stats.started;
  api.playHit('fire', 12, 0, { combo: 0 });
  assert.ok(stats.started - before >= 8, '샘플은 좌우로 넓혀 2번씩 재생되므로 시작 수가 충분히 많아야 함');
});

test('조합 고정(force.combo)과 연속 반복 금지가 함께 동작한다', () => {
  const { ctx } = fakeAudio();
  const api = Sfx.init({ engine: () => ctx, bus: () => ctx.createGain() });
  assert.equal(api.playHit('earth', 8, 0, { combo: 1 }), true);
  assert.equal(api.playHit('earth', 8, 0, { combo: 99 }), true, '범위를 넘는 번호도 안전하게 처리');
});
