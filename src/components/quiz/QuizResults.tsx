import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';
import type { QuizMode, AdminLevel } from '../../types';
import type { TranslationStrings } from '../../i18n/types';
import { formatTime, type RecordEntry } from '../../utils/records';

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

  let firstTryCount = 0;
  for (const mistakes of answered.values()) {
    if (mistakes === 0) firstTryCount++;
  }

  const score = totalRegions > 0 ? Math.round((firstTryCount / totalRegions) * 100) : 0;

  // Shared text/url used by both the native share and the X intent link.
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
  const shareUrl = `https://quiz-korea.ysw.kr/${locale === 'en' ? 'en/' : ''}`;
  const xIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  let message: string;
  if (score === 100) {
    message = t('results.perfect');
  } else if (score >= 90) {
    message = t('results.great');
  } else if (score >= 70) {
    message = t('results.good');
  } else {
    message = t('results.tryAgain');
  }

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

        <div className="text-6xl font-bold text-blue-600 mb-2">
          {firstTryCount}/{totalRegions}
        </div>
        <p className="text-gray-600 mb-4">{message}</p>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="text-xl font-bold text-gray-900 font-mono">{elapsedTime}</div>
          <div className="text-gray-500">{t('results.time')}</div>
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
          <div className="flex gap-3">
            <button
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                  } catch {
                    // user cancelled share
                  }
                } else {
                  await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              {copied ? t('results.copied') : t('results.share')}
            </button>
            <a
              href={xIntentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('results.shareX')}
              title={t('results.shareX')}
              className="flex items-center justify-center w-12 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
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
