import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMapData } from '../../hooks/useMapData';
import { useResponsiveSize } from '../../hooks/useResponsiveSize';
import { getSidoMeta } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import QuizMap from '../../maps/QuizMap';
import LanguageToggle from '../LanguageToggle';
import type { AdminLevel } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

function pdfFilename(level: AdminLevel, sidoSlug: string | undefined, variant: 'blank' | 'label'): string {
  const slugPart = sidoSlug ? `-${sidoSlug}` : '';
  return `${level}${slugPart}-${variant}.pdf`;
}

export default function MapDownloadPage() {
  const { level: levelParam, sidoSlug } = useParams<{ level: string; sidoSlug?: string }>();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const adminLevel = (levelParam || 'sido') as AdminLevel;
  const sidoMeta = getSidoMeta(sidoSlug || '');

  const sidoName = sidoMeta ? (locale === 'en' ? sidoMeta.shortNameEn : sidoMeta.shortName) : '';
  const regionLabel = sidoMeta ? (locale === 'en' ? sidoMeta.regionLabelEn : sidoMeta.regionLabelKo) : '';

  const seoTitle = sidoMeta
    ? t('seo.maps.filtered.title', { sido: sidoName, regionLabel })
    : t(`seo.maps.${adminLevel}.title` as keyof TranslationStrings);
  const seoDesc = sidoMeta
    ? t('seo.maps.filtered.desc', { sido: sidoName, regionLabel })
    : t(`seo.maps.${adminLevel}.desc` as keyof TranslationStrings);

  const heading = sidoMeta
    ? t('maps.heading.filtered', { sido: sidoName, regionLabel })
    : t(`maps.heading.${adminLevel}` as keyof TranslationStrings);

  const canonicalPath = sidoMeta
    ? `/maps/${adminLevel}/${sidoMeta.slug}`
    : `/maps/${adminLevel}`;
  usePageMeta({ title: seoTitle, description: seoDesc, path: canonicalPath });

  const { geoData, topoData, borderMesh, loading } = useMapData(adminLevel);
  const { containerRef, width, height } = useResponsiveSize();
  const emptyAnswered = useMemo(() => new Map<string, number>(), []);

  const filteredGeoData = useMemo(() => {
    if (!geoData || !sidoMeta) return geoData;
    return {
      ...geoData,
      features: geoData.features.filter((f) => {
        const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
        return code.startsWith(sidoMeta.code);
      }),
    };
  }, [geoData, sidoMeta]);

  const showInsets = (adminLevel === 'sigungu' || adminLevel === 'sigun') && !sidoMeta;

  const blankUrl = `/downloads/${pdfFilename(adminLevel, sidoMeta?.slug, 'blank')}`;
  const labelUrl = `/downloads/${pdfFilename(adminLevel, sidoMeta?.slug, 'label')}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            &larr; {t('maps.backToHome')}
          </button>
          <LanguageToggle />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{heading}</h1>
        <p className="text-gray-600 mb-6">{t('maps.intro')}</p>

        {/* Preview map */}
        <div
          ref={containerRef}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4 aspect-[4/3] flex items-center justify-center"
        >
          {loading || !filteredGeoData || !topoData ? (
            <div className="text-gray-400">…</div>
          ) : (
            <QuizMap
              geoData={filteredGeoData}
              contextGeoData={sidoMeta ? geoData : null}
              topoData={topoData}
              borderMesh={sidoMeta ? null : borderMesh}
              displayMode="normal"
              width={width}
              height={height}
              showInsets={showInsets}
              adminLevel={adminLevel}
              locale={locale}
              answeredCodes={emptyAnswered}
              wrongFlashCode={null}
              showLabels
            />
          )}
        </div>

        {/* Download buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <a
            href={blankUrl}
            download
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold text-center transition-colors"
          >
            {t('maps.downloadBlankPdf')}
          </a>
          <a
            href={labelUrl}
            download
            className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold text-center transition-colors"
          >
            {t('maps.downloadLabelPdf')}
          </a>
        </div>

        <p className="text-xs text-gray-500 mb-2">{t('maps.usage')}</p>
        <p className="text-xs text-gray-400">{t('maps.dataNote')}</p>
      </div>
    </div>
  );
}
