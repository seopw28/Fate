#!/usr/bin/env python3
"""재화 사용처 변경과 상점 꾸미기(2026-11-08 PM 결정)를 실제 브라우저에서 확인한다.

- 카드 뽑기는 크래커로만(쿠키조각 뽑기 버튼 없음)
- 쿠키조각은 강화·합성 1회 시도, 시크릿 블록 열기에만 쓰고, 부족하면 시도를 막는다
- 꾸미기: 크래커로 구매·적용, 저장, 전장 배경·카드 뒷면 반영, 컴퓨터는 판마다 자기 뒷면
- 저장 v10 -> v11 마이그레이션에서 덱·쿠키조각 잔액 보존

11_qa/regression/cosmetics-economy.test.js 가 번들 문자열로 구조를 고정하고, 동작은 여기서 확인한다.
실행: npm run build && npm run qa:cosmetics
"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

Q = "/index.html?skipIntro&difficulty=normal&guardian=jujak&seed=777"
READY = "typeof battlePhase!=='undefined'&&battlePhase==='setup'"

CHECKS = [
 # (이름, 쿼리 추가, 스크립트)
 ("카드 뽑기는 크래커로만: 쿠키조각 뽑기 버튼이 없고 뽑기가 쿠키조각을 쓰지 않는다", "&crackers=5000&cookies=777",
  "(async()=>{openCollection('gacha');const cookieBtn=document.querySelectorAll('.cookie-pull,[data-currency=\"cookie\"]').length,"
  "text=document.querySelector('#gacha-view').textContent,b4=collectionState.crackers,c4=collectionState.cookieFragments;pullCards(1);await new Promise(r=>setTimeout(r,2200));"
  "return {ok:cookieBtn===0&&!text.includes('보상 뽑기')&&collectionState.crackers===b4-200&&collectionState.cookieFragments===c4&&pullCards.length===1,cookieBtn,spent:b4-collectionState.crackers,cookie:collectionState.cookieFragments};})()"),

 ("꾸미기: 크래커로 구매하고 적용하면 보유·적용이 저장되고 전장 배경과 내 덱 더미 뒷면이 바뀐다", "&crackers=2600",
  "(()=>{openCollection('gacha');switchShopTab('cosmetic');setCosmeticSlot('field');const arena=document.querySelector('.arena'),before=arena.dataset.fieldSkin||'';"
  "const bought=buySkin('field.fire'),afterBuy=arena.dataset.fieldSkin||'',cr1=collectionState.crackers;const applied=applySkin('field.fire');"
  "setCosmeticSlot('back');buySkin('back.water');applySkin('back.water');const pile=document.querySelector('#deck-stack .pile-back'),saved=JSON.parse(localStorage.getItem('primal-collection-v1'));"
  "return {ok:bought&&before===''&&afterBuy===''&&cr1===1100&&applied&&arena.dataset.fieldSkin==='fire'&&pile.dataset.skin==='water'&&collectionState.crackers===100"
  "&&saved.skins.applied.field==='field.fire'&&saved.skins.applied.back==='back.water'&&saved.skins.owned.includes('field.fire')&&saved.skins.owned.includes('back.water'),before,afterBuy,cr1,field:arena.dataset.fieldSkin,pile:pile.dataset.skin,left:collectionState.crackers};})()"),

 ("꾸미기: 크래커가 부족하면 구매가 막히고 잔액·보유가 그대로다(버튼도 비활성)", "&crackers=900",
  "(()=>{openCollection('gacha');switchShopTab('cosmetic');setCosmeticSlot('back');const btn=document.querySelector('[data-skin-id=\"back.fire\"] .skin-btn'),ok1=buySkin('back.fire');"
  "const note=document.querySelector('#skin-notice').textContent;setCosmeticSlot('field');const ok2=buySkin('field.earth');"
  "return {ok:!ok1&&!ok2&&btn.disabled&&btn.textContent.includes('부족')&&collectionState.crackers===900&&!collectionState.skins.owned.includes('back.fire')&&!collectionState.skins.owned.includes('field.earth')&&note.includes('부족'),btn:btn.textContent,note,cr:collectionState.crackers};})()"),

 ("꾸미기: 보유하지 않은 스킨은 적용할 수 없고, 기본 스킨은 처음부터 보유·적용 상태다", "",
  "(()=>{const s=collectionState.skins,before=JSON.stringify(s.applied),r=applySkin('back.fire');"
  "return {ok:!r&&before===JSON.stringify({back:'back.default',field:'field.default'})&&s.owned.includes('back.default')&&s.owned.includes('field.default')&&s.owned.length===2&&SKINS.length===12&&SKINS.filter(k=>k.slot==='back'&&k.price===1000).length===5&&SKINS.filter(k=>k.slot==='field'&&k.price===1500).length===5,before,r};})()"),

 ("컴퓨터 상대는 보유 여부와 무관한 자기 뒷면을 상대 손패·덱 더미에 쓴다(내 스킨과 별개)", "&enemySkin=earth",
  "(()=>{const piles=[...document.querySelectorAll('#enemy-piles .pile-back')],hand=document.querySelectorAll('#enemy-piles .pile-hand .pile-back').length,deckPile=document.querySelectorAll('#enemy-piles .pile-deck .pile-back').length,mine=document.querySelector('#deck-stack .pile-back');"
  "return {ok:piles.length>0&&piles.every(p=>p.dataset.skin==='earth')&&hand===enemyHand.length&&deckPile===1&&!mine.dataset.skin&&!collectionState.skins.owned.includes('back.earth'),n:piles.length,hand,deckPile,mine:mine.dataset.skin||''};})()"),

 ("카드 뽑기 연출의 뒤집히기 전 카드와 드로우 뒷면에도 적용한 뒷면이 쓰인다", "&crackers=5000",
  "(()=>{buySkin('back.metal');applySkin('back.metal');const flight=document.createElement('div');decorateCardBack(flight,'fire');const reveal=showCharacterAppeal(collectionCards.findIndex((_,i)=>!collectionIsSpell[i]),'T');const back=reveal.querySelector('.gacha-card-back');const r={flight:flight.dataset.skin,gacha:back.dataset.skin,hasEmblem:!!back.querySelector('.back-emblem')};reveal.remove();"
  "return {ok:r.flight==='metal'&&r.gacha==='metal'&&r.hasEmblem,...r};})()"),

 ("강화: 1회 시도마다 쿠키조각 10개를 쓰고(성공·실패 모두), 부족하면 시도를 막고 필요 수량을 알린다", "&cookies=25",
  "(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),i=collectionIsSpell.findIndex(v=>!v);collectionState.owned[i]=Math.max(9,collectionState.owned[i]);openCollection('enhance');setEnhanceLevel(0);selectEnhancement(i);"
  "const c0=collectionState.cookieFragments;runEnhancement();const c1=collectionState.cookieFragments;await wait(6000);document.querySelector('.enh-stage')?.remove();runEnhancement();const c2=collectionState.cookieFragments;await wait(6000);document.querySelector('.enh-stage')?.remove();"
  "renderEnhancement();const blocked=document.querySelector('#enhance-go'),note=document.querySelector('#enhance-cost').textContent,ownedBefore=collectionState.owned[i];runEnhancement();const stage=!!document.querySelector('.enh-stage');"
  "return {ok:COOKIE_COST.enhance===10&&c0===25&&c1===15&&c2===5&&collectionState.cookieFragments===5&&blocked.disabled&&note.includes('5개 부족')&&collectionState.owned[i]===ownedBefore&&!stage,c0,c1,c2,now:collectionState.cookieFragments,dis:blocked.disabled,note,stage};})()"),

 ("합성: 1회 시도마다 쿠키조각 10개를 쓰고, 부족하면 시도를 막고 재료도 그대로다", "&cookies=15",
  "(()=>{const spare=collectionCards.map((_,k)=>k).filter(k=>collectionState.owned[k]>=3).slice(0,2);spare.forEach(k=>collectionState.owned[k]=Math.max(collectionState.owned[k],4));"
  "openCollection('synth');synthSlots=[spare[0],spare[1]];renderSynthesis();const c0=collectionState.cookieFragments,sum0=collectionState.owned.reduce((a,b)=>a+b,0);runSynthesis();const c1=collectionState.cookieFragments;"
  "synthBusy=false;synthLast=null;synthSlots=[spare[0],spare[1]];renderSynthesis();const go=document.querySelector('#synth-go'),note=document.querySelector('#synth-cost').textContent,own=[...collectionState.owned];runSynthesis();"
  "return {ok:COOKIE_COST.synth===10&&c0===15&&c1===5&&go.disabled&&note.includes('5개 부족')&&collectionState.cookieFragments===5&&JSON.stringify(own)===JSON.stringify(collectionState.owned)&&synthSlots.length===2,c0,c1,now:collectionState.cookieFragments,dis:go.disabled,note};})()"),

 ("시크릿 블록: 조건을 채우면 '열 수 있음'이고, 쿠키조각이 부족하면 열리지 않으며, 50개를 내면 열린다", "&secretReset&secretReady=2&cookies=49",
  "(()=>{openCollection('secret');const root=document.querySelector('#secret-grid');const ready=root.querySelectorAll('.secret-block.ready').length,badge=root.querySelector('.secret-ready-badge')?.textContent,"
  "btn=root.querySelector('.secret-open'),id=btn.dataset.card,disabledShort=btn.disabled,label=btn.textContent;const failed=openSecretBlock(id);const cAfterFail=collectionState.cookieFragments,stillReady=!!document.querySelector('.secret-open[data-card=\"'+id+'\"]');"
  "collectionState.cookieFragments=120;renderSecretBlocks();const opened=openSecretBlock(id),left=collectionState.cookieFragments;const art=document.querySelector('.secret-block.unlocked'),go=art?.querySelector('.secret-go');const saved=JSON.parse(localStorage.getItem('fate-secret-blocks-v1'));"
  "return {ok:ready===2&&badge==='열 수 있음'&&disabledShort&&label.includes('부족')&&!failed&&cAfterFail===49&&stillReady&&opened&&left===70&&!!go&&!go.disabled&&!!saved.unlocked[id]&&!saved.ready[id]&&COOKIE_COST.secret===50,ready,badge,label,cAfterFail,left};})()"),

 ("시크릿 블록: 승리 정산은 바로 열지 않고 '열 수 있음' 상태로만 바꾼다(쿠키조각도 쓰지 않음)", "&secretReset&cookies=80",
  "(()=>{const def=collectionCardDefs.find(d=>d.cardType==='champion'&&d.rarity==='legendary'),unit=document.createElement('div');unit.className='unit';document.querySelector('.summon-zone').appendChild(unit);"
  "try{showAvengerArrival({name:'테스트 복수자'},{art:'assets/'+def.assetId},unit);}catch(e){}finish(true,'테스트 승리');"
  "const saved=JSON.parse(localStorage.getItem('fate-secret-blocks-v1')||'{}');return {ok:!!saved.ready?.[def.cardId]&&!saved.unlocked?.[def.cardId]&&collectionState.cookieFragments===80+VICTORY_COOKIE_REWARD,saved,cookie:collectionState.cookieFragments};})()"),
]


def run_migration(br, base):
    """v10 저장(스킨 없음)을 열면 v11 로 올라가도 덱·쿠키조각 잔액·카드 보유가 그대로이고 스킨은 기본이다."""
    ctx = br.new_context(viewport={"width": 1366, "height": 768}); pg = ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(base + Q); pg.wait_for_function(READY, timeout=15000)
    pg.evaluate("""()=>{const raw=JSON.parse(localStorage.getItem('primal-collection-v1'));raw.version=10;delete raw.skins;raw.cookieFragments=61234;raw.crackers=4321;
      raw.decks=[{name:'내 커스텀 덱',ids:raw.decks[0].ids.slice()},{name:'두번째',ids:raw.decks[0].ids.slice(0,30)}];raw.activeDeck=1;
      localStorage.setItem('primal-collection-v1',JSON.stringify(raw));window.__before=JSON.stringify({deck:raw.deck,decks:raw.decks,owned:raw.owned});}""")
    snapshot = pg.evaluate("window.__before")
    pg.goto(base + Q); pg.wait_for_function(READY, timeout=15000)
    res = pg.evaluate("""()=>{const raw=JSON.parse(localStorage.getItem('primal-collection-v1'));
      return {version:raw.version,cookie:collectionState.cookieFragments,crackers:collectionState.crackers,skins:raw.skins,names:raw.decks.map(d=>d.name),active:raw.activeDeck,
              now:JSON.stringify({deck:raw.deck,decks:raw.decks,owned:raw.owned})};}""")
    ok = (res["version"] == 11 and res["cookie"] == 61234 and res["crackers"] >= 4321 and res["names"] == ['내 커스텀 덱', '두번째'] and res["active"] == 1
          and res["skins"] == {"owned": ["back.default", "field.default"], "applied": {"back": "back.default", "field": "field.default"}}
          and [{"name": d["name"], "ids": d["ids"]} for d in json.loads(res["now"])["decks"]] == [{"name": d["name"], "ids": d["ids"]} for d in json.loads(snapshot)["decks"]]
          and len({d.get("aura") for d in json.loads(res["now"])["decks"]} - {None}) == len(json.loads(res["now"])["decks"])  # 2026-11-09: 덱마다 서로 다른 오라가 붙는다
          and json.loads(res["now"])["owned"] == json.loads(snapshot)["owned"] and not errors)
    detail = {k: res[k] for k in ("version", "cookie", "crackers", "skins", "names", "active")}
    ctx.close()
    return ok, {**detail, "errors": errors[:2]}


def run_persistence(br, base):
    """구매·적용한 스킨은 새로고침 뒤에도 보유·적용 상태로 남고 화면에 반영된다."""
    ctx = br.new_context(viewport={"width": 1366, "height": 768}); pg = ctx.new_page()
    pg.goto(base + Q + "&crackers=3000"); pg.wait_for_function(READY, timeout=15000)
    pg.evaluate("()=>{buySkin('field.wood');applySkin('field.wood');buySkin('back.wood');applySkin('back.wood');}")
    pg.goto(base + Q); pg.wait_for_function(READY, timeout=15000)
    res = pg.evaluate("()=>({field:document.querySelector('.arena').dataset.fieldSkin,back:document.querySelector('#deck-stack .pile-back').dataset.skin,owned:collectionState.skins.owned,version:JSON.parse(localStorage.getItem('primal-collection-v1')).version})")
    ok = res["field"] == "wood" and res["back"] == "wood" and "field.wood" in res["owned"] and "back.wood" in res["owned"] and res["version"] == 11
    ctx.close()
    return ok, res


def run_enemy_random(br, base):
    """컴퓨터 뒷면은 판마다(페이지를 새로 열 때마다) 무작위로 골라진다. 보유 여부와 무관하다."""
    ctx = br.new_context(viewport={"width": 1366, "height": 768}); pg = ctx.new_page(); seen = set()
    for _ in range(14):
        pg.goto(base + Q); pg.wait_for_function(READY, timeout=15000)
        seen.add(pg.evaluate("ENEMY_BACK_SKIN.id"))
    ctx.close()
    return len(seen) >= 2, sorted(seen)


def main():
    fails = 0
    with serve_own_tree() as base, sync_playwright() as p:
        br = p.chromium.launch()
        for name, extra, script in CHECKS:
            ctx = br.new_context(viewport={"width": 1366, "height": 768})
            pg = ctx.new_page(); errors = []
            pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            pg.goto(base + Q + extra); pg.wait_for_function(READY, timeout=15000)
            try:
                result = pg.evaluate(script)
            except Exception as e:
                result = {"ok": False, "error": str(e)[:300]}
            if errors:
                result = {**result, "ok": False, "pageErrors": errors[:2]}
            ok = result.pop("ok", False)
            fails += not ok
            print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  {result}"))
            ctx.close()
        for name, fn in (("저장 마이그레이션: v10 저장을 열어도 덱 목록·보유 카드·쿠키조각 잔액이 보존되고 스킨은 기본이다", run_migration),
                         ("저장: 구매·적용한 스킨이 새로고침 뒤에도 유지되고 화면에 반영된다", run_persistence),
                         ("컴퓨터 스킨은 판마다 무작위다(새로 열 때마다 뒷면이 달라질 수 있다)", run_enemy_random)):
            ok, detail = fn(br, base)
            fails += not ok
            print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  {detail}"))
        br.close()
    print("OK: 재화 사용처·꾸미기 확인" if not fails else f"FAIL: {fails}건")
    sys.exit(1 if fails else 0)


main()
