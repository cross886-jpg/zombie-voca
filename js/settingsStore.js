/**
 * js/settingsStore.js
 * Zombie Voca 세이브 스토리지 v2 이원화 매니저
 * - 공용 계정 지갑 (zombieVoca_account_v2): 보석, 결제 상태, 공용 해금 항목, 언어 및 사운드 설정
 * - 언어별 독립 프로필 (zombieVoca_profile_en_v2 / zombieVoca_profile_es_v2): 골드, 스테이지, 장비, 케어, 단어 큐
 * - 구버전 세이브 자동 마이그레이션 (Zero Data Loss) 및 100% 하위 호환성 (Proxy 평면 접근)
 */

export const ACCOUNT_STORAGE_KEY = 'zombieVoca_account_v2';
export const PROFILE_STORAGE_KEY_PREFIX = 'zombieVoca_profile_';
export const PROFILE_STORAGE_KEY_SUFFIX = '_v2';
export const LEGACY_STORAGE_KEYS = Object.freeze([
  'zombie_voca_save_v1',
  'zombieVoca_save',
  'vocadash_save',
]);

const ACCOUNT_FIELDS = new Set([
  'gems',
  'adFree',
  'unlockedPaidBreeds',
  'unlockedPaidCostumes',
  'activeLanguage',
  'soundEnabled',
  'ttsEnabled',
  'hapticEnabled',
  'bgmVolume',
  'sfxVolume',
  'ttsVolume',
  'bgmMuted',
  'sfxMuted',
  'ttsMuted',
]);

const _memoryStorage = new Map();

function safeGetItem(key) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      const val = localStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    }
  } catch (err) {
    console.warn(`[settingsStore] localStorage.getItem('${key}') failed:`, err);
  }
  return _memoryStorage.get(key) || null;
}

function safeSetItem(key, val) {
  const strVal = String(val);
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      localStorage.setItem(key, strVal);
    }
  } catch (err) {
    console.warn(`[settingsStore] localStorage.setItem('${key}') failed:`, err);
  }
  _memoryStorage.set(key, strVal);
}

function getProfileKey(lang) {
  const safeLang = lang === 'en' ? 'en' : 'es';
  return `${PROFILE_STORAGE_KEY_PREFIX}${safeLang}${PROFILE_STORAGE_KEY_SUFFIX}`;
}

/**
 * 기본 공용 계정 데이터 생성
 */
export function createDefaultAccount() {
  return {
    gems: 0,
    adFree: false,
    unlockedPaidBreeds: [],
    unlockedPaidCostumes: [],
    activeLanguage: 'es',
    soundEnabled: true,
    ttsEnabled: true,
    hapticEnabled: true,
    bgmVolume: 70,
    sfxVolume: 80,
    ttsVolume: 100,
    bgmMuted: false,
    sfxMuted: false,
    ttsMuted: false,
  };
}

/**
 * 기본 로비 케어 시스템 데이터 생성
 */
export function createDefaultCareSystem() {
  return {
    hunger: 80,
    thirst: 80,
    poopCount: 0,
    lastUpdatedAt: Date.now(),
    stagesSinceLastCare: 0,
    walkCooldownUntil: 0,
    wellCaredBuff: false,
    recentLearnedWords: [],
    wrongAnswerQueue: [],
  };
}

/**
 * 기본 언어별 프로필 데이터 생성
 * @param {string} [lang='es']
 */
export function createDefaultProfile(lang = 'es') {
  return {
    onboardingCompleted: false,
    onboardingStep: 0,
    lobbyTourCompleted: false,
    petBreed: 'uyu',
    petName: lang === 'es' ? 'Leche' : lang === 'en' ? 'Milk' : '우유',
    ownerName: '민우',
    gold: 0,
    stage: 1,
    chapter: 1,
    wordCursor: 0,
    stats: {
      atk: 1,
      hp: 1,
      spd: 1,
      crit: 1,
      magnet: 1,
    },
    equippedDogSkills: ['bark'],
    unlockedDogSkills: ['bark'],
    equippedOwnerWeapon: 'stone',
    unlockedOwnerWeapons: ['stone'],
    ownerState: {
      recoveryStage: 1,
      cureProgress: 0,
      gear: {
        backpack: 1,
        shoes: 1,
        outfit: 1,
        weapon: 1,
      },
      materials: {
        cloth: 0,
        bandage: 0,
        parts: 0,
        herb: 0,
      },
    },
    companions: {
      unlocked: [],
      levels: {},
      activeGround: null,
      activeRider: null,
    },
    careSystem: createDefaultCareSystem(),
    dailyDrone: {
      date: '',
      freeUsed: false,
      adUsed: false,
    },
  };
}

class SettingsStoreManager {
  constructor() {
    this._account = createDefaultAccount();
    this._profiles = {
      es: createDefaultProfile('es'),
      en: createDefaultProfile('en'),
    };
    this._initialized = false;
    this._init();
    this.state = this._createStateProxy();
  }

  _init() {
    this.load();
    this._initialized = true;
  }

  _createStateProxy() {
    const store = this;
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === 'symbol') return undefined;
          if (prop === '__isProxy') return true;

          // 공용 계정 속성
          if (ACCOUNT_FIELDS.has(prop)) {
            return store._account[prop] ?? createDefaultAccount()[prop];
          }

          // 현재 활성 프로필 속성
          const profile = store.getCurrentProfile();
          if (prop in profile) {
            return profile[prop];
          }

          // 중첩 축약 또는 공용 계정 fallback
          if (prop in store._account) {
            return store._account[prop];
          }

          return profile[prop];
        },

        set(_, prop, value) {
          if (typeof prop === 'symbol') return true;

          if (ACCOUNT_FIELDS.has(prop)) {
            store._account[prop] = value;
            store.saveAccount();
          } else {
            const profile = store.getCurrentProfile();
            profile[prop] = value;
            store.saveProfile();
          }
          return true;
        },

        has(_, prop) {
          if (ACCOUNT_FIELDS.has(prop)) return true;
          const profile = store.getCurrentProfile();
          return prop in profile || prop in store._account;
        },

        ownKeys() {
          const profile = store.getCurrentProfile();
          return Array.from(new Set([...Object.keys(store._account), ...Object.keys(profile)]));
        },

        getOwnPropertyDescriptor(_, prop) {
          return {
            enumerable: true,
            configurable: true,
            writable: true,
            value: this.get(_, prop),
          };
        },
      }
    );
  }

  /**
   * 구버전 단일 세이브 데이터 마이그레이션 (Zero Data Loss)
   */
  _tryMigrateLegacyData() {
    let legacyRaw = null;
    let foundKey = null;

    for (const key of LEGACY_STORAGE_KEYS) {
      const val = safeGetItem(key);
      if (val) {
        legacyRaw = val;
        foundKey = key;
        break;
      }
    }

    if (!legacyRaw) return false;

    try {
      const old = JSON.parse(legacyRaw);
      if (!old || typeof old !== 'object') return false;

      console.info(`[settingsStore] 구버전 세이브('${foundKey}')를 v2 이원화 스토리지로 마이그레이션합니다.`);

      const activeLang =
        old.studyLang === 'en' || old.language === 'en' || old.lang === 'en' ? 'en' : 'es';

      // 1. 공용 계정 데이터 이관
      this._account = {
        gems: Number(old.gems ?? 0) || 0,
        adFree: Boolean(old.adFree ?? old.isAdFree ?? false),
        unlockedPaidBreeds: Array.isArray(old.unlockedPaidBreeds)
          ? [...old.unlockedPaidBreeds]
          : Array.isArray(old.unlockedBreeds)
          ? old.unlockedBreeds.filter((b) => b !== 'pomeranian' && b !== 'uyu')
          : [],
        unlockedPaidCostumes: Array.isArray(old.unlockedPaidCostumes)
          ? [...old.unlockedPaidCostumes]
          : Array.isArray(old.costumes?.owned)
          ? old.costumes.owned.filter((c) => c !== 'weapon_boomerang')
          : [],
        activeLanguage: activeLang,
        soundEnabled: Boolean(old.audio?.sfxEnabled ?? old.soundEnabled ?? true),
        ttsEnabled: Boolean(old.audio?.ttsEnabled ?? old.ttsEnabled ?? true),
        hapticEnabled: Boolean(old.haptic ?? old.hapticEnabled ?? true),
      };

      // 2. 언어별 프로필 데이터 이관 (대상 언어)
      const targetProfile = createDefaultProfile(activeLang);

      targetProfile.onboardingCompleted = Boolean(
        old.onboardingCompleted ?? old.tutorialCompleted ?? false
      );
      targetProfile.petBreed = old.selectedBreed || old.petBreed || targetProfile.petBreed;
      targetProfile.petName = old.dogName || old.petName || targetProfile.petName;
      targetProfile.gold = Number(old.gold ?? 0) || 0;

      const rawUnitNum = old.selectedUnit ? parseInt(String(old.selectedUnit).replace(/\D/g, ''), 10) : 1;
      targetProfile.stage = Math.max(1, Math.min(150, Number(old.stage ?? rawUnitNum ?? 1) || 1));
      const computedChapter = Math.max(1, Math.min(5, Math.floor((targetProfile.stage - 1) / 30) + 1));
      targetProfile.chapter = Math.max(
        1,
        Math.min(5, Number(old.chapter ?? old.selectedChapter ?? computedChapter) || computedChapter)
      );
      targetProfile.wordCursor = Math.max(0, Number(old.wordCursor ?? old.wordUnitOffset ?? 0) || 0);

      // 훈련 스탯 이관
      if (old.stats && typeof old.stats === 'object') {
        targetProfile.stats = {
          atk: Math.max(1, Number(old.stats.atk ?? 1)),
          hp: Math.max(1, Number(old.stats.hp ?? 1)),
          spd: Math.max(1, Number(old.stats.spd ?? 1)),
          crit: Math.max(1, Number(old.stats.crit ?? 1)),
          magnet: Math.max(1, Number(old.stats.magnet ?? 1)),
        };
      } else if (old.shopUpgrades && typeof old.shopUpgrades === 'object') {
        targetProfile.stats = {
          atk: Math.max(1, (Number(old.shopUpgrades.atkLevel ?? 0) || 0) + 1),
          hp: Math.max(1, (Number(old.shopUpgrades.hpLevel ?? 0) || 0) + 1),
          spd: Math.max(1, (Number(old.shopUpgrades.speedLv ?? 0) || 0) + 1),
          crit: 1,
          magnet: Math.max(1, (Number(old.shopUpgrades.magnetLv ?? 0) || 0) + 1),
        };
      }

      // 동료 상태 이관
      if (old.companions && typeof old.companions === 'object') {
        targetProfile.companions.unlocked = Array.isArray(old.companions.unlocked)
          ? [...old.companions.unlocked]
          : [];
        targetProfile.companions.levels =
          old.companions.levels && typeof old.companions.levels === 'object'
            ? { ...old.companions.levels }
            : {};
        targetProfile.companions.activeGround = old.companions.active?.[0] || null;
        targetProfile.companions.activeRider = old.companions.active?.[1] || null;
      }

      // 과거 단어 학습 통계 이관
      if (old.wordStats && typeof old.wordStats === 'object') {
        const wrongWords = [];
        const learnedWords = [];
        for (const [wId, st] of Object.entries(old.wordStats)) {
          if (st && Number(st.wrongCount) > 0 && !st.mastered) {
            wrongWords.push(String(wId));
          }
          if (st && (st.mastered || Number(st.streak) >= 2)) {
            learnedWords.push(String(wId));
          }
        }
        targetProfile.careSystem.recentLearnedWords = learnedWords.slice(-30).reverse();
        targetProfile.careSystem.wrongAnswerQueue = wrongWords;
      }

      this._profiles[activeLang] = targetProfile;
      this._profiles[activeLang === 'es' ? 'en' : 'es'] = createDefaultProfile(
        activeLang === 'es' ? 'en' : 'es'
      );

      this.save();
      return true;
    } catch (err) {
      console.warn('[settingsStore] 구버전 세이브 마이그레이션 실패:', err);
      return false;
    }
  }

  /**
   * 로컬 스토리지에서 공용 계정 및 활성 프로필 로드
   */
  load() {
    const rawAccount = safeGetItem(ACCOUNT_STORAGE_KEY);
    if (!rawAccount) {
      const migrated = this._tryMigrateLegacyData();
      if (!migrated) {
        this._account = createDefaultAccount();
        this._profiles.es = createDefaultProfile('es');
        this._profiles.en = createDefaultProfile('en');
        this.save();
      }
      return this.getState();
    }

    try {
      const parsedAccount = JSON.parse(rawAccount);
      this._account = { ...createDefaultAccount(), ...(parsedAccount || {}) };
    } catch (e) {
      this._account = createDefaultAccount();
    }

    const activeLang = this._account.activeLanguage === 'en' ? 'en' : 'es';
    this.loadProfile(activeLang);

    return this.getState();
  }

  /**
   * 특정 언어 프로필 로드
   * @param {string} lang ('en' | 'es')
   */
  loadProfile(lang) {
    const safeLang = lang === 'en' ? 'en' : 'es';
    const profileKey = getProfileKey(safeLang);
    const rawProfile = safeGetItem(profileKey);

    if (!rawProfile) {
      if (!this._profiles[safeLang]) {
        this._profiles[safeLang] = createDefaultProfile(safeLang);
        this.saveProfile(safeLang);
      }
      return this._profiles[safeLang];
    }

    try {
      const parsed = JSON.parse(rawProfile);
      const def = createDefaultProfile(safeLang);
      this._profiles[safeLang] = {
        ...def,
        ...(parsed || {}),
        stats: { ...def.stats, ...(parsed?.stats || {}) },
        ownerState: {
          ...def.ownerState,
          ...(parsed?.ownerState || {}),
          gear: { ...def.ownerState.gear, ...(parsed?.ownerState?.gear || {}) },
          materials: { ...def.ownerState.materials, ...(parsed?.ownerState?.materials || {}) },
        },
        companions: {
          ...def.companions,
          ...(parsed?.companions || {}),
          levels: { ...(parsed?.companions?.levels || {}) },
        },
        careSystem: {
          ...def.careSystem,
          ...(parsed?.careSystem || {}),
          recentLearnedWords: Array.isArray(parsed?.careSystem?.recentLearnedWords)
            ? [...parsed.careSystem.recentLearnedWords]
            : [],
          wrongAnswerQueue: Array.isArray(parsed?.careSystem?.wrongAnswerQueue)
            ? [...parsed.careSystem.wrongAnswerQueue]
            : [],
        },
        dailyDrone: { ...def.dailyDrone, ...(parsed?.dailyDrone || {}) },
      };
    } catch (e) {
      if (!this._profiles[safeLang]) {
        this._profiles[safeLang] = createDefaultProfile(safeLang);
      }
    }

    return this._profiles[safeLang];
  }

  /**
   * 공용 계정 데이터 저장
   */
  saveAccount() {
    safeSetItem(ACCOUNT_STORAGE_KEY, JSON.stringify(this._account));
  }

  /**
   * 프로필 데이터 저장
   * @param {string} [lang] 지정하지 않으면 현재 활성 언어
   */
  saveProfile(lang) {
    const safeLang = (lang || this._account.activeLanguage) === 'en' ? 'en' : 'es';
    const key = getProfileKey(safeLang);
    const data = this._profiles[safeLang] || createDefaultProfile(safeLang);
    safeSetItem(key, JSON.stringify(data));
  }

  saveCurrentProfile() {
    this.saveProfile();
  }

  /**
   * 계정 및 현재 프로필 일괄 저장
   */
  save() {
    this.saveAccount();
    this.saveProfile();
  }

  /**
   * 현재 활성 프로필 반환
   */
  getCurrentProfile() {
    const safeLang = this._account.activeLanguage === 'en' ? 'en' : 'es';
    if (!this._profiles[safeLang]) {
      this.loadProfile(safeLang);
    }
    return this._profiles[safeLang];
  }

  /**
   * 공용 계정 데이터 반환
   */
  getAccount() {
    return this._account;
  }

  /**
   * 특정 언어 프로필 반환
   */
  getProfile(lang) {
    const safeLang = (lang || this._account.activeLanguage) === 'en' ? 'en' : 'es';
    if (!this._profiles[safeLang]) {
      this.loadProfile(safeLang);
    }
    return this._profiles[safeLang];
  }

  /**
   * 하위 호환 평면 데이터 스냅샷 반환
   */
  getState() {
    const profile = this.getCurrentProfile();
    return {
      ...profile,
      ...this._account,
      activeLanguage: this._account.activeLanguage,
    };
  }

  /**
   * 하위 호환 상태 갱신 함수
   * @param {Function|Object} updater
   */
  updateState(updater) {
    if (typeof updater === 'function') {
      updater(this.state);
    } else if (updater && typeof updater === 'object') {
      for (const [k, v] of Object.entries(updater)) {
        this.state[k] = v;
      }
    }
    this.save();
    return this.getState();
  }

  /**
   * 하위 호환 단일 키 getter
   */
  get(key) {
    return this.state[key];
  }

  /**
   * 하위 호환 단일 키 setter
   */
  set(key, val) {
    this.state[key] = val;
    return val;
  }

  /**
   * 언어 전환 전용 메서드 ('en' | 'es')
   * 현재 프로필을 저장 후 활성 언어를 변경하고 대상 프로필을 로드
   * @param {string} lang
   */
  switchLanguage(lang) {
    const targetLang = lang === 'en' ? 'en' : 'es';
    const prevLang = this._account.activeLanguage === 'en' ? 'en' : 'es';

    if (prevLang === targetLang && this._profiles[targetLang]) {
      return this.getState();
    }

    // 1. 현재 언어 프로필 저장
    this.saveProfile(prevLang);

    // 2. 활성 언어 변경 및 계정 저장
    this._account.activeLanguage = targetLang;
    this.saveAccount();

    // 3. 대상 언어 프로필 로드
    this.loadProfile(targetLang);

    return this.getState();
  }

  /**
   * 배운 단어 / 오답 기록 헬퍼
   * @param {string|number} wordId
   * @param {boolean} isCorrect
   */
  recordWordResult(wordId, isCorrect) {
    if (wordId === undefined || wordId === null) return;
    const profile = this.getCurrentProfile();
    if (!profile.careSystem) {
      profile.careSystem = createDefaultCareSystem();
    }
    const care = profile.careSystem;
    if (!Array.isArray(care.recentLearnedWords)) care.recentLearnedWords = [];
    if (!Array.isArray(care.wrongAnswerQueue)) care.wrongAnswerQueue = [];

    const wId = String(wordId);

    if (isCorrect) {
      // 맞힌 단어: 최근 배운 단어 목록 앞쪽에 추가 (최대 30개 유지, 중복 제거)
      care.recentLearnedWords = [
        wId,
        ...care.recentLearnedWords.filter((id) => String(id) !== wId),
      ].slice(0, 30);

      // 오답 큐에서 성공적으로 복습 완료되었으므로 제거
      care.wrongAnswerQueue = care.wrongAnswerQueue.filter((id) => String(id) !== wId);
    } else {
      // 틀린 단어: 오답 큐에 중복 없이 누적
      if (!care.wrongAnswerQueue.some((id) => String(id) === wId)) {
        care.wrongAnswerQueue.push(wId);
      }
    }

    this.saveProfile();
  }

  /**
   * 스테이지 클리어 기록 및 케어 시스템 현실 시간·전투 경과 갱신
   * @param {number} stageNum
   */
  recordStageClear(stageNum) {
    const profile = this.getCurrentProfile();
    const curStage = Number(profile.stage) || 1;
    const clearedNum = Number(stageNum) || curStage;

    // 스테이지 진행도 갱신 (1~150 clamp)
    profile.stage = Math.max(1, Math.min(150, Math.max(curStage, clearedNum + 1)));
    profile.chapter = Math.max(1, Math.min(5, Math.floor((profile.stage - 1) / 30) + 1));

    // wordCursor 전진 제어: 일반 스테이지(stage % 5 !== 0)는 7단어 전진, 복습 스테이지(stage % 5 === 0)는 전진 동결
    if (clearedNum % 5 !== 0) {
      profile.wordCursor = (Number(profile.wordCursor) || 0) + 7;
    }

    // 1. 복습 스테이지 (stage % 5 === 0) 클리어 보너스: 주인 장비 제작 재료 2~3종 지급
    let reviewMaterials = null;
    if (clearedNum % 5 === 0) {
      if (!profile.ownerState) profile.ownerState = { recoveryStage: 1, cureProgress: 0, gear: { backpack: 1, shoes: 1, outfit: 1, weapon: 1 }, materials: { cloth: 0, bandage: 0, parts: 0, herb: 0 } };
      if (!profile.ownerState.materials) profile.ownerState.materials = { cloth: 0, bandage: 0, parts: 0, herb: 0 };

      const MAT_KEYS = ['cloth', 'bandage', 'parts', 'herb'];
      const grantCount = 2 + (Math.random() < 0.5 ? 1 : 0); // 2~3개
      reviewMaterials = {};
      for (let i = 0; i < grantCount; i++) {
        const mat = MAT_KEYS[Math.floor(Math.random() * MAT_KEYS.length)];
        profile.ownerState.materials[mat] = (profile.ownerState.materials[mat] || 0) + 1;
        reviewMaterials[mat] = (reviewMaterials[mat] || 0) + 1;
      }
    }

    // 2. Stage 3 최초 클리어 시 서포트 동료 'sniffer_dog' 자동 해금 및 장착
    let stage3Unlocked = false;
    if (clearedNum === 3) {
      if (!profile.companions) profile.companions = { unlocked: [], activeGround: null, activeAir: null, activeSpecial: null, levels: {} };
      if (!Array.isArray(profile.companions.unlocked)) profile.companions.unlocked = [];
      if (!profile.companions.unlocked.includes('sniffer_dog')) {
        profile.companions.unlocked.push('sniffer_dog');
        stage3Unlocked = true;
      }
      profile.companions.activeGround = 'sniffer_dog';
    }

    // 3. 챕터 보스 (30, 60, 90, 120, 150) 클리어 보상 및 주인 회복 단계/진행도 승급
    let chapterBossClear = null;
    if (clearedNum <= 150 && clearedNum % 30 === 0) {
      if (!profile.ownerState) profile.ownerState = { recoveryStage: 1, cureProgress: 0, gear: { backpack: 1, shoes: 1, outfit: 1, weapon: 1 }, materials: { cloth: 0, bandage: 0, parts: 0, herb: 0 } };
      if (!Array.isArray(profile.unlockedOwnerWeapons)) profile.unlockedOwnerWeapons = ['stone'];

      const targetRecovery = Math.min(5, Math.floor(clearedNum / 30) + 1);
      profile.ownerState.recoveryStage = Math.max(profile.ownerState.recoveryStage || 1, targetRecovery);
      profile.ownerState.cureProgress = Math.min(100, (Number(profile.ownerState.cureProgress) || 0) + 20);

      chapterBossClear = {
        stage: clearedNum,
        chapter: Math.floor(clearedNum / 30),
        recoveryStage: profile.ownerState.recoveryStage,
        cureProgress: profile.ownerState.cureProgress,
        bremenUnlocked: false,
        season2Unlocked: false,
        unlockedWeapon: null,
      };

      if (clearedNum === 30) {
        if (!profile.unlockedOwnerWeapons.includes('slingshot')) profile.unlockedOwnerWeapons.push('slingshot');
        profile.equippedOwnerWeapon = 'slingshot';
        chapterBossClear.unlockedWeapon = 'slingshot';
      } else if (clearedNum === 60) {
        if (!profile.unlockedOwnerWeapons.includes('pistol')) profile.unlockedOwnerWeapons.push('pistol');
        profile.equippedOwnerWeapon = 'pistol';
        profile.bremenUnlocked = true;
        chapterBossClear.unlockedWeapon = 'pistol';
        chapterBossClear.bremenUnlocked = true;
      } else if (clearedNum === 90) {
        if (!profile.unlockedOwnerWeapons.includes('smg')) profile.unlockedOwnerWeapons.push('smg');
        chapterBossClear.unlockedWeapon = 'smg';
      } else if (clearedNum === 120) {
        if (!profile.unlockedOwnerWeapons.includes('rifle')) profile.unlockedOwnerWeapons.push('rifle');
        chapterBossClear.unlockedWeapon = 'rifle';
      } else if (clearedNum === 150) {
        profile.ownerState.recoveryStage = 5;
        profile.ownerState.cureProgress = 100;
        if (!profile.unlockedOwnerWeapons.includes('plasma_rifle')) profile.unlockedOwnerWeapons.push('plasma_rifle');
        profile.equippedOwnerWeapon = 'plasma_rifle';
        profile.season1Medal = true;
        profile.season2Unlocked = true;
        chapterBossClear.unlockedWeapon = 'plasma_rifle';
        chapterBossClear.season2Unlocked = true;
      }
    }

    if (!profile.careSystem) {
      profile.careSystem = createDefaultCareSystem();
    }
    const care = profile.careSystem;
    care.stagesSinceLastCare = (Number(care.stagesSinceLastCare) || 0) + 1;

    // 현실 시간 경과 반영
    const now = Date.now();
    const lastTime = Number(care.lastUpdatedAt) || now;
    const elapsedMinutes = Math.max(0, (now - lastTime) / (1000 * 60));

    // 배고픔/목마름 감소 (전투 1판당 기본 -6, 시간 경과 추가 감소)
    const hungerDrain = 6 + Math.floor(elapsedMinutes / 30);
    const thirstDrain = 7 + Math.floor(elapsedMinutes / 25);
    care.hunger = Math.max(0, Math.min(100, (Number(care.hunger) ?? 80) - hungerDrain));
    care.thirst = Math.max(0, Math.min(100, (Number(care.thirst) ?? 80) - thirstDrain));

    // 배변(응가) 증가: 3판 전투마다 1회 또는 120분 경과 시 누적 (최대 3개)
    if (care.stagesSinceLastCare % 3 === 0 || elapsedMinutes >= 120) {
      care.poopCount = Math.max(0, Math.min(3, (Number(care.poopCount) ?? 0) + 1));
    } else {
      care.poopCount = Math.max(0, Math.min(3, Number(care.poopCount) ?? 0));
    }

    // 최상 컨디션 버프 판정 (배고픔 >= 70, 목마름 >= 70, 응가 0개)
    care.wellCaredBuff = care.hunger >= 70 && care.thirst >= 70 && care.poopCount === 0;
    care.lastUpdatedAt = now;

    this.saveProfile();
    return {
      clearedStage: clearedNum,
      reviewMaterials,
      stage3Unlocked,
      chapterBossClear,
    };
  }

  /**
   * 로비 반려견 사료 먹이기
   * @param {number} [amount=25]
   */
  feedPet(amount = 25) {
    const profile = this.getCurrentProfile();
    const care = profile.careSystem || (profile.careSystem = createDefaultCareSystem());
    care.hunger = Math.max(0, Math.min(100, (Number(care.hunger) ?? 0) + amount));
    care.wellCaredBuff = care.hunger >= 70 && care.thirst >= 70 && care.poopCount === 0;
    care.lastUpdatedAt = Date.now();
    this.saveProfile();
    return care.hunger;
  }

  /**
   * 로비 반려견 물 주기
   * @param {number} [amount=25]
   */
  giveWater(amount = 25) {
    const profile = this.getCurrentProfile();
    const care = profile.careSystem || (profile.careSystem = createDefaultCareSystem());
    care.thirst = Math.max(0, Math.min(100, (Number(care.thirst) ?? 0) + amount));
    care.wellCaredBuff = care.hunger >= 70 && care.thirst >= 70 && care.poopCount === 0;
    care.lastUpdatedAt = Date.now();
    this.saveProfile();
    return care.thirst;
  }

  /**
   * 로비 반려견 배변 치우기
   */
  cleanPoop() {
    const profile = this.getCurrentProfile();
    const care = profile.careSystem || (profile.careSystem = createDefaultCareSystem());
    care.poopCount = 0;
    care.stagesSinceLastCare = 0;
    care.wellCaredBuff = care.hunger >= 70 && care.thirst >= 70;
    care.lastUpdatedAt = Date.now();
    this.saveProfile();
    return true;
  }

  /**
   * 로비 반려견 산책 쿨다운 설정
   * @param {number} [cooldownMs=1800000] 기본 30분
   */
  walkPet(cooldownMs = 30 * 60 * 1000) {
    const profile = this.getCurrentProfile();
    const care = profile.careSystem || (profile.careSystem = createDefaultCareSystem());
    care.walkCooldownUntil = Date.now() + cooldownMs;
    care.hunger = Math.max(0, (Number(care.hunger) ?? 80) - 10);
    care.thirst = Math.max(0, (Number(care.thirst) ?? 80) - 15);
    care.wellCaredBuff = care.hunger >= 70 && care.thirst >= 70 && care.poopCount === 0;
    care.lastUpdatedAt = Date.now();
    this.saveProfile();
    return care.walkCooldownUntil;
  }

  /**
   * 데이터 초기화
   * @param {'all'|'profile'} [target='all']
   */
  reset(target = 'all') {
    if (target === 'profile') {
      const lang = this._account.activeLanguage;
      this._profiles[lang] = createDefaultProfile(lang);
      this.saveProfile(lang);
    } else {
      this._account = createDefaultAccount();
      this._profiles.es = createDefaultProfile('es');
      this._profiles.en = createDefaultProfile('en');
      this.save();
    }
    return this.getState();
  }

  // === 편리한 기본 속성 Getter / Setter ===
  get gems() {
    return this._account.gems ?? 0;
  }
  set gems(val) {
    this._account.gems = Math.max(0, Number(val) || 0);
    this.saveAccount();
  }

  get gold() {
    return this.getCurrentProfile().gold ?? 0;
  }
  set gold(val) {
    this.getCurrentProfile().gold = Math.max(0, Number(val) || 0);
    this.saveProfile();
  }

  get stage() {
    return this.getCurrentProfile().stage ?? 1;
  }
  set stage(val) {
    this.getCurrentProfile().stage = Math.max(1, Math.min(150, Number(val) || 1));
    this.getCurrentProfile().chapter = Math.max(
      1,
      Math.min(5, Math.floor((this.getCurrentProfile().stage - 1) / 30) + 1)
    );
    this.saveProfile();
  }

  get chapter() {
    return this.getCurrentProfile().chapter ?? 1;
  }
  set chapter(val) {
    this.getCurrentProfile().chapter = Math.max(1, Math.min(5, Number(val) || 1));
    this.saveProfile();
  }

  get activeLanguage() {
    return this._account.activeLanguage || 'es';
  }
  set activeLanguage(lang) {
    this.switchLanguage(lang);
  }

  get soundEnabled() {
    return this._account.soundEnabled ?? true;
  }
  set soundEnabled(val) {
    this._account.soundEnabled = Boolean(val);
    this.saveAccount();
  }

  get ttsEnabled() {
    return this._account.ttsEnabled ?? true;
  }
  set ttsEnabled(val) {
    this._account.ttsEnabled = Boolean(val);
    this.saveAccount();
  }

  get hapticEnabled() {
    return this._account.hapticEnabled ?? true;
  }
  set hapticEnabled(val) {
    this._account.hapticEnabled = Boolean(val);
    this.saveAccount();
  }

  get adFree() {
    return this._account.adFree ?? false;
  }
  set adFree(val) {
    this._account.adFree = Boolean(val);
    this.saveAccount();
  }

  get onboardingCompleted() {
    return this.getCurrentProfile().onboardingCompleted ?? false;
  }
  set onboardingCompleted(val) {
    this.getCurrentProfile().onboardingCompleted = Boolean(val);
    this.saveProfile();
  }
}

export const settingsStore = new SettingsStoreManager();
export default settingsStore;

if (typeof window !== 'undefined') {
  window.settingsStore = settingsStore;
}

// 호환용 함수형 단축 내보내기
export const getState = () => settingsStore.getState();
export const updateState = (updater) => settingsStore.updateState(updater);
export const get = (key) => settingsStore.get(key);
export const set = (key, val) => settingsStore.set(key, val);
export const save = () => settingsStore.save();
export const load = () => settingsStore.load();
export const reset = (target) => settingsStore.reset(target);
export const switchLanguage = (lang) => settingsStore.switchLanguage(lang);
export const recordWordResult = (wordId, isCorrect) => settingsStore.recordWordResult(wordId, isCorrect);
export const recordStageClear = (stageNum) => settingsStore.recordStageClear(stageNum);
export const getAccountData = () => settingsStore.getAccount();
export const getProfileData = (lang) => settingsStore.getProfile(lang);
