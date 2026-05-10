import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSidoMeta, getRegionLabel } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useLocalePath } from '../../hooks/useLocalePath';
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
  const localized = useLocalePath();
  const { locale, t } = useI18n();
  const adminLevel = (levelParam || 'sido') as AdminLevel;
  const sidoMeta = getSidoMeta(sidoSlug || '');

  const sidoName = sidoMeta ? (locale === 'en' ? sidoMeta.shortNameEn : sidoMeta.shortName) : '';
  const regionLabel = sidoMeta ? getRegionLabel(sidoMeta, adminLevel, locale) : '';

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
    ? `/maps/${adminLevel}/${sidoMeta.slug}/`
    : `/maps/${adminLevel}/`;
  usePageMeta({ title: seoTitle, description: seoDesc, path: canonicalPath });

  const blankUrl = `/downloads/${pdfFilename(adminLevel, sidoMeta?.slug, 'blank')}`;
  const labelUrl = `/downloads/${pdfFilename(adminLevel, sidoMeta?.slug, 'label')}`;

  const sidoSegment = sidoMeta ? `/${sidoMeta.slug}` : '';
  const relatedLinks = [
    {
      to: localized(`/quiz/pin/${adminLevel}${sidoSegment}/`),
      title: t('landing.pinQuiz'),
      desc: t('landing.pinQuizDesc'),
      color: 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700',
    },
    {
      to: localized(`/quiz/type/${adminLevel}${sidoSegment}/`),
      title: t('landing.typeQuiz'),
      desc: t('landing.typeQuizDesc'),
      color: 'bg-orange-50 border-orange-200 hover:border-orange-400 text-orange-700',
    },
    {
      to: localized(`/learn/${adminLevel}${sidoSegment}/`),
      title: t('landing.learnMode'),
      desc: t('landing.learnModeDesc'),
      color: 'bg-green-50 border-green-200 hover:border-green-400 text-green-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(localized('/'))}
            className="text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            &larr; {t('maps.backToHome')}
          </button>
          <LanguageToggle />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{heading}</h1>
        <p className="text-gray-600 mb-6">{t('maps.intro')}</p>

        {/* Preview + download — actual PDFs embedded so what you see is what you get */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-2">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <iframe
                src={`${blankUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                className="block w-full"
                style={{ aspectRatio: '210 / 297', border: 0 }}
                title={t('maps.previewBlank')}
                loading="lazy"
              />
            </div>
            <a
              href={blankUrl}
              download
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold text-center transition-colors"
            >
              {t('maps.downloadBlankPdf')}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <iframe
                src={`${labelUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                className="block w-full"
                style={{ aspectRatio: '210 / 297', border: 0 }}
                title={t('maps.previewLabel')}
                loading="lazy"
              />
            </div>
            <a
              href={labelUrl}
              download
              className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold text-center transition-colors"
            >
              {t('maps.downloadLabelPdf')}
            </a>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-2">{t('maps.usage')}</p>
        <p className="text-xs text-gray-400 mb-8">{t('maps.dataNote')}</p>

        {/* Related: same-region quiz / typing / learn entry points */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('maps.relatedHeading')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`block border rounded-xl p-4 transition-colors ${link.color}`}
              >
                <div className="font-semibold mb-1">{link.title}</div>
                <div className="text-xs opacity-80 leading-snug">{link.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
