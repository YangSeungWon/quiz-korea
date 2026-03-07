import { useMemo } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList } from '../../utils/regionUtils';
import { getSigunCount } from '../../utils/sigunMerge';
import { useI18n } from '../../i18n/useI18n';
import { SHORT_NAMES_EN } from '../../i18n/regions/sido';
import type { AdminLevel } from '../../types';

interface RegionSelection {
  level: AdminLevel;
  filter?: string;
}

interface RegionPickerProps {
  value: RegionSelection | null;
  onChange: (selection: RegionSelection) => void;
}

const SHORT_NAMES_KO: Record<string, string> = {
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
  const { locale, t } = useI18n();
  const { geoData } = useMapData('sigungu');
  const sidoList = useMemo(() => (geoData ? getSidoList(geoData, locale) : []), [geoData, locale]);
  const sigunCount = useMemo(() => (geoData ? getSigunCount(geoData) : 0), [geoData]);
  const sigunguCount = geoData ? geoData.features.length : 0;
  const shortNames = locale === 'en' ? SHORT_NAMES_EN : SHORT_NAMES_KO;

  const selectedBtn = 'bg-blue-500 text-white';
  const unselectedBtn = 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600';

  const levels: { key: AdminLevel; label: string; count: number | string }[] = [
    { key: 'sido', label: t('picker.sido'), count: 17 },
    { key: 'sigun', label: t('picker.sigun'), count: sigunCount || '' },
    { key: 'sigungu', label: t('picker.sigungu'), count: sigunguCount || '' },
  ];

  const showFilter = value && (value.level === 'sigun' || value.level === 'sigungu');

  const allLabel = value?.level === 'sigun'
    ? t('picker.allSigun', { count: sigunCount || '' })
    : t('picker.allSigungu', { count: sigunguCount || '' });

  const isAllSelected = value && !value.filter;

  return (
    <div className="space-y-3">
      {/* Step 1: Level selection */}
      <div className="grid grid-cols-3 gap-2">
        {levels.map((l) => {
          const isSelected = value?.level === l.key;
          return (
            <button
              key={l.key}
              onClick={() => onChange({ level: l.key })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSelected ? selectedBtn : unselectedBtn
              }`}
            >
              {l.label} {l.count}
            </button>
          );
        })}
      </div>

      {/* Step 2: Sub-filter (sigun/sigungu only) */}
      {showFilter && (
        <div>
          <button
            onClick={() => onChange({ level: value.level })}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1.5 ${
              isAllSelected ? selectedBtn : unselectedBtn
            }`}
          >
            {allLabel}
          </button>
          <div className="grid grid-cols-6 gap-1.5">
            {sidoList.map((s) => {
              const isFilterSelected = value.filter === s.code;
              return (
                <button
                  key={s.code}
                  onClick={() => onChange({ level: value.level, filter: s.code })}
                  title={s.name}
                  className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    isFilterSelected ? selectedBtn : unselectedBtn
                  }`}
                >
                  {shortNames[s.code] || s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
