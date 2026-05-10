import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMapData } from '../../hooks/useMapData';
import { useResponsiveSize } from '../../hooks/useResponsiveSize';
import { getDisplayName, getSidoMeta, getRegionLabel } from '../../utils/regionUtils';
import { useLocalePath } from '../../hooks/useLocalePath';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import QuizMap from '../../maps/QuizMap';
import LanguageToggle from '../LanguageToggle';
import type { AdminLevel } from '../../types';

export default function LearnMode() {
  const { level: levelParam, sidoSlug } = useParams<{ level: string; sidoSlug: string }>();
  const navigate = useNavigate();
  const localized = useLocalePath();
  const { locale, t } = useI18n();
  const adminLevel = (levelParam || 'sido') as AdminLevel;
  const sidoMeta = getSidoMeta(sidoSlug || '');
  const sidoFilter = sidoMeta?.code;

  const seoTitle = sidoMeta
    ? t('seo.learn.filtered.title', {
        sido: locale === 'en' ? sidoMeta.shortNameEn : sidoMeta.shortName,
        regionLabel: getRegionLabel(sidoMeta, adminLevel, locale),
      })
    : t(`seo.learn.${adminLevel}.title` as keyof import('../../i18n/types').TranslationStrings);
  const seoDesc = sidoMeta
    ? t('seo.learn.filtered.desc', {
        sido: locale === 'en' ? sidoMeta.shortNameEn : sidoMeta.shortName,
        regionLabel: getRegionLabel(sidoMeta, adminLevel, locale),
      })
    : t(`seo.learn.${adminLevel}.desc` as keyof import('../../i18n/types').TranslationStrings);
  const canonicalPath = sidoMeta
    ? `/learn/${adminLevel}/${sidoMeta.slug}/`
    : `/learn/${adminLevel}/`;
  usePageMeta({
    title: seoTitle,
    description: seoDesc,
    path: canonicalPath,
  });

  const { geoData, topoData, borderMesh, loading, error } = useMapData(adminLevel);
  const { containerRef, width, height } = useResponsiveSize();
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const emptyAnsweredCodes = useMemo(() => new Map<string, number>(), []);
  const showInsets = (adminLevel === 'sigungu' || adminLevel === 'sigun') && !sidoFilter;

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
    <div className="h-screen bg-gray-50 flex flex-col overflow-x-hidden overflow-y-auto landscape:overflow-y-hidden">
      <div className="flex items-center px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => navigate(localized('/'))}
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

      <div ref={containerRef} className="flex-1 min-h-0 flex items-start justify-center pb-4">
        <QuizMap
          geoData={filteredGeoData}
          contextGeoData={sidoFilter ? geoData : null}
          topoData={topoData}
          borderMesh={sidoFilter ? null : borderMesh}
          displayMode="normal"
          width={width}
          height={height}
          showInsets={showInsets}
          adminLevel={adminLevel}
          locale={locale}
          answeredCodes={emptyAnsweredCodes}
          wrongFlashCode={null}
          onRegionHover={handleHover}
          showLabels
        />
      </div>
    </div>
  );
}
