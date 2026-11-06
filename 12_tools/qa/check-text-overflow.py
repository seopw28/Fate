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
    // 스크롤 가능한 박스는 스크롤 방향의 '아래/옆에 가려진 내용'을 넘침으로 세지 않는다
    const scrollY = ['auto','scroll'].includes(bs.overflowY), scrollX = ['auto','scroll'].includes(bs.overflowX);
    const over = Math.max(scrollX ? -1e9 : Math.max(b.left - t.left, t.right - b.right), scrollY ? -1e9 : Math.max(b.top - t.top, t.bottom - b.bottom), -1);
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
    ("궁극기 대기", "ultimateState=ultimateSpec(document.querySelector('.hand .card')); ultimateUsed=false; renderFieldUltimateAction()"),
    ("궁극기 재사용 대기", "ultimateState=ultimateSpec(document.querySelector('.hand .card')); ultimateUsed=false; lastUltimateTurn=turnNumber; renderUltimate(); renderFieldUltimateAction()"),
    ("궁극기 세팅 모드", "ultimateState=null; ultimateUsed=false; battlePhase='setup'; setHandFilter('champion'); armUltimateSetting()"),
    ("마법 세팅 모드", "battlePhase='setup'; setHandFilter('spell'); armMagicSetting()"),
    ("최후의 저항 즉시 발동 마법", "battlePhase='setup'; desperateQuickCastTurn=turnNumber; desperateQuickCastUsed=false; setHandFilter('spell'); updateMana()"),
    ("선공권 배너", "showInitiativeBanner('enemy','체력 동일 · 필드 카드 3 < 6','체력이 같고 상대 전장 카드가 더 적으니','전장 카드 · 나 6 · 상대 3')"),
    ("대재앙 카드", "document.querySelector('.hand').appendChild(createRuntimeBattleCard('storm.great-ruin')); setHandFilter('spell')"),
    ("번개·빙결 궁극기 세팅", "const h=document.querySelector('.hand');['core.seraphina','core.estelle-frostblade'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));ultimateState=null;ultimateUsed=false;battlePhase='setup';setHandFilter('champion');armUltimateSetting()"),
    ("긴 이름 카드", "const h=document.querySelector('.hand');['bellarion.armoni-rosenbel','bellarion.dintea-marcela','bellarion.elicia-orwell','bellarion.nesila-arilain'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));const lane=document.querySelector('.summon-zone');['아르모니 로젠벨','딘테아 마르셀라','엘리시아 오르웰'].forEach(n=>{const u=document.createElement('div');u.className='unit fire';u.innerHTML='<div class=emoji></div><h4>'+n+'</h4><div class=stats><span>⚔ 10</span><span>♥ 12</span></div>';lane.appendChild(u)});setHandFilter('champion')"),
    ("다수 공격 카드", "const h=document.querySelector('.hand');['gangho.baek-yeonju','sacheon.mong-ri','bellarion.liberna','murim.mu-yeong'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('champion')"),
    ("초보자 설명 켜짐", "document.querySelector('.difficulty-select')?.remove();enemyDifficulty='normal';beginnerHelpEnabled=true;syncBeginnerHelp()"),
    ("초보자 설명 꺼짐", "toggleBeginnerHelp(false)"),
    ("사운드 패널", "toggleSoundPanel(true)"),
    ("최후의 저항 안내", "showDesperateNotice('enemy',{instant:true})"),
    ("최후의 저항 안내(내 쪽)", "showDesperateNotice('player',{instant:true})"),
    ("덱 편집 화면", "openCollection('deck')"),
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
    ("혈마나 궁극기 버튼", "const c=createRuntimeBattleCard('core.seraphina');ultimateState=ultimateSpec(c);ultimateUsed=false;lastUltimateTurn=null;turnNumber=2;battlePhase='setup';mana=10;playerHp=100;const l=document.querySelector('.arena .lane:first-child');if(!l.querySelector('.unit')){const e=document.createElement('div');e.className='unit water';e.innerHTML='<div class=emoji></div><h4>t</h4><div class=stats><span>⚔ 3</span><span>♥ 9</span></div>';l.appendChild(e)}renderUltimate();updateMana()"),
    ("숲 인물 카드", "const h=document.querySelector('.hand');h.innerHTML='';['akforest.beka','akforest.korin','akforest.rize','akforest.kamila','akforest.lucky','akforest.nemu'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('champion')"),
    ("결과 승리", "showBattleResult(true,'상대의 본체 체력을 0으로 만들었습니다. 궁극기로 상대 영웅을 쓰러뜨렸습니다.')"),
    ("결과 패배", "showBattleResult(false,'상대 유닛의 공격으로 본체 체력이 0이 되었습니다.')"),
    ("결과 닫기", "document.querySelector('#result').classList.remove('show','lose')"),
    ("챔프 소환 설명", "showEffectNarration('summon','S급 병기발명가 베카 · 공격력 99','공격 시 표식을 남기며, 표식 3개에서 4 피해로 폭발합니다. 아군이 쓰러지면 라운드마다 한 번 2/2 사령을 부릅니다.',600000);const n=document.querySelector('.effect-narration.summon p');n.textContent='공격 시 표식을 남기며, 표식 3개에서 4 피해로 폭발합니다. 아군이 쓰러지면 라운드마다 한 번 2/2 사령을 부릅니다.'"),
    ("챔프 소환 설명 닫기", "document.querySelectorAll('.effect-narration').forEach(n=>n.remove())"),
    ("역전 마법 카드", "const h=document.querySelector('.hand');h.innerHTML='';['reversal.judgment','reversal.bulwark','reversal.giant-hunt','reversal.weight-toll','reversal.life-siphon','reversal.insight'].forEach(id=>h.appendChild(createRuntimeBattleCard(id)));setHandFilter('spell')"),
    ("전투 진행 중", "battlePhase='player-combat'; updateDrawAction(); const e=document.querySelector('.end'); if(e) e.textContent='내 챔프 공격 중…'"),
    ("성격 오라 선택", "playerGuardian=null; guardianChosen=false; openGuardianSelect()"),
]

def main():
    fails = 0
    prep_fails = 0  # 상태 준비 실패도 실패로 센다 — 조용히 건너뛰면 그 상태는 검사되지 않은 채 'OK'가 나온다
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
                    prep_fails += 1
                    print(f"[{w}x{h}] 상태 '{name}' 준비 실패 (검사 못 함): {str(e)[:120]}")
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
    if fails or prep_fails:
        print(f"FAIL: 넘침 {fails}건, 상태 준비 실패 {prep_fails}건" + (" — STATES의 준비 코드가 지금 index.html과 맞는지 확인" if prep_fails else ""))
    else:
        print("OK: 넘침 없음")
    sys.exit(1 if fails or prep_fails else 0)

main()
