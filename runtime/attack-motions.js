/* 평타 모션 변주.
 * 속성별 기본 스타일 + 공격력(power)이 높을수록 크고 강한 동작, 같은 공격자가 연속으로 같은 동작을 하지 않는다.
 * 순수 함수만 있어 브라우저 없이 테스트할 수 있다. (사용: FateMotions.pick / FateMotions.build)
 */
(function (root) {
  'use strict';

  // 속성별 모션 가중치 (클수록 자주 나옴)
  const WEIGHTS = {
    fire: { slam: 5, bash: 2, lunge: 1.5, spin: 1.5 },
    water: { swoop: 4.5, spin: 2.5, lunge: 2, jab: 1 },
    wind: { jab: 4.5, spin: 3, swoop: 1.5, lunge: 1 },
    earth: { bash: 4.5, slam: 3.5, lunge: 2 },
    neutral: { lunge: 4, jab: 2, bash: 2, spin: 2 }
  };
  const BIG = new Set(['slam', 'bash']);
  const EASING = 'cubic-bezier(.2,.72,.22,1)';

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  // 공격력 1~11을 0~1로 환산 (1 이하 0, 11 이상 1)
  const powerFromAttack = (attack) => clamp01(((Number(attack) || 1) - 1) / 10);

  function pick(element, power, last, rnd = Math.random) {
    const weights = Object.assign({}, WEIGHTS[element] || WEIGHTS.neutral);
    for (const name of Object.keys(weights)) {
      if (BIG.has(name)) weights[name] *= 0.7 + power * 0.9; // 강한 공격수일수록 큰 동작
      else if (name === 'jab') weights[name] *= 1.3 - power * 0.6; // 약한 공격수는 가벼운 찌르기
    }
    if (last && weights[last] !== undefined && Object.keys(weights).length > 1) delete weights[last];
    const entries = Object.entries(weights);
    let roll = rnd() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [name, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return name;
    }
    return entries[0][0];
  }

  const frame = (offset, x, y, scale = 1, rotate = 0) => ({
    offset,
    transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(1)}deg)`
  });

  // dx,dy: 공격자→대상 벡터, moveX,moveY: 접촉 지점까지 이동 거리, power: 0~1
  function build(name, { dx = 0, dy = 0, moveX = 0, moveY = 0, power = 0.5, side = 1 } = {}) {
    const amp = 0.85 + power * 0.3;
    const mx = moveX * amp, my = moveY * amp;
    let duration, hit, frames;
    switch (name) {
      case 'slam': { // 높이 뛰어올라 내려찍기
        const lift = 48 + power * 42;
        duration = 760; hit = 0.48;
        frames = [frame(0, 0, 0), frame(0.26, -dx * 0.02, -lift - dy * 0.02, 1.12 + power * 0.04, -3),
          frame(0.5, mx, my, 1.12 + power * 0.06, 2), frame(0.6, mx * 0.94, my * 0.94, 1.02), frame(1, 0, 0)];
        break;
      }
      case 'bash': { // 한껏 웅크렸다가 묵직하게 들이받기
        duration = 800; hit = 0.42;
        frames = [frame(0, 0, 0), frame(0.3, -dx * 0.1, -dy * 0.1, 0.9), frame(0.44, mx * 1.05, my * 1.05, 1.16 + power * 0.06),
          frame(0.56, mx * 0.98, my * 0.98, 1.08), frame(0.78, mx * 0.35, my * 0.35, 1.02), frame(1, 0, 0)];
        break;
      }
      case 'jab': { // 빠른 연속 찌르기
        duration = 700; hit = 0.52;
        frames = [frame(0, 0, 0), frame(0.14, -dx * 0.03, -dy * 0.03, 0.97), frame(0.3, mx * 0.55, my * 0.55, 1.05),
          frame(0.4, mx * 0.2, my * 0.2, 1), frame(0.54, mx, my, 1.08), frame(0.64, mx * 0.92, my * 0.92, 1.03), frame(1, 0, 0)];
        break;
      }
      case 'spin': { // 회전하며 베기
        duration = 760; hit = 0.5;
        frames = [frame(0, 0, 0, 1, 0), frame(0.16, -dx * 0.04, -dy * 0.04, 0.95, -20),
          frame(0.5, mx, my, 1.1, 300), frame(0.62, mx * 0.92, my * 0.92, 1.04, 360), frame(1, 0, 0, 1, 360)];
        break;
      }
      case 'swoop': { // 곡선으로 휘감아 접근
        const dist = Math.hypot(dx, dy) || 1;
        const px = (-dy / dist) * side, py = (dx / dist) * side;
        const arc = Math.min(120, dist * 0.4) * (0.8 + power * 0.4);
        duration = 820; hit = 0.5;
        frames = [];
        for (let i = 0; i <= 5; i++) {
          const t = i / 5, bend = Math.sin(Math.PI * t) * arc;
          frames.push(frame(0.5 * t, mx * t + px * bend, my * t + py * bend, 1 + 0.08 * t, side * 14 * Math.sin(Math.PI * t)));
        }
        for (let i = 1; i <= 5; i++) {
          const u = i / 5, bend = Math.sin(Math.PI * u) * arc;
          frames.push(frame(0.5 + 0.5 * u, mx * (1 - u) - px * bend, my * (1 - u) - py * bend, 1.08 - 0.08 * u, 0));
        }
        break;
      }
      case 'lunge':
      default: { // 기존 기본 돌진
        name = 'lunge'; duration = 620; hit = 0.46;
        frames = [frame(0, 0, 0), frame(0.18, -dx * 0.045, -dy * 0.045, 0.96), frame(0.48, mx, my, 1.08),
          frame(0.58, mx * 0.9, my * 0.9, 1.03), frame(1, 0, 0)];
      }
    }
    return { name, keyframes: frames, duration: Math.round(duration * (0.95 + power * 0.1)), hit, easing: EASING };
  }

  const api = { WEIGHTS, powerFromAttack, pick, build };
  root.FateMotions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
