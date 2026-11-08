
    /* ===== 영웅 압박 챔프 (2026-11-08) =====
       초반 영웅 체력 100→85 구간이 너무 천천히 줄어 지루하다는 PM 피드백으로 추가한 세 종류. 컴퓨터도 같은 코드가 처리한다.
       카드 데이터 효과: hero_splash(공격할 때마다 상대 영웅 추가 피해) / entry_hero_damage(소환 시 상대 영웅 피해) / time_bomb(내 턴 delay번째 시작에 자폭).
       런타임 키(runtimeEffectKey): hero-splash-N / entry-hero-N / bomb-hero-N-D → unit.dataset.effect.
       영웅 피해는 기존 경로(impact 숫자 연출 → 체력 갱신 updateHeroHealth → 승패 finish)를 그대로 탄다.
       이 효과들은 '영웅을 공격하는 행동'이 아니라 효과 피해라서 도발·영웅 공격 반응 함정은 거치지 않고, 땅 궁극기의 절대방어(피해 무효)만 존중한다. */
    (function(){
      const SPLASH_DELAY_MS=380,ENTRY_DELAY_MS=520,BOMB_STAGGER_MS=650,BOMB_START_MS=300;
      const KEY=/^(hero-splash|entry-hero|bomb-hero)-(\d+)(?:-(\d+))?$/;
      const parse=unit=>{const m=KEY.exec(unit?.dataset?.effect||'');return m?{kind:m[1],amount:Number(m[2]),delay:Number(m[3])||2}:null;};
      const otherSide=side=>side==='player'?'enemy':'player';
      const nameOf=unit=>unit.querySelector('h4')?.textContent||'챔프';
      const statOf=(unit,last)=>Number(unit.querySelector('.stats span:'+(last?'last':'first')+'-child')?.textContent.replace(/[^0-9]/g,''))||0;
      const unitsOf=side=>[...document.querySelectorAll(side==='player'?'.summon-zone .unit':'.arena .lane:first-child > .unit')].filter(unit=>unit.dataset.destroyed!=='true');

      const josa=word=>{const code=word.charCodeAt(word.length-1)-0xAC00,jong=code>=0&&code<11172?code%28:0;return jong&&jong!==8?'으로':'로';};/* 받침 없음·ㄹ받침은 '로' */
      function heroPressureDamage(targetSide,amount,element,title,sourceName){
        if(resultPending||amount<=0)return false;
        const enemy=targetSide==='enemy',avatar=document.querySelector('.duel-hud .'+targetSide+' .avatar'),owner=enemy?'상대':'내';
        if(enemy?enemyAbsoluteDefense:absoluteDefense){sfx('shield');writeLog('<strong>'+(enemy?'상대 ':'')+'절대방어</strong>가 '+sourceName+'의 '+title+' 피해를 막았습니다.');return false;}
        impact(avatar,amount,element);
        if(enemy)enemyHp=Math.max(0,enemyHp-amount);else playerHp=Math.max(0,playerHp-amount);
        updateHeroHealth();
        showSkillEffect('burn',avatar,title+' · −'+amount);
        writeLog('<strong>'+sourceName+'</strong>의 '+title+josa(title)+' '+owner+' 영웅에게 '+amount+' 피해를 입혔습니다. (남은 체력 '+(enemy?enemyHp:playerHp)+')');
        if(enemy&&enemyHp<=0)finish(true,'상대 영웅의 체력을 0으로 만들었습니다.');
        else if(!enemy&&playerHp<=0)finish(false,'상대 챔프의 효과로 본체 체력이 0이 되었습니다.');
        return true;
      }

      /* 스플래시: 평타·반격이 아닌 '공격'(챔프든 영웅이든 대상 불문)이 맞은 직후에 추가로 영웅에게 피해. 반격(counter)은 공격이 아니므로 제외 */
      const fieldAttackBeforePressure=fieldAttack;
      fieldAttack=function(attacker,target,options={}){
        const info=!options.counter&&parse(attacker);
        if(info?.kind==='hero-splash'&&!options.onImpact?.__splashWrapped){
          const base=options.onImpact,wrapped=()=>{base?.();if(!attacker.isConnected||resultPending)return;const side=otherSide(sideOfUnit(attacker)),element=getElement(attacker),name=nameOf(attacker);setTimeout(()=>heroPressureDamage(side,info.amount,element,'스플래시',name),combatMs(SPLASH_DELAY_MS));};
          wrapped.__splashWrapped=true;/* 02의 연출 게이트가 같은 인자로 다시 부를 때 중복 래핑을 막는다 */
          options={...options,onImpact:wrapped};
        }
        return fieldAttackBeforePressure(attacker,target,options);
      };

      /* 자폭 배지: 남은 내 턴 수. 다른 상태 배지(.metal-experience-badge·.aura-burn-badge)보다 위에 쌓는다 */
      UNIT_BADGE_ORDER.unshift('.bomb-badge');
      function renderBombBadge(unit){
        unit.querySelector(':scope > .bomb-badge')?.remove();
        const left=Number(unit.dataset.bombTurns);if(!(left>0))return;
        const badge=document.createElement('div');badge.className='bomb-badge';badge.innerHTML='<span>자폭 '+left+'턴</span>';
        badge.title='내 턴이 '+left+'번 더 시작되면 상대 영웅에게 돌진해 자폭합니다.';unit.appendChild(badge);stackUnitBadges(unit);
      }
      function armBomb(unit){const info=parse(unit);if(info?.kind!=='bomb-hero'||unit.dataset.bombTurns)return;unit.dataset.bombTurns=String(info.delay);renderBombBadge(unit);}

      function buryBomb(unit,side){
        if(unit.dataset.graveRecorded!=='true'){
          unit.dataset.graveRecorded='true';
          const max=Number(unit.dataset.maxHp)||1,atk=statOf(unit,false);
          buryOrVanish(side,{name:nameOf(unit),art:unit.dataset.art,el:getElement(unit),element:getElement(unit),atk,attack:atk,hp:max,maxHp:max,effect:unit.dataset.effect||'',cost:Number(unit.dataset.cost)||1});
        }
        const hp=unit.querySelector('.stats span:last-child');if(hp)hp.textContent='♥ 0';
        removeFieldUnit(unit);updateSynergyHud();
      }
      function detonate(unit,side,order){
        const info=parse(unit);delete unit.dataset.bombTurns;unit.querySelector(':scope > .bomb-badge')?.remove();
        unit.dataset.destroyed='true';unit.classList.add('exhausted');/* 이 순간부터 공격 큐·표적에서 빠진다. 폭발 연출이 끝나면 묘지로 */
        const targetSide=otherSide(side),name=nameOf(unit),element=getElement(unit);
        writeLog('<strong>'+(side==='player'?'':'상대 ')+name+'</strong>이(가) '+(side==='player'?'상대':'내')+' 영웅에게 돌진해 자폭합니다.');
        setTimeout(()=>{
          if(!unit.isConnected)return;
          const hero=document.querySelector('.duel-hud .'+targetSide+' .avatar');
          if(resultPending||!hero){buryBomb(unit,side);return;}
          fieldAttack(unit,hero,{label:'자폭 '+info.amount+' 피해',onImpact:()=>{if(!resultPending)heroPressureDamage(targetSide,info.amount,element,'자폭',name);buryBomb(unit,side);}});
        },combatMs(BOMB_START_MS+order*BOMB_STAGGER_MS));
      }
      /* 내려놓은 턴을 0으로 두고, 그 뒤 자기 턴 시작이 delay번째 오는 때 자폭한다. 그 전에 쓰러지면 자폭도 없다(이미 필드에 없다) */
      function tickBombs(side){
        let order=0;
        unitsOf(side).forEach(unit=>{
          const info=parse(unit);if(info?.kind!=='bomb-hero')return;
          if(!unit.dataset.bombTurns)unit.dataset.bombTurns=String(info.delay);/* 오프닝 필드 등 소환 훅을 거치지 않고 놓인 카드 */
          const left=Number(unit.dataset.bombTurns)-1;
          if(left>0){unit.dataset.bombTurns=String(left);renderBombBadge(unit);writeLog('<strong>'+(side==='player'?'':'상대 ')+nameOf(unit)+'</strong>의 자폭까지 '+left+'턴 남았습니다.');return;}
          detonate(unit,side,order++);
        });
      }

      /* 소환 훅: 등장 피해와 자폭 카운트다운 시작. 플레이어는 triggerBattlecry, 컴퓨터는 triggerEnemyBattlecry를 거친다(함정으로 소환이 무효가 되면 둘 다 호출되지 않는다) */
      function onSummoned(unit){
        const info=parse(unit);if(!info)return;
        if(info.kind==='bomb-hero'){armBomb(unit);return;}
        if(info.kind!=='entry-hero')return;
        const side=otherSide(sideOfUnit(unit)),element=getElement(unit),name=nameOf(unit);
        setTimeout(()=>heroPressureDamage(side,info.amount,element,'등장 피해',name),combatMs(ENTRY_DELAY_MS));
      }
      const triggerBattlecryBeforePressure=triggerBattlecry;
      triggerBattlecry=function(unit){const result=triggerBattlecryBeforePressure(unit);onSummoned(unit);return result;};
      const triggerEnemyBattlecryBeforePressure=triggerEnemyBattlecry;
      triggerEnemyBattlecry=function(unit,data){const result=triggerEnemyBattlecryBeforePressure(unit,data);onSummoned(unit);return result;};
      const createOpeningFieldUnitBeforePressure=createOpeningFieldUnit;
      createOpeningFieldUnit=function(data,enemy){const unit=createOpeningFieldUnitBeforePressure(data,enemy);armBomb(unit);return unit;};
      document.querySelectorAll('.unit').forEach(armBomb);/* 이 모듈이 올라오기 전에 이미 놓인 오프닝 필드 카드 */

      globalThis.heroPressure={parse,heroPressureDamage,renderBombBadge,tickBombs};/* QA·테스트용 진입점 */
      const startPlayerTurnBeforePressure=startPlayerTurn;
      startPlayerTurn=function(button){const result=startPlayerTurnBeforePressure(button);if(battlePhase==='setup'&&!resultPending)tickBombs('player');return result;};
      const enemyTurnBeforePressure=enemyTurn;
      enemyTurn=function(done){if(!resultPending)tickBombs('enemy');return enemyTurnBeforePressure(done);};
    })();
