import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import RegionPicker from './RegionPicker';
import QuizCard from './QuizCard';
import LanguageToggle from '../LanguageToggle';
import type { AdminLevel } from '../../types';

interface RegionSelection {
  level: AdminLevel;
  filter?: string;
}

const MODE_KEYS = ['pin', 'type', 'pin-hard', 'type-hard'] as const;
const MODE_I18N = [
  { title: 'landing.pinQuiz', desc: 'landing.pinQuizDesc' },
  { title: 'landing.typeQuiz', desc: 'landing.typeQuizDesc' },
  { title: 'landing.pinHard', desc: 'landing.pinHardDesc' },
  { title: 'landing.typeHard', desc: 'landing.typeHardDesc' },
] as const;

const COUNT_OPTIONS = [16, 32, 64, 0] as const; // 0 = all

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [count, setCount] = useState(0); // 0 = all

  // Show count picker for levels with many regions
  const showCountPicker = region && region.level !== 'sido';

  const buildParams = useCallback(() => {
    if (!region) return '';
    const params = new URLSearchParams({ level: region.level });
    if (region.filter) {
      params.set('filter', region.filter);
    }
    if (count > 0) {
      params.set('count', String(count));
    }
    return params.toString();
  }, [region, count]);

  const handleModeClick = useCallback(
    (mode: string) => {
      navigate(`/quiz/${mode}?${buildParams()}`);
    },
    [navigate, buildParams],
  );

  const handleLearnClick = useCallback(() => {
    navigate(`/learn?${buildParams()}`);
  }, [navigate, buildParams]);

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
          <RegionPicker value={region} onChange={setRegion} />
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
            <div className="grid grid-cols-2 gap-3 mb-4">
              {MODE_KEYS.map((key, i) => (
                <QuizCard
                  key={key}
                  title={t(MODE_I18N[i].title)}
                  description={t(MODE_I18N[i].desc)}
                  onClick={() => handleModeClick(key)}
                />
              ))}
            </div>

            <button
              onClick={handleLearnClick}
              className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-green-300 hover:shadow-md transition-all group"
            >
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors mb-1">
                {t('landing.learnMode')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('landing.learnModeDesc')}
              </p>
            </button>
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
        </footer>
      </div>
    </div>
  );
}
