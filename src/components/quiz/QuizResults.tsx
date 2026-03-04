import { useI18n } from '../../i18n/useI18n';

interface QuizResultsProps {
  totalRegions: number;
  answered: Map<string, number>;
  elapsedTime: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function QuizResults({
  totalRegions,
  answered,
  elapsedTime,
  onRetry,
  onBack,
}: QuizResultsProps) {
  const { t } = useI18n();

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
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
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
