import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMapData } from '../../hooks/useMapData';
import { useResponsiveSize } from '../../hooks/useResponsiveSize';
import { getDisplayName } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import QuizMap from '../../maps/QuizMap';
import LanguageToggle from '../LanguageToggle';
import type { AdminLevel } from '../../types';

export default function LearnMode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const adminLevel = (searchParams.get('level') || 'sido') as AdminLevel;
  const sidoFilter = searchParams.get('filter') || undefined;

  const { geoData, topoData, loading, error } = useMapData(adminLevel);
  const { containerRef, width, height } = useResponsiveSize();
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const showInsets = adminLevel === 'sigungu' && !sidoFilter;

  const filteredGeoData = useMemo(() => {
    if (!geoData || !sidoFilter) return geoData;
    return {
      ...geoData,
      features: geoData.features.filter((f) => {
        const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
        return code.startsWith(sidoFilter);
      }),
    };
  }, [geoData, sidoFilter]);

  const handleHover = useCallback(
    (code: string | null) => {
      if (!code || !filteredGeoData) {
        setHoveredName(null);
        return;
      }
      const feature = filteredGeoData.features.find(
        (f) =>
          f.properties.CTPRVN_CD === code ||
          f.properties.SIG_CD === code ||
          f.properties.code === code,
      );
      if (feature) {
        setHoveredName(getDisplayName(feature, locale));
      }
    },
    [filteredGeoData, locale],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-lg">{t('quiz.loading')}</div>
      </div>
    );
  }

  if (error || !filteredGeoData || !topoData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{t('quiz.loadError')}</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex items-center px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
        >
          &larr; {t('quiz.back')}
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-gray-700">{t('learn.title')}</span>
        </div>
        <LanguageToggle />
      </div>

      <div className="text-center py-3 h-12 flex items-center justify-center">
        {hoveredName ? (
          <span className="text-lg font-semibold text-gray-800">{hoveredName}</span>
        ) : (
          <span className="text-sm text-gray-400">{t('learn.hoverHint')}</span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 flex items-start justify-center pb-4">
        <QuizMap
          geoData={filteredGeoData}
          topoData={topoData}
          displayMode="normal"
          width={width}
          height={height}
          showInsets={showInsets}
          locale={locale}
          answeredCodes={new Map()}
          wrongFlashCode={null}
          onRegionHover={handleHover}
          showLabels
        />
      </div>
    </div>
  );
}
