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
 * 총 10문제 진단 덱 생성 (초급 3문제 → 중급 4문제 → 고급 3문제)
 * @param {'en'|'es'} lang
 * @returns {Array<object>}
 */
export function generatePlacementDeck(lang = 'en') {
  const allWords = getFilteredWordPool(lang);

  const beginnerPool = shuffle(allWords.filter((w) => w.level === 'A1'));
  const intermediatePool = shuffle(allWords.filter((w) => w.level === 'A2' || w.level === 'B1'));
  const advancedPool = shuffle(allWords.filter((w) => w.level === 'B2' || w.level === 'C1'));

  const usedIds = new Set();
  const usedSpellings = new Set();
  const pickedWords = [];

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

  // 전체 오답 보기 후보군 풀
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

/**
 * 실력 진단 세션 생성자
 * @param {'en'|'es'} [lang='en']
 */
export function createPlacementSession(lang = 'en') {
  const deck = generatePlacementDeck(lang);
  let currentIndex = 0;
  let score = 0;
  const history = [];

  return {
    get totalQuestions() {
      return deck.length;
    },
    get currentIndex() {
      return currentIndex;
    },
    get score() {
      return score;
    },
    isFinished() {
      return currentIndex >= deck.length;
    },
    getCurrentQuestion() {
      if (currentIndex >= deck.length) return null;
      const q = deck[currentIndex];
      return {
        index: q.index,
        tierKey: q.tierKey,
        tierName: q.tierName,
        word: q.word,
        choices: [...q.choices],
      };
    },
    /**
     * 답변 제출 처리 (정답 여부만 반환하고 정답 텍스트는 일체 비공개)
     * @param {string|null} selectedChoice (선택한 뜻 문자열 또는 '잘 모르겠어요' 시 null)
     * @returns {{ isCorrect: boolean, isFinished: boolean, currentIndex: number }}
     */
    submitAnswer(selectedChoice) {
      if (currentIndex >= deck.length) {
        return { isCorrect: false, isFinished: true, currentIndex };
      }
      const q = deck[currentIndex];
      const isCorrect = Boolean(selectedChoice && selectedChoice.trim() === q._correctMeaning);

      if (isCorrect) {
        score++;
      }
      history.push({
        questionIndex: currentIndex,
        word: q.word,
        isCorrect,
      });

      currentIndex++;
      const finished = currentIndex >= deck.length;
      return {
        isCorrect,
        isFinished: finished,
        currentIndex,
      };
    },
    getResult() {
      const recommendedTier = evaluatePlacementScore(score);
      return {
        score,
        totalQuestions: deck.length,
        recommendedTier,
        recommendMsg: recommendedTier.recommendMsg,
        history,
      };
    },
  };
}
