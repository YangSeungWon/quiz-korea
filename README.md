# 한국 지리 데이터 시각화

React + D3.js를 사용한 대한민국 지리 데이터 시각화 웹 애플리케이션입니다. 다양한 베이스 맵을 통해 지역별 데이터를 효과적으로 시각화할 수 있습니다.

## 주요 기능

### 3가지 베이스 맵

1. **지리적 지도** - 실제 행정구역 경계선을 사용한 전통적인 지도
2. **인구 카토그램** - 인구나 데이터 값에 비례하여 지역 크기를 조정한 카토그램
3. **육각형 타일 맵** - 모든 지역을 동일한 크기의 육각형으로 표현하여 시각적 왜곡 제거

### 데이터 시각화

- 샘플 데이터셋 제공 (인구, 선거, 경제 지표, 고령화율)
- CSV/JSON 파일 업로드 지원
- 7가지 색상 테마 (파란색, 빨간색, 초록색, 주황색, 보라색, 분기형, 무지개)
- 인터랙티브 툴팁
- 확대/축소 기능

### 한국 지리 퀴즈

- 4가지 퀴즈 모드
  - **지역 찾기**: 지도에서 지역 이름을 보고 해당 위치를 클릭
  - **이름 맞히기**: 강조된 지역의 이름을 4지선다로 맞히기
  - **타임 어택**: 제한 시간 내에 최대한 많은 문제 풀기
  - **연습 모드**: 시간 제한 없이 자유롭게 학습
- 시도/시군구 레벨 선택 가능
- 점수 및 정답률 기록

## 기술 스택

- **프론트엔드**: React 18 + TypeScript
- **빌드 도구**: Vite
- **시각화**: D3.js
- **지리 데이터**: TopoJSON, GeoJSON
- **지리 공간 연산**: Turf.js
- **스타일링**: TailwindCSS 4

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`을 열어 확인하세요.

### 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### 프리뷰

```bash
npm run preview
```

## 프로젝트 구조

```
viz-korea/
├── public/
│   └── data/              # 한국 행정구역 GeoJSON 데이터
├── src/
│   ├── components/        # React 컴포넌트
│   │   ├── BaseMapSelector/    # 베이스 맵 선택기
│   │   ├── DataUploader/       # 데이터 업로드 UI
│   │   ├── Legend/             # 범례
│   │   └── MapViewer/          # 메인 지도 뷰어
│   ├── maps/              # 지도 컴포넌트
│   │   ├── GeographicMap.tsx   # 지리적 지도
│   │   ├── PopulationCartogram.tsx  # 카토그램
│   │   └── HexagonalMap.tsx    # 육각형 맵
│   ├── utils/             # 유틸리티 함수
│   │   ├── dataLoader.ts       # 데이터 로딩
│   │   ├── cartogram.ts        # 카토그램 알고리즘
│   │   ├── hexGrid.ts          # 육각형 그리드
│   │   └── colorScale.ts       # 색상 스케일
│   ├── hooks/             # React 훅
│   │   └── useMapData.ts       # 지도 데이터 로딩
│   ├── types/             # TypeScript 타입 정의
│   └── data/              # 샘플 데이터
└── package.json
```

## 데이터 형식

### CSV 파일

CSV 파일은 다음 컬럼을 포함해야 합니다:

```csv
regionCode,regionName,value
11,서울특별시,9500000
26,부산광역시,3350000
...
```

### JSON 파일

JSON 파일은 다음 형식을 따라야 합니다:

```json
[
  {
    "regionCode": "11",
    "regionName": "서울특별시",
    "value": 9500000
  },
  ...
]
```

## 지역 코드

광역자치단체 코드:
- 11: 서울특별시
- 26: 부산광역시
- 27: 대구광역시
- 28: 인천광역시
- 29: 광주광역시
- 30: 대전광역시
- 31: 울산광역시
- 36: 세종특별자치시
- 41: 경기도
- 51: 강원특별자치도
- 43: 충청북도
- 44: 충청남도
- 52: 전북특별자치도
- 46: 전라남도
- 47: 경상북도
- 48: 경상남도
- 50: 제주특별자치도

## 데이터 출처

행정구역 경계 데이터는 두 출처를 사용합니다:

- [southkorea-maps](https://github.com/southkorea/southkorea-maps) — 고해상도 시군구
  TopoJSON (KOSTAT 행정구역 통계 데이터 기반)
- [Korea_District](https://github.com/cubensys/Korea_District) — 초기 시도 경계

데이터 라이선스:
- southkorea-maps의 KOSTAT 부분: "Free to share or remix" (해당 repo README 명시)
- Korea_District: 라이선스 미명시 — 정부 공공 데이터(KOSTAT) 기반

### 행정구역 기준 시점

본 프로젝트는 **2018년 KOSTAT 기준** 행정구역 데이터를 사용하며, 학습용 도구로서
전통적인 17개 시도 구분을 의도적으로 유지합니다. 따라서 다음 최근 변경 사항은
반영되지 않습니다:

- 군위군의 경상북도 → 대구광역시 편입 (2023-07-01)
- 광주·전남 통합특별시 출범

## 라이선스

코드: MIT  
지리 데이터: 위 데이터 출처 섹션 참조

## 기여

이슈와 풀 리퀘스트를 환영합니다!
