// KakaoTalk share via the Kakao JavaScript SDK. Loaded on demand so the SDK
// script only fetches when a user actually shares. Fully client-side — works
// on static hosting (GitHub Pages). The result card image is uploaded to
// Kakao's image server (kept ~100 days) so the score-specific image appears
// in the shared card without any backend.

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

// Firefox on mobile can't reliably launch the KakaoTalk app from the web SDK's
// share intermediary (talk-apps.kakao.com) — it lands on a "download KakaoTalk"
// page even when the app is installed. The SDK gives no failure callback for
// this, so detect those browsers up front and let the caller fall back to the
// Web Share API (whose share sheet lists KakaoTalk as a normal target).
export function isKakaoMobileShareReliable(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  const isFirefox = /Firefox\//.test(ua) || /FxiOS\//.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/.test(ua);
  return !(isFirefox && isMobile);
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

export interface KakaoShareInput {
  title: string;
  description: string;
  imageFile: File;
  imageWidth?: number;
  imageHeight?: number;
  webUrl: string;
  buttonTitle: string;
  /** Public fallback image if the upload fails. */
  fallbackImageUrl: string;
}

export async function shareResultToKakao(d: KakaoShareInput): Promise<void> {
  const Kakao = await loadKakao();

  let imageUrl = d.fallbackImageUrl;
  try {
    const res = await Kakao.Share.uploadImage({ file: [d.imageFile] });
    if (res?.infos?.original?.url) imageUrl = res.infos.original.url;
  } catch {
    // Upload failed — fall back to the static OG image.
  }

  const link = { webUrl: d.webUrl, mobileWebUrl: d.webUrl };
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: d.title,
      description: d.description,
      imageUrl,
      imageWidth: d.imageWidth,
      imageHeight: d.imageHeight,
      link,
    },
    buttons: [{ title: d.buttonTitle, link }],
  });
}
