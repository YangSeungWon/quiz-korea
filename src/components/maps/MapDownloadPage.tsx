import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSidoMeta, getRegionLabel } from '../../utils/regionUtils';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useLocalePath } from '../../hooks/useLocalePath';
import LanguageToggle from '../LanguageToggle';
import MapsBanner from './MapsBanner';
import { SIDO_REGIONS } from '../../data/sidoRegions';
import { COMPOUND_CITY_NAMES_EN } from '../../utils/sigunMerge';
import { SIGUNGU_NAMES_EN } from '../../i18n/regions/en';
import { FileTextIcon, ImageIcon, ColorIcon, BwIcon, PortraitIcon, LandscapeIcon } from '../icons';
import type { ComponentType } from 'react';
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
const ACCENT: Record<string, { border: string; btn: string; chip: string }> = {
  blue: { border: 'hover:border-blue-400', btn: 'bg-blue-500 hover:bg-blue-600', chip: 'bg-blue-500 text-white border-blue-500' },
  green: { border: 'hover:border-green-400', btn: 'bg-green-500 hover:bg-green-600', chip: 'bg-green-500 text-white border-green-500' },
  purple: { border: 'hover:border-purple-400', btn: 'bg-purple-500 hover:bg-purple-600', chip: 'bg-purple-500 text-white border-purple-500' },
};

interface DownloadCardProps {
  variant: MapVariant;
  previewAlt: string;
  downloadLabel: string;
  accent: string;
  pngLabel: string;
  color: MapColor;
  orient: MapOrient;
  buildUrl: (variant: MapVariant, color: MapColor, orient: MapOrient, ext: 'pdf' | 'png') => string;
}

// One content type (백지도 / 이름 / 번호). Color + orientation come from the global
// toggle above, so all three previews and downloads switch together.
function DownloadCard({ variant, previewAlt, downloadLabel, accent, pngLabel, color, orient, buildUrl }: DownloadCardProps) {
  const a = ACCENT[accent];
  const pdf = buildUrl(variant, color, orient, 'pdf');
  const png = buildUrl(variant, color, orient, 'png');
  const aspect = orient === 'landscape' ? '297 / 210' : '210 / 297';
  return (
    <div className="flex flex-col gap-2">
      <a
        href={pdf}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center bg-white border border-gray-200 rounded-xl overflow-hidden transition-colors ${a.border}`}
        style={{ aspectRatio: aspect }}
      >
        <img src={png} alt={previewAlt} loading="lazy" className="block w-full h-full object-contain" />
      </a>
      <a
        href={pdf}
        download
        className={`flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold text-center transition-colors ${a.btn}`}
      >
        <FileTextIcon size={18} />
        {downloadLabel}
      </a>
      <a
        href={png}
        download
        className="flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 hover:text-gray-800 transition-colors"
      >
        <ImageIcon size={16} />
        {pngLabel}
      </a>
    </div>
  );
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

  // The 시군/시군구 names this page's maps actually contain. This is the only text
  // that distinguishes the 16 filtered pages from each other and from the
  // nationwide one — without it Google reads them as one duplicated template and
  // ranks /maps/sigun/ for "경기도 백지도". Nationwide pages get no list (they
  // already rank, and 250 names would bury the downloads).
  const regionNames = (() => {
    if (!sidoMeta) return [];
    const lists = SIDO_REGIONS[sidoMeta.code];
    if (!lists) return [];
    const entries = adminLevel === 'sigun' ? lists.sigun : lists.sigungu;
    return entries
      .map((r) =>
        locale === 'en'
          ? COMPOUND_CITY_NAMES_EN[r.nameKo] ?? SIGUNGU_NAMES_EN[r.code] ?? r.nameKo
          : r.nameKo,
      )
      .sort((a, b) => a.localeCompare(b, locale));
  })();

  const seoTitle = sidoMeta
    ? t('seo.maps.filtered.title', { sido: sidoName, regionLabel })
    : t(`seo.maps.${adminLevel}.title` as keyof TranslationStrings);
  const seoDesc = sidoMeta
    ? t('seo.maps.filtered.desc', { sido: sidoName, regionLabel, count: regionNames.length })
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

  const cards: { variant: MapVariant; preview: string; download: string; accent: string }[] = [
    { variant: 'blank', preview: t('maps.previewBlank'), download: t('maps.downloadBlankPdf'), accent: 'blue' },
    { variant: 'label', preview: t('maps.previewLabel'), download: t('maps.downloadLabelPdf'), accent: 'green' },
    { variant: 'number', preview: t('maps.previewNumber'), download: t('maps.downloadNumberPdf'), accent: 'purple' },
  ];
  // Global axes — one toggle drives all three previews/downloads at once.
  const [color, setColor] = useState<MapColor>('color');
  const [orient, setOrient] = useState<MapOrient>('portrait');
  type IconC = ComponentType<{ size?: number }>;
  const colorOpts: { value: MapColor; label: string; Icon: IconC }[] = [
    { value: 'color', label: t('maps.styleColor'), Icon: ColorIcon },
    { value: 'bw', label: t('maps.styleBw'), Icon: BwIcon },
  ];
  const orientOpts: { value: MapOrient; label: string; Icon: IconC }[] = [
    { value: 'portrait', label: t('maps.orientPortrait'), Icon: PortraitIcon },
    { value: 'landscape', label: t('maps.orientLandscape'), Icon: LandscapeIcon },
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

        {/* Global toggle — controls all three previews/downloads at once. */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            {colorOpts.map((o) => (
              <button
                key={o.value}
                onClick={() => setColor(o.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${color === o.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <o.Icon size={15} />
                {o.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            {orientOpts.map((o) => (
              <button
                key={o.value}
                onClick={() => setOrient(o.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${orient === o.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <o.Icon size={15} />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {cards.map((card) => (
            <DownloadCard
              key={card.variant}
              variant={card.variant}
              previewAlt={card.preview}
              downloadLabel={card.download}
              accent={card.accent}
              pngLabel={t('maps.downloadPng')}
              color={color}
              orient={orient}
              buildUrl={fileUrl}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500 mb-2">{t('maps.usage')}</p>
        <p className="text-xs text-gray-400 mb-8">{t('maps.dataNote')}</p>

        {/* Region roster — unique per filtered page, and the text that lets a
            "경기도 시군 목록" style query land here instead of nowhere. Plain
            text, not links: linking out to the ~1,700 dong pages would spend
            crawl budget on the pages that already fail to get indexed. */}
        {regionNames.length > 0 && (
          <div className="border-t border-gray-200 pt-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {t('maps.regionListHeading', {
                sido: sidoName,
                regionLabel,
                count: regionNames.length,
              })}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {regionNames.join(' · ')}
            </p>
            <p className="text-xs text-gray-400 mt-2">{t('maps.regionListNote')}</p>
          </div>
        )}

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
