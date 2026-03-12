import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useMapData } from '../../hooks/useMapData';
import { useQuizEngine } from '../../hooks/useQuizEngine';
import { useTimer } from '../../hooks/useTimer';
import { useResponsiveSize } from '../../hooks/useResponsiveSize';
import { extractRegions } from '../../utils/regionUtils';
import { matchesRegionName } from '../../utils/regionUtils';
import { shuffle } from '../../utils/quizEngine';
import { useI18n } from '../../i18n/useI18n';
import { usePageMeta } from '../../hooks/usePageMeta';
import QuizMap from '../../maps/QuizMap';
import QuizProgress from './QuizProgress';
import QuizPrompt from './QuizPrompt';
import QuizResults from './QuizResults';
import type { QuizMode, AdminLevel, MapDisplayMode } from '../../types';

export default function QuizSession() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const prevLocaleRef = useRef(locale);

  const mode = (modeParam || 'pin') as QuizMode;
  const adminLevel = (searchParams.get('level') || 'sido') as AdminLevel;
  const sidoFilter = searchParams.get('filter') || undefined;
  const countParam = parseInt(searchParams.get('count') || '0', 10) || 0;

  // Option query params
  const borderless = searchParams.get('borderless') === '1';
  const noAccum = searchParams.get('noaccum') === '1';
  const outline = searchParams.get('outline') === '1';

  const displayMode: MapDisplayMode =
    mode === 'pin' && borderless ? 'borderless' :
    mode === 'type' && outline ? 'outline-only' :
    'normal';

  const seoTitleKey = `seo.quiz.${mode}.${adminLevel}.title` as keyof import('../../i18n/types').TranslationStrings;
  const seoDescKey = `seo.quiz.${mode}.${adminLevel}.desc` as keyof import('../../i18n/types').TranslationStrings;
  usePageMeta({
    title: t(seoTitleKey),
    description: t(seoDescKey),
    path: `/quiz/${mode}?level=${adminLevel}`,
  });

  const { geoData, topoData, borderMesh, loading, error } = useMapData(adminLevel);
  const { state, currentRegion, progress, start, answerCorrect, answerWrong, reset } =
    useQuizEngine();
  const { formatted: elapsedTime } = useTimer(state.phase);
  const { containerRef, width, height } = useResponsiveSize();
  const [showResults, setShowResults] = useState(true);

  // noAccum: visibleAnswered with 1-second fadeout
  const [visibleAnswered, setVisibleAnswered] = useState<Map<string, number>>(new Map());
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track newly answered codes for noAccum mode
  const prevAnsweredSize = useRef(0);
  useEffect(() => {
    if (!noAccum) return;
    if (state.answered.size > prevAnsweredSize.current) {
      // Find the newly added code
      for (const [code, mistakes] of state.answered) {
        if (!visibleAnswered.has(code)) {
          setVisibleAnswered(prev => {
            const next = new Map(prev);
            next.set(code, mistakes);
            return next;
          });
          // Schedule removal after 1 second
          const timer = setTimeout(() => {
            setVisibleAnswered(prev => {
              const next = new Map(prev);
              next.delete(code);
              return next;
            });
            fadeTimers.current.delete(code);
          }, 1000);
          fadeTimers.current.set(code, timer);
        }
      }
    }
    prevAnsweredSize.current = state.answered.size;
  }, [noAccum, state.answered, visibleAnswered]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of fadeTimers.current.values()) clearTimeout(timer);
    };
  }, []);

  // Reset visibleAnswered when quiz resets
  useEffect(() => {
    if (state.phase === 'ready') {
      setVisibleAnswered(new Map());
      prevAnsweredSize.current = 0;
    }
  }, [state.phase]);

  const regions = useMemo(() => {
    if (!geoData) return [];
    const all = extractRegions(geoData, sidoFilter, locale);
    if (countParam > 0 && countParam < all.length) {
      return shuffle(all).slice(0, countParam);
    }
    return all;
  }, [geoData, sidoFilter, locale, countParam]);

  // Filtered geoData for map display (only show relevant regions)
  const filteredGeoData = useMemo(() => {
    if (!geoData || !sidoFilter) return geoData;
    return {
      ...geoData,
      features: geoData.features.filter((f) => {
        const code = f.properties.SIG_CD || f.properties.CTPRVN_CD || f.properties.code || '';
        return code.startsWith(sidoFilter);
      }),
    };
  }, [geoData, sidoFilter]);

  // Reset quiz when locale changes
  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      reset();
    }
  }, [locale, reset]);

  // Auto-start when data is ready
  useEffect(() => {
    if (regions.length > 0 && state.phase === 'ready') {
      start(regions);
    }
  }, [regions, state.phase, start]);

  const handlePinAnswer = useCallback(
    (clickedCode: string) => {
      if (!currentRegion || state.phase !== 'playing') return;
      // In noAccum mode, skip the already-answered guard so re-clicking is an error
      if (!noAccum && state.answered.has(clickedCode)) return;

      if (clickedCode === currentRegion.code) {
        answerCorrect();
      } else {
        answerWrong();
      }
    },
    [currentRegion, state.phase, state.answered, noAccum, answerCorrect, answerWrong],
  );

  const handleTypeAnswer = useCallback(
    (input: string) => {
      if (!currentRegion || state.phase !== 'playing') return;

      if (matchesRegionName(input, currentRegion.name, locale)) {
        answerCorrect();
      } else {
        answerWrong();
      }
    },
    [currentRegion, state.phase, locale, answerCorrect, answerWrong],
  );

  const handleRetry = useCallback(() => {
    reset();
    // Will auto-start via useEffect
  }, [reset]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-lg">{t('quiz.loading')}</div>
      </div>
    );
  }

  if (error || !geoData || !topoData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{t('quiz.loadError')}</div>
      </div>
    );
  }

  const isFinished = state.phase === 'finished';
  const isPinMode = mode === 'pin';
  const showInsets = (adminLevel === 'sigungu' || adminLevel === 'sigun') && !sidoFilter;

  const answeredCodes = isFinished
    ? state.answered
    : noAccum
      ? visibleAnswered
      : state.answered;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-x-hidden overflow-y-auto landscape:overflow-y-hidden relative">
      {!isFinished && (
        <>
          <QuizProgress
            current={state.answered.size}
            total={state.totalRegions}
            percentage={progress}
            time={elapsedTime}
            onBack={handleBack}
          />

          <QuizPrompt
            mode={mode}
            currentRegion={currentRegion}
            onTypeSubmit={handleTypeAnswer}
            wrongShakeKey={state.wrongAttempts}
          />
        </>
      )}

      <div ref={containerRef} className={`flex-1 min-h-0 flex items-start justify-center ${isFinished ? 'pt-4' : ''} pb-4`}>
        <QuizMap
          geoData={filteredGeoData!}
          contextGeoData={sidoFilter ? geoData : null}
          topoData={topoData}
          borderMesh={sidoFilter ? null : borderMesh}
          displayMode={isFinished ? 'normal' : displayMode}
          width={width}
          height={height}
          showInsets={showInsets}
          adminLevel={adminLevel}
          locale={locale}
          targetRegionCode={
            !isFinished && (displayMode === 'outline-only' || (mode === 'type' && currentRegion))
              ? currentRegion?.code ?? null
              : null
          }
          answeredCodes={answeredCodes}
          wrongFlashCode={state.wrongFlashCode}
          onRegionClick={!isFinished && isPinMode ? handlePinAnswer : undefined}
          resetZoom={isFinished}
        />
      </div>

      {!isFinished && (
        <div className="px-4 pb-4">
          <div className="max-w-xl mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {isFinished && (
        <>
          {/* Top center: watermark bar (always visible) */}
          <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow">
              <span className="text-lg font-bold text-blue-600">
                {(() => { let c = 0; for (const m of state.answered.values()) if (m === 0) c++; return c; })()}/{state.totalRegions}
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">{elapsedTime}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400">quiz-korea.ysw.kr</span>
              {!showResults && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setShowResults(true)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t('results.showOverlay')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Results overlay with X close */}
          {showResults && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
              <div className="relative">
                <QuizResults
                  onClose={() => setShowResults(false)}
                  totalRegions={state.totalRegions}
                  answered={state.answered}
                  elapsedTime={elapsedTime}
                  mode={mode}
                  adminLevel={adminLevel}
                  isSubset={countParam > 0}
                  onRetry={handleRetry}
                  onBack={handleBack}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
