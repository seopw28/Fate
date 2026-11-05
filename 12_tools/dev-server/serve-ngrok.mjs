import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ngrok from '@ngrok/ngrok';

const host = '127.0.0.1';
const port = Number(process.env.FATE_PORT || 8080);
const domain = process.env.NGROK_DOMAIN || 'flagstick-cubical-pungent.ngrok-free.dev';
const root = path.resolve('dist');
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'], ['.woff2', 'font/woff2']
]);

if (!process.env.NGROK_AUTHTOKEN) {
  console.error('NGROK_AUTHTOKEN이 없습니다. ngrok 대시보드의 토큰을 현재 터미널 환경변수로 설정한 뒤 다시 실행하세요.');
  console.error('예: export NGROK_AUTHTOKEN="대시보드에서 복사한 토큰"');
  process.exit(1);
}

function safeFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}`).pathname);
  const candidate = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

const server = http.createServer(async (request, response) => {
  try {
    let file = safeFilePath(request.url || '/');
    if (!file) throw Object.assign(new Error('invalid path'), { code: 'ENOENT' });
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error?.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', error => error.code === 'EADDRINUSE' ? resolve() : reject(error));
  server.listen(port, host, resolve);
});

const listener = await ngrok.forward({
  addr: `${host}:${port}`,
  authtoken_from_env: true,
  root_cas: 'host',
  domain
});

console.log(`로컬 게임: http://${host}:${port}`);
console.log(`외부 공개: ${listener.url()}`);
console.log('종료하려면 Ctrl+C를 누르세요.');

const shutdown = async () => {
  try { await listener.close(); } finally { server.close(); }
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.stdin.resume();
