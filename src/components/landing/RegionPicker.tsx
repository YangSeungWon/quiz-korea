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

  // 동 mode step 2: scope list for the chosen 시도. 일반구 도시(수원·성남 등,
  // 4자리 코드를 공유하는 여러 구)는 하나의 묶음으로 — "시 전체"(4자리) + 개별
  // 구(5자리)를 한 카드 안에 담아 소속 관계를 드러냄. 그 외는 단일 버튼.
  type DongScope =
    | { kind: 'plain'; code: string; label: string }
    | { kind: 'city'; code: string; label: string; gus: { code: string; label: string }[] };
  const dongScopes = useMemo<DongScope[]>(() => {
    if (!geoData || !dongSido) return [];
    const feats = geoData.features.filter((f) => (f.properties.SIG_CD || '').startsWith(dongSido));
    const by4 = new Map<string, typeof feats>();
    for (const f of feats) {
      const p4 = (f.properties.SIG_CD as string).slice(0, 4);
      const arr = by4.get(p4) ?? [];
      arr.push(f);
      by4.set(p4, arr);
    }
    // Standalone 시군구 first (so the simple ones are all visible up top),
    // then the multi-구 city groups at the back.
    const plains: DongScope[] = [];
    const cities: DongScope[] = [];
    for (const [p4, arr] of by4) {
      arr.sort((a, b) => (a.properties.SIG_CD as string).localeCompare(b.properties.SIG_CD as string));
      const isCity = new Set(arr.map((f) => f.properties.SIG_CD)).size > 1;
      if (isCity) {
        const full = getShortDisplayName(arr[0], locale); // "수원시 영통구" / "Suwon Yeongtong-gu"
        const city = locale === 'en' ? `${full.split(' ')[0]}-si` : full.split(' ')[0];
        const gus = arr
          .map((f) => {
            const fn = getShortDisplayName(f, locale);
            const gu = fn.includes(' ') ? fn.split(' ').slice(1).join(' ') : fn;
            return { code: f.properties.SIG_CD as string, label: gu };
          })
          .sort((a, b) => a.label.localeCompare(b.label, locale));
        cities.push({ kind: 'city', code: p4, label: city, gus });
      } else {
        plains.push({ kind: 'plain', code: arr[0].properties.SIG_CD as string, label: getShortDisplayName(arr[0], locale) });
      }
    }
    // 가나다(en: 알파벳)순으로 정렬 — 시군구는 코드 순서가 익숙하지 않아 이름순이 찾기 쉬움.
    const byLabel = (a: DongScope, b: DongScope) => a.label.localeCompare(b.label, locale);
    plains.sort(byLabel);
    cities.sort(byLabel);
    return [...plains, ...cities];
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
              {dongScopes.map((sc) => {
                if (sc.kind === 'plain') {
                  const isSelected = value?.filter === sc.code;
                  return (
                    <button
                      key={sc.code}
                      onClick={() => onChange({ level: 'dong', filter: sc.code })}
                      title={sc.label}
                      className={`px-1 py-1.5 rounded text-xs font-medium transition-colors truncate ${
                        isSelected ? selectedBtn : unselectedBtn
                      }`}
                    >
                      {sc.label}
                    </button>
                  );
                }
                // 일반구 도시 — 한 카드로 묶어 "시 전체" + 소속 구를 담음
                const cityActive = value?.filter === sc.code || sc.gus.some((g) => g.code === value?.filter);
                return (
                  <div
                    key={sc.code}
                    className={`col-span-4 rounded-lg border p-1.5 transition-colors ${
                      cityActive ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => onChange({ level: 'dong', filter: sc.code })}
                      title={sc.label}
                      className={`w-full px-2 py-1.5 rounded text-xs font-semibold text-left transition-colors ${
                        value?.filter === sc.code ? selectedBtn : unselectedBtn
                      }`}
                    >
                      {sc.label} {locale === 'en' ? '(all)' : '전체'}
                    </button>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {sc.gus.map((g) => (
                        <button
                          key={g.code}
                          onClick={() => onChange({ level: 'dong', filter: g.code })}
                          title={g.label}
                          className={`px-1 py-1.5 rounded text-xs font-medium transition-colors truncate ${
                            value?.filter === g.code ? selectedBtn : unselectedBtn
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
