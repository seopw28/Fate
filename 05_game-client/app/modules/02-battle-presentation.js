    /* 카드 사망 연출: 전장 카드가 사라지는 경로가 코드 곳곳에 흩어져 있어(직접 remove 37곳)
       호출부마다 연출을 붙이면 반드시 빠지는 곳이 생긴다. 제거 자체를 한 번 가로채서
       짧은 소멸 애니메이션을 재생한 뒤 실제로 지운다. 전장 밖 요소나 이미 연출 중인
       카드는 그대로 통과시킨다 (2026-11-07) */
    const UNIT_DEATH_MS=420;
    (()=>{
      const nativeRemove=Element.prototype.remove;
      Element.prototype.remove=function(){
        const isFieldUnit=this instanceof Element&&this.classList?.contains('unit')
          &&this.isConnected&&(this.closest('.summon-zone')||this.closest('.arena .lane'));
        /* 소진자 죽음 컷이 재생 중이면 카드는 컷이 끝난 뒤에 제거한다 */
        if(isFieldUnit&&this.__cutPromise&&!this.__cutWaited){this.__cutWaited=true;this.__cutPromise.then(()=>this.remove());return;}
        if(!isFieldUnit||this.dataset.dyingFx==='true')return nativeRemove.call(this);
        this.dataset.dyingFx='true';
        this.classList.add('unit-dying');
        setTimeout(()=>nativeRemove.call(this),UNIT_DEATH_MS);
      };
    })();

    /* 피격·평타 효과음 변주: 오라 × 피해 강도 × 무작위 변주 (Kenney CC0 샘플 + 합성음, 05_game-client/battle/sfx-variety.js) */
    let hitPan=0;
    /* 스킬 고유 소리만 나게: 번개 계열(아주르 썬더폴)에는 번개만, 빙결 계열(프로스트 노바·빙결 사슬)에는 빙결만.
       해당 스킬이 실행되는 동안 섞이는 일반 소리(물 피격음·일반 공격음·마법 시전음)를 잠깐 끈다. 키는 'kind' 또는 'kind:variant'. */
    const sfxMutedUntil={};let thunderfallAt=-1e9;
    function muteSfx(keys,ms){const until=performance.now()+ms;keys.forEach(key=>{sfxMutedUntil[key]=until;});}
    function sfxIsMuted(kind,variant){const now=performance.now();return (sfxMutedUntil[kind]||0)>now||(sfxMutedUntil[kind+':'+variant]||0)>now;}
    function panFor(element){const r=element.getBoundingClientRect();return Math.max(-.7,Math.min(.7,((r.left+r.width/2)/innerWidth-.5)*1.6));}
    const fateSfx=FateSfx.init({engine:audioEngine,bus:sfxBus,spellPack:new URLSearchParams(location.search).get('sfxpack')!=='base'});/* ?sfxpack=base : 새 주문 샘플 팩(Basic Spell Impacts) 없이 이전 조합만 (소리 비교용) */
    ['pointerdown','keydown','touchstart'].forEach(type=>addEventListener(type,()=>fateSfx.load(),{once:true,capture:true}));
    const sfxBeforeVariety=sfx;
    sfx=function(kind,variant='neutral',strength=3){if(soundOn&&sfxIsMuted(kind,variant))return;if(kind==='hit'&&soundOn){fateSfx.playHit(variant,strength,hitPan);return;}if(soundOn&&(kind==='frost-cast'||kind==='frost-shatter')&&fateSfx.playFrost(kind==='frost-cast'?'cast':'shatter'))return;return sfxBeforeVariety(kind,variant,strength);};
    function impact(target,damage,element='fire'){
      hitPan=panFor(target);sfx('hit',element,damage); const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches; /* impactTint: 피해 속성(판정)은 그대로 두고 타격 색만 바꾼다. 아마테라스 검은 불꽃이 붉은 불 타격으로 보이지 않게 한다 (2026-11-08) */const tint=target.dataset?.impactTint;if(tint)delete target.dataset.impactTint;const color=impactPalette[tint]||impactPalette[element]||impactPalette.fire;const hero=target.classList.contains('avatar');if(hero)heroHealthImpact(target,damage);/* 소환사 직접 피해: 체력바·화면 테두리에 더해, 아바타 자리에 오라 타격 이펙트를 작게 낸다(화면 전체 번쩍임·어둡힘·필드 흔들림은 생략) */ if(!hero){const arena=document.querySelector('.arena'); arena.classList.remove('impact'); void arena.offsetWidth; arena.classList.add('impact');slowCombatAnimations(arena);}const r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      /* 밀림은 '때린 몸이 있는 피해'에만 준다.
         fieldAttack(평타·반격)은 공격자→대상 벡터로 --knock-x/y를 미리 넣는다. 반면 마법·화상·광역·
         사망유발 피해는 damageUnit에서 바로 impact로 들어와 그 좌표가 없고, 예전에는 (1) 값이 없으면
         CSS 폴백으로 '항상 위'로 솟고 (2) 전에 맞았던 카드는 그때 값이 남아 엉뚱한 방향으로 튀었다.
         마법·함정은 애초에 밀어낼 방향이 없으니 방향을 만들지 않고 밀림을 0으로 지운다 (2026-11-07) */
      {/* 평타·반격(fieldAttack)만 --knock-src=field를 남기므로 그것이 근접 타격의 유일한 표식이다.
          밀림이 없어도 번쩍임·흔들림·파편으로 피격은 충분히 읽힌다. */
       const melee=target.style.getPropertyValue('--knock-src')==='field';
       if(!melee){target.style.setProperty('--knock-x','0px');target.style.setProperty('--knock-y','0px');}
       target.style.removeProperty('--knock-src');}
      /* 평타 돌진·반동은 element.animate()(WAAPI)로 transform을 돌린다. WAAPI는 CSS 애니메이션보다
         우선순위가 높아, 그게 아직 돌고 있으면 hit-react(CSS target-hit)가 transform을 전혀 못 잡는다.
         반격이 특히 어긋나 보인 이유가 이것 — 되받아친 내 카드는 직전에 자기 돌진·반동이 돌고 있어
         밀려나는 모션이 통째로 먹혔고, 화면에는 돌진 복귀 움직임만 남아 방향이 거꾸로 읽혔다.
         피격 모션이 이기도록 대상의 transform 계열 WAAPI를 먼저 거둔다 (2026-11-07) */
      if(target.getAnimations)target.getAnimations().forEach(anim=>{
        if(anim.animationName)return;/* CSS 애니메이션(hit-react 자신 포함)은 건드리지 않는다 */
        let touchesTransform=false;
        try{touchesTransform=(anim.effect?.getKeyframes()||[]).some(frame=>'transform' in frame);}catch(e){}
        if(touchesTransform)try{anim.cancel();}catch(e){}});
      target.classList.remove('hit-react'); void target.offsetWidth; target.classList.add('hit-react');slowCombatAnimations(target);setTimeout(()=>target.classList.remove('hit-react'),combatMs(360));/* 밀려났다 돌아오는 길(0.34초)을 끝까지 보여준 뒤 해제한다. 애니메이션보다 길게 잡으면 다 끝난 카드가 계속 점유돼 렉처럼 보인다 */
      if(!hero){const vignette=document.createElement('div'); vignette.className='impact-vignette'; vignette.style.setProperty('--x',x+'px'); vignette.style.setProperty('--y',y+'px'); document.body.appendChild(vignette);slowCombatAnimations(vignette);setTimeout(()=>vignette.remove(),combatMs(700));
      const flash=document.createElement('div'); flash.className='fx screen-flash'; flash.style.background='radial-gradient(circle at '+x+'px '+y+'px,#fff9 0, '+color+'44 13%,transparent 44%)'; document.body.appendChild(flash);slowCombatAnimations(flash);setTimeout(()=>flash.remove(),combatMs(500));}
      const core=addCombatLayer('impact-core',x,y,color,520); addCombatLayer('shockwave',x,y,color,800); addCombatLayer('shockwave secondary',x,y,color,900);
      if(!reduced){
        for(let i=0;i<(hero?5:8);i++){const ray=addCombatLayer('impact-ray',x,y,color,700);ray.style.setProperty('--ray-angle',(i*45+Math.random()*18-9)+'deg');ray.style.setProperty('--ray-length',(70+Math.random()*90)+'px');}
        for(let i=0;i<(hero?14:26);i++){const angle=Math.random()*Math.PI*2,dist=(hero?.6:1)*(85+Math.random()*135),p=addCombatLayer('particle shard',x,y,color,1000);p.style.setProperty('--angle',(angle*180/Math.PI)+'deg');p.style.setProperty('--dx',(Math.cos(angle)*dist)+'px');p.style.setProperty('--dy',(Math.sin(angle)*dist*.72-25)+'px');p.style.setProperty('--size',(7+Math.random()*12)+'px');p.style.setProperty('--duration',(480+Math.random()*420)+'ms');}
        for(let i=0;i<7;i++){const w=addCombatLayer('element-wisp',x+(Math.random()*50-25),y+(Math.random()*28-14),color,1100);w.style.setProperty('--dx',(Math.random()*70-35)+'px');w.style.setProperty('--dy',(-45-Math.random()*90)+'px');w.style.setProperty('--size',(8+Math.random()*14)+'px');w.style.setProperty('--duration',(650+Math.random()*350)+'ms');}
      }
      const trail=document.createElement('div'); trail.className='attack-trail'; trail.style.left=x+'px'; trail.style.top=y+'px'; trail.style.background='linear-gradient(90deg,transparent,#fff,'+color+',transparent)'; document.body.appendChild(trail);slowCombatAnimations(trail);setTimeout(()=>trail.remove(),combatMs(450));
      const asset=document.createElement('img'); asset.className='asset-fx'; asset.style.left=x+'px'; asset.style.top=y+'px'; document.body.appendChild(asset);slowCombatAnimations(asset);const frames=framePaths(element); let frame=0; asset.src=frames[0]; const timer=setInterval(()=>{asset.src=frames[Math.min(frame++,frames.length-1)];if(frame>=frames.length)clearInterval(timer);},combatMs(42));
      const hit=document.createElement('div'); hit.className='fx hit-fx '+element; hit.style.left=x+'px'; hit.style.top=y+'px'; document.body.appendChild(hit);
      const num=document.createElement('div'); num.className='fx damage-fx'; num.textContent='−'+damage; num.style.left=(x-18)+'px'; num.style.top=(r.top+15)+'px'; num.style.color=color; num.hidden=target.classList.contains('avatar'); document.body.appendChild(num);
      slowCombatAnimations(hit);slowCombatAnimations(num);setTimeout(()=>{clearInterval(timer);core.remove();asset.remove();hit.remove();num.remove()},combatMs(1250));
    }
    const impactBeforeCombatTiming=impact;
    impact=function(...args){if(combatQueueHasNext){const target=args[0],tail=target?.classList?.contains('avatar')?COMBAT_TIMING.heroImpactTail:COMBAT_TIMING.cardImpactTail;markCombatBusy(combatMs(tail));}return impactBeforeCombatTiming(...args);};
    function resolveCombat(done){const attackers=[...document.querySelectorAll('.summon-zone .unit:not(.exhausted)')],enemyLane=document.querySelector('.arena .lane:first-child'),enemyHud=document.querySelector('.duel-hud .enemy');if(!attackers.length){writeLog('이번 턴에 공격 가능한 하수인이 없습니다.');done?.();return;}writeLog('<strong>턴 종료 공격:</strong> 공격 가능한 하수인 '+attackers.length+'명이 자동으로 진격합니다.');runCombatQueue(attackers,unit=>{if(document.querySelector('.result').classList.contains('show'))return;const target=enemyLane.querySelector(':scope > .unit:not([data-destroyed="true"])');if(consumeSnare(unit))return;unit.classList.remove('exhausted');selectUnit(unit,true);if(target)attack(target,true);else attackFace(enemyHud,true);},done);}
    function startPlayerTurn(button){ if(resultPending||document.querySelector('.result').classList.contains('show'))return;setBattlePhase('setup');sfx('turn-start');absoluteDefense=false;turnNumber++;maxMana=Math.min(MANA_CAP,maxMana+1);mana=maxMana;bloodManaUses=0;drawActionsUsed=0;combo=0;lastAttackElement=null;if(document.querySelectorAll('.hand .card').length<8)drawCard();else writeLog('<strong>손패 가득 참:</strong> 손패가 8장이라 이번 턴 기본 드로우를 건너뜁니다.');/* 복수자가 두 번째로 등장한 뒤부터 내 턴 시작에 기본 드로우 외 1장 더 받는다(손패 8장이거나 덱이 비면 생략) */if(avengerExtraDrawActive('player')&&deck.length&&document.querySelectorAll('.hand .card').length<8){drawCard();writeLog('<strong>복수자의 가호:</strong> 복수자가 두 번째로 등장한 뒤라 덱에서 카드를 1장 더 받았습니다.');}document.querySelectorAll('.summon-zone .unit').forEach(u=>{u.classList.remove('exhausted');u.dataset.attacked='0';});advanceUltimateLedger('player');updateMana();updateSynergyHud();triggerTrap('field_state');button.textContent='턴 종료 · 마나 '+mana+' 보유';button.disabled=false;button.style.opacity='1';writeLog('<strong>새 필드</strong>가 시작되었습니다. 최대 마나가 '+maxMana+'로 증가했습니다.'); }
    /* 선공권: 체력 열세 → 필드 하수인 수 열세 → 티어 열세 → 무작위 순으로 결정한다.
       라운드 순서는 [선공 → 후공]이며 endTurn()은 내 행동이 끝났을 때 내가 선공이었던 경우에만 상대 행동을 실행한다. */
    let roundFirst='player';
    function pickInitiative(){const playerUnits=document.querySelectorAll('.summon-zone .unit').length,enemyUnits=document.querySelectorAll('.arena .lane:first-child > .unit').length,hp='내 체력 '+playerHp+' · 상대 체력 '+enemyHp;if(playerHp!==enemyHp)return playerHp<enemyHp?{side:'player',lead:'상대의 체력이 더 높으니',reason:'체력 열세 · 내 '+playerHp+' / 상대 '+enemyHp,detail:hp}:{side:'enemy',lead:'상대의 체력이 더 낮으니',reason:'체력 열세 · 상대 '+enemyHp+' / 내 '+playerHp,detail:hp};if(playerUnits!==enemyUnits)return playerUnits<enemyUnits?{side:'player',lead:'체력이 같고 내 전장 카드가 더 적으니',reason:'체력 동일 · 필드 카드 '+playerUnits+' < '+enemyUnits,detail:'전장 카드 · 나 '+playerUnits+' · 상대 '+enemyUnits}:{side:'enemy',lead:'체력이 같고 상대 전장 카드가 더 적으니',reason:'체력 동일 · 필드 카드 '+enemyUnits+' < '+playerUnits,detail:'전장 카드 · 나 '+playerUnits+' · 상대 '+enemyUnits};const side=engineAdapter.random()<.5?'player':'enemy';return {side,lead:'체력과 전장이 모두 같아 무작위로 정해져',reason:'체력·필드 동일 · 무작위',detail:hp};}
    /* 선공 안내: 필드 중앙에 "상대의 체력이 더 높으니 나의 선공입니다." 문장이 단어 단위로 떠오르고, 결론(나의/상대의 선공)이 마지막에 빛나며 맺힌다 */
    let initiativeGuideText='';/* 선공 안내는 상단 안내 문구 자리에 노란 글씨로 띄우고, 카드를 고르거나 턴을 마칠 때까지 남겨 둔다 */
    function showInitiativeBanner(side,reason,lead,detail){document.querySelectorAll('.initiative-banner').forEach(node=>node.remove());initiativeGuideText=(lead?lead+' ':'')+(side==='player'?'나의 선공입니다.':'상대의 선공입니다.');const guide=document.querySelector('#hand-guide');if(!guide)return;guide.textContent=initiativeGuideText;guide.title=detail||reason||'';guide.classList.remove('initiative-guide');void guide.offsetWidth;guide.classList.add('initiative-guide');}
    function beginNextRound(button){if(resultPending||document.querySelector('.result').classList.contains('show'))return;const {side,reason,lead,detail}=pickInitiative();roundFirst=side;showInitiativeBanner(side,reason,lead,detail);writeLog('<strong>선공권:</strong> '+(side==='player'?'내':'상대')+'가 먼저 행동합니다. ('+reason+')');if(side==='enemy'){setBattlePhase('enemy-combat');button.textContent='상대 선공 진행 중…';setTimeout(()=>{if(resultPending)return;const realMax=maxMana;maxMana=Math.min(MANA_CAP,maxMana+1);enemyTurn(()=>startPlayerTurn(button));maxMana=realMax;},combatMs(COMBAT_TIMING.initiativeLeadIn));}else startPlayerTurn(button);}
    function endTurn(button){initiativeGuideText='';if(battlePhase==='setup')document.querySelectorAll('.hand .card[data-fresh-draw]').forEach(card=>delete card.dataset.freshDraw);document.querySelector('#hand-guide')?.classList.remove('initiative-guide');if(battlePhase!=='setup'||resultPending||document.querySelector('.result').classList.contains('show'))return;sfx('turn-end');button.disabled=true;button.style.opacity='.6';const proceed=()=>{if(resultPending||document.querySelector('.result').classList.contains('show'))return;setBattlePhase('player-combat');button.textContent='내 하수인 공격 중…';resolveCombat(()=>{if(resultPending||document.querySelector('.result').classList.contains('show'))return;resolveBurns();setBattlePhase('enemy-combat');button.textContent='상대 전투 진행 중…';setTimeout(()=>{if(resultPending)return;if(roundFirst==='player')enemyTurn(()=>beginNextRound(button));else beginNextRound(button);},combatMs(COMBAT_TIMING.phaseTransition));});};/* 세팅한 마법은 턴 종료 즉시 발동하고, 끝난 뒤 내 하수인이 공격한다 (2026-11-07) */if(setMagicCards.some(magic=>magic.kind==='active'&&(magic.fireTurn??turnNumber)<=turnNumber))resolveEndTurnMagic(button).then(proceed);else{setBattlePhase('player-combat');proceed();}}
    const startPlayerTurnCore=startPlayerTurn,endTurnCore=endTurn;
    let enemyPlacementRevealAt=0;
    function revealEnemyPlacementInOrder(unit){if(!unit)return;const now=performance.now(),delay=Math.max(0,enemyPlacementRevealAt-now);enemyPlacementRevealAt=Math.max(now,enemyPlacementRevealAt)+combatMs(220);unit.style.visibility='hidden';setTimeout(()=>{if(!unit.isConnected)return;unit.style.visibility='';sfx('card-land','enemy',3);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)unit.animate([{opacity:0,transform:'translate(81px,-63px) rotate(7deg) scale(.82)',filter:'brightness(1.8)'},{opacity:1,transform:'translateY(7.2px) scale(1.04)',filter:'brightness(1.25)',offset:.72},{opacity:1,transform:'none',filter:'none'}],{duration:combatMs(420),easing:'cubic-bezier(.16,.82,.2,1)'});},delay);}
    const enemySummonUnitImmediate=enemySummonUnit;
    enemySummonUnit=function(lane,data,slot){const before=new Set(lane.querySelectorAll(':scope > .unit'));enemySummonUnitImmediate(lane,data,slot);const unit=[...lane.querySelectorAll(':scope > .unit')].find(candidate=>!before.has(candidate));revealEnemyPlacementInOrder(unit);return unit;};
    startPlayerTurn=function(button){startPlayerTurnCore(button);if(battlePhase==='setup'){setHandFilter('champion');setTimeout(resolveSelfReplication,combatMs(180));}};
    endTurn=function(button){if(fxAwaitingChoice())return;if(battlePhase==='setup'){const replicators=document.querySelectorAll('.summon-zone .unit[data-effect="self-replicate"]'),fieldCount=document.querySelectorAll('.summon-zone .unit').length;selfReplicationPrimed=mana>=2&&replicators.length>0&&fieldCount<FIELD_CARD_LIMIT;if(replicators.length){writeLog(selfReplicationPrimed?'<strong>자가 증식 준비:</strong> 남은 마나 '+mana+' · 다음 내 턴에 분체 1장 생성':'자가 증식 조건 미달: 마나 2 이상과 빈 전장 슬롯이 필요합니다.');}}endTurnCore(button);};
    const mediumSkillAssets={'arcane-circle':{src:'assets/vfx/medium/arcane-circle-v1.webp',label:'ARCANE CIRCLE'},'dark-orb':{src:'assets/vfx/medium/dark-orb-v1.webp',label:'ABYSS ORB'},'light-blades':{src:'assets/vfx/medium/light-blades-v1.webp',label:'LUMINOUS BLADES'},'flame-pillar':{src:'assets/vfx/medium/flame-pillar-v1.webp',label:'INFERNO PILLAR'}};
    function showMediumSkillEffect(kind,target=document.querySelector('.arena'),label=''){const spec=mediumSkillAssets[kind];if(!spec||!target)return;const rect=target.getBoundingClientRect(),fx=document.createElement('div');fx.className='medium-skill-fx '+kind;fx.style.left=(rect.left+rect.width/2)+'px';fx.style.top=(rect.top+rect.height/2)+'px';fx.dataset.label=label||spec.label;fx.innerHTML='<img src="'+spec.src+'" alt="">';document.body.appendChild(fx);{const half=fx.offsetWidth/2+8;fx.style.left=Math.min(Math.max(rect.left+rect.width/2,half),innerWidth-half)+'px';fx.style.top=Math.min(Math.max(rect.top+rect.height/2,half),innerHeight-half)+'px';}slowCombatAnimations(fx);sfx('magic',kind==='flame-pillar'?'offense':kind==='arcane-circle'?'buff':'neutral',6);setTimeout(()=>fx.remove(),combatMs(1350));}
    /* 다중 공격 마법: 영향을 받는 카드마다 오라에 맞는 이펙트를 각각 터뜨린다(카드 크기에 맞춰 축소). */
    function showSpellTargetRing(unit,label,color){
      if(!unit?.isConnected)return;
      const r=unit.getBoundingClientRect(),ring=document.createElement('div');
      ring.className='spell-target-ring';
      ring.style.left=(r.left-6)+'px';ring.style.top=(r.top-6)+'px';
      ring.style.width=(r.width+12)+'px';ring.style.height=(r.height+12)+'px';
      if(color)ring.style.setProperty('--st-color',color);
      if(label)ring.setAttribute('data-label',label);
      document.body.appendChild(ring);
      setTimeout(()=>ring.remove(),combatMs(620));
    }
    /* 효과로 치워지는 카드는 그냥 사라지지 않고 목적지로 날아간다 —
       "마법 효과로 움직이는 것"이라는 인지를 만든다 (2026-11-07). */
    const CARD_DEPART_DEST={graveyard:{label:'묘지로',tag:'GRAVEYARD',color:'#c98bff',dy:.34},
      deck:{label:'덱으로',tag:'DECK',color:'#8fd4ff',dy:-.3},
      hand:{label:'손패로',tag:'HAND',color:'#7fe6a4',dy:.42}};
    function sendCardTo(unit,where,name){
      const dest=CARD_DEPART_DEST[where];
      if(!unit?.isConnected||!dest)return 0;
      const r=unit.getBoundingClientRect(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,
        /* 목적지는 필드 안쪽에 둔다. 화면 기준으로 잡으면 필드를 벗어난다 (CLAUDE.md). */
        style=getComputedStyle(document.documentElement),
        num=key=>parseFloat(style.getPropertyValue(key))||0,
        fl=num('--field-left'),ft=num('--field-top'),fw=num('--field-width'),fh=num('--field-height'),
        tx=fl+fw*.5,ty=ft+fh*(.5+dest.dy*.5),
        flight=document.createElement('div'),marker=document.createElement('div'),
        art=unit.dataset.art||'',emoji=unit.querySelector('.emoji')?.textContent?.trim()||'◆';
      flight.className='card-depart';
      flight.style.setProperty('--cd-color',dest.color);
      flight.style.left=r.left+'px';flight.style.top=r.top+'px';
      flight.style.width=r.width+'px';flight.style.height=r.height+'px';
      flight.innerHTML=art?'<img src="'+art+'" alt="">':'<div class="cd-art">'+emoji+'</div>';
      marker.className='card-depart-dest';
      marker.style.setProperty('--cd-color',dest.color);
      marker.style.left=tx+'px';marker.style.top=ty+'px';
      marker.style.transform='translate(-50%,-50%)';
      marker.innerHTML='<small>'+dest.tag+'</small><b>'+(name?name+' · ':'')+dest.label+'</b>';
      document.body.appendChild(marker);document.body.appendChild(flight);
      const dur=reduced?1:combatMs(620),
        dx=tx-(r.left+r.width/2),dy=ty-(r.top+r.height/2);
      flight.animate([{transform:'translate(0,0) scale(1) rotate(0)',opacity:1},
        {transform:'translate('+(dx*.55)+'px,'+(dy*.45-26)+'px) scale(.78) rotate(-12deg)',opacity:1,offset:.55},
        {transform:'translate('+dx+'px,'+dy+'px) scale(.16) rotate(16deg)',opacity:.1}],
        {duration:dur,easing:'cubic-bezier(.3,.7,.2,1)',fill:'forwards'});
      setTimeout(()=>flight.remove(),dur+40);
      setTimeout(()=>marker.remove(),dur+360);
      return dur;
    }
    function markUltimateTargets(nodes,label,color){
      /* 궁극기 대상은 유닛뿐 아니라 소환사 아바타일 수도 있다. 링을 조금 더 크고 길게 보여준다. */
      nodes.filter(Boolean).filter(node=>node.isConnected).forEach((node,i)=>setTimeout(()=>{
        if(!node.isConnected)return;
        const r=node.getBoundingClientRect(),ring=document.createElement('div');
        ring.className='spell-target-ring ult';
        /* 링이 사라지기 전에 대상 카드도 함께 번쩍여, 어느 카드가 영향을 받는지 링 밖에서도 읽히게 한다. */
        node.classList.add('ult-affected');setTimeout(()=>node.classList.remove('ult-affected'),combatMs(1800));
        ring.style.left=(r.left-7)+'px';ring.style.top=(r.top-7)+'px';
        ring.style.width=(r.width+14)+'px';ring.style.height=(r.height+14)+'px';
        if(color)ring.style.setProperty('--st-color',color);
        if(label)ring.setAttribute('data-label',label);
        document.body.appendChild(ring);
        setTimeout(()=>ring.remove(),combatMs(1800));
      },i*combatMs(110)));
    }
    function markSpellTargets(units,label,color){
      /* 마법이 누구에게 적용되는지 보여준다 — 피해 적용 전에 조준 링을 먼저 띄운다. */
      units.filter(Boolean).forEach((unit,i)=>setTimeout(()=>showSpellTargetRing(unit,label,color),i*combatMs(90)));
    }
    function showUnitSpellFx(unit,element){const kinds={fire:'flame-pillar',water:'light-blades',ice:'light-blades',wind:'light-blades',earth:'arcane-circle'},tints={wind:'hue-rotate(95deg) saturate(1.4)',earth:'sepia(1) saturate(2.6) hue-rotate(-14deg) brightness(.95)'},thunder=element==='thunder',kind=thunder?'lightning':(kinds[element]||'dark-orb'),spec=thunder?{src:'assets/vfx/cinematic/lightning-strike-v'+(cinematicVariantFor(unit.dataset.cardId||unit.querySelector('h4')?.textContent||'lightning'))+'.webp'}:mediumSkillAssets[kind];if(!spec||!unit?.isConnected)return;const r=unit.getBoundingClientRect(),size=Math.max(r.width,r.height)*(thunder?1.9:1.45),fx=document.createElement('div');fx.className='medium-skill-fx unit-fx '+kind;fx.style.left=(r.left+r.width/2)+'px';fx.style.top=(r.top+r.height/2)+'px';fx.style.width=size+'px';fx.innerHTML='<img src="'+spec.src+'" alt="">';if(tints[element])fx.querySelector('img').style.filter=tints[element];document.body.appendChild(fx);slowCombatAnimations(fx);setTimeout(()=>fx.remove(),combatMs(thunder?900:1250));}
    function igniteAmaterasu(target){
      if(typeof AmaterasuFlame==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const r=target.getBoundingClientRect(),canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
      const fx=new AmaterasuFlame(canvas,{rate:7,scale:Math.max(.6,Math.min(1.3,r.width/150)),rise:1.1,width:r.width*.7,x:r.left+r.width/2,y:r.bottom-6});
      fx.start();
      setTimeout(()=>{fx.opts.rate=0;},combatMs(1500));
      setTimeout(()=>{fx.destroy();canvas.remove();},combatMs(1500)+2600);
    }
    function castBlackFlame(card){
      const enemies=[...document.querySelectorAll('.arena .lane:first-child > .unit')];
      if(!enemies.length){writeLog('대상 하수인이 없어 <strong>아마테라스</strong> 효과가 적용되지 않았습니다.');return;}
      const atk=unit=>Number(unit.querySelector('.stats span').textContent.replace(/[^0-9]/g,'')),target=enemies.sort((a,b)=>atk(b)-atk(a))[0],name=target.querySelector('h4').textContent;
      igniteAmaterasu(target);
      setTimeout(()=>{if(!target.isConnected)return;target.dataset.impactTint='black-flame';const result=damageUnit(target,3,'fire');
        if(result.blocked){writeLog('<strong>'+name+'</strong>의 보호막이 검은 불꽃을 막았습니다.');return;}
        if(result.hp>0)applyEternalBlackFlame(target,'아마테라스');
        writeLog('<strong>아마테라스</strong>의 검은 불꽃이 <strong>'+name+'</strong>을 3 피해로 태우고, 대상이 죽을 때까지 이어지는 화상을 남겼습니다.');
        if(result.hp<=0)setTimeout(()=>target.remove(),650);
      },combatMs(450));
    }
    function freezeUnit(unit){if(!unit?.isConnected)return;unit.dataset.frozen='1';unit.classList.add('frozen');}
    function frostFx(targets,{shatter=true}={}){
      const live=targets.filter(t=>t?.isConnected);
      sfx('frost-cast');
      if(shatter)setTimeout(()=>sfx('frost-shatter'),combatMs(320));
      if(!live.length||typeof FrostBurst==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
      document.body.appendChild(canvas);
      const points=live.map(t=>{const r=t.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,size:Math.max(60,Math.min(130,r.width*.8))};});
      new FrostBurst(canvas,{points,duration:combatMs(1700)/1000,onEnd:()=>canvas.remove()}).start();
    }
    function castFrostNova(card){
      const novaDamage=Number(card?.dataset?.amount)||3,enemies=[...document.querySelectorAll('.arena .lane:first-child > .unit')];
      if(!enemies.length){writeLog('대상 하수인이 없어 <strong>프로스트 노바</strong> 효과가 적용되지 않았습니다.');return;}
      frostFx(enemies);
      setTimeout(()=>{enemies.forEach((unit,i)=>setTimeout(()=>{if(!unit.isConnected)return;const result=damageUnit(unit,novaDamage,'water');
        if(result.blocked)return;
        if(result.hp>0){freezeUnit(unit);showSkillEffect('shield',unit,'동결 · '+novaDamage+' 피해');}
        else setTimeout(()=>unit.remove(),650);
      },i*90));writeLog('<strong>프로스트 노바</strong>가 적 하수인 '+enemies.length+'장에게 '+novaDamage+' 피해를 주고 얼렸습니다.');},combatMs(450));
    }
    /* 불가침: 소환된 턴(상대 턴 포함)에는 모든 피해를 무효화하고, 다음 내 턴이 시작되면 풀린다 */
    const triggerBattlecryBeforeInvulnerable=triggerBattlecry;
    triggerBattlecry=function(unit){triggerBattlecryBeforeInvulnerable(unit);if(unit.dataset.effect==='turn-invulnerable'){unit.dataset.invulnerable='1';unit.classList.add('invulnerable');unit.title='이번 턴 무적';showSkillEffect('shield',unit,'불가침 · 이번 턴 무적');/* 소리는 showSkillEffect 가 낸다 — 여기서 또 부르면 같은 소리가 겹쳐 울린다 */}};
    const damageUnitBeforeInvulnerable=damageUnit;
    damageUnit=function(target,damage,element){if(target?.dataset?.invulnerable==='1'){const hp=Number(target.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,''))||0;guardImpact(target,damage,'invulnerable');/* 막은 순간은 방어 파쇄 연출·소리로 보여 준다 (2026-11-08) */writeLog('<strong>'+target.querySelector('h4').textContent+'</strong>은(는) 불가침 상태라 피해를 받지 않았습니다.');return {blocked:true,hp};}return damageUnitBeforeInvulnerable(target,damage,element);};
    const startPlayerTurnBeforeInvulnerable=startPlayerTurn;
    startPlayerTurn=function(button){startPlayerTurnBeforeInvulnerable(button);document.querySelectorAll('.unit[data-invulnerable]').forEach(unit=>{delete unit.dataset.invulnerable;unit.classList.remove('invulnerable');unit.removeAttribute('title');});};
    function heroHpOf(side){return side==='player'?playerHp:enemyHp;}
    function healPlayerHero(amount){const requested=Math.max(0,Number(amount)||0);if(!requested)return 0;const healed=Math.min(requested,HERO_MAX_HP-playerHp);playerHp+=healed;if(healed)updateHeroHealth();return healed;}
    function totalHealth(side,except=null){const lane=side==='player'?'.summon-zone':'.arena .lane:first-child',base=side==='player'?playerHp:enemyHp;return Math.max(0,base)+[...document.querySelectorAll(lane+' > .unit')].filter(unit=>unit!==except&&unit.dataset.destroyed!=='true').reduce((sum,unit)=>sum+(Number(unit.querySelector('.stats span:last-child')?.textContent.replace(/[^0-9]/g,''))||0),0);}
    const fieldAttackBeforePresentationGate=fieldAttack;
    /* 연출이 점유 중이면 교전을 미루되, (1) 미루는 동안에도 전투 큐에 '아직 바쁘다'고 알려 다음 하수인이 끼어들지 못하게 하고 (2) 재시도는 래퍼가 아니라 원본을 호출해 게이트가 중첩 재진입하지 않게 한다. 예전에는 래퍼가 자기 자신을 다시 불러 combatPresentationSlot이 매번 밀리고 호출 수가 불어나, 교전 간 0.3초 간격이 160ms 이하로 무너졌다 (2026-11-07) */fieldAttack=function(...args){const now=performance.now();if(fxBusy()||now<combatPresentationUntil){const runAt=Math.max(combatPresentationUntil,combatPresentationSlot||0)+240;combatPresentationSlot=runAt+900;const wait=Math.max(fxBusy()?160:0,runAt-now);markCombatBusy(wait);setTimeout(()=>{if(resultPending)return;if(fxBusy()){fieldAttack(...args);return;}combatPresentationSlot=0;fieldAttackBeforePresentationGate(...args);},wait);return;}combatPresentationSlot=0;return fieldAttackBeforePresentationGate(...args);};
    const castSpellWithoutMediumFx=castSpell;
    const castSpellAfterCut=function(card){if(['champion-control','frost-nova'].includes(card?.dataset?.effect))muteSfx(['spell','magic','hit:water'],1800);/* 빙결 소리(frostFx)만 남긴다 */const effect=card?.dataset?.effect,enemies=[...document.querySelectorAll('.arena .lane:first-child > .unit')],selfTargeted=['mana-ramp','cleanse'].includes(effect),target=selfTargeted?document.querySelector('.duel-hud .player .avatar'):(enemies[0]||document.querySelector('.duel-hud .enemy .avatar')),mapping={'mana-ramp':'arcane-circle',cleanse:'arcane-circle',bounce:'dark-orb','arcane-arrow':'dark-orb','champion-control':'light-blades','armor-pierce':'light-blades','hero-bolt':'flame-pillar'},spellName=card.querySelector('h3')?.textContent||'스킬',spellElement=getElement(card),semanticElement=spellEffectElement(effect,spellElement);/* 중앙 스킬 소개는 spellCinematicFor 가 효과보다 먼저 띄운다 */if(mapping[effect])showMediumSkillEffect(mapping[effect],target,spellName);if(effect==='black-flame'){castSpellWithoutMediumFx(card);return castBlackFlame(card);}if(effect==='frost-nova'){castSpellWithoutMediumFx(card);return castFrostNova(card);}if(effect==='champion-control'){const strongest=[...enemies].sort((a,b)=>Number(b.querySelector('.stats span').textContent.replace(/[^0-9]/g,''))-Number(a.querySelector('.stats span').textContent.replace(/[^0-9]/g,'')))[0];if(strongest)frostFx([strongest]);}return castSpellWithoutMediumFx(card);};
    /* 마법의 중앙 스킬 소개(SKILL ACTIVATION)를 고른다. 소개가 있는 마법은 모두 소개가 화면에서 내려간 뒤에 피해와 효과를 적용한다 (2026-11-08 PM).
       예전에는 광역 7장만 기다리고 나머지(종말의 파동 등)는 소개와 피해가 동시에 나갔다. 반환 함수는 소개가 끝날 때 resolve 되는 Promise 를 돌려준다. */
    function spellCinematicFor(card){const effect=card?.dataset?.effect,spellName=card?.querySelector('h3')?.textContent||'스킬',spellElement=getElement(card),semanticElement=spellEffectElement(effect,spellElement),variant=cinematicVariantFor(card?.dataset?.cardId||spellName),skill=(kind,v=1)=>()=>showCinematicSkillEffect(kind,spellName,v),spell=kind=>()=>{showSpellCinematicEffect(kind,spellName);return new Promise(resolve=>setTimeout(resolve,1700));};
      if(AOE_CINEMATIC[card?.dataset?.cardId])return ()=>playAoeCinematic(card);
      if(effect==='black-flame')return skill('eclipse');if(effect==='frost-nova'||effect==='champion-control'||(effect==='freeze-strongest'&&semanticElement==='ice'))return skill('frost');if(effect==='freeze-strongest')return skill('eclipse');
      if(effect==='board-damage')return skill(({fire:'fire',earth:'earth',ice:'frost',neutral:'eclipse',wind:'gust',water:'lightning',thunder:'lightning'})[spellElement]||'eclipse',variant);if(effect==='hero-bolt')return skill('fire');
      if(effect==='lightning-strike'||effect==='chain-lightning')return skill(({thunder:'lightning',fire:'fire',water:'lightning',wind:'gust',earth:'earth',ice:'frost'})[semanticElement]||'eclipse',variant);
      if(['heal-lowest','cleanse'].includes(effect))return spell('life');if(['mana-ramp','draw'].includes(effect))return spell('arcane');if(['bounce','resurrect','global-destroy'].includes(effect))return spell('void');
      if(['fire-infusion','comeback-flare'].includes(effect))return skill('fire');if(effect==='team-shield')return skill('earth');return null;}
    castSpell=function(card){const cut=spellCinematicFor(card);if(!cut)return castSpellAfterCut(card);return Promise.resolve(cut()).then(reason=>reason==='cleared'?undefined:castSpellAfterCut(card));};
    function takeOpeningHand(){return takeCards(deck,openingHandIndexes(deck)).map(entry=>entry.cardId);}
    if(!initialBattleCardIds.length)initialBattleCardIds.push(...takeOpeningHand());
    const initialHandNode=document.querySelector('.hand');initialHandNode.replaceChildren(...initialBattleCardIds.map(createRuntimeBattleCard));initialHandNode.querySelectorAll('.spell-card,.trap-card').forEach(applyMagicRole);
    document.querySelectorAll('.card').forEach(card=>card.addEventListener('click',()=>playCard(card)));
    document.querySelector('.magic-field')?.remove();
    document.querySelector('.hand-tab[data-filter="champion"]').childNodes[0].textContent='캐릭터 카드 ';
    const fieldActionDock=document.createElement('div');fieldActionDock.className='field-action-dock';document.querySelector('.stage-column').appendChild(fieldActionDock);const fieldUltimateAction=document.createElement('button');fieldUltimateAction.type='button';fieldUltimateAction.id='field-ultimate-action';fieldUltimateAction.className='field-ultimate-action';fieldUltimateAction.hidden=true;fieldUltimateAction.addEventListener('pointerdown',event=>{if(event.button!==0)return;fireUltimateAction(event);});fieldUltimateAction.addEventListener('click',event=>{if(event.detail===0)fireUltimateAction(event);});fieldActionDock.appendChild(fieldUltimateAction);const fieldGuardianUltimate=document.createElement('button');fieldGuardianUltimate.type='button';fieldGuardianUltimate.id='field-guardian-ultimate';fieldGuardianUltimate.className='field-guardian-ultimate';fieldGuardianUltimate.hidden=true;fieldGuardianUltimate.onclick=()=>activateGuardianAwakening();fieldActionDock.appendChild(fieldGuardianUltimate);/* 오라 각성과 영웅 강림 버튼 사이의 문양 자리 (2026-11-09 PM 요청). 각성 전에는 빈 홈, 각성 뒤에는 내 오라 문양이 들어앉는다. */const auraSigilSlot=document.createElement('div');auraSigilSlot.className='aura-sigil-slot';auraSigilSlot.setAttribute('aria-hidden','true');auraSigilSlot.innerHTML='<i class="ass-ring"></i><i class="ass-ring ass-inner"></i><img alt="">';fieldActionDock.appendChild(auraSigilSlot);
    const ultimatePanel=document.createElement('div');ultimatePanel.id='ultimate-panel';ultimatePanel.className='ultimate-panel';document.querySelector('.hand-tabs').after(ultimatePanel);
    function playCardByDrop(card,destination='field'){if(!card?.isConnected||battlePhase!=='setup')return;if(destination==='field')ultimateArmed=false;document.querySelectorAll('.hand .card').forEach(item=>item.classList.remove('selected'));card.classList.add('selected');playCard(card);}
    function clearCardDropState(){document.querySelectorAll('.drag-over,.drop-ready').forEach(node=>node.classList.remove('drag-over','drop-ready'));draggedUltimateCard?.classList.remove('selected');draggedUltimateCard=null;}
    const handElement=document.querySelector('.hand'),summonDropZone=document.querySelector('.summon-zone');handElement.addEventListener('dragstart',event=>{const card=event.target.closest('.card');if(!card||battlePhase!=='setup'){event.preventDefault();return;}draggedUltimateCard=card;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.dataset.cardId||card.querySelector('h3')?.textContent||'card');card.classList.add('selected');});handElement.addEventListener('dragend',clearCardDropState);summonDropZone.addEventListener('dragover',event=>{if(draggedUltimateCard&&cardCategory(draggedUltimateCard)==='champion'){event.preventDefault();event.dataTransfer.dropEffect='move';summonDropZone.classList.add('drop-ready');}});summonDropZone.addEventListener('dragleave',event=>{if(!summonDropZone.contains(event.relatedTarget))summonDropZone.classList.remove('drop-ready');});summonDropZone.addEventListener('drop',event=>{event.preventDefault();const card=draggedUltimateCard,target=event.target.closest?.('.summon-zone .unit');document.querySelectorAll('.replace-target').forEach(n=>n.classList.remove('replace-target'));clearCardDropState();if(card&&cardCategory(card)==='champion'){if(target&&target.dataset.destroyed!=='true')replaceFieldUnit(card,target);else playCardByDrop(card);}});summonDropZone.addEventListener('dragover',event=>{if(!draggedUltimateCard||cardCategory(draggedUltimateCard)!=='champion')return;const target=event.target.closest?.('.summon-zone .unit');document.querySelectorAll('.replace-target').forEach(n=>{if(n!==target)n.classList.remove('replace-target');});if(target)target.classList.add('replace-target');});ultimatePanel.addEventListener('dragenter',event=>{if(draggedUltimateCard&&cardCategory(draggedUltimateCard)==='champion'&&!ultimateState&&!ultimateUsed){event.preventDefault();ultimatePanel.classList.add('drag-over');}});ultimatePanel.addEventListener('dragover',event=>{if(draggedUltimateCard&&cardCategory(draggedUltimateCard)==='champion'&&!ultimateState&&!ultimateUsed){event.preventDefault();event.dataTransfer.dropEffect='move';}});ultimatePanel.addEventListener('dragleave',event=>{if(!ultimatePanel.contains(event.relatedTarget))ultimatePanel.classList.remove('drag-over');});ultimatePanel.addEventListener('drop',event=>{event.preventDefault();const card=draggedUltimateCard;clearCardDropState();if(card&&card.isConnected&&cardCategory(card)==='champion'&&!ultimateState&&!ultimateUsed)setUltimate(card);});
    function finishFieldReorder(){if(!draggedFieldUnit)return;draggedFieldUnit.classList.remove('field-dragging');summonDropZone.classList.remove('reordering');draggedFieldUnit=null;if(fieldOrderDirty){fieldOrderDirty=false;sfx('card-place','champion');writeLog('내 전장 순서를 변경했습니다. <strong>가장 왼쪽 카드가 먼저 공격받습니다.</strong>');}}
    summonDropZone.addEventListener('dragstart',event=>{const unit=event.target.closest('.unit');if(!unit||battlePhase!=='setup'||unit.dataset.orderLocked==='true'){if(unit)event.preventDefault();return;}draggedFieldUnit=unit;fieldOrderDirty=false;unit.classList.add('field-dragging');summonDropZone.classList.add('reordering');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',unit.querySelector('h4')?.textContent||'unit');});summonDropZone.addEventListener('dragover',event=>{if(!draggedFieldUnit)return;event.preventDefault();event.stopPropagation();const target=event.target.closest('.unit');if(target?.dataset.orderLocked==='true')return;if(!target||target===draggedFieldUnit){if(event.target===summonDropZone&&draggedFieldUnit!==summonDropZone.lastElementChild){summonDropZone.appendChild(draggedFieldUnit);fieldOrderDirty=true;}const locked=summonDropZone.querySelector(':scope > .unit[data-order-locked="true"]');if(locked&&summonDropZone.lastElementChild!==locked)summonDropZone.append(locked);return;}const rect=target.getBoundingClientRect(),after=event.clientX>rect.left+rect.width/2,next=after?target.nextSibling:target;if(next!==draggedFieldUnit){summonDropZone.insertBefore(draggedFieldUnit,next);fieldOrderDirty=true;}const locked=summonDropZone.querySelector(':scope > .unit[data-order-locked="true"]');if(locked&&summonDropZone.lastElementChild!==locked)summonDropZone.append(locked);});summonDropZone.addEventListener('drop',event=>{if(!draggedFieldUnit)return;event.preventDefault();event.stopPropagation();finishFieldReorder();});summonDropZone.addEventListener('dragend',finishFieldReorder);
    const enemyHudTarget=document.querySelector('.duel-hud .enemy'),enemyLaneTarget=document.querySelector('.arena .lane:first-child');enemyHudTarget.querySelector('.avatar').removeAttribute('onclick');enemyHudTarget.addEventListener('click',()=>attackFace(enemyHudTarget));function updateEnemyFieldTarget(){enemyLaneTarget.classList.toggle('field-empty',enemyLaneTarget.querySelectorAll('.unit').length===0);}enemyLaneTarget.addEventListener('click',event=>{if(enemyLaneTarget.querySelectorAll('.unit').length===0&&(event.target===enemyLaneTarget||event.target.classList.contains('lane-label')))attackFace(enemyHudTarget);});
    enemyHudTarget.addEventListener('click',event=>{const leftmost=enemyLaneTarget.querySelector(':scope > .unit:not([data-destroyed="true"])');if(leftmost){event.stopImmediatePropagation();attack(leftmost);}},true);
    const magicSetup=document.createElement('div');magicSetup.className='magic-setting-panel';magicSetup.hidden=true;magicSetup.setAttribute('aria-label','함정카드 세팅');magicSetup.innerHTML='<div class="setting-title"><strong>함정카드 세팅</strong><span>마법은 손패에서 더블클릭</span></div><div class="set-zones"><button class="set-slot trap-slot" id="magic-slot-0" onclick="activateSetMagic(0)"><strong>함정 · 비어 있음</strong><span class="slot-empty">함정카드 대기</span></button></div>';ultimatePanel.after(magicSetup);document.querySelector('.arena').appendChild(fieldActionDock);magicSetup.addEventListener('dragover',event=>{if(draggedUltimateCard&&cardCategory(draggedUltimateCard)==='spell'&&freeMagicSlot(magicKindOfCard(draggedUltimateCard))>=0){event.preventDefault();event.dataTransfer.dropEffect='move';magicSetup.classList.add('drop-ready');}});magicSetup.addEventListener('dragleave',event=>{if(!magicSetup.contains(event.relatedTarget))magicSetup.classList.remove('drop-ready');});magicSetup.addEventListener('drop',event=>{event.preventDefault();const card=draggedUltimateCard;clearCardDropState();if(card&&cardCategory(card)==='spell')playCardByDrop(card);});syncSettingPanelVisibility();
    const initialManaHud=document.createElement('div');initialManaHud.id='mana-hud';initialManaHud.className='mana-hud';document.querySelector('.stage-column').appendChild(initialManaHud);const surrenderAction=document.createElement('button');surrenderAction.id='surrender-action';surrenderAction.className='surrender-action';surrenderAction.textContent='기권';surrenderAction.title='전투 기권';surrenderAction.setAttribute('aria-label','전투 기권');surrenderAction.onclick=()=>surrenderBattle(surrenderAction);document.querySelector('.stage-column').appendChild(surrenderAction);renderMana();updateDrawAction();updateHandTabs();
    function stampNewUnits(){document.querySelectorAll('.arena .unit:not([data-deployed-turn])').forEach(unit=>{unit.dataset.deployedTurn=String(turnNumber);});}
    /* 수적 열세 컨셉: swarm-fury는 적 3/4/5/6장에서 공격 +1/+3/+7/+12로 가속, swarm-bulwark는 적 2장당 받는 피해 −1(최대 −3). */
    const SWARM_FURY_CAP=12,SWARM_BULWARK_CAP=3;
    function opposingCount(unit){const enemyLane=document.querySelector('.arena .lane:first-child'),isEnemy=unit.parentElement===enemyLane,opposing=isEnemy?document.querySelectorAll('.summon-zone > .unit'):enemyLane.querySelectorAll(':scope > .unit');return [...opposing].filter(target=>target.dataset.destroyed!=='true').length;}
    function updateSwarmBonuses(){document.querySelectorAll('.arena .unit[data-effect="swarm-fury"]').forEach(unit=>{if(unit.dataset.destroyed==='true')return;const count=opposingCount(unit),bonus=Math.min(SWARM_FURY_CAP,count<3?0:Math.pow(2,count-2)-1),old=Number(unit.dataset.swarmBonus)||0;if(bonus===old)return;const atk=unit.querySelector('.stats span:first-child');unit.dataset.swarmBonus=String(bonus);unit.classList.toggle('swarm-active',bonus>0);atk.textContent='⚔ '+Math.max(0,Number(atk.textContent.replace(/[^0-9]/g,''))+bonus-old);if(bonus>old)showSkillEffect('rush',unit,'군중 격분 · 적 '+count+'장 · 공격 +'+bonus);});}
    const damageUnitBeforeSwarm=damageUnit;
    damageUnit=function(target,damage,element){if(target.dataset.effect==='swarm-bulwark'&&damage>0){const reduction=Math.min(SWARM_BULWARK_CAP,Math.floor(opposingCount(target)/2));if(reduction>0){damage=Math.max(1,damage-reduction);showSkillEffect('shield',target,'철벽 · 피해 −'+reduction);}}return damageUnitBeforeSwarm(target,damage,element);};

    /* 성격 오라 5종. 내부 키는 기존 저장 데이터와 QA 주소 호환을 위해 유지한다. */
    const PERSONALITY_AURAS={
      cheongryong:{name:'물의 오라',label:'물',title:'포용',seal:'물',color:'#4fb8ff',sigil:'assets/auras/water-sigil.svg',chance:.27,manaMin:1,manaMax:2,short:'마나 회복',desc:'비용 2 이상 카드를 낼 때 {p}% 확률로 마나 {min}~{max} 회복',child:'포용의 아이',traits:'유연 · 차분',mood:'흐르듯 받아들이고, 여유를 잃지 않는 성격'},
      jujak:{name:'불의 오라',label:'불',title:'열정',seal:'불',color:'#ff6a4a',sigil:'assets/auras/fire-sigil.svg',chance:.30,burnDamage:1,burnTurns:2,short:'화상',desc:'기본 공격·반격으로 피해를 주고 생존한 적 하수인에게 {p}% 확률로 2턴간 화상 · 대상 턴 시작마다 피해 1',child:'열정의 아이',traits:'대담 · 승부욕',mood:'뜨겁게 앞장서고, 꺼지지 않는 불길을 남기는 성격'},
      namu:{name:'나무의 오라',label:'나무',title:'발전',seal:'목',color:'#5fd38a',sigil:'assets/auras/wood-sigil.svg',chance:.78,short:'체력 성장',desc:'내 턴 시작 시 필드의 카드마다 {p}% 확률로 체력 +1',child:'성장의 아이',traits:'성장 · 끈기',mood:'천천히 뿌리내려, 곁의 동료와 함께 자라는 성격'},
      baekho:{name:'금속의 오라',label:'금속',title:'냉철',seal:'금',color:'#cfd8e6',sigil:'assets/auras/metal-sigil.svg',survivalStep:.26,maxChance:.90,attackGain:4,short:'전투 경험',desc:'내 턴 시작 시 맨 왼쪽 하수인이 생존한 턴마다 발동 확률 +26%p(최대 90%) · 성공 시 배틀 중 1회 공격력 +4',child:'냉철의 아이',traits:'단련 · 숙련',mood:'전장에서 버틴 경험을 날카로운 힘으로 단련하는 성격'},
      hyeonmu:{name:'대지의 오라',label:'대지',title:'무던',seal:'땅',color:'#d9a35b',sigil:'assets/auras/earth-sigil.svg',chance:.015,maxProcs:1,short:'치명타 생존',desc:'내 하수인이 치명 피해를 받을 때마다 {p}% 확률로 체력 1로 생존 (한 판 최대 1회)',child:'무던의 아이',traits:'인내 · 듬직',mood:'묵묵히 버티며, 끝까지 무너지지 않는 성격'}
    };
    const GUARDIANS=PERSONALITY_AURAS;/* TODO(save-v2): 외부 저장 키 마이그레이션 전까지 유지하는 읽기 호환 별칭 */
    const auraPercent=value=>Number((Number(value||0)*100).toFixed(1));
    const guardianDesc=id=>GUARDIANS[id].desc.replace('{p}',auraPercent(GUARDIANS[id].chance)).replace('{r}',auraPercent(GUARDIANS[id].ratio)).replace('{u}',auraPercent(GUARDIANS[id].unitChance)).replace('{m}',GUARDIANS[id].mana||'').replace('{min}',GUARDIANS[id].manaMin||'').replace('{max}',GUARDIANS[id].manaMax||'');
    const PVC_CLEAR_CRACKER_REWARD=200,VICTORY_COOKIE_REWARD=10;
    const guardianProcs={player:0,enemy:0};/* 저장 호환 변수명. guardianProcs는 대지 오라 치명타 생존 발동 횟수 */
    const guardianOfSide=side=>side==='player'?playerGuardian:enemyGuardian,sideOfUnit=unit=>unit.closest('.summon-zone')?'player':'enemy';
    const GUARDIAN_AWAKEN_HP=ULTIMATE_UNLOCK_HP;
    const GUARDIAN_AWAKEN_OPTIONS={
      jujak:{A:{name:'불길 확산',chance:.40,burnDamage:1,burnTurns:5,desc:'기본 공격·반격으로 생존한 적 하수인에게 40% 확률로 5턴간 화상 · 대상 턴 시작마다 피해 1',ui:['기본 공격·반격 적중 시 40% 확률로 화상','5턴간 대상 턴 시작마다 피해 1']},B:{name:'업화',chance:.20,burnDamage:3,burnTurns:2,desc:'기본 공격·반격으로 생존한 적 하수인에게 20% 확률로 2턴간 업화 · 대상 턴 시작마다 피해 3',ui:['기본 공격·반격 적중 시 20% 확률로 업화','2턴간 대상 턴 시작마다 피해 3']}},
      cheongryong:{A:{name:'범람',chance:.045,manaMin:7,manaMax:7,desc:'비용 2 이상 카드 사용 시 4.5% 확률로 마나 7 회복',ui:['비용 2 이상 카드 사용 시','4.5% 확률로 마나 7 회복']},B:{name:'순환',chance:.27,manaMin:2,manaMax:2,desc:'비용 2 이상 카드 사용 시 27% 확률로 마나 2 회복',ui:['비용 2 이상 카드 사용 시','27% 확률로 마나 2 회복']}},
      namu:{A:{name:'숲의 생명',chance:1,hpGain:2,desc:'내 턴 시작 시 전장에 있는 모든 아군의 최대·현재 체력 +2',ui:['내 턴 시작 시','모든 아군 최대·현재 체력 +2']},B:{name:'거목 수호',chance:.35,hpGain:5,leftmostOnly:true,desc:'내 턴 시작 시 35% 확률로 가장 왼쪽 아군의 최대·현재 체력 +5',ui:['내 턴 시작 시 35% 확률로','가장 왼쪽 아군 최대·현재 체력 +5']}},
      baekho:{A:{name:'숙련 가속',survivalStep:.42,maxChance:1,attackGain:4,desc:'맨 왼쪽 하수인의 생존 턴당 확률 +42%p(최대 100%) · 성공 시 배틀 중 1회 공격력 +4',ui:['생존 턴당 발동 확률 +42%p · 최대 100%','성공 시 배틀 중 1회 공격력 +4']},B:{name:'연속베기',continuousSlashChance:.10,continuousSlashRatio:.5,desc:'기본 공격 시 10% 확률로 다른 적 하수인을 우선해 공격력 50%로 한 번 더 베기 · 다른 적이 없으면 같은 대상 재공격',ui:['기본 공격 시 10% · 공격력 50% 추가 베기','다른 적 우선 · 없으면 같은 대상 재공격']}},
      hyeonmu:{A:{name:'암반 피부',chance:.12,damageReduction:1,minCost:4,desc:'4코스트 이상 아군이 피해를 받을 때 12% 확률로 피해 1 감소 · 최소 피해 1',ui:['4코스트 이상 아군이 피해를 받을 때','12% 확률로 피해 1 감소 · 최소 피해 1']},B:{name:'절대방어',chance:.012,avoidDamage:true,desc:'피해를 받을 때 1.2% 확률로 피해를 완전히 무효화',ui:['피해를 받을 때 1.2% 확률로','해당 피해 완전 무효화']}}
    };
    let guardianAwakenUsed=false,guardianAwakenChoice=null,enemyGuardianAwakenChoice=null,guardianAwakenPrompted=false;
    const guardianAwakenChoiceOf=side=>side==='player'?guardianAwakenChoice:enemyGuardianAwakenChoice;
    const guardianAwakenActive=side=>Boolean(guardianAwakenChoiceOf(side));
    const guardianAuraConfig=(side,id)=>guardianAwakenActive(side)&&guardianOfSide(side)===id?GUARDIAN_AWAKEN_OPTIONS[id][guardianAwakenChoiceOf(side)]:GUARDIANS[id];
    const guardianFieldCounts=()=>({enemy:document.querySelectorAll('.arena .lane:first-child > .unit:not([data-destroyed="true"])').length,player:document.querySelectorAll('.arena .summon-zone > .unit:not([data-destroyed="true"])').length});
    const guardianFieldDeficit=()=>{const counts=guardianFieldCounts();return Math.max(0,counts.enemy-counts.player);};
    const guardianAwakenPower=()=>1+guardianFieldDeficit();
    const guardianProcChance=(side,id)=>Number(guardianAuraConfig(side,id).chance||0);
    function guardianProc(side,id){return guardianOfSide(side)===id&&engineAdapter.random()<guardianProcChance(side,id);}
    /* 불의 오라: 기본 공격·반격으로 피해를 받고 살아남은 하수인에게 지속 화상을 남긴다. 소환사에게는 적용하지 않고 중첩하지 않는다. */
    /* 상태 배지를 카드 안에서 1열 n행으로 쌓는다. 두 배지가 각자 top 고정값을 갖고 있어
       동시에 붙으면 같은 높이에 겹쳐 글자를 못 읽었다. DOM 순서를 생존→화상으로 고정하고
       CSS 형제 규칙(.metal-experience-badge~.aura-burn-badge)이 두 번째 행을 내린다.
       추가 순서가 발동 시점에 따라 뒤바뀔 수 있어 매번 정렬한다 (2026-11-07) */
    const UNIT_BADGE_ORDER=['.metal-experience-badge','.aura-burn-badge'];
    function stackUnitBadges(unit){if(!unit)return;UNIT_BADGE_ORDER.forEach(sel=>{const badge=unit.querySelector(':scope > '+sel);if(badge)unit.appendChild(badge);});}

    function syncAuraBurnVfx(target){if(!target?.classList?.contains('unit'))return;target.querySelector(':scope > .aura-burn-vfx')?.remove();target.querySelector(':scope > .aura-burn-badge')?.remove();const eternalDamage=Number(target.dataset.eternalBurn)||0,eternalTurns=Number(target.dataset.eternalBurnTurns)||0,auraDamage=Number(target.dataset.auraBurn)||0,turns=Number(target.dataset.auraBurnTurns)||0,burn=Number(target.dataset.burn)||0;if(!burn&&(!auraDamage||!turns)&&(!eternalDamage||!eternalTurns))return;const flames=document.createElement('span'),badge=document.createElement('b');flames.className='aura-burn-vfx';flames.setAttribute('aria-hidden','true');badge.className='aura-burn-badge';const burnText=eternalDamage&&eternalTurns?'꺼지지 않는 불꽃 −'+eternalDamage:auraDamage&&turns?(auraDamage>1?'업화':'화상')+' −'+auraDamage+' · '+turns+'턴':'화상 −'+burn+' · 전투 후';/* 배지 글자는 안쪽 span 에 넣는다 — 바깥은 1열 스택의 한 '행'이라 폭이 카드 전체다 (2026-11-07) */const burnLine=document.createElement('span');burnLine.textContent=burnText;badge.appendChild(burnLine);target.append(flames,badge);stackUnitBadges(target);target.setAttribute('aria-label',(target.querySelector('h4')?.textContent||'하수인')+' · '+burnText);}
    function clearAuraBurn(target){if(!target)return;delete target.dataset.auraBurn;delete target.dataset.auraBurnTurns;target.style.outline='';syncAuraBurnVfx(target);}
    function applyEternalBlackFlame(target,source='아마테라스'){if(!target?.isConnected||target.dataset.destroyed==='true')return false;target.dataset.eternalBurn='3';target.dataset.eternalBurnTurns='99';target.style.outline='2px solid #c4161f';syncAuraBurnVfx(target);/* 아마테라스는 일반 붉은 화상과 구분되는 검은 불꽃 연출을 쓴다 (2026-11-08, 유저·컴퓨터 동일) */showSkillEffect('black-flame',target,'꺼지지 않는 불꽃 · 턴 시작 −3');writeLog('<strong>'+source+'</strong>: <strong>'+target.querySelector('h4').textContent+'</strong>에게 정화할 수 없는 꺼지지 않는 불꽃을 남겼습니다.');return true;}
    function applyAuraBurn(side,target){if(!target?.isConnected||target.dataset.destroyed==='true')return false;if(!guardianProc(side,'jujak'))return false;const config=guardianAuraConfig(side,'jujak'),damage=config.burnDamage||1,turns=config.burnTurns||2,label=guardianAwakenActive(side)?config.name:'화상';target.dataset.auraBurn=String(Math.max(Number(target.dataset.auraBurn)||0,damage));target.dataset.auraBurnTurns=String(Math.max(Number(target.dataset.auraBurnTurns)||0,turns));syncAuraBurnVfx(target);showSkillEffect('burn',target,label+' · '+turns+'턴 · 턴 시작 −'+damage);showAwakeningProc(side,'jujak',label,turns+'턴간 턴 시작마다 피해 '+damage,target);writeLog('<strong>'+(side==='player'?'내':'상대')+' '+GUARDIANS.jujak.name+'</strong>이 <strong>'+target.querySelector('h4').textContent+'</strong>에게 '+label+'을 남겼습니다. ('+turns+'턴간 턴 시작마다 피해 '+damage+')');return true;}
    const resolveDuelBeforeAuraBurn=resolveDuel;
    resolveDuel=function(attacker,defender,options={}){const attackerSide=attacker?.isConnected?sideOfUnit(attacker):null,beforeHp=Number(defender?.querySelector('.stats span:last-child')?.textContent.replace(/[^0-9]/g,''))||0;resolveDuelBeforeAuraBurn(attacker,defender,options);if(attackerSide&&guardianOfSide(attackerSide)==='jujak')setTimeout(()=>{const afterHp=Number(defender?.querySelector('.stats span:last-child')?.textContent.replace(/[^0-9]/g,''))||0;if(defender?.isConnected&&defender.dataset.destroyed!=='true'&&afterHp>0&&afterHp<beforeHp)applyAuraBurn(attackerSide,defender);},combatMs(470));};
    const guardianEmblem=(id,size)=>'<span class="gd-emblem gd-'+id+'" style="--s:'+size+'px"><img src="'+GUARDIANS[id].sigil+'" alt="'+GUARDIANS[id].name+' 문양"></span>';
    function updateGuardianChips(){[['player',playerGuardian],['enemy',enemyGuardian]].forEach(([side,id])=>{const chip=document.querySelector('#'+side+'-guardian-chip'),avatar=document.querySelector('.duel-hud .'+side+' .avatar'),name=id&&(GUARDIANS[id].child||GUARDIANS[id].name);if(chip){chip.hidden=!id;if(id){chip.style.paddingLeft='9px';chip.innerHTML='<span>'+name+'</span>';chip.title='성격 오라 '+name+' · '+guardianDesc(id);}}if(avatar&&id){avatar.className='avatar gd-avatar gd-'+id;avatar.innerHTML=auraMark(id);avatar.title='성격 오라 '+name;}});}
    const AWAKENING_PROC_COLORS={jujak:'#ff6a4a',cheongryong:'#4fb8ff',namu:'#5fd38a',baekho:'#dce8f5',hyeonmu:'#d9a35b'};
    // 오라 발동 알림은 가운데 오라 각성·궁극기 버튼 줄을 가리지 않도록 발동한 진영의 전장 안쪽 바깥 가장자리에 띄운다 (2026-11-08).
    function placeAwakeningProcBanner(banner,side){const lanes=document.querySelectorAll('.arena > .lane'),lane=side==='player'?lanes[1]:lanes[0];if(!lane)return;const r=lane.getBoundingClientRect(),h=banner.offsetHeight||52,pad=14;banner.style.setProperty('--proc-x',(r.left+r.width/2)+'px');banner.style.setProperty('--proc-y',(side==='player'?r.bottom-pad-h/2:r.top+pad+h/2)+'px');}
    function showAwakeningProc(side,id,title,detail,target){if(!guardianAwakenActive(side)||guardianOfSide(side)!==id)return;document.querySelectorAll('.awakening-proc-banner').forEach(node=>node.remove());const banner=document.createElement('div');banner.className='awakening-proc-banner '+(side==='player'?'proc-player':'proc-enemy');banner.style.setProperty('--proc-color',AWAKENING_PROC_COLORS[id]||'#fff');banner.innerHTML='<b></b><span></span>';banner.querySelector('b').textContent=(side==='player'?'':'상대 · ')+title;banner.querySelector('span').textContent=detail;fxPresent('awaken-banner:'+id,()=>{document.body.appendChild(banner);syncFieldFrame();placeAwakeningProcBanner(banner,side);if(target)borderImpact(target,AWAKENING_PROC_COLORS[id]);return ()=>banner.remove();},{priority:FX_PRIORITY.banner,hold:1400});const sound={jujak:['spell','offense'],cheongryong:['spell','heal'],namu:['spell','heal'],baekho:['shield','neutral'],hyeonmu:['shield','neutral']}[id];if(sound)sfx(sound[0],sound[1],5);}
    const showAwakeningProcBeforeTiming=showAwakeningProc;
    showAwakeningProc=function(side,id,...rest){if(guardianAwakenActive(side)&&guardianOfSide(side)===id)markCombatBusy(1400);return showAwakeningProcBeforeTiming(side,id,...rest);};
    const resolveDuelBeforeContinuousSlash=resolveDuel;
    resolveDuel=function(attacker,defender,options={}){const side=attacker?.isConnected?sideOfUnit(attacker):null,metal=side&&guardianAuraConfig(side,'baekho'),canChain=side&&guardianOfSide(side)==='baekho'&&metal.continuousSlashRatio&&!options.continuousSlash&&!/^sweep-/.test(attacker.dataset.effect||'')&&engineAdapter.random()<(metal.continuousSlashChance??1);resolveDuelBeforeContinuousSlash(attacker,defender,options);if(!canChain)return;markCombatBusy(combatMs(1150));setTimeout(()=>{if(!attacker?.isConnected||attacker.dataset.destroyed==='true'||resultPending)return;const opponents=[...document.querySelectorAll(side==='player'?'.arena .lane:first-child > .unit:not([data-destroyed="true"])':'.summon-zone > .unit:not([data-destroyed="true"])')],next=opponents.find(unit=>unit!==defender)||opponents.find(unit=>unit===defender);if(!next)return;showAwakeningProc(side,'baekho','연속베기',next===defender?'같은 대상을 한 번 더 베기':'다른 적에게 베기 연계',attacker);writeLog('<strong>'+(side==='player'?'내':'상대')+' 연속베기:</strong> <strong>'+attacker.querySelector('h4').textContent+'</strong>이(가) '+(next===defender?'같은 대상':'다른 적 '+next.querySelector('h4').textContent)+'에게 공격력 50%의 추가 타격을 이어갑니다.');resolveDuel(attacker,next,{ratio:metal.continuousSlashRatio,noCounter:true,continuousSlash:true});},combatMs(650));};
    function showShatterResonance(defender,targets,power,side){const arena=document.querySelector('.arena');if(!arena||!defender?.isConnected)return;markCombatBusy(950);document.querySelectorAll('.shatter-resonance-fx').forEach(node=>node.remove());const field=arena.getBoundingClientRect(),origin=defender.getBoundingClientRect(),fx=document.createElement('div');fx.className='shatter-resonance-fx';fx.style.setProperty('--sx',((origin.left+origin.width/2-field.left)/Math.max(1,field.width)*100)+'%');fx.style.setProperty('--sy',((origin.top+origin.height/2-field.top)/Math.max(1,field.height)*100)+'%');fx.innerHTML=Array.from({length:8},(_,i)=>'<i style="--a:'+(i*45)+'deg"></i>').join('')+'<strong>파쇄 공명 · 적 전체 −'+power+'</strong>';document.body.appendChild(fx);arena.classList.remove('impact');void arena.offsetWidth;arena.classList.add('impact');slowCombatAnimations(arena);playAudio('metal',.72,.68);noise(.18,.07,920);tone(92,.4,'sawtooth',.08,42);targets.forEach(target=>borderImpact(target,AWAKENING_PROC_COLORS.baekho));writeLog('<strong>'+(side==='player'?'내':'상대')+' 파쇄 공명 발동:</strong> 금속 충격파가 적 전장 전체에 피해 '+power+'을 가합니다.');setTimeout(()=>fx.remove(),950);}
    function guardianCounter(attacker,defender){const side=sideOfUnit(defender),attack=Number(defender.querySelector('.stats span:first-child').textContent.replace(/[^0-9]/g,''))||0,metalAura=guardianAuraConfig(side,'baekho'),power=metalAura.aoeDamage||Math.max(metalAura.minDamage||1,Math.min(metalAura.maxDamage,Math.ceil(attack*metalAura.ratio))),name=defender.querySelector('h4').textContent,aoe=Boolean(metalAura.aoeDamage);if(attack<=0)return;const targets=aoe?[...document.querySelectorAll(side==='player'?'.arena .lane:first-child > .unit:not([data-destroyed="true"])':'.summon-zone > .unit:not([data-destroyed="true"])')]:[attacker];showSkillEffect('rush',defender,GUARDIANS.baekho.name+' · '+(metalAura.name||'허점 반격')+' '+power);if(aoe)showShatterResonance(defender,targets,power,side);else showAwakeningProc(side,'baekho',metalAura.name||'절단 반격','공격자에게 피해 '+power,defender);writeLog('<strong>'+(side==='player'?'내':'상대')+' '+GUARDIANS.baekho.name+'</strong>의 '+(metalAura.name||'허점 반격')+'으로 <strong>'+name+'</strong>이(가) '+(aoe?'적 전장 전체':'공격자')+'에 피해 '+power+' 반격을 가합니다.');setTimeout(()=>{targets.forEach((target,index)=>{if(!target?.isConnected||target.dataset.destroyed==='true')return;setTimeout(()=>{if(!target?.isConnected||target.dataset.destroyed==='true')return;const result=damageUnit(target,power,getElement(defender));if(!result.blocked&&result.hp<=0){target.dataset.destroyed='true';triggerDeathrattle(target);setTimeout(()=>target.remove(),700);}},aoe?index*90:0);});},aoe?520:320);}
    const guardianCounterImmediate=guardianCounter;
    guardianCounter=function(attacker,defender){scheduleCombatStep(()=>{if(attacker?.isConnected&&defender?.isConnected&&attacker.dataset.destroyed!=='true'&&defender.dataset.destroyed!=='true')guardianCounterImmediate(attacker,defender);},COMBAT_TIMING.guardianReaction);};
    /* 빙결 타격은 물 계열 질감을 공유하지만, 번개는 전용 낙뢰음을 사용한다. */
    const sfxBeforeElementAlias=sfx,SFX_ELEMENT_ALIAS={ice:'water'};
    sfx=function(kind,variant,...rest){if(kind==='hit'&&variant==='thunder'){if(soundOn)fateSfx.playLightning(hitPan);return;}return sfxBeforeElementAlias(kind,SFX_ELEMENT_ALIAS[variant]||variant,...rest);};
    const damageUnitBeforeGuardian=damageUnit;
    damageUnit=function(target,damage,element){if(absoluteDefense&&target.closest&&sideOfUnit(target)==='player'){guardImpact(target,damage,'absolute');writeLog('<strong>'+target.querySelector('h4').textContent+'</strong>은(는) 절대방어로 피해를 받지 않았습니다.');return {blocked:true,hp:Number(target.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,''))};}const side=sideOfUnit(target),hp=Number(target.querySelector('.stats span:last-child').textContent.replace(/[^0-9]/g,''))||0,pierced=target.dataset.survivePierced==='true',earth=guardianAuraConfig(side,'hyeonmu'),eligibleCost=Number(target.dataset.cost||0)>=(earth.minCost||0);delete target.dataset.survivePierced;if(damage>0&&earth.damageReduction&&eligibleCost&&target.dataset.shield!=='true'&&target.dataset.destroyed!=='true'&&guardianProc(side,'hyeonmu')){damage=Math.max(1,damage-earth.damageReduction);showSkillEffect('shield',target,'암반 피부 · 피해 −'+earth.damageReduction);showAwakeningProc(side,'hyeonmu','암반 피부','받는 피해 −'+earth.damageReduction,target);writeLog('<strong>'+(side==='player'?'내':'상대')+' 암반 피부 발동:</strong> '+target.querySelector('h4').textContent+'이(가) 받는 피해를 '+earth.damageReduction+' 줄였습니다.');}if(damage>0&&earth.avoidDamage&&target.dataset.shield!=='true'&&target.dataset.destroyed!=='true'&&guardianProc(side,'hyeonmu')){guardImpact(target,damage,'absolute');showAwakeningProc(side,'hyeonmu','절대방어','해당 피해 완전 무효화',target);writeLog('<strong>'+(side==='player'?'내':'상대')+' 대지의 아이 · 절대방어:</strong> '+target.querySelector('h4').textContent+'이(가) 피해를 완전히 무효화했습니다.');return {blocked:true,hp};}if(damage>0&&!pierced&&earth.maxProcs&&target.dataset.shield!=='true'&&target.dataset.destroyed!=='true'&&target.closest&&guardianProcs[side]<earth.maxProcs&&damage>=hp&&guardianProc(side,'hyeonmu')){guardianProcs[side]++;damage=Math.max(0,hp-1);showSkillEffect('shield',target,GUARDIANS.hyeonmu.name+' · 체력 1로 생존');writeLog('<strong>'+(side==='player'?'내':'상대')+' 대지의 아이 · 불굴:</strong> <strong>'+target.querySelector('h4').textContent+'</strong>이(가) 치명 피해를 버텼습니다.');}return damageUnitBeforeGuardian(target,damage,element);};
    const playCardBeforeGuardian=playCard;
    const rollPoseidonMana=side=>{const config=guardianAuraConfig(side,'cheongryong');return engineAdapter.randomInt(config.manaMin,config.manaMax);};
    playCard=function(card){const before=mana,cost=Number(card.querySelector?.('.cost')?.textContent)||0;playCardBeforeGuardian(card);if(mana<before&&cost>=2&&battlePhase==='setup'&&guardianProc('player','cheongryong')){const gain=Math.max(0,Math.min(rollPoseidonMana('player'),maxMana-mana)),name=guardianAwakenActive('player')?guardianAuraConfig('player','cheongryong').name:GUARDIANS.cheongryong.name;mana+=gain;updateMana();showSkillEffect('rush',document.querySelector('.duel-hud .player .avatar'),name+' · 마나 +'+gain);showAwakeningProc('player','cheongryong',name,'마나 +'+gain,document.querySelector('#mana-hud'));writeLog('<strong>'+name+'</strong>이 마나 '+gain+'을 회복시켰습니다.');}};
    
         /* 물 오라: 컴퓨터도 유저와 같다. 비용 2 이상 카드를 낼 때 확률로 마나를 회복하며, 회복은 이번 턴 최대 마나를 넘지 않는다 (2026-11-08) */
     enemyCardPlayedHook=function(cost){if(cost<2||resultPending||!guardianProc('enemy','cheongryong'))return;const gain=Math.max(0,Math.min(rollPoseidonMana('enemy'),enemyTurnMaxMana-enemyMana)),name=guardianAwakenActive('enemy')?guardianAuraConfig('enemy','cheongryong').name:GUARDIANS.cheongryong.name;enemyMana+=gain;showAwakeningProc('enemy','cheongryong',name,'마나 +'+gain,null);writeLog('<strong>상대 '+name+'</strong>이 상대 마나 '+gain+'을 회복시켰습니다.');};
function guardianAwakenLockReason(){if(!playerGuardian)return '성격 오라 필요';if(guardianAwakenChoice)return '각성 지속 중';if(playerHp>GUARDIAN_AWAKEN_HP)return '체력 '+GUARDIAN_AWAKEN_HP+' 이하에서 각성';if(battlePhase!=='setup')return '내 세팅 턴에만 각성';return '';}
    function guardianAwakenSummary(){if(!playerGuardian)return '각성 능력';if(!guardianAwakenChoice)return '체력 '+GUARDIAN_AWAKEN_HP+' 이하에서 강화 선택';const option=GUARDIAN_AWAKEN_OPTIONS[playerGuardian][guardianAwakenChoice];return option.name+' · '+option.desc;}
    function chooseGuardianAwakening(choice){const options=GUARDIAN_AWAKEN_OPTIONS[playerGuardian];if(guardianAwakenChoice||!options?.[choice])return;guardianAwakenChoice=choice;awakenGateOpened.player=true;guardianAwakenUsed=true;returnAwakenAvatar();fxRelease();const summary=guardianAwakenSummary();const awakenedId=playerGuardian;clearTimeout(awakenSlotTimer);awakenSlotTimer=setTimeout(()=>settleAwakenSlot(awakenedId,AWAKEN_SLOT_HOLD_MS),AWAKEN_SLOT_RISE_MS);playGuardianDescent(playerGuardian,summary);showSkillEffect('rush',document.querySelector('.duel-hud .player .avatar'),options[choice].name+' · 지속 각성');sfx('ultimate','neutral',7);writeLog('<strong>'+GUARDIANS[playerGuardian].name+' 각성:</strong> '+summary+' 효과가 배틀 종료까지 유지됩니다.');renderUltimate();}
    function chooseEnemyGuardianAwakening(){if(enemyGuardianAwakenChoice||!enemyGuardian||enemyHp>GUARDIAN_AWAKEN_HP)return;const ownCount=document.querySelectorAll('.arena .lane:first-child > .unit:not([data-destroyed="true"])').length,foeCount=document.querySelectorAll('.summon-zone > .unit:not([data-destroyed="true"])').length,tactical={jujak:foeCount>=3?'A':'B',cheongryong:enemyMana<=3?'A':'B',namu:ownCount>=3?'A':'B',baekho:foeCount>=3?'B':'A',hyeonmu:ownCount>=3?'A':'B'},choice=enemyDifficulty==='normal'?(engineAdapter.random()<.5?'A':'B'):tactical[enemyGuardian],option=GUARDIAN_AWAKEN_OPTIONS[enemyGuardian][choice];enemyGuardianAwakenChoice=choice;awakenGateOpened.enemy=true;showSkillEffect('rush',document.querySelector('.duel-hud .enemy .avatar'),option.name+' · 상대 지속 각성');writeLog('<strong>상대 '+GUARDIANS[enemyGuardian].name+' 각성:</strong> '+option.name+' · '+option.desc+(enemyDifficulty!=='normal'?' · 현재 전장에 맞춰 선택했습니다.':'')+' 효과가 배틀 종료까지 유지됩니다.');renderUltimate();}
    /* 각성 진입: 체력바 옆 프로필이 빛나며 필드 중앙으로 날아간다.
       각성 모달이 아무 맥락 없이 화면에 튀어나와 '어디서 온 건지' 읽히지 않던 문제를 없앤다.
       고스트는 아바타의 실제 좌표에서 출발하므로 HUD 위치가 바뀌어도 따라간다 (2026-11-07). */
    /* 620ms 는 '야구공 투구'처럼 휙 지나가 각성이 인지되지 않았다.
       빛이 퍼지는 뜸(flare) → 천천히 비행 순서로 나눠 무게를 준다 (2026-11-07). */
    /* 빛이 일순간에 끝나면 '어? 저게 뭐지?' 하고 볼 틈이 없다. 퍼진 상태를 충분히 유지한 뒤
       출발하고, 빛은 고스트에 붙어 함께 날아온다 (PM 피드백 2026-11-07). */
    /* 착지(2200ms) 직후 바로 패널이 열리면 도착을 볼 틈이 없다. 여운을 두고 2500ms 에 연다. */
    const AWAKEN_FLARE_MS=1800,AWAKEN_TRAVEL_MS=400,AWAKEN_SETTLE_MS=380,
          AWAKEN_FLIGHT_MS=AWAKEN_FLARE_MS+AWAKEN_TRAVEL_MS+AWAKEN_SETTLE_MS;
    function flyAwakenAvatar(color){const avatar=document.querySelector('.duel-hud .player .avatar');
      if(!avatar||matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
      if(typeof syncFieldFrame==='function')syncFieldFrame();
      const r=avatar.getBoundingClientRect(),cs=getComputedStyle(document.documentElement),
            num=name=>parseFloat(cs.getPropertyValue(name))||0,
            tx=num('--field-left')+num('--field-width')*.5,ty=num('--field-top')+num('--field-height')*.5,
            ghost=document.createElement('div');
      /* 프로필에서 빛이 전역으로 번지는 순간 — 이게 없으면 작은 점이 날아가는 것으로만 보인다.
         번짐이 끝난 뒤에도 고스트가 자기 빛(.awaken-glow)을 달고 날아가 계속 인지된다. */
      const flare=document.createElement('div');flare.className='awaken-flare';flare.setAttribute('aria-hidden','true');
      flare.style.setProperty('--aw-color',color);
      flare.style.left=(r.left+r.width/2)+'px';flare.style.top=(r.top+r.height/2)+'px';
      document.body.appendChild(flare);
      setTimeout(()=>flare.remove(),AWAKEN_FLARE_MS);
      ghost.className='awaken-flight';ghost.setAttribute('aria-hidden','true');
      ghost.style.setProperty('--aw-color',color);
      ghost.style.left=r.left+'px';ghost.style.top=r.top+'px';
      ghost.style.width=r.width+'px';ghost.style.height=r.height+'px';
      ghost.style.setProperty('--aw-dx',(tx-(r.left+r.width/2)).toFixed(1)+'px');
      ghost.style.setProperty('--aw-dy',(ty-(r.top+r.height/2)).toFixed(1)+'px');
      /* 문양은 작게 유지하고 그 둘레에 빛 영역을 둔다 — 빛이 공의 2배 크기로 함께 이동한다. */
      ghost.innerHTML='<i class="awaken-glow"></i><b class="awaken-face"></b>';
      /* 오라 문양은 텍스트가 아니라 .aura-mark 안의 <img> SVG 다. textContent 로 베끼면
         빈 문자열이 와서 '문양 없는 구체'만 날아갔다 (2026-11-07 실측: textContent === "").
         노드를 통째로 복제해야 문양과 회전 테두리, --ac 색이 함께 따라온다. */
      const face=ghost.querySelector('.awaken-face'),mark=avatar.querySelector('.aura-mark');
      if(mark){face.appendChild(mark.cloneNode(true));face.classList.add('has-mark');}
      else face.textContent=avatar.textContent;
      document.body.appendChild(ghost);
      /* 원본은 날아가는 동안 자리를 비운다 — 둘이 동시에 보이면 분신처럼 읽힌다. */
      avatar.classList.add('awaken-departing');
      tone(300,.5,'sine',.045,760,0);
      setTimeout(()=>flare.remove(),AWAKEN_FLARE_MS);
      /* 고스트는 중앙에 남아 선택을 기다린다 — 선택 후 프로필로 되돌아가야 하기 때문이다.
         선택 없이 연출이 끊기면 fxPresent 정리 콜백이 치운다. */
      return AWAKEN_FLIGHT_MS;}
    /* 선택 후 구체가 중앙에서 체력 프로필로 돌아간다 — 각성이 내 것이 됐음을 눈으로 잇는다. */
    const AWAKEN_RETURN_MS=720;
    function returnAwakenAvatar(){const ghost=document.querySelector('.awaken-flight'),
        avatar=document.querySelector('.duel-hud .player .avatar');
      if(!ghost){avatar?.classList.remove('awaken-departing');return 0;}
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){ghost.remove();avatar?.classList.remove('awaken-departing');return 0;}
      ghost.classList.add('returning');
      tone(520,.5,'sine',.05,300,0);
      setTimeout(()=>{ghost.remove();avatar?.classList.remove('awaken-departing');},AWAKEN_RETURN_MS);
      return AWAKEN_RETURN_MS;}
    /* 사이렌: 같은 소리를 일정 간격으로 3번 울려 '경보가 울린다'로 읽히게 한다.
       한 번이면 효과음, 세 번이면 신호다. 비행 연출보다 먼저 시작해 버튼을 누른 순간에 붙는다. */
    /* tone() 의 delay 는 ctx.currentTime 에 더하는 '초' 단위다. ms 로 넘기면 2·3번째가
       몇 분 뒤로 밀려 영영 안 들린다 (실측으로 확인). 간격은 초로 적는다. */
    const AWAKEN_SIREN_GAP_S=.3;
    function playAwakenSiren(){for(let i=0;i<3;i++){const at=i*AWAKEN_SIREN_GAP_S;tone(620,.26,'sawtooth',.055,980,at);tone(310,.26,'square',.03,490,at);}}
    /* 각성 슬롯 (2026-11-09 PM): 각성 버튼을 누르면 버튼 사이에서 빈 받침이 올라오고, 강화를 고르면 오라 문양을 받쳐 든 채 강하 연출 동안 머문 뒤 내려간다 */
    /* 선택 창과 강하 연출이 전장 가운데를 덮는 동안은 받침을 올리지 않는다(글자를 가린다). 강하 연출이 걷히기 시작할 때(2.6초) 올라와 문양을 받쳐 든 뒤 내려간다 */
    const AWAKEN_SLOT_RISE_MS=2500,AWAKEN_SLOT_HOLD_MS=1900;
    let awakenSlotTimer=0;
    function awakenSlotFloat(){const slot=document.querySelector('.aura-sigil-slot');if(!slot||slot.hidden)return null;let float=document.querySelector('.aura-slot-float');if(!float){float=document.createElement('div');float.className='aura-sigil-slot aura-slot-float';float.setAttribute('aria-hidden','true');float.innerHTML='<i class="ass-ring"></i><i class="ass-ring ass-inner"></i><img alt="">';document.body.appendChild(float);}const r=slot.getBoundingClientRect();Object.assign(float.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});return float;}
    function raiseAwakenSlot(id){const float=awakenSlotFloat();if(!float||!GUARDIANS[id])return;clearTimeout(awakenSlotTimer);float.style.setProperty('--slot-aura',GUARDIANS[id].color);void float.offsetWidth;float.classList.add('raised');}
    function lowerAwakenSlot(){const float=document.querySelector('.aura-slot-float');clearTimeout(awakenSlotTimer);if(!float)return;float.classList.remove('raised','holding');awakenSlotTimer=setTimeout(()=>float.remove(),650);}
    function settleAwakenSlot(id,holdMs=3100){raiseAwakenSlot(id);const float=document.querySelector('.aura-slot-float');if(!float||!GUARDIANS[id])return;float.querySelector('img').src=GUARDIANS[id].sigil;float.classList.remove('holding');void float.offsetWidth;float.classList.add('holding');awakenSlotTimer=setTimeout(lowerAwakenSlot,holdMs);}
    function activateGuardianAwakening(){if(battlePhase!=='setup'||guardianAwakenChoice||playerHp>GUARDIAN_AWAKEN_HP||!playerGuardian||document.querySelector('.aura-awaken-choice'))return;guardianAwakenPrompted=true;playAwakenSiren();const g=GUARDIANS[playerGuardian],options=GUARDIAN_AWAKEN_OPTIONS[playerGuardian],overlay=document.createElement('div');overlay.className='aura-awaken-choice';overlay.style.setProperty('--awaken-color',g.color);overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',g.name+' 각성 선택');overlay.innerHTML='<div class="aura-awaken-choice-panel">'+auraMark(playerGuardian)+'<small>HP '+GUARDIAN_AWAKEN_HP+' · AURA AWAKENING</small><h2>'+g.name+' 각성</h2><p>하나를 선택하면 이번 배틀이 끝날 때까지 유지됩니다.</p><div class="aura-awaken-options">'+['A','B'].map(key=>'<button class="aura-awaken-option" data-awaken="'+key+'"><b>'+options[key].name+'</b><span class="aura-awaken-desc">'+(options[key].ui||[options[key].desc]).map(line=>'<span>'+line+'</span>').join('')+'</span><em>'+key+' 선택</em></button>').join('')+'</div></div>';overlay.addEventListener('click',event=>{const button=event.target.closest('[data-awaken]');if(button)chooseGuardianAwakening(button.dataset.awaken);});fxPresent('aura-awaken-choice',()=>{
      /* 프로필이 먼저 날아가고, 그것이 도착한 자리에서 선택 패널이 피어난다.
         비행 중에는 버튼을 누를 수 없게 둔다 — 연출을 끝까지 보여주고 받는다 (A안). */
      const flight=flyAwakenAvatar(g.color);
      overlay.classList.add('arriving');
      document.body.appendChild(overlay);
      if(typeof syncFieldFrame==='function')syncFieldFrame();
      const landTimer=setTimeout(()=>{overlay.classList.remove('arriving');overlay.querySelector('button')?.focus();},flight);
      if(!flight)overlay.classList.remove('arriving');
      return ()=>{clearTimeout(landTimer);overlay.remove();if(!guardianAwakenChoice)lowerAwakenSlot();/* 고르지 않고 끊기면 받침도 내려간다 */
        /* 중간에 끊겨도 HUD 프로필이 사라진 채로 남지 않게 한다. */
        document.querySelector('.duel-hud .player .avatar')?.classList.remove('awaken-departing');
        /* 선택으로 돌아가는 중인 고스트는 남긴다 — 여기서 지우면 복귀 연출이 시작도 못 한다.
           그 고스트는 returnAwakenAvatar() 가 자기 타이머로 치운다 (2026-11-07). */
        document.querySelectorAll('.awaken-flight:not(.returning),.awaken-flare').forEach(node=>node.remove());};
    },{priority:FX_PRIORITY.choice,hold:0});}
    /* 체력 85 이하가 되면 '각성이 가능해졌다'까지만 알리고, 실제 발동은 플레이어가 버튼을 눌러야 한다.
       예전에는 여기서 바로 패널을 띄웠다. 각성은 배틀당 한 번뿐인 선택인데 자동으로 열리면
       '내가 쓴 것'이 아니라 '갑자기 일어난 일'로 읽혀, 중앙의 사용 버튼도 의미를 잃었다.
       상대(AI)는 누를 주체가 없으므로 종전대로 자동 발동한다 (2026-11-07 PM 요청) */
    function checkGuardianAwakeningThreshold(){if(!guardianChosen||resultPending)return;if(playerGuardian&&!guardianAwakenChoice&&playerHp<=GUARDIAN_AWAKEN_HP)announceGuardianAwakenReady();}
    /* 오라 각성은 세팅 턴에만 발동한다. 유저는 내 세팅 단계에서만 버튼이 눌리고, 컴퓨터도 같은 규칙으로 자기 턴의 세팅 시작에만 각성한다 (2026-11-08 PM 요청) */
    const enemyTurnBeforeAwakenGate=enemyTurn;
    const setBattlePhaseBeforeAwakenGate=setBattlePhase;
    setBattlePhase=function(next){const result=setBattlePhaseBeforeAwakenGate(next);if(typeof renderFieldGuardianUltimateAction==='function')renderFieldGuardianUltimateAction();return result;};
    enemyTurn=function(...args){if(!resultPending&&guardianChosen&&enemyGuardian&&!enemyGuardianAwakenChoice&&enemyHp<=GUARDIAN_AWAKEN_HP)chooseEnemyGuardianAwakening();return enemyTurnBeforeAwakenGate(...args);};
    /* 각성 준비는 한 번만 알린다 — 턴마다 다시 울리면 사이렌이 배경음이 된다. */
    let guardianAwakenReadyAnnounced=false;
    function announceGuardianAwakenReady(){if(guardianAwakenReadyAnnounced)return;guardianAwakenReadyAnnounced=true;renderUltimate();const button=document.querySelector('#field-guardian-ultimate');if(button){button.classList.remove('just-ready');void button.offsetWidth;button.classList.add('just-ready');}tone(760,.26,'triangle',.05,640,0);writeLog('<strong>'+GUARDIANS[playerGuardian].name+' 각성 준비:</strong> 체력이 '+GUARDIAN_AWAKEN_HP+' 이하가 되어 각성을 쓸 수 있습니다. 가운데 버튼을 눌러 발동하세요.');}
    setInterval(checkGuardianAwakeningThreshold,120);
    /* 오라 각성 연출: 궁극기급 무게감. 필드 위에 성격 색의 빛기둥과 문양이 내려앉고 충격파가 퍼지며 아군 전체가 같은 색으로 빛난다. */
    const GUARDIAN_DESCENT_COLOR={jujak:'#ff6a4a',cheongryong:'#4fb8ff',namu:'#5fd38a',hyeonmu:'#d9a35b',baekho:'#cfd8e6'};
    function playGuardianDescent(id,summary){const g=GUARDIANS[id];if(!g)return;const color=GUARDIAN_DESCENT_COLOR[id]||'#ffd46b',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;document.querySelectorAll('.global-spell.guardian-awakening').forEach(node=>node.remove());const fx=document.createElement('div');fx.className='guardian-descent';fx.style.setProperty('--gd-color',color);fx.innerHTML='<i class="gdx-veil"></i><i class="gdx-pillar"></i><i class="gdx-ring"></i><i class="gdx-ring r2"></i><i class="gdx-wave"></i>'+Array.from({length:18},(_,i)=>'<i class="gdx-spark" style="--a:'+(i*20)+'deg;--d:'+(i%5)*.06+'s"></i>').join('')+'<div class="gdx-core"><span class="gdx-sigil">'+auraMark(id)+'</span><small>AURA AWAKENING</small><h2 class="gdx-title"></h2><p>'+summary+'</p></div>';return fxPresent('guardian-descent:'+id,()=>{document.body.appendChild(fx);if(typeof syncFieldFrame==='function')syncFieldFrame();typeSkillTitle(fx.querySelector('.gdx-title'),g.name+' · 각성');const arena=document.querySelector('.arena');if(arena&&!reduced)arena.animate([{transform:'none'},{transform:'translateY(4.5px)'},{transform:'translate(-3.6px,-1.8px)'},{transform:'translate(2.7px,0.9px)'},{transform:'none'}],{duration:420,delay:620,easing:'ease-out'});const beatTimer=setTimeout(()=>{tone(70,1.1,'sine',.12,40);noise(.5,.06,320);tone(220,.9,'triangle',.05,330,.05);[392,523,659,784].forEach((f,i)=>tone(f,.9,'triangle',.035,f*1.01,.12+i*.07));document.querySelectorAll('.summon-zone .unit').forEach((unit,i)=>setTimeout(()=>{unit.style.setProperty('--gd-color',color);unit.classList.remove('guardian-blessed');void unit.offsetWidth;unit.classList.add('guardian-blessed');setTimeout(()=>unit.classList.remove('guardian-blessed'),1300);},i*70));const avatar=document.querySelector('.duel-hud .player .avatar');if(avatar){avatar.style.setProperty('--gd-color',color);avatar.classList.remove('guardian-blessed');void avatar.offsetWidth;avatar.classList.add('guardian-blessed');setTimeout(()=>avatar.classList.remove('guardian-blessed'),1300);}},640);const leaveTimer=setTimeout(()=>fx.classList.add('leaving'),2600);return ()=>{clearTimeout(leaveTimer);clearTimeout(beatTimer);fx.remove();};},{priority:FX_PRIORITY.guardian,hold:3100});}
    /* 성격 오라 문양은 글자를 쓰지 않는 독립 SVG 자산이다. 카드 뒷면을 포함한 다른 화면에서도 같은 경로를 재사용한다. */
    function auraMark(id){const aura=PERSONALITY_AURAS[id];if(!aura)return '';return '<span class="aura-mark aura-'+id+'" style="--ac:'+aura.color+'"><img src="'+aura.sigil+'" alt="'+aura.name+' 문양"></span>';}
    function growUnitHp(unit,amount,label){const hp=unit.querySelector('.stats span:last-child'),h=(Number(hp.textContent.replace(/[^0-9]/g,''))||0)+amount;hp.textContent='♥ '+h;unit.dataset.maxHp=String((Number(unit.dataset.maxHp)||h-amount)+amount);if(unit.dataset.hp)unit.dataset.hp=String(h);showSkillEffect('heal',unit,label);}
    /* 나무의 오라: 자기 턴이 시작될 때 필드의 카드마다 독립적으로 판정한다. 각성 선택에 따라 확률과 성장량이 바뀐다. */
    function growNamuField(side){if(!guardianOfSide(side)||guardianOfSide(side)!=='namu')return 0;const lane=side==='player'?'.summon-zone':'.arena .lane:first-child',config=guardianAuraConfig(side,'namu'),amount=config.hpGain||1,units=[...document.querySelectorAll(lane+' > .unit:not([data-destroyed="true"])')],targets=config.leftmostOnly?units.slice(0,1):units;let grown=0;targets.forEach((unit,i)=>{if(!guardianProc(side,'namu'))return;grown++;setTimeout(()=>{if(unit.isConnected)growUnitHp(unit,amount,(config.name||'나무')+' · 체력 +'+amount);},i*90);});if(grown){showAwakeningProc(side,'namu',config.name||'나무의 오라',(config.leftmostOnly?'가장 왼쪽 아군':'아군 '+grown+'장')+' 체력 +'+amount,targets[0]);writeLog('<strong>'+(side==='player'?'':'상대 ')+(config.name||'나무의 오라')+'</strong>로 '+(config.leftmostOnly?'가장 왼쪽 카드':'필드 카드 '+grown+'장')+'의 체력이 '+amount+' 늘었습니다.');}return grown;}
    const auraFieldUnits=side=>[...document.querySelectorAll(side==='player'?'.summon-zone > .unit:not([data-destroyed="true"])':'.arena .lane:first-child > .unit:not([data-destroyed="true"])')];
    function tickAuraBurnField(side){const units=auraFieldUnits(side).filter(unit=>Number(unit.dataset.eternalBurn)>0&&Number(unit.dataset.eternalBurnTurns)>0||Number(unit.dataset.auraBurn)>0&&Number(unit.dataset.auraBurnTurns)>0);units.forEach(unit=>{if(!unit.isConnected||unit.dataset.destroyed==='true')return;const eternal=Number(unit.dataset.eternalBurn)>0&&Number(unit.dataset.eternalBurnTurns)>0,damage=eternal?Number(unit.dataset.eternalBurn):Number(unit.dataset.auraBurn)||1,remaining=Math.max(0,(eternal?Number(unit.dataset.eternalBurnTurns):Number(unit.dataset.auraBurnTurns)||1)-1),label=eternal?'꺼지지 않는 불꽃':damage>1?'업화':'화상';unit.classList.remove('aura-burn-tick');void unit.offsetWidth;unit.classList.add('aura-burn-tick');setTimeout(()=>unit.classList.remove('aura-burn-tick'),combatMs(600));if(eternal)unit.dataset.impactTint='black-flame';const result=damageUnit(unit,damage,'fire');showSkillEffect(eternal?'black-flame':'burn',unit,label+' 폭발 · −'+damage);writeLog('<strong>'+unit.querySelector('h4').textContent+'</strong>이(가) '+label+'으로 피해 '+damage+'을 받았습니다. ('+remaining+'턴 남음)');if(remaining>0){unit.dataset[eternal?'eternalBurnTurns':'auraBurnTurns']=String(remaining);syncAuraBurnVfx(unit);}else if(eternal){delete unit.dataset.eternalBurn;delete unit.dataset.eternalBurnTurns;syncAuraBurnVfx(unit);}else clearAuraBurn(unit);if(!result.blocked&&result.hp<=0){unit.dataset.destroyed='true';triggerDeathrattle(unit);setTimeout(()=>unit.remove(),700);}});return units.length;}
    function growMetalExperience(side){if(guardianOfSide(side)!=='baekho')return false;const units=auraFieldUnits(side);units.forEach(unit=>{unit.dataset.metalSurvivalTurns=String((Number(unit.dataset.metalSurvivalTurns)||0)+1);unit.querySelector(':scope > .metal-experience-badge')?.remove();});const front=units[0];if(!front)return false;const config=guardianAuraConfig(side,'baekho');if(config.continuousSlashRatio)return false;const turns=Number(front.dataset.metalSurvivalTurns)||1,chance=Math.min(config.maxChance,turns*config.survivalStep),badge=document.createElement('span');badge.className='metal-experience-badge';const metalLine=document.createElement('span');metalLine.textContent=front.dataset.metalExperienced==='true'?'단련 완료':'생존 '+turns+'턴 · '+Math.round(chance*100)+'%';badge.appendChild(metalLine);front.appendChild(badge);stackUnitBadges(front);if(front.dataset.metalExperienced==='true'||engineAdapter.random()>=chance)return false;const attack=front.querySelector('.stats span:first-child'),gain=config.attackGain||4;attack.textContent='⚔ '+((Number(attack.textContent.replace(/[^0-9]/g,''))||0)+gain);front.dataset.metalExperienced='true';metalLine.textContent='단련 완료 · 공격 +'+gain;showSkillEffect('rush',front,(config.name||'전투 경험')+' · 공격 +'+gain);showAwakeningProc(side,'baekho',config.name||'전투 경험','생존 '+turns+'턴 · 공격력 +'+gain,front);writeLog('<strong>'+(side==='player'?'내':'상대')+' '+GUARDIANS.baekho.name+'</strong>: 맨 왼쪽 '+front.querySelector('h4').textContent+'이(가) '+turns+'턴의 전투 경험으로 공격력 '+gain+'을 얻었습니다.');return true;}
    const startPlayerTurnBeforeAura=startPlayerTurn;
    startPlayerTurn=function(button){startPlayerTurnBeforeAura(button);if(battlePhase==='setup'){tickAuraBurnField('player');growMetalExperience('player');growNamuField('player');}};
    const enemyTurnBeforeAura=enemyTurn;
    enemyTurn=function(done){tickAuraBurnField('enemy');growMetalExperience('enemy');growNamuField('enemy');return enemyTurnBeforeAura(done);};
    function syncGuardianAwakenAura(){const arena=document.querySelector('.arena');if(!arena)return;const classes=['guardian-awakened','guardian-awakened-jujak','guardian-awakened-cheongryong','guardian-awakened-namu','guardian-awakened-hyeonmu','guardian-awakened-baekho'];arena.classList.remove(...classes);if(guardianAwakenActive('player')&&playerGuardian){arena.classList.add('guardian-awakened','guardian-awakened-'+playerGuardian);arena.setAttribute('aria-label',GUARDIANS[playerGuardian].name+' 각성 활성 중');}else arena.removeAttribute('aria-label');const syncLaneSigil=(side,id,zone)=>{let sigil=zone?.querySelector(':scope > .awaken-field-sigil');if(!zone||!guardianAwakenActive(side)||!id){sigil?.remove();return;}if(!sigil){sigil=document.createElement('div');sigil.className='awaken-field-sigil engraving';sigil.dataset.side=side;sigil.dataset.aura=id;sigil.style.setProperty('--sigil-aura',GUARDIANS[id].color);sigil.setAttribute('aria-hidden','true');sigil.innerHTML='<img src="'+GUARDIANS[id].sigil+'" alt="">';zone.prepend(sigil);setTimeout(()=>sigil?.classList.remove('engraving'),950);}else if(sigil.dataset.aura!==id){sigil.dataset.aura=id;sigil.style.setProperty('--sigil-aura',GUARDIANS[id].color);sigil.querySelector('img').src=GUARDIANS[id].sigil;}};const slot=arena.querySelector('.aura-sigil-slot');if(slot){const id=playerGuardian&&GUARDIANS[playerGuardian]?playerGuardian:null,filled=Boolean(id&&guardianAwakenActive('player'));slot.hidden=!(guardianChosen&&id);if(id)slot.style.setProperty('--slot-aura',GUARDIANS[id].color);/* 2026-11-09 PM: 문양을 상시로 박아 두지 않는다. 슬롯은 각성 연출 동안만 올라와 문양을 받쳐 주고(raiseAwakenSlot·settleAwakenSlot), 끝나면 내려가 가운데는 비어 있다 */void filled;}syncLaneSigil('enemy',enemyGuardian,arena.querySelector('.lane:first-child'));syncLaneSigil('player',playerGuardian,arena.querySelector('.lane:nth-child(2)'));}
    function renderFieldGuardianUltimateAction(){const button=document.querySelector('#field-guardian-ultimate');syncGuardianAwakenAura();if(!button)return;const visible=guardianChosen&&Boolean(playerGuardian),active=guardianAwakenActive('player'),reason=guardianAwakenLockReason(),summary=guardianAwakenSummary(),choosing=Boolean(document.querySelector('.aura-awaken-choice')),ready=!active&&!choosing&&playerHp<=GUARDIAN_AWAKEN_HP&&battlePhase==='setup',markup=active?'<strong>오라 각성 지속</strong><small>'+summary+'</small>':'<strong>'+(ready?'오라 각성 선택':reason)+'</strong><small>'+(ready?'두 강화 중 하나 선택':summary)+'</small>';button.hidden=!visible;button.disabled=active||choosing||!ready;button.classList.toggle('active',active);button.classList.toggle('ready',ready);if(button.innerHTML!==markup)button.innerHTML=markup;button.setAttribute('aria-label',active?'오라 각성 지속, '+summary:ready?'오라 각성 선택':'오라 각성, '+reason);}
    function renderAuraUltimateResonance(){if(!ultimateState||!auraUltimateMatch(ultimateState))return;const cost=ultimateManaCost(ultimateState),label=auraUltimateBoostLabel(ultimateState),copy=document.querySelector('#ultimate-panel .ultimate-slot p');if(copy){copy.innerHTML=copy.innerHTML.replace('마나 '+ultimateState.cost,'마나 '+cost).replace('<br><b>','<br><b>'+label+'</b><br><b>');}const button=document.querySelector('#field-ultimate-action');if(button&&!button.disabled){button.innerHTML='<strong class="ult-ready-label">오라 공명 · 영웅 강림</strong><small class="ult-ready-meta">마나 '+cost+' 소모 · '+ultimateState.title+'</small>';button.setAttribute('aria-label',ultimateState.title+' 오라 공명 영웅 강림, 마나 '+cost+' 소모');}}
    const renderUltimateBeforeGuardianAwaken=renderUltimate;
    renderUltimate=function(){renderUltimateBeforeGuardianAwaken();renderFieldGuardianUltimateAction();renderAuraUltimateResonance();};
    const startPlayerTurnBeforeGuardianAwaken=startPlayerTurn;
    startPlayerTurn=function(button){const result=startPlayerTurnBeforeGuardianAwaken(button);checkGuardianAwakeningThreshold();renderUltimate();return result;};
    function closeGuardianSelect(){document.querySelector('.guardian-select')?.remove();}
    function pickGuardian(id){if(guardianChosen||!GUARDIANS[id])return;guardianChosen=true;playerGuardian=id;const pool=Object.keys(GUARDIANS).filter(key=>key!==id);enemyGuardian=pool[Math.floor(engineAdapter.random()*pool.length)];updateGuardianChips();closeGuardianSelect();sfx('card-land','magic');writeLog('<strong>성격 오라 선택:</strong> <strong>'+GUARDIANS[id].name+'</strong>('+guardianDesc(id)+')을 선택했습니다. 상대 오라는 <strong>'+GUARDIANS[enemyGuardian].name+'</strong>입니다.');setBattlePhase('setup');document.querySelector('#hand-guide').textContent='카드를 선택하세요';updateMana();}
    /* 성격 오라를 고르면 배경음악이 시작되고, 고른 인장이 내 프로필 자리로 날아가 박힌다 */
    function flyGuardianToProfile(id,from){const avatar=document.querySelector('.duel-hud .player .avatar');if(!avatar||!from)return;const to=avatar.getBoundingClientRect(),ghost=document.createElement('span');ghost.className='gd-emblem gd-'+id+' guardian-fly';ghost.innerHTML=auraMark(id);ghost.style.cssText='position:fixed;z-index:400;margin:0;left:'+from.left+'px;top:'+from.top+'px;--s:'+from.width+'px;pointer-events:none';document.body.appendChild(ghost);avatar.style.opacity='0';const dx=(to.left+to.width/2)-(from.left+from.width/2),dy=(to.top+to.height/2)-(from.top+from.height/2),scale=to.width/from.width;const anim=ghost.animate([{transform:'translate(0,0) scale(1)',filter:'brightness(1)'},{transform:'translate('+dx*.35+'px,'+(dy*.35-60)+'px) scale(1.25)',filter:'brightness(1.6)',offset:.35},{transform:'translate('+dx+'px,'+dy+'px) scale('+scale+')',filter:'brightness(1)'}],{duration:820,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});anim.onfinish=()=>{ghost.remove();avatar.style.opacity='';avatar.classList.remove('guardian-landed');void avatar.offsetWidth;avatar.classList.add('guardian-landed');sfx('summon','neutral',5);setTimeout(()=>avatar.classList.remove('guardian-landed'),900);};}
    const pickGuardianCore=pickGuardian;
    pickGuardian=function(id,options={}){const nameRect=document.querySelector('.guardian-select .gs-'+id+' strong')?.getBoundingClientRect(),from=nameRect&&nameRect.width?{left:nameRect.left+nameRect.width/2-32,top:nameRect.top+nameRect.height/2-32,width:64,height:64}:null,before=guardianChosen;pickGuardianCore(id,options);if(before||!guardianChosen)return;if(typeof syncBgm==='function')syncBgm();if(playerGuardian===id)flyGuardianToProfile(id,from);renderUltimate();setTimeout(startBeginnerGuideSequence,900);};
    function openGuardianSelect(){if(document.querySelector('.guardian-select')||guardianChosen)return;setBattlePhase('intro');document.querySelector('#hand-guide').textContent='오라를 선택하세요';const overlay=document.createElement('div');overlay.className='guardian-select gs-aura';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','성격의 오라 선택');const card=id=>{const g=GUARDIANS[id];return '<button class="gs-card gs-'+id+'" data-guardian="'+id+'" style="--ac:'+g.color+'"><span class="gd-emblem">'+auraMark(id)+'</span><strong>'+(g.child||g.label)+'</strong><em>'+g.label+'의 오라 · '+(g.traits||g.title)+'</em><b class="gs-power">'+g.short+'</b><span class="gs-desc">'+guardianDesc(id).replace(/ \((.+)\)$/,'<small class="gs-note">$1</small>')+'</span></button>';};overlay.innerHTML='<div class="gs-heading"><small>CHOOSE YOUR AURA</small><h2>성격의 오라</h2><p>화·수·목·금·토 중 캐릭터의 성격을 하나 고르세요 · 별도 재화 비용 없이</p></div><div class="gs-board">'+['jujak','cheongryong','namu','baekho','hyeonmu'].map(card).join('')+'<div class="aura-pentagon-core" aria-hidden="true"><span>나의 성격<br>오라 선택</span></div></div>';overlay.addEventListener('click',event=>{const button=event.target.closest('[data-guardian]');if(button)pickGuardian(button.dataset.guardian);});document.body.appendChild(overlay);if(typeof syncFieldFrame==='function')syncFieldFrame();}
    /* 난이도는 유저가 고르지 않는다. 티어 기반 자동 매칭 결과를 적용하고 바로 오라 선택으로 넘어간다.
       key를 주면 QA용 강제 지정(?difficulty=)으로 쓴다. */
    function applyEnemyDifficulty(key){
      let config;
      if(key&&ENEMY_DIFFICULTIES[key]){enemyDifficulty=key;difficultyAutoMatched=false;beginnerHelpEnabled=tutorialMode;beginnerOverviewDismissed=false;config=enemyDifficultyConfig();const label=document.querySelector('#enemy-difficulty');if(label)label.textContent=enemyDifficultyBase().label+(tutorialMode?' · 튜토리얼':'');syncBeginnerHelp();}
      else config=applyMatchedDifficulty();
      syncTutorialToggle();
      writeLog('<strong>컴퓨터 난이도:</strong> '+enemyDifficultyBase().label+(difficultyAutoMatched?' · 내 티어 실력에 맞춰 자동으로 맞췄습니다.':'')+' 동일한 카드·마나 조건에서 판단력만 달라집니다.'+(tutorialMode?' 튜토리얼 모드가 켜져 있어 상대가 실수를 더 섞습니다.':''));
      openGuardianSelect();
    }
    document.addEventListener('click',event=>{if(!beginnerHelpEnabled)return;const card=event.target.closest('.hand .card'),tab=event.target.closest('.hand-tab');if(card){hideBeginnerOverview();beginnerSequenceTimers.forEach(clearTimeout);beginnerSequenceTimers=[];setTimeout(()=>showBeginnerCoach(cardCategory(card)==='champion'?'.summon-zone':'.magic-field',cardCategory(card)==='champion'?'좋아요! 선택한 하수인이 내 전장에 소환됐어요.':'마법은 이 슬롯에 세팅되고 조건이 맞으면 발동해요.',2400),180);showBeginnerEndTurnGuide(2800);return;}if(tab){hideBeginnerOverview();setTimeout(()=>showBeginnerCoach('.hand',tab.dataset.filter==='champion'?'초록빛 카드 중 현재 마나로 낼 수 있는 하수인을 고르세요.':'마법카드는 바로 쓰거나 슬롯에 세팅해 다음 전투를 준비해요.',3800),120);return;}if(event.target.closest('#draw-action')){hideBeginnerOverview();setTimeout(()=>showBeginnerCoach('.hand','새 카드가 손패에 들어왔어요. 카드 뽑기는 반복할수록 비용이 커져요.',3800),500);return;}if(event.target.closest('.turn-actions .end')){hideBeginnerOverview();beginnerSequenceTimers.forEach(clearTimeout);beginnerSequenceTimers=[];clearBeginnerCoach();}},true);
    new MutationObserver(()=>{stampNewUnits();updateLoneWolfBonuses();updateSwarmBonuses();updateSynergyHud();updateEnemyFieldTarget();updateFieldReorderState();renderFieldGuardianUltimateAction();}).observe(document.querySelector('.arena'),{childList:true,subtree:true});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCollection();});
    /* 스페이스 바 = 손패 탭 전환(하수인 ↔ 마법카드), 엔터 = 턴 종료. 모달/결과 화면/입력창, 조합키에서는 무시한다. */
    function keyShortcut(event){
      if(event.code!=='Space'&&event.code!=='Enter'&&event.code!=='NumpadEnter')return null;
      if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return null;
      if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return null;
      if(document.querySelector('.collection-modal.show')||document.querySelector('.result.show'))return null;
      return event.code==='Space'?'toggle-tab':'end-turn';
    }
    document.addEventListener('keydown',event=>{const action=keyShortcut(event);if(!action)return;event.preventDefault();if(event.repeat)return;
      if(action==='toggle-tab'){setHandFilter(handFilter==='champion'?'spell':'champion');return;}
      const button=document.querySelector('.turn-actions .end');if(!button||button.disabled||battlePhase!=='setup')return;button.click();});
    document.addEventListener('keyup',event=>{if(keyShortcut(event))event.preventDefault();});
    document.querySelector('.turn-actions .end')?.setAttribute('title','단축키: Enter');
    document.querySelectorAll('.hand-tab').forEach(tab=>tab.setAttribute('title','단축키: 스페이스 바로 탭 전환'));
    /* ── 세팅 취소: 턴 종료 전에는 세트한 마법/장착한 궁극기를 손패로 되돌린다 (슬롯을 손패로 드래그 또는 더블클릭) ── */
    let draggedCancel = null;
    const CANCEL_HINT = '더블클릭 · 손패로 드래그하면 세팅 취소';
    const playCardBeforeCancel = playCard;
    playCard = function(card){
      const before = {mana, hp: playerHp, blood: bloodManaUses, battleBlood: bloodManaBattleUses, count: setMagicCards.length};
      playCardBeforeCancel(card);
      if(setMagicCards.length > before.count) setMagicCards[setMagicCards.length-1].refund = {mana: before.mana-mana, hp: before.hp-playerHp, blood: bloodManaUses-before.blood, battleBlood: bloodManaBattleUses-before.battleBlood};
    };
    const setUltimateBeforeCancel = setUltimate;
    setUltimate = function(card){ const had = ultimateState; setUltimateBeforeCancel(card); if(!had && ultimateState){ultimateState.card=card;ultimateState.personality=card.dataset.persona||'';} };
    function returnCardToHand(card){
      const hand = document.querySelector('.hand');
      if(hand.querySelectorAll('.card').length >= 8){ writeLog('손패가 가득 차 있어 취소할 수 없습니다. (최대 8장)'); return false; }
      card.classList.remove('selected','hand-filtered'); card.style.visibility = ''; hand.appendChild(card);
      card.classList.add('draw-in'); setTimeout(()=>card.classList.remove('draw-in'), 850);
      updateHandTabs(); setHandFilter(handFilter); sfx('ui-select');
      return true;
    }
    function cancelSetMagic(index){
      if(battlePhase !== 'setup') return;
      const magic = magicInSlot(index); if(!magic) return;
      if(turnNumber > (magic.setTurn ?? magic.readyTurn-1)){ writeLog('<strong>'+magic.name+'</strong>은(는) 이전 필드에 세트한 카드라 취소할 수 없습니다.'); return; }
      if(!returnCardToHand(magic.card)) return;
      setMagicCards.splice(setMagicCards.indexOf(magic), 1);
      const refund = magic.refund || {mana:0, hp:0, blood:0};
      mana = Math.min(maxMana, mana + refund.mana);
      if(refund.hp){ playerHp = Math.min(HERO_MAX_HP, playerHp + refund.hp); bloodManaUses = Math.max(0, bloodManaUses - refund.blood); bloodManaBattleUses = Math.max(0, bloodManaBattleUses - (refund.battleBlood||0)); document.querySelector('#player-health').style.width = (playerHp/HERO_MAX_HP*100)+'%'; }
      renderMagicSlots(); updateMana();
      writeLog('<strong>'+magic.name+'</strong> 세팅을 취소하고 손패로 되돌렸습니다.'+(refund.mana?' 마나 '+refund.mana+' 환급.':'')+(refund.hp?' 체력 '+refund.hp+' 복구.':''));
    }
    function cancelUltimate(){
      if(battlePhase !== 'setup' || !ultimateState || ultimateUsed || !ultimateState.card) return;
      const title = ultimateState.title;
      if(!returnCardToHand(ultimateState.card)) return;
      ultimateState = null; ultimateArmed = false;
      renderUltimate(); updateMana();
      writeLog('<strong>'+title+'</strong> 궁극기 장착을 취소하고 손패로 되돌렸습니다.');
    }
    function decorateCancelables(){
      const open = battlePhase === 'setup';
      for(let i=0;i<MAGIC_SLOT_KINDS.length;i++){
        const rack = document.querySelector('#magic-slot-'+i), magic = magicInSlot(i), ok = Boolean(open && magic && turnNumber === (magic.setTurn ?? magic.readyTurn-1));
        if(!rack) continue;
        rack.draggable = ok; rack.title = ok ? CANCEL_HINT : '';
        if(ok && !rack.querySelector('.cancel-hint')) rack.insertAdjacentHTML('beforeend','<small class="cancel-hint">더블클릭 · 드래그로 취소</small>');
      }
      const slot = document.querySelector('#ultimate-panel .ultimate-slot');
      if(slot){ const ok = Boolean(open && ultimateState && !ultimateUsed); slot.draggable = ok; slot.title = ok ? CANCEL_HINT : ''; if(ok && !slot.querySelector('.cancel-hint')) slot.querySelector('div')?.insertAdjacentHTML('beforeend','<small class="cancel-hint">더블클릭 · 드래그로 취소</small>'); }
    }
    const renderMagicSlotsBeforeCancel = renderMagicSlots;
    renderMagicSlots = function(){ renderMagicSlotsBeforeCancel(); decorateCancelables(); };
    const renderUltimateBeforeCancel = renderUltimate;
    renderUltimate = function(){ renderUltimateBeforeCancel(); decorateCancelables(); };
    const cancelDropTargets = [document.querySelector('.hand'), document.querySelector('.hand-tabs'), document.querySelector('.hand-title')].filter(Boolean);
    function clearCancelDrag(){ draggedCancel = null; document.querySelectorAll('.cancel-dragging').forEach(node=>node.classList.remove('cancel-dragging')); cancelDropTargets.forEach(node=>node.classList.remove('cancel-ready')); }
    magicSetup.addEventListener('dragstart', event=>{ const slot = event.target.closest('.set-slot'); if(!slot || !slot.draggable){ return; } draggedCancel = {type:'magic', index:Number(slot.id.slice(-1))}; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain','cancel-magic'); slot.classList.add('cancel-dragging'); });
    ultimatePanel.addEventListener('dragstart', event=>{ const slot = event.target.closest('.ultimate-slot'); if(!slot || !slot.draggable) return; draggedCancel = {type:'ultimate'}; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain','cancel-ultimate'); slot.classList.add('cancel-dragging'); });
    magicSetup.addEventListener('dragend', clearCancelDrag); ultimatePanel.addEventListener('dragend', clearCancelDrag);
    cancelDropTargets.forEach(target=>{
      target.addEventListener('dragover', event=>{ if(!draggedCancel) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; cancelDropTargets.forEach(node=>node.classList.add('cancel-ready')); });
      target.addEventListener('dragleave', event=>{ if(!draggedCancel) return; if(!cancelDropTargets.some(node=>node.contains(event.relatedTarget))) cancelDropTargets.forEach(node=>node.classList.remove('cancel-ready')); });
      target.addEventListener('drop', event=>{ if(!draggedCancel) return; event.preventDefault(); const action = draggedCancel; clearCancelDrag(); if(action.type === 'magic') cancelSetMagic(action.index); else cancelUltimate(); });
    });
    magicSetup.addEventListener('dblclick', event=>{ const slot = event.target.closest('.set-slot'); if(slot) cancelSetMagic(Number(slot.id.slice(-1))); });
    ultimatePanel.addEventListener('dblclick', event=>{ if(event.target.closest('.ultimate-slot')) cancelUltimate(); });
    stampNewUnits();renderMagicSlots();updateMana();updateSynergyHud();updateEnemyFieldTarget();updateFieldReorderState();updateCrackerHud();updateHeroHealth();setInterval(updateHeroHealth,100);
  
    /* ── 마법 세팅 UX: 세팅란을 누르면 '카드 고르기 모드'가 켜지고, 손패의 마법/함정 카드를 한 번 클릭하면 바로 세트된다 (궁극기 세팅과 동일한 방식) ── */
    let magicArmed = false, magicArmedSlot = -1;
    const MAGIC_PICK_HINT = '세팅할 마법카드를 클릭하세요';
    function refreshMagicArming(){ renderMagicSlots(); document.querySelector('.hand')?.classList.toggle('magic-arming', magicArmed); if(magicArmed) document.querySelector('#hand-guide').textContent = MAGIC_PICK_HINT; }
    function disarmMagicSetting(){ if(!magicArmed) return; magicArmed = false; refreshMagicArming(); }
    function armMagicSetting(slot){
      if(battlePhase!=='setup') return;
      if(magicArmed){ disarmMagicSetting(); document.querySelector('#hand-guide').textContent='마법카드를 선택하세요'; return; }
      /* 누른 칸의 종류(마법/함정)로 고른다. 칸 지정 없이 부르면 빈 마법 칸, 없으면 빈 함정 칸을 쓴다. */
      const kind = MAGIC_SLOT_KINDS[slot] || (freeMagicSlot('active')>=0 ? 'active' : 'reaction');
      if(freeMagicSlot(kind)<0){ writeLog(magicSlotFullMessage(kind)+' 세트된 카드를 발동하거나 취소한 뒤 다시 세트하세요.'); return; }
      if(handFilter!=='spell') setHandFilter('spell');
      if(!document.querySelector(kind==='reaction' ? '.hand .card.trap-card' : '.hand .card.spell-card')){ writeLog(kind==='reaction' ? '손패에 세팅할 함정카드가 없습니다.' : '손패에 세팅할 마법카드가 없습니다.'); return; }
      magicArmedSlot = freeMagicSlot(kind);
      magicArmed = true; sfx('ui-select'); refreshMagicArming();
    }
    const activateSetMagicBase = activateSetMagic;
    activateSetMagic = function(index, automatic=false){ if(!automatic && !magicInSlot(index)){ armMagicSetting(index); return; } return activateSetMagicBase(index, automatic); };
    const playCardBeforeMagicArm = playCard;
    playCard = function(card){
      const picking = magicArmed && battlePhase==='setup' && cardCategory(card)==='spell' && !card.classList.contains('selected');
      if(picking){ document.querySelectorAll('.card').forEach(c=>c.classList.remove('selected')); card.classList.add('selected'); }
      const before = setMagicCards.length;
      playCardBeforeMagicArm(card);
      if(picking){ if(setMagicCards.length>before) disarmMagicSetting(); else card.classList.remove('selected'); }
    };
    const setHandFilterBeforeMagicArm = setHandFilter;
    setHandFilter = function(filter){ if(filter!=='spell') magicArmed = false; setHandFilterBeforeMagicArm(filter); refreshMagicArming(); };
    const setBattlePhaseBeforeMagicArm = setBattlePhase;
    setBattlePhase = function(next){ if(next!=='setup') magicArmed = false; setBattlePhaseBeforeMagicArm(next); refreshMagicArming(); };
    const renderMagicSlotsBase = renderMagicSlots;
    renderMagicSlots = function(){
      renderMagicSlotsBase();
      for(let i=0;i<MAGIC_SLOT_KINDS.length;i++){ const rack=document.querySelector('#magic-slot-'+i); if(!rack) continue; if(magicInSlot(i)){ rack.classList.remove('armed'); continue; } const armed = magicArmed && i===magicArmedSlot; rack.classList.toggle('armed', armed);
        rack.innerHTML = armed ? '<strong>'+magicSlotLabel(i)+' · 선택 중</strong><span>손패 카드를 클릭하세요</span>' : '<strong>'+magicSlotLabel(i)+' · 비어 있음</strong><span class="slot-empty">눌러서 카드 고르기</span>'; }
    };
    /* 마법 칸 2개가 차면 손패의 마법 카드를, 함정 칸 1개가 차면 손패의 함정 카드를 비활성 시각화한다. 칸이 비거나 손패가 다시 그려질 때 해제된다. */
    function syncMagicHandSlotAvailability(){
      const fullByKind = {active: freeMagicSlot('active') < 0, reaction: freeMagicSlot('reaction') < 0};
      document.querySelectorAll('.hand .card').forEach(card=>{
        if(cardCategory(card)!=='spell'||magicKindOfCard(card)!=='reaction'){ card.classList.remove('magic-slot-blocked'); return; }
        const kind = magicKindOfCard(card), full = fullByKind[kind];
        card.classList.toggle('magic-slot-blocked', full);
        if(full){ card.classList.remove('selected'); card.setAttribute('aria-disabled','true'); card.title=magicSlotFullMessage(kind)+' 세트된 카드를 발동하거나 취소한 뒤 세팅할 수 있습니다'; }
        else { card.removeAttribute('title'); if(!card.classList.contains('unaffordable')) card.setAttribute('aria-disabled','false'); }
      });
    }
    const renderMagicSlotsBeforeHandBlock = renderMagicSlots;
    renderMagicSlots = function(){ renderMagicSlotsBeforeHandBlock(); syncMagicHandSlotAvailability(); };
    const updateCardAffordabilityBeforeMagicBlock = updateCardAffordability;
    updateCardAffordability = function(...args){ const result = updateCardAffordabilityBeforeMagicBlock.apply(this,args); syncMagicHandSlotAvailability(); return result; };
    renderMagicSlots();

    /* 전투 시작: 인트로 연출(2.9초, 클릭/Space/Enter로 건너뛰기) → 성격 오라 선택 → 전투 개시. 선택이 끝나기 전까지는 setup 단계가 아니므로 조작이 잠긴다.
       ?skipIntro 로 연출 생략, ?guardian=cheongryong|baekho|jujak|hyeonmu 로 선택 화면까지 생략(QA/재현용). */
    (function(){
      const params=new URLSearchParams(location.search),preset=DEV_MODE?params.get('guardian'):null,difficultyPreset=DEV_MODE?params.get('difficulty'):null,begin=()=>{applyEnemyDifficulty(difficultyPreset);if(difficultyPreset&&preset&&GUARDIANS[preset])pickGuardian(preset,{free:true});};
      if(params.has('skipIntro')){begin();return;}
      const intro=document.createElement('div');intro.className='battle-intro';intro.setAttribute('role','presentation');
      intro.innerHTML='<div class="intro-box"><div class="intro-kicker">CRACK TCG</div><h1 class="intro-title">FATE</h1><div class="intro-versus"><span>Astra</span><em>VS</em><span>Noctis</span></div><div class="intro-start">BATTLE START</div></div>';
      document.body.appendChild(intro);setBattlePhase('intro');document.querySelector('#hand-guide').textContent='전투 준비 중';
      let done=false;const finish=()=>{if(done)return;done=true;intro.remove();removeEventListener('keydown',skip,true);begin();};
      const skip=event=>{if(event.type==='keydown'){if(!['Space','Enter','NumpadEnter','Escape'].includes(event.code))return;event.preventDefault();event.stopPropagation();}finish();};
      intro.addEventListener('click',skip);addEventListener('keydown',skip,true);setTimeout(finish,2900);
      try{sfx('turn-end');}catch(e){}
    })();

    /* 필드(.arena) 기준 연출 프레임: 스킬/마법/궁극기 오버레이가 생길 때마다 필드 위치로 맞춘다 */
    const FIELD_OVERLAYS='.guardian-descent,.guardian-select,.awaken-flight,.awaken-flare,.cinematic-skill-fx,.ultimate-cutscene,.global-spell,.global-summon,.effect-narration,.awakening-proc-banner,.shatter-resonance-fx,.spell-target-ring,.card-depart,.card-depart-dest,.avenger-arrival,.initiative-banner';
    function syncFieldFrame(){const arena=document.querySelector('.arena');if(!arena)return;const r=arena.getBoundingClientRect(),st=document.documentElement.style;st.setProperty('--field-left',r.left+'px');st.setProperty('--field-top',r.top+'px');st.setProperty('--field-width',r.width+'px');st.setProperty('--field-height',r.height+'px');st.setProperty('--field-cx',(r.left+r.width/2)+'px');st.setProperty('--field-bottom',r.bottom+'px');}
    new MutationObserver(list=>{if(list.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&n.matches(FIELD_OVERLAYS))))syncFieldFrame();}).observe(document.body,{childList:true});
    addEventListener('resize',syncFieldFrame);syncFieldFrame();

    /* 캐릭터 이미지 로딩 복구: 실패(error)·멈춤(6초 미완료) 시 같은 src로 최대 3회 재요청, 끝내 실패하면 이니셜 placeholder */
    (function(){
      const MAX_RETRY=3,STALL_MS=6000;
      function giveUp(img){const frame=img.closest('.art,.emoji');if(!frame)return;frame.dataset.initial=(img.getAttribute('alt')||'?').trim().charAt(0);frame.classList.add('art-failed');}
      function retry(img){const n=Number(img.dataset.tries||0);if(img.naturalWidth)return;if(n>=MAX_RETRY){giveUp(img);return;}img.dataset.tries=n+1;const src=img.getAttribute('src');setTimeout(()=>{img.removeAttribute('src');img.setAttribute('src',src);arm(img);},400*(n+1));}
      function arm(img){clearTimeout(img._stall);img._stall=setTimeout(()=>{if(!(img.complete&&img.naturalWidth))retry(img);},STALL_MS);}
      function watch(img){if(img.dataset.watch)return;img.dataset.watch='1';if(!(img.complete&&img.naturalWidth))arm(img);}
      document.addEventListener('error',e=>{if(e.target.matches?.('img.creature-art,img.magic-art-image'))retry(e.target);},true);
      document.addEventListener('load',e=>{if(e.target.matches?.('img.creature-art,img.magic-art-image')){clearTimeout(e.target._stall);e.target.closest('.art-failed')?.classList.remove('art-failed');}},true);
      new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.matches('img.creature-art,img.magic-art-image'))watch(n);n.querySelectorAll?.('img.creature-art,img.magic-art-image').forEach(watch);}))).observe(document.body,{childList:true,subtree:true});
      document.querySelectorAll('img.creature-art,img.magic-art-image').forEach(watch);
    })();

    /* 궁극기 세팅 모드: 장착은 소환 비용과 무관하므로 모든 캐릭터 카드를 밝게 표시하고 선택 가능함을 강조한다 */
    (function(){
      const baseAffordability=updateCardAffordability;
      updateCardAffordability=function(){baseAffordability();if(!(ultimateArmed&&!ultimateState))return;document.querySelectorAll('.hand .card').forEach(card=>{card.classList.remove('unaffordable','blood-option');card.dataset.bloodPayment='';card.setAttribute('aria-disabled','false');});};
      const baseRender=renderUltimate;
      renderUltimate=function(){baseRender();const arming=Boolean(ultimateArmed&&!ultimateState);document.querySelector('.hand')?.classList.toggle('ultimate-arming',arming);updateCardAffordability();syncUltimatePreviews(arming);syncAuraUltimateCandidates(arming);};
      /* 세팅 모드에서는 카드의 일반 정보 대신 '장착 시 실제 적용될 궁극기 정보'를 보여준다 (원본 DOM은 건드리지 않고 미리보기만 덧붙임) */
      function syncUltimatePreviews(arming){document.querySelectorAll('.hand .card .ult-preview').forEach(node=>node.remove());if(!arming)return;document.querySelectorAll('.hand .card.summon-card').forEach(card=>{const spec=ultimateSpec(card),box=document.createElement('div');box.className='ult-preview';box.innerHTML='<div class="ult-body"><div class="ult-name"></div><div class="ult-block ult-effect"><span class="ult-label">효과</span><p></p></div><div class="ult-block ult-cond"><span class="ult-label">발동 조건</span><em></em></div></div><div class="ult-meta"><span></span></div>';box.querySelector('.ult-effect p').textContent=spec.description;box.querySelector('.ult-name').textContent=card.querySelector('h3').textContent;/* 최소 사용 턴은 상시로 보여주지 않는다 — 실제로 턴이 모자라 잠겼을 때만
   발동 버튼이 사유로 알린다 (2026-11-07 PM 요청) */
        const meta=box.querySelectorAll('.ult-meta span');meta[0].textContent='마나 '+spec.cost;box.querySelector('.ult-cond em').textContent=spec.condition;card.querySelector('h3').after(box);});}
      function syncAuraUltimateCandidates(arming){const hand=document.querySelector('.hand'),persona=arming?AURA_PERSONALITY_BY_GUARDIAN[playerGuardian]:null,cards=[...document.querySelectorAll('.hand .card.summon-card')];hand?.classList.toggle('aura-candidate-mode',Boolean(persona));cards.forEach(card=>{const match=Boolean(persona&&card.dataset.persona===persona);card.classList.toggle('aura-ultimate-match',match);card.classList.toggle('aura-ultimate-mismatch',Boolean(persona&&!match));if(match)card.setAttribute('aria-description',GUARDIANS[playerGuardian].name+'와 같은 성격 계열 · 오라 공명 추천');else card.removeAttribute('aria-description');});if(persona){cards.sort((a,b)=>Number(b.dataset.persona===persona)-Number(a.dataset.persona===persona)).forEach(card=>hand.appendChild(card));}}
      renderUltimate();
    })();

    /* 배경음악: Vex - 최후 결전 (BPM 125). 볼륨은 사운드 패널의 슬라이더로 조절하고 localStorage에 저장한다.
       브라우저 자동재생 정책 때문에 첫 클릭/키 입력 때 시작한다.
       복수자가 대전에서 처음 등장하면(어느 편이든) Vex - 각성 (BPM 145)으로 크로스페이드하고, 그 배틀이 끝날 때까지 유지한다(새로고침 = 새 배틀). */
    const bgmTracks={main:new Audio('assets/audio/bgm-final-battle.mp3'),awakening:new Audio('assets/audio/bgm-awakening.mp3')};
    Object.values(bgmTracks).forEach(track=>{track.loop=true;track.volume=audioPrefs.bgm;track.preload='auto';});
    let bgm=bgmTracks.main,bgmFadeTimer=null;
    const BGM_CROSSFADE_MS=1600;
    function switchToAwakeningBgm(){const from=bgm,to=bgmTracks.awakening;if(from===to)return;bgm=to;clearInterval(bgmFadeTimer);to.currentTime=0;to.volume=0;syncBgm();if(from.paused){to.volume=audioPrefs.bgm;return;}const start=performance.now();bgmFadeTimer=setInterval(()=>{const t=Math.min(1,(performance.now()-start)/BGM_CROSSFADE_MS);from.volume=audioPrefs.bgm*(1-t);to.volume=audioPrefs.bgm*t;if(t>=1){clearInterval(bgmFadeTimer);bgmFadeTimer=null;from.pause();from.volume=audioPrefs.bgm;}},50);}
    var sfxBusNode=null;
    function sfxBus(ctx){if(!sfxBusNode||sfxBusNode.context!==ctx){sfxBusNode=ctx.createGain();/* 안전 리미터: 효과음 볼륨을 크게 올려도 -6dBFS 부근에서 눌러 찌그러짐을 막는다 */const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.12;sfxBusNode.connect(limiter);limiter.connect(ctx.destination);}sfxBusNode.gain.value=audioPrefs.sfx;return sfxBusNode;}
    function saveAudioPrefs(){try{localStorage.setItem(AUDIO_PREF_KEY,JSON.stringify(audioPrefs));}catch(e){}}
    function syncBgm(){try{bgmTracks;}catch(e){return;}/* 초기화 전(개발 옵션 ?guardian= 로 시작 시 성격 오라 선택이 먼저 실행됨)에는 건너뛴다 — 첫 클릭 때 다시 시작됨 */Object.values(bgmTracks).forEach(track=>{if(track!==bgm&&!bgmFadeTimer)track.pause();});if(soundOn&&!document.hidden&&audioPrefs.bgm>0)bgm.play().catch(()=>{});else{clearInterval(bgmFadeTimer);bgmFadeTimer=null;Object.values(bgmTracks).forEach(track=>{track.pause();track.volume=audioPrefs.bgm;});}}
    function renderSoundPanel(){const bgmSlider=document.querySelector('#bgm-slider'),sfxSlider=document.querySelector('#sfx-slider');bgmSlider.value=Math.round(audioPrefs.bgm*100);sfxSlider.value=Math.round(audioPrefs.sfx*100);document.querySelector('#bgm-value').textContent=bgmSlider.value+'%';document.querySelector('#sfx-value').textContent=sfxSlider.value+'%';document.querySelector('#sound-toggle').textContent=soundOn?'🔊 사운드':'🔇 사운드';document.querySelector('#sound-mute').textContent=soundOn?'🔇 전체 음소거':'🔊 음소거 해제';}
    function toggleSoundPanel(force){const panel=document.querySelector('#sound-panel'),open=force===undefined?panel.hidden:force;panel.hidden=!open;document.querySelector('#sound-toggle').setAttribute('aria-expanded',String(open));if(open)renderSoundPanel();}
    function toggleMute(){soundOn=!soundOn;audioPrefs.muted=!soundOn;saveAudioPrefs();syncBgm();renderSoundPanel();}
    document.querySelector('#bgm-slider').addEventListener('input',e=>{audioPrefs.bgm=e.target.value/100;if(!bgmFadeTimer)Object.values(bgmTracks).forEach(track=>track.volume=audioPrefs.bgm);saveAudioPrefs();syncBgm();renderSoundPanel();});
    document.querySelector('#sfx-slider').addEventListener('input',e=>{audioPrefs.sfx=e.target.value/100;if(sfxBusNode)sfxBusNode.gain.value=audioPrefs.sfx;saveAudioPrefs();renderSoundPanel();});
    document.querySelector('#sfx-slider').addEventListener('change',()=>playAudio('metal',.4));
    document.addEventListener('pointerdown',e=>{if(!e.target.closest('.sound-wrap'))toggleSoundPanel(false);});
    addEventListener('keydown',e=>{if(e.key==='Escape')toggleSoundPanel(false);});
    ['pointerdown','keydown'].forEach(type=>addEventListener(type,function startBgm(){if(!guardianChosen)return;syncBgm();if(!bgm.paused)['pointerdown','keydown'].forEach(t=>removeEventListener(t,startBgm));},{capture:true}));
    document.addEventListener('visibilitychange',syncBgm);
    renderSoundPanel();

    /* 덱 편집 드래그: 보유 카드 → 전투 덱 패널(추가), 덱 목록 → 보유 카드 영역(제거). 목록이 다시 그려지므로 컨테이너에 위임한다 */
    (function(){
      let dragged=null;const ownedGrid=document.querySelector('#owned-grid'),deckList=document.querySelector('.deck-list');
      const canAdd=index=>draftDeck.length<60&&canAddAuraToDeck(draftDeck,index)&&countInDraft(index)<Math.min(DECK_COPY_LIMIT,collectionState.owned[index]);
      const clearOver=()=>{deckList.classList.remove('drag-over','drag-denied');ownedGrid.classList.remove('drag-over');};
      document.querySelector('#deck-view').addEventListener('dragstart',e=>{const node=e.target.closest?.('.owned-card[data-index],.deck-row[data-index]');if(!node)return;dragged={index:Number(node.dataset.index),from:node.classList.contains('deck-row')?'deck':'owned'};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','deck-card:'+dragged.index);node.classList.add('dragging');});
      document.querySelector('#deck-view').addEventListener('dragend',e=>{dragged=null;clearOver();document.querySelectorAll('#deck-view .dragging').forEach(n=>n.classList.remove('dragging'));});
      deckList.addEventListener('dragover',e=>{if(dragged?.from!=='owned')return;const ok=canAdd(dragged.index);e.preventDefault();e.dataTransfer.dropEffect=ok?'move':'none';deckList.classList.toggle('drag-over',ok);deckList.classList.toggle('drag-denied',!ok);});
      deckList.addEventListener('dragleave',e=>{if(!deckList.contains(e.relatedTarget))clearOver();});
      deckList.addEventListener('drop',e=>{if(dragged?.from!=='owned')return;e.preventDefault();const index=dragged.index;clearOver();if(canAdd(index))addToDraft(index);});
      ownedGrid.addEventListener('dragover',e=>{if(dragged?.from!=='deck')return;e.preventDefault();e.dataTransfer.dropEffect='move';ownedGrid.classList.add('drag-over');});
      ownedGrid.addEventListener('dragleave',e=>{if(!ownedGrid.contains(e.relatedTarget))clearOver();});
      ownedGrid.addEventListener('drop',e=>{if(dragged?.from!=='deck')return;e.preventDefault();const index=dragged.index;clearOver();removeFromDraft(index);});
    })();

