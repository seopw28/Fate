#!/usr/bin/env python3
"""덱 편집 드래그 양방향과 넣기·빼기 피드백을 실제 브라우저 끌어다 놓기로 확인한다 (2026-11-09 PM).
실행: npm run build && python3 12_tools/qa/check-deck-drag.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

def main():
    fails = []
    def check(name, ok, detail=''):
        print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else '  ' + str(detail)))
        if not ok: fails.append(name)
    with serve_own_tree() as base, sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1568, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(base + '/index.html?seed=777'); pg.wait_for_timeout(1500)
        pg.evaluate("()=>{openCollection('deck');pickAuraDeck(0);}"); pg.wait_for_timeout(600)
        n = lambda: pg.evaluate("()=>[draftDeck.length,collectionState.decks[editingDeck].ids.length]")
        toast = lambda: pg.evaluate("()=>{const t=document.querySelector('.deck-toast');return t&&t.classList.contains('show')?[t.dataset.kind,t.textContent]:null}")
        drag = lambda src, dst: (src.drag_to(dst, force=True), pg.wait_for_timeout(250))
        drag(pg.locator('.owned-card[data-index]').nth(2), pg.locator('.deck-list'))
        t = toast(); check('덱이 60장이면 끌어 놓아도 들어가지 않고 이유를 안내한다', n() == [60, 60] and t and t[0] == 'deny' and '가득' in t[1], (n(), t))
        drag(pg.locator('.deck-row.slim').nth(1), pg.locator('#owned-grid'))
        t = toast(); check('덱 줄을 보유 카드 영역에 놓으면 1장 빠지고 저장되며 안내한다', n() == [59, 59] and t and t[0] == 'remove', (n(), t))
        cand = pg.evaluate("()=>{const c=[...document.querySelectorAll('.owned-card[data-index]')].find(c=>{const i=Number(c.dataset.index);return countInDraft(i)<Math.min(DECK_COPY_LIMIT,collectionState.owned[i])&&canAddAuraToDeck(draftDeck,i)});return c?c.dataset.index:null}")
        drag(pg.locator('.owned-card[data-index="%s"]' % cand), pg.locator('.deck-list'))
        t = toast(); check('보유 카드를 덱 목록에 놓으면 1장 들어가고 저장되며 덱 줄이 +1로 번쩍인다', n() == [60, 60] and t and t[0] == 'add' and pg.evaluate("i=>!!document.querySelector('#deck-rows .deck-row[data-index=\"'+i+'\"]')", cand), (n(), t))
        drag(pg.locator('.deck-row.slim').nth(1), pg.locator('.deck-row.slim').nth(4))
        check('덱 줄을 덱 목록 안에 놓으면 변화가 없다', n() == [60, 60], n())
        drag(pg.locator('.owned-card[data-index]').nth(0), pg.locator('.owned-card[data-index]').nth(5))
        check('보유 카드를 보유 영역에 놓으면 변화가 없다', n() == [60, 60], n())
        check('끌기 표시가 남지 않는다', pg.evaluate("()=>document.querySelectorAll('#deck-view .dragging,.drag-over,.drag-denied').length") == 0)
        check('콘솔 오류가 없다', not errs, errs[:2])
        b.close()
    if fails:
        print('FAIL: %d건' % len(fails)); sys.exit(1)
    print('OK: 덱 편집 드래그 양방향과 피드백 확인')

if __name__ == '__main__':
    main()
