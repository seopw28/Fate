
    /* ===== 새 튜토리얼: 기능 시연 가이드 (2026-11-09 PM 요청, PRD 1-4) =====
       대전과 별개인 연출 전용 무대에서 기능 6개를 차례로 보여 준다. 단계마다 시연 애니메이션이 끝나면
       빛나는 버튼이 열리고, 유저가 한 번 눌러야 다음 단계로 넘어간다. 무대의 카드, 마나, 체력은 연출용이며
       덱, 재화, 대전 기록에 반영하지 않는다. 세부 임시 결정은 docs/plan-tutorial-guide.md 를 따른다. */
    const TUTORIAL_GUIDE_SEEN_KEY='fate.tutorialGuide.seen';
    const tgWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    let tgRun=0;
    const TUTORIAL_GUIDE_STEPS=[
      {key:'draw',title:'카드 뽑기',desc:'준비 단계에서 마나를 내고 덱에서 카드를 더 뽑을 수 있어요. 한 턴에 뽑을수록 비용이 2, 4, 8로 올라가요.',prompt:'카드 뽑기 버튼을 눌러 보세요'},
      {key:'order',title:'카드 순서 바꾸기',desc:'전장의 하수인 순서를 바꿀 수 있어요. 맨 왼쪽 하수인이 상대 공격을 가장 먼저 받아요.',prompt:'빛나는 하수인을 눌러 맨 왼쪽으로 옮겨 보세요'},
      {key:'auraMagic',title:'오라 마법',desc:'남은 마나를 모두 모아 내 성격 오라의 마법을 써요. 쓴 마나가 많을수록 강하고, 3턴에 한 번 쓸 수 있어요.',prompt:'오라 마법 버튼을 눌러 보세요'},
      {key:'graveRecall',title:'묘지 회수',desc:'손패의 마법 카드 1장을 제물로 바치면 묘지의 하수인 1장이 손패로 돌아와요. 마나 5와 체력이 들어요.',prompt:'묘지 회수 버튼을 눌러 보세요'},
      {key:'awaken',title:'오라 각성',desc:'내 체력이 처음 85 이하가 되면 오라 각성이 열려요. 강화 2개 중 하나를 골라 대전 끝까지 유지해요.',prompt:'오라 각성 버튼을 눌러 보세요'},
      {key:'hero',title:'영웅 강림',desc:'오라 각성을 마치면 영웅 강림을 쓸 수 있어요. 손패 하수인 하나를 골라 영웅으로 불러내요. 내 오라와 같은 카드는 더 강해져요.',prompt:'영웅 강림 버튼을 눌러 보세요'},
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
      overlay.querySelector('.tg-desc').textContent='주요 기능을 모두 익혔어요. 이제 대전에서 직접 써 보세요.';
      overlay.querySelector('.tg-prompt').textContent='';
      overlay.querySelector('[data-tg-replay]').disabled=true;
      overlay.querySelector('[data-tg-skip]').hidden=true;
      overlay.querySelector('.tg-stage').innerHTML='<div class="tg-scene tg-scene-default"><button type="button" class="tg-target tg-glow" data-tg-finish>대전하러 가기</button></div>';
      const finishButton=overlay.querySelector('[data-tg-finish]');finishButton.addEventListener('click',()=>closeTutorialGuide(true),{once:true});finishButton.focus();
    }
    /* 처음 방문한 브라우저에서는 한 번 자동으로 연다. 자동화 검사(webdriver)에서는 열지 않는다. */
    function maybeAutoOpenTutorialGuide(){
      let seen=false;try{seen=localStorage.getItem(TUTORIAL_GUIDE_SEEN_KEY)==='1';}catch(e){seen=true;}
      if(seen||navigator.webdriver)return;
      setTimeout(openTutorialGuide,400);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',maybeAutoOpenTutorialGuide);else maybeAutoOpenTutorialGuide();
