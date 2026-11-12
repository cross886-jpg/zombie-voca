/**
 * js/core/wordEngine.js
 * 코스별 단어 필터링, 30문제 고정덱(신규 20 + 복습 10), 동음이의어 제외 오답 3개 추출
 */

import { BALANCE } from '../config/balance.js';
import { getWords } from '../data/data_en.js?v=2';
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

export const wordEngine = {
  /**
   * 선택된 난이도 코스(lv1~lv4)에 해당하는 단어 풀 반환
   * @param {string} [courseId]
   * @returns {Array<object>}
   */
  getCourseWords(courseId) {
    const id = courseId || getSave().selectedCourse || 'lv1';
    const course = BALANCE.COURSES.find((c) => c.id === id) || BALANCE.COURSES[0];
    const allowedLevels = new Set(course.cefr);
    const all = getWords();
    const filtered = all.filter((w) => allowedLevels.has(w.level));
    return filtered.length > 0 ? filtered : all;
  },

  /**
   * 30문제 집중 반복 덱 구성:
   * 코스 단어 풀에서 핵심 목표 단어 8개를 선별(복습 우선 + 신규 + 마스터 보충)하고
   * 30문제 큐에 고르게 반복 배치(직전 문제와 동일 단어 연속 출제 방지)
   * @param {string} [courseId]
   * @returns {Array<object>}
   */
  buildBattleDeck(courseId) {
    const pool = this.getCourseWords(courseId);
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

    const TARGET_WORD_COUNT = 8;
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
   * 튜토리얼용 3문제 초급 미니 덱
   * @returns {Array<object>}
   */
  buildTutorialDeck() {
    const a1Words = getWords().filter((w) => w.level === 'A1');
    const source = a1Words.length >= 10 ? a1Words : getWords();
    return source.slice(0, BALANCE.TUTORIAL.QUESTION_COUNT);
  },

  /**
   * 정답 1개 + 동음이의어/중복 뜻이 완전히 제외된 오답 3개 생성
   * @param {object} targetWord
   * @returns {Array<{ wordId: number, meaning: string, isCorrect: boolean }>}
   */
  createQuestionChoices(targetWord) {
    const allWords = getWords();
    // 같은 품사 우선 후보군 + 전체 풀 폴백
    const samePos = shuffleArray(allWords.filter((w) => w.pos === targetWord.pos && w.id !== targetWord.id));
    const others = shuffleArray(allWords.filter((w) => w.pos !== targetWord.pos && w.id !== targetWord.id));
    const candidates = [...samePos, ...others];

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

