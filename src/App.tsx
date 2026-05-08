import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import QuizSession from './components/quiz/QuizSession';
import LearnMode from './components/learn/LearnMode';
import { SIDO_SLUG } from './utils/regionUtils';

// Backward-compat: /quiz/:mode?level=X&(filter=11|sido=seoul)&...
function LegacyQuizRedirect() {
  const { mode } = useParams<{ mode: string }>();
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || 'sido';
  const slugOrCode = searchParams.get('sido') || searchParams.get('filter') || '';
  const slug = SIDO_SLUG[slugOrCode] ?? slugOrCode;
  const sidoSegment = slug ? `/${slug}` : '';
  // Preserve options + lang in query string
  const carry = new URLSearchParams();
  for (const k of ['borderless', 'noaccum', 'outline', 'count', 'lang']) {
    const v = searchParams.get(k);
    if (v) carry.set(k, v);
  }
  const qs = carry.toString();
  return <Navigate to={`/quiz/${mode}/${level}${sidoSegment}${qs ? `?${qs}` : ''}`} replace />;
}

function LegacyLearnRedirect() {
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || 'sido';
  const slugOrCode = searchParams.get('sido') || searchParams.get('filter') || '';
  const slug = SIDO_SLUG[slugOrCode] ?? slugOrCode;
  const sidoSegment = slug ? `/${slug}` : '';
  const carry = new URLSearchParams();
  for (const k of ['count', 'lang']) {
    const v = searchParams.get(k);
    if (v) carry.set(k, v);
  }
  const qs = carry.toString();
  return <Navigate to={`/learn/${level}${sidoSegment}${qs ? `?${qs}` : ''}`} replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Path-based (SEO-friendly) */}
        <Route path="/quiz/:mode/:level" element={<QuizSession />} />
        <Route path="/quiz/:mode/:level/:sidoSlug" element={<QuizSession />} />
        <Route path="/learn/:level" element={<LearnMode />} />
        <Route path="/learn/:level/:sidoSlug" element={<LearnMode />} />

        {/* Legacy redirects (keep submitted GSC URLs alive) */}
        <Route path="/quiz/:mode" element={<LegacyQuizRedirect />} />
        <Route path="/learn" element={<LegacyLearnRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
