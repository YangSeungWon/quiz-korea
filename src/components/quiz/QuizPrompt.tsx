import type { QuizMode, QuizRegion } from '../../types';
import TypeInput from './TypeInput';

interface QuizPromptProps {
  mode: QuizMode;
  currentRegion: QuizRegion | null;
  onTypeSubmit: (input: string) => void;
}

export default function QuizPrompt({
  mode,
  currentRegion,
  onTypeSubmit,
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
        <p className="text-lg font-semibold text-gray-800">
          <span className="text-blue-600">{currentRegion.name}</span>
          을(를) 클릭하세요
        </p>
      )}
    </div>
  );
}
