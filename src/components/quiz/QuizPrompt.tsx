import { useI18n } from '../../i18n/useI18n';
import type { QuizMode, QuizRegion } from '../../types';
import TypeInput from './TypeInput';

interface QuizPromptProps {
  mode: QuizMode;
  currentRegion: QuizRegion | null;
  onTypeSubmit: (input: string) => void;
  wrongShakeKey?: number;
}

export default function QuizPrompt({
  mode,
  currentRegion,
  onTypeSubmit,
  wrongShakeKey,
}: QuizPromptProps) {
  const { t } = useI18n();

  if (!currentRegion) return null;

  const isTypeMode = mode === 'type';

  return (
    <div className="text-center py-3 px-4">
      {isTypeMode ? (
        <TypeInput
          key={currentRegion.code}
          onSubmit={onTypeSubmit}
          placeholder={t('quiz.typePlaceholder')}
        />
      ) : (
        <p
          key={wrongShakeKey}
          className="text-gray-800 flex items-baseline justify-center gap-2"
          style={{
            animation: wrongShakeKey ? 'shake 0.3s ease' : undefined,
          }}
        >
          {t('quiz.clickPrefix') && (
            <span className="text-sm text-gray-400">{t('quiz.clickPrefix')}</span>
          )}
          <span className="text-xl font-bold">{currentRegion.name}</span>
          {t('quiz.clickSuffix') && (
            <span className="text-sm text-gray-400">{t('quiz.clickSuffix')}</span>
          )}
        </p>
      )}
    </div>
  );
}
