(function (global) {
  const { elements, assets } = global.TCG_VFX;

  function node(className, style = {}) {
    const el = document.createElement('i');
    el.className = className;
    Object.assign(el.style, style);
    return el;
  }

  function removeLater(el, ms) { setTimeout(() => el.remove(), ms); return el; }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function particles(layer, preset, x, y) {
    const palette = elements[preset.element];
    for (let i = 0; i < preset.particles; i++) {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(55, 155) * preset.intensity / 2;
      const p = node('vfx-particle', {
        left: `${x}px`, top: `${y}px`,
        '--color': palette.color, '--accent': palette.accent,
        '--dx': `${Math.cos(angle) * distance}px`,
        '--dy': `${Math.sin(angle) * distance - rand(4, 35)}px`,
        '--size': `${rand(3, preset.element === 'earth' ? 13 : 8)}px`,
        '--spin': `${rand(-240, 240)}deg`,
        '--life': `${rand(480, 900)}ms`
      });
      layer.appendChild(p); removeLater(p, 950);
    }
  }

  function rings(layer, preset, x, y, count = 2) {
    for (let i = 0; i < count; i++) {
      const ring = node('vfx-ring', { left: `${x}px`, top: `${y}px`, '--color': elements[preset.element].color, animationDelay: `${i * 80}ms` });
      layer.appendChild(ring); removeLater(ring, 850 + i * 80);
    }
  }

  function sprite(layer, preset, x, y, rotate = 0) {
    if (!preset.asset) return;
    const definition = assets[preset.asset];
    const img = document.createElement('img');
    img.className = `vfx-sprite ${preset.action}`;
    Object.assign(img.style, { left: `${x}px`, top: `${y}px`, transform: `translate(-50%,-50%) rotate(${rotate}deg)` });
    layer.appendChild(img);
    if (definition.static) {
      img.src = definition.path();
      removeLater(img, preset.duration || 1000);
      return;
    }
    let frame = 1;
    const timer = setInterval(() => {
      img.src = definition.path(frame++);
      if (frame > definition.count) { clearInterval(timer); img.remove(); }
    }, 1000 / definition.fps);
    img.src = definition.path(frame++);
  }

  function cinematic(layer, preset, to) {
    sprite(layer, preset, to.x, to.y);
    rings(layer, preset, to.x, to.y, 2);
  }

  function slash(layer, preset, from, to) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    const count = preset.element === 'wind' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const line = node('vfx-slash', {
        left: `${to.x}px`, top: `${to.y + (i - 1) * 24}px`,
        '--color': elements[preset.element].color,
        '--accent': elements[preset.element].accent,
        '--angle': `${angle + (i - 1) * 12}deg`,
        animationDelay: `${i * 55}ms`
      });
      layer.appendChild(line); removeLater(line, 650);
    }
    sprite(layer, preset, to.x, to.y, angle);
  }

  function projectile(layer, preset, from, to) {
    const palette = elements[preset.element];
    const orb = node(`vfx-projectile ${preset.element}`, {
      left: `${from.x}px`, top: `${from.y}px`, '--color': palette.color, '--accent': palette.accent,
      '--tx': `${to.x - from.x}px`, '--ty': `${to.y - from.y}px`
    });
    layer.appendChild(orb); removeLater(orb, 660);
    const trail = node('vfx-flight-trail', { left: `${from.x}px`, top: `${from.y}px`, width: `${Math.hypot(to.x - from.x, to.y - from.y)}px`, '--angle': `${Math.atan2(to.y-from.y,to.x-from.x)}rad`, '--color': palette.color });
    layer.appendChild(trail); removeLater(trail, 620);
    setTimeout(() => sprite(layer, preset, to.x, to.y), 420);
  }

  function status(layer, preset, to) {
    const palette = elements[preset.element];
    const glyph = node(`vfx-status ${preset.action}`, { left: `${to.x}px`, top: `${to.y}px`, '--color': palette.color, '--accent': palette.accent });
    glyph.textContent = preset.action === 'heal' ? '✦' : preset.action === 'shield' ? '⬡' : '◆';
    layer.appendChild(glyph); removeLater(glyph, 1050);
    rings(layer, preset, to.x, to.y, preset.action === 'shield' ? 3 : 2);
    sprite(layer, preset, to.x, to.y);
  }

  function aoe(layer, preset, to) {
    rings(layer, preset, to.x, to.y, 4);
    for (let i = 0; i < 6; i++) {
      const crack = node('vfx-crack', { left: `${to.x}px`, top: `${to.y}px`, '--angle': `${i * 60 + rand(-12,12)}deg`, '--color': elements[preset.element].color, animationDelay: `${i * 35}ms` });
      layer.appendChild(crack); removeLater(crack, 900);
    }
    sprite(layer, preset, to.x, to.y);
  }

  function play(preset, options) {
    const { layer, arena, source, target, onHit } = options;
    const lr = layer.getBoundingClientRect(), sr = source.getBoundingClientRect(), tr = target.getBoundingClientRect();
    const from = { x: sr.left + sr.width / 2 - lr.left, y: sr.top + sr.height / 2 - lr.top };
    const to = { x: tr.left + tr.width / 2 - lr.left, y: tr.top + tr.height / 2 - lr.top };
    layer.replaceChildren();
    arena.style.setProperty('--shake', `${preset.shake}px`);
    arena.classList.remove('is-shaking'); void arena.offsetWidth; arena.classList.add('is-shaking');
    if (preset.action === 'slash') slash(layer, preset, from, to);
    else if (preset.action === 'projectile') projectile(layer, preset, from, to);
    else if (preset.action === 'aoe') aoe(layer, preset, to);
    else if (preset.action === 'cinematic') cinematic(layer, preset, to);
    else status(layer, preset, to);
    const hitDelay = preset.action === 'projectile' ? 440 : preset.action === 'cinematic' ? 420 : 120;
    setTimeout(() => {
      target.classList.remove('is-hit'); void target.offsetWidth; target.classList.add('is-hit');
      particles(layer, preset, to.x, to.y);
      if (!['heal','buff','shield'].includes(preset.action)) rings(layer, preset, to.x, to.y, preset.intensity);
      if (onHit) onHit();
    }, hitDelay);
    setTimeout(() => arena.classList.remove('is-shaking'), 650);
  }

  global.TCGVfxEngine = { play };
})(window);
