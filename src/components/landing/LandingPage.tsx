import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useLocalePath } from '../../hooks/useLocalePath';
import RegionPicker from './RegionPicker';
import QuizCard from './QuizCard';
import LanguageToggle from '../LanguageToggle';
import MapsBanner from '../maps/MapsBanner';
import { SIDO_SLUG } from '../../utils/regionUtils';
import type { AdminLevel, QuizMode } from '../../types';

interface RegionSelection {
  level: AdminLevel;
  filter?: string;
}

type SelectedMode = QuizMode | 'learn';

const COUNT_OPTIONS = [16, 32, 64, 0] as const; // 0 = all

// A difficulty toggle shown under a mode card. Active = harder (orange ▲).
// Toggling it does not start the quiz — only the mode card does.
function DifficultyChip({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`w-full text-[11px] leading-tight px-1.5 py-1 rounded-md border text-left transition-colors flex items-center gap-1 ${
        active
          ? 'bg-orange-50 border-orange-300 text-orange-700'
          : 'bg-white border-gray-200 text-gray-400 hover:border-orange-200'
      }`}
    >
      <span className={active ? 'text-orange-500' : 'text-gray-300'}>▲</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const localized = useLocalePath();
  const { t, locale } = useI18n();
  usePageMeta({ title: t('seo.home.title'), description: t('seo.home.desc'), path: '/' });
  // Coming back from a quiz/learn session pre-selects that region (so the mode
  // cards show immediately — "back to mode selection, region kept").
  const location = useLocation();
  const returnedRegion = (location.state as { region?: RegionSelection } | null)?.region ?? null;
  const [region, setRegion] = useState<RegionSelection | null>(returnedRegion);
  const [count, setCount] = useState(0); // 0 = all

  // Difficulty option toggles (chips). Persist across mode launches.
  const [borderless, setBorderless] = useState(false);
  const [noAccum, setNoAccum] = useState(false);
  const [outline, setOutline] = useState(false);

  // Show count picker for levels with many regions (not 동 — it's already small)
  const showCountPicker = region && region.level !== 'sido' && region.level !== 'dong' && !region.filter;

  // 동 requires a 시군구 filter before the quiz/learn can start.
  const regionReady = !!region && (region.level !== 'dong' || !!region.filter);
  const harderLabel = locale === 'en' ? 'Harder ↑' : '난이도 ↑';

  // Clicking a mode card starts immediately, using the difficulty chips'
  // current state. No intermediate "start" step.
  const launch = useCallback(
    (mode: SelectedMode) => {
      if (!region || (region.level === 'dong' && !region.filter)) return;
      // 동: path segment is the raw 5-digit 시군구 code. Others use the sido slug.
      const sidoSegment = region.level === 'dong'
        ? (region.filter ? `/${region.filter}` : '')
        : (region.filter && SIDO_SLUG[region.filter] ? `/${SIDO_SLUG[region.filter]}` : '');
      const params = new URLSearchParams();
      if (count > 0) params.set('count', String(count));
      if (mode === 'pin') {
        if (borderless) params.set('borderless', '1');
        if (noAccum) params.set('noaccum', '1');
      }
      if (mode === 'type' && outline) params.set('outline', '1');
      const qs = params.toString();
      const base = mode === 'learn'
        ? `/learn/${region.level}${sidoSegment}/`
        : `/quiz/${mode}/${region.level}${sidoSegment}/`;
      navigate(localized(qs ? `${base}?${qs}` : base));
    },
    [region, count, borderless, noAccum, outline, navigate, localized],
  );

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

        {regionReady && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">{t('landing.modeSelect')}</span>
              <span className="text-[11px] text-blue-400 font-medium">
                {locale === 'en' ? 'Tap a mode to start →' : '누르면 바로 시작 →'}
              </span>
            </div>
            {/* Mode cards — own grid so all three are equal height */}
            <div className="grid grid-cols-3 gap-3 mb-2">
              <QuizCard
                title={t('landing.pinQuiz')}
                description={t('landing.pinQuizDesc')}
                onClick={() => launch('pin')}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>}
              />
              <QuizCard
                title={t('landing.typeQuiz')}
                description={t('landing.typeQuizDesc')}
                onClick={() => launch('type')}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>}
              />
              <QuizCard
                title={t('landing.learnMode')}
                description={t('landing.learnModeDesc')}
                onClick={() => launch('learn')}
                icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
              />
            </div>
            {/* Difficulty chips, aligned under each mode's column */}
            <div className="grid grid-cols-3 gap-3 mb-4 items-start">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-semibold text-orange-400 px-0.5">{harderLabel}</span>
                <DifficultyChip active={borderless} onToggle={() => setBorderless((v) => !v)} label={t('landing.optBorderless')} />
                <DifficultyChip active={noAccum} onToggle={() => setNoAccum((v) => !v)} label={t('landing.optNoAccum')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-semibold text-orange-400 px-0.5">{harderLabel}</span>
                <DifficultyChip active={outline} onToggle={() => setOutline((v) => !v)} label={t('landing.optOutline')} />
              </div>
              <div />
            </div>
          </>
        )}

        {/* Secondary CTA — printable maps download */}
        <div className="mt-6">
          <MapsBanner currentSidoCode={region?.filter} />
        </div>

        <footer className="text-center mt-10 text-xs text-gray-400">
          {t('landing.dataSource')}:{' '}
          <a
            href="https://sgis.mods.go.kr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {locale === 'en'
              ? 'SGIS (Statistics Korea), 2025'
              : '통계청 SGIS 행정구역경계 (2025)'}
          </a>
        </footer>
      </div>
    </div>
  );
}
