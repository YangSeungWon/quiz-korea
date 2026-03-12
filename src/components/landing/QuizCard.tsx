import type { ReactNode } from 'react';

interface QuizCardProps {
  title: string;
  description: string;
  onClick: () => void;
  selected?: boolean;
  icon?: ReactNode;
}

export default function QuizCard({ title, description, onClick, selected, icon }: QuizCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group ${
        selected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      {icon && (
        <div className={`mb-2 ${selected ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-400'} transition-colors`}>
          {icon}
        </div>
      )}
      <h3 className={`text-sm font-semibold transition-colors mb-0.5 ${
        selected ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
      }`}>
        {title}
      </h3>
      <p className="text-xs text-gray-500 leading-tight">{description}</p>
    </button>
  );
}
