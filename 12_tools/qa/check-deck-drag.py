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
        t = toast(); check('덱 줄을 보유 카드 영역에 놓으면 1장 빠지고(아직 저장 전) 안내한다', n() == [59, 60] and t and t[0] == 'remove', (n(), t))
        cand = pg.evaluate("()=>{const c=[...document.querySelectorAll('.owned-card[data-index]')].find(c=>{const i=Number(c.dataset.index);return countInDraft(i)<Math.min(DECK_COPY_LIMIT,collectionState.owned[i])&&canAddAuraToDeck(draftDeck,i)});return c?c.dataset.index:null}")
        drag(pg.locator('.owned-card[data-index="%s"]' % cand), pg.locator('.deck-list'))
        t = toast(); check('보유 카드를 덱 목록에 놓으면 1장 들어가고(아직 저장 전) 덱 줄이 생긴다', n() == [60, 60] and t and t[0] == 'add' and pg.evaluate("i=>!!document.querySelector('#deck-rows .deck-row[data-index=\"'+i+'\"]')", cand), (n(), t))
        drag(pg.locator('.deck-row.slim').nth(1), pg.locator('.deck-row.slim').nth(4))
        check('덱 줄을 덱 목록 안에 놓으면 변화가 없다', n() == [60, 60], n())
        drag(pg.locator('.owned-card[data-index]').nth(0), pg.locator('.owned-card[data-index]').nth(5))
        check('보유 카드를 보유 영역에 놓으면 변화가 없다', n() == [60, 60], n())
        dirty = lambda: pg.evaluate("()=>deckDraftDiff()")
        check('넣고 빼면 저장 버튼이 활성화된다', dirty()['dirty'] and not pg.locator('.deck-save-now').is_disabled(), dirty())
        pg.click('.deck-aura-back'); pg.wait_for_timeout(250)
        check('저장하지 않고 오라 선택으로 나가려 하면 확인 창이 뜬다', pg.locator('.deck-confirm').count() == 1 and pg.evaluate("()=>deckAuraStep") == 'edit')
        pg.click('.deck-confirm-actions button:has-text("계속 편집")'); pg.wait_for_timeout(200)
        pg.click('.deck-save-now'); pg.wait_for_timeout(250)
        check('덱 저장하기를 누르면 확인 창이 뜬다', pg.locator('.deck-confirm').count() == 1)
        pg.click('.deck-confirm-actions button.primary'); pg.wait_for_timeout(300)
        saved = pg.evaluate("()=>JSON.stringify([...draftDeck].sort())===JSON.stringify(draftOfDeck(editingDeck).sort())")
        t = None
        for _ in range(20):
            t = pg.evaluate("()=>{const t=document.querySelector('.deck-toast');return t?[t.dataset.kind,t.textContent]:null}")
            if t and '저장' in t[1]: break
            pg.wait_for_timeout(100)
        check('저장하면 저장된 덱이 편집 내용과 같아지고 저장 안내가 나온다', saved and t and '저장' in t[1] and pg.locator('.deck-save-now.saved').count() == 1, (saved, t))
        pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("()=>{openCollection('deck');pickAuraDeck(0);}"); pg.wait_for_timeout(500)
        check('새로고침해도 저장한 덱이 남는다', pg.evaluate("()=>draftDeck.length") == 60)
        pg.locator('.deck-row.slim').nth(0).drag_to(pg.locator('#owned-grid'), force=True); pg.wait_for_timeout(250)
        pg.click('.deck-aura-back'); pg.wait_for_timeout(250); pg.click('.deck-confirm-actions button:has-text("저장 안 함")'); pg.wait_for_timeout(300)
        check('저장 안 함을 고르면 편집 내용을 버리고 나간다', pg.evaluate("()=>deckAuraStep") == 'pick' and pg.evaluate("()=>draftOfDeck(0).length") == 60)
        bad = []
        for view in ['codex', 'secret', 'synth', 'enhance', 'gacha']:
            pg.evaluate("()=>{openCollection('deck');pickAuraDeck(1);}"); pg.wait_for_timeout(250)
            pg.click('.collection-tab[data-view="%s"]' % view); pg.wait_for_timeout(250)
            vis = pg.evaluate("()=>[...document.querySelectorAll('.collection-view')].filter(v=>getComputedStyle(v).display!=='none').map(v=>v.id)")
            if vis != [view + '-view']: bad.append((view, vis))
        check('덱 편집 중 다른 탭으로 옮기면 그 탭 화면 하나만 보인다(덱 편집이 아래에 남지 않는다)', not bad, bad)
        check('끌기 표시가 남지 않는다', pg.evaluate("()=>document.querySelectorAll('#deck-view .dragging,.drag-over,.drag-denied').length") == 0)
        check('콘솔 오류가 없다', not errs, errs[:2])
        b.close()
    if fails:
        print('FAIL: %d건' % len(fails)); sys.exit(1)
    print('OK: 덱 편집 드래그 양방향과 피드백 확인')

if __name__ == '__main__':
    main()
