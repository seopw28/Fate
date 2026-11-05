# 06 Assets

게임에 사용하는 시각·음향 에셋과 메타데이터를 관리합니다.

## 영역

- `card-art/`, `frames/`, `characters/`, `backgrounds/`
- `vfx/`, `audio/`
- `manifests/`: 파일 ID, 출처, 제작자, 라이선스, 사용 위치

기존 외부 이미지 출처는 우선 `../collection-sources/`에 있습니다. 정리 시 원본 기록을 보존하고 `manifests/`의 정규 형식으로 연결합니다.

## 생성 대기 큐
- [art-queue.md](art-queue.md): 일러스트 제작 기록(보호막, 성격 오로라 문양, 그림 없는 마법·함정, 중복 사용 마법, 토큰 완료).
