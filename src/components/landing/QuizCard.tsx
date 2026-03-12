interface QuizCardProps {
  title: string;
  description: string;
  onClick: () => void;
  selected?: boolean;
}

export default function QuizCard({ title, description, onClick, selected }: QuizCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-md transition-all group ${
        selected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <h3 className={`text-base font-semibold transition-colors mb-1 ${
        selected ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
      }`}>
        {title}
      </h3>
      <p className="text-sm text-gray-500">{description}</p>
    </button>
  );
}
