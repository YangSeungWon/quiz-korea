export type Locale = 'ko' | 'en';

export interface TranslationStrings {
  // Landing page
  'landing.title': string;
  'landing.subtitle': string;
  'landing.pinQuiz': string;
  'landing.pinQuizDesc': string;
  'landing.typeQuiz': string;
  'landing.typeQuizDesc': string;
  'landing.optBorderless': string;
  'landing.optNoAccum': string;
  'landing.optOutline': string;
  'landing.learnMode': string;
  'landing.learnModeDesc': string;
  'landing.maps': string;
  'landing.mapsDesc': string;
  'landing.modeSelect': string;
  'landing.dataSource': string;

  // Region picker
  'picker.sido': string;
  'picker.allSido': string;
  'picker.sigun': string;
  'picker.allSigun': string;
  'picker.sigungu': string;
  'picker.allSigungu': string;
  'picker.dong': string;
  'picker.dongPickSido': string;
  'picker.dongPickSigungu': string;
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
  'quiz.answerLabel': string;

  // Learn
  'learn.title': string;
  'learn.hoverHint': string;

  // SEO
  'seo.home.title': string;
  'seo.home.desc': string;
  'seo.quiz.pin.sido.title': string;
  'seo.quiz.pin.sido.desc': string;
  'seo.quiz.pin.sigun.title': string;
  'seo.quiz.pin.sigun.desc': string;
  'seo.quiz.pin.sigungu.title': string;
  'seo.quiz.pin.sigungu.desc': string;
  'seo.quiz.type.sido.title': string;
  'seo.quiz.type.sido.desc': string;
  'seo.quiz.type.sigun.title': string;
  'seo.quiz.type.sigun.desc': string;
  'seo.quiz.type.sigungu.title': string;
  'seo.quiz.type.sigungu.desc': string;
  'seo.learn.sido.title': string;
  'seo.learn.sido.desc': string;
  'seo.learn.sigun.title': string;
  'seo.learn.sigun.desc': string;
  'seo.learn.sigungu.title': string;
  'seo.learn.sigungu.desc': string;
  // Filtered (per-sido) SEO templates: {sido} = '서울', {regionLabel} = '자치구'/'시군'
  'seo.quiz.pin.filtered.title': string;
  'seo.quiz.pin.filtered.desc': string;
  'seo.quiz.type.filtered.title': string;
  'seo.quiz.type.filtered.desc': string;
  'seo.learn.filtered.title': string;
  'seo.learn.filtered.desc': string;

  // Maps download pages
  'seo.maps.sido.title': string;
  'seo.maps.sido.desc': string;
  'seo.maps.sigun.title': string;
  'seo.maps.sigun.desc': string;
  'seo.maps.sigungu.title': string;
  'seo.maps.sigungu.desc': string;
  'seo.maps.filtered.title': string;
  'seo.maps.filtered.desc': string;
  'maps.heading.sido': string;
  'maps.heading.sigun': string;
  'maps.heading.sigungu': string;
  'maps.heading.filtered': string;
  'maps.intro': string;
  'maps.downloadBlankPdf': string;
  'maps.downloadLabelPdf': string;
  'maps.previewBlank': string;
  'maps.previewLabel': string;
  'maps.usage': string;
  'maps.dataNote': string;
  'maps.backToHome': string;
  'maps.relatedHeading': string;

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
  'results.shareX': string;
  'results.copied': string;
  'results.shareText': string;
  'results.newRecord': string;
  'results.bestRecord': string;
  'results.viewRecords': string;

  'records.title': string;
  'records.subtitle': string;
  'records.empty': string;
  'records.replay': string;
  'records.clear': string;
  'records.clearConfirm': string;
  'records.link': string;
}
