/**
 * js/core/saveStore.js
 * localStorage 안전 로더 (saveVersion: 1), Base64 백업/복원, 3연속 마스터 기록 관리
 */

import { BALANCE } from '../config/balance.js';
import { getTotalUnits } from '../data/data_en.js?v=2';
import { detectDeviceLanguage } from '../data/i18n.js';
import {
  WEAPONS,
  PET_TREATS,
  SUPPLY_BOX_DEFS,
  ATTENDANCE_30_REWARDS,
  QUEST_DEFS,
} from '../data/catalog.js';

export const MAX_SUPPORTERS = 2;
const SAVE_KEY = 'zombie_voca_save_v1';
export const CURRENT_SAVE_VERSION = 1;

export const STUDY_LANGS = Object.freeze(['en', 'es']);
export const STUDY_CEFRS = Object.freeze(['A1', 'A2', 'B1', 'B2']);

function createDefaultLangProgress() {
  return { cefr: 'A1', tier: 1, unitIndex: 0, masteredWords: [] };
}

/**
 * 언어별 학습 진도 정규화 (구버전 세이브 마이그레이션 및 값 범위 보정)
 * @param {object} progress
 * @param {number} totalUnits
 */
function normalizeLangProgress(progress, totalUnits) {
  const base = createDefaultLangProgress();
  const src = progress && typeof progress === 'object' ? progress : {};
  const cefr = STUDY_CEFRS.includes(src.cefr) ? src.cefr : base.cefr;
  const tier = [1, 2, 3].includes(src.tier) ? src.tier : base.tier;
  const rawIdx = Number.isInteger(src.unitIndex) ? src.unitIndex : base.unitIndex;
  const unitIndex = Math.min(Math.max(0, rawIdx), Math.max(0, totalUnits - 1));
  const masteredWords = Array.isArray(src.masteredWords) ? [...src.masteredWords] : [];
  return { cefr, tier, unitIndex, masteredWords };
}

function createDefaultSave() {
  const detected = detectDeviceLanguage();
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    language: detected,
    lang: detected,
    langConfirmed: true,
    dogName: detected === 'es' ? 'Leche' : detected === 'en' ? 'Milk' : '우유',
    selectedBreed: 'pomeranian',
    unlockedBreeds: ['pomeranian'],
    affection: {
      pomeranian: { level: 1, xp: 0 },
    },
    certifiedLevel: 'A1',
    challenge: {
      leagueTier: 'bronze',
      weeklyScore: 0,
      weekKey: '',
      dailyFreeUsedDate: '',
    },
    tutorialCompleted: false,
    tutorialDone: false,
    onboardingCompleted: false,
    onboardingStep: 0,
    gold: 30,
    snacks: 0,
    gems: 0,
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
    maxUnlockedUnit: 1,
    selectedCourse: 'lv1',
    langSelected: false,
    studyLang: 'en',
    courseOnboardingDone: false,
    courseProgress: {
      en: createDefaultLangProgress(),
      es: createDefaultLangProgress(),
    },
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
    attendance30: {
      lastClaimDate: '',
      claimedDays: [],
    },
    gachaPity: {
      heroCount: 0,
    },
    quests: {
      daily: {
        date: '',
        progress: {
          kills: 0,
          wordsCorrect: 0,
          petCount: 0,
          poopCount: 0,
          battles: 0,
        },
        claimed: [],
      },
      weekly: {
        weekKey: '',
        progress: {
          kills: 0,
          wordsCorrect: 0,
          bossKills: 0,
          questsCompleted: 0,
        },
        claimed: [],
      },
      achievements: {
        progress: {
          stageReached: 1,
          totalKills: 0,
          totalWords: 0,
          totalBossKills: 0,
          maxAffection: 1,
          ownedWeapons: 1,
        },
        claimed: [],
      },
    },
    lastFreeSupplyDate: '',
    dailyAirDropDate: '',
    petDate: '',
    petDailyCount: 0,
    audio: {
      bgmEnabled: true,
      sfxEnabled: true,
      bgmVolume: 0.42,
    },
    haptic: true,
    lowFx: false,
  };
}

/**
 * 저장된 객체에 누락된 기본 키가 있을 경우 안전하게 병합
 * @param {object} defaults
 * @param {object} saved
 * @param {boolean} [isRoot=true] 최상위 루트 객체 여부
 * @returns {object}
 */
function mergeWithDefaults(defaults, saved, isRoot = true) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return structuredClone(defaults);
  }
  // defaults가 빈 객체({})인 경우(wordStats, companions.levels 등 동적 딕셔너리) saved 데이터 전체 보존
  if (Object.keys(defaults).length === 0) {
    return structuredClone(saved);
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
      if (Object.keys(defVal).length === 0) {
        // wordStats, companions.levels 등 동적 맵인 경우 saved 데이터 유실 없이 보존
        result[key] = typeof savVal === 'object' && !Array.isArray(savVal)
          ? structuredClone(savVal)
          : structuredClone(defVal);
      } else {
        result[key] = mergeWithDefaults(defVal, savVal, false);
      }
    } else if (Array.isArray(defVal)) {
      result[key] = Array.isArray(savVal) ? [...savVal] : [...defVal];
    } else {
      result[key] = savVal;
    }
  }

  // 최상위 루트 객체가 아닌 하위 프로퍼티(training, challenge 등)는 루트 전용 정산 로직을 건너뜀
  if (!isRoot) {
    return result;
  }

  result.saveVersion = CURRENT_SAVE_VERSION;
  const detected = detectDeviceLanguage();
  const effectiveLang = saved?.language || saved?.lang || detected;
  result.language = effectiveLang;
  result.lang = effectiveLang;
  result.tutorialCompleted = Boolean(saved?.tutorialCompleted || saved?.tutorialDone);
  result.tutorialDone = result.tutorialCompleted;
  result.onboardingCompleted = typeof saved?.onboardingCompleted === 'boolean'
    ? saved.onboardingCompleted
    : Boolean(result.tutorialCompleted);
  result.onboardingStep = typeof saved?.onboardingStep === 'number'
    ? saved.onboardingStep
    : (result.onboardingCompleted ? 5 : 0);
  result.haptic = saved && typeof saved.haptic === 'boolean' ? saved.haptic : true;
  result.lowFx = saved && typeof saved.lowFx === 'boolean' ? saved.lowFx : false;
  if (saved && typeof saved.langConfirmed === 'boolean') {
    result.langConfirmed = saved.langConfirmed;
  } else {
    result.langConfirmed = true;
  }
  if (!result.dogName) result.dogName = effectiveLang === 'es' ? 'Leche' : effectiveLang === 'en' ? 'Milk' : '우유';
  if (!result.selectedBreed) result.selectedBreed = 'pomeranian';
  if (!Array.isArray(result.unlockedBreeds) || result.unlockedBreeds.length === 0) {
    result.unlockedBreeds = ['pomeranian'];
  }
  if (!result.affection || typeof result.affection !== 'object') {
    result.affection = { pomeranian: { level: 1, xp: 0 } };
  }
  if (!result.certifiedLevel) result.certifiedLevel = 'A1';
  if (typeof result.lastFreeSupplyDate !== 'string') result.lastFreeSupplyDate = '';
  if (typeof result.dailyAirDropDate !== 'string') result.dailyAirDropDate = '';
  if (typeof result.petDate !== 'string') result.petDate = '';
  if (typeof result.petDailyCount !== 'number') result.petDailyCount = 0;
  const totalUnits = getTotalUnits();
  const rawSelUnitNum = parseInt((result.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
  const selUnitNum = Math.min(Math.max(1, rawSelUnitNum), totalUnits);
  result.selectedUnit = `unit_${String(selUnitNum).padStart(3, '0')}`;
  if (typeof result.maxUnlockedUnit !== 'number' || result.maxUnlockedUnit < 1) {
    result.maxUnlockedUnit = Math.max(1, selUnitNum);
  } else {
    result.maxUnlockedUnit = Math.min(Math.max(result.maxUnlockedUnit, selUnitNum), totalUnits);
  }
  if (!STUDY_LANGS.includes(result.studyLang)) result.studyLang = 'en';
  result.langSelected = typeof saved?.langSelected === 'boolean'
    ? saved.langSelected
    : Boolean(result.tutorialCompleted);
  result.courseOnboardingDone = Boolean(result.courseOnboardingDone);
  if (!result.courseProgress || typeof result.courseProgress !== 'object') result.courseProgress = {};
  for (const lang of STUDY_LANGS) {
    result.courseProgress[lang] = normalizeLangProgress(result.courseProgress[lang], totalUnits);
  }
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
        state.tutorialDone = true;
        state.langSelected = true;
        state.onboardingCompleted = true;
        state.onboardingStep = 5;
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

    if (!state.companions || typeof state.companions !== 'object') {
      state.companions = { unlocked: [], active: [], levels: {} };
      persistSave();
    }
    if (!Array.isArray(state.companions.active)) {
      state.companions.active = [];
      persistSave();
    }
    if (state.companions.active.length > MAX_SUPPORTERS) {
      state.companions.active = state.companions.active.slice(0, MAX_SUPPORTERS);
      persistSave();
    }

    if (!['right', 'left'].includes(state.dominantHand)) {
      state.dominantHand = 'right';
      persistSave();
    }

    // 30일 출석부 마이그레이션
    if (!state.attendance30) {
      state.attendance30 = {
        lastClaimDate: state.attendance?.lastClaimDate || '',
        claimedDays: [],
      };
      if (state.attendance?.streakDay) {
        for (let d = 1; d <= Math.min(30, state.attendance.streakDay); d++) {
          state.attendance30.claimedDays.push(d);
        }
      }
      persistSave();
    }

    // 뽑기 천장 카운터 마이그레이션
    if (!state.gachaPity) {
      state.gachaPity = { heroCount: 0 };
      persistSave();
    }

    // 퀘스트 시스템 마이그레이션
    if (!state.quests) {
      state.quests = {
        daily: {
          date: state.dailyMissions?.date || '',
          progress: {
            kills: state.dailyMissions?.progress?.kills || 0,
            wordsCorrect: state.dailyMissions?.progress?.wordsCorrect || 0,
            petCount: 0,
            poopCount: 0,
            battles: state.dailyMissions?.progress?.battles || 0,
          },
          claimed: [],
        },
        weekly: {
          weekKey: '',
          progress: { kills: 0, wordsCorrect: 0, bossKills: 0, questsCompleted: 0 },
          claimed: [],
        },
        achievements: {
          progress: {
            stageReached: state.maxUnlockedUnit || 1,
            totalKills: state.dailyMissions?.progress?.kills || 0,
            totalWords: state.dailyMissions?.progress?.wordsCorrect || 0,
            totalBossKills: 0,
            maxAffection: 1,
            ownedWeapons: state.costumes?.owned?.length || 1,
          },
          claimed: [],
        },
      };
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

const AFFECTION_STAGES = [
  { level: 1, max: 50,  title: '낯선 친구',   hearts: '🐾', desc: '경계심이 많아 뒤로 물러납니다.' },
  { level: 2, max: 120, title: '장난꾸러기', hearts: '💖', desc: '주변에서 꼬리를 흔들며 장난칩니다.' },
  { level: 3, max: 250, title: '단짝 친구',   hearts: '💕', desc: '주인을 든든히 따르며 적극 공격합니다.' },
  { level: 4, max: 500, title: '든든한 수호자', hearts: '💓', desc: '접근하는 적을 밀어내며 주인을 수호합니다.' },
  { level: 5, max: 500, title: '소울메이트',  hearts: '💖✨', desc: '합동 필살기를 함께 발동합니다.' },
];

/**
 * 특정 견종 또는 동료의 친밀도 정보 반환 (1~5단계)
 */
export function getAffection(id, saveState) {
  const s = saveState || getSave();
  const aff = s?.affection?.[id] || { level: 1, xp: 0 };
  const stage = AFFECTION_STAGES[Math.min(4, Math.max(0, aff.level - 1))];
  const prevMax = aff.level > 1 ? AFFECTION_STAGES[aff.level - 2].max : 0;
  const currentLevelXp = aff.level >= 5 ? stage.max : Math.max(0, aff.xp - prevMax);
  const currentLevelTarget = aff.level >= 5 ? stage.max : Math.max(1, stage.max - prevMax);
  const ratio = Math.min(1.0, currentLevelXp / currentLevelTarget);

  return {
    level: aff.level,
    xp: aff.xp,
    levelXp: currentLevelXp,
    targetXp: currentLevelTarget,
    ratio,
    title: stage.title,
    hearts: stage.hearts,
    desc: stage.desc,
  };
}

/**
 * 친밀도 경험치 획득 및 5단계 레벨업 처리
 */
export function addAffection(id, amount) {
  let leveledUp = false;
  let newLevel = 1;

  updateSave((s) => {
    if (!s.affection) s.affection = {};
    if (!s.affection[id]) s.affection[id] = { level: 1, xp: 0 };
    const cur = s.affection[id];
    cur.xp = (cur.xp || 0) + amount;

    while (cur.level < 5 && cur.xp >= AFFECTION_STAGES[cur.level - 1].max) {
      cur.level++;
      leveledUp = true;
    }
    newLevel = cur.level;

    // 업적: 최고 친밀도 갱신
    if (s.quests?.achievements?.progress) {
      s.quests.achievements.progress.maxAffection = Math.max(
        s.quests.achievements.progress.maxAffection || 1,
        newLevel
      );
    }
  });

  return { leveledUp, newLevel };
}

export function getTodayDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 퀘스트 상태 일일/주간 갱신 보장
 */
export function ensureQuestsState(s) {
  const save = s || getSave();
  const today = getTodayDateKey();
  const curWeek = getWeekKey();

  if (!save.quests) {
    save.quests = {
      daily: { date: today, progress: { kills: 0, wordsCorrect: 0, petCount: 0, poopCount: 0, battles: 0 }, claimed: [] },
      weekly: { weekKey: curWeek, progress: { kills: 0, wordsCorrect: 0, bossKills: 0, questsCompleted: 0 }, claimed: [] },
      achievements: { progress: { stageReached: 1, totalKills: 0, totalWords: 0, totalBossKills: 0, maxAffection: 1, ownedWeapons: 1 }, claimed: [] },
    };
  }

  // 일일 퀘스트 날짜 변경 시 리셋
  if (save.quests.daily.date !== today) {
    save.quests.daily.date = today;
    save.quests.daily.progress = { kills: 0, wordsCorrect: 0, petCount: 0, poopCount: 0, battles: 0 };
    save.quests.daily.claimed = [];
  }

  // 주간 퀘스트 주차 변경 시 리셋
  if (save.quests.weekly.weekKey !== curWeek) {
    save.quests.weekly.weekKey = curWeek;
    save.quests.weekly.progress = { kills: 0, wordsCorrect: 0, bossKills: 0, questsCompleted: 0 };
    save.quests.weekly.claimed = [];
  }

  // 레거시 dailyMissions 동기화
  if (!save.dailyMissions) save.dailyMissions = { date: today, progress: {}, claimed: [] };
  if (save.dailyMissions.date !== today) {
    save.dailyMissions.date = today;
    save.dailyMissions.progress = { battles: 0, wordsCorrect: 0, kills: 0, miniReview: 0 };
    save.dailyMissions.claimed = [];
  }
}

/**
 * 퀘스트 진행도 누적 헬퍼
 */
export function recordQuestProgress(key, amount = 1) {
  updateSave((s) => {
    ensureQuestsState(s);

    if (key === 'kills') {
      s.quests.daily.progress.kills = (s.quests.daily.progress.kills || 0) + amount;
      s.quests.weekly.progress.kills = (s.quests.weekly.progress.kills || 0) + amount;
      s.quests.achievements.progress.totalKills = (s.quests.achievements.progress.totalKills || 0) + amount;
      if (s.dailyMissions?.progress) {
        s.dailyMissions.progress.kills = (s.dailyMissions.progress.kills || 0) + amount;
      }
    } else if (key === 'wordsCorrect') {
      s.quests.daily.progress.wordsCorrect = (s.quests.daily.progress.wordsCorrect || 0) + amount;
      s.quests.weekly.progress.wordsCorrect = (s.quests.weekly.progress.wordsCorrect || 0) + amount;
      s.quests.achievements.progress.totalWords = (s.quests.achievements.progress.totalWords || 0) + amount;
      if (s.dailyMissions?.progress) {
        s.dailyMissions.progress.wordsCorrect = (s.dailyMissions.progress.wordsCorrect || 0) + amount;
      }
    } else if (key === 'battles') {
      s.quests.daily.progress.battles = (s.quests.daily.progress.battles || 0) + amount;
      if (s.dailyMissions?.progress) {
        s.dailyMissions.progress.battles = (s.dailyMissions.progress.battles || 0) + amount;
      }
    } else if (key === 'petCount') {
      s.quests.daily.progress.petCount = (s.quests.daily.progress.petCount || 0) + amount;
    } else if (key === 'poopCount') {
      s.quests.daily.progress.poopCount = (s.quests.daily.progress.poopCount || 0) + amount;
    } else if (key === 'bossKills') {
      s.quests.weekly.progress.bossKills = (s.quests.weekly.progress.bossKills || 0) + amount;
      s.quests.achievements.progress.totalBossKills = (s.quests.achievements.progress.totalBossKills || 0) + amount;
    } else if (key === 'stageReached') {
      s.quests.achievements.progress.stageReached = Math.max(s.quests.achievements.progress.stageReached || 1, amount);
    } else if (key === 'maxAffection') {
      s.quests.achievements.progress.maxAffection = Math.max(s.quests.achievements.progress.maxAffection || 1, amount);
    } else if (key === 'ownedWeapons') {
      s.quests.achievements.progress.ownedWeapons = Math.max(s.quests.achievements.progress.ownedWeapons || 1, amount);
    }
  });
}

/**
 * 퀘스트 보상 수령
 */
export function claimQuestReward(tab, questId) {
  const save = getSave();
  ensureQuestsState(save);

  const questList = QUEST_DEFS[tab];
  if (!questList) return { ok: false, error: 'invalid_tab' };
  const def = questList.find((q) => q.id === questId);
  if (!def) return { ok: false, error: 'invalid_quest' };

  const currentProg = save.quests[tab]?.progress?.[def.key] || 0;
  if (currentProg < def.target) return { ok: false, error: 'not_completed' };
  if (save.quests[tab]?.claimed?.includes(questId)) return { ok: false, error: 'already_claimed' };

  let rewardDesc = '';

  updateSave((s) => {
    s.quests[tab].claimed.push(questId);

    if (def.gold) {
      s.gold = (s.gold || 0) + def.gold;
      rewardDesc += `🪙 +${def.gold} `;
    }
    if (def.gems) {
      s.gems = (s.gems || 0) + def.gems;
      rewardDesc += `💎 +${def.gems} `;
    }
    if (def.snacks) {
      s.snacks = (s.snacks || 0) + def.snacks;
      rewardDesc += `🦴 +${def.snacks} `;
    }
    if (def.box) {
      const boxRoll = rollSupplyBox(def.box, false, true);
      rewardDesc += `📦 [${boxRoll?.box?.name || '보급 상자'}] `;
    }

    if (tab === 'daily') {
      s.quests.weekly.progress.questsCompleted = (s.quests.weekly.progress.questsCompleted || 0) + 1;
    }
  });

  return { ok: true, rewardDesc, def };
}

/**
 * 30일 출석부 보상 수령
 */
export function claimAttendance30() {
  const save = getSave();
  const today = getTodayDateKey();
  if (!save.attendance30) {
    save.attendance30 = { lastClaimDate: '', claimedDays: [] };
  }

  if (save.attendance30.lastClaimDate === today) {
    return { ok: false, error: 'already_claimed_today' };
  }

  const nextDay = Math.min(30, (save.attendance30.claimedDays.length || 0) + 1);
  const reward = ATTENDANCE_30_REWARDS.find((r) => r.day === nextDay);
  if (!reward) return { ok: false, error: 'no_reward_found' };

  let rewardSummary = reward.label || '';

  updateSave((s) => {
    if (!s.attendance30) s.attendance30 = { lastClaimDate: '', claimedDays: [] };
    s.attendance30.lastClaimDate = today;
    s.attendance30.claimedDays.push(nextDay);

    // 레거시 출석 동기화
    if (!s.attendance) s.attendance = { lastClaimDate: '', streakDay: 0 };
    s.attendance.lastClaimDate = today;
    s.attendance.streakDay = nextDay;

    if (reward.gold) s.gold = (s.gold || 0) + reward.gold;
    if (reward.gems) s.gems = (s.gems || 0) + reward.gems;
    if (reward.snacks) s.snacks = (s.snacks || 0) + reward.snacks;

    if (reward.treat) {
      const curBreed = s.selectedBreed || 'pomeranian';
      const treatDef = PET_TREATS.find((t) => t.id === reward.treat);
      if (treatDef) addAffection(curBreed, treatDef.xp);
    }

    if (reward.costume) {
      if (!s.costumes) s.costumes = { owned: ['weapon_boomerang'], equipped: {} };
      if (!s.costumes.owned.includes(reward.costume)) s.costumes.owned.push(reward.costume);
    }

    if (reward.weapon) {
      if (!s.costumes) s.costumes = { owned: ['weapon_boomerang'], equipped: {} };
      if (!s.costumes.owned.includes(reward.weapon)) {
        s.costumes.owned.push(reward.weapon);
      } else {
        s.gems = (s.gems || 0) + 100;
        rewardSummary += ' (중복 +100💎)';
      }
    }

    if (reward.box) {
      rollSupplyBox(reward.box, false, true);
    }
  });

  return { ok: true, day: nextDay, reward, rewardSummary };
}

/**
 * 3종 보급 상자 뽑기 (단차 / 10연차 / 일일 무료)
 */
export function rollSupplyBox(boxId, is10x = false, isFree = false) {
  const save = getSave();
  const today = getTodayDateKey();
  const box = SUPPLY_BOX_DEFS.find((b) => b.id === boxId);
  if (!box) return { ok: false, error: 'invalid_box' };

  if (isFree) {
    if (box.id !== 'box_normal') return { ok: false, error: 'not_free_box' };
    if (save.lastFreeSupplyDate === today) return { ok: false, error: 'already_claimed_free' };
  } else {
    const cost = is10x ? (box.cost10x || box.cost * 10) : box.cost;
    if (box.currency === 'gold') {
      if ((save.gold || 0) < cost) return { ok: false, error: 'not_enough_gold' };
    } else if (box.currency === 'gems') {
      if ((save.gems || 0) < cost) return { ok: false, error: 'not_enough_gems' };
    }
  }

  const pullCount = is10x ? 10 : 1;
  const pulls = [];
  let totalBonusGold = 0;
  let totalBonusSnacks = 0;

  updateSave((s) => {
    if (isFree) {
      s.lastFreeSupplyDate = today;
    } else {
      const cost = is10x ? (box.cost10x || box.cost * 10) : box.cost;
      if (box.currency === 'gold') s.gold = Math.max(0, (s.gold || 0) - cost);
      if (box.currency === 'gems') s.gems = Math.max(0, (s.gems || 0) - cost);
    }

    if (!s.gachaPity) s.gachaPity = { heroCount: 0 };
    if (!s.costumes) s.costumes = { owned: ['weapon_boomerang'], equipped: {} };
    if (!s.costumes.owned) s.costumes.owned = ['weapon_boomerang'];

    for (let i = 0; i < pullCount; i++) {
      let rolledRarity = 'common';

      if (box.id === 'box_hero') {
        s.gachaPity.heroCount = (s.gachaPity.heroCount || 0) + 1;
        if (s.gachaPity.heroCount >= (box.pityThreshold || 20)) {
          // 천장 발동! 전설 80% 또는 신화 20%
          rolledRarity = Math.random() < 0.2 ? 'mythic' : 'legend';
          s.gachaPity.heroCount = 0;
        } else {
          const r = Math.random();
          if (r < (box.rates.mythic || 0.05)) rolledRarity = 'mythic';
          else if (r < (box.rates.mythic || 0.05) + (box.rates.legend || 0.20)) rolledRarity = 'legend';
          else if (r < 0.65) rolledRarity = 'epic';
          else rolledRarity = 'rare';
        }
      } else {
        const r = Math.random();
        let cumulative = 0;
        for (const [rarity, rate] of Object.entries(box.rates)) {
          cumulative += rate;
          if (r <= cumulative) {
            rolledRarity = rarity;
            break;
          }
        }
      }

      // 해당 등급의 무기 중 랜덤 1개 선택
      const candidateWeapons = WEAPONS.filter((w) => w.rarity === rolledRarity);
      const weapon = candidateWeapons.length > 0
        ? candidateWeapons[Math.floor(Math.random() * candidateWeapons.length)]
        : WEAPONS[Math.floor(Math.random() * WEAPONS.length)];

      const isNew = !s.costumes.owned.includes(weapon.id);
      let duplicateRefund = null;

      if (isNew) {
        s.costumes.owned.push(weapon.id);
      } else {
        const DUP_REWARD = { common: 100, rare: 250, epic: 500, legend: 1000, mythic: 2500 };
        const goldRefund = DUP_REWARD[weapon.rarity] || 100;
        s.gold = (s.gold || 0) + goldRefund;
        duplicateRefund = { gold: goldRefund };
      }

      const bGold = Math.floor(Math.random() * (box.bonusGold[1] - box.bonusGold[0] + 1)) + box.bonusGold[0];
      const bSnacks = Math.floor(Math.random() * (box.bonusSnacks[1] - box.bonusSnacks[0] + 1)) + box.bonusSnacks[0];
      s.gold = (s.gold || 0) + bGold;
      s.snacks = (s.snacks || 0) + bSnacks;

      totalBonusGold += bGold;
      totalBonusSnacks += bSnacks;

      pulls.push({
        weapon,
        isNew,
        duplicateRefund,
        bonusGold: bGold,
        bonusSnacks: bSnacks,
      });
    }

    if (s.quests?.achievements?.progress) {
      s.quests.achievements.progress.ownedWeapons = s.costumes.owned.length;
    }
  });

  return {
    ok: true,
    box,
    pulls,
    totalBonusGold,
    totalBonusSnacks,
    pityCount: save.gachaPity?.heroCount || 0,
  };
}

export function claimDailyAirDrop(reward = {}) {
  const save = getSave();
  const today = getTodayDateKey();
  if (save.dailyAirDropDate === today) {
    return { ok: false, error: 'already_claimed' };
  }
  const gold = Number(reward.gold) || 0;
  const snacks = Number(reward.snacks) || 0;
  const gems = Number(reward.gems) || 0;

  updateSave((s) => {
    s.dailyAirDropDate = today;
    if (gold > 0) s.gold = (s.gold || 0) + gold;
    if (snacks > 0) s.snacks = (s.snacks || 0) + snacks;
    if (gems > 0) s.gems = (s.gems || 0) + gems;
  });

  return { ok: true, gold, snacks, gems };
}

export function getPetDailyStatus() {
  const save = getSave();
  const today = getTodayDateKey();
  if (save.petDate !== today) {
    return { count: 0, max: 5, remaining: 5, canPet: true };
  }
  const count = Math.min(5, Math.max(0, save.petDailyCount || 0));
  return {
    count,
    max: 5,
    remaining: Math.max(0, 5 - count),
    canPet: count < 5,
  };
}

export function recordPetAction() {
  const save = getSave();
  const today = getTodayDateKey();
  let count = save.petDailyCount || 0;
  if (save.petDate !== today) {
    count = 0;
  }
  if (count >= 5) {
    return { ok: false, error: 'daily_limit_reached', count: 5, remaining: 0, canPet: false };
  }

  const nextCount = count + 1;
  updateSave((s) => {
    s.petDate = today;
    s.petDailyCount = nextCount;
    if (s.quests?.daily?.progress) {
      s.quests.daily.progress.petCount = (s.quests.daily.progress.petCount || 0) + 1;
    }
  });

  return {
    ok: true,
    count: nextCount,
    max: 5,
    remaining: Math.max(0, 5 - nextCount),
    canPet: nextCount < 5,
  };
}



