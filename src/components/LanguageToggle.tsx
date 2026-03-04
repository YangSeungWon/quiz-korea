import { useI18n } from '../i18n/useI18n';

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
      className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors rounded border border-gray-200 hover:border-gray-400"
    >
      {locale === 'ko' ? 'EN' : '한국어'}
    </button>
  );
}
