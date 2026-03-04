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

  const isTypeMode = mode === 'type' || mode === 'type-hard';

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
          className="text-lg font-semibold text-gray-800"
          style={{
            animation: wrongShakeKey ? 'shake 0.3s ease' : undefined,
          }}
        >
          {t('quiz.clickPrompt', { name: currentRegion.name })}
        </p>
      )}
    </div>
  );
}
