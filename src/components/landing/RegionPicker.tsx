import { useMemo, useState, useEffect } from 'react';
import { useMapData } from '../../hooks/useMapData';
import { getSidoList, getShortDisplayName } from '../../utils/regionUtils';
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

  // 동 mode: track the chosen 시도 so we can list its 시군구.
  const [dongSido, setDongSido] = useState<string | null>(null);
  // Keep dongSido in sync with an externally-set dong filter; reset when leaving 동.
  useEffect(() => {
    if (value?.level !== 'dong') setDongSido(null);
    else if (value.filter) setDongSido(value.filter.substring(0, 2));
  }, [value?.level, value?.filter]);

  const selectedBtn = 'bg-blue-500 text-white';
  const unselectedBtn = 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600';

  const levels: { key: AdminLevel; label: string; count: number | string }[] = [
    { key: 'sido', label: t('picker.sido'), count: 17 },
    { key: 'sigun', label: t('picker.sigun'), count: sigunCount || '' },
    { key: 'sigungu', label: t('picker.sigungu'), count: sigunguCount || '' },
    { key: 'dong', label: t('picker.dong'), count: '' },
  ];

  const showFilter = value && (value.level === 'sigun' || value.level === 'sigungu');
  const isDong = value?.level === 'dong';

  const allLabel = value?.level === 'sigun'
    ? t('picker.allSigun', { count: sigunCount || '' })
    : t('picker.allSigungu', { count: sigunguCount || '' });

  const isAllSelected = value && !value.filter;

  // 시군구 list for the chosen 시도 (동 mode step 2)
  const sigunguInSido = useMemo(() => {
    if (!geoData || !dongSido) return [];
    return geoData.features
      .filter((f) => (f.properties.SIG_CD || '').startsWith(dongSido))
      .map((f) => ({ code: f.properties.SIG_CD as string, name: getShortDisplayName(f, locale) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [geoData, dongSido, locale]);

  return (
    <div className="space-y-3">
      {/* Step 1: Level selection */}
      <div className="grid grid-cols-4 gap-2">
        {levels.map((l) => {
          const isSelected = value?.level === l.key;
          return (
            <button
              key={l.key}
              onClick={() => onChange({ level: l.key })}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSelected ? selectedBtn : unselectedBtn
              }`}
            >
              {l.label} {l.count}
            </button>
          );
        })}
      </div>

      {/* Step 2: Sub-filter (sigun/sigungu) */}
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

      {/* 동 mode: 시도 → 시군구 두 단계 */}
      {isDong && (
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-1.5">
            {sidoList.map((s) => {
              const isSidoSelected = dongSido === s.code;
              return (
                <button
                  key={s.code}
                  onClick={() => { setDongSido(s.code); onChange({ level: 'dong' }); }}
                  title={s.name}
                  className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    isSidoSelected ? selectedBtn : unselectedBtn
                  }`}
                >
                  {shortNames[s.code] || s.name}
                </button>
              );
            })}
          </div>
          {!dongSido ? (
            <p className="text-xs text-gray-400 text-center py-1">{t('picker.dongPickSido')}</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {sigunguInSido.map((sg) => {
                const isSelected = value?.filter === sg.code;
                return (
                  <button
                    key={sg.code}
                    onClick={() => onChange({ level: 'dong', filter: sg.code })}
                    title={sg.name}
                    className={`px-1 py-1.5 rounded text-xs font-medium transition-colors truncate ${
                      isSelected ? selectedBtn : unselectedBtn
                    }`}
                  >
                    {sg.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
