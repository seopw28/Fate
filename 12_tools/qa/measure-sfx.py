#!/usr/bin/env python3
"""피격 효과음 측정·보정 도구 (헤드리스: 소리를 듣지 않고도 크기·울림·넓이를 수치로 확인한다).

사용:
  python3 -I 12_tools/qa/measure-sfx.py                   # 속성×조합별 수치 표 출력
  python3 -I 12_tools/qa/measure-sfx.py --wav /tmp/sfx    # 위에 더해 조합별 WAV 파일 저장 (귀로 들어 볼 용도)
  python3 -I 12_tools/qa/measure-sfx.py --calibrate [3]   # 조합별 음량(TRIM)을 목표 RMS에 맞춰 sfx-variety.js 에 기록
전제: dist를 http.server로 띄운 상태(기본 http://localhost:8765), numpy·playwright 설치.
      보정 후에는 `npm run build:runtime` 으로 dist/runtime 에 반영한다.

모든 피격은 피해량과 무관하게 같은 "강한 신호"로 울린다. 그래서 속성·조합이 달라도 비슷한 크기로 들리게 하는 것이 목표다.

수치 해석
  rms      첫 0.5초 평균 음량(dB). 조합마다 목표(TARGET_RMS)에 가까워야 한다
  tail30   최대 음량보다 30dB 떨어질 때까지의 시간(초) = 울림 길이
  late     0.3초 이후에 남은 에너지 비율(%) = 잔향/꼬리의 양 (공간감)
  corr     좌우 상관(1=모노, 낮을수록 넓음)
  centroid 소리의 무게중심 주파수(Hz). 낮을수록 묵직, 높을수록 얇고 날카로움
"""
import re
import sys
import wave
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "05_game-client/battle/sfx-variety.js"
URL = "http://localhost:8765/index.html?skipIntro&guardian=baekho"
SR = 44100
TARGET_RMS = -21.0  # 버스 볼륨 0.35 기준, 첫 0.5초 평균 음량(dB)

LOAD = """async()=>{window.__bufs={};const c=new OfflineAudioContext(2,44100,44100);
  const api=FateSfx.init({engine:()=>c,bus:()=>c.createGain(),buffers:window.__bufs});api.load();
  for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));
    if(Object.values(window.__bufs).reduce((a,v)=>a+v.filter(Boolean).length,0)>=108)break}}"""
RENDER = """async([el,combo])=>{
  const ctx=new OfflineAudioContext(2,44100*4,44100);const bus=ctx.createGain();bus.gain.value=0.35;bus.connect(ctx.destination);
  const api=FateSfx.init({engine:()=>ctx,bus:()=>bus,buffers:window.__bufs});
  api.playHit(el,5,0,{combo});
  const out=await ctx.startRendering();
  return [Array.from(out.getChannelData(0)),Array.from(out.getChannelData(1))];}"""
# 파형 전체를 옮기지 않고 브라우저 안에서 RMS만 계산한다 (보정 루프가 수십 배 빨라진다)
RMS_ONLY = """async([el,combo,reps])=>{
  let sum=0;
  for(let r=0;r<reps;r++){
    const ctx=new OfflineAudioContext(2,44100*2,44100);const bus=ctx.createGain();bus.gain.value=0.35;bus.connect(ctx.destination);
    const api=FateSfx.init({engine:()=>ctx,bus:()=>bus,buffers:window.__bufs});
    api.playHit(el,5,0,{combo});
    const out=await ctx.startRendering(),l=out.getChannelData(0),rr=out.getChannelData(1),n=22050;let e=0;
    for(let i=0;i<n;i++){const m=(l[i]+rr[i])/2;e+=m*m}
    sum+=20*Math.log10(Math.sqrt(e/n)+1e-9);}
  return sum/reps;}"""


def metrics(x):
    left, right = x[:, 0], x[:, 1]
    mono = (left + right) / 2
    win = int(SR * 0.02)
    env = np.array([np.sqrt(np.mean(mono[i:i + win] ** 2) + 1e-12) for i in range(0, len(mono) - win, win)])
    env_db = 20 * np.log10(env + 1e-9)
    idx = np.where(env_db > env_db.max() - 30)[0]
    seg = mono[: int(SR * 0.4)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freq = np.fft.rfftfreq(len(seg), 1 / SR)
    n = int(SR * 0.6)
    corr = np.corrcoef(left[:n], right[:n])[0, 1] if np.std(left[:n]) > 1e-6 and np.std(right[:n]) > 1e-6 else 1.0
    return {
        "rms": float(20 * np.log10(np.sqrt(np.mean(mono[: int(SR * 0.5)] ** 2)) + 1e-9)),
        "tail30": float((idx[-1] + 1) * 0.02) if len(idx) else 0.0,
        "late": float((mono[int(SR * 0.3):] ** 2).sum() / ((mono ** 2).sum() + 1e-12) * 100),
        "corr": float(corr),
        "centroid": float((spec * freq).sum() / max(1e-9, spec.sum())),
    }


def render(page, element, combo):
    left, right = page.evaluate(RENDER, [element, combo])
    return np.stack([np.array(left, dtype=np.float32), np.array(right, dtype=np.float32)], axis=1)


def save_wav(path, data):
    w = wave.open(str(path), "wb")
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()


def mean_rms(page, element, combo, reps=4):
    return float(page.evaluate(RMS_ONLY, [element, combo, reps]))


def main():
    args = sys.argv[1:]
    calibrate = "--calibrate" in args
    rounds = 3
    if calibrate and args.index("--calibrate") + 1 < len(args) and args[args.index("--calibrate") + 1].isdigit():
        rounds = int(args[args.index("--calibrate") + 1])
    wav_dir = Path(args[args.index("--wav") + 1]) if "--wav" in args else None
    if wav_dir:
        wav_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(URL)
        page.wait_for_timeout(800)
        page.evaluate(LOAD)
        counts = page.evaluate("Object.fromEntries(Object.entries(FateSfx.HIT_SETS).map(([e,v])=>[e,v.length]))")
        if calibrate:
            trim = {e: [1.0] * counts[e] for e in counts}
            for number in range(rounds):
                worst = 0.0
                for e in trim:
                    for c in range(len(trim[e])):
                        page.evaluate("([e,c,v])=>{FateSfx.TRIM[e][c]=v}", [e, c, trim[e][c]])
                        err = TARGET_RMS - mean_rms(page, e, c)
                        worst = max(worst, abs(err))
                        trim[e][c] = float(np.clip(trim[e][c] * 10 ** (err * 0.75 / 20), 0.3, 6.0))
                print(f"round {number + 1}: 목표와의 최대 차이 {worst:.1f}dB", flush=True)
            for e in trim:
                for c in range(len(trim[e])):
                    page.evaluate("([e,c,v])=>{FateSfx.TRIM[e][c]=v}", [e, c, trim[e][c]])
            body = "  const TRIM = {\n" + ",\n".join(f"    {e}: [" + ", ".join(f"{x:.2f}" for x in trim[e]) + "]" for e in trim) + "\n  };"
            text = SRC.read_text()
            new = re.sub(r"  const TRIM = \{.*?\};", lambda m: body, text, count=1, flags=re.S)
            if new == text:
                print("TRIM 블록을 찾지 못했습니다")
            SRC.write_text(new)
            print("TRIM을 sfx-variety.js 에 기록했습니다. `npm run build:runtime` 으로 반영하세요.")
        print(f"{'속성':8s}{'조합':4s}{'rms':>7s}{'tail30':>8s}{'late%':>7s}{'corr':>6s}{'centroid':>9s}")
        worst = 0.0
        for e in counts:
            for c in range(counts[e]):
                data = render(page, e, c)
                m = metrics(data)
                worst = max(worst, abs(m["rms"] - TARGET_RMS))
                print(f"{e:8s}{c:<4d}{m['rms']:7.1f}{m['tail30']:8.2f}{m['late']:7.1f}{m['corr']:6.2f}{m['centroid']:9.0f}")
                if wav_dir:
                    save_wav(wav_dir / f"{e}_{c}.wav", data)
        print(f"\n목표 음량({TARGET_RMS:.0f}dB)과의 최대 차이: {worst:.1f}dB")
        browser.close()


if __name__ == "__main__":
    main()
