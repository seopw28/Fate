#!/usr/bin/env python3
"""효과 위치 측정: 카드·영웅을 기준으로 그려지는 효과가 기준점(대상 중심 등)에서 몇 px 벗어나는지 잰다.

사용: python3 -I 12_tools/qa/check-effect-alignment.py [--save 파일] [--compare 파일]
  --save    측정값을 json으로 저장 (화면 배율 작업 전 기준)
  --compare 저장한 기준과 비교해, 기준보다 1px 넘게 나빠진 항목이 있으면 실패(exit 1)
소환 마법진은 기준과 상관없이 1px 이내여야 한다(2026-11-08 고침). docs/plan-ui-scale-1.md 1-3.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

VIEWPORTS = [(1568, 900), (1366, 768), (1100, 800), (1000, 900)]
QUERY = '?skipIntro&guardian=baekho&difficulty=normal&seed=ui-scale-baseline'
# (이름, 대상 선택자, 기준점 'center'|'bottom-5'|'y82', 호출 코드 — t 가 대상 요소)
CASES = [
    ('소환 마법진', '.summon-zone > .unit', 'bottom-5', 'summonLandingImpact(t)'),
    ('피해 타격(카드)', '.summon-zone > .unit', 'center', "impact(t,3,'fire')"),
    ('피해 타격(영웅)', '.player .avatar', 'center', "impact(t,3,'fire')"),
    ('스킬 라벨', '.summon-zone > .unit', 'center', "showSkillEffect('heal',t,'회복 +2')"),
    ('방어 방패', '.summon-zone > .unit', 'center', "showDefenseShield(t,'방어함')"),
    ('교환 피해 숫자', '.summon-zone > .unit', 'center', 'showExchangeDamageNumber(t,3,false)'),
    ('마법 대상 링', '.summon-zone > .unit', 'center', "showSpellTargetRing(t,'대상','#9b6bff')"),
    ('카드 마법 효과', '.summon-zone > .unit', 'center', "showUnitSpellFx(t,'fire')"),
    ('복수자 착지', '.summon-zone > .unit', 'y82', "showAvengerLandingImpact(t,'#ff6a6a')"),
    ('중간 스킬 효과', '.summon-zone > .unit', 'center', "showMediumSkillEffect(Object.keys(mediumSkillAssets)[0],t,'x')"),
]
MEASURE = r"""
([sel, anchor, code]) => {
  const t = document.querySelector(sel); if (!t) return {error: '대상 없음'};
  document.querySelectorAll('*').forEach(e => e.getAnimations && e.getAnimations().forEach(a => a.cancel()));
  const tr = t.getBoundingClientRect();
  const ax = tr.left + tr.width / 2, ay = anchor === 'bottom-5' ? tr.bottom - 5 : anchor === 'y82' ? tr.top + tr.height * .82 : tr.top + tr.height / 2;
  const added = [];
  const obs = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) added.push(n); })));
  obs.observe(document.body, {childList: true, subtree: true});
  try { (new Function('t', code))(t); } catch (e) { obs.disconnect(); return {error: String(e).slice(0, 80)}; }
  obs.takeRecords().forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) added.push(n); }));
  obs.disconnect();
  const out = [];
  added.filter(n => n.isConnected && n.style && n.style.left && n.style.top).forEach(n => {
    n.getAnimations && n.getAnimations({subtree: false}).forEach(a => a.cancel());
    const r = n.getBoundingClientRect(); if (!r.width && !r.height) return;
    out.push({el: (n.className && typeof n.className === 'string' ? n.className.split(' ')[0] : n.tagName.toLowerCase()), dx: +(r.left + r.width / 2 - ax).toFixed(1), dy: +(r.top + r.height / 2 - ay).toFixed(1)});
  });
  added.forEach(n => n.isConnected && n.remove());
  return {nodes: out};
}
"""

def measure():
    result = {}
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in VIEWPORTS:
            pg = br.new_page(viewport={'width': w, 'height': h}); pg.goto(base + '/index.html' + QUERY); pg.wait_for_timeout(2500)
            for _ in range(5):  # 내 전장에 카드 1장 이상
                if pg.evaluate("document.querySelectorAll('.summon-zone > .unit').length"): break
                pg.evaluate("(()=>{mana=10;const c=[...document.querySelectorAll('.hand .summon-card')].find(c=>!c.classList.contains('spell-card')&&!c.classList.contains('trap-card'));if(c)playCard(c)})()")
                pg.wait_for_timeout(2500)
            for name, sel, anchor, code in CASES:
                r = pg.evaluate(MEASURE, [sel, anchor, code]); pg.wait_for_timeout(50)
                result[f'{w}x{h} {name}'] = r
            pg.close()
        br.close()
    return result

def worst(r):
    nodes = r.get('nodes') or []
    return max((max(abs(n['dx']), abs(n['dy'])) for n in nodes), default=None)

def main():
    res = measure(); bad = 0
    base = None
    if '--compare' in sys.argv: base = json.load(open(sys.argv[sys.argv.index('--compare') + 1]))
    for k, r in res.items():
        wv = worst(r)
        line = f'{k}: ' + (r.get('error') or ('효과 요소 없음' if wv is None else f"최대 {wv}px  " + ', '.join(f"{n['el']}({n['dx']},{n['dy']})" for n in r['nodes'][:4])))
        if '소환 마법진' in k and (wv is None or wv > 1): bad += 1; line += '  ← 실패(1px 초과)'
        if base and k in base and wv is not None and worst(base[k]) is not None and wv > worst(base[k]) + 1: bad += 1; line += f'  ← 기준 {worst(base[k])}px보다 나빠짐'
        print(line)
    if '--save' in sys.argv:
        path = sys.argv[sys.argv.index('--save') + 1]; os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        json.dump(res, open(path, 'w'), ensure_ascii=False, indent=1); print('저장:', path)
    print('FAIL' if bad else 'OK', f'({bad}건)')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
