/**
 * js/config/balance.js
 * 좀비 보카 (Zombie Voca) — 모든 수치 및 밸런스 제어판
 * 단일 진실 공급원(Single Source of Truth)으로 사용됩니다.
 */

import { COMPANIONS } from '../data/catalog.js';

export const MAX_EQUIPPED_COMPANIONS = 3;

/**
 * 강아지 5대 야생 액션 스킬 (전 구간 네 발 반려견 본연의 야생 액션)
 */
export const DOG_WILD_SKILLS = Object.freeze([
  {
    id: 'bark',
    slot: 1,
    name: '우렁찬 멍멍 짖기',
    icon: '🗣️',
    color: '#38bdf8',
    projectileType: 'sonic_crescent',
    desc: '원거리 전방 부채꼴/초승달 음파 투사체를 발사하며 강아지 입 벌림 모션을 트리거합니다.',
    cooldown: 0.72,
    range: 220,
    baseDamageMult: 1.0,
    pierce: 1,
    motion: 'mouth_open',
  },
  {
    id: 'tail_whirl',
    slot: 2,
    name: '회오리 꼬리치기',
    icon: '🌪️',
    color: '#34d399',
    projectileType: 'mini_tornado',
    desc: '원거리 미니 회오리(토네이도) 관통 투사체를 발사하고 꼬리 흔들기 모션을 활성화합니다.',
    cooldown: 1.15,
    range: 260,
    baseDamageMult: 1.15,
    pierce: 3,
    motion: 'tail_wag',
  },
  {
    id: 'bite',
    slot: 3,
    name: '야무지게 물어뜯기',
    icon: '🦷',
    color: '#f8fafc',
    projectileType: 'white_fangs',
    desc: '원거리 고속 하얀 이빨 모양 에너지 탄환을 발사하며 입 벌림 모션을 트리거합니다.',
    cooldown: 0.88,
    range: 240,
    baseDamageMult: 1.3,
    pierce: 0,
    motion: 'mouth_open',
  },
  {
    id: 'paw_swipe',
    slot: 4,
    name: '앞발 날리기',
    icon: '🐾',
    color: '#f472b6',
    projectileType: 'pink_paw_swipe',
    desc: '강아지 전방 근접 반경에 분홍 젤리 발바닥 스와이프(할퀴기) 이펙트를 생성합니다.',
    cooldown: 0.65,
    range: 95,
    baseDamageMult: 1.25,
    pierce: 99,
    motion: 'paw_swipe',
  },
  {
    id: 'hip_slam',
    slot: 5,
    name: '엉덩이 쿵!',
    icon: '🍑',
    color: '#fb923c',
    projectileType: 'hip_slam_ring',
    desc: '강아지 주변 360도 동심원 충격파 링을 방출해 범위 내 좀비를 밀어냅니다.',
    cooldown: 1.45,
    range: 125,
    baseDamageMult: 1.4,
    pierce: 99,
    motion: 'hip_slam',
  },
]);

/**
 * 주인(Owner) 전용 무기 카테고리 (주인의 위치에서 발사)
 */
export const OWNER_WEAPONS = Object.freeze({
  stone: {
    id: 'stone',
    name: '던지는 돌멩이',
    icon: '🪨',
    color: '#78716c',
    type: 'parabolic',
    speed: 310,
    radius: 7,
    cooldown: 1.6,
    range: 230,
    damageMult: 0.9,
    desc: '바닥의 돌멩이/깡통을 집어 포물선으로 던집니다.',
  },
  slingshot: {
    id: 'slingshot',
    name: '새총 구슬',
    icon: '🪵',
    color: '#b45309',
    type: 'pellet',
    speed: 480,
    radius: 6,
    cooldown: 1.2,
    range: 270,
    damageMult: 1.15,
    desc: 'Y자 새총으로 고속 쇠구슬을 발사합니다.',
  },
  pistol: {
    id: 'pistol',
    name: '호신용 권총',
    icon: '🔫',
    color: '#fbbf24',
    type: 'bullet',
    speed: 520,
    radius: 5,
    cooldown: 0.9,
    range: 310,
    damageMult: 1.35,
    desc: '가볍고 다루기 쉬운 9mm 호신용 권총으로 사격합니다.',
  },
  smg: {
    id: 'smg',
    name: '경량 기관단총',
    icon: '💥',
    color: '#38bdf8',
    type: 'bullet',
    speed: 560,
    radius: 4,
    cooldown: 0.55,
    range: 330,
    damageMult: 1.55,
    desc: '빠른 연사 속도로 전방의 좀비를 제압합니다.',
  },
  rifle: {
    id: 'rifle',
    name: '정밀 돌격소총',
    icon: '🎯',
    color: '#f87171',
    type: 'bullet',
    speed: 620,
    radius: 5,
    cooldown: 0.7,
    range: 380,
    damageMult: 1.9,
    desc: '원거리의 위험한 좀비를 저격하여 큰 타격을 줍니다.',
  },
  plasma_rifle: {
    id: 'plasma_rifle',
    name: '플라즈마 라이플',
    icon: '⚡',
    color: '#a855f7',
    type: 'bullet',
    speed: 650,
    radius: 7,
    cooldown: 0.6,
    range: 420,
    damageMult: 2.5,
    desc: '감염 억제 파장을 압축 발사하는 최종 결전 화기입니다.',
  },
  firearm: {
    id: 'firearm',
    name: '지원 사격 화기',
    icon: '🔫',
    color: '#fbbf24',
    type: 'bullet',
    speed: 520,
    radius: 5,
    cooldown: 0.85,
    range: 320,
    damageMult: 1.45,
    desc: '안정적인 자세로 원거리 화기 지원 사격을 가합니다.',
  },
});

export const GAME_STATES = Object.freeze({
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVELUP_MODAL: 'LEVELUP_MODAL',
  GAMEOVER_MODAL: 'GAMEOVER_MODAL',
  CLEAR: 'CLEAR',
});

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
    WORDS_PER_UNIT: 7,      // 1유닛(스테이지)당 7단어 (총 약 700~714개 스테이지)
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
    CAPTURE_TIME_SEC: 0.7,       // 벙커 진입 발판 잠금 해제 소요 시간 (0.7초)
    RESPAWN_DELAY_SEC: 1.5,      // 확정 소멸 후 다음 비석 스폰 대기 시간 (1.5초)
    CAPTURE_RADIUS: 28,          // 벙커 해치 본체 물리 충돌 차단 반경 (28px 엄폐물)
    ENTRY_OFFSET_Y: 38,          // 정면 진입 발판 Y 오프셋 (+38px)
    ENTRY_RADIUS: 28,            // 정면 진입 발판 판정 반경 (28px)
    CORRECT_XP: 100,             // 정답 시 진화 XP 상승
    CORRECT_HEAL_RATIO: 0.04,    // 정답 시 체력 회복량: 최대 체력의 4% (과잉 회복 방지)
    WRONG_XP_PENALTY: -50,       // 오답 시 진화 XP 하락
    WRONG_SLOW_DURATION: 3.0,    // 오답 시 이동속도 저하 디버프 (3초)
    WRONG_SLOW_MULT: 0.55,       // 오답 디버프 이동속도 배율
    CORRECT_KNOCKBACK_RADIUS: 240, // 정답 충격파 반경
    CORRECT_KNOCKBACK_FORCE: 440,  // 정답 충격파 넉백 힘
  },

  PLAYER: {
    BASE_HP: 100,
    BASE_SPEED: 115,             // 캐릭터 비율 축소에 맞춘 묵직하고 정밀한 컨트롤 속도 (기존 160 대비 약 28% 하향)
    BASE_ATK: 10,
    RADIUS: 15,
    RENDER_SCALE: 1.05,
    PICKUP_RADIUS: 72,
    INVULN_DURATION: 0.45,
    LEVEL_UP_BASE_XP: 30,
    LEVEL_UP_XP_STEP: 22,
  },

  // 누적 스테이지 진행도 기반 4단계 외형 진화
  EVOLUTION_STAGES: [
    { stage: 0, minStage: 1,  key: 'evo.stage0', minXp: 0,     hpMult: 1.0,  atkMult: 1.0,  scale: 1.0,  icon: '🐶' },
    { stage: 1, minStage: 10, key: 'evo.stage1', minXp: 1500,  hpMult: 1.15, atkMult: 1.15, scale: 1.08, icon: '🐕' },
    { stage: 2, minStage: 30, key: 'evo.stage2', minXp: 5000,  hpMult: 1.35, atkMult: 1.35, scale: 1.16, icon: '⚔️' },
    { stage: 3, minStage: 70, key: 'evo.stage3', minXp: 12000, hpMult: 1.6,  atkMult: 1.65, scale: 1.25, icon: '🦸' },
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
    ULT_CHARGE_PER_KILL: 1.5,     // 기존 4 대비 37.5%로 대폭 하향 (판당 1~2회 전략적 충전)
    ULT_CHARGE_PER_CORRECT: 7,    // 기존 18 대비 38.8%로 대폭 하향
    ULT_DAMAGE_MULT: 6.5,
    ULT_RADIUS: 340,
    DAMAGE_TEXT_TTL: 0.65,
    GEM_XP_VALUE: 10,
    GEM_CHARGE_VALUE: 0.8,        // 기존 2 대비 40%로 대폭 하향
    GEM_TTL: 14,               // 14초 후 자연 소멸 (자석 스탯 가치 유지)
    BONE_DROP_CHANCE: 0.015,   // 희소 드롭 (🦴 뼈다귀: 로비 성장·친밀도 재화)
    MEDKIT_DROP_CHANCE: 0.005, // 극희소 드롭 (💊 구급상자: 즉시 체력 회복)
    MEDKIT_HEAL_RATIO: 0.3,    // 구급상자 획득 시 최대 체력의 30% 즉시 회복
  },

  ENEMIES: {
    MAX_ACTIVE: 48,
    SPAWN_INTERVAL_BASE: 0.95, // 초반 썰렁함 방지 및 1.4~1.5배 물량 상향
    SPAWN_INTERVAL_MIN: 0.32,
    RENDER_SCALE: 1.05,
    SPEED_CURVE: {
      EARLY_END_Q: 10,
      EARLY_STEP: 0.003,
      MID_END_Q: 20,
      MID_STEP: 0.008,
      LATE_STEP: 0.02,
      MAX_MULT: 1.35,
    },
    TYPES: {
      walker:      { hp: 28,  speed: 42, dmg: 8,  radius: 13, xp: 10, color: '#4ade80' },
      conehead:    { hp: 65,  speed: 40, dmg: 10, radius: 13, xp: 18, color: '#fb923c' },
      runner:      { hp: 22,  speed: 72, dmg: 10, radius: 11, xp: 14, color: '#f87171' },
      buckethead:  { hp: 120, speed: 36, dmg: 14, radius: 14, xp: 28, color: '#94a3b8' },
      newspaper:   { hp: 55,  speed: 34, dmg: 10, radius: 13, xp: 22, color: '#fef08a' },
      spitter:     { hp: 35,  speed: 38, dmg: 12, radius: 13, xp: 18, color: '#a3e635' },
      polevaulter: { hp: 45,  speed: 64, dmg: 12, radius: 12, xp: 20, color: '#cbd5e1' },
      screendoor:  { hp: 110, speed: 32, dmg: 14, radius: 14, xp: 26, color: '#64748b' },
      bomber:      { hp: 38,  speed: 52, dmg: 22, radius: 13, xp: 24, color: '#ef4444' },
      football:    { hp: 140, speed: 60, dmg: 18, radius: 15, xp: 35, color: '#b91c1c' },
      dancer:      { hp: 80,  speed: 44, dmg: 12, radius: 14, xp: 32, color: '#f43f5e' },
      miner:       { hp: 70,  speed: 40, dmg: 16, radius: 13, xp: 28, color: '#d97706' },
      ghost:       { hp: 50,  speed: 46, dmg: 14, radius: 12, xp: 26, color: '#c084fc' },
      balloon:     { hp: 42,  speed: 50, dmg: 12, radius: 12, xp: 25, color: '#fb7185' },
      gargantuar:  { hp: 350, speed: 26, dmg: 32, radius: 24, xp: 60, color: '#475569' },
      // 레거시 호환
      brute:       { hp: 82,  speed: 30, dmg: 16, radius: 18, xp: 24, color: '#c4b5fd' },
      armored:     { hp: 125, speed: 28, dmg: 18, radius: 17, xp: 30, color: '#93c5fd' },
    },
  },

  BOSS: {
    ENTRY_QUESTION_INDEX: 27, // 0-based (28번 문제 진입 시 등장)
    ZOOM_SEQUENCE_SEC: 1.5,   // 1.5초 줌아웃 → 줌인 연출
    HP_LOCK_THRESHOLDS: [0.66, 0.33, 0], // 3단 체력 잠금
    BASE_HP: 1200,
    BASE_SPEED: 54,
    BASE_DMG: 22,
    RADIUS: 31,
    RENDER_SCALE: 1.05,
    ENRAGE_SPEED_MULT: 1.38,
    ENRAGE_DMG_MULT: 1.35,
  },

  COMPANIONS: {
    MAX_ACTIVE: MAX_EQUIPPED_COMPANIONS,
    BASE_UPGRADE_GOLD: 35,
    UPGRADE_GOLD_GROWTH: 1.35,
    ATK_PER_LEVEL: 0.14,
  },

  TRAINING: {
    BASE_COST_GOLD: 15,
    COST_GROWTH: 1.35,
    ATK_BONUS_PER_LV: 1,
    HP_BONUS_PER_LV: 10,
    SPEED_BONUS_PER_LV: 0.02,
    SPEED_MAX_LV: 20,
    MAGNET_BONUS_PER_LV: 8,
    MAGNET_MAX_LV: 20,
    ULT_CHARGE_BONUS_PER_LV: 0.04,
    ULT_CHARGE_MAX_LV: 20,
    SHIELD_BONUS_PER_LV: 0.03,
    SHIELD_MAX_LV: 15,
    ITEMS: {
      atkLevel:    { baseCost: 15, growth: 1.35, maxLv: 99, perLv: 1 },
      hpLevel:     { baseCost: 15, growth: 1.35, maxLv: 99, perLv: 10 },
      speedLv:     { baseCost: 15, growth: 1.35, maxLv: 20, perLv: 0.02 },
      magnetLv:    { baseCost: 15, growth: 1.35, maxLv: 20, perLv: 8 },
      ultChargeLv: { baseCost: 20, growth: 1.35, maxLv: 20, perLv: 0.04 },
      shieldLv:    { baseCost: 20, growth: 1.35, maxLv: 15, perLv: 0.03 },
    },
  },

  OWNER_TRAINING: {
    BASE_COST_GOLD: 20,
    COST_GROWTH: 1.35,
    ITEMS: {
      hpLv:             { name: '기초 체력 단련', icon: '❤️', baseCost: 20, growth: 1.35, maxLv: 50, perLv: 15, unit: 'HP', desc: '주인의 최대 체력과 기력을 증가시킵니다.' },
      speedLv:          { name: '신속 발걸음', icon: '👟', baseCost: 25, growth: 1.35, maxLv: 20, perLv: 0.03, unit: '%', desc: '주인의 보행 및 추종 이동속도가 빨라집니다.' },
      cureEfficiencyLv: { name: '백신 항체 강화', icon: '💉', baseCost: 30, growth: 1.38, maxLv: 20, perLv: 0.05, unit: '%', desc: '벙커 해치 해독 시 회복 효율과 기력 완충 속도를 올립니다.' },
      supportAtkLv:     { name: '호신 사격술', icon: '🎯', baseCost: 25, growth: 1.35, maxLv: 50, perLv: 2, unit: '공격력', desc: '주인의 지원 사격(돌멩이/총기) 공격력을 강화합니다.' },
    },
  },

  SHOP: {
    SUPPLY_BOX_GEM_COST: 50,
    MINI_REVIEW_REWARD_GOLD: 25,
    MINI_REVIEW_REWARD_SNACKS: 2,
    REVIVE_HP_RATIO: 0.7,
  },

  TUTORIAL: {
    QUESTION_COUNT: 3,
    INITIAL_ZOMBIES: 18,
    STEP1_TARGET_KILLS: 1, // 기존 2마리에서 1마리로 50% 단축
    STEP1_MIN_MOVE_DIST: 16, // 기존 24px에서 조이스틱 반응 거리 단축
    STEP1_DELAY_SEC: 1.2, // 방향 전환 완료 후 최대 대기 시간 간격 단축
    STEP4_EXPLAIN_SEC: 1.8,
    STEP5_GEM_ULT_CHARGE: 34,
    STEP5_KILL_ULT_CHARGE: 12,
    STEP5_WAVE_ZOMBIES: 20,
    STEP6_COMPLETE_SEC: 1.55,
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

export function getOwnerTrainingUpgradeCost(key, currentLv = 0) {
  const cfg = BALANCE.OWNER_TRAINING?.ITEMS?.[key];
  const base = cfg ? cfg.baseCost : 20;
  const growth = cfg ? cfg.growth : 1.35;
  return Math.round(base * Math.pow(growth, Math.max(0, currentLv)));
}

export function getOwnerTrainingBonusValue(key, currentLv = 0) {
  const cfg = BALANCE.OWNER_TRAINING?.ITEMS?.[key];
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

  if (comp.unlockStage && (saveState?.maxUnlockedUnit || 1) >= comp.unlockStage) {
    return true;
  }

  const cond = comp.unlockCond || { type: 'chapter', chapter: comp.unlockChapter || 1 };
  const checker = COMPANION_UNLOCK_CHECKERS[cond.type];
  return checker ? checker(cond, saveState) : false;
}

/**
 * 스테이지 클리어 및 결과 보상 단일 진실 공급원 (Single Source of Truth)
 * @param {object} params
 * @param {boolean} params.cleared 클리어 여부
 * @param {boolean} params.isTutorial 튜토리얼 여부
 * @param {boolean} params.isPlacement 월반 도전 여부
 * @param {boolean} params.isPromotion 승급전 여부
 * @param {boolean} params.promoPassed 승급전 합격 여부
 * @param {number} params.stageNumber 현재 유닛/스테이지 번호 (1-based)
 * @param {number} params.maxUnlockedUnit 유저 최고 해금 유닛 번호 (기본 1)
 * @param {number} params.chapterNumber 챕터 번호
 * @param {number} params.correctCount 맞힌 문제 수
 * @param {number} params.wrongCount 틀린 문제 수
 * @param {number} params.podGoldEarned 인게임 전술 캡슐 개방 획득 금화
 * @param {number} params.baseChapterGold 챕터 기본 금화
 * @param {number} params.courseMult 코스 배율 (기본 1.0)
 * @param {boolean} params.hasBoss 챕터 보스 스테이지 여부
 * @param {number} params.earnedEvoXp 인게임 획득 진화 경험치
 * @param {number} params.chapterEvoBonus 챕터 클리어 진화 경험치 보너스
 * @param {number} params.kills 처치 좀비 수
 * @returns {{
 *   earnedGold: number,
 *   earnedSnacks: number,
 *   earnedEvoXp: number,
 *   earnedGems: number,
 *   stageScore: number,
 *   isFirstClear: boolean,
 *   isRepeatFarm: boolean,
 *   firstClearGoldBonus: number,
 *   bossGoldBonus: number
 * }}
 */
export function calcStageReward({
  cleared = false,
  isTutorial = false,
  isPlacement = false,
  isPromotion = false,
  promoPassed = false,
  stageNumber = 1,
  maxUnlockedUnit = 1,
  chapterNumber = 1,
  correctCount = 0,
  wrongCount = 0,
  podGoldEarned = 0,
  baseChapterGold = 35,
  courseMult = 1.0,
  hasBoss = false,
  earnedEvoXp = 0,
  chapterEvoBonus = 0,
  kills = 0,
} = {}) {
  if (isTutorial) {
    return {
      earnedGold: 0,
      earnedSnacks: 0,
      earnedEvoXp: earnedEvoXp + (cleared ? 50 : 0),
      earnedGems: 0,
      stageScore: (correctCount * 100) + (kills * 15) + (cleared ? 500 : 100),
      isFirstClear: true,
      isRepeatFarm: false,
      firstClearGoldBonus: 0,
      bossGoldBonus: 0,
    };
  }

  // 1. 반복 파밍 감쇠 및 최초 돌파 판정
  // 이미 클리어한 낮은 스테이지(stageNumber < maxUnlockedUnit)를 반복 플레이할 때는 스테이지 클리어 금화 보상을 50% 수준으로 감쇠
  const isRepeatFarm = cleared && (stageNumber < maxUnlockedUnit);
  const isFirstClear = cleared && (stageNumber >= maxUnlockedUnit);

  // 2. 기본 클리어 금화 + 정답당 금화
  const baseGold = cleared ? baseChapterGold : Math.round(baseChapterGold * 0.25);
  const wordGold = correctCount * 4;

  // 3. 챕터 보스 스테이지 클리어 굵직한 보너스
  let bossGoldBonus = 0;
  if (cleared && hasBoss) {
    bossGoldBonus = 60 + chapterNumber * 20;
  }

  // 4. 최초 스테이지 돌파 굵직한 보너스
  let firstClearGoldBonus = 0;
  if (isFirstClear) {
    firstClearGoldBonus = 40 + Math.min(80, stageNumber * 3);
  }

  // 5. 반복 파밍 감쇠 적용 (50% 수준)
  let stageClearSum = baseGold + wordGold;
  if (isRepeatFarm) {
    stageClearSum = Math.round(stageClearSum * 0.5);
  }

  // 6. 전술 구조 캡슐 개방 획득 금화는 파밍 감쇠 없이 온전히 보장
  const totalRawGold = (stageClearSum + bossGoldBonus + firstClearGoldBonus + podGoldEarned) * courseMult;
  const earnedGold = Math.max(1, Math.round(totalRawGold));

  // 7. 뼈다귀(간식) 보상
  let earnedSnacks = 0;
  if (isPromotion) {
    earnedSnacks = promoPassed ? 3 : 0;
  } else {
    earnedSnacks = cleared ? (wrongCount === 0 && correctCount > 0 ? 2 : 1) : 0;
  }

  // 8. 진화 경험치
  const evoBonus = cleared ? chapterEvoBonus : 0;
  const totalEvoXp = earnedEvoXp + evoBonus;

  // 9. 주간 리그 점수
  const baseScore = (correctCount * 100) + (kills * 15);
  const clearBonus = cleared ? 500 : 100;
  const stageScore = baseScore + clearBonus;

  return {
    earnedGold,
    earnedSnacks,
    earnedEvoXp: totalEvoXp,
    earnedGems: 0,
    stageScore,
    isFirstClear,
    isRepeatFarm,
    firstClearGoldBonus,
    bossGoldBonus,
  };
}

