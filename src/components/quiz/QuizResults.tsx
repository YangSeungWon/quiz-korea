import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';
import type { QuizMode, AdminLevel } from '../../types';
import type { TranslationStrings } from '../../i18n/types';
import { formatTime, type RecordEntry } from '../../utils/records';
import { buildResultCard, captureMapImage } from '../../utils/resultCard';
import { isKakaoEnabled, shareResultToKakao } from '../../utils/kakao';

interface QuizResultsProps {
  totalRegions: number;
  answered: Map<string, number>;
  elapsedTime: string;
  mode: QuizMode;
  adminLevel: AdminLevel;
  /** Region the quiz was scoped to (e.g. "경기", "수원시"). Empty for 전국. */
  regionLabel?: string;
  /** Personal-best record outcome for this attempt. */
  record?: { best: RecordEntry; isNewBest: boolean; previous: RecordEntry | null } | null;
  isSubset: boolean;
  borderless?: boolean;
  noAccum?: boolean;
  outline?: boolean;
  onRetry: () => void;
  onBack: () => void;
  onClose?: () => void;
}

export default function QuizResults({
  totalRegions,
  answered,
  elapsedTime,
  mode,
  adminLevel,
  regionLabel,
  record,
  isSubset,
  borderless,
  noAccum,
  outline,
  onRetry,
  onBack,
  onClose,
}: QuizResultsProps) {
  const { t, locale } = useI18n();
  const localized = useLocalePath();
  const [copied, setCopied] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const kakaoEnabled = isKakaoEnabled();

  let firstTryCount = 0;
  for (const mistakes of answered.values()) {
    if (mistakes === 0) firstTryCount++;
  }

  // Shared text/url used by the native share, X intent, and Kakao share.
  const modeKeys: Record<QuizMode, keyof TranslationStrings> = {
    pin: 'landing.pinQuiz',
    type: 'landing.typeQuiz',
  };
  const levelKey: keyof TranslationStrings =
    adminLevel === 'sido' ? 'picker.sido' : adminLevel === 'sigungu' ? 'picker.sigungu' : adminLevel === 'dong' ? 'picker.dong' : 'picker.sigun';
  const shareOpts: string[] = [];
  if (borderless) shareOpts.push(t('landing.optBorderless'));
  if (noAccum) shareOpts.push(t('landing.optNoAccum'));
  if (outline) shareOpts.push(t('landing.optOutline'));
  const optStr = shareOpts.length > 0 ? ` [${shareOpts.join(', ')}]` : '';
  const regionStr = regionLabel ? `${regionLabel} ` : '';
  const modeLine = `${t(modeKeys[mode])} · ${regionStr}${t(levelKey)}${isSubset ? ` ${totalRegions}` : ''}${optStr}`;
  const shareTitle = t('results.shareText');
  const shareText = `${shareTitle}\n${modeLine}\n${firstTryCount}/${totalRegions} | ${elapsedTime}`;
  // Deep-link to the exact quiz just played (current page encodes mode/level/region/options).
  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://quiz-korea.ysw.kr/';
  const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  const CARD_W = 1200;
  const CARD_H = 630;
  const makeCardFile = async () => {
    const mapImage = await captureMapImage();
    const blob = await buildResultCard({
      title: shareTitle,
      modeLine,
      score: `${firstTryCount}/${totalRegions}`,
      time: elapsedTime,
      url: 'quiz-korea.ysw.kr',
      newRecord: record?.isNewBest ? t('results.newRecord') : undefined,
      mapImage,
    });
    return new File([blob], cardFileName(), { type: 'image/png' });
  };

  // Descriptive download name: mode, region/level, score, time, timestamp.
  const cardFileName = () => {
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const modePart = safe(`${t(modeKeys[mode])}_${regionStr}${t(levelKey)}`);
    const scorePart = `${firstTryCount}of${totalRegions}`;
    // Elapsed time as "1분05초" (ko) / "1min05sec" (en); includes hours if any.
    const parts = elapsedTime.split(':').map((p) => parseInt(p, 10));
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) [h, m, s] = parts;
    else [m, s] = parts;
    const u = locale === 'en' ? ['h', 'min', 'sec'] : ['시', '분', '초'];
    const timePart = `${h ? `${h}${u[0]}` : ''}${m}${u[1]}${pad(s)}${u[2]}`;
    return `한국지리퀴즈_${modePart}_${scorePart}_${timePart}_${ts}.png`;
  };

  // Copy text, with a fallback for insecure contexts where navigator.clipboard
  // is unavailable (e.g. plain-HTTP hosts).
  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to execCommand
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  // Primary share: show off the result. Attach the result image (score + map)
  // when the platform supports file sharing; otherwise share text + link;
  // otherwise (desktop without Web Share) copy the result summary.
  const shareNative = async () => {
    if (nativeBusy) return;
    if (!navigator.share) {
      const ok = await copyText(`${shareText}\n${shareUrl}`);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return;
    }
    setNativeBusy(true);
    try {
      try {
        const file = await makeCardFile();
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: `${shareText}\n${shareUrl}` });
          return;
        }
      } catch {
        // image generation/share failed — fall back to text share
      }
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch {
        // user cancelled share
      }
    } finally {
      setNativeBusy(false);
    }
  };

  const shareImage = async () => {
    if (imgBusy) return;
    setImgBusy(true);
    try {
      const file = await makeCardFile();
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: `${shareText}\n${shareUrl}` });
        } catch {
          // user cancelled share
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      setImgBusy(false);
    }
  };

  const shareKakao = async () => {
    if (kakaoBusy) return;
    setKakaoBusy(true);
    try {
      const file = await makeCardFile();
      await shareResultToKakao({
        title: shareTitle,
        description: `${modeLine}\n${firstTryCount}/${totalRegions} · ${elapsedTime}`,
        imageFile: file,
        imageWidth: CARD_W,
        imageHeight: CARD_H,
        webUrl: shareUrl,
        buttonTitle: t('results.kakaoCardButton'),
        fallbackImageUrl: 'https://quiz-korea.ysw.kr/og-image.png',
      });
    } catch {
      // SDK load / share failed — silently ignore
    } finally {
      setKakaoBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('results.title')}</h2>

        <div className="text-sm text-gray-500 mb-4">
          <div>{t(modeKeys[mode])} · {regionStr}{t(levelKey)}{isSubset ? ` ${totalRegions}` : ''}</div>
          {shareOpts.length > 0 && (
            <div className="text-gray-400">[{shareOpts.join(', ')}]</div>
          )}
        </div>

        <div className="text-6xl font-bold text-blue-600 mb-4">
          {firstTryCount}/{totalRegions}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500" aria-label={t('results.time')}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg>
          <span className="text-xl font-bold text-gray-900 font-mono">{elapsedTime}</span>
        </div>

        {/* Personal best */}
        {record && (
          <div className="mb-8">
            {record.isNewBest && (
              <div className="text-sm font-bold text-amber-600 mb-1">{t('results.newRecord')}</div>
            )}
            <div className="text-xs text-gray-500">
              🏆 {t('results.bestRecord')} {record.best.correct}/{record.best.total} · {formatTime(record.best.timeMs)}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            {/* Native share (link + text); falls back to clipboard copy */}
            <button
              onClick={shareNative}
              disabled={nativeBusy}
              aria-label={t('results.share')}
              title={t('results.share')}
              className="flex-1 h-12 flex items-center justify-center bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-60 transition-colors"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
              )}
            </button>
            {/* Share/save the result card image */}
            <button
              onClick={shareImage}
              disabled={imgBusy}
              aria-label={t('results.shareImage')}
              title={t('results.shareImage')}
              className="flex-1 h-12 flex items-center justify-center bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>
            {/* X (Twitter) intent */}
            <a
              href={xIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('results.shareX')}
              title={t('results.shareX')}
              className="flex-1 h-12 flex items-center justify-center bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {/* KakaoTalk share (uploads the result image so the card shows the score) */}
            {kakaoEnabled && (
              <button
                onClick={shareKakao}
                disabled={kakaoBusy}
                aria-label={t('results.shareKakao')}
                title={t('results.shareKakao')}
                className="flex-1 h-12 flex items-center justify-center bg-[#FEE500] text-[#191600] rounded-lg hover:brightness-95 disabled:opacity-60 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.48 3 2 6.49 2 10.8c0 2.77 1.86 5.2 4.66 6.57-.15.53-.96 3.33-.99 3.55 0 0-.02.17.09.23.11.07.24.02.24.02.31-.04 3.6-2.36 4.17-2.76.6.08 1.21.13 1.83.13 5.52 0 10-3.49 10-7.79C22 6.49 17.52 3 12 3z"/></svg>
              </button>
            )}
          </div>
          {copied && (
            <p className="-mt-1 text-xs font-medium text-green-600 flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {t('results.resultCopied')}
            </p>
          )}
          <button
            onClick={onRetry}
            className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            {t('results.retry')}
          </button>
          <button
            onClick={onBack}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            {t('results.backToModes')}
          </button>
        </div>
        <Link
          to={localized('/records/')}
          className="mt-4 inline-block text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
        >
          🏆 {t('results.viewRecords')}
        </Link>
        <div className="mt-3 text-xs text-gray-300">quiz-korea.ysw.kr</div>
      </div>
    </div>
  );
}
