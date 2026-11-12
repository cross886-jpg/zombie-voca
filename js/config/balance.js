/**
 * js/config/balance.js
 * 좀비 보카 (Zombie Voca) — 모든 수치 및 밸런스 제어판
 * 단일 진실 공급원(Single Source of Truth)으로 사용됩니다.
 */

import { COMPANIONS } from '../data/catalog.js';

export const MAX_EQUIPPED_COMPANIONS = 2;

export const BALANCE = Object.freeze({
  ENGINE: {
    LOGICAL_WIDTH: 480,
    LOGICAL_HEIGHT: 854,
    MAX_DT: 0.05, // 주사율 무관 물리 안정화를 위한 최대 dt 클램프 (50ms)
    TARGET_FPS: 60,
  },

  ARENA: {
    SCALE_MULTIPLIER: 5.25, // 화면 크기 대비 5.25 x 5.25배 네온 방화벽 광장 (기존 3.5배 대비 1.5배 확장)
    FIREWALL_MARGIN: 48,   // 방화벽 외곽 안전 여백
    MONOLITH_SAFE_MARGIN: 140, // 비석 스폰 시 방화벽 안쪽 안전 여백
    MONOLITH_MIN_DIST: 220,    // 비석 간 최소 거리 (px)
    MONOLITH_PLAYER_MIN_DIST: 160, // 플레이어와의 최소 스폰 거리
  },

  VOCA: {
    DECK_SIZE: 30,          // 한 판 고정 30문제
    NEW_WORDS_COUNT: 20,    // 신규 단어 20문제
    REVIEW_WORDS_COUNT: 10, // 오답/복습 단어 10문제
    MASTERY_STREAK: 3,      // 3회 연속 정답 시 Mastered 졸업
    MEANING_MAX_CHARS: 8,   // 비석 표시용 뜻 최대 글자 수
    TTS_INTERVAL_SEC: 2.5,  // 원어민 발음 자동 반복 간격
    AUDIO_DUCKING_BGM_RATIO: 0.05, // TTS 재생 중 BGM 볼륨 5%로 더킹
    MIN_REVIEW_REWARD_SEC: 30, // 기억수첩 30초 미니 복습 기준 시간
  },

  MONOLITH: {
    CAPTURE_TIME_SEC: 0.4,       // 비석 점령 소요 시간 (0.4초)
    RESPAWN_DELAY_SEC: 1.5,      // 확정 소멸 후 다음 비석 스폰 대기 시간 (1.5초)
    CAPTURE_RADIUS: 52,          // 몸 부딪힘 점령 판정 반경
    CORRECT_XP: 100,             // 정답 시 진화 XP 상승
    WRONG_XP_PENALTY: -50,       // 오답 시 진화 XP 하락
    WRONG_SLOW_DURATION: 3.0,    // 오답 시 이동속도 저하 디버프 (3초)
    WRONG_SLOW_MULT: 0.55,       // 오답 디버프 이동속도 배율
    CORRECT_KNOCKBACK_RADIUS: 240, // 정답 충격파 반경
    CORRECT_KNOCKBACK_FORCE: 440,  // 정답 충격파 넉백 힘
  },

  PLAYER: {
    BASE_HP: 120,
    BASE_SPEED: 160,
    BASE_ATK: 18,
    RADIUS: 20,
    PICKUP_RADIUS: 78,
    INVULN_DURATION: 0.45,
    LEVEL_UP_BASE_XP: 30,
    LEVEL_UP_XP_STEP: 22,
  },

  // 누적 진화 XP 기반 4단계 외형 진화
  EVOLUTION_STAGES: [
    { stage: 0, key: 'evo.stage0', minXp: 0,     hpMult: 1.0,  atkMult: 1.0,  scale: 1.0,  icon: '🐶' },
    { stage: 1, key: 'evo.stage1', minXp: 1500,  hpMult: 1.15, atkMult: 1.15, scale: 1.08, icon: '🐕' },
    { stage: 2, key: 'evo.stage2', minXp: 5000,  hpMult: 1.35, atkMult: 1.35, scale: 1.16, icon: '⚔️' },
    { stage: 3, key: 'evo.stage3', minXp: 12000, hpMult: 1.6,  atkMult: 1.65, scale: 1.25, icon: '🦸' },
  ],

  // 챕터와 독립적으로 작동하는 4개 난이도 코스 (단어 출제 풀 및 보상 배율)
  COURSES: [
    { id: 'lv1', labelKey: 'course.lv1', cefr: ['A1'],             rewardMult: 1.0, enemyMult: 1.0 },
    { id: 'lv2', labelKey: 'course.lv2', cefr: ['A1', 'A2'],       rewardMult: 1.25, enemyMult: 1.0 },
    { id: 'lv3', labelKey: 'course.lv3', cefr: ['B1', 'B2'],       rewardMult: 1.55, enemyMult: 1.0 },
    { id: 'lv4', labelKey: 'course.lv4', cefr: ['B2', 'C1', 'C2'], rewardMult: 2.0, enemyMult: 1.0 },
  ],

  COMBAT: {
    AUTO_BARK_INTERVAL: 0.72,
    ULT_MAX_GAUGE: 100,
    ULT_CHARGE_PER_KILL: 4,
    ULT_CHARGE_PER_CORRECT: 18,
    ULT_DAMAGE_MULT: 6.5,
    ULT_RADIUS: 340,
    DAMAGE_TEXT_TTL: 0.65,
    GEM_XP_VALUE: 10,
    SNACK_DROP_CHANCE: 0.015, // 기존 0.06 대비 1/4 수준으로 하향 (한 판 30문제 기준 평균 1~2개 희소 드롭)
    SNACK_HEAL_RATIO: 0.28,   // 뼈다귀 1개당 최대 체력의 28% 회복 (25%~30% 범위)
  },

  GEM_TIERS: [
    { id: 'blue',   chance: 0.75, charge: 2,   scale: 1.0,  color: '#38bdf8', glow: '#38bdf8', blur: 8 },
    { id: 'green',  chance: 0.18, charge: 10,  scale: 1.2,  color: '#4ade80', glow: '#22c55e', blur: 11 },
    { id: 'purple', chance: 0.06, charge: 35,  scale: 1.4,  color: '#c084fc', glow: '#a855f7', blur: 15 },
    { id: 'gold',   chance: 0.01, charge: 100, scale: 1.65, color: '#facc15', glow: '#f59e0b', blur: 20 },
  ],

  ENEMIES: {
    MAX_ACTIVE: 48,
    SPAWN_INTERVAL_BASE: 1.35,
    SPAWN_INTERVAL_MIN: 0.45,
    SPEED_CURVE: {
      EARLY_END_Q: 10,
      EARLY_STEP: 0.003,
      MID_END_Q: 20,
      MID_STEP: 0.008,
      LATE_STEP: 0.02,
      MAX_MULT: 1.35,
    },
    TYPES: {
      walker:  { hp: 28,  speed: 42, dmg: 8,  radius: 17, xp: 10, color: '#6ee7b7' },
      runner:  { hp: 20,  speed: 68, dmg: 10, radius: 15, xp: 12, color: '#fca5a5' },
      brute:   { hp: 82,  speed: 30, dmg: 16, radius: 24, xp: 24, color: '#c4b5fd' },
      spitter: { hp: 32,  speed: 38, dmg: 12, radius: 17, xp: 16, color: '#fde047' },
      armored: { hp: 125, speed: 28, dmg: 18, radius: 23, xp: 30, color: '#93c5fd' },
    },
  },

  BOSS: {
    ENTRY_QUESTION_INDEX: 27, // 0-based (28번 문제 진입 시 등장)
    ZOOM_SEQUENCE_SEC: 1.5,   // 1.5초 줌아웃 → 줌인 연출
    HP_LOCK_THRESHOLDS: [0.66, 0.33, 0], // 3단 체력 잠금
    BASE_HP: 1200,
    BASE_SPEED: 54,
    BASE_DMG: 22,
    RADIUS: 42,
    ENRAGE_SPEED_MULT: 1.38,
    ENRAGE_DMG_MULT: 1.35,
  },

  COMPANIONS: {
    MAX_ACTIVE: MAX_EQUIPPED_COMPANIONS,
    BASE_UPGRADE_GOLD: 120,
    UPGRADE_GOLD_GROWTH: 1.45,
    ATK_PER_LEVEL: 0.14,
  },

  TRAINING: {
    BASE_COST_GOLD: 80,
    COST_GROWTH: 1.35,
    ATK_BONUS_PER_LV: 4,
    HP_BONUS_PER_LV: 20,
    SPEED_BONUS_PER_LV: 0.025,
    SPEED_MAX_LV: 20,
    MAGNET_BONUS_PER_LV: 12,
    MAGNET_MAX_LV: 20,
    ULT_CHARGE_BONUS_PER_LV: 0.05,
    ULT_CHARGE_MAX_LV: 20,
    SHIELD_BONUS_PER_LV: 0.04,
    SHIELD_MAX_LV: 15,
    ITEMS: {
      atkLevel:    { baseCost: 80,  growth: 1.35, maxLv: 99, perLv: 4 },
      hpLevel:     { baseCost: 80,  growth: 1.35, maxLv: 99, perLv: 20 },
      speedLv:     { baseCost: 90,  growth: 1.32, maxLv: 20, perLv: 0.025 },
      magnetLv:    { baseCost: 85,  growth: 1.30, maxLv: 20, perLv: 12 },
      ultChargeLv: { baseCost: 100, growth: 1.35, maxLv: 20, perLv: 0.05 },
      shieldLv:    { baseCost: 110, growth: 1.38, maxLv: 15, perLv: 0.04 },
    },
  },

  SHOP: {
    NORMAL_BOX_GOLD: 150,
    PREMIUM_SUITCASE_GOLD: 450,
    MINI_REVIEW_REWARD_GOLD: 120,
    MINI_REVIEW_REWARD_SNACKS: 2,
    REVIVE_HP_RATIO: 0.7,
    BOXES: {
      normal: {
        id: 'normal',
        isPremium: false,
        icon: '📦',
        nameKey: 'lobby.normalBox',
        cost: 150,
        summary: '일반~희귀 코스튬 및 간식 획득',
        rewardsInfo: '• 코스튬(60%) 또는 간식 x2(40%)\n• 등급 확률: 일반 62% · 희귀 28% · 영웅 8% · 전설 2%\n• 중복 코스튬은 간식 +1🦴으로 자동 변환',
        rarityWeights: { common: 0.62, rare: 0.28, epic: 0.08, legend: 0.02 },
        costumeChance: 0.6,
        refundSnacks: 1,
        snackQty: 2,
      },
      premium: {
        id: 'premium',
        isPremium: true,
        icon: '🧳',
        nameKey: 'lobby.premiumSuitcase',
        cost: 450,
        summary: '희귀~전설 코스튬 고확률 & 대량 간식',
        rewardsInfo: '• 코스튬(80%) 또는 간식 x4(20%)\n• 등급 확률: 일반 25% · 희귀 38% · 영웅 25% · 전설 12%\n• 중복 코스튬은 간식 +3🦴으로 자동 변환',
        rarityWeights: { common: 0.25, rare: 0.38, epic: 0.25, legend: 0.12 },
        costumeChance: 0.8,
        refundSnacks: 3,
        snackQty: 4,
      },
    },
  },

  TUTORIAL: {
    QUESTION_COUNT: 3,
    INITIAL_ZOMBIES: 4,
  },
});

export function getTrainingUpgradeCost(key, currentLv = 0) {
  const cfg = BALANCE.TRAINING.ITEMS[key];
  const base = cfg ? cfg.baseCost : BALANCE.TRAINING.BASE_COST_GOLD;
  const growth = cfg ? cfg.growth : BALANCE.TRAINING.COST_GROWTH;
  return Math.round(base * Math.pow(growth, Math.max(0, currentLv)));
}

export function getTrainingBonusValue(key, currentLv = 0) {
  const cfg = BALANCE.TRAINING.ITEMS[key];
  if (!cfg) return 0;
  const clampedLv = Math.min(cfg.maxLv, Math.max(0, currentLv));
  return clampedLv * cfg.perLv;
}

const COMPANION_UNLOCK_CHECKERS = {
  chapter: (cond, s) => (s?.unlockedChapter || 1) > cond.chapter,
  trainingSum: (cond, s) =>
    Object.values(s?.training || {}).reduce((sum, lv) => sum + (Number(lv) || 0), 0) >= cond.target,
  masteredWords: (cond, s) =>
    Object.values(s?.wordStats || {}).filter((st) => st?.mastered).length >= cond.target,
  course: (cond, s) => cond.courseIds.includes(s?.selectedCourse || 'lv1'),
};

/**
 * 동료 순차 해금 가능 여부 판별 (챕터 클리어 & 성장 마일스톤 데이터 기반)
 * - 이미 해금된 동료(기존 세이브 포함)는 항상 true
 */
export function isCompanionUnlockable(companionId, saveState) {
  const comp = COMPANIONS.find((c) => c.id === companionId);
  if (!comp) return false;

  const unlocked = saveState?.companions?.unlocked || [];
  if (unlocked.includes(companionId)) return true;

  const cond = comp.unlockCond || { type: 'chapter', chapter: comp.unlockChapter || 1 };
  const checker = COMPANION_UNLOCK_CHECKERS[cond.type];
  return checker ? checker(cond, saveState) : false;
}

/**
 * GEM_TIERS 확률 테이블에 따라 보석 등급 1종 추출
 */
export function rollGemTier() {
  const tiers = BALANCE.GEM_TIERS;
  const r = Math.random();
  let acc = 0;
  for (const tier of tiers) {
    acc += tier.chance;
    if (r < acc) return tier;
  }
  return tiers[0];
}

