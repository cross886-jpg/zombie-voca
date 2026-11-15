/**
 * js/game/placementTest.js
 * 실력 진단(배치 테스트) 전용 모듈:
 * - 10문제 구성: 초급 3문제 → 중급 4문제 → 고급 3문제 순차 난이도 상승
 * - 인명·지명 등 첫 글자 대문자 고유명사 자동 필터링
 * - Set 기반 단어 중복(ID 및 철자) 완전 차단
 * - 오답/모름 제출 시 정답 비공개 원칙 준수
 * - 10점 만점 기준 맞춤 추천 레벨 산출
 */

import { WORDS as WORDS_EN } from '../data/data_en.js?v=2';
import { WORDS as WORDS_ES } from '../data/data_es.js';
import { WORD_LEVEL_TIERS, isProperNoun } from '../core/courseEngine.js';

export { isProperNoun };

export const PLACEMENT_CONFIG = Object.freeze({
  TOTAL_QUESTIONS: 10,
  BEGINNER_COUNT: 3,
  INTERMEDIATE_COUNT: 4,
  ADVANCED_COUNT: 3,
});

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
 * 총 10문제 진단 덱 생성
 * - 특정 레벨(selectedTier) 응시 시: 해당 레벨 난이도 범위 10문제 집중 출제
 * - 빠른 실력 테스트(미선택) 시: 초급 3문제 → 중급 4문제 → 고급 3문제 순차 출제
 * @param {'en'|'es'} lang
 * @param {object|null} selectedTier
 * @returns {Array<object>}
 */
export function generatePlacementDeck(lang = 'en', selectedTier = null) {
  const allWords = getFilteredWordPool(lang);

  const usedIds = new Set();
  const usedSpellings = new Set();
  const pickedWords = [];

  if (selectedTier) {
    const tierOffset = Number(selectedTier.unitOffset) || 0;
    // 1차: 해당 티어의 유닛 범위 (unitOffset ~ unitOffset + 80)
    let tierWords = allWords.filter((w) => {
      const uNum = parseInt((w.unit || '').replace(/\D/g, ''), 10) || 1;
      return uNum > tierOffset && uNum <= tierOffset + 80;
    });
    // 보조: 유닛 범위 단어가 부족할 경우 CEFR 등급 일치 단어로 확장
    if (tierWords.length < PLACEMENT_CONFIG.TOTAL_QUESTIONS) {
      const cefrWords = allWords.filter((w) => w.level === selectedTier.cefr || (selectedTier.groupCefr && selectedTier.groupCefr.includes(w.level)));
      tierWords = [...tierWords, ...cefrWords];
    }
    const pool = shuffle(tierWords);
    for (const w of pool) {
      if (pickedWords.length >= PLACEMENT_CONFIG.TOTAL_QUESTIONS) break;
      const lower = w.word.toLowerCase();
      if (usedIds.has(w.id) || usedSpellings.has(lower)) continue;
      usedIds.add(w.id);
      usedSpellings.add(lower);
      pickedWords.push({
        wordObj: w,
        tierKey: selectedTier.id || 'tier',
        tierName: selectedTier.badgeLabel || selectedTier.label || '선택 레벨',
      });
    }
    // 안전 보충: 전체 풀에서 중복 없이 보충
    if (pickedWords.length < PLACEMENT_CONFIG.TOTAL_QUESTIONS) {
      for (const w of shuffle(allWords)) {
        if (pickedWords.length >= PLACEMENT_CONFIG.TOTAL_QUESTIONS) break;
        const lower = w.word.toLowerCase();
        if (usedIds.has(w.id) || usedSpellings.has(lower)) continue;
        usedIds.add(w.id);
        usedSpellings.add(lower);
        pickedWords.push({
          wordObj: w,
          tierKey: selectedTier.id || 'tier',
          tierName: selectedTier.badgeLabel || selectedTier.label || '선택 레벨',
        });
      }
    }
  } else {
    const beginnerPool = shuffle(allWords.filter((w) => w.level === 'A1'));
    const intermediatePool = shuffle(allWords.filter((w) => w.level === 'A2' || w.level === 'B1'));
    const advancedPool = shuffle(allWords.filter((w) => w.level === 'B2' || w.level === 'C1'));

    function pickFromPool(pool, count, tierKey, tierName) {
      let picked = 0;
      for (const w of pool) {
        if (picked >= count) break;
        const lower = w.word.toLowerCase();
        if (usedIds.has(w.id) || usedSpellings.has(lower)) continue;

        usedIds.add(w.id);
        usedSpellings.add(lower);
        pickedWords.push({
          wordObj: w,
          tierKey,
          tierName,
        });
        picked++;
      }
    }

    // 1) 초급 3문제
    pickFromPool(beginnerPool, PLACEMENT_CONFIG.BEGINNER_COUNT, 'beginner', '초급');
    // 2) 중급 4문제
    pickFromPool(intermediatePool, PLACEMENT_CONFIG.INTERMEDIATE_COUNT, 'intermediate', '중급');
    // 3) 고급 3문제
    pickFromPool(advancedPool, PLACEMENT_CONFIG.ADVANCED_COUNT, 'advanced', '고급');
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
      tierKey: item.tierKey,
      tierName: item.tierName,
      wordId: target.id,
      _correctMeaning: correctMeaning, // 내부 채점용 (UI 오답 시 비공개 유지)
      choices,
    };
  });
}

/**
 * 10문제 진단 점수 기반 추천 레벨 산출
 * @param {number} score (0 ~ 10)
 * @returns {object}
 */
export function evaluatePlacementScore(score) {
  const s = Math.max(0, Math.min(10, Number(score) || 0));

  if (s >= 10) {
    return WORD_LEVEL_TIERS.find((t) => t.id === 'advanced_lv1') || WORD_LEVEL_TIERS[6];
  }
  if (s >= 8) {
    return WORD_LEVEL_TIERS.find((t) => t.id === 'intermediate_lv2') || WORD_LEVEL_TIERS[4];
  }
  if (s >= 6) {
    return WORD_LEVEL_TIERS.find((t) => t.id === 'intermediate_lv1') || WORD_LEVEL_TIERS[3];
  }
  if (s === 5) {
    return WORD_LEVEL_TIERS.find((t) => t.id === 'beginner_lv3') || WORD_LEVEL_TIERS[2];
  }
  if (s >= 3) {
    return WORD_LEVEL_TIERS.find((t) => t.id === 'beginner_lv2') || WORD_LEVEL_TIERS[1];
  }
  return WORD_LEVEL_TIERS[0]; // 0 ~ 2: 초급 Lv.1
}

