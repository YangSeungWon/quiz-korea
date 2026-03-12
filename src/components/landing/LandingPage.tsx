import { useState, useCallback } from 'react';
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

const MODE_KEYS: QuizMode[] = ['pin', 'type'];
const MODE_I18N = [
  { title: 'landing.pinQuiz', desc: 'landing.pinQuizDesc' },
  { title: 'landing.typeQuiz', desc: 'landing.typeQuizDesc' },
] as const;

const COUNT_OPTIONS = [16, 32, 64, 0] as const; // 0 = all

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  usePageMeta({ title: t('seo.home.title'), description: t('seo.home.desc'), path: '/' });
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [count, setCount] = useState(0); // 0 = all
  const [selectedMode, setSelectedMode] = useState<QuizMode | null>(null);

  // Option toggles
  const [borderless, setBorderless] = useState(false);
  const [noAccum, setNoAccum] = useState(false);
  const [outline, setOutline] = useState(false);

  // Show count picker for levels with many regions
  const showCountPicker = region && region.level !== 'sido' && !region.filter;

  const handleStart = useCallback(() => {
    if (!region || !selectedMode) return;
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
    (mode: QuizMode) => {
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

  const buildLearnParams = useCallback(() => {
    if (!region) return '';
    const params = new URLSearchParams({ level: region.level });
    if (region.filter) params.set('filter', region.filter);
    if (count > 0) params.set('count', String(count));
    return params.toString();
  }, [region, count]);

  const handleLearnClick = useCallback(() => {
    navigate(`/learn?${buildLearnParams()}`);
  }, [navigate, buildLearnParams]);

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
              {MODE_KEYS.map((key, i) => (
                <QuizCard
                  key={key}
                  title={t(MODE_I18N[i].title)}
                  description={t(MODE_I18N[i].desc)}
                  onClick={() => handleModeClick(key)}
                  selected={selectedMode === key}
                />
              ))}
              <QuizCard
                title={t('landing.learnMode')}
                description={t('landing.learnModeDesc')}
                onClick={handleLearnClick}
              />
            </div>

            {/* Options + start for selected mode */}
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
                <button
                  onClick={handleStart}
                  className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  {t('landing.pinQuiz')}
                </button>
              </div>
            )}

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
                <button
                  onClick={handleStart}
                  className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  {t('landing.typeQuiz')}
                </button>
              </div>
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
