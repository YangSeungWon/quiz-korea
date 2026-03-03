import { calculateScore } from '../../utils/quizEngine';

interface QuizResultsProps {
  totalRegions: number;
  wrongAttempts: number;
  elapsedTime: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function QuizResults({
  totalRegions,
  wrongAttempts,
  elapsedTime,
  onRetry,
  onBack,
}: QuizResultsProps) {
  const score = calculateScore(totalRegions, wrongAttempts);

  let message: string;
  if (score === 100) {
    message = '완벽합니다!';
  } else if (score >= 90) {
    message = '훌륭해요!';
  } else if (score >= 70) {
    message = '잘했어요!';
  } else {
    message = '더 연습해보세요!';
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">퀴즈 완료</h2>

        <div className="text-6xl font-bold text-blue-600 mb-2">{score}%</div>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xl font-bold text-gray-900">{totalRegions}</div>
            <div className="text-gray-500">총 문제</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xl font-bold text-red-500">{wrongAttempts}</div>
            <div className="text-gray-500">오답</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xl font-bold text-gray-900 font-mono">{elapsedTime}</div>
            <div className="text-gray-500">시간</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onRetry}
            className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            다시 도전
          </button>
          <button
            onClick={onBack}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            모드 선택으로
          </button>
        </div>
      </div>
    </div>
  );
}
