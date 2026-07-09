import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSidoMeta, getRegionLabel } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useLocalePath } from '../../hooks/useLocalePath';
import LanguageToggle from '../LanguageToggle';
import MapsBanner from './MapsBanner';
import { FileTextIcon, ImageIcon } from '../icons';
import type { AdminLevel } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

type MapVariant = 'blank' | 'label' | 'number';
type MapColor = 'color' | 'bw';
type MapOrient = 'portrait' | 'landscape';

function downloadFilename(
  level: AdminLevel,
  sidoSlug: string | undefined,
  variant: MapVariant,
  color: MapColor,
  orient: MapOrient,
  locale: 'ko' | 'en',
  ext: 'pdf' | 'png',
): string {
  const slugPart = sidoSlug ? `-${sidoSlug}` : '';
  const bw = color === 'bw' ? '-bw' : '';
  const land = orient === 'landscape' ? '-land' : '';
  return `${level}${slugPart}-${variant}${bw}${land}-${locale}.${ext}`;
}

// Static Tailwind class strings per card accent (Tailwind can't see interpolated names).
const ACCENT: Record<string, { border: string; btn: string }> = {
  blue: { border: 'hover:border-blue-400', btn: 'bg-blue-500 hover:bg-blue-600' },
  green: { border: 'hover:border-green-400', btn: 'bg-green-500 hover:bg-green-600' },
  purple: { border: 'hover:border-purple-400', btn: 'bg-purple-500 hover:bg-purple-600' },
};

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

  const fileUrl = (variant: MapVariant, color: MapColor, orient: MapOrient, ext: 'pdf' | 'png') =>
    `/downloads/${downloadFilename(adminLevel, sidoMeta?.slug, variant, color, orient, locale, ext)}`;

  // Preview + primary button = the expected default (color · portrait); the
  // extra combos (흑백/가로/흑백+가로) hang off each card as small secondary links.
  const cards: { variant: MapVariant; preview: string; download: string; accent: string }[] = [
    { variant: 'blank', preview: t('maps.previewBlank'), download: t('maps.downloadBlankPdf'), accent: 'blue' },
    { variant: 'label', preview: t('maps.previewLabel'), download: t('maps.downloadLabelPdf'), accent: 'green' },
    { variant: 'number', preview: t('maps.previewNumber'), download: t('maps.downloadNumberPdf'), accent: 'purple' },
  ];
  const variantOptions: { color: MapColor; orient: MapOrient; label: string }[] = [
    { color: 'bw', orient: 'portrait', label: t('maps.optBw') },
    { color: 'color', orient: 'landscape', label: t('maps.optLandscape') },
    { color: 'bw', orient: 'landscape', label: t('maps.optBwLandscape') },
  ];

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

        {/* Preview (default color·portrait) + primary PDF button, with the other
            combos as small secondary links so the hero stays clean. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {cards.map((card) => {
            const pdf = fileUrl(card.variant, 'color', 'portrait', 'pdf');
            const png = fileUrl(card.variant, 'color', 'portrait', 'png');
            const a = ACCENT[card.accent];
            return (
              <div key={card.variant} className="flex flex-col gap-2">
                <a
                  href={pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block bg-white border border-gray-200 rounded-xl overflow-hidden transition-colors ${a.border}`}
                >
                  <img
                    src={png}
                    alt={card.preview}
                    loading="lazy"
                    className="block w-full h-auto"
                    style={{ aspectRatio: '210 / 297' }}
                  />
                </a>
                <a
                  href={pdf}
                  download
                  className={`flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold text-center transition-colors ${a.btn}`}
                >
                  <FileTextIcon size={18} />
                  {card.download}
                </a>
                <a
                  href={fileUrl(card.variant, 'color', 'portrait', 'png')}
                  download
                  className="flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 hover:text-gray-800 transition-colors"
                >
                  <ImageIcon size={16} />
                  {t('maps.downloadPng')}
                </a>
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                  {variantOptions.map((o, i) => (
                    <span key={o.label} className="flex items-center gap-2">
                      {i > 0 && <span className="text-gray-300">·</span>}
                      <a
                        href={fileUrl(card.variant, o.color, o.orient, 'pdf')}
                        download
                        className="hover:text-gray-800 hover:underline transition-colors"
                      >
                        {o.label}
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
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

        {/* Other-region maps banner — same format as the landing page so
            visitors can hop to another sido's printable map directly. */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <MapsBanner currentSidoCode={sidoMeta?.code} />
        </div>
      </div>
    </div>
  );
}
