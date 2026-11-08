#!/usr/bin/env python3
"""styles.css 에서 화면 축소(zoom 0.9) 블록을 같은 결과의 1.0 기준 값으로 바꾼다 (docs/plan-ui-scale-1.md 3-2).
convert-css.py 로 값을 0.9배 바꾼 뒤 실행한다. 저장소 루트에서 실행."""
p = '05_game-client/app/styles.css'; s = open(p).read()
start = '    :root { --ui-scale:.9; }'
end = '.collection-shell { width:calc(90vw / var(--ui-scale) - 28.8px); height:calc(90vh / var(--ui-scale) - 28.8px); }'
i = s.index(start); j = s.index(end) + len(end)
new = '''    /* 화면 배율 (2026-11-08): 예전에는 게임 본체와 창 4곳에 CSS zoom 0.9 를 걸어 줄여 보였다. 효과 위치가 배율만큼 어긋나는 문제가
       반복돼 축소를 없애고, 값 자체를 0.9배로 바꿔 같은 크기로 보이게 했다(docs/plan-ui-scale-1.md). 아래 높이·너비는
       예전 calc(100vh / 배율 - Npx) × 배율 과 같은 결과다. 다시 zoom 이나 transform scale 로 화면 전체를 줄이지 않는다. */
    main.app { min-height:100vh; }
    .side { height:calc(100vh - 144px); max-height:calc(100vh - 144px); }
    .command-rail, .stage-column { height:calc(100vh - 142.2px); }
    @media(min-width:1101px) and (max-height:760px){ .stage-column,.command-rail{ height:calc(100vh - 124.2px); } }
    .collection-shell { width:calc(100vw - 28.8px); height:calc(100vh - 28.8px); }'''
s = s[:i] + new + s[j:]
s = s.replace('/* 축소 안쪽 전용 (ui-scale 변환) */', '/* 예전 축소 안쪽 전용 값 (화면 배율 변환) */')
assert 'var(--ui-scale)' not in s and 'zoom:' not in s and '--ui-scale:' not in s
open(p, 'w').write(s); print('축소 제거 완료')
