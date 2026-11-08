// 사용법: const fx = new FrostBurst(canvas, { points: [{ x, y, size }], duration: 1.6 }); fx.start();
// points 각 지점에서 서리 고리가 번지고 얼음 결정이 솟은 뒤 파편으로 흩어진다. 끝나면 onEnd 호출.
class FrostBurst {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({ points: [], duration: 1.6, onEnd: null }, opts);
    this.t = 0;
    this.running = false;
    this.snow = [];
    this.shards = [];
    this.resize();
    for (const p of this.opts.points) this.seed(p);
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const c = this.canvas;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    this.dpr = dpr;
  }

  seed(p) {
    const size = p.size || 90;
    const n = 9 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      this.shards.push({ x: p.x, y: p.y, a, len: size * (0.55 + Math.random() * 0.6), w: size * (0.07 + Math.random() * 0.05), delay: Math.random() * 0.18 });
    }
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, v = size * (0.5 + Math.random() * 1.6);
      this.snow.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - size * 0.3, r: 1 + Math.random() * 2.6, spin: Math.random() * 6 });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.t += dt;
      this.draw(dt);
      if (this.t >= this.opts.duration) { this.running = false; this.opts.onEnd && this.opts.onEnd(); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  draw(dt) {
    const ctx = this.ctx, d = this.opts.duration, t = this.t;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    const fade = Math.max(0, Math.min(1, (d - t) / 0.5));
    ctx.globalCompositeOperation = 'lighter';
    // 서리 고리 + 중심 섬광
    for (const p of this.opts.points) {
      const size = p.size || 90, k = Math.min(1, t / 0.45);
      ctx.strokeStyle = `rgba(150,215,255,${(1 - k) * 0.9 * fade})`;
      ctx.lineWidth = 3 + (1 - k) * 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, size * (0.25 + k * 1.15), 0, Math.PI * 2); ctx.stroke();
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 0.9);
      g.addColorStop(0, `rgba(235,250,255,${0.75 * Math.max(0, 1 - t / 0.5)})`);
      g.addColorStop(1, 'rgba(80,160,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    // 얼음 결정: 솟아오른 뒤 0.9초 이후 옅어진다
    for (const s of this.shards) {
      const k = Math.max(0, Math.min(1, (t - s.delay) / 0.28));
      if (!k) continue;
      const L = s.len * (1 - Math.pow(1 - k, 3)), ux = Math.cos(s.a), uy = Math.sin(s.a), vx = -uy, vy = ux;
      const alpha = Math.min(1, k) * Math.max(0, Math.min(1, (d - 0.3 - t) / 0.6 + 0.3));
      ctx.fillStyle = `rgba(170,225,255,${0.7 * alpha})`;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x + vx * s.w, s.y + vy * s.w);
      ctx.lineTo(s.x + ux * L, s.y + uy * L);
      ctx.lineTo(s.x - vx * s.w, s.y - vy * s.w);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 눈가루 파편
    for (const f of this.snow) {
      f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 90 * dt; f.vx *= 0.97; f.spin += dt * 6;
      ctx.fillStyle = `rgba(225,245,255,${0.9 * fade})`;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.spin);
      ctx.fillRect(-f.r, -f.r * 0.5, f.r * 2, f.r); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
