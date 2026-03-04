export type Locale = 'ko' | 'en';

export interface TranslationStrings {
  // Landing page
  'landing.title': string;
  'landing.subtitle': string;
  'landing.pinQuiz': string;
  'landing.pinQuizDesc': string;
  'landing.typeQuiz': string;
  'landing.typeQuizDesc': string;
  'landing.pinHard': string;
  'landing.pinHardDesc': string;
  'landing.typeHard': string;
  'landing.typeHardDesc': string;
  'landing.learnMode': string;
  'landing.learnModeDesc': string;
  'landing.dataSource': string;

  // Region picker
  'picker.sido': string;
  'picker.allSido': string;
  'picker.sigun': string;
  'picker.allSigun': string;
  'picker.sigungu': string;
  'picker.allSigungu': string;
  'picker.count': string;
  'picker.countAll': string;

  // Quiz
  'quiz.clickPrefix': string;
  'quiz.clickSuffix': string;
  'quiz.typePlaceholder': string;
  'quiz.submit': string;
  'quiz.back': string;
  'quiz.loading': string;
  'quiz.loadError': string;

  // Learn
  'learn.title': string;
  'learn.hoverHint': string;

  // Results
  'results.title': string;
  'results.perfect': string;
  'results.great': string;
  'results.good': string;
  'results.tryAgain': string;
  'results.firstTry': string;
  'results.time': string;
  'results.retry': string;
  'results.backToModes': string;
  'results.hideOverlay': string;
  'results.showOverlay': string;
  'results.share': string;
  'results.copied': string;
  'results.shareText': string;
}
