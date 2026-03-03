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
  if (!currentRegion) return null;

  const isTypeMode = mode === 'type' || mode === 'type-hard';

  return (
    <div className="text-center py-3 px-4">
      {isTypeMode ? (
        <TypeInput
          key={currentRegion.code}
          onSubmit={onTypeSubmit}
          placeholder="지역 이름을 입력하세요"
        />
      ) : (
        <p
          key={wrongShakeKey}
          className="text-lg font-semibold text-gray-800"
          style={{
            animation: wrongShakeKey ? 'shake 0.3s ease' : undefined,
          }}
        >
          <span className="text-blue-600">{currentRegion.name}</span>
          을(를) 클릭하세요
        </p>
      )}
    </div>
  );
}
