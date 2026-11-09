
    /* ===== 오라 마법 (2026-11-09 PM 요청) =====
       없앤 궁극기 세팅 칸 자리에 둔다. 내 성격 오라마다 효과가 다르고, 쓰면 남은 마나를 모두 쓴다. 내 턴이 3번 시작될 때마다 1번 쓸 수 있다.
       컴퓨터도 같은 규칙으로 소환을 마친 뒤 남은 마나로 쓴다. 세부 수치는 docs/plan-aura-magic.md 의 임시 결정을 따른다. */
    const AURA_MAGIC_COOLDOWN=3;
    const AURA_MAGIC={
      jujak:{persona:'열정',name:'열정의 불꽃',element:'fire',desc:'남은 마나만큼 상대 소환사에게 피해, 나도 그 절반만큼 피해'},
      cheongryong:{persona:'포용',name:'포용의 물결',element:'water',desc:'상대 소환사에게 1~남은 마나 무작위 피해'},
      namu:{persona:'성장',name:'성장의 숨결',element:'wind',desc:'상대 소환사에게 1 피해, 내 소환사 체력 1~남은 마나 무작위 회복'},
      baekho:{persona:'냉철',name:'냉철한 칼날',element:'ice',desc:'상대 소환사에게 남은 마나의 절반만큼 고정 피해'},
      hyeonmu:{persona:'무던',name:'무던한 대지',element:'earth',desc:'내 전장 맨 왼쪽 하수인 체력 +남은 마나'},
    };
    const auraMagicUsedAt={player:null,enemy:null};
    const auraMagicSideGuardian=side=>side==='player'?playerGuardian:enemyGuardian;
    const auraMagicMana=side=>side==='player'?mana:enemyMana;
    const auraMagicUnits=side=>[...document.querySelectorAll(side==='player'?'.summon-zone > .unit':'.arena .lane:first-child > .unit')].filter(unit=>unit.dataset.destroyed!=='true'&&!unit.classList.contains('unit-dying'));
    const auraMagicRoll=max=>1+Math.floor(Math.random()*Math.max(1,max));
    function auraMagicCooldownLeft(side){const used=auraMagicUsedAt[side],turns=ultimateLedger[side].turns;if(used==null||turns<used)return 0;return Math.max(0,used+AURA_MAGIC_COOLDOWN-turns);}
    function auraMagicLockReason(side='player'){const id=auraMagicSideGuardian(side);if(!id||!AURA_MAGIC[id])return '오라 선택 전';const left=auraMagicCooldownLeft(side);if(left)return '다음 사용까지 '+left+'턴';if(side==='player'&&battlePhase!=='setup')return '전투 처리 중';const m=auraMagicMana(side);if(m<1)return '남은 마나 없음';if(id==='jujak'&&heroHpOf(side)<=Math.ceil(m/2))return '체력 부족';if(id==='hyeonmu'&&!auraMagicUnits(side).length)return '전장에 하수인 없음';return '';}
    function auraMagicPreview(side='player'){const id=auraMagicSideGuardian(side),m=auraMagicMana(side);if(!id)return '';if(id==='jujak')return '상대 '+m+' 피해 · 나 '+Math.ceil(m/2)+' 피해';if(id==='cheongryong')return '상대 1~'+Math.max(1,m)+' 피해';if(id==='namu')return '상대 1 피해 · 회복 1~'+Math.max(1,m);if(id==='baekho')return '상대 '+Math.ceil(m/2)+' 고정 피해';return '맨 왼쪽 하수인 체력 +'+m;}
    function auraMagicHeroDamage(targetSide,amount,element,title){if(resultPending||amount<=0)return 0;const enemy=targetSide==='enemy',avatar=document.querySelector('.duel-hud .'+targetSide+' .avatar');if(enemy?enemyAbsoluteDefense:absoluteDefense){guardImpact(avatar,amount,'absolute');writeLog('<strong>'+(enemy?'상대 ':'')+'절대방어</strong>가 '+title+' 피해를 막았습니다.');return 0;}if(avatar)impact(avatar,amount,element);if(enemy)enemyHp=Math.max(0,enemyHp-amount);else playerHp=Math.max(0,playerHp-amount);updateHeroHealth();if(avatar)showSkillEffect('burn',avatar,title+' · −'+amount);return amount;}
    function auraMagicHeal(side,amount,title){const before=heroHpOf(side),healed=side==='player'?healPlayerHero(amount):Math.min(amount,HERO_MAX_HP-enemyHp);if(side==='enemy'){enemyHp+=healed;updateHeroHealth();}const avatar=document.querySelector('.duel-hud .'+side+' .avatar');if(avatar)showSkillEffect('heal',avatar,title+' · +'+healed);return healed;}
    function castAuraMagic(side='player'){if(resultPending||auraMagicLockReason(side))return false;const id=auraMagicSideGuardian(side),magic=AURA_MAGIC[id],m=auraMagicMana(side),foe=side==='player'?'enemy':'player',who=side==='player'?'':'상대 ',el=magic.element;if(side==='player'){mana=0;updateMana();if(typeof showManaSpend==='function')showManaSpend(m,'오라 마법');}else{enemyMana=0;}auraMagicUsedAt[side]=ultimateLedger[side].turns;let log='';
      if(id==='jujak'){const hit=auraMagicHeroDamage(foe,m,el,magic.name),self=Math.ceil(m/2);setTimeout(()=>{auraMagicHeroDamage(side,self,el,magic.name+' 반동');checkAuraMagicResult();},combatMs(420));log='상대 소환사에게 '+hit+' 피해, 반동으로 '+self+' 피해';}
      else if(id==='cheongryong'){const hit=auraMagicHeroDamage(foe,auraMagicRoll(m),el,magic.name);log='상대 소환사에게 '+hit+' 피해(1~'+m+')';}
      else if(id==='namu'){const hit=auraMagicHeroDamage(foe,1,el,magic.name),heal=auraMagicHeal(side,auraMagicRoll(m),magic.name);log='상대 소환사에게 '+hit+' 피해, 체력 '+heal+' 회복(1~'+m+')';}
      else if(id==='baekho'){const hit=auraMagicHeroDamage(foe,Math.ceil(m/2),el,magic.name);log='상대 소환사에게 '+hit+' 고정 피해';}
      else{const unit=auraMagicUnits(side)[0];growUnitHp(unit,m,magic.name+' · 체력 +'+m);log='<strong>'+(unit.querySelector('h4')?.textContent||'하수인')+'</strong>의 체력을 '+m+' 올림';}
      writeLog('<strong>'+who+'오라 마법 · '+magic.name+':</strong> 남은 마나 '+m+'을(를) 모두 써서 '+log+'.');sfx('summon',el,4);checkAuraMagicResult();renderAuraMagic();return true;}
    function checkAuraMagicResult(){if(resultPending)return;if(enemyHp<=0)finish(true,'오라 마법으로 상대 소환사를 쓰러뜨렸습니다.');else if(playerHp<=0)finish(false,'오라 마법의 반동으로 본체 체력이 0이 되었습니다.');}
    function renderAuraMagic(){let panel=document.querySelector('#aura-magic-panel');const anchor=document.querySelector('.hand-tabs');if(!panel&&anchor){panel=document.createElement('div');panel.id='aura-magic-panel';panel.className='aura-magic-panel';anchor.after(panel);}if(!panel)return;const id=playerGuardian,magic=AURA_MAGIC[id];panel.hidden=!(guardianChosen&&magic);if(panel.hidden)return;const g=GUARDIANS[id],reason=auraMagicLockReason('player'),ready=!reason;panel.style.setProperty('--am-color',g.color);panel.classList.toggle('ready',ready);const markup='<div class="setting-title"><strong>오라 마법</strong><span>'+AURA_MAGIC_COOLDOWN+'턴에 1번</span></div><button type="button" class="aura-magic-cast" '+(ready?'':'disabled')+' aria-label="'+magic.name+(ready?' 발동':', '+reason)+'"><img src="'+g.sigil+'" alt=""><span class="am-copy"><b>'+magic.persona+' · '+magic.name+'</b><small>'+magic.desc+'</small><em>'+(ready?'지금 쓰면: '+auraMagicPreview('player')+' · 남은 마나 '+mana+' 모두 사용':reason)+'</em></span></button>';if(panel.innerHTML!==markup){panel.innerHTML=markup;panel.querySelector('.aura-magic-cast').addEventListener('click',()=>castAuraMagic('player'));}}
    window.castAuraMagic=castAuraMagic;window.auraMagicLockReason=auraMagicLockReason;window.renderAuraMagic=renderAuraMagic;window.auraMagicUsedAt=auraMagicUsedAt;
    (()=>{
      const updateManaBeforeAuraMagic=updateMana;
      updateMana=function(...args){const result=updateManaBeforeAuraMagic(...args);renderAuraMagic();return result;};
      const renderUltimateBeforeAuraMagic=renderUltimate;
      renderUltimate=function(...args){const result=renderUltimateBeforeAuraMagic(...args);renderAuraMagic();return result;};
    })();
    /* 컴퓨터: 소환을 마친 뒤 남은 마나로 쓴다. 열정은 반동을 맞고도 체력 20 이상 남을 때만 쓴다 */
    function castEnemyAuraMagic(){if(auraMagicLockReason('enemy'))return false;if(enemyGuardian==='jujak'&&enemyHp-Math.ceil(enemyMana/2)<20)return false;return castAuraMagic('enemy');}
