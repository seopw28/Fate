# 06 Assets

게임에 사용하는 시각·음향 에셋과 메타데이터를 관리합니다.

## 영역

- `card-art/`, `frames/`, `characters/`, `backgrounds/`
- `vfx/`, `audio/`
- `manifests/`: 파일 ID, 출처, 제작자, 라이선스, 사용 위치

기존 외부 이미지 출처는 우선 `../collection-sources/`에 있습니다. 정리 시 원본 기록을 보존하고 `manifests/`의 정규 형식으로 연결합니다.

## 생성 대기 큐
- [art-queue.md](art-queue.md): Codex 토큰 회복 시 **0순위**로 만들 일러스트(마법·함정 7장 → 중복 사용 마법 → 토큰 → 수호신 아이콘).
