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
    dogName: '우유',
    selectedBreed: 'pomeranian',
    certifiedLevel: 'A1',
    challenge: {
      leagueTier: 'bronze',
      weeklyScore: 0,
      weekKey: '',
      dailyFreeUsedDate: '',
    },
    tutorialCompleted: false,
    gold: 120,
    snacks: 3,
    gems: 300,
    ownedItems: [],
    shopUpgrades: {
      gemMagnet: 0,
      bonusHp: 0,
      bonusWeapon: 0,
    },
    equippedSkin: null,
    evoXp: 0,
    unlockedChapter: 1,
    selectedChapter: 1,
    selectedUnit: 'unit_001',
    selectedCourse: 'lv1',
    dominantHand: 'right',
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
      owned: ['weapon_boomerang'],
      equipped: {
        weapon: 'weapon_boomerang',
        hat: null,
        outfit: null,
        aura: null,
        acc: null,
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
  if (!result.dogName) result.dogName = '우유';
  if (!result.selectedBreed) result.selectedBreed = 'pomeranian';
  if (!result.certifiedLevel) result.certifiedLevel = 'A1';
  if (!result.challenge) {
    result.challenge = {
      leagueTier: 'bronze',
      weeklyScore: 0,
      weekKey: '',
      dailyFreeUsedDate: '',
    };
  } else {
    if (!result.challenge.leagueTier) result.challenge.leagueTier = 'bronze';
    if (typeof result.challenge.weeklyScore !== 'number') result.challenge.weeklyScore = 0;
    if (typeof result.challenge.weekKey !== 'string') result.challenge.weekKey = '';
    if (typeof result.challenge.dailyFreeUsedDate !== 'string') result.challenge.dailyFreeUsedDate = '';
  }
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

    // 기본 무기(나무 뼈다귀 부메랑) 마이그레이션: 없으면 owned에 추가 및 기본 장착
    if (!state.costumes.owned.includes('weapon_boomerang')) {
      state.costumes.owned.unshift('weapon_boomerang');
      persistSave();
    }
    if (!state.costumes.equipped.weapon) {
      state.costumes.equipped.weapon = 'weapon_boomerang';
      persistSave();
    }

    if (!['right', 'left'].includes(state.dominantHand)) {
      state.dominantHand = 'right';
      persistSave();
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

export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'ruby', 'diamond'];

export const RIVAL_PROFILES = [
  { id: 'r1', name: '뽀삐', breed: 'pomeranian', level: 'A2' },
  { id: 'r2', name: '초코', breed: 'retriever', level: 'B1' },
  { id: 'r3', name: '콩이', breed: 'corgi', level: 'A1' },
  { id: 'r4', name: '보리', breed: 'shiba', level: 'B2' },
  { id: 'r5', name: '두부', breed: 'beagle', level: 'A2' },
  { id: 'r6', name: '뭉치', breed: 'pomeranian', level: 'B1' },
  { id: 'r7', name: '별이', breed: 'retriever', level: 'C1' },
  { id: 'r8', name: '호두', breed: 'corgi', level: 'A2' },
  { id: 'r9', name: '루키', breed: 'shiba', level: 'B1' },
  { id: 'r10', name: '코코', breed: 'beagle', level: 'B2' },
  { id: 'r11', name: '망고', breed: 'pomeranian', level: 'A1' },
  { id: 'r12', name: '까미', breed: 'retriever', level: 'A2' },
  { id: 'r13', name: '모찌', breed: 'corgi', level: 'B1' },
  { id: 'r14', name: '몽이', breed: 'shiba', level: 'A1' },
  { id: 'r15', name: '쿠키', breed: 'beagle', level: 'B2' },
  { id: 'r16', name: '나비', breed: 'pomeranian', level: 'A2' },
  { id: 'r17', name: '레오', breed: 'retriever', level: 'B2' },
  { id: 'r18', name: '하루', breed: 'corgi', level: 'C1' },
  { id: 'r19', name: '루루', breed: 'shiba', level: 'B1' },
];

/**
 * 매주 월요일 00:00:00 기준 주차 키 (예: "2026-W-1109")
 */
export function getWeekKey(d = new Date()) {
  const target = new Date(d);
  const day = (target.getDay() + 6) % 7; // 월: 0 ~ 일: 6
  target.setDate(target.getDate() - day);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const date = String(target.getDate()).padStart(2, '0');
  return `${y}-W-${m}${date}`;
}

/**
 * 다음 주 월요일 00:00:00까지 남은 시간
 */
export function getTimeUntilNextWeeklyReset(now = new Date()) {
  const nextMonday = new Date(now);
  const day = (nextMonday.getDay() + 6) % 7;
  const daysUntilMonday = 7 - day;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const diffMs = Math.max(0, nextMonday.getTime() - now.getTime());
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
  const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  return { days, hours, minutes, diffMs };
}

function pseudoHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 특정 티어와 주차 키에 따른 19명 가상 라이벌 점수 생성 (시드 기반)
 */
export function generateRivals(tier, weekKey = getWeekKey()) {
  const TIER_RANGES = {
    bronze: { min: 400, max: 2400 },
    silver: { min: 1400, max: 4200 },
    gold: { min: 2800, max: 6800 },
    ruby: { min: 5000, max: 9800 },
    diamond: { min: 7500, max: 14500 },
  };
  const range = TIER_RANGES[tier] || TIER_RANGES.bronze;

  return RIVAL_PROFILES.map((rival) => {
    const seed = pseudoHash(`${weekKey}_${rival.id}_${tier}`);
    const normalized = (seed % 1000) / 1000;
    const base = range.min + Math.round(normalized * (range.max - range.min));
    const score = Math.max(50, Math.round(base / 10) * 10);
    return {
      ...rival,
      score,
      isPlayer: false,
    };
  });
}

/**
 * 주차 변경 여부 검사 및 주간 20인 리그 정산
 * @param {object} save
 * @returns {object|null} 정산 결과
 */
export function checkAndSettleWeeklyLeague(save) {
  if (!save.challenge) {
    save.challenge = { leagueTier: 'bronze', weeklyScore: 0, weekKey: '', dailyFreeUsedDate: '' };
  }
  const currentWeek = getWeekKey();
  if (!save.challenge.weekKey) {
    save.challenge.weekKey = currentWeek;
    return null;
  }
  if (save.challenge.weekKey === currentWeek) {
    return null;
  }

  const prevTier = save.challenge.leagueTier || 'bronze';
  const myScore = save.challenge.weeklyScore || 0;
  const rivals = generateRivals(prevTier, save.challenge.weekKey);
  const fullLeaderboard = [
    { isPlayer: true, score: myScore },
    ...rivals.map((r) => ({ isPlayer: false, score: r.score })),
  ].sort((a, b) => b.score - a.score);

  const rank = fullLeaderboard.findIndex((item) => item.isPlayer) + 1;
  const curIdx = Math.max(0, LEAGUE_TIERS.indexOf(prevTier));

  let outcome = 'stay';
  let rewardSnacks = 0;
  let newTier = prevTier;

  if (rank <= 5) {
    const nextIdx = Math.min(LEAGUE_TIERS.length - 1, curIdx + 1);
    newTier = LEAGUE_TIERS[nextIdx];
    outcome = nextIdx > curIdx ? 'promoted' : 'stay_top';
    const REWARD_MAP = { bronze: 3, silver: 4, gold: 5, ruby: 7, diamond: 10 };
    rewardSnacks = REWARD_MAP[prevTier] || 3;
    save.snacks = (save.snacks || 0) + rewardSnacks;
  } else if (rank >= 18 && curIdx > 0) {
    newTier = LEAGUE_TIERS[curIdx - 1];
    outcome = 'demoted';
  }

  save.challenge.leagueTier = newTier;
  save.challenge.weeklyScore = 0;
  save.challenge.weekKey = currentWeek;

  return {
    outcome,
    prevTier,
    newTier,
    rank,
    rewardSnacks,
  };
}

