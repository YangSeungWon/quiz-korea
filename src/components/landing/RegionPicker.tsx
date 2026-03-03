import { useMemo } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList } from '../../utils/regionUtils';

interface RegionSelection {
  level: 'sido' | 'sigungu';
  filter?: string;
}

interface RegionPickerProps {
  value: RegionSelection;
  onChange: (selection: RegionSelection) => void;
}

// Short display names for buttons
const SHORT_NAMES: Record<string, string> = {
  '11': '서울',
  '26': '부산',
  '27': '대구',
  '28': '인천',
  '29': '광주',
  '30': '대전',
  '31': '울산',
  '36': '세종',
  '41': '경기',
  '42': '강원',
  '43': '충북',
  '44': '충남',
  '45': '전북',
  '46': '전남',
  '47': '경북',
  '48': '경남',
  '50': '제주',
};

export default function RegionPicker({ value, onChange }: RegionPickerProps) {
  const { geoData } = useMapData('sigungu');
  const sidoList = useMemo(() => (geoData ? getSidoList(geoData) : []), [geoData]);

  const isSido = value.level === 'sido';
  const isAllSigungu = value.level === 'sigungu' && !value.filter;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-3">퀴즈 범위</label>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onChange({ level: 'sido' })}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isSido
              ? 'bg-blue-500 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
          }`}
        >
          시도 전체
        </button>
        <button
          onClick={() => onChange({ level: 'sigungu' })}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isAllSigungu
              ? 'bg-blue-500 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
          }`}
        >
          전체 시군구
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {sidoList.map((s) => {
          const isSelected = value.level === 'sigungu' && value.filter === s.code;
          const shortName = SHORT_NAMES[s.code] || s.name;
          return (
            <button
              key={s.code}
              onClick={() => onChange({ level: 'sigungu', filter: s.code })}
              title={s.name}
              className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
