# Effects

카드 스킬 이펙트의 기획, AI 제작, 검수와 승인 상태를 관리하는 정본입니다.

## 폴더 구조

- `specs/`: 효과의 의미, 타이밍, 화면 범위와 성능 예산
- `prompts/`: 생성형 AI 입력 템플릿과 효과별 프롬프트
- `generated/`: AI가 만든 원본. 게임 빌드에서 직접 참조하지 않음
- `processed/`: 크기, 프레임, 알파와 용량을 정리한 후보
- `approved/`: 리뷰를 통과한 배포 후보
- `review/`: 판독성, 디자인, 성능과 권리 검수 기록
- `registry/`: 효과 ID와 현재 구현·승인 자산의 연결
- `scripts/`: 사양과 레지스트리 자동 검증

기존 `07_vfx-motion/`은 실행 엔진과 모션 프리셋을, `06_assets/vfx/`는 빌드에 포함되는 최종 자산을 담당합니다. `effects/`는 그 앞단의 제작 파이프라인입니다.

## 기본 명령

```bash
npm run validate:effects
```

새 효과는 [AI 제작 방법론](methodology.md)을 따라 등록합니다.
