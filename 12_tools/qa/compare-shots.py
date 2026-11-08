#!/usr/bin/env python3
"""사진 비교: 기준 폴더와 새 폴더의 같은 이름 사진을 비교해 다른 픽셀 비율을 낸다.

사용: python3 -I 12_tools/qa/compare-shots.py 기준폴더 새폴더 [--limit 0.5] [--diff 차이이미지폴더]
  --limit  이 비율(%)을 넘으면 실패로 센다 (기본 0.5)
  --diff   실패한 사진의 차이 이미지(다른 픽셀을 빨갛게)를 저장
  --shift  N px 이내 밀림은 같은 것으로 본다(기본 0). 화면 배율 변환처럼 소수점 크기로 1~2px 밀리는 비교에 쓴다
픽셀 차이는 채널별 16 이하를 같은 것으로 본다(글자 테두리 흐림 등 사소한 차이 무시).
docs/plan-ui-scale-1.md 1-4.
"""
import os, sys
from PIL import Image, ImageChops

def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def main():
    a_dir, b_dir = sys.argv[1], sys.argv[2]
    limit = float(arg('--limit', '0.5')); diff_dir = arg('--diff', None); shift = int(arg('--shift', '0'))
    fails = 0; missing = 0; rows = []
    for root, _, files in os.walk(a_dir):
        for f in sorted(files):
            if not f.endswith('.png'): continue
            rel = os.path.relpath(os.path.join(root, f), a_dir); pb = os.path.join(b_dir, rel)
            if not os.path.exists(pb): missing += 1; print('없음:', rel); continue
            a = Image.open(os.path.join(root, f)).convert('RGB'); b = Image.open(pb).convert('RGB')
            if a.size != b.size: fails += 1; print(f'크기 다름: {rel} {a.size} → {b.size}'); continue
            if shift:
                # 1~2px 밀림 허용: b 를 ±shift 만큼 옮긴 것 중 픽셀마다 가장 작은 차이를 쓴다(소수점 크기 변환에서 생기는 미세 이동 무시)
                best = None
                for dx in range(-shift, shift + 1):
                    for dy in range(-shift, shift + 1):
                        diff = ImageChops.difference(a, ImageChops.offset(b, dx, dy)).convert('L')
                        best = diff if best is None else ImageChops.darker(best, diff)
                d = best.point(lambda v: 255 if v > 16 else 0)
            else:
                d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 16 else 0)
            pct = (d.histogram()[255] / (a.size[0] * a.size[1])) * 100
            rows.append((pct, rel))
            if pct > limit:
                fails += 1
                if diff_dir:
                    out = os.path.join(diff_dir, rel); os.makedirs(os.path.dirname(out), exist_ok=True)
                    red = Image.new('RGB', a.size, (255, 0, 0)); Image.composite(red, b.point(lambda v: v // 3), d).save(out)
    rows.sort(reverse=True)
    for pct, rel in rows[:15]:
        if pct > 0: print(f'{pct:6.2f}%  {rel}' + ('  ← 기준 초과' if pct > limit else ''))
    print(f'비교 {len(rows)}장, 기준({limit}%) 초과 {fails}장, 없음 {missing}장')
    sys.exit(1 if fails or missing else 0)

if __name__ == '__main__':
    main()
