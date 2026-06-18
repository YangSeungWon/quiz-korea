import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';

/**
 * Floating "print this 시군구's 동 map" control, shown on 동 quiz/learn pages.
 * Links to the dedicated print-map route (MapPrintView), which renders an
 * A4-fit map — blank (백지도 worksheet) or labeled (이름 지도). Opens in a new
 * tab so the visitor keeps their quiz/learn session. Hidden when printing.
 */
export default function DongPrintLinks({ code }: { code: string }) {
  const { locale } = useI18n();
  const localized = useLocalePath();
  const link = (v: 'blank' | 'label') => localized(`/maps/print/${v}/dong/${code}/`);

  return (
    <div className="no-print fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-2 shadow-md text-sm">
      <span aria-hidden className="text-gray-500">🖨</span>
      <a
        href={link('blank')}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gray-600 hover:text-blue-600 transition-colors"
      >
        {locale === 'en' ? 'Blank map' : '백지도'}
      </a>
      <span className="text-gray-300">|</span>
      <a
        href={link('label')}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gray-600 hover:text-blue-600 transition-colors"
      >
        {locale === 'en' ? 'Labeled' : '이름 지도'}
      </a>
    </div>
  );
}
