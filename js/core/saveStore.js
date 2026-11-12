/**
 * js/core/saveStore.js
 * localStorage 안전 로더 (saveVersion: 1), Base64 백업/복원, 3연속 마스터 기록 관리
 */

import { BALANCE } from '../config/balance.js';

const SAVE_KEY = 'zombie_voca_save_v1';
export const CURRENT_SAVE_VERSION = 1;

function createDefaultSave() {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    language: 'ko',
    tutorialCompleted: false,
    gold: 120,
    snacks: 3,
    evoXp: 0,
    unlockedChapter: 1,
    selectedChapter: 1,
    selectedCourse: 'lv1',
    training: {
      atkLevel: 0,
      hpLevel: 0,
      speedLv: 0,
      magnetLv: 0,
      ultChargeLv: 0,
      shieldLv: 0,
    },
    companions: {
      unlocked: [],
      active: [],
      levels: {},
    },
    costumes: {
      owned: [],
      equipped: {
        hat: null,
        outfit: null,
        weapon: null,
        aura: null,
      },
    },
    wordStats: {},
    dailyMissions: {
      date: '',
      progress: {
        battles: 0,
        wordsCorrect: 0,
        kills: 0,
        miniReview: 0,
      },
      claimed: [],
    },
    attendance: {
      lastClaimDate: '',
      streakDay: 0,
    },
    audio: {
      bgmEnabled: true,
      sfxEnabled: true,
      bgmVolume: 0.42,
    },
  };
}

/**
 * 저장된 객체에 누락된 기본 키가 있을 경우 안전하게 병합
 * @param {object} defaults
 * @param {object} saved
 * @returns {object}
 */
function mergeWithDefaults(defaults, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return structuredClone(defaults);
  }
  const result = {};
  for (const key of Object.keys(defaults)) {
    const defVal = defaults[key];
    const savVal = saved[key];

    if (savVal === undefined || savVal === null) {
      result[key] = structuredClone(defVal);
    } else if (
      typeof defVal === 'object' &&
      !Array.isArray(defVal) &&
      defVal !== null
    ) {
      result[key] = mergeWithDefaults(defVal, savVal);
    } else if (Array.isArray(defVal)) {
      result[key] = Array.isArray(savVal) ? [...savVal] : [...defVal];
    } else {
      result[key] = savVal;
    }
  }
  result.saveVersion = CURRENT_SAVE_VERSION;
  return result;
}

let state = null;

/**
 * localStorage에서 세이브 데이터 로드 (손상 시 기본값 폴백)
 * @returns {object}
 */
export function loadSave() {
  const defaults = createDefaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      state = defaults;
      persistSave();
      return state;
    }
    const parsed = JSON.parse(raw);
    state = mergeWithDefaults(defaults, parsed);

    // 기존 세이브 유저(플레이 기록 또는 XP 보유)는 tutorialCompleted = true로 안전 마이그레이션
    if (parsed && parsed.tutorialCompleted === undefined) {
      const hasHistory =
        (state.evoXp || 0) > 0 ||
        (state.unlockedChapter || 1) > 1 ||
        (state.dailyMissions?.progress?.battles || 0) > 0 ||
        Object.keys(state.wordStats || {}).length > 0;
      if (hasHistory) {
        state.tutorialCompleted = true;
        persistSave();
      }
    }
  } catch (err) {
    console.warn('[saveStore] 세이브 로드 실패, 기본값으로 초기화합니다.', err);
    state = defaults;
  }
  return state;
}

/**
 * 현재 메모리 상태를 localStorage에 저장
 */
export function persistSave() {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[saveStore] localStorage 저장 실패:', err);
  }
}

/**
 * 현재 세이브 상태 반환 (미로드 시 자동 로드)
 * @returns {object}
 */
export function getSave() {
  if (!state) return loadSave();
  return state;
}

/**
 * 세이브 상태를 안전하게 변경하고 즉시 저장
 * @param {(draft: object) => void} mutator
 * @returns {object}
 */
export function updateSave(mutator) {
  const current = getSave();
  mutator(current);
  persistSave();
  return current;
}

/**
 * 단어 정답/오답 결과 반영 (3연속 정답 시 Mastered 졸업, 오답 시 streak=0 초기화)
 * @param {number|string} wordId
 * @param {boolean} isCorrect
 * @returns {{ streak: number, prevStreak: number, mastered: boolean, newlyMastered: boolean }}
 */
export function recordWordResult(wordId, isCorrect) {
  const key = String(wordId);
  const current = getSave();
  const prev = current.wordStats[key] || {
    streak: 0,
    wrongCount: 0,
    mastered: false,
    lastSeenAt: 0,
  };

  const prevStreak = prev.streak;
  const wasMastered = prev.mastered;

  let nextStreak = prev.streak;
  let nextWrongCount = prev.wrongCount;
  let nextMastered = prev.mastered;

  if (isCorrect) {
    nextStreak = Math.min(BALANCE.VOCA.MASTERY_STREAK, prev.streak + 1);
    if (nextStreak >= BALANCE.VOCA.MASTERY_STREAK) {
      nextMastered = true;
    }
  } else {
    nextStreak = 0;
    nextMastered = false;
    nextWrongCount += 1;
  }

  current.wordStats[key] = {
    streak: nextStreak,
    wrongCount: nextWrongCount,
    mastered: nextMastered,
    lastSeenAt: Date.now(),
  };

  persistSave();

  return {
    streak: nextStreak,
    prevStreak,
    mastered: nextMastered,
    newlyMastered: !wasMastered && nextMastered,
  };
}

/**
 * 단어별 현재 기록 조회
 * @param {number|string} wordId
 */
export function getWordStat(wordId) {
  const stats = getSave().wordStats;
  return stats[String(wordId)] || { streak: 0, wrongCount: 0, mastered: false, lastSeenAt: 0 };
}

/**
 * UTF-8 안전 Base64 세이브 코드 내보내기
 * @returns {string}
 */
export function exportSaveBase64() {
  const json = JSON.stringify(getSave());
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 세이브 코드 검증 및 복원
 * @param {string} base64Str
 * @returns {{ ok: boolean, error?: string }}
 */
export function importSaveBase64(base64Str) {
  try {
    const clean = String(base64Str || '').trim();
    if (!clean) return { ok: false, error: 'empty' };

    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);

    if (!parsed || typeof parsed !== 'object' || typeof parsed.saveVersion !== 'number') {
      return { ok: false, error: 'invalid_schema' };
    }

    state = mergeWithDefaults(createDefaultSave(), parsed);
    persistSave();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

