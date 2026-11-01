#!/usr/bin/env python3
"""Basic Spell Impacts(CC0) 원본(WAV)을 게임용 mp3로 변환한다.

사용: python3 -I 12_tools/asset-pipeline/build-spell-sfx.py [원본_폴더] [출력_폴더]
  - 원본 기본값: 06_assets/audio/basic-spell-impacts (spellFire_000.wav … spellWater_004.wav)
  - 출력 기본값: dist/assets/audio/sfx

이 팩의 소리는 "차오르는 구간(0.2~1.1초) → 폭발" 구조라서 두 가지로 만든다.
  - spell<속성>_00N.mp3      피격음용. 폭발 직전(정점 -6dB 도달 30ms 전)부터 시작하도록 앞쪽 차오름을 잘라낸다.
                             (그대로 쓰면 화면의 타격보다 소리가 0.5초 넘게 늦게 터진다)
  - spellIceCast_00N.mp3     빙결 카드 시전음용. 차오름부터 전체를 그대로 쓴다. (시전 후 약 0.45초에 피해가 들어가고
                             얼음 소리의 정점도 약 0.5초라 시전과 타격이 자연스럽게 맞는다)
  - spellLightningCast_00N.mp3  물 공격의 번개 연출("아주르 썬더폴")용. 번개가 내리치는 순간이 시작 후 0.45초에 오도록
                             앞부분(차오름)을 잘라 정렬한다. (연출은 공격 시작에 뜨고 타격은 약 0.3~0.5초 뒤에 들어간다)
공통: 스테레오 유지(원본의 공간감) → 44.1kHz → 앞 0.6초의 평균 음량(RMS)을 TARGET_MEAN_DB에 맞춤
      (같은 이름의 변형 5개가 비슷한 크기로 들리게) → 피크 -1.5dB 리미터 → 길이 제한 + 끝 페이드아웃 → mp3(VBR q4)
출처·라이선스: 06_assets/audio/basic-spell-impacts/SOURCE.md (CC0)
"""
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

MAX_SECONDS = 2.6          # 피격음 길이 제한
CAST_MAX_SECONDS = 3.0     # 시전음(차오름 포함) 길이 제한
FADE_SECONDS = 0.5
TARGET_MEAN_DB = -22.0     # 앞 0.6초 평균 음량(dBFS)
LIMIT = 0.84               # 약 -1.5dBFS
ONSET_DB = -6.0            # 정점 대비 이 값에 처음 도달한 지점을 "터지는 순간"으로 본다
PRE_ROLL = 0.03            # 터지는 순간보다 30ms 앞에서 시작(어택을 살림)
CAST_KINDS = ("Ice", "Lightning")   # 시전음도 만들 속성
CAST_STRIKE_AT = {"Lightning": 0.45}   # 속성별로 "터지는 순간"을 시작 후 이 시각에 오도록 앞을 잘라 정렬 (없으면 원본 처음부터)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def read_mono(path):
    w = wave.open(str(path))
    n, ch, sr, width = w.getnframes(), w.getnchannels(), w.getframerate(), w.getsampwidth()
    raw = w.readframes(n)
    if width == 3:
        a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        v = a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16)
        v = np.where(v >= 1 << 23, v - (1 << 24), v) / float(1 << 23)
    else:
        v = np.frombuffer(raw, dtype=np.int16) / 32768.0
    return v.reshape(-1, ch).mean(axis=1), sr


def onset_seconds(path):
    """정점 대비 ONSET_DB 이내로 처음 올라온 시각 - PRE_ROLL (초)"""
    mono, sr = read_mono(path)
    win = int(sr * 0.02)
    env = np.array([np.sqrt(np.mean(mono[i:i + win] ** 2) + 1e-12) for i in range(0, len(mono) - win, win)])
    db = 20 * np.log10(env + 1e-9)
    first = int(np.argmax(db >= db.max() + ONSET_DB))
    return max(0.0, first * 0.02 - PRE_ROLL)


def head_mean_db(path, start):
    out = run(["ffmpeg", "-hide_banner", "-ss", f"{start:.3f}", "-i", str(path), "-af", "atrim=0:0.6,volumedetect", "-f", "null", "-"]).stderr
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", out)
    return float(m.group(1)) if m else TARGET_MEAN_DB


def convert(src, out, start, max_seconds):
    gain = max(-18.0, min(18.0, TARGET_MEAN_DB - head_mean_db(src, start)))
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{start:.3f}", "-i", str(src), "-ac", "2", "-ar", "44100",
           "-af", f"afade=t=in:d=0.004,volume={gain:.2f}dB,alimiter=limit={LIMIT}:attack=2:release=40,"
                  f"atrim=0:{max_seconds},afade=t=out:st={max_seconds - FADE_SECONDS}:d={FADE_SECONDS}",
           "-c:a", "libmp3lame", "-q:a", "4", str(out)]
    r = run(cmd)
    if r.returncode:
        sys.exit(f"변환 실패 {src.name}: {r.stderr}")


def main():
    root = Path(__file__).resolve().parents[2]
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "06_assets/audio/basic-spell-impacts"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "dist/assets/audio/sfx"
    files = sorted(src.glob("spell*_*.wav"))
    if not files:
        sys.exit("원본 WAV를 찾지 못했습니다: " + str(src))
    dst.mkdir(parents=True, exist_ok=True)
    for old in dst.glob("spell*.mp3"):
        old.unlink()
    bank = {}
    for f in files:
        key = re.sub(r"_\d+$", "", f.stem)
        number = f.stem.rsplit("_", 1)[1]
        start = onset_seconds(f)
        convert(f, dst / f.with_suffix(".mp3").name, start, MAX_SECONDS)
        bank[key] = bank.get(key, 0) + 1
        kind = key[len("spell"):]
        if kind in CAST_KINDS:
            cast_start = max(0.0, start + PRE_ROLL - CAST_STRIKE_AT[kind]) if kind in CAST_STRIKE_AT else 0.0
            convert(f, dst / f"{key}Cast_{number}.mp3", cast_start, CAST_MAX_SECONDS)
            bank[key + "Cast"] = bank.get(key + "Cast", 0) + 1
        print(f"{f.name}: 터지는 순간 {start * 1000:.0f}ms 앞의 차오름 제거")
    total = sum(p.stat().st_size for p in dst.glob("spell*.mp3"))
    print(f"\n{sum(bank.values())}개 변환, 총 {total / 1024:.0f} KB -> {dst}")
    print("BANK 추가: " + ", ".join(f"{k}: {v}" for k, v in sorted(bank.items())))


if __name__ == "__main__":
    main()
