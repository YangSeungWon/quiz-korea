import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const onClick = () => {
    const next = locale === 'ko' ? 'en' : 'ko';
    // Persist preference for fallback (e.g. /maps/print/ which is lang-less)
    setLocale(next);
    // Swap the lang segment in the current path
    const segments = location.pathname.split('/');
    if (segments[1] === 'ko' || segments[1] === 'en') {
      segments[1] = next;
    } else {
      // Path has no lang prefix — prepend
      segments.splice(1, 0, next);
    }
    const newPath = segments.join('/') || `/${next}/`;
    navigate(`${newPath}${location.search}${location.hash}`);
  };

  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors rounded border border-gray-200 hover:border-gray-400"
    >
      {locale === 'ko' ? 'EN' : '한국어'}
    </button>
  );
}
