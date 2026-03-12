import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import RegionPicker from './RegionPicker';
import QuizCard from './QuizCard';
import LanguageToggle from '../LanguageToggle';
import type { AdminLevel, QuizMode } from '../../types';

interface RegionSelection {
  level: AdminLevel;
  filter?: string;
}

type SelectedMode = QuizMode | 'learn';

const COUNT_OPTIONS = [16, 32, 64, 0] as const; // 0 = all

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  usePageMeta({ title: t('seo.home.title'), description: t('seo.home.desc'), path: '/' });
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [count, setCount] = useState(0); // 0 = all
  const [selectedMode, setSelectedMode] = useState<SelectedMode | null>(null);

  // Option toggles
  const [borderless, setBorderless] = useState(false);
  const [noAccum, setNoAccum] = useState(false);
  const [outline, setOutline] = useState(false);

  // Show count picker for levels with many regions
  const showCountPicker = region && region.level !== 'sido' && !region.filter;

  // Difficulty level based on checked options
  const difficultyCount = useMemo(() => {
    if (selectedMode === 'pin') return (borderless ? 1 : 0) + (noAccum ? 1 : 0);
    if (selectedMode === 'type') return outline ? 1 : 0;
    return 0;
  }, [selectedMode, borderless, noAccum, outline]);

  const handleStart = useCallback(() => {
    if (!region || !selectedMode) return;
    if (selectedMode === 'learn') {
      const params = new URLSearchParams({ level: region.level });
      if (region.filter) params.set('filter', region.filter);
      if (count > 0) params.set('count', String(count));
      navigate(`/learn?${params.toString()}`);
      return;
    }
    const params = new URLSearchParams({ level: region.level });
    if (region.filter) params.set('filter', region.filter);
    if (count > 0) params.set('count', String(count));
    if (selectedMode === 'pin') {
      if (borderless) params.set('borderless', '1');
      if (noAccum) params.set('noaccum', '1');
    }
    if (selectedMode === 'type' && outline) {
      params.set('outline', '1');
    }
    navigate(`/quiz/${selectedMode}?${params.toString()}`);
  }, [region, selectedMode, count, borderless, noAccum, outline, navigate]);

  const handleModeClick = useCallback(
    (mode: SelectedMode) => {
      if (selectedMode === mode) {
        setSelectedMode(null);
      } else {
        setSelectedMode(mode);
        setBorderless(false);
        setNoAccum(false);
        setOutline(false);
      }
    },
    [selectedMode],
  );

  const startLabel = selectedMode === 'learn'
    ? t('landing.learnMode')
    : selectedMode === 'pin'
      ? t('landing.pinQuiz')
      : selectedMode === 'type'
        ? t('landing.typeQuiz')
        : '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-end mb-2">
            <LanguageToggle />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('landing.title')}</h1>
          <p className="text-gray-500">{t('landing.subtitle')}</p>
        </div>

        <div className="mb-6">
          <RegionPicker value={region} onChange={(r) => { setRegion(r); setCount(0); }} />
        </div>

        {showCountPicker && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('picker.count')}
            </label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    count === n
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {n === 0 ? t('picker.countAll') : n}
                </button>
              ))}
            </div>
          </div>
        )}

        {region && (
          <>
            <div className="text-xs font-medium text-gray-400 mb-2">{t('landing.modeSelect')}</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <QuizCard
                title={t('landing.pinQuiz')}
                description={t('landing.pinQuizDesc')}
                onClick={() => handleModeClick('pin')}
                selected={selectedMode === 'pin'}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>}
              />
              <QuizCard
                title={t('landing.typeQuiz')}
                description={t('landing.typeQuizDesc')}
                onClick={() => handleModeClick('type')}
                selected={selectedMode === 'type'}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>}
              />
              <QuizCard
                title={t('landing.learnMode')}
                description={t('landing.learnModeDesc')}
                onClick={() => handleModeClick('learn')}
                selected={selectedMode === 'learn'}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
              />
            </div>

            {/* Options for pin mode */}
            {selectedMode === 'pin' && (
              <div className="mb-4 bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={borderless}
                    onChange={(e) => setBorderless(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('landing.optBorderless')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noAccum}
                    onChange={(e) => setNoAccum(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('landing.optNoAccum')}</span>
                </label>
              </div>
            )}

            {/* Options for type mode */}
            {selectedMode === 'type' && (
              <div className="mb-4 bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outline}
                    onChange={(e) => setOutline(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('landing.optOutline')}</span>
                </label>
              </div>
            )}

            {/* Unified start button */}
            {selectedMode && (
              <button
                onClick={handleStart}
                className={`relative w-full text-white py-3 rounded-xl font-semibold transition-colors overflow-hidden ${
                  difficultyCount >= 2
                    ? 'bg-red-500 hover:bg-red-600'
                    : difficultyCount === 1
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : selectedMode === 'learn'
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                <span className="absolute inset-0 animate-[ripple_2s_ease-in-out_infinite] rounded-xl border-2 border-white/30" />
                <span className="relative">{startLabel}</span>
              </button>
            )}
          </>
        )}

        <footer className="text-center mt-10 text-xs text-gray-400">
          {t('landing.dataSource')}:{' '}
          <a
            href="https://github.com/cubensys/Korea_District"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Korea_District
          </a>
          {', '}
          <a
            href="https://github.com/southkorea/southkorea-maps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            southkorea-maps
          </a>
        </footer>
      </div>
    </div>
  );
}
