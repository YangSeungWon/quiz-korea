// KakaoTalk share via the Kakao JavaScript SDK. Loaded on demand so the SDK
// script only fetches when a user actually shares. Fully client-side — works
// on static hosting (GitHub Pages). The result card image is uploaded to
// Kakao's image server (kept ~100 days) so the score-specific image appears
// in the shared card without any backend.
//
// IMPORTANT (mobile): launching the KakaoTalk app from the web requires an
// unbroken user gesture. Any `await` between the click and `sendDefault` drops
// that gesture and the app won't launch — the browser falls through to the
// app-store download page instead. So callers must do the slow work (SDK load,
// image upload) ahead of time via preloadKakao()/uploadKakaoImage(), then call
// shareKakaoFeed() synchronously inside the click handler.

interface KakaoSDK {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    uploadImage(opts: { file: File[] }): Promise<{ infos: { original: { url: string } } }>;
    sendDefault(opts: unknown): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

export function isKakaoEnabled(): boolean {
  return !!KAKAO_JS_KEY;
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Firefox on mobile can't reliably launch the KakaoTalk app from the web SDK's
// share intermediary (talk-apps.kakao.com) — it lands on a "download KakaoTalk"
// page even when the app is installed. The SDK gives no failure callback for
// this, so detect those browsers up front and let the caller fall back to the
// Web Share API (whose share sheet lists KakaoTalk as a normal target).
export function isKakaoMobileShareReliable(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  const isFirefox = /Firefox\//.test(ua) || /FxiOS\//.test(ua);
  return !(isFirefox && isMobileBrowser());
}

let loadPromise: Promise<KakaoSDK> | null = null;

function loadKakao(): Promise<KakaoSDK> {
  if (!KAKAO_JS_KEY) return Promise.reject(new Error('Kakao JS key not configured'));
  if (window.Kakao?.isInitialized()) return Promise.resolve(window.Kakao);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<KakaoSDK>((resolve, reject) => {
    const init = () => {
      const k = window.Kakao!;
      if (!k.isInitialized()) k.init(KAKAO_JS_KEY);
      resolve(k);
    };
    if (window.Kakao) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      try {
        init();
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error('Failed to load Kakao SDK'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Load + init the SDK ahead of the click so shareKakaoFeed() can run
// synchronously later (see the gesture note at the top of the file).
export function preloadKakao(): Promise<void> {
  return loadKakao().then(() => undefined);
}

// Upload the result-card image and return its hosted URL. Do this ahead of the
// click so the share itself stays synchronous.
export async function uploadKakaoImage(file: File): Promise<string> {
  const Kakao = await loadKakao();
  const res = await Kakao.Share.uploadImage({ file: [file] });
  const url = res?.infos?.original?.url;
  if (!url) throw new Error('Kakao image upload returned no URL');
  return url;
}

export interface KakaoFeedInput {
  title: string;
  description: string;
  /** Pre-hosted image URL (from uploadKakaoImage, or a static fallback). */
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  webUrl: string;
  buttonTitle: string;
}

// Synchronous share — MUST be called directly inside the click handler with no
// preceding await, or mobile browsers drop the user gesture and the KakaoTalk
// app won't launch. Returns false if the SDK isn't initialized yet so the
// caller can preload and retry.
export function shareKakaoFeed(d: KakaoFeedInput): boolean {
  const Kakao = window.Kakao;
  if (!Kakao?.isInitialized()) return false;
  const link = { webUrl: d.webUrl, mobileWebUrl: d.webUrl };
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: d.title,
      description: d.description,
      imageUrl: d.imageUrl,
      imageWidth: d.imageWidth,
      imageHeight: d.imageHeight,
      link,
    },
    buttons: [{ title: d.buttonTitle, link }],
  });
  return true;
}
