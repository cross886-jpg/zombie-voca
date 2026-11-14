/**
 * js/core/saveDefaults.js
 * 세이브 스토리지 키 상수, 기본 세이브 스키마, 티어/언어 상수 및 데이터 정규화 유틸리티
 */

import { getTotalUnits } from '../data/data_en.js?v=2';
import { detectDeviceLanguage } from '../data/i18n.js';

export const MAX_SUPPORTERS = 2;
export const SAVE_KEY = 'zombie_voca_save_v1';
export const CURRENT_SAVE_VERSION = 1;

export const STUDY_LANGS = Object.freeze(['en', 'es']);
export const STUDY_CEFRS = Object.freeze(['A1', 'A2', 'B1', 'B2']);

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

export function createDefaultLangProgress() {
  return { cefr: 'A1', tier: 1, unitIndex: 0, masteredWords: [] };
}

/**
 * 언어별 학습 진도 정규화 (구버전 세이브 마이그레이션 및 값 범위 보정)
 * @param {object} progress
 * @param {number} totalUnits
 */
export function normalizeLangProgress(progress, totalUnits) {
  const base = createDefaultLangProgress();
  const src = progress && typeof progress === 'object' ? progress : {};
  const cefr = STUDY_CEFRS.includes(src.cefr) ? src.cefr : base.cefr;
  const tier = [1, 2, 3].includes(src.tier) ? src.tier : base.tier;
  const rawIdx = Number.isInteger(src.unitIndex) ? src.unitIndex : base.unitIndex;
  const unitIndex = Math.min(Math.max(0, rawIdx), Math.max(0, totalUnits - 1));
  const masteredWords = Array.isArray(src.masteredWords) ? [...src.masteredWords] : [];
  return { cefr, tier, unitIndex, masteredWords };
}

export function createDefaultSave() {
  const detected = detectDeviceLanguage();
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    language: detected,
    lang: detected,
    langConfirmed: true,
    dogName: detected === 'es' ? 'Leche' : detected === 'en' ? 'Milk' : '우유',
    selectedBreed: 'pomeranian',
    profileAvatarBreedId: 'pomeranian',
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
    gold: 35,
    keys: 1,
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
    hasSelectedWordLevel: false,
    selectedLevelLabel: '초급 Lv.1',
    wordLevelTier: 'beginner_lv1',
    wordUnitOffset: 0,
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

export const DEFAULT_SAVE = Object.freeze(createDefaultSave());

/**
 * 저장된 객체에 누락된 기본 키가 있을 경우 안전하게 병합
 * @param {object} defaults
 * @param {object} saved
 * @param {boolean} [isRoot=true] 최상위 루트 객체 여부
 * @returns {object}
 */
export function mergeWithDefaults(defaults, saved, isRoot = true) {
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
  if (!result.profileAvatarBreedId) result.profileAvatarBreedId = result.selectedBreed || 'pomeranian';
  result.keys = typeof saved?.keys === 'number' ? saved.keys : 1;
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
