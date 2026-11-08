#!/usr/bin/env python3
"""JS 안 px 값 중 예전 0.9 축소 안 요소(전장 카드·체력바·전장 흔들림 등)에 쓰이던 값만 0.9배로 바꾼다. 한 번만 실행(4-2). 분류는 js-px.md."""

import re,glob
src={f:open(f).read() for f in glob.glob('05_game-client/app/modules/*.js')}
def fbody(name):
    for f,s in src.items():
        m=re.search(r'function\s+'+name+r'\s*\(',s)
        if m:
            n=re.search(r'\n\s{0,8}(?:async\s+)?function\s',s[m.end():])
            return f,m.start(),m.end()+(n.start() if n else len(s)-m.end())
    raise Exception(name)
def sc(v):
    x=float(v)*0.9; return ('%.2f'%x).rstrip('0').rstrip('.')
def scale_in(text, pattern):
    return re.sub(pattern, lambda m: re.sub(r'(-?\d*\.?\d+)px', lambda k: sc(k.group(1))+'px', m.group(0)), text)
plan=[
 ('showAvengerArrival', r"unit\.animate\(\[\{transform:'translateY\(-70px\)[^\]]*\]", '복수자 강림 카드 낙하'),
 ('showAvengerLandingImpact', r"(?:arena|stage)\?\.animate\(\[[^\]]*\]", '복수자 착지 전장 흔들림'),
 ('setUltimatePanelShown', r"translateY\(-6px\)", '궁극기 패널 열고 닫기'),
 ('showUltimateSpentDeath', r"\.animate\(\[\{transform:'none'\},\{transform:'translate\(-8px[^\]]*\]", '소진자 죽음 전장 흔들림'),
 ('castSpell', r"boxShadow='0 0 0 [^']*'", '마법 대상 카드 테두리 빛'),
 ('triggerTrap', r"boxShadow='0 0 0 [^']*'", '함정 대상 카드 테두리 빛'),
 ('triggerBattlecry', r"boxShadow='0 0 0 [^']*'", '소환 효과 카드 테두리 빛'),
 ('flipReveal', r"perspective\(900px\)", '카드 뒤집기 원근'),
 ('summonLandingImpact', r"unit\.animate\(\[\{translate:'0 -30px'[^\]]*\]", '소환 카드 착지 튕김'),
 ('heroHealthImpact', r"bar\.animate\(\[\{translate:'0 0'[^\]]*\]", '체력바 흔들림'),
 ('revealEnemyPlacementInOrder', r"unit\.animate\(\[\{opacity:0,transform:'translate\(90px,-70px\)[^\]]*\]", '상대 카드 등장'),
 ('updateGuardianChips', r"paddingLeft='10px'", '오라 칩 여백'),
 ('playGuardianDescent', r"arena\.animate\(\[\{transform:'none'\},\{transform:'translateY\(5px\)'[^\]]*\]", '오라 강림 전장 흔들림'),
]
changed=[]
for fn,pat,desc in plan:
    f,a,b=fbody(fn); s=src[f]; body=s[a:b]
    n=len(re.findall(pat,body)); assert n>=1,(fn,pat)
    src[f]=s[:a]+scale_in(body,pat)+s[b:]; changed.append((fn,desc,n))
for fn,o,nw,desc in [('summonLandingImpact',"--length:'+(54+cost*5+(i%3)*14)+'px","--length:'+((54+cost*5+(i%3)*14)*.9)+'px",'마법진 균열 길이'),
                     ('summonLandingImpact',"dist=(42+cost*4+(i%4)*12)*power;","dist=(42+cost*4+(i%4)*12)*power*.9;",'마법진 파편 거리'),
                     ('showCharacterAppeal',"'--distance',(135+(i%4)*28)+'px'","'--distance',((135+(i%4)*28)*.9)+'px'",'가챠 캐릭터 연출 불꽃 거리')]:
    f,a,b=fbody(fn); s=src[f]; body=s[a:b]; assert body.count(o)==1,(fn,o)
    src[f]=s[:a]+body.replace(o,nw)+s[b:]; changed.append((fn,desc,1))
for f,s in src.items(): open(f,'w').write(s)
for c in changed: print(c)
