import { useI18n } from '../../i18n/useI18n';
import type { QuizMode, QuizRegion } from '../../types';
import TypeInput from './TypeInput';

interface QuizPromptProps {
  mode: QuizMode;
  currentRegion: QuizRegion | null;
  onTypeSubmit: (input: string) => void;
  wrongShakeKey?: number;
  /** Reveal the answer name (type mode, after several wrong attempts). */
  revealAnswer?: boolean;
}

export default function QuizPrompt({
  mode,
  currentRegion,
  onTypeSubmit,
  wrongShakeKey,
  revealAnswer,
}: QuizPromptProps) {
  const { t } = useI18n();

  if (!currentRegion) return null;

  const isTypeMode = mode === 'type';

  return (
    <div className="text-center py-3 px-4">
      {isTypeMode ? (
        <div className="flex flex-col items-center gap-1">
          <TypeInput
            key={currentRegion.code}
            onSubmit={onTypeSubmit}
            placeholder={t('quiz.typePlaceholder')}
          />
          {revealAnswer && (
            <p className="text-sm text-amber-600">
              {t('quiz.answerLabel')}: <span className="font-bold">{currentRegion.name}</span>
            </p>
          )}
        </div>
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
