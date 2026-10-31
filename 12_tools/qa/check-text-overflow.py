#!/usr/bin/env python3
"""UI 텍스트 넘침 검사: 글자가 자기 상자(버튼/패널/카드) 밖으로 나가면 실패(exit 1).

사용: python3 12_tools/qa/check-text-overflow.py [url] [--shots]
기본 url: http://localhost:8765/index.html (dist를 http.server로 띄운 상태)
"""
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:8765/index.html?skipIntro&guardian=baekho")
VIEWPORTS = [(1568, 900), (1366, 768), (1100, 800), (1000, 900)]
if "--mobile" in sys.argv:
    VIEWPORTS += [(640, 900), (390, 844)]  # 현재 데스크톱 전용 레이아웃이라 기본에서는 제외

JS = r"""
() => {
  const out = [];
  const isBox = (el) => {
    const s = getComputedStyle(el);
    const bg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none';
    const bd = ['Top','Right','Bottom','Left'].some(k => parseFloat(s['border'+k+'Width']) > 0 && s['border'+k+'Style'] !== 'none');
    return el.tagName === 'BUTTON' || bg || bd || s.overflow !== 'visible';
  };
  const label = (el) => {
    let p = el.tagName.toLowerCase();
    if (el.id) p += '#' + el.id;
    if (el.className && typeof el.className === 'string') p += '.' + el.className.trim().split(/\s+/).join('.');
    return p;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || ['SCRIPT','STYLE'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const t = r.getBoundingClientRect();
    if (!t.width || !t.height) continue;
    let box = el;
    while (box && box !== document.body && !isBox(box)) box = box.parentElement;
    if (!box || box === document.body) continue;
    const b = box.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    // 박스가 화면 밖(스크롤/숨김 영역)이면 건너뜀
    const bs = getComputedStyle(box);
    const clipped = false;
    const over = Math.max(b.left - t.left, t.right - b.right, b.top - t.top, t.bottom - b.bottom);
    if (over > 1.5 || clipped) {
      out.push({ text: n.textContent.trim().slice(0, 30), el: label(el), box: label(box),
                 over: Math.round(over), clipped, textW: Math.round(t.width), boxW: Math.round(b.width) });
    }
  }
  // 문서 가로 스크롤
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ text: '(page)', el: 'html', box: 'viewport', over: document.documentElement.scrollWidth - innerWidth, clipped: false });
  return out;
}
"""

# 문구가 가장 길어지는 상태들을 강제로 만든다 (게임 전역 변수 직접 조작)
STATES = [
    ("초기", "0"),
    ("뽑기 가능", "mana=9; document.querySelectorAll('.hand .card').forEach((c,i)=>{if(i>3)c.remove()}); updateDrawAction()"),
    ("뽑기 5번째", "drawActionsUsed=9; mana=9; updateDrawAction()"),
    ("혈마나 뽑기", "turnNumber=5; drawActionsUsed=3; bloodManaUses=2; mana=0; playerHp=60; updateDrawAction()"),
    ("마나 부족", "drawActionsUsed=4; mana=0; updateDrawAction()"),
    ("필살기 대기", "ultimateState=ultimateSpec(document.querySelector('.hand .card')); ultimateUsed=false; renderFieldUltimateAction()"),
    ("필살기 세팅 모드", "ultimateState=null; ultimateUsed=false; battlePhase='setup'; setHandFilter('champion'); armUltimateSetting()"),
    ("마법 세팅 모드", "battlePhase='setup'; setHandFilter('spell'); armMagicSetting()"),
    ("선공권 배너", "showInitiativeBanner('enemy','체력 동일 · 필드 카드 3 < 6')"),
    ("사운드 패널", "toggleSoundPanel(true)"),
    ("전투 진행 중", "battlePhase='player-combat'; updateDrawAction(); const e=document.querySelector('.end'); if(e) e.textContent='내 챔프 공격 중…'"),
    ("수호신 선택", "playerGuardian=null; openGuardianSelect()"),
]

def main():
    fails = 0
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in VIEWPORTS:
            pg = br.new_page(viewport={"width": w, "height": h})
            pg.goto(URL); pg.wait_for_timeout(1200)
            pg.evaluate("document.fonts.ready")
            for name, setup in STATES:
                try:
                    pg.evaluate(setup)
                except Exception as e:
                    print(f"[{w}x{h}] 상태 '{name}' 준비 실패: {str(e)[:80]}")
                    continue
                pg.wait_for_timeout(150)
                res = pg.evaluate(JS)
                for r in res:
                    fails += 1
                    print(f"[{w}x{h}] {name} 넘침 {r['over']}px  \"{r['text']}\"  ({r['el']} ⊄ {r['box']}, 글자 {r.get('textW')} / 상자 {r.get('boxW')})")
            if "--shots" in sys.argv:
                pg.screenshot(path=f"/tmp/fate-overflow-{w}x{h}.png")
            pg.close()
        br.close()
    print("OK: 넘침 없음" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)

main()
