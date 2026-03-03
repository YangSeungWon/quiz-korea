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

  const selectedBtn = 'bg-blue-500 text-white';
  const unselectedBtn = 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600';

  return (
    <div className="space-y-3">
      {/* 시도 */}
      <div>
        <div className="text-xs font-medium text-gray-400 mb-1.5">시도</div>
        <button
          onClick={() => onChange({ level: 'sido' })}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isSido ? selectedBtn : unselectedBtn
          }`}
        >
          전국 17개 시도
        </button>
      </div>

      {/* 시군구 */}
      <div>
        <div className="text-xs font-medium text-gray-400 mb-1.5">시군구</div>
        <button
          onClick={() => onChange({ level: 'sigungu' })}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1.5 ${
            isAllSigungu ? selectedBtn : unselectedBtn
          }`}
        >
          전국{geoData ? ` ${geoData.features.length}개` : ''} 시군구
        </button>
        <div className="grid grid-cols-6 gap-1.5">
          {sidoList.map((s) => {
            const isSelected = value.level === 'sigungu' && value.filter === s.code;
            return (
              <button
                key={s.code}
                onClick={() => onChange({ level: 'sigungu', filter: s.code })}
                title={s.name}
                className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  isSelected ? selectedBtn : unselectedBtn
                }`}
              >
                {SHORT_NAMES[s.code] || s.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
