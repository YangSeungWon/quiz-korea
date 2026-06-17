import { useMemo } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList } from '../../utils/regionUtils';
import { getSigunCount, METRO_CODES } from '../../utils/sigunMerge';
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
  '21': '부산',
  '22': '대구',
  '23': '인천',
  '24': '광주',
  '25': '대전',
  '26': '울산',
  '29': '세종',
  '31': '경기',
  '32': '강원',
  '33': '충북',
  '34': '충남',
  '35': '전북',
  '36': '전남',
  '37': '경북',
  '38': '경남',
  '39': '제주',
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
            {sidoList
              .filter((s) => value.level !== 'sigun' || !METRO_CODES.has(s.code))
              .map((s) => {
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
