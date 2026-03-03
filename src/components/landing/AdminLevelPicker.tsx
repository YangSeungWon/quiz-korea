import type { AdminLevel } from '../../types';

interface AdminLevelPickerProps {
  value: AdminLevel;
  onChange: (level: AdminLevel) => void;
}

export default function AdminLevelPicker({ value, onChange }: AdminLevelPickerProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('sido')}
        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 'sido'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        시도 (17)
      </button>
      <button
        onClick={() => onChange('sigungu')}
        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === 'sigungu'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        시군구
      </button>
    </div>
  );
}
