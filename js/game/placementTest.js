/**
 * js/game/placementTest.js
 * 실력 진단(배치 테스트) 전용 모듈:
 * - 12문제 구성: Unit 1부터 시작하여 해치를 통과할 때마다 난이도 계단식 자동 상승
 * - 인명·지명 등 첫 글자 대문자 고유명사 자동 필터링
 * - Set 기반 단어 중복(ID 및 철자) 완전 차단
 * - 오답/모름 제출 시 정답 비공개 원칙 준수
 * - 12문제 기준 정답률 및 통과 난이도 기반 wordCursor 및 추천 레벨 산출
 */

import { WORDS as WORDS_EN } from '../data/data_en.js?v=2';
import { WORDS as WORDS_ES } from '../data/data_es.js';
import { WORD_LEVEL_TIERS, isProperNoun } from '../core/courseEngine.js';

export { isProperNoun };

export const PLACEMENT_CONFIG = Object.freeze({
  TOTAL_QUESTIONS: 12,
});

/** 12단계 계단식 난이도 구간 정의 (Unit 1부터 전체 유닛 범위로 점진적 확장) */
export const STEPPED_DIFFICULTY_RANGES = Object.freeze([
  { step: 1, minUnit: 1, maxUnit: 15, label: '왕초보 (입문)', tierKey: 'novice' },
  { step: 2, minUnit: 16, maxUnit: 30, label: '왕초보 (도약)', tierKey: 'novice' },
  { step: 3, minUnit: 31, maxUnit: 50, label: '초급 (기초)', tierKey: 'beginner' },
  { step: 4, minUnit: 51, maxUnit: 70, label: '초급 (확장)', tierKey: 'beginner' },
  { step: 5, minUnit: 71, maxUnit: 100, label: '초중급 (입문)', tierKey: 'pre_intermediate' },
  { step: 6, minUnit: 101, maxUnit: 140, label: '초중급 (실전)', tierKey: 'pre_intermediate' },
  { step: 7, minUnit: 141, maxUnit: 200, label: '중급 (핵심)', tierKey: 'intermediate' },
  { step: 8, minUnit: 201, maxUnit: 280, label: '중급 (도약)', tierKey: 'intermediate' },
  { step: 9, minUnit: 281, maxUnit: 380, label: '중고급 (심화)', tierKey: 'upper_intermediate' },
  { step: 10, minUnit: 381, maxUnit: 480, label: '중고급 (실전)', tierKey: 'upper_intermediate' },
  { step: 11, minUnit: 481, maxUnit: 580, label: '고급 (전문)', tierKey: 'advanced' },
  { step: 12, minUnit: 581, maxUnit: 688, label: '고급 (마스터)', tierKey: 'advanced' },
]);

function shuffle(arr) {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/**
 * 언어별 유효 단어 풀 정제 (고유명사 제외)
 * @param {'en'|'es'} lang
 * @returns {Array<object>}
 */
export function getFilteredWordPool(lang = 'en') {
  const source = lang === 'es' ? WORDS_ES : WORDS_EN;
  return source.filter((w) => !isProperNoun(w) && w.meaning && w.meaning.trim().length > 0);
}

/**
 * 총 12문제 계단식 진단 덱 생성 (Unit 1부터 점진적 난이도 상승)
 * @param {'en'|'es'} lang
 * @returns {Array<object>}
 */
export function generatePlacementDeck(lang = 'en') {
  const allWords = getFilteredWordPool(lang);

  const usedIds = new Set();
  const usedSpellings = new Set();
  const pickedWords = [];

  for (let i = 0; i < STEPPED_DIFFICULTY_RANGES.length; i++) {
    const range = STEPPED_DIFFICULTY_RANGES[i];
    const rangeWords = allWords.filter((w) => {
      const uNum = parseInt((w.unit || '').replace(/\D/g, ''), 10) || 1;
      return uNum >= range.minUnit && uNum <= range.maxUnit;
    });

    const pool = shuffle(rangeWords);
    let chosen = null;
    for (const w of pool) {
      const lower = w.word.toLowerCase();
      if (usedIds.has(w.id) || usedSpellings.has(lower)) continue;
      chosen = w;
      break;
    }

    // 예비 안전 보충: 해당 구간 미사용 단어가 없을 경우 전체 풀에서 보충
    if (!chosen) {
      for (const w of shuffle(allWords)) {
        const lower = w.word.toLowerCase();
        if (usedIds.has(w.id) || usedSpellings.has(lower)) continue;
        chosen = w;
        break;
      }
    }

    if (chosen) {
      usedIds.add(chosen.id);
      usedSpellings.add(chosen.word.toLowerCase());
      pickedWords.push({
        wordObj: chosen,
        step: range.step,
        rangeLabel: range.label,
        tierKey: range.tierKey,
        tierName: range.label,
      });
    }
  }

  // 전체 오답 보기 후보군 풀 (동일 언어 뜻만 사용)
  const allMeanings = Array.from(new Set(allWords.map((w) => w.meaning.trim()))).filter((m) => m.length > 0);

  return pickedWords.map((item, index) => {
    const target = item.wordObj;
    const correctMeaning = target.meaning.trim();

    // 동음이의어나 동일 뜻을 배제한 3개 오답 추출
    const distractorCandidates = allMeanings.filter((m) => m !== correctMeaning);
    const shuffledDistractors = shuffle(distractorCandidates).slice(0, 3);
    const choices = shuffle([correctMeaning, ...shuffledDistractors]);

    return {
      id: target.id,
      word: target.word,
      meaning: target.meaning,
      level: target.level,
      pos: target.pos,
      unit: target.unit,
      phonetic: target.phonetic,
      index,
      step: item.step,
      tierKey: item.tierKey,
      tierName: item.tierName,
      wordId: target.id,
      _correctMeaning: correctMeaning, // 내부 채점용 (UI 오답 시 비공개 유지)
      choices,
    };
  });
}

/**
 * 12문제 계단식 진단 결과 및 시작 wordCursor 산출
 * @param {number} correctCount (0 ~ 12)
 * @returns {object}
 */
export function calculateSteppedPlacementResult(correctCount = 0) {
  const c = Math.max(0, Math.min(12, Number(correctCount) || 0));

  let tier;
  let wordCursor;
  let unitOffset;
  let recommendMsg;

  if (c >= 11) {
    tier = WORD_LEVEL_TIERS[5]; // 고급
    wordCursor = 1050; // Unit 151
    unitOffset = 150;
    recommendMsg = '최고 난이도 완주! 뛰어난 실력에 맞춰 고급 마스터 어휘부터 시작합니다!';
  } else if (c >= 9) {
    tier = WORD_LEVEL_TIERS[4]; // 중고급
    wordCursor = 840; // Unit 121
    unitOffset = 120;
    recommendMsg = '실력이 탄탄하시네요! 중고급 심화 어휘로 도약해 보세요!';
  } else if (c >= 7) {
    tier = WORD_LEVEL_TIERS[3]; // 중급
    wordCursor = 630; // Unit 91
    unitOffset = 90;
    recommendMsg = '중급 핵심 어휘를 완벽히 정복할 수 있는 단계입니다!';
  } else if (c >= 5) {
    tier = WORD_LEVEL_TIERS[2]; // 초중급
    wordCursor = 420; // Unit 61
    unitOffset = 60;
    recommendMsg = '기본기가 훌륭합니다! 실전 초중급 어휘부터 시작해 보세요!';
  } else if (c >= 3) {
    tier = WORD_LEVEL_TIERS[1]; // 초급
    wordCursor = 210; // Unit 31
    unitOffset = 30;
    recommendMsg = '기초 단어 복습과 함께 즐겁게 어휘를 확장해 보세요!';
  } else {
    tier = WORD_LEVEL_TIERS[0]; // 왕초보
    wordCursor = 0; // Unit 1
    unitOffset = 0;
    recommendMsg = '가장 기초적인 단어부터 차근차근 시작해 봅시다!';
  }

  return {
    tier,
    tierId: tier.id,
    label: tier.label,
    badgeLabel: tier.badgeLabel,
    cefr: tier.cefr,
    wordCursor,
    unitOffset,
    recommendMsg,
  };
}

/**
 * 하위 호환용 평가 함수
 * @param {number} score
 * @returns {object}
 */
export function evaluatePlacementScore(score) {
  return calculateSteppedPlacementResult(score).tier;
}

