#!/usr/bin/env python3
"""0.9 축소(zoom) 안/밖 클래스 판정: 첫 화면, 효과 10종, 화면 상태 54개를 띄우며 클래스별로 축소 안·밖에서 몇 번 나왔는지 센다.
결과 zoom-classes.json, 요약 outside-zoom.txt. 저장소 루트에서 실행. docs/plan-ui-scale-1.md 2-1."""

import sys,os,json,importlib.util
sys.path.insert(0,'12_tools/qa')
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright
spec=importlib.util.spec_from_file_location('o','12_tools/qa/check-text-overflow.py');o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
spec=importlib.util.spec_from_file_location('a','12_tools/qa/check-effect-alignment.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
SCAN=r"""()=>{const zoomed=e=>!!e.closest('main.app,#collection-modal,#result,#tier-modal');const res={};
document.body.querySelectorAll('*').forEach(e=>{if(typeof e.className!=='string')return;e.className.split(/\s+/).filter(Boolean).forEach(c=>{const k=zoomed(e)?'in':'out';res[c]=res[c]||{in:0,out:0};res[c][k]++;})});
const top=[...document.body.children].map(e=>({tag:e.tagName.toLowerCase(),id:e.id,cls:typeof e.className==='string'?e.className:'',zoom:getComputedStyle(e).zoom}));return {res,top}}"""
agg={};tops={}
def merge(r):
    for c,v in r['res'].items():
        x=agg.setdefault(c,{'in':0,'out':0});x['in']+=v['in'];x['out']+=v['out']
    for t in r['top']: tops[(t['tag'],t['id'],t['cls'][:40])]=t['zoom']
with serve_own_tree() as base, sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1366,'height':768});pg.goto(base+'/index.html'+a.QUERY);pg.wait_for_timeout(2500)
    merge(pg.evaluate(SCAN))
    # 효과를 띄운 순간의 요소를 잡는다
    pg.evaluate("window.__seen={};new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;[n,...n.querySelectorAll('*')].forEach(e=>{if(typeof e.className!=='string')return;const z=!!e.closest('main.app,#collection-modal,#result,#tier-modal');e.className.split(/\\s+/).filter(Boolean).forEach(c=>{const k=c+(z?'|in':'|out');window.__seen[k]=(window.__seen[k]||0)+1})})}))).observe(document.body,{childList:true,subtree:true})")
    for _ in range(5):
        if pg.evaluate("document.querySelectorAll('.summon-zone > .unit').length"): break
        pg.evaluate("(()=>{mana=10;const c=[...document.querySelectorAll('.hand .summon-card')].find(c=>!c.classList.contains('spell-card')&&!c.classList.contains('trap-card'));if(c)playCard(c)})()");pg.wait_for_timeout(2500)
    for name,sel,anchor,code in a.CASES:
        try: pg.evaluate("([s,c])=>{const t=document.querySelector(s);if(t)(new Function('t',c))(t)}",[sel,code])
        except Exception as e: pass
    pg.wait_for_timeout(300)
    for name,setup in o.STATES:
        try: pg.evaluate(setup); pg.wait_for_timeout(120); merge(pg.evaluate(SCAN))
        except Exception as e: print('state fail',name)
    seen=pg.evaluate('window.__seen')
    for k,v in seen.items():
        c,z=k.split('|');x=agg.setdefault(c,{'in':0,'out':0});x[z]+=v
    b.close()
json.dump({'classes':agg,'top':[list(k)+[v] for k,v in tops.items()]},open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'zoom-classes.json'),'w'),ensure_ascii=False,indent=0)
print('classes',len(agg),'out-only',sum(1 for v in agg.values() if v['in']==0),'in-only',sum(1 for v in agg.values() if v['out']==0),'both',sum(1 for v in agg.values() if v['in'] and v['out']))
print('body children:');[print('  ',k,v) for k,v in tops.items()]
