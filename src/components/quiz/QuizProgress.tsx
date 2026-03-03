interface QuizProgressProps {
  current: number;
  total: number;
  percentage: number;
  time: string;
  onBack: () => void;
}

export default function QuizProgress({
  current,
  total,
  percentage,
  time,
  onBack,
}: QuizProgressProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
      >
        &larr; 뒤로
      </button>

      <div className="flex-1 flex items-center justify-center gap-4 text-sm font-medium text-gray-700">
        <span>
          {current}/{total}
        </span>
        <span className="text-gray-400">|</span>
        <span>{percentage}%</span>
        <span className="text-gray-400">|</span>
        <span className="font-mono">{time}</span>
      </div>

      {/* Spacer to balance back button */}
      <div className="w-12" />
    </div>
  );
}
