import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import QuizSession from './components/quiz/QuizSession';
import LearnMode from './components/learn/LearnMode';
import RecordsPage from './components/records/RecordsPage';
import MapDownloadPage from './components/maps/MapDownloadPage';
import MapPrintView from './components/maps/MapPrintView';
import { I18nProvider } from './i18n/I18nContext';
import { SIDO_SLUG } from './utils/regionUtils';

const VALID_LANGS = new Set(['ko', 'en']);

function detectBrowserLang(): 'ko' | 'en' {
  if (typeof navigator === 'undefined') return 'ko';
  if (navigator.language?.startsWith('ko')) return 'ko';
  if (navigator.languages?.some((l) => l.startsWith('ko'))) return 'ko';
  return 'en';
}

function pickLangFromSearch(searchParams: URLSearchParams): 'ko' | 'en' {
  const langParam = searchParams.get('lang');
  if (langParam === 'ko' || langParam === 'en') return langParam;
  return detectBrowserLang();
}

// `/` → /ko/ or /en/ based on browser language. Honors explicit ?lang=.
function RootRedirect() {
  const [searchParams] = useSearchParams();
  const lang = pickLangFromSearch(searchParams);
  const carry = new URLSearchParams(searchParams);
  carry.delete('lang');
  const qs = carry.toString();
  return <Navigate to={`/${lang}/${qs ? `?${qs}` : ''}`} replace />;
}

// Validates :lang segment. If invalid (e.g. URL like /quiz that the router
// matched against /:lang), prepend /ko and redirect, preserving rest of path.
function LangScope() {
  const { lang } = useParams<{ lang: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  if (!lang || !VALID_LANGS.has(lang)) {
    const carry = new URLSearchParams(searchParams);
    carry.delete('lang');
    const qs = carry.toString();
    return <Navigate to={`/ko${location.pathname}${qs ? `?${qs}` : ''}`} replace />;
  }
  return <Outlet />;
}

// Legacy: /quiz/:mode?level=X&(filter=11|sido=seoul)&... → /:lang/quiz/...
function LegacyQuizRedirect() {
  const { mode } = useParams<{ mode: string }>();
  const [searchParams] = useSearchParams();
  const lang = pickLangFromSearch(searchParams);
  const level = searchParams.get('level') || 'sido';
  const slugOrCode = searchParams.get('sido') || searchParams.get('filter') || '';
  const slug = SIDO_SLUG[slugOrCode] ?? slugOrCode;
  const sidoSegment = slug ? `/${slug}` : '';
  const carry = new URLSearchParams();
  for (const k of ['borderless', 'noaccum', 'outline', 'count']) {
    const v = searchParams.get(k);
    if (v) carry.set(k, v);
  }
  const qs = carry.toString();
  return <Navigate to={`/${lang}/quiz/${mode}/${level}${sidoSegment}/${qs ? `?${qs}` : ''}`} replace />;
}

function LegacyLearnRedirect() {
  const [searchParams] = useSearchParams();
  const lang = pickLangFromSearch(searchParams);
  const level = searchParams.get('level') || 'sido';
  const slugOrCode = searchParams.get('sido') || searchParams.get('filter') || '';
  const slug = SIDO_SLUG[slugOrCode] ?? slugOrCode;
  const sidoSegment = slug ? `/${slug}` : '';
  const carry = new URLSearchParams();
  for (const k of ['count']) {
    const v = searchParams.get(k);
    if (v) carry.set(k, v);
  }
  const qs = carry.toString();
  return <Navigate to={`/${lang}/learn/${level}${sidoSegment}/${qs ? `?${qs}` : ''}`} replace />;
}

// Legacy unprefixed path-based URLs (e.g. /quiz/pin/sido/, /maps/sigungu/seoul/)
function LegacyPathRedirect() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const lang = pickLangFromSearch(searchParams);
  const carry = new URLSearchParams(searchParams);
  carry.delete('lang');
  const qs = carry.toString();
  return <Navigate to={`/${lang}${location.pathname}${qs ? `?${qs}` : ''}`} replace />;
}

function App() {
  return (
    <Router>
      <I18nProvider>
      <Routes>
        {/* Root → /ko/ or /en/ */}
        <Route path="/" element={<RootRedirect />} />

        {/* Legacy ?level=&filter= redirects (must be more specific than /:lang) */}
        <Route path="/quiz/:mode" element={<LegacyQuizRedirect />} />
        <Route path="/learn" element={<LegacyLearnRedirect />} />

        {/* Legacy unprefixed path-based redirects */}
        <Route path="/quiz/:mode/:level" element={<LegacyPathRedirect />} />
        <Route path="/quiz/:mode/:level/:sidoSlug" element={<LegacyPathRedirect />} />
        <Route path="/learn/:level" element={<LegacyPathRedirect />} />
        <Route path="/learn/:level/:sidoSlug" element={<LegacyPathRedirect />} />
        <Route path="/maps/:level" element={<LegacyPathRedirect />} />
        <Route path="/maps/:level/:sidoSlug" element={<LegacyPathRedirect />} />

        {/* Lang-prefixed canonical routes */}
        <Route path="/:lang" element={<LangScope />}>
          <Route index element={<LandingPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="quiz/:mode/:level" element={<QuizSession />} />
          <Route path="quiz/:mode/:level/:sidoSlug" element={<QuizSession />} />
          <Route path="learn/:level" element={<LearnMode />} />
          <Route path="learn/:level/:sidoSlug" element={<LearnMode />} />
          <Route path="maps/:level" element={<MapDownloadPage />} />
          <Route path="maps/:level/:sidoSlug" element={<MapDownloadPage />} />
          {/* Print-only routes (puppeteer-internal, lang chooses content language) */}
          <Route path="maps/print/:variant/:level" element={<MapPrintView />} />
          <Route path="maps/print/:variant/:level/:sidoSlug" element={<MapPrintView />} />
          {/* Unmatched within a valid lang → back to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* Catch-all (e.g. completely unknown URL) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </I18nProvider>
    </Router>
  );
}

export default App;
