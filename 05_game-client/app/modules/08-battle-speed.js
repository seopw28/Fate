    /* 전투 배속 (2026-11-09 PM 요청): 턴을 넘긴 뒤 내 차례가 다시 오기까지 11~13초씩 걸려 지루하다는 검토에 따라
       전투 화면에 1배속 / 2배속 토글을 둔다. 연출 순서는 그대로 두고 전투 화면의 시간 전체가 함께 빨라진다.
       - 대기: setTimeout, setInterval 대기 시간을 배속으로 나눈다 (combatMs, 오버레이 유지, 상대 턴 간격 모두 여기를 지난다).
       - 시계: performance.now()도 배속만큼 빨리 흐른다. '언제까지 연출 중' 같은 마감 시각 비교가 대기와 같은 속도로 맞아떨어지게 하기 위해서다.
       - 애니메이션: CSS 애니메이션, CSS 전환, element.animate() 재생 속도를 배속만큼 올린다.
       컬렉션 화면이 열려 있으면 적용하지 않는다. 선택값은 이 기기에 저장한다. */
    const BATTLE_SPEED_KEY='fate.battleSpeed';
    let battleSpeed=(()=>{try{return Number(localStorage.getItem(BATTLE_SPEED_KEY))===2?2:1;}catch(e){return 1;}})();
    let battleSpeedCollectionOpen=false;
    function battleSpeedActive(){return battleSpeed>1&&!battleSpeedCollectionOpen;}
    const battleSpeedSped=new WeakSet();
    function speedUpAnimation(animation){if(!animation||battleSpeedSped.has(animation)||!battleSpeedActive())return;battleSpeedSped.add(animation);animation.playbackRate=animation.playbackRate*battleSpeed;}
    (()=>{const nativeSetTimeout=window.setTimeout.bind(window),nativeSetInterval=window.setInterval.bind(window),nativeNow=performance.now.bind(performance);
      const scaled=delay=>{const ms=Number(delay)||0;return battleSpeedActive()&&ms>0?ms/battleSpeed:ms;};
      window.setTimeout=function(handler,delay,...args){return nativeSetTimeout(handler,scaled(delay),...args);};
      window.setInterval=function(handler,delay,...args){return nativeSetInterval(handler,scaled(delay),...args);};
      /* 배속이 바뀌는 순간을 기준점으로 삼아 시계가 뒤로 가지 않게 한다 */
      let anchorReal=nativeNow(),anchorGame=anchorReal,rate=1;
      performance.now=function(){const real=nativeNow(),next=battleSpeedActive()?battleSpeed:1;if(next!==rate){anchorGame=anchorGame+(real-anchorReal)*rate;anchorReal=real;rate=next;}return anchorGame+(real-anchorReal)*rate;};
      const nativeAnimate=Element.prototype.animate;
      Element.prototype.animate=function(...args){const animation=nativeAnimate.apply(this,args);speedUpAnimation(animation);return animation;};
      const onCssAnimation=event=>{const target=event.target;if(!battleSpeedActive()||!target?.getAnimations)return;target.getAnimations().forEach(animation=>{if((animation.animationName&&animation.animationName===event.animationName)||(animation.transitionProperty&&animation.transitionProperty===event.propertyName))speedUpAnimation(animation);});};
      document.addEventListener('animationstart',onCssAnimation,true);
      document.addEventListener('transitionrun',onCssAnimation,true);
      const modal=document.querySelector('#collection-modal');
      if(modal){const sync=()=>{battleSpeedCollectionOpen=modal.classList.contains('show');};sync();new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class']});}})();
    function renderBattleSpeedToggle(){const button=document.querySelector('#speed-toggle');if(!button)return;button.textContent=battleSpeed>1?'⏩ 2배속':'▶ 1배속';button.setAttribute('aria-pressed',battleSpeed>1?'true':'false');button.title=battleSpeed>1?'전투 연출을 2배 빠르게 보는 중입니다. 누르면 1배속으로 돌아갑니다.':'누르면 전투 연출을 2배 빠르게 봅니다.';}
    function toggleBattleSpeed(){battleSpeed=battleSpeed>1?1:2;try{localStorage.setItem(BATTLE_SPEED_KEY,String(battleSpeed));}catch(e){}renderBattleSpeedToggle();}
    /* 버튼은 전장 맨 끝에 붙인다. 전장의 첫 줄(.lane:first-child)을 상대 줄로 찾는 코드가 많아 앞에 두면 안 된다. */
    (()=>{const arena=document.querySelector('.arena');if(!arena||document.querySelector('#speed-toggle'))return;const button=document.createElement('button');button.type='button';button.id='speed-toggle';button.className='speed-toggle';button.onclick=toggleBattleSpeed;arena.appendChild(button);})();
    renderBattleSpeedToggle();
