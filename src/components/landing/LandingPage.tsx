import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RegionPicker from './RegionPicker';
import QuizCard from './QuizCard';

interface RegionSelection {
  level: 'sido' | 'sigungu';
  filter?: string;
}

const MODES = [
  {
    key: 'pin',
    title: '클릭 퀴즈',
    description: '지역 이름이 주어지면 지도에서 해당 지역을 클릭하세요.',
  },
  {
    key: 'type',
    title: '타이핑 퀴즈',
    description: '지도에서 강조된 지역의 이름을 입력하세요.',
  },
  {
    key: 'pin-hard',
    title: '클릭 퀴즈 (어려움)',
    description: '경계선 없이 지도에서 지역을 찾으세요.',
  },
  {
    key: 'type-hard',
    title: '타이핑 퀴즈 (어려움)',
    description: '윤곽선만 보고 지역 이름을 맞추세요.',
  },
] as const;

export default function LandingPage() {
  const navigate = useNavigate();
  const [region, setRegion] = useState<RegionSelection>({ level: 'sido' });

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ level: region.level });
    if (region.filter) {
      params.set('filter', region.filter);
    }
    return params.toString();
  }, [region]);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">한국 지리 퀴즈</h1>
          <p className="text-gray-500">지도에서 지역을 찾아보세요</p>
        </div>

        <div className="mb-6">
          <RegionPicker value={region} onChange={setRegion} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {MODES.map((m) => (
            <QuizCard
              key={m.key}
              title={m.title}
              description={m.description}
              onClick={() => handleModeClick(m.key)}
            />
          ))}
        </div>

        <button
          onClick={handleLearnClick}
          className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-green-300 hover:shadow-md transition-all group"
        >
          <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors mb-1">
            학습 모드
          </h3>
          <p className="text-sm text-gray-500">
            자유롭게 지도를 탐색하며 지역 이름을 익히세요.
          </p>
        </button>

        <footer className="text-center mt-10 text-xs text-gray-400">
          데이터 출처:{' '}
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
