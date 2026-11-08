#!/usr/bin/env python3
"""화면 기준 사진: check-text-overflow.py 의 화면 상태(STATES)마다, 화면 크기 4종으로 사진을 찍는다.

사용: python3 -I 12_tools/qa/capture-baseline.py [출력 폴더, 기본 /tmp/fate-baseline]
화면 배율 작업(docs/plan-ui-scale-1.md) 전후 비교용. 같은 화면이 나오도록 시드를 고정하고 애니메이션을 끈다.
"""
import os, sys, time, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

spec = importlib.util.spec_from_file_location('overflow', os.path.join(HERE, 'check-text-overflow.py'))
overflow = importlib.util.module_from_spec(spec); spec.loader.exec_module(overflow)
STATES = overflow.STATES
VIEWPORTS = [(1568, 900), (1366, 768), (1100, 800), (1000, 900)]
OUT = next((a for a in sys.argv[1:] if not a.startswith('-')), '/tmp/fate-baseline')
QUERY = '?skipIntro&guardian=baekho&difficulty=normal&seed=ui-scale-baseline'
# 반복 애니메이션(체력바 반짝임 등)이 찍는 순간마다 달라 같은 화면도 최대 1% 달라졌다. 찍기 전에 모두 끈다.
STILL = "(()=>{if(!document.getElementById('qa-still')){const s=document.createElement('style');s.id='qa-still';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(s)}})()"
FREEZE = "document.querySelectorAll('*').forEach(e=>e.getAnimations&&e.getAnimations().forEach(a=>{try{a.finish()}catch(_){a.cancel()}}))"

def main():
    start = time.time(); shots = 0; fails = []
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in VIEWPORTS:
            d = os.path.join(OUT, f'{w}x{h}'); os.makedirs(d, exist_ok=True)
            ctx = br.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce')
            pg = ctx.new_page(); pg.goto(base + '/index.html' + QUERY); pg.wait_for_timeout(2500)
            pg.evaluate('document.fonts.ready')
            for i, (name, setup) in enumerate(STATES):
                try:
                    pg.evaluate(setup)
                except Exception as e:
                    fails.append(f'{w}x{h} {name}: {str(e)[:80]}'); continue
                pg.wait_for_timeout(250); pg.evaluate(FREEZE); pg.evaluate(STILL); pg.wait_for_timeout(30)
                safe = ''.join(c if c.isalnum() else '_' for c in name)[:40]
                pg.screenshot(path=os.path.join(d, f'{i:02d}-{safe}.png')); shots += 1
            ctx.close()
        br.close()
    print(f'사진 {shots}장 → {OUT} ({time.time()-start:.0f}초), 상태 준비 실패 {len(fails)}건')
    for f in fails: print('  실패:', f)

if __name__ == '__main__':
    main()
