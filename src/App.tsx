import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import QuizSession from './components/quiz/QuizSession';
import LearnMode from './components/learn/LearnMode';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/quiz/:mode" element={<QuizSession />} />
        <Route path="/learn" element={<LearnMode />} />
      </Routes>
    </Router>
  );
}

export default App;
