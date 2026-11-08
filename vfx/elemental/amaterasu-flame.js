// 사용법: const fx = new AmaterasuFlame(canvas, { x | xs, y, width, scale, rise, rate }); fx.start(); fx.stop();
// rate=0 으로 두면 새 불꽃이 멈추고 남은 불꽃이 자연스럽게 꺼진다. scale 은 불꽃 크기 배율.
class AmaterasuFlame {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({ rate: 5, maxParticles: 900, scale: 1, rise: 1 }, opts);
    this.particles = [];
    this.t = 0;
    this.running = false;
    this.resize();
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const c = this.canvas;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    this.dpr = dpr;
    this.w = c.clientWidth;
    this.h = c.clientHeight;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  // 일회성 연출용: 정지하고 resize 리스너를 해제한다.
  destroy() { this.stop(); removeEventListener('resize', this.onResize); }

  emit() {
    const o = this.opts;
    // xs 를 주면 여러 지점(예: 카드 양옆)에서 번갈아 솟는다
    const cx = o.xs ? o.xs[(Math.random() * o.xs.length) | 0] : (o.x ?? this.w / 2);
    const baseY = o.y ?? this.h * 0.82;
    const half = (o.width ?? Math.min(this.w * 0.3, 240)) / 2;
    // 가운데로 몰리는 분포 → 불꽃 중심이 더 높고 굵게 타오름
    const r = (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
    const px = cx + r * half;
    const centerness = 1 - Math.abs(r);
    const kind = Math.random() < 0.08 ? 'ember' : 'flame';
    const sc = o.scale;
    const rs = sc * o.rise;
    this.particles.push(kind === 'ember' ? {
      kind, x: px, cx, y: baseY,
      vx: (Math.random() - 0.5) * 40, vy: -(90 + Math.random() * 160) * rs,
      size: (1.5 + Math.random() * 2) * Math.max(sc, 0.6), life: 0, max: 1 + Math.random() * 1.2,
      phase: Math.random() * 6.28, sway: (30 + Math.random() * 40) * sc,
    } : {
      kind, x: px, cx, y: baseY + Math.random() * 10,
      vx: 0, vy: -(60 + Math.random() * 90) * (0.7 + centerness * 0.8) * rs,
      size: (18 + Math.random() * 20) * (0.55 + centerness * 0.6) * sc,
      life: 0, max: 0.9 + Math.random() * 0.9 + centerness * 0.5,
      phase: Math.random() * 6.28, sway: (18 + Math.random() * 28) * sc,
    });
  }

  update(dt) {
    this.t += dt;
    const n = Math.round(this.opts.rate * (dt * 60));
    for (let i = 0; i < n && this.particles.length < this.opts.maxParticles; i++) this.emit();
    for (const p of this.particles) {
      p.life += dt;
      const k = p.life / p.max;
      // 일렁임: 위로 갈수록 커지는 좌우 흔들림 + 느린 돌풍
      const gust = Math.sin(this.t * 1.3 + p.y * 0.01) * 14 * this.opts.scale;
      p.x += (Math.sin(this.t * 4.2 + p.phase) * p.sway * k + gust * k) * dt * 2;
      p.x += (p.cx - p.x) * 1.4 * k * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flame') p.vy *= 1 - 0.25 * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // 폭 곡선: 밑동은 가늘게 → 중간에서 가장 두껍게 → 끝은 뾰족하게
  shape(k) {
    return (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, k * 1.15))) * (1 - k * 0.45);
  }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const grad = (x, y, r, stops) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      for (const [o, c] of stops) g.addColorStop(o, c);
      return g;
    };

    // 1패스: 보랏빛 외곽 광채 (가산 합성)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const k = p.life / p.max;
      const a = (1 - k) * (p.kind === 'ember' ? 0.9 : 0.16);
      const r = p.kind === 'ember' ? p.size * 3 : p.size * this.shape(k) * 1.8;
      ctx.fillStyle = grad(p.x, p.y, r, [
        [0, `rgba(150,70,235,${a})`],
        [0.5, `rgba(95,35,180,${a * 0.5})`],
        [1, 'rgba(40,0,100,0)'],
      ]);
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    // 2패스: 광채 위에 검은 불꽃 본체를 덮어 "빛 속의 검은 불"로 보이게 함
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) {
      if (p.kind !== 'flame') continue;
      const k = p.life / p.max;
      const a = Math.min(1, (1 - k) * 1.5) * 0.85;
      const r = p.size * this.shape(k);
      // 위로 갈수록 가늘고 길게: y축 늘이기
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 1.35);
      ctx.fillStyle = grad(0, 0, r, [
        [0, `rgba(0,0,0,${a})`],
        [0.6, `rgba(4,0,8,${a * 0.8})`],
        [1, 'rgba(10,0,16,0)'],
      ]);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }
}
