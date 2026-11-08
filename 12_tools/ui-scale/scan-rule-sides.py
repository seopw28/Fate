#!/usr/bin/env python3
"""CSS 규칙별 축소 안/밖 판정: 첫 화면, 효과 10종, 화면 상태 54개, 화면 크기 4종에서
각 스타일 규칙(@media 안 포함, 소스 순서)이 맞는 요소가 0.9 축소 안·밖 어디에 있는지 센다.
결과 rule-sides.json (규칙 순번 → 선택자, 안/밖 수). 저장소 루트에서 실행. docs/plan-ui-scale-1.md 2-2.
"""
import os, sys, json, importlib.util
ROOT = os.getcwd(); HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, '12_tools/qa'))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
o = load('o', os.path.join(ROOT, '12_tools/qa/check-text-overflow.py'))
a = load('a', os.path.join(ROOT, '12_tools/qa/check-effect-alignment.py'))
VIEWPORTS = [(1568, 900), (1366, 768), (1100, 800), (1000, 900)]

INIT = r"""() => {
  const flat = [];
  const walk = (rules) => { for (const r of rules) { if (r.type === 1) flat.push(r); else if (r.cssRules && r.type !== 7) walk(r.cssRules); } };
  walk(document.styleSheets[0].cssRules);
  window.__rules = flat.map(r => {
    const sel = r.selectorText.split(',').map(s => s.replace(/::?(before|after|placeholder|selection|marker|backdrop|-webkit-[\w-]+)\b(\([^)]*\))?/g, '')
      .replace(/:(hover|focus|focus-visible|focus-within|active|visited)\b/g, '').trim() || '*').join(',');
    return {sel: r.selectorText, q: sel, inn: 0, out: 0};
  });
  window.__zoomed = e => !!e.closest('main.app,#collection-modal,#result,#tier-modal');
  return flat.length;
}"""
SCAN = r"""() => { for (const r of window.__rules) { let list; try { list = document.querySelectorAll(r.q); } catch (e) { r.bad = 1; continue; }
  for (const e of list) { if (window.__zoomed(e)) r.inn++; else r.out++; } } }"""

def main():
    rules = None
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in VIEWPORTS:
            pg = br.new_page(viewport={'width': w, 'height': h}); pg.goto(base + '/index.html' + a.QUERY); pg.wait_for_timeout(2500)
            n = pg.evaluate(INIT)
            if rules is not None: pg.evaluate('r => r.forEach((x,i)=>{window.__rules[i].inn=x.inn;window.__rules[i].out=x.out})', rules)
            pg.evaluate(SCAN)
            for _ in range(5):
                if pg.evaluate("document.querySelectorAll('.summon-zone > .unit').length"): break
                pg.evaluate("(()=>{mana=10;const c=[...document.querySelectorAll('.hand .summon-card')].find(c=>!c.classList.contains('spell-card')&&!c.classList.contains('trap-card'));if(c)playCard(c)})()"); pg.wait_for_timeout(2500)
            # 효과는 띄운 직후(제거 전)에 센다
            for name, sel, anchor, code in a.CASES:
                try: pg.evaluate("([s,c])=>{const t=document.querySelector(s);if(t)(new Function('t',c))(t)}", [sel, code]); pg.evaluate(SCAN)
                except Exception: pass
            from extra_states import EXTRA_STATES
            for name, setup in o.STATES + EXTRA_STATES:
                try: pg.evaluate('c=>{(new Function(c))();}', setup); pg.wait_for_timeout(60); pg.evaluate(SCAN)
                except Exception as e: print('상태 실패', w, name)
            rules = pg.evaluate('window.__rules')
            pg.close()
        br.close()
    out = os.path.join(HERE, 'rule-sides.json')
    json.dump([{'i': i, 'sel': r['sel'], 'in': r['inn'], 'out': r['out'], **({'bad': 1} if r.get('bad') else {})} for i, r in enumerate(rules)], open(out, 'w'), ensure_ascii=False, indent=0)
    cnt = lambda f: sum(1 for r in rules if f(r))
    print(f"규칙 {len(rules)}개: 안만 {cnt(lambda r: r['inn'] and not r['out'])}, 밖만 {cnt(lambda r: r['out'] and not r['inn'])}, 양쪽 {cnt(lambda r: r['inn'] and r['out'])}, 안 맞음 {cnt(lambda r: not r['inn'] and not r['out'])}, 선택자 오류 {cnt(lambda r: r.get('bad'))}")
    print('저장:', out)

if __name__ == '__main__':
    main()
