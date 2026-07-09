import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';
import { PrinterIcon } from '../icons';
import type { AdminLevel } from '../../types';

interface Props {
  adminLevel: AdminLevel;
  /** Sido slug for filtered non-dong quizzes (undefined = 전국). */
  slug?: string;
  /** 4/5-digit 시군구 code for 동 quizzes. */
  dongCode?: string;
}

const wrap = 'no-print fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-2 shadow-md text-sm';
const linkCls = 'font-medium text-gray-600 hover:text-blue-600 transition-colors';

/**
 * Floating "print this map" control on quiz/learn pages. All links open in a
 * new tab so the running session is kept.
 *  - 시도·시군·필터된 시군구: a ready-made 백지도 page already exists (/maps/...)
 *    with both blank & label PDFs → one link straight to it.
 *  - 동, 전국 시군구: no pre-built page (too dense to pre-render) → on-demand
 *    print routes rendered live (백지도 / 이름 지도).
 */
export default function MapPrintLinks({ adminLevel, slug, dongCode }: Props) {
  const { locale } = useI18n();
  const localized = useLocalePath();

  if (adminLevel === 'dong' && !dongCode) return null;

  // No ready-made download page → render the map on demand (blank / label).
  const onDemand = adminLevel === 'dong' || (adminLevel === 'sigungu' && !slug);
  if (onDemand) {
    const seg = adminLevel === 'dong' ? `dong/${dongCode}` : 'sigungu';
    const printRoute = (v: 'blank' | 'label') => localized(`/maps/print/${v}/${seg}/`);
    return (
      <div className={wrap}>
        <span aria-hidden className="text-gray-500 flex items-center"><PrinterIcon size={15} /></span>
        <a href={printRoute('blank')} target="_blank" rel="noopener noreferrer" className={linkCls}>
          {locale === 'en' ? 'Blank map' : '백지도'}
        </a>
        <span className="text-gray-300">|</span>
        <a href={printRoute('label')} target="_blank" rel="noopener noreferrer" className={linkCls}>
          {locale === 'en' ? 'Labeled' : '이름 지도'}
        </a>
      </div>
    );
  }

  // Ready-made 백지도 page (has blank + label downloads + preview).
  const mapsPage = localized(`/maps/${adminLevel}${slug ? `/${slug}` : ''}/`);
  return (
    <div className={wrap}>
      <span aria-hidden className="text-gray-500">🖨</span>
      <a href={mapsPage} target="_blank" rel="noopener noreferrer" className={linkCls}>
        {locale === 'en' ? 'Printable map' : '백지도'}
      </a>
    </div>
  );
}
