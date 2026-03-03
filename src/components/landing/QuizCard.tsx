interface QuizCardProps {
  title: string;
  description: string;
  onClick: () => void;
}

export default function QuizCard({ title, description, onClick }: QuizCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500">{description}</p>
    </button>
  );
}
