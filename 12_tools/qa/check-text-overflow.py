#!/usr/bin/env python3
"""UI 텍스트 넘침 검사: 글자가 자기 상자(버튼/패널/카드) 밖으로 나가면 실패(exit 1).

사용: python3 12_tools/qa/check-text-overflow.py [url] [--shots]
url 을 주지 않으면 이 저장소의 dist/ 를 빈 포트에 직접 띄워 검사한다.

예전에는 기본값이 http://localhost:8765 고정이었다. 여러 세션이 같은 저장소의
다른 워크트리에서 작업하는 환경에서는 그 포트를 '남의 트리'가 점유하고 있을 수
있고, 그러면 내 변경과 무관한 번들을 검사하고 통과시킨다 (2026-11-07 실제 사고).
이제 기본 경로에서는 내 dist 를 내가 띄우고, 응답하는 트리가 내 것인지 확인한다.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve_own_tree import serve_own_tree
from playwright.sync_api import sync_playwright

ARG_URL = next((a for a in sys.argv[1:] if a.startswith("http")), None)
QUERY = "?skipIntro&difficulty=normal&guardian=baekho"
URL = ARG_URL or None
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
    // 스크롤 가능한 박스는 스크롤 방향의 '아래/옆에 가려진 내용'을 넘침으로 세지 않는다
    const scrollY = ['auto','scroll'].includes(bs.overflowY), scrollX = ['auto','scroll'].includes(bs.overflowX);
    const over = Math.max(scrollX ? -1e9 : Math.max(b.left - t.left, t.right - b.right), scrollY ? -1e9 : Math.max(b.top - t.top, t.bottom - b.bottom), -1);
    if (over > 1.5 || clipped) {
      out.push({ text: n.textContent.trim().slice(0, 30), el: label(el), box: label(box),
                 over: Math.round(over), clipped, textW: Math.round(t.width), boxW: Math.round(b.width) });
    }
  }
  // 줄바꿈 이상 (2026-11-08): 넘치지는 않아도 보기 나쁜 줄바꿈을 잡는다.
  //  - 단어 중간 끊김: 줄이 바뀌는 자리의 앞뒤 글자가 모두 공백이 아님 (예: "있습니" / "다", "튜토" / "리얼")
  //    한국어는 word-break:keep-all 이 없으면 음절 단위로 끊긴다.
  //  - 짧은 문구 접힘: 공백 제외 6자 이하의 짧은 라벨·숫자가 두 줄로 접힘 (예: "재료 0 /" / "9")
  // 의도적으로 여러 줄을 허용하는 곳은 data-wrap-ok 속성(조상 포함)으로 제외한다.
  const isWordChar = (ch) => /[0-9A-Za-z가-힣%]/.test(ch);
  const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let w;
  while ((w = walker2.nextNode())) {
    const text = w.textContent; const compact = text.replace(/\s+/g, '');
    if (compact.length < 2) continue;
    const el = w.parentElement;
    if (!el || ['SCRIPT','STYLE'].includes(el.tagName) || el.closest('[data-wrap-ok]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = document.createRange(); r.selectNodeContents(w);
    const tb = r.getBoundingClientRect();
    if (!tb.width || !tb.height || tb.bottom < 0 || tb.top > innerHeight || tb.right < 0 || tb.left > innerWidth) continue;
    const rects = [...r.getClientRects()].filter(x => x.width >= 1 && x.height >= 1);
    if (rects.length < 2 || Math.max(...rects.map(x => x.top)) - Math.min(...rects.map(x => x.top)) < rects[0].height * 0.5) continue;
    // 글자마다 줄(top)을 구해 줄이 바뀌는 자리를 찾는다
    let prevTop = null, prevCh = '', lines = 1, broken = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) { prevCh = ch; continue; }
      const cr = document.createRange(); cr.setStart(w, i); cr.setEnd(w, i + 1);
      const rc = [...cr.getClientRects()].find(x => x.width >= 1);
      if (!rc) continue;
      if (prevTop !== null && rc.top - prevTop >= rc.height * 0.5) {
        lines++;
        if (!broken && isWordChar(prevCh) && isWordChar(ch)) broken = text.slice(Math.max(0, i - 4), i).trim() + ' / ' + text.slice(i, i + 4).trim();
      }
      prevTop = rc.top; prevCh = ch;
    }
    if (lines < 2) continue;
    let kind = null;
    if (el.textContent.replace(/\s+/g, '').length <= 6) kind = '짧은 문구 접힘';  // 텍스트 조각이 아니라 요소 전체 문구 기준
    else if (broken) kind = '단어 중간 끊김 "' + broken + '"';
    if (kind) out.push({ wrap: true, kind, text: compact.slice(0, 30), el: label(el), lines });
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
    ("궁극기 대기", "ultimateState=ultimateSpec(document.querySelector('.hand .card')); ultimateUsed=false; renderFieldUltimateAction()"),
    ("궁극기 세팅 잠금(오라 각성 전)", "awakenGateOpened.player=false;playerHp=100;ultimateState=null;ultimateUsed=false;battlePhase='setup';renderUltimate();renderFieldUltimateAction()"),
    ("궁극기 세팅 잠금(소진자 생존 중)", "awakenGateOpened.player=true;ultimateState=null;ultimateUsed=false;battlePhase='setup';ultimateLedger.player.spent={unit:document.querySelector('.summon-zone .unit')||document.body};ultimateLedger.player.pending=[];renderUltimate();renderFieldUltimateAction()"),
    ("궁극기 세팅 잠금(복수자 강림까지 2턴)", "awakenGateOpened.player=true;ultimateState=null;ultimateUsed=false;battlePhase='setup';ultimateLedger.player.spent=null;ultimateLedger.player.pending=[{rec:{name:'x'},due:ultimateLedger.player.turns+2}];renderUltimate();renderFieldUltimateAction()"),
    ("궁극기 오라 공명 대기(최대 마나 10)", "awakenGateOpened.player=true;ultimateLedger.player.spent=null;ultimateLedger.player.pending=[];maxMana=10;mana=10;playerGuardian='jujak';ultimateState=ultimateSpec(createRuntimeBattleCard(collectionCardDefs.find(d=>d.cardType==='champion'&&d.aura==='fire').cardId));ultimateUsed=false;battlePhase='setup';renderUltimate();renderFieldUltimateAction()"),
    ("궁극기 소진자 사망", "const u=document.querySelector('.summon-zone .unit');if(u){u.dataset.ultimateSpent='true';u.dataset.art=u.querySelector('img')?.src||'';showUltimateSpentDeath(u)}"),
    ("복수자 강림", "const u=document.querySelector('.summon-zone .unit'),p={name:'복수자 세리나',art:u?.dataset.art||u?.querySelector('img')?.src||'',el:'fire'};if(u){showAvengerArrival(p,{name:'궁극기 사용자'},u)}"),
    ("궁극기 세팅 모드", "awakenGateOpened.player=true;ultimateLedger.player.spent=null;ultimateLedger.player.pending=[];ultimateState=null; ultimateUsed=false; battlePhase='setup'; setHandFilter('champion'); armUltimateSetting()"),
    ("마법 세팅 모드", "battlePhase='setup'; setHandFilter('spell'); armMagicSetting()"),
    ("함정 칸 가득(대재앙 대기)", "setMagicCards.splice(0,setMagicCards.length,{slot:0,kind:'reaction',name:'대재앙',effect:'global-destroy',card:document.createElement('div'),setTurn:turnNumber,readyTurn:turnNumber+5});renderMagicSlots()"),
    ("세팅 칸 비우기", "setMagicCards.splice(0,setMagicCards.length);renderMagicSlots()"),
    ("선공권 배너", "showInitiativeBanner('enemy','체력 동일 · 필드 카드 3 < 6','체력이 같고 상대 전장 카드가 더 적으니','전장 카드 · 나 6 · 상대 3')"),
    ("대재앙 카드", "document.querySelector('.hand').appendChild(createRuntimeBattleCard('storm.great-ruin')); setHandFilter('spell')"),
    ("번개·빙결 궁극기 세팅", "const h=document.querySelector('.hand');['core.seraphina','core.estelle-frostblade'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));awakenGateOpened.player=true;ultimateLedger.player.spent=null;ultimateLedger.player.pending=[];ultimateState=null;ultimateUsed=false;battlePhase='setup';setHandFilter('champion');armUltimateSetting()"),
    ("긴 이름 카드", "const h=document.querySelector('.hand');['bellarion.armoni-rosenbel','bellarion.dintea-marcela','bellarion.elicia-orwell','bellarion.nesila-arilain'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));const lane=document.querySelector('.summon-zone');['아르모니 로젠벨','딘테아 마르셀라','엘리시아 오르웰'].forEach(n=>{const u=document.createElement('div');u.className='unit fire';u.innerHTML='<div class=emoji></div><h4>'+n+'</h4><div class=stats><span>⚔ 10</span><span>♥ 12</span></div>';lane.appendChild(u)});setHandFilter('champion')"),
    ("소환사 압박 하수인 카드", "const h=document.querySelector('.hand');h.innerHTML='';HERO_PRESSURE_DECK_IDS.filter((id,i,a)=>a.indexOf(id)===i).forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('champion')"),
    ("자폭 배지 필드(2턴·1턴)", "const l=document.querySelector('.summon-zone');[2,1].forEach(turns=>{const u=createOpeningFieldUnit({el:'metal',name:'유소하 결사대',art:'assets/characters/gaecheon/yu-soha.webp',atk:1,hp:2,cost:1,effect:'bomb-hero-5-2'},false);u.dataset.bombTurns=String(turns);l.appendChild(u);heroPressure.renderBombBadge(u)})"),
    ("다수 공격 카드", "const h=document.querySelector('.hand');['gangho.baek-yeonju','sacheon.mong-ri','bellarion.liberna','murim.mu-yeong'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('champion')"),
    ("튜토리얼 1단계 카드 뽑기", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(0))"),
    ("튜토리얼 2단계 카드 순서 바꾸기", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(1))"),
    ("튜토리얼 3단계 오라 마법", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(2))"),
    ("튜토리얼 4단계 묘지 회수", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(3))"),
    ("튜토리얼 5단계 오라 각성", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(4))"),
    ("튜토리얼 6단계 영웅 강림", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>showTutorialGuideStep(5))"),
    ("튜토리얼 묘지 회수 제물 선택", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>{showTutorialGuideStep(3);setTimeout(()=>{const s=document.querySelector('.tg-stage');TUTORIAL_GUIDE_SCENES.graveRecall.build(s);TUTORIAL_GUIDE_SCENES.graveRecall.open(s)},50)})"),
    ("튜토리얼 오라 각성 강화 선택", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>{showTutorialGuideStep(4);setTimeout(()=>{const s=document.querySelector('.tg-stage');TUTORIAL_GUIDE_SCENES.awaken.build(s);s.querySelector('.tg-awaken-choice').hidden=false},50)})"),
    ("튜토리얼 영웅 강림 고르기", "tutorialGuideOverlay()?.remove();openTutorialGuide();setTimeout(()=>{showTutorialGuideStep(5);setTimeout(()=>{const s=document.querySelector('.tg-stage');TUTORIAL_GUIDE_SCENES.hero.build(s);TUTORIAL_GUIDE_SCENES.hero.open(s)},50)})"),
    ("튜토리얼 완료", "tutorialGuideOverlay()?.remove();openTutorialGuide();showTutorialGuideComplete()"),
    ("튜토리얼 닫힘", "tutorialGuideOverlay()?.remove()"),
    ("사운드 패널", "toggleSoundPanel(true)"),
    ("덱 편집 화면", "openCollection('deck')"),
    ("덱 편집 오라 덱 편집 (2단계)", "openCollection('deck');pickAuraDeck(0)"),
    ("덱 편집 오라 덱 편집 마법 필터", "openCollection('deck');pickAuraDeck(3);setDeckTypeFilter('spell')"),
    ("덱 편집 마법 필터", "openCollection('deck');setDeckTypeFilter('spell')"),
    ("덱 편집 필터 복귀", "setDeckTypeFilter('all')"),
    ("도감 화면", "openCollection('codex')"),
    ("합성 화면", "openCollection('synth')"),
    ("합성 재료 3장", "synthSlots=[];openCollection('synth');for(let k=0;k<3;k++)synthPick(collectionState.owned.findIndex((n,i)=>n>synthReserved(i)+synthSlots.filter(x=>x===i).length))"),
    ("0차→1차 강화 화면", "const i=collectionIsSpell.findIndex(v=>!v);collectionState.owned[i]=Math.max(5,collectionState.owned[i]);openCollection('enhance');setEnhanceLevel(0);selectEnhancement(i)"),
    ("3차→4차 강화 화면", "const i=collectionIsSpell.findIndex(v=>!v),e=enhancementEntry(i);while(e.levels[3].length<5)e.levels[3].push({attack:2,health:1});openCollection('enhance');setEnhanceLevel(3);selectEnhancement(i)"),
    ("합성 결과 무대(NEW)", "closeSynthStage();revealSynthStage(collectionState.owned.findIndex(n=>n>0),true)"),
    ("합성 결과 무대 닫기", "closeSynthStage()"),
    ("상점 화면", "openCollection('gacha')"),
    ("상점 꾸미기: 전장 배경(크래커 부족)", "collectionState.crackers=100;openCollection('gacha');switchShopTab('cosmetic');setCosmeticSlot('field');buySkin('field.fire')"),
    ("상점 꾸미기: 카드 뒷면(구매·적용 후)", "collectionState.crackers=900000;openCollection('gacha');switchShopTab('cosmetic');setCosmeticSlot('back');buySkin('back.earth');applySkin('back.earth');buySkin('back.wood')"),
    ("상점 카드 뽑기 탭 복귀", "switchShopTab('pull')"),
    ("강화: 쿠키조각 부족", "const i=collectionIsSpell.findIndex(v=>!v);collectionState.owned[i]=Math.max(5,collectionState.owned[i]);collectionState.cookieFragments=3;openCollection('enhance');setEnhanceLevel(0);selectEnhancement(i)"),
    ("합성: 쿠키조각 부족", "collectionState.cookieFragments=3;synthSlots=[];openCollection('synth');for(let k=0;k<3;k++)synthPick(collectionState.owned.findIndex((n,i)=>n>synthReserved(i)+synthSlots.filter(x=>x===i).length))"),
    ("시크릿 블록: 열 수 있음(쿠키조각 부족)", "const l=collectionCardDefs.filter(d=>d.cardType==='champion'&&d.rarity==='legendary');const st={unlocked:{},ready:{}};l.slice(0,4).forEach(d=>st.ready[d.cardId]={avenger:'긴 이름의 복수자 캐릭터'});localStorage.setItem('fate-secret-blocks-v1',JSON.stringify(st));collectionState.cookieFragments=3;openCollection('secret')"),
    ("혈마나 궁극기 버튼", "const c=createRuntimeBattleCard('core.seraphina');ultimateState=ultimateSpec(c);ultimateUsed=false;turnNumber=2;battlePhase='setup';mana=10;playerHp=100;const l=document.querySelector('.arena .lane:first-child');if(!l.querySelector('.unit')){const e=document.createElement('div');e.className='unit water';e.innerHTML='<div class=emoji></div><h4>t</h4><div class=stats><span>⚔ 3</span><span>♥ 9</span></div>';l.appendChild(e)}renderUltimate();updateMana()"),
    ("숲 인물 카드", "const h=document.querySelector('.hand');h.innerHTML='';['akforest.beka','akforest.korin','akforest.rize','akforest.kamila','akforest.lucky','akforest.nemu'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('champion')"),
    ("결과 승리", "showBattleResult(true,'상대의 본체 체력을 0으로 만들었습니다. 궁극기로 상대 소환사를 쓰러뜨렸습니다.')"),
    ("결과 패배", "showBattleResult(false,'상대 유닛의 공격으로 본체 체력이 0이 되었습니다.')"),
    ("결과 닫기", "document.querySelector('#result').classList.remove('show','lose')"),
    ("하수인 소환 설명", "showEffectNarration('summon','S급 병기발명가 베카 · 공격력 99','공격 시 표식을 남기며, 표식 3개에서 4 피해로 폭발합니다. 아군이 쓰러지면 라운드마다 한 번 2/2 사령을 부릅니다.',600000);const n=document.querySelector('.effect-narration.summon p');n.textContent='공격 시 표식을 남기며, 표식 3개에서 4 피해로 폭발합니다. 아군이 쓰러지면 라운드마다 한 번 2/2 사령을 부릅니다.'"),
    ("하수인 소환 설명 닫기", "document.querySelectorAll('.effect-narration').forEach(n=>n.remove())"),
    ("역전 마법 카드", "const h=document.querySelector('.hand');h.innerHTML='';['reversal.judgment','reversal.bulwark','reversal.giant-hunt','reversal.weight-toll','reversal.life-siphon','reversal.insight'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('spell')"),
    ("전투 진행 중", "battlePhase='player-combat'; updateDrawAction(); const e=document.querySelector('.end'); if(e) e.textContent='내 하수인 공격 중…'"),
    ("성격 오라 선택", "playerGuardian=null; guardianChosen=false; openGuardianSelect()"),
]

def run(url):
    fails = 0
    wraps = 0
    prep_fails = 0  # 상태 준비 실패도 실패로 센다 — 조용히 건너뛰면 그 상태는 검사되지 않은 채 'OK'가 나온다
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w, h in VIEWPORTS:
            pg = br.new_page(viewport={"width": w, "height": h})
            pg.goto(url); pg.wait_for_timeout(1200)
            pg.evaluate("document.fonts.ready")
            for name, setup in STATES:
                try:
                    pg.evaluate(setup)
                except Exception as e:
                    # 한 상태에서 컨텍스트가 파괴되면(해시 변경 등) 이후 상태가 연쇄로 무너진다.
                    # 페이지를 다시 띄우고 한 번만 재시도해 연쇄 실패를 끊는다.
                    try:
                        pg.goto(url); pg.wait_for_timeout(1200)
                        pg.evaluate("document.fonts.ready")
                        pg.evaluate(setup)
                    except Exception as e2:
                        prep_fails += 1
                        print(f"[{w}x{h}] 상태 '{name}' 준비 실패 (검사 못 함): {str(e2)[:120]}")
                        continue
                pg.wait_for_timeout(150)
                res = pg.evaluate(JS)
                for r in res:
                    if r.get('wrap'):
                        wraps += 1
                        print(f"[{w}x{h}] {name} 줄바꿈 이상: {r['kind']}  \"{r['text']}\"  ({r['el']}, {r['lines']}줄)")
                        continue
                    fails += 1
                    print(f"[{w}x{h}] {name} 넘침 {r['over']}px  \"{r['text']}\"  ({r['el']} ⊄ {r['box']}, 글자 {r.get('textW')} / 상자 {r.get('boxW')})")
            if "--shots" in sys.argv:
                pg.screenshot(path=f"/tmp/fate-overflow-{w}x{h}.png")
            pg.close()
        br.close()
    if fails or wraps or prep_fails:
        print(f"FAIL: 넘침 {fails}건, 줄바꿈 이상 {wraps}건, 상태 준비 실패 {prep_fails}건" + (" — STATES의 준비 코드가 지금 index.html과 맞는지 확인" if prep_fails else ""))
    else:
        print("OK: 넘침·줄바꿈 이상 없음")
    sys.exit(1 if fails or wraps or prep_fails else 0)


def main():
    # url 을 명시하면 그대로 쓴다(이미 띄운 서버를 재사용하려는 의도적 선택).
    if URL:
        print(f"[overflow] 지정한 url 을 검사합니다: {URL}")
        run(URL)
        return
    # 기본 경로: 내 dist 를 내가 띄우고, 응답하는 트리가 내 것인지 확인한 뒤 검사한다.
    with serve_own_tree() as base:
        print(f"[overflow] 내 dist 를 {base} 에 띄워 검사합니다.")
        run(base + "/index.html" + QUERY)


if __name__ == '__main__':  # capture-baseline.py 가 STATES 를 가져다 쓴다
    main()
