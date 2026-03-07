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
  const shortNames = locale === 'en' ? SHORT_NAMES_EN : SHORT_NAMES_KO;

  const isSido = value?.level === 'sido';
  const isSigun = value?.level === 'sigun' && !value.filter;
  const isAllSigungu = value?.level === 'sigungu' && !value.filter;

  const selectedBtn = 'bg-blue-500 text-white';
  const unselectedBtn = 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600';

  return (
    <div className="space-y-3">
      {/* Sido */}
      <div>
        <div className="text-xs font-medium text-gray-400 mb-1.5">{t('picker.sido')}</div>
        <button
          onClick={() => onChange({ level: 'sido' })}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isSido ? selectedBtn : unselectedBtn
          }`}
        >
          {t('picker.allSido')}
        </button>
      </div>

      {/* Sigun */}
      <div>
        <div className="text-xs font-medium text-gray-400 mb-1.5">{t('picker.sigun')}</div>
        <button
          onClick={() => onChange({ level: 'sigun' })}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1.5 ${
            isSigun && !value?.filter ? selectedBtn : unselectedBtn
          }`}
        >
          {t('picker.allSigun', { count: sigunCount || '' })}
        </button>
        <div className="grid grid-cols-6 gap-1.5">
          {sidoList.map((s) => {
            const isSelected = value?.level === 'sigun' && value.filter === s.code;
            return (
              <button
                key={s.code}
                onClick={() => onChange({ level: 'sigun', filter: s.code })}
                title={s.name}
                className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  isSelected ? selectedBtn : unselectedBtn
                }`}
              >
                {shortNames[s.code] || s.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sigungu */}
      <div>
        <div className="text-xs font-medium text-gray-400 mb-1.5">{t('picker.sigungu')}</div>
        <button
          onClick={() => onChange({ level: 'sigungu' })}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1.5 ${
            isAllSigungu ? selectedBtn : unselectedBtn
          }`}
        >
          {t('picker.allSigungu', { count: geoData ? geoData.features.length : '' })}
        </button>
        <div className="grid grid-cols-6 gap-1.5">
          {sidoList.map((s) => {
            const isSelected = value?.level === 'sigungu' && value.filter === s.code;
            return (
              <button
                key={s.code}
                onClick={() => onChange({ level: 'sigungu', filter: s.code })}
                title={s.name}
                className={`px-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  isSelected ? selectedBtn : unselectedBtn
                }`}
              >
                {shortNames[s.code] || s.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
