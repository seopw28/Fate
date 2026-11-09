const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync(require('node:path').resolve(__dirname, '../../dist/index.html'), 'utf8');

test('묘지 회수 무대: 누르면 내 진영 가운데에 손패 마법이 떠오르고, 고른 카드가 부서진 뒤 묘지에서 하수인이 솟아 손패로 온다 (2026-11-09 PM)', () => {
  assert.ok(html.includes("if(typeof openGraveRecallStage==='function')openGraveRecallStage();"), '묘지 회수를 누르면 무대를 연다');
  assert.ok(html.includes("const zone=document.querySelector('.summon-zone')"), '무대는 내 진영 위에 연다');
  assert.ok(html.includes('animation:grs-float'), '마법카드가 떠 있다');
  assert.ok(html.includes('function shatterGraveRecallCard(ghost)'), '고른 카드가 부서진다');
  assert.ok(html.includes("performGraveRecall('player',card,{shattered:true,onEntry:(entry,pick)=>riseFromGraveyard(stage,entry,pick)})"), '비용과 판정은 기존 묘지 회수를 그대로 쓴다');
  assert.ok(html.includes('if(graveRecallArrival){graveRecallArrivalCard=card;return;}'), '회수한 하수인은 덱 뽑기 연출이 아니라 묘지에서 날아온다');
  assert.ok(html.includes("if(event.key==='Escape'&&!graveRecallBusy)"), 'Esc로 취소');
});

test('마법카드 탭에서는 오라 마법을 숨기고, 묘지 회수는 누르는 버튼 하나다 (2026-11-09 PM)', () => {
  assert.ok(html.includes("panel.hidden=!(guardianChosen&&magic)||handFilter==='spell';"), '마법카드 탭에서 오라 마법 숨김');
  assert.ok(html.includes('const base=setHandFilter;setHandFilter=function(...args){const result=base.apply(this,args);renderAuraMagic();return result;};'), '탭을 바꾸면 다시 그린다');
  assert.ok(html.includes(".magic-setting-panel .setting-title{display:none}"), '묘지 회수 패널 제목을 없앤다');
  assert.ok(html.includes("button.innerHTML='<strong>묘지 회수</strong><span class=\"grave-recall-cost\">"), '버튼에는 이름과 비용만');
});
