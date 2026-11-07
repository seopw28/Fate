const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(repo, p), 'utf8');

/* 2026-11-07 사고: 8765 포트를 다른 세션의 워크트리가 점유하고 있어서, 내 dev-server 는
   조용히 죽고 측정은 '남의 옛 번들'을 읽었다. 테스트는 로컬 파일을 읽으니 전부 통과했고
   스크린샷을 눈으로 보기 전까지 '고쳤다'고 믿었다. 재발 방지를 코드로 고정한다. */

test('dev-server: 포트가 이미 쓰이면 조용히 죽지 않고 누가 쓰는지 밝히고 종료한다', () => {
  const src = read('12_tools/dev-server.py');
  assert.ok(/EADDRINUSE/.test(src), '포트 충돌을 구분해서 다뤄야 한다');
  assert.ok(/sys\.exit\(2\)/.test(src), '충돌 시 0 이 아닌 코드로 끝나야 호출부가 알아챈다');
  assert.ok(/def port_owner\(/.test(src), '누가 점유 중인지 알려줘야 조치할 수 있다');
  assert.ok(/다른 트리/.test(src), '점유자가 다른 트리면 그렇다고 표시해야 한다');
});

test('dev-server: 서빙 중인 트리를 /__whoami 로 밝힌다', () => {
  const src = read('12_tools/dev-server.py');
  assert.ok(src.includes("path == '/__whoami'"), '서빙 경로를 확인할 수단이 있어야 한다');
  assert.ok(/realpath\(ROOT\)/.test(src), '심볼릭 링크를 거쳐도 같은 트리인지 비교할 수 있어야 한다');
});

test('측정 헬퍼: 응답하는 트리가 내 dist 가 아니면 측정을 중단한다', () => {
  const src = read('12_tools/qa/serve_own_tree.py');
  assert.ok(/_free_port/.test(src), '빈 포트를 받아야 다른 세션과 충돌하지 않는다');
  assert.ok(/__whoami/.test(src), '응답한 트리를 확인해야 한다');
  assert.ok(/raise RuntimeError/.test(src), '어긋나면 조용히 넘어가지 말고 멈춰야 한다');
  /* '다르면 멈춘다'가 핵심이다 — 비교를 지우면 옛 사고가 그대로 재현된다. */
  assert.ok(/realpath\(served\) != os\.path\.realpath\(DIST\)/.test(src),
    '서빙 트리와 내 dist 를 실제로 비교해야 한다');
});

test('넘침 검사는 고정 포트가 아니라 자기 dist 를 띄워서 검사한다', () => {
  const src = read('12_tools/qa/check-text-overflow.py');
  assert.ok(/from serve_own_tree import serve_own_tree/.test(src), '보호된 서빙 헬퍼를 써야 한다');
  assert.ok(/with serve_own_tree\(\) as base/.test(src), '기본 경로에서 자기 트리를 띄워야 한다');
  /* 예전 기본값(고정 8765)로 돌아가면 남의 트리를 검사하고 통과시킬 수 있다. */
  assert.ok(!/"http:\/\/localhost:8765\/index\.html\?skipIntro/.test(src),
    '고정 포트를 기본값으로 되돌리면 안 된다');
});
