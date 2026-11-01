#!/usr/bin/env python3
"""Kenney Impact Sounds(CC0) 원본(ogg)을 게임용 효과음(mp3)으로 변환한다.

사용: python3 -I 12_tools/asset-pipeline/build-sfx.py <추출된_폴더> [출력_폴더]
  - <추출된_폴더>: kenney_impact-sounds.zip 을 풀어 둔 폴더 (Audio/*.ogg 와 License.txt 가 있는 곳)
  - 출력 기본값: dist/assets/audio/sfx

처리: 걷는 소리 제외 → 모노 44.1kHz mp3 → 앞쪽 무음 제거 → 피크를 -3dB로 정규화(최대 ±18dB 보정) → 1.2초 이내로 페이드아웃
원본 라이선스 안내(License.txt)를 출력 폴더에 함께 복사한다. 원본 zip 자체는 저장소에 넣지 않는다.
출처: https://kenney.nl/assets/impact-sounds (CC0, 상업 이용 가능, 출처 표기는 선택)
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

SKIP = ("footstep",)
MAX_SECONDS = 1.2
TARGET_PEAK_DB = -3.0


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def peak_db(path):
    out = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"]).stderr
    m = re.search(r"max_volume:\s*(-?[\d.]+) dB", out)
    return float(m.group(1)) if m else 0.0


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    root = Path(__file__).resolve().parents[2]
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "dist/assets/audio/sfx"
    files = sorted(p for p in src.rglob("*.ogg") if not any(p.name.startswith(s) for s in SKIP))
    if not files:
        sys.exit("ogg 파일을 찾지 못했습니다: " + str(src))
    dst.mkdir(parents=True, exist_ok=True)
    bank = {}
    for f in files:
        gain = max(-18.0, min(18.0, TARGET_PEAK_DB - peak_db(f)))
        out = dst / (f.stem + ".mp3")
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(f), "-ac", "1", "-ar", "44100",
               "-af", f"silenceremove=start_periods=1:start_threshold=-50dB,volume={gain:.2f}dB,"
                      f"atrim=0:{MAX_SECONDS},afade=t=out:st={MAX_SECONDS - 0.15}:d=0.15",
               "-c:a", "libmp3lame", "-q:a", "5", str(out)]
        r = run(cmd)
        if r.returncode:
            sys.exit(f"변환 실패 {f.name}: {r.stderr}")
        category = re.sub(r"_\d+$", "", f.stem)
        bank[category] = bank.get(category, 0) + 1
    for name in ("License.txt",):
        for lic in src.rglob(name):
            shutil.copy(lic, dst / "LICENSE-kenney-impact-sounds.txt")
            break
    total = sum(p.stat().st_size for p in dst.glob("*.mp3"))
    print(f"{len(files)}개 변환, 총 {total / 1024:.0f} KB -> {dst}")
    print("SFX_BANK = {" + ",".join(f"{k}:{v}" for k, v in sorted(bank.items())) + "}")


if __name__ == "__main__":
    main()
