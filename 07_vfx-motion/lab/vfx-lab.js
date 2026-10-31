(function () {
  const { presets, elements } = window.TCG_VFX;
  const list = document.querySelector('#preset-list');
  const filters = document.querySelector('#filters');
  const spec = document.querySelector('#spec');
  let selected = presets[0];
  let filter = 'all';

  const filterItems = [['all','전체'],['slash','참격'],['projectile','투사체'],['status','보조'],['cinematic','대형'],['aoe','광역']];
  filterItems.forEach(([id,label]) => {
    const button = document.createElement('button'); button.textContent = label; button.dataset.filter = id;
    button.onclick = () => { filter = id; renderFilters(); renderList(); };
    filters.appendChild(button);
  });

  function matches(preset) {
    if (filter === 'all') return true;
    if (filter === 'status') return ['heal','buff','shield'].includes(preset.action);
    return preset.action === filter;
  }
  function renderFilters() { filters.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.filter === filter)); }
  function renderList() {
    list.replaceChildren();
    presets.filter(matches).forEach(preset => {
      const meta = elements[preset.element], button = document.createElement('button');
      button.className = `preset${selected.id === preset.id ? ' active' : ''}`;
      button.style.setProperty('--preset-color', meta.color);
      button.innerHTML = `<strong>${meta.icon} ${preset.name}</strong><span>${meta.label} · ${preset.action} · Lv.${preset.intensity}</span>`;
      button.onclick = () => { selected = preset; updateDetail(); renderList(); play(); };
      list.appendChild(button);
    });
  }
  function updateDetail() {
    const meta = elements[selected.element];
    document.querySelector('#preset-name').textContent = selected.name;
    document.querySelector('#preset-note').textContent = selected.note;
    document.querySelector('#arena').style.setProperty('--preset-color', meta.color);
    spec.innerHTML = `<b>${meta.icon} ${selected.id}</b><div class="spec-grid"><span>${meta.label}</span><span>${selected.action}</span><span>강도 ${selected.intensity}</span><span>흔들림 ${selected.shake}</span></div>`;
  }
  function play() {
    window.TCGVfxEngine.play(selected, {
      layer: document.querySelector('#vfx-layer'), arena: document.querySelector('#arena'),
      source: document.querySelector('#source'), target: document.querySelector('#target'),
      onHit: () => { document.querySelector('#damage-label').textContent = ['heal','buff','shield'].includes(selected.action) ? '상태 효과 적용' : `−${selected.intensity * 3} 피해`; setTimeout(() => document.querySelector('#damage-label').textContent = '피격 반응', 850); }
    });
  }
  document.querySelector('#replay').onclick = play;
  document.addEventListener('keydown', event => { if (event.code === 'Space') { event.preventDefault(); play(); } });
  renderFilters(); renderList(); updateDetail(); setTimeout(play, 450);
})();
