import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { useLocalePath } from '../../hooks/useLocalePath';
import LanguageToggle from '../LanguageToggle';
import { getAllRecords, clearAllRecords, formatTime, type RecordEntry } from '../../utils/records';
import { recordReplayPath, recordRegionLabel } from '../../utils/recordDisplay';
import type { TranslationStrings } from '../../i18n/types';

export default function RecordsPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const localized = useLocalePath();
  const [records, setRecords] = useState<RecordEntry[]>([]);

  useEffect(() => {
    document.title = `${t('records.title')} - ${t('landing.title')}`;
    // Personal page — keep it out of search indexes.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    const prev = meta.getAttribute('content');
    meta.setAttribute('content', 'noindex,nofollow');
    return () => { if (prev) meta!.setAttribute('content', prev); };
  }, [t]);

  useEffect(() => {
    setRecords(getAllRecords().sort((a, b) => b.dateISO.localeCompare(a.dateISO)));
  }, []);

  const rows = useMemo(() => records.map((e) => {
    const modeLabel = t(e.mode === 'pin' ? 'landing.pinQuiz' : 'landing.typeQuiz');
    const levelKey: keyof TranslationStrings =
      e.adminLevel === 'sido' ? 'picker.sido'
      : e.adminLevel === 'sigungu' ? 'picker.sigungu'
      : e.adminLevel === 'dong' ? 'picker.dong'
      : 'picker.sigun';
    const region = recordRegionLabel(e, locale);
    const opts = [
      e.borderless && t('landing.optBorderless'),
      e.noAccum && t('landing.optNoAccum'),
      e.outline && t('landing.optOutline'),
    ].filter(Boolean) as string[];
    const label = `${modeLabel} · ${region ? `${region} ` : ''}${t(levelKey)}${e.count ? ` ${e.count}` : ''}`;
    return { e, label, opts, to: localized(recordReplayPath(e)) };
  }), [records, t, locale, localized]);

  const handleClear = () => {
    if (window.confirm(t('records.clearConfirm'))) {
      clearAllRecords();
      setRecords([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(localized('/'))}
            className="text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            &larr; {t('maps.backToHome')}
          </button>
          <LanguageToggle />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('records.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('records.subtitle')}</p>

        {rows.length === 0 ? (
          <div className="text-center text-gray-400 py-16">{t('records.empty')}</div>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ e, label, opts, to }) => (
              <li
                key={`${label}-${opts.join()}`}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{label}</div>
                  {opts.length > 0 && (
                    <div className="text-[11px] text-gray-400 truncate">[{opts.join(', ')}]</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-blue-600 tabular-nums">{e.correct}/{e.total}</div>
                  <div className="text-xs text-gray-500 font-mono">{formatTime(e.timeMs)}</div>
                </div>
                <Link
                  to={to}
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-2 transition-colors"
                >
                  {t('records.replay')}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <button
            onClick={handleClear}
            className="mt-6 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            {t('records.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
