#!/usr/bin/env python3
"""styles.css 를 0.9 축소 없이 같은 크기로 보이게 변환한 새 파일을 만든다(원본은 바꾸지 않음).

사용: python3 12_tools/ui-scale/convert-css.py [--out 경로, 기본 /tmp/fate-styles.converted.css] [--report]
판정: rule-sides.json(브라우저에서 규칙이 맞은 요소의 축소 안/밖), zoom-classes.json(클래스별 안/밖).
- 안에만 맞는 규칙: 값 변환
- 밖에만 맞는 규칙: 그대로
- 양쪽에 맞는 규칙: 원본은 그대로 두고, 바로 뒤에 :where(축소 4곳) 안쪽에만 적용되는 변환본을 덧붙인다(우선순위 동일)
- 어디에도 안 맞은 규칙: 선택자의 클래스로 추정(밖에서만 쓰는 클래스 있으면 밖, 안에서만 쓰는 클래스 있으면 안), 추정 불가면 '애매'로 보고
값 변환: px·rem·vw·vh·vmin·vmax ×0.9 (테두리·외곽선의 1~2px 두께만 그대로). cqw·cqh(컨테이너 기준)·ch 는 이미 축소된 크기를 따르므로 그대로. 1~2px, %, em, 숫자, 각도, 시간, @media 조건은 그대로.
@keyframes 안 값: 그 애니메이션을 쓰는 규칙이 안이면 변환, 밖이면 그대로, 섞이면 '애매'.
docs/plan-ui-scale-1.md 2-2.
"""
import os, re, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = next((sys.argv[i + 1] for i, x in enumerate(sys.argv) if x == '--src'), '05_game-client/app/styles.css')
SCALE = 0.9
ZOOMED = 'main.app,#collection-modal,#result,#tier-modal'
STATIC_OUT = {'arriving','awaken-flare','awaken-flight','awakening-proc-banner','battle-intro','blood-mana-fx','card-depart','card-depart-dest','card-flight','cinematic-skill-fx','cracker-transfer','cracker-transfer-caption','deck-fly','enhance-equip-fly','field-impact-burst','global-spell','guardian-descent','lethal','resolved','resonance-beam','resonance-caption','resonance-gain','resonance-orb','shatter-resonance-fx','shield-break-vfx','spell-absorb-card','spell-vortex','ultimate-cutscene','ultimate-overlay','unit-retiring','attack-trail','gd-emblem','motion-caption','recycle-modal','guardian-select','synth-stage','effect-narration'}

def parse(css):
    """최상위·@media·@supports·@container·@layer 안 스타일 규칙을 소스 순서로 평탄화. 각 항목: (kind, sel/name, body_start, body_end, prelude_start)"""
    items = []; i = 0; n = len(css)
    def skip_comment(j):
        return css.index('*/', j + 2) + 2
    def block(j, depth_ctx):
        nonlocal items
        while j < n:
            if css.startswith('/*', j): j = skip_comment(j); continue
            if css[j] == '}': return j + 1
            if css[j].isspace(): j += 1; continue
            # 프렐류드 읽기
            k = j; 
            while k < n and css[k] not in '{;}':
                if css.startswith('/*', k): k = skip_comment(k); continue
                k += 1
            prelude = css[j:k].strip()
            if k >= n: return n
            if css[k] == ';': j = k + 1; continue
            if css[k] == '}': return k + 1
            # css[k] == '{'
            if prelude.split()[0].split('(')[0] in ('@media', '@supports', '@container', '@layer'):
                j = block(k + 1, depth_ctx + [prelude]); continue
            # 본문 끝 찾기(중첩 없음 가정, keyframes 는 중첩 1단)
            if prelude.startswith('@keyframes') or prelude.startswith('@-webkit-keyframes'):
                depth = 0; m = k
                while True:
                    if css.startswith('/*', m): m = skip_comment(m); continue
                    if css[m] == '{': depth += 1
                    elif css[m] == '}':
                        depth -= 1
                        if depth == 0: break
                    m += 1
                items.append(('kf', prelude.split()[1], k + 1, m, j)); j = m + 1; continue
            if prelude.startswith('@'):
                m = css.index('}', k); j = m + 1; continue  # @font-face 등
            m = k + 1
            while True:
                if css.startswith('/*', m): m = skip_comment(m); continue
                if css[m] == '}': break
                m += 1
            items.append(('rule', prelude, k + 1, m, j)); j = m + 1
        return j
    block(0, [])
    return items

NUM = r'(-?\d*\.?\d+)'
def scale_values(body):
    count = [0]
    def rep_any(m):
        v = float(m.group(1)); unit = m.group(2)
        if v == 0: return m.group(0)
        nv = v * SCALE; s = ('%.2f' % nv).rstrip('0').rstrip('.')
        if s.startswith('0.'): s = s[1:]
        elif s.startswith('-0.'): s = '-' + s[2:]
        count[0] += 1
        return s + unit
    # url(...) 와 따옴표 안은 건드리지 않는다
    # 선언 단위로 처리: 1~2px 를 그대로 두는 것은 테두리·외곽선 두께에만 적용한다.
    # (글자 간격·작은 여백까지 그대로 두면 축소 때보다 글자가 넓어져 줄이 넘어간다 — 3-3 에서 발견)
    def conv_decl(decl):
        prop = decl.split(':', 1)[0].strip().lower() if ':' in decl else ''
        keep_thin = prop.startswith('border') or prop.startswith('outline') or prop.startswith('-webkit-text-stroke')
        def rep2(m):
            v = float(m.group(1))
            if m.group(2) == 'px' and abs(v) < 3 and keep_thin: return m.group(0)
            return rep_any(m)
        parts = re.split(r'(url\([^)]*\)|"[^"]*"|\'[^\']*\')', decl)
        return ''.join(p if (p.startswith('url(') or p.startswith('"') or p.startswith("'")) else re.sub(NUM + r'(px|rem|vw|vh|vmin|vmax)\b', rep2, p) for p in parts)
    out = re.sub(r'[^;{}]+', lambda m: conv_decl(m.group(0)), body)
    return out, count[0]

def classes(sel):
    return set(re.findall(r'\.(-?[_a-zA-Z][\w-]*)', re.sub(r':not\([^)]*\)', '', sel)))

def main():
    css = open(SRC).read()
    sides = json.load(open(os.path.join(HERE, 'rule-sides.json')))
    zc = json.load(open(os.path.join(HERE, 'zoom-classes.json')))['classes']
    items = parse(css)
    rules = [it for it in items if it[0] == 'rule']
    if len(rules) != len(sides):
        print(f'규칙 수 불일치: 파서 {len(rules)} / 브라우저 {len(sides)}'); 
    norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'\s*([>+~,()])\s*', r'\1', s)).replace('"', '').replace("'", '').strip()
    mism = [(k, r[1], s['sel']) for k, (r, s) in enumerate(zip(rules, sides)) if norm(r[1]) != norm(s['sel'])]
    if mism:
        print(f'선택자 불일치 {len(mism)}건 (첫 5건):'); [print('  ', m) for m in mism[:5]]
    decide = {}; reasons = {}
    for k, (r, s) in enumerate(zip(rules, sides)):
        if s['in'] and not s['out']: decide[k] = 'in'
        elif s['out'] and not s['in']: decide[k] = 'out'
        elif s['in'] and s['out']: decide[k] = 'both'
        else:
            cl = classes(r[1])
            if cl & STATIC_OUT or any(c in zc and zc[c]['in'] == 0 for c in cl): decide[k] = 'out'; reasons[k] = 'guess-out'
            elif any(c in zc and zc[c]['out'] == 0 for c in cl): decide[k] = 'in'; reasons[k] = 'guess-in'
            elif cl and all(c in zc for c in cl): decide[k] = 'in'; reasons[k] = 'guess-in(양쪽 클래스, 안 쪽이 기본)'
            else: decide[k] = 'unknown'
    # keyframes: 애니메이션 이름 → 사용 규칙의 판정
    kf_use = {}
    for k, r in enumerate(rules):
        body = css[r[2]:r[3]]
        for m in re.finditer(r'animation(?:-name)?\s*:([^;}]*)', body):
            for name in re.findall(r'[A-Za-z_][\w-]*', m.group(1)):
                kf_use.setdefault(name, set()).add(decide[k])
    # 출력: 뒤에서부터 치환
    edits = []; stats = {'in': 0, 'out': 0, 'both': 0, 'unknown': 0, 'values': 0, 'kf_in': 0, 'kf_out': 0, 'kf_mixed': 0}
    rk = -1; unknown = []; mixed_kf = []
    for it in items:
        if it[0] == 'rule':
            rk += 1; d = decide[rk]; stats[d] += 1
            body = css[it[2]:it[3]]
            if d == 'in':
                nb, c = scale_values(body); stats['values'] += c
                if c: edits.append((it[2], it[3], nb))
            elif d == 'both':
                nb, c = scale_values(body); stats['values'] += c
                if c:
                    scoped = ','.join(f':where({ZOOMED}) {p.strip()}' for p in it[1].split(','))
                    edits.append((it[3] + 1, it[3] + 1, f'\n    {scoped} {{{nb}}} /* 축소 안쪽 전용 (ui-scale 변환) */'))
            elif d == 'unknown':
                unknown.append(it[1])
        else:
            use = kf_use.get(it[1], set()) - {'unknown'}
            if use == {'in'} or use == {'in', 'both'}:
                nb, c = scale_values(css[it[2]:it[3]]); stats['kf_in'] += 1; stats['values'] += c
                if c: edits.append((it[2], it[3], nb))
            elif use and 'out' in use and ('in' in use or 'both' in use): stats['kf_mixed'] += 1; mixed_kf.append(it[1])
            else: stats['kf_out'] += 1
    out = css
    for a, b, rep in sorted(edits, key=lambda e: -e[0]):
        out = out[:a] + rep + out[b:]
    path = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/tmp/fate-styles.converted.css'
    open(path, 'w').write(out)
    g = lambda t: sum(1 for v in reasons.values() if v.startswith(t))
    print(f"규칙 {len(rules)}: 안 {stats['in']}(추정 {g('guess-in')}) / 밖 {stats['out']}(추정 {g('guess-out')}) / 양쪽 {stats['both']} / 애매 {stats['unknown']}")
    print(f"keyframes: 안 {stats['kf_in']} / 밖·미사용 {stats['kf_out']} / 섞임(애매) {stats['kf_mixed']}")
    print(f"바뀐 값 {stats['values']}개 → {path}")
    if unknown:
        import glob
        src = ''.join(open(f).read() for f in glob.glob('05_game-client/app/modules/*.js')) + open('05_game-client/app/index.shell.html').read()
        lines = []; dead = 0
        for u in unknown:
            miss = [c for c in classes(u) if c not in zc]
            used = [c for c in miss if re.search(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', src)]
            if not used: dead += 1
            lines.append(('[코드에 없음] ' if not used else '[미관찰: ' + ', '.join(sorted(used)) + '] ') + re.sub(r'\s+', ' ', u)[:160])
        path2 = os.path.join(HERE, 'ambiguous.txt'); open(path2, 'w').write('\n'.join(lines) + '\n')
        print(f'애매 {len(unknown)}개 중 클래스가 코드에 없는 규칙 {dead}개, 스캔 중 화면에 안 나온 규칙 {len(unknown) - dead}개 → {path2}')
    if mixed_kf: print('애매한 keyframes:', ', '.join(mixed_kf))

if __name__ == '__main__':
    main()
