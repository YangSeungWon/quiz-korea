import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';
import { getSidoMeta } from '../../utils/regionUtils';

interface Props {
  /** Sido code to feature in Block A and highlight in Block B. Optional. */
  currentSidoCode?: string;
  /** Override section heading. Defaults to t('landing.maps'). */
  heading?: string;
}

const ALL_SIDO_CODES = [
  '11', '21', '22', '23', '24', '25', '26',
  '31', '32', '33', '34', '35', '36', '37', '38', '39',
] as const;

/**
 * Shared printable-maps navigation surface — used both on the landing page
 * (drives discovery) and at the bottom of /maps/.../ detail pages (lets
 * visitors hop to other sidos' maps without going through the home picker).
 *
 * Block A (normal cards): 전국 시도 / 전국 시군 + current region's variants.
 * Block B (compact chips): every sido's primary filtered map; current sido
 * highlighted.
 */
export default function MapsBanner({ currentSidoCode, heading }: Props) {
  const { t, locale } = useI18n();
  const localized = useLocalePath();

  const sidoMeta = currentSidoCode ? getSidoMeta(currentSidoCode) : null;
  const sidoLocalName = sidoMeta
    ? locale === 'en' ? sidoMeta.shortNameEn : sidoMeta.shortName
    : '';

  const blockA: Array<{ to: string; heading: string }> = [
    { to: localized('/maps/sido/'), heading: locale === 'en' ? 'All Provinces' : '전국 시도' },
    { to: localized('/maps/sigun/'), heading: locale === 'en' ? 'All Cities' : '전국 시군' },
  ];
  if (sidoMeta) {
    if (sidoMeta.type === 'province') {
      blockA.push({
        to: localized(`/maps/sigun/${sidoMeta.slug}/`),
        heading: `${sidoLocalName} 시군`,
      });
      blockA.push({
        to: localized(`/maps/sigungu/${sidoMeta.slug}/`),
        heading: `${sidoLocalName} 시군구`,
      });
    } else {
      blockA.push({
        to: localized(`/maps/sigungu/${sidoMeta.slug}/`),
        heading: `${sidoLocalName} ${sidoMeta.regionLabelKo}`,
      });
    }
  }

  const blockB = ALL_SIDO_CODES.map((code) => {
    const meta = getSidoMeta(code);
    if (!meta) return null;
    const targetLevel = meta.type === 'metro' ? 'sigungu' : 'sigun';
    const label = locale === 'en' ? meta.shortNameEn : meta.shortName;
    return {
      to: localized(`/maps/${targetLevel}/${meta.slug}/`),
      label,
      isCurrent: meta.code === sidoMeta?.code,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div>
      <div className="text-xs font-medium text-gray-400 mb-2">
        {heading ?? t('landing.maps')}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {blockA.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="block bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl p-3 transition-colors"
          >
            <div className="text-sm font-semibold text-gray-700">{e.heading}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('landing.mapsDesc')}</div>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {blockB.map((b) => (
          <Link
            key={b.to}
            to={b.to}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              b.isCurrent
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
