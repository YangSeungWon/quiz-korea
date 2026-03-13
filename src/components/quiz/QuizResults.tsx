import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import type { QuizMode, AdminLevel } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface QuizResultsProps {
  totalRegions: number;
  answered: Map<string, number>;
  elapsedTime: string;
  mode: QuizMode;
  adminLevel: AdminLevel;
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
  isSubset,
  borderless,
  noAccum,
  outline,
  onRetry,
  onBack,
  onClose,
}: QuizResultsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  let firstTryCount = 0;
  for (const mistakes of answered.values()) {
    if (mistakes === 0) firstTryCount++;
  }

  const score = totalRegions > 0 ? Math.round((firstTryCount / totalRegions) * 100) : 0;

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('results.title')}</h2>

        <div className="text-6xl font-bold text-blue-600 mb-2">
          {firstTryCount}/{totalRegions}
        </div>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xl font-bold text-green-500">{firstTryCount}</div>
            <div className="text-gray-500">{t('results.firstTry')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xl font-bold text-gray-900 font-mono">{elapsedTime}</div>
            <div className="text-gray-500">{t('results.time')}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={async () => {
              const modeKeys: Record<QuizMode, keyof TranslationStrings> = {
                pin: 'landing.pinQuiz',
                type: 'landing.typeQuiz',
              };
              const levelKey: keyof TranslationStrings = adminLevel === 'sido' ? 'picker.sido' : adminLevel === 'sigungu' ? 'picker.sigungu' : 'picker.sigun';
              const opts: string[] = [];
              if (borderless) opts.push(t('landing.optBorderless'));
              if (noAccum) opts.push(t('landing.optNoAccum'));
              if (outline) opts.push(t('landing.optOutline'));
              const optStr = opts.length > 0 ? ` [${opts.join(', ')}]` : '';
              const modeLine = `${t(modeKeys[mode])} · ${t(levelKey)}${isSubset ? ` ${totalRegions}` : ''}${optStr}`;
              const text = `${t('results.shareText')}\n${modeLine}\n${firstTryCount}/${totalRegions} | ${elapsedTime}\nquiz-korea.ysw.kr`;
              if (navigator.share) {
                try {
                  await navigator.share({ text });
                } catch {
                  // user cancelled share
                }
              } else {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
            className="w-full bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            {copied ? t('results.copied') : t('results.share')}
          </button>
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
      </div>
    </div>
  );
}
