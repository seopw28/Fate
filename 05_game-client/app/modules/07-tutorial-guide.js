
    /* ===== 새 튜토리얼: 기능 시연 가이드 (2026-11-09 PM 요청, PRD 1-4) =====
       대전과 별개인 연출 전용 무대에서 기능 6개를 차례로 보여 준다. 단계마다 시연 애니메이션이 끝나면
       빛나는 버튼이 열리고, 유저가 한 번 눌러야 다음 단계로 넘어간다. 무대의 카드, 마나, 체력은 연출용이며
       덱, 재화, 대전 기록에 반영하지 않는다. 세부 임시 결정은 docs/plan-tutorial-guide.md 를 따른다. */
    const TUTORIAL_GUIDE_SEEN_KEY='fate.tutorialGuide.seen';
    const tgWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    let tgRun=0;
    const TUTORIAL_GUIDE_STEPS=[
      {key:'draw',title:'카드 뽑기',desc:'준비 단계에서 마나를 내고 덱에서 카드를 더 뽑을 수 있어요. 한 턴에 뽑을수록 비용이 2, 4, 8로 올라가요.',prompt:'카드 뽑기 버튼을 눌러 보세요'},
      {key:'order',title:'카드 순서 바꾸기',desc:'전장의 하수인 순서를 바꿀 수 있어요. 맨 왼쪽 하수인이 상대 공격을 가장 먼저 받아요.',prompt:'빛나는 하수인을 맨 왼쪽으로 끌어 보세요'},
      {key:'auraMagic',title:'오라 마법',desc:'남은 마나를 모두 모아 내 성격 오라의 마법을 써요. 쓴 마나가 많을수록 강하고, 3턴에 한 번 쓸 수 있어요.',prompt:'오라 마법 버튼을 눌러 보세요'},
      {key:'graveRecall',title:'묘지 회수',desc:'손패의 마법 카드 1장을 제물로 바치면 묘지의 하수인 1장이 손패로 돌아와요. 마나 5와 체력이 들어요.',prompt:'묘지 회수 버튼을 눌러 보세요'},
      {key:'awaken',title:'오라 각성',desc:'내 체력이 처음 85 이하가 되면 오라 각성이 열려요. 강화 2개 중 하나를 골라 대전 끝까지 유지해요.',prompt:'오라 각성 버튼을 눌러 보세요'},
      {key:'hero',title:'영웅 강림',desc:'오라 각성을 마치면 영웅 강림을 쓸 수 있어요. 손패 하수인 하나를 소진자로 불러내 상대 전장을 휩쓸어요. 내 오라와 같은 카드는 더 강해지고, 소진자가 쓰러지면 복수자가 강림해요.',prompt:'영웅 강림 버튼을 눌러 보세요'},
    ];
    /* 단계별 무대 구성과 시연은 체크리스트 2~4단계에서 채운다. 비어 있으면 기본 무대(따라 누를 버튼 하나)를 쓴다. */
    const TUTORIAL_GUIDE_SCENES={};
    function tgDefaultScene(stage,step){stage.innerHTML='<div class="tg-scene tg-scene-default"><button type="button" class="tg-target" data-tg-target>'+step.title+'</button></div>';}
    function tutorialGuideOverlay(){return document.querySelector('.tutorial-guide');}
    function openTutorialGuide(){
      if(tutorialGuideOverlay())return;
      try{localStorage.setItem(TUTORIAL_GUIDE_SEEN_KEY,'1');}catch(e){}
      const overlay=document.createElement('div');overlay.className='tutorial-guide';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','튜토리얼');
      overlay.innerHTML='<div class="tg-panel">'
        +'<div class="tg-top"><strong class="tg-brand">튜토리얼</strong><span class="tg-count" aria-live="polite"></span><button type="button" class="tg-skip" data-tg-skip>건너뛰기</button></div>'
        +'<div class="tg-stage" aria-hidden="true"></div>'
        +'<div class="tg-caption"><h3 class="tg-title"></h3><p class="tg-desc"></p></div>'
        +'<div class="tg-bottom"><button type="button" class="tg-replay" data-tg-replay>다시 보기</button><b class="tg-prompt" aria-live="polite"></b></div>'
        +'<ol class="tg-progress">'+TUTORIAL_GUIDE_STEPS.map(step=>'<li title="'+step.title+'"><span>'+step.title+'</span></li>').join('')+'</ol>'
        +'</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-tg-skip]').addEventListener('click',()=>closeTutorialGuide(false));
      overlay.addEventListener('keydown',event=>{if(event.key==='Escape')closeTutorialGuide(false);});
      showTutorialGuideStep(0);
      overlay.querySelector('[data-tg-skip]').focus();
    }
    function closeTutorialGuide(completed){
      tgRun++;const overlay=tutorialGuideOverlay();if(!overlay)return;
      overlay.classList.add('closing');setTimeout(()=>overlay.remove(),220);
      if(typeof writeLog==='function')writeLog('<strong>튜토리얼:</strong> '+(completed?'모두 마쳤습니다.':'건너뛰었습니다. 보상은 지급하지 않습니다.'));
    }
    async function showTutorialGuideStep(index){
      const overlay=tutorialGuideOverlay();if(!overlay)return;
      const run=++tgRun,alive=()=>run===tgRun&&overlay.isConnected;
      const step=TUTORIAL_GUIDE_STEPS[index],scene=TUTORIAL_GUIDE_SCENES[step.key]||{};
      overlay.dataset.step=step.key;
      overlay.querySelector('.tg-count').textContent=(index+1)+' / '+TUTORIAL_GUIDE_STEPS.length;
      overlay.querySelector('.tg-title').textContent=step.title;
      overlay.querySelector('.tg-desc').textContent=step.desc;
      overlay.querySelectorAll('.tg-progress li').forEach((li,i)=>{li.classList.toggle('done',i<index);li.classList.toggle('current',i===index);});
      const prompt=overlay.querySelector('.tg-prompt'),replay=overlay.querySelector('[data-tg-replay]'),stage=overlay.querySelector('.tg-stage');
      prompt.textContent='';prompt.classList.remove('ready');replay.disabled=true;
      (scene.build||tgDefaultScene)(stage,step);
      if(scene.demo)await scene.demo(stage,alive);
      if(!alive())return;
      replay.disabled=!scene.demo;replay.onclick=()=>showTutorialGuideStep(index);
      prompt.textContent=step.prompt;prompt.classList.add('ready');
      stage.setAttribute('aria-hidden','false');
      const passed=scene.action?await scene.action(stage,alive):await tgWaitTarget(stage,alive);
      if(!passed||!alive())return;
      stage.setAttribute('aria-hidden','true');
      prompt.textContent='잘했어요!';prompt.classList.add('success');
      await tgWait(700);if(!alive())return;prompt.classList.remove('success');
      if(index+1<TUTORIAL_GUIDE_STEPS.length)showTutorialGuideStep(index+1);
      else showTutorialGuideComplete();
    }
    /* 무대 안의 [data-tg-target] 을 빛내고, 누르면 true 로 끝난다. 여러 개면 순서대로 눌러야 한다. */
    function tgWaitTarget(stage,alive,selector='[data-tg-target]'){
      return new Promise(resolve=>{
        const target=stage.querySelector(selector);if(!target){resolve(true);return;}
        target.classList.add('tg-glow');target.disabled=false;
        target.addEventListener('click',()=>{target.classList.remove('tg-glow');target.classList.add('tg-pressed');resolve(alive());},{once:true});
        target.focus({preventScroll:true});
      });
    }
    function showTutorialGuideComplete(){
      const overlay=tutorialGuideOverlay();if(!overlay)return;
      overlay.querySelectorAll('.tg-progress li').forEach(li=>{li.classList.add('done');li.classList.remove('current');});
      overlay.querySelector('.tg-count').textContent='완료';
      overlay.querySelector('.tg-title').textContent='튜토리얼 완료';
      const reward=grantTutorialGuideReward();
      overlay.querySelector('.tg-desc').textContent='주요 기능을 모두 익혔어요. 이제 대전에서 직접 써 보세요.'+(reward?' 완료 보상으로 '+reward+'크래커를 받았어요.':' 완료 보상은 처음 한 번만 받을 수 있어요.');
      overlay.querySelector('.tg-prompt').textContent='';
      overlay.querySelector('[data-tg-replay]').disabled=true;
      overlay.querySelector('[data-tg-skip]').hidden=true;
      overlay.querySelector('.tg-stage').innerHTML='<div class="tg-scene tg-scene-default tg-scene-done">'+(reward?'<div class="tg-reward">◆ +'+reward+' 크래커</div>':'')+'<button type="button" class="tg-target tg-glow" data-tg-finish>대전하러 가기</button></div>';
      const finishButton=overlay.querySelector('[data-tg-finish]');finishButton.addEventListener('click',()=>closeTutorialGuide(true),{once:true});finishButton.focus();
    }
    /* 처음 방문한 브라우저에서는 한 번 자동으로 연다. 자동화 검사(webdriver)에서는 열지 않는다. */
    function maybeAutoOpenTutorialGuide(){
      let seen=false;try{seen=localStorage.getItem(TUTORIAL_GUIDE_SEEN_KEY)==='1';}catch(e){seen=true;}
      if(seen||navigator.webdriver)return;
      setTimeout(openTutorialGuide,400);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',maybeAutoOpenTutorialGuide);else maybeAutoOpenTutorialGuide();

    /* ----- 시연 공용 도구: 연출용 카드, 시연 커서, 날아가기 ----- */
    const tgEsc=text=>String(text).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
    function tgPickCards(count,{aura='fire',type='champion',offset=0}={}){
      const usable=card=>card.cardType===type&&card.assetId&&card.releaseState!=='prototype'&&!/\/prototype\//.test(card.assetId);
      const pool=PrimalCardSet.cards.filter(card=>usable(card)&&(!aura||card.aura===aura));
      const list=pool.length?pool:PrimalCardSet.cards.filter(usable);
      return Array.from({length:count},(_,i)=>list[(offset+i)%list.length]);
    }
    function tgCardHtml(card,extraClass=''){
      const stats=card.stats?'<span class="tg-stats"><i>⚔ '+card.stats.attack+'</i><i>♥ '+card.stats.health+'</i></span>':'<span class="tg-stats tg-spell-tag"><i>마법</i></span>';
      return '<div class="tg-card '+(card.aura||'')+' '+extraClass+'" data-card-id="'+tgEsc(card.cardId)+'"><span class="tg-cost">'+card.cost+'</span><img src="assets/'+tgEsc(card.assetId)+'" alt=""><b>'+tgEsc(card.displayName)+'</b>'+stats+'</div>';
    }
    function tgRect(stage,el){const s=stage.getBoundingClientRect(),r=el.getBoundingClientRect();return {x:r.left-s.left,y:r.top-s.top,w:r.width,h:r.height,cx:r.left-s.left+r.width/2,cy:r.top-s.top+r.height/2};}
    function tgCursor(stage){let cursor=stage.querySelector('.tg-cursor');if(!cursor){cursor=document.createElement('span');cursor.className='tg-cursor';stage.appendChild(cursor);const r=stage.getBoundingClientRect();cursor.style.transform='translate('+(r.width*.5)+'px,'+(r.height+30)+'px)';}return cursor;}
    async function tgCursorTo(stage,el,ms=650){const cursor=tgCursor(stage),r=tgRect(stage,el);cursor.style.transition='transform '+ms+'ms cubic-bezier(.4,.1,.2,1)';cursor.style.transform='translate('+r.cx+'px,'+r.cy+'px)';await tgWait(ms+60);}
    async function tgCursorTap(stage){const cursor=tgCursor(stage);cursor.classList.remove('tap');void cursor.offsetWidth;cursor.classList.add('tap');await tgWait(260);}
    function tgCursorHide(stage){stage.querySelector('.tg-cursor')?.remove();}
    async function tgFly(stage,node,from,to,ms=520){
      node.style.position='absolute';node.style.left='0';node.style.top='0';node.style.margin='0';node.style.zIndex='5';stage.appendChild(node);
      const anim=node.animate([{transform:'translate('+from.x+'px,'+from.y+'px) scale('+(from.s||1)+')'},{transform:'translate('+((from.x+to.x)/2)+'px,'+(Math.min(from.y,to.y)-40)+'px) scale(1.08)',offset:.55},{transform:'translate('+to.x+'px,'+to.y+'px) scale('+(to.s||1)+')'}],{duration:ms,easing:'cubic-bezier(.3,.1,.25,1)',fill:'forwards'});
      await anim.finished.catch(()=>{});return node;
    }

    /* ----- 1. 카드 뽑기: 덱에서 손패로, 비용 2 → 4 → 8 ----- */
    const tgDrawState={};
    TUTORIAL_GUIDE_SCENES.draw={
      build(stage){
        tgDrawState.mana=7;tgDrawState.cost=2;tgDrawState.next=3;
        const hand=tgPickCards(3);
        stage.innerHTML='<div class="tg-scene tg-scene-draw">'
          +'<div class="tg-mana">마나 <b>7</b> / 10</div>'
          +'<div class="tg-deck"><i></i><i></i><i></i><span>덱</span></div>'
          +'<button type="button" class="tg-action tg-draw-btn" data-tg-target disabled>＋ 카드 뽑기 <small>· 비용 <b>2</b>마나</small></button>'
          +'<div class="tg-hand">'+hand.map(card=>tgCardHtml(card)).join('')+'</div>'
          +'</div>';
      },
      async draw(stage,alive){
        const scene=stage.querySelector('.tg-scene-draw');if(!scene)return;
        const cost=tgDrawState.cost;tgDrawState.mana-=cost;tgDrawState.cost*=2;
        const mana=scene.querySelector('.tg-mana b');mana.textContent=tgDrawState.mana;mana.parentElement.classList.remove('spend');void mana.offsetWidth;mana.parentElement.classList.add('spend');
        scene.querySelector('.tg-draw-btn small b').textContent=tgDrawState.cost;
        const hand=scene.querySelector('.tg-hand'),deck=scene.querySelector('.tg-deck');
        const card=tgPickCards(1,{offset:tgDrawState.next++})[0];
        const slot=document.createElement('div');slot.innerHTML=tgCardHtml(card,'tg-arriving');const face=slot.firstChild;hand.appendChild(face);
        const target=tgRect(stage,face),origin=tgRect(stage,deck);
        const back=document.createElement('div');back.className='tg-card-back';back.style.width=target.w+'px';back.style.height=target.h+'px';
        await tgFly(stage,back,{x:origin.x,y:origin.y},{x:target.x,y:target.y});
        if(!alive())return;back.remove();face.classList.remove('tg-arriving');face.classList.add('tg-flip');
        await tgWait(380);
      },
      async demo(stage,alive){
        const button=stage.querySelector('.tg-draw-btn');
        for(let i=0;i<2&&alive();i++){await tgCursorTo(stage,button);if(!alive())return;await tgCursorTap(stage);await this.draw(stage,alive);await tgWait(350);}
        if(!alive())return;tgCursorHide(stage);await tgWait(300);if(!alive())return;this.build(stage);
      },
      async action(stage,alive){const passed=await tgWaitTarget(stage,alive);if(!passed)return false;await this.draw(stage,alive);return alive();},
    };

    /* ----- 2. 카드 순서 바꾸기: 끌어서 맨 왼쪽으로, 맨 왼쪽이 먼저 맞는다 ----- */
    function tgOrderFlip(row,mutate){
      const cards=[...row.children],before=new Map(cards.map(card=>[card,card.getBoundingClientRect().left]));
      mutate();
      cards.forEach(card=>{const dx=before.get(card)-card.getBoundingClientRect().left;if(dx)card.animate([{transform:'translateX('+dx+'px)'},{transform:'none'}],{duration:420,easing:'cubic-bezier(.3,.1,.25,1)'});});
      return tgWait(440);
    }
    async function tgOrderHit(stage,alive){
      const row=stage.querySelector('.tg-field'),first=row.firstElementChild,enemy=stage.querySelector('.tg-enemy');if(!first||!enemy)return;
      const from=tgRect(stage,enemy),to=tgRect(stage,first);
      const bolt=document.createElement('span');bolt.className='tg-bolt';
      await tgFly(stage,bolt,{x:from.cx-10,y:from.cy},{x:to.cx-10,y:to.y+10},420);
      if(!alive())return;bolt.remove();first.classList.remove('tg-hit');void first.offsetWidth;first.classList.add('tg-hit');await tgWait(450);
    }
    TUTORIAL_GUIDE_SCENES.order={
      build(stage){
        const field=tgPickCards(3,{offset:6});
        stage.innerHTML='<div class="tg-scene tg-scene-order">'
          +'<div class="tg-enemy">상대 하수인</div>'
          +'<div class="tg-first-mark">먼저 맞아요</div>'
          +'<div class="tg-field">'+field.map((card,i)=>tgCardHtml(card,i===2?'tg-mover':'')).join('')+'</div>'
          +'</div>';
      },
      async demo(stage,alive){
        await tgOrderHit(stage,alive);if(!alive())return;
        const row=stage.querySelector('.tg-field'),mover=row.querySelector('.tg-mover');
        await tgCursorTo(stage,mover);if(!alive())return;await tgCursorTap(stage);
        mover.classList.add('tg-lifted');await tgCursorTo(stage,row.firstElementChild,700);if(!alive())return;
        mover.classList.remove('tg-lifted');await tgOrderFlip(row,()=>row.prepend(mover));if(!alive())return;
        tgCursorHide(stage);await tgOrderHit(stage,alive);if(!alive())return;await tgWait(500);if(!alive())return;this.build(stage);
      },
      action(stage,alive){
        return new Promise(resolve=>{
          const row=stage.querySelector('.tg-field'),mover=row.querySelector('.tg-mover');
          mover.classList.add('tg-glow');mover.setAttribute('data-tg-target','');row.firstElementChild.classList.add('tg-drop-here');
          let start=null;
          const move=event=>{if(!start)return;mover.style.transform='translate('+(event.clientX-start.x)+'px,'+(event.clientY-start.y)+'px) scale(1.06)';};
          const up=async event=>{
            if(!start)return;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
            const first=row.firstElementChild.getBoundingClientRect(),dropX=event.clientX;start=null;
            mover.classList.remove('tg-lifted');mover.style.transform='';
            if(dropX<first.left+first.width*.75){
              mover.classList.remove('tg-glow');row.querySelector('.tg-drop-here')?.classList.remove('tg-drop-here');
              await tgOrderFlip(row,()=>row.prepend(mover));if(!alive()){resolve(false);return;}
              await tgOrderHit(stage,alive);resolve(alive());
            }
          };
          mover.addEventListener('pointerdown',event=>{event.preventDefault();start={x:event.clientX,y:event.clientY};mover.classList.add('tg-lifted');window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);});
        });
      },
    };

    /* ----- 소환사 체력, 피해 숫자, 부서지기 ----- */
    function tgHpHtml(side,label,hp){return '<div class="tg-hp tg-hp-'+side+'"><span>'+label+'</span><b>♥ <em>'+hp+'</em></b></div>';}
    function tgSetHp(stage,side,hp,delta){
      const box=stage.querySelector('.tg-hp-'+side);if(!box)return;box.querySelector('em').textContent=hp;
      const pop=document.createElement('i');pop.className='tg-pop '+(delta<0?'dmg':'heal');pop.textContent=(delta>0?'+':'')+delta;box.appendChild(pop);setTimeout(()=>pop.remove(),900);
      box.classList.remove('tg-hit');void box.offsetWidth;if(delta<0)box.classList.add('tg-hit');
    }
    function tgSetMana(stage,value){const mana=stage.querySelector('.tg-mana b');if(!mana)return;mana.textContent=value;mana.parentElement.classList.remove('spend');void mana.offsetWidth;mana.parentElement.classList.add('spend');}
    async function tgShatter(stage,card){
      const r=tgRect(stage,card),html=card.outerHTML;card.style.visibility='hidden';
      const pieces=[[0,0,50,50,-1,-1],[50,0,100,50,1,-1],[0,50,50,100,-1,1],[50,50,100,100,1,1]].map(([x1,y1,x2,y2,dx,dy])=>{
        const wrap=document.createElement('div');wrap.className='tg-shard';wrap.innerHTML=html;wrap.style.cssText='position:absolute;left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px;z-index:8;clip-path:polygon('+x1+'% '+y1+'%,'+x2+'% '+y1+'%,'+x2+'% '+y2+'%,'+x1+'% '+y2+'%)';
        stage.appendChild(wrap);return wrap.animate([{transform:'none',opacity:1},{transform:'translate('+dx*34+'px,'+dy*30+'px) rotate('+dx*dy*24+'deg)',opacity:0}],{duration:520,easing:'cubic-bezier(.2,.6,.3,1)',fill:'forwards'}).finished.then(()=>wrap.remove()).catch(()=>{});
      });
      await Promise.all(pieces);card.remove();
    }

    /* ----- 3. 오라 마법: 남은 마나를 모두 모아 쏜다 (불 = 열정의 불꽃) ----- */
    TUTORIAL_GUIDE_SCENES.auraMagic={
      build(stage){
        const spell=(typeof AURA_MAGIC!=='undefined'&&AURA_MAGIC.jujak)||{persona:'열정',name:'열정의 불꽃'};
        stage.innerHTML='<div class="tg-scene tg-scene-aura">'
          +tgHpHtml('enemy','상대 소환사',100)+tgHpHtml('player','내 소환사',100)
          +'<div class="tg-mana">마나 <b>6</b> / 10</div>'
          +'<button type="button" class="tg-action tg-aura-btn fire" data-tg-target disabled><span class="tg-aura-persona">'+tgEsc(spell.persona)+'</span>'+tgEsc(spell.name)+'<small>남은 마나를 모두 사용</small></button>'
          +'<div class="tg-note">쓴 마나 6만큼 상대에게 피해, 나도 절반(3) 피해</div>'
          +'</div>';
      },
      async cast(stage,alive){
        const manaBox=stage.querySelector('.tg-mana'),button=stage.querySelector('.tg-aura-btn'),enemy=stage.querySelector('.tg-hp-enemy');
        const from=tgRect(stage,manaBox),mid=tgRect(stage,button);
        const orbs=Array.from({length:6},(_,i)=>{const orb=document.createElement('span');orb.className='tg-orb';return tgFly(stage,orb,{x:from.cx-6+(i-2.5)*6,y:from.cy-6},{x:mid.cx-6,y:mid.cy-6},380+i*70);});
        tgSetMana(stage,0);await Promise.all(orbs);if(!alive())return;
        stage.querySelectorAll('.tg-orb').forEach(orb=>orb.remove());
        const to=tgRect(stage,enemy),ball=document.createElement('span');ball.className='tg-fireball';
        await tgFly(stage,ball,{x:mid.cx-18,y:mid.cy-18,s:.6},{x:to.cx-18,y:to.cy-18,s:1.3},560);if(!alive())return;ball.remove();
        tgSetHp(stage,'enemy',94,-6);await tgWait(380);if(!alive())return;tgSetHp(stage,'player',97,-3);
        button.classList.add('cooling');button.querySelector('small').textContent='3턴 뒤 다시 쓸 수 있어요';await tgWait(900);
      },
      async demo(stage,alive){
        const button=stage.querySelector('.tg-aura-btn');await tgCursorTo(stage,button);if(!alive())return;await tgCursorTap(stage);
        tgCursorHide(stage);await this.cast(stage,alive);if(!alive())return;await tgWait(300);if(!alive())return;this.build(stage);
      },
      async action(stage,alive){const passed=await tgWaitTarget(stage,alive);if(!passed)return false;await this.cast(stage,alive);return alive();},
    };

    /* ----- 4. 묘지 회수: 손패 마법 1장을 제물로, 묘지 하수인 1장이 손패로 ----- */
    TUTORIAL_GUIDE_SCENES.graveRecall={
      build(stage){
        const spells=tgPickCards(2,{type:'spell',aura:null}),minion=tgPickCards(1,{offset:2})[0];
        stage.innerHTML='<div class="tg-scene tg-scene-grave">'
          +tgHpHtml('player','내 소환사',100)
          +'<div class="tg-mana">마나 <b>7</b> / 10</div>'
          +'<div class="tg-grave"><div class="tg-grave-pile">'+tgCardHtml(tgPickCards(1,{offset:9})[0],'tg-dead')+'</div><span>묘지</span></div>'
          +'<button type="button" class="tg-action tg-grave-btn" data-tg-target disabled>묘지 회수 <small>· 마나 5, 체력 1</small></button>'
          +'<div class="tg-hand">'+spells.map(card=>tgCardHtml(card,'tg-hand-spell')).join('')+tgCardHtml(minion)+'</div>'
          +'<div class="tg-offer" hidden><p>제물로 바칠 마법 카드를 고르세요</p><div class="tg-offer-row"></div></div>'
          +'</div>';
      },
      /* 버튼을 누르면 손패 마법이 무대 가운데로 떠오른다 */
      async open(stage){
        const offer=stage.querySelector('.tg-offer'),row=offer.querySelector('.tg-offer-row');
        stage.querySelectorAll('.tg-hand .tg-hand-spell').forEach(card=>{const clone=card.cloneNode(true);clone.classList.remove('tg-hand-spell');clone.classList.add('tg-offer-card');clone.dataset.source=card.dataset.cardId;row.appendChild(clone);card.classList.add('tg-ghost');});
        offer.hidden=false;offer.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:320,easing:'ease-out'});await tgWait(340);
      },
      async sacrifice(stage,alive,pick){
        const offer=stage.querySelector('.tg-offer'),handCard=stage.querySelector('.tg-hand .tg-hand-spell[data-card-id="'+pick.dataset.source+'"]');
        offer.querySelectorAll('.tg-offer-card').forEach(card=>{if(card!==pick)card.style.opacity='.25';});
        await tgShatter(stage,pick);if(!alive())return;
        handCard?.remove();offer.hidden=true;stage.querySelectorAll('.tg-ghost').forEach(card=>card.classList.remove('tg-ghost'));
        tgSetMana(stage,2);tgSetHp(stage,'player',99,-1);
        const dead=stage.querySelector('.tg-grave .tg-card'),hand=stage.querySelector('.tg-hand');
        const slot=document.createElement('div');slot.innerHTML=dead.outerHTML;const face=slot.firstChild;face.classList.remove('tg-dead');face.classList.add('tg-arriving');hand.appendChild(face);
        const from=tgRect(stage,dead),to=tgRect(stage,face),riser=dead.cloneNode(true);riser.classList.remove('tg-dead');riser.classList.add('tg-rising');dead.style.visibility='hidden';
        riser.style.cssText='position:absolute;left:0;top:0;z-index:7;';stage.appendChild(riser);
        await riser.animate([{transform:'translate('+from.x+'px,'+(from.y+20)+'px)',opacity:.2,filter:'grayscale(1) brightness(.5)'},{transform:'translate('+from.x+'px,'+(from.y-30)+'px)',opacity:1,filter:'none'}],{duration:520,easing:'ease-out',fill:'forwards'}).finished.catch(()=>{});
        if(!alive())return;riser.remove();
        const flyer=dead.cloneNode(true);flyer.classList.remove('tg-dead');flyer.style.visibility='';
        await tgFly(stage,flyer,{x:from.x,y:from.y-30},{x:to.x,y:to.y},560);if(!alive())return;flyer.remove();face.classList.remove('tg-arriving');face.classList.add('tg-flip');await tgWait(600);
      },
      async demo(stage,alive){
        const button=stage.querySelector('.tg-grave-btn');await tgCursorTo(stage,button);if(!alive())return;await tgCursorTap(stage);
        await this.open(stage);if(!alive())return;const pick=stage.querySelector('.tg-offer-card');
        await tgCursorTo(stage,pick);if(!alive())return;await tgCursorTap(stage);tgCursorHide(stage);
        await this.sacrifice(stage,alive,pick);if(!alive())return;await tgWait(300);if(!alive())return;this.build(stage);
      },
      async action(stage,alive){
        if(!await tgWaitTarget(stage,alive))return false;await this.open(stage);if(!alive())return false;
        const prompt=tutorialGuideOverlay()?.querySelector('.tg-prompt');if(prompt)prompt.textContent='제물로 바칠 마법 카드를 눌러 보세요';
        const pick=await new Promise(resolve=>{stage.querySelectorAll('.tg-offer-card').forEach(card=>{card.classList.add('tg-glow');card.addEventListener('click',()=>resolve(card),{once:true});});});
        if(!alive())return false;stage.querySelectorAll('.tg-offer-card').forEach(card=>card.classList.remove('tg-glow'));
        await this.sacrifice(stage,alive,pick);return alive();
      },
    };

    /* ----- 5. 오라 각성: 체력이 85 이하가 되면 열리고, 강화 2개 중 하나 (불 = 불길 확산, 업화) ----- */
    const TG_AWAKEN_CHOICES=[{key:'spread',name:'불길 확산',desc:'적에게 40% 확률로 5턴간 화상 1'},{key:'inferno',name:'업화',desc:'적에게 20% 확률로 2턴간 업화 3'}];
    TUTORIAL_GUIDE_SCENES.awaken={
      build(stage){
        stage.innerHTML='<div class="tg-scene tg-scene-awaken">'
          +'<div class="tg-enemy">상대 하수인</div>'
          +tgHpHtml('player','내 소환사',90)
          +'<div class="tg-threshold">85 이하가 되면 각성이 열려요</div>'
          +'<button type="button" class="tg-action tg-awaken-btn" data-tg-target disabled>오라 각성</button>'
          +'<div class="tg-offer tg-awaken-choice" hidden><p>강화 하나를 고르세요</p><div class="tg-offer-row">'
          +TG_AWAKEN_CHOICES.map(choice=>'<button type="button" class="tg-choice" data-choice="'+choice.key+'"><b>'+choice.name+'</b><small>'+choice.desc+'</small></button>').join('')
          +'</div></div></div>';
      },
      /* 상대 공격으로 체력이 85 아래로 내려가며 버튼이 열린다 */
      async unlock(stage,alive){
        const enemy=stage.querySelector('.tg-enemy'),hp=stage.querySelector('.tg-hp-player'),from=tgRect(stage,enemy),to=tgRect(stage,hp);
        const bolt=document.createElement('span');bolt.className='tg-bolt';await tgFly(stage,bolt,{x:from.cx-10,y:from.cy},{x:to.cx-10,y:to.cy-10},460);if(!alive())return;bolt.remove();
        tgSetHp(stage,'player',84,-6);stage.querySelector('.tg-threshold').classList.add('met');
        const button=stage.querySelector('.tg-awaken-btn');button.classList.add('unlocked');await tgWait(600);
      },
      async choose(stage,alive,key){
        const choice=TG_AWAKEN_CHOICES.find(item=>item.key===key)||TG_AWAKEN_CHOICES[0];
        stage.querySelector('.tg-awaken-choice').hidden=true;
        const sigil=document.createElement('div');sigil.className='tg-sigil';sigil.innerHTML='<span>불</span>';stage.appendChild(sigil);
        await sigil.animate([{transform:'translate(-50%,-140%) scale(.6)',opacity:0},{transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.6},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:800,easing:'cubic-bezier(.3,.1,.25,1)',fill:'forwards'}).finished.catch(()=>{});
        if(!alive())return;
        const banner=document.createElement('div');banner.className='tg-banner';banner.textContent=choice.name+' 각성!';stage.appendChild(banner);
        stage.querySelector('.tg-awaken-btn').classList.add('spent');await tgWait(1100);
      },
      async demo(stage,alive){
        await tgWait(300);await this.unlock(stage,alive);if(!alive())return;
        const button=stage.querySelector('.tg-awaken-btn');await tgCursorTo(stage,button);if(!alive())return;await tgCursorTap(stage);
        stage.querySelector('.tg-awaken-choice').hidden=false;await tgWait(500);if(!alive())return;
        const first=stage.querySelector('.tg-choice');await tgCursorTo(stage,first);if(!alive())return;await tgCursorTap(stage);tgCursorHide(stage);
        await this.choose(stage,alive,first.dataset.choice);if(!alive())return;await tgWait(300);if(!alive())return;this.build(stage);
      },
      async action(stage,alive){
        await this.unlock(stage,alive);if(!alive())return false;
        if(!await tgWaitTarget(stage,alive))return false;
        stage.querySelector('.tg-awaken-choice').hidden=false;
        const prompt=tutorialGuideOverlay()?.querySelector('.tg-prompt');if(prompt)prompt.textContent='마음에 드는 강화를 하나 골라 보세요';
        const key=await new Promise(resolve=>stage.querySelectorAll('.tg-choice').forEach(button=>{button.classList.add('tg-glow');button.addEventListener('click',()=>resolve(button.dataset.choice),{once:true});}));
        if(!alive())return false;await this.choose(stage,alive,key);return alive();
      },
    };

    /* ----- 6. 영웅 강림: 손패 하수인이 떠오르고 같은 오라가 빛남, 소진자 등장 피해, 복수자 강림 ----- */
    TUTORIAL_GUIDE_SCENES.hero={
      build(stage){
        const fire=tgPickCards(1,{offset:4})[0],others=[...tgPickCards(1,{aura:'water'}),...tgPickCards(1,{aura:'earth',offset:1})];
        const enemies=tgPickCards(3,{aura:'metal',offset:3});
        stage.innerHTML='<div class="tg-scene tg-scene-hero">'
          +tgHpHtml('enemy','상대 소환사',60)
          +'<div class="tg-enemy-field">'+enemies.map(card=>tgCardHtml(card,'tg-small')).join('')+'</div>'
          +'<div class="tg-my-field"></div>'
          +'<button type="button" class="tg-action tg-hero-btn" data-tg-target disabled>영웅 강림</button>'
          +'<div class="tg-hand">'+[others[0],fire,others[1]].map(card=>tgCardHtml(card,card===fire?'tg-resonant':'')).join('')+'</div>'
          +'<div class="tg-offer tg-hero-pick" hidden><p>영웅으로 부를 하수인을 고르세요</p><div class="tg-offer-row"></div></div>'
          +'</div>';
      },
      async open(stage){
        const offer=stage.querySelector('.tg-hero-pick'),row=offer.querySelector('.tg-offer-row');
        stage.querySelectorAll('.tg-hand .tg-card').forEach(card=>{const clone=card.cloneNode(true);clone.classList.add('tg-offer-card');clone.dataset.source=card.dataset.cardId;row.appendChild(clone);card.classList.add('tg-ghost');});
        offer.hidden=false;offer.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:320,easing:'ease-out'});await tgWait(340);
        row.querySelectorAll('.tg-resonant').forEach(card=>card.classList.add('tg-aura-shine'));
      },
      async summon(stage,alive,pick){
        const resonant=pick.classList.contains('tg-resonant'),from=tgRect(stage,pick);
        stage.querySelector('.tg-hero-pick').hidden=true;stage.querySelector('.tg-hand .tg-card[data-card-id="'+pick.dataset.source+'"]')?.remove();
        stage.querySelectorAll('.tg-ghost').forEach(card=>card.classList.remove('tg-ghost'));
        const field=stage.querySelector('.tg-my-field'),hero=pick.cloneNode(true);hero.className=hero.className.replace(/tg-(offer-card|glow|aura-shine|resonant)/g,'').trim()+' tg-exhausted';
        const stats=hero.querySelector('.tg-stats');if(stats)stats.innerHTML='<i>⚔ 1</i><i>♥ 1</i>';
        const label=document.createElement('span');label.className='tg-hero-label';label.textContent='소진자';hero.appendChild(label);
        field.appendChild(hero);hero.style.visibility='hidden';const to=tgRect(stage,hero);
        const flyer=hero.cloneNode(true);flyer.style.visibility='';await tgFly(stage,flyer,{x:from.x,y:from.y},{x:to.x,y:to.y},560);if(!alive())return;flyer.remove();hero.style.visibility='';
        hero.animate([{transform:'scale(1.4)',filter:'brightness(2.5)'},{transform:'scale(1.15)',filter:'none'}],{duration:380,easing:'ease-out',fill:'forwards'});await tgWait(400);if(!alive())return;
        if(resonant){
          const beam=document.createElement('div');beam.className='tg-resonance-beam';stage.appendChild(beam);const r=tgRect(stage,hero);beam.style.left=r.cx+'px';
          const banner=document.createElement('div');banner.className='tg-banner';banner.textContent='오라 공명!';stage.appendChild(banner);
          await tgWait(900);if(!alive())return;beam.remove();banner.remove();
        }
        const damage=resonant?10:6,wave=document.createElement('div');wave.className='tg-shockwave';stage.appendChild(wave);
        const r=tgRect(stage,hero);wave.style.left=r.cx+'px';wave.style.top=r.cy+'px';await tgWait(420);if(!alive())return;
        stage.querySelectorAll('.tg-enemy-field .tg-card').forEach(card=>{const pop=document.createElement('i');pop.className='tg-pop dmg';pop.textContent='-'+damage;card.appendChild(pop);card.classList.add('tg-hit','tg-dying');});
        tgSetHp(stage,'enemy',55,-5);await tgWait(800);wave.remove();if(!alive())return;
        stage.querySelectorAll('.tg-enemy-field .tg-card').forEach(card=>card.remove());
      },
      /* 소진자가 쓰러지면 복수자가 강림해 상대 소환사에게 7 피해. 능력치는 소진자의 원래 능력치 +7 / +15 (PRD 3-8) */
      async avenger(stage,alive){
        const hero=stage.querySelector('.tg-exhausted');if(!hero)return;
        const caption=document.createElement('div');caption.className='tg-banner tg-banner-soft';caption.textContent='소진자가 쓰러지면…';stage.appendChild(caption);
        hero.animate([{opacity:1,filter:'none'},{opacity:0,filter:'grayscale(1) blur(2px)'}],{duration:700,fill:'forwards'});await tgWait(900);if(!alive())return;
        caption.textContent='복수자 강림!';caption.classList.remove('tg-banner-soft');
        const avenger=hero.cloneNode(true);avenger.className=avenger.className.replace('tg-exhausted','tg-avenger');avenger.getAnimations?.().forEach(a=>a.cancel());avenger.style.opacity='';
        avenger.querySelector('.tg-hero-label').textContent='복수자';const stats=avenger.querySelector('.tg-stats');const base=PrimalCardSet.cards.find(card=>card.cardId===avenger.dataset.cardId)?.stats||{attack:1,health:1};if(stats)stats.innerHTML='<i>⚔ '+(base.attack+7)+'</i><i>♥ '+(base.health+15)+'</i>';
        hero.replaceWith(avenger);
        await avenger.animate([{transform:'translateY(-120px) scale(1.6)',opacity:0},{transform:'translateY(0) scale(1.25)',opacity:1}],{duration:600,easing:'cubic-bezier(.3,.1,.25,1)',fill:'forwards'}).finished.catch(()=>{});
        if(!alive())return;tgSetHp(stage,'enemy',48,-7);await tgWait(1100);caption.remove();
      },
      async demo(stage,alive){
        const button=stage.querySelector('.tg-hero-btn');await tgCursorTo(stage,button);if(!alive())return;await tgCursorTap(stage);
        await this.open(stage);if(!alive())return;const pick=stage.querySelector('.tg-offer-card.tg-resonant');
        await tgCursorTo(stage,pick);if(!alive())return;await tgCursorTap(stage);tgCursorHide(stage);
        await this.summon(stage,alive,pick);if(!alive())return;await this.avenger(stage,alive);if(!alive())return;await tgWait(300);if(!alive())return;this.build(stage);
      },
      async action(stage,alive){
        if(!await tgWaitTarget(stage,alive))return false;await this.open(stage);if(!alive())return false;
        const prompt=tutorialGuideOverlay()?.querySelector('.tg-prompt');if(prompt)prompt.textContent='빛나는 하수인을 골라 보세요. 내 오라와 같아 더 강해요';
        const pick=await new Promise(resolve=>stage.querySelectorAll('.tg-offer-card').forEach(card=>{card.classList.add('tg-glow');card.addEventListener('click',()=>resolve(card),{once:true});}));
        if(!alive())return false;stage.querySelectorAll('.tg-offer-card').forEach(card=>card.classList.remove('tg-glow'));
        await this.summon(stage,alive,pick);if(!alive())return false;await this.avenger(stage,alive);return alive();
      },
    };

    /* ----- 완료 보상: 정상 완료 시 계정당 최초 1회 100크래커 (PRD 1-4). 건너뛰면 0 ----- */
    const TUTORIAL_GUIDE_REWARD=100,TUTORIAL_GUIDE_REWARD_KEY='fate.tutorialGuide.rewarded';
    function grantTutorialGuideReward(){
      /* 지급 기록은 컬렉션 저장과 따로 둔다(컬렉션 불러오기가 모르는 필드를 지우기 때문). 실서비스에서는 계정 기준으로 서버가 판정한다. */
      let granted=false;try{granted=localStorage.getItem(TUTORIAL_GUIDE_REWARD_KEY)==='1';}catch(e){}
      if(granted||typeof collectionState==='undefined')return 0;
      try{localStorage.setItem(TUTORIAL_GUIDE_REWARD_KEY,'1');}catch(e){}
      collectionState.crackers=(collectionState.crackers||0)+TUTORIAL_GUIDE_REWARD;
      if(typeof persistCollection==='function')persistCollection();if(typeof updateCrackerHud==='function')updateCrackerHud();
      return TUTORIAL_GUIDE_REWARD;
    }
