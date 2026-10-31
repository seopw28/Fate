# 07 VFX & Motion

게임 상태를 명확히 전달하면서도 성능 예산을 지키는 전투 연출을 설계하고 구현합니다.

## 영역

- `summon/`, `attack/`, `damage/`, `elemental/`
- `screen-feedback/`: 흔들림, 플래시, 히트스톱
- `performance-budget.md`: 동시 파티클, 텍스처, 프레임 기준

첫 목표는 소환·공격·피격의 기본 연출 세트와 저사양 대체안을 만드는 것입니다.

## VFX Lab

`dist/vfx-lab.html`에서 전투와 분리된 프리셋 실험실을 실행합니다.

- `presets/vfx-presets.js`: 속성·행동·강도·자산을 선언하는 프리셋 레지스트리
- `lab/vfx-engine.js`: 궤적, 충돌, 파티클, 스프라이트, 카메라 반응 조합 엔진
- `lab/vfx-lab.js`: 필터, 재생, 프리셋 비교 UI

전투 코드는 프리셋 ID만 요청하고, 표현 방식은 엔진 안에서 교체할 수 있도록 유지합니다.

## AI 제작 파이프라인

AI로 제작하는 스킬 이펙트의 사양, 프롬프트, 후보와 승인 기록은 `../effects/`에서 관리합니다. 승인된 결과만 `../06_assets/vfx/`로 이동해 VFX Lab과 전투 런타임에서 사용합니다.
