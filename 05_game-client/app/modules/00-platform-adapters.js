/*
 * 목업의 브라우저 의존성을 한곳에 모은다.
 * 제품 FE는 앱 코드를 고치지 않고 __FATE_PLATFORM__에 저장소와 서버 판정 난수를 주입할 수 있다.
 */
(function initFatePlatform(root) {
  const injected = root.__FATE_PLATFORM__ || {};
  const browserStorage = injected.storage || root.localStorage;
  const storage = Object.freeze({
    getItem(key) { return browserStorage?.getItem(String(key)) ?? null; },
    setItem(key, value) { browserStorage?.setItem(String(key), String(value)); },
    removeItem(key) { browserStorage?.removeItem(String(key)); }
  });
  const economyRandom = Object.freeze({
    next: typeof injected.economyRandom?.next === 'function'
      ? () => Number(injected.economyRandom.next())
      : () => Math.random()
  });
  root.FatePlatform = Object.freeze({ storage, economyRandom });
})(globalThis);

// 레거시 목업은 이 두 별칭을 사용한다. 이후 repository/command 계층으로 옮길 때 이 파일만 교체한다.
const localStorage = FatePlatform.storage;
const economyRandom = FatePlatform.economyRandom;
