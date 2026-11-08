(function attachSpellCinematics(root) {
  const effects = {
    life: { asset: 'assets/vfx/cinematic/life-bloom-v1.webp', color: '#7dffd2' },
    arcane: { asset: 'assets/vfx/cinematic/arcane-revelation-v1.webp', color: '#b98cff' },
    void: { asset: 'assets/vfx/cinematic/void-gate-v1.webp', color: '#c74fff' }
  };

  root.showSpellCinematicEffect = function showSpellCinematicEffect(kind, label) {
    const config = effects[kind];
    if (!config) return;
    document.querySelectorAll('.cinematic-skill-fx').forEach(node => node.remove());
    const fx = document.createElement('div');
    fx.className = `cinematic-skill-fx ${kind}`;
    fx.style.setProperty('--cinematic-color', config.color);
    fx.setAttribute('role', 'img');
    fx.setAttribute('aria-label', `${label} 연출`);
    fx.innerHTML = `<img src="${config.asset}" alt=""><strong class="cinematic-skill-label cinematic-skill-title-large"></strong>`;
    const title = fx.querySelector('.cinematic-skill-title-large');
    title.style.setProperty('top', '50%', 'important');
    title.style.setProperty('width', 'calc(var(--field-width) * .94)', 'important');
    title.style.setProperty('font-size', 'clamp(28px,calc(var(--field-width) * .06),88px)', 'important');
    root.typeSkillTitle(title, label);
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1700);
  };
})(globalThis);
