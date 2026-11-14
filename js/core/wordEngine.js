/**
 * js/core/wordEngine.js
 * 코스별 단어 필터링, 30문제 고정덱(신규 20 + 복습 10), 동음이의어 제외 오답 3개 추출
 */

import { BALANCE } from '../config/balance.js';
import { getActiveWords as getWords, getActiveTotalUnits as getTotalUnits, getActiveCefrWords, getCurrentStudyUnitId, getEffectiveStudyUnitId } from './courseEngine.js';
import { getSave, getWordStat, recordWordResult } from './saveStore.js';

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * rawMeaning을 개별 의미 토큰 집합으로 분해 (동음이의어·복수 뜻 겹침 방지용)
 * @param {string} rawMeaning
 * @returns {Set<string>}
 */
function extractMeaningTokens(rawMeaning) {
  const clean = String(rawMeaning || '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase();
  const tokens = clean
    .split(/[,;/·\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/**
 * 두 단어의 뜻(rawMeaning 또는 정제 meaning)이 의미상 겹치는지 확인
 */
function hasMeaningOverlap(wordA, wordB) {
  if (!wordA || !wordB) return false;
  if (wordA.meaning === wordB.meaning) return true;
  if (wordA.rawMeaning === wordB.rawMeaning) return true;

  const tokensA = extractMeaningTokens(wordA.rawMeaning);
  const tokensB = extractMeaningTokens(wordB.rawMeaning);
  for (const tok of tokensA) {
    if (tokensB.has(tok)) return true;
  }
  return false;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function getAdjacentLevels(level) {
  const idx = CEFR_LEVELS.indexOf(level);
  if (idx === -1) return [];
  const adjacent = [];
  if (idx > 0) adjacent.push(CEFR_LEVELS[idx - 1]);
  if (idx < CEFR_LEVELS.length - 1) adjacent.push(CEFR_LEVELS[idx + 1]);
  return adjacent;
}

export const wordEngine = {
  /**
   * 선택된 유닛(예: 'unit_001')에 속한 단어 풀 반환
   * @param {string} [unitId]
   * @returns {Array<object>}
   */
  getUnitWords(unitId) {
    const id = unitId || getEffectiveStudyUnitId();
    const all = getWords();
    const filtered = all.filter((w) => w.unit === id);
    return filtered.length > 0 ? filtered : this.getCourseWords();
  },

  /**
   * 현재 학습 언어·CEFR 등급(3티어 전체 유닛)에 해당하는 단어 풀 반환
   * @returns {Array<object>}
   */
  getCourseWords() {
    const cefrWords = getActiveCefrWords();
    return cefrWords.length > 0 ? cefrWords : getWords();
  },

  /**
   * 30문제 집중 반복 덱 구성:
   * 현재 선택된 유닛(예: Unit 1)의 단어 배열에서만 목표 단어를 선별하여
   * 타 유닛이나 타 레벨 단어가 섞이지 않도록 엄격히 고정
   * @param {string|object} [options]
   * @returns {Array<object>}
   */
  buildBattleDeck(options) {
    let pool = [];
    if (typeof options === 'string') {
      const targetUnit = options.startsWith('unit_') ? getEffectiveStudyUnitId(options) : options;
      pool = options.startsWith('unit_') ? this.getUnitWords(targetUnit) : this.getCourseWords(options);
    } else if (options && typeof options === 'object') {
      if (options.unitId) {
        const targetUnit = getEffectiveStudyUnitId(options.unitId);
        pool = this.getUnitWords(targetUnit);
      } else if (options.courseId) {
        pool = this.getCourseWords(options.courseId);
      }
    }
    if (!pool || !pool.length) {
      pool = this.getUnitWords(getEffectiveStudyUnitId());
    }
    if (!pool.length) return [];

    const save = getSave();
    const stats = save.wordStats || {};

    const reviewCandidates = [];
    const unseenCandidates = [];
    const masteredCandidates = [];

    for (const w of pool) {
      const st = stats[String(w.id)];
      if (!st) {
        unseenCandidates.push(w);
      } else if (st.mastered) {
        masteredCandidates.push(w);
      } else {
        reviewCandidates.push({ word: w, wrongCount: st.wrongCount || 0, streak: st.streak || 0 });
      }
    }

    // 오답 횟수가 많고 streak이 낮은 단어를 복습 우선 배치
    reviewCandidates.sort((a, b) => b.wrongCount - a.wrongCount || a.streak - b.streak);
    const orderedCandidates = [
      ...reviewCandidates.map((item) => item.word),
      ...shuffleArray(unseenCandidates),
      ...shuffleArray(masteredCandidates),
    ];

    const TARGET_WORD_COUNT = BALANCE.VOCA?.WORDS_PER_UNIT || 7;
    const targetWords = orderedCandidates.slice(0, Math.min(TARGET_WORD_COUNT, orderedCandidates.length));
    const deck = [];

    while (deck.length < BALANCE.VOCA.DECK_SIZE) {
      const round = shuffleArray(targetWords);
      // 라운드 경계에서 직전 단어와 동일 단어가 연속되지 않도록 조정
      if (deck.length > 0 && round.length > 1 && round[0].id === deck[deck.length - 1].id) {
        const swapIdx = round.findIndex((w) => w.id !== deck[deck.length - 1].id);
        if (swapIdx > 0) {
          [round[0], round[swapIdx]] = [round[swapIdx], round[0]];
        }
      }
      for (const word of round) {
        if (deck.length >= BALANCE.VOCA.DECK_SIZE) break;
        deck.push(word);
      }
    }

    return deck;
  },

  /**
   * 언어 등급 승급전 전용 20문제 덱
   * @param {string} targetLevel (예: 'A2', 'B1')
   * @returns {Array<object>}
   */
  buildPromotionDeck(targetLevel) {
    const all = getWords();
    const levelWords = all.filter((w) => w.level === targetLevel);
    const pool = levelWords.length >= 20 ? levelWords : (levelWords.length > 0 ? levelWords : all);
    const shuffled = shuffleArray(pool);
    const deck = [];
    while (deck.length < 20) {
      for (const w of shuffled) {
        if (deck.length >= 20) break;
        deck.push(w);
      }
    }
    return deck;
  },

  /**
   * 월반 전투 도전용 10문제 덱 (목표 유닛 및 직전 유닛들의 핵심 단어 10개)
   * @param {number} targetUnitNum
   * @returns {Array<object>}
   */
  buildPlacementDeck(targetUnitNum) {
    const all = getWords();
    const tot = typeof getTotalUnits === 'function' ? getTotalUnits() : 714;
    const safeTarget = Math.min(Math.max(1, targetUnitNum || 1), tot);
    const targetUnitId = `unit_${String(safeTarget).padStart(3, '0')}`;
    let candidateWords = all.filter((w) => w.unit === targetUnitId);

    for (let u = safeTarget - 1; u >= 1 && candidateWords.length < 15; u--) {
      const prevId = `unit_${String(u).padStart(3, '0')}`;
      const prevWords = all.filter((w) => w.unit === prevId);
      candidateWords = candidateWords.concat(prevWords);
    }

    if (candidateWords.length < 10) {
      candidateWords = all.slice();
    }

    const shuffled = shuffleArray(candidateWords);
    return shuffled.slice(0, 10);
  },

  /**
   * 튜토리얼용 3문제 초급 미니 덱
   * @returns {Array<object>}
   */
  buildTutorialDeck() {
    const a1Words = getWords().filter((w) => w.level === 'A1');
    const source = a1Words.length >= 10 ? a1Words : getWords();
    return source.slice(0, BALANCE.TUTORIAL.QUESTION_COUNT);
  },

  /**
   * 정답 1개 + 현재 정답 단어와 동일한 CEFR 레벨(A1이면 A1만) 내 동음이의어 제외 오답 3개 생성
   * @param {object} targetWord
   * @returns {Array<{ wordId: number, meaning: string, isCorrect: boolean }>}
   */
  createQuestionChoices(targetWord) {
    const allWords = getWords();
    const targetLevel = targetWord.level || 'A1';

    // 1차: 현재 정답 단어와 동일한 CEFR 레벨 풀만 엄격 사용
    const sameLevelWords = allWords.filter((w) => w.id !== targetWord.id && w.level === targetLevel);
    const sameLevelSamePos = shuffleArray(sameLevelWords.filter((w) => w.pos === targetWord.pos));
    const sameLevelOthers = shuffleArray(sameLevelWords.filter((w) => w.pos !== targetWord.pos));
    let candidates = [...sameLevelSamePos, ...sameLevelOthers];

    // 동일 레벨 단어가 극단적으로 부족한 예외 상황(5개 미만)에만 인접 레벨 보조 풀 사용
    if (candidates.length < 5) {
      const adjLevels = getAdjacentLevels(targetLevel);
      const adjWords = shuffleArray(allWords.filter((w) => w.id !== targetWord.id && adjLevels.includes(w.level)));
      candidates = [...candidates, ...adjWords];
    }

    const selectedDistractors = [];
    for (const cand of candidates) {
      if (selectedDistractors.length >= 3) break;
      if (cand.word.toLowerCase() === targetWord.word.toLowerCase()) continue;
      if (hasMeaningOverlap(targetWord, cand)) continue;
      if (selectedDistractors.some((picked) => hasMeaningOverlap(picked, cand))) continue;

      selectedDistractors.push(cand);
    }

    const choices = [
      { wordId: targetWord.id, meaning: targetWord.meaning, isCorrect: true },
      ...selectedDistractors.map((d) => ({
        wordId: d.id,
        meaning: d.meaning,
        isCorrect: false,
      })),
    ];

    return shuffleArray(choices);
  },

  /**
   * 정답/오답 제출 및 3연속 마스터 판정 위임
   * @param {number|string} wordId
   * @param {boolean} isCorrect
   */
  submitAnswer(wordId, isCorrect) {
    return recordWordResult(wordId, isCorrect);
  },

  /**
   * 기억 수첩용 통계 및 복습 대기 단어 목록 반환
   */
  getWordbookSummary() {
    const allWords = getWords();
    const stats = getSave().wordStats || {};
    let masteredCount = 0;
    const reviewQueue = [];

    for (const w of allWords) {
      const st = stats[String(w.id)];
      if (!st) continue;
      if (st.mastered) {
        masteredCount++;
      } else if (st.wrongCount > 0 || st.streak > 0) {
        reviewQueue.push({ ...w, stat: st });
      }
    }

    reviewQueue.sort((a, b) => b.stat.wrongCount - a.stat.wrongCount || a.stat.streak - b.stat.streak);

    const totalCount = allWords.length || 1;
    const masteryPercent = Math.round((masteredCount / totalCount) * 1000) / 10;

    return {
      totalCount: allWords.length,
      masteredCount,
      masteryPercent,
      reviewQueue,
    };
  },

  getWordStreak(wordId) {
    return getWordStat(wordId).streak;
  },
};

