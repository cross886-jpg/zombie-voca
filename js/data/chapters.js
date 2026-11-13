/**
 * js/data/chapters.js
 * 10개 챕터 전장 테마, 좀비 15종 누적 합류 웨이브 테이블 및 챕터별 군단장 보스 10종
 */

import { BALANCE } from '../config/balance.js';
import { getTotalUnits } from './data_en.js?v=2';

export const CHAPTERS = Object.freeze([
  {
    id: 'ch1',
    number: 1,
    title: '도심 외곽 아스팔트 거리',
    subtitle: '네온 신호등과 버려진 차량 사이로 몰려오는 좀비 무리',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.0,
    enemyAtkMult: 1.0,
    enemySpeedMult: 1.0,
    goldReward: 30,
    evoXpBonus: 300,
    unlockCompanionId: 'rookie',
    theme: {
      groundBg: '#131722',
      gridColor: 'rgba(255, 255, 255, 0.08)',
      firewallColor: '#38bdf8',
      accentColor: '#22d3ee',
      detailType: 'asphalt',
    },
    boss: {
      id: 'boss_ch1',
      name: '도심 경비대장 좀비',
      color: '#38bdf8',
      hpMult: 1.0,
      pattern: 'whistle',
      role: 'guard',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.35, types: ['walker'] },
      { fromQ: 10, toQ: 19, spawnInterval: 1.05, types: ['walker', 'conehead'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.85, types: ['walker', 'conehead', 'runner'] },
      { fromQ: 28, toQ: 30, spawnInterval: 1.15, types: ['conehead', 'runner'] },
    ],
  },
  {
    id: 'ch2',
    number: 2,
    title: '폐쇄된 지하철 & 공사 현장',
    subtitle: '붉은 녹슨 철로와 공사 펜스 사이를 파고드는 중장갑 무리',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.25,
    enemyAtkMult: 1.15,
    enemySpeedMult: 1.04,
    goldReward: 45,
    evoXpBonus: 450,
    unlockCompanionId: 'nuts',
    theme: {
      groundBg: '#1a1614',
      gridColor: 'rgba(249, 115, 22, 0.14)',
      firewallColor: '#f97316',
      accentColor: '#fb923c',
      detailType: 'subway',
    },
    boss: {
      id: 'boss_ch2',
      name: '공사장 불도저 좀비',
      color: '#f97316',
      hpMult: 1.25,
      pattern: 'bulldozer',
      role: 'bulldozer',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.25, types: ['walker', 'conehead', 'newspaper'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.95, types: ['conehead', 'runner', 'newspaper'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.78, types: ['conehead', 'buckethead', 'newspaper', 'runner'] },
      { fromQ: 28, toQ: 30, spawnInterval: 1.05, types: ['buckethead', 'newspaper'] },
    ],
  },
  {
    id: 'ch3',
    number: 3,
    title: '오염된 하수 처리장 & 폐연구소',
    subtitle: '유독성 슬러지와 깨진 시험관 속에서 튀어나온 돌연변이',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.5,
    enemyAtkMult: 1.3,
    enemySpeedMult: 1.08,
    goldReward: 60,
    evoXpBonus: 600,
    unlockCompanionId: 'max',
    theme: {
      groundBg: '#0a1811',
      gridColor: 'rgba(34, 197, 94, 0.15)',
      firewallColor: '#22c55e',
      accentColor: '#4ade80',
      detailType: 'sewer',
    },
    boss: {
      id: 'boss_ch3',
      name: '독극물 박사 좀비',
      color: '#22c55e',
      hpMult: 1.5,
      pattern: 'toxic',
      role: 'toxic',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.15, types: ['walker', 'conehead', 'spitter'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.88, types: ['buckethead', 'spitter', 'polevaulter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.72, types: ['spitter', 'polevaulter', 'newspaper', 'buckethead'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.95, types: ['polevaulter', 'spitter'] },
    ],
  },
  {
    id: 'ch4',
    number: 4,
    title: '봉쇄된 경찰서 & 바리케이드 광장',
    subtitle: '점멸하는 경광등 아래 중무장한 경찰 좀비 부대의 포위망',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.75,
    enemyAtkMult: 1.45,
    enemySpeedMult: 1.12,
    goldReward: 75,
    evoXpBonus: 800,
    unlockCompanionId: 'piji',
    theme: {
      groundBg: '#0b1324',
      gridColor: 'rgba(59, 130, 246, 0.16)',
      firewallColor: '#6366f1',
      accentColor: '#3b82f6',
      detailType: 'police',
    },
    boss: {
      id: 'boss_ch4',
      name: '방탄 진압대장 좀비',
      color: '#6366f1',
      hpMult: 1.75,
      pattern: 'riot_shield',
      role: 'riot',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.05, types: ['buckethead', 'screendoor', 'runner'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.82, types: ['screendoor', 'bomber', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.65, types: ['screendoor', 'bomber', 'buckethead', 'polevaulter'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.85, types: ['screendoor', 'bomber'] },
    ],
  },
  {
    id: 'ch5',
    number: 5,
    title: '네온 번화가 & 클럽 스트리트',
    subtitle: '눈부신 네온사인 아래 춤추며 몰려오는 광란의 댄서 군단',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.0,
    enemyAtkMult: 1.6,
    enemySpeedMult: 1.16,
    goldReward: 90,
    evoXpBonus: 1050,
    unlockCompanionId: null,
    theme: {
      groundBg: '#180828',
      gridColor: 'rgba(236, 72, 153, 0.18)',
      firewallColor: '#ec4899',
      accentColor: '#f43f5e',
      detailType: 'club',
    },
    boss: {
      id: 'boss_ch5',
      name: '디스코 킹 좀비',
      color: '#ec4899',
      hpMult: 2.0,
      pattern: 'disco',
      role: 'disco',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.95, types: ['runner', 'football', 'dancer'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.75, types: ['football', 'dancer', 'bomber'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.58, types: ['football', 'dancer', 'screendoor', 'spitter'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.78, types: ['football', 'dancer'] },
    ],
  },
  {
    id: 'ch6',
    number: 6,
    title: '폐광산 & 어두운 공동묘지',
    subtitle: '음산한 묘비와 버려진 갱도에서 솟구치는 언데드 영혼들',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.25,
    enemyAtkMult: 1.75,
    enemySpeedMult: 1.2,
    goldReward: 110,
    evoXpBonus: 1300,
    unlockCompanionId: null,
    theme: {
      groundBg: '#121316',
      gridColor: 'rgba(167, 243, 208, 0.12)',
      firewallColor: '#2dd4bf',
      accentColor: '#14b8a6',
      detailType: 'graveyard',
    },
    boss: {
      id: 'boss_ch6',
      name: '심연의 강령술사 좀비',
      color: '#2dd4bf',
      hpMult: 2.3,
      pattern: 'necromancer',
      role: 'necro',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.9,  types: ['miner', 'ghost', 'newspaper'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.7,  types: ['miner', 'ghost', 'football', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.54, types: ['miner', 'ghost', 'bomber', 'screendoor'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.72, types: ['miner', 'ghost'] },
    ],
  },
  {
    id: 'ch7',
    number: 7,
    title: '태엽 시계탑 & 비행선 격납고',
    subtitle: '거대한 황동 톱니와 공중을 부양하는 비행선 좀비 부대',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.5,
    enemyAtkMult: 1.9,
    enemySpeedMult: 1.24,
    goldReward: 130,
    evoXpBonus: 1600,
    unlockCompanionId: null,
    theme: {
      groundBg: '#1c1510',
      gridColor: 'rgba(217, 119, 6, 0.15)',
      firewallColor: '#d97706',
      accentColor: '#f59e0b',
      detailType: 'steampunk',
    },
    boss: {
      id: 'boss_ch7',
      name: '스팀펑크 비행선 좀비',
      color: '#d97706',
      hpMult: 2.6,
      pattern: 'airship',
      role: 'airship',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.85, types: ['balloon', 'football', 'runner'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.65, types: ['balloon', 'miner', 'bomber', 'ghost'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.5,  types: ['balloon', 'football', 'screendoor', 'dancer'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.68, types: ['balloon', 'football'] },
    ],
  },
  {
    id: 'ch8',
    number: 8,
    title: '무너진 고속도로 & 대교 위',
    subtitle: '붕괴된 대교 상판에서 거대한 전봇대를 휘두르는 골리앗',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.8,
    enemyAtkMult: 2.1,
    enemySpeedMult: 1.28,
    goldReward: 150,
    evoXpBonus: 1900,
    unlockCompanionId: null,
    theme: {
      groundBg: '#111622',
      gridColor: 'rgba(250, 204, 21, 0.14)',
      firewallColor: '#eab308',
      accentColor: '#facc15',
      detailType: 'highway',
    },
    boss: {
      id: 'boss_ch8',
      name: '거인 군단장 가르강튀아',
      color: '#eab308',
      hpMult: 2.9,
      pattern: 'gargantuar',
      role: 'gargantuar',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.8,  types: ['gargantuar', 'football', 'balloon'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.6,  types: ['gargantuar', 'screendoor', 'bomber', 'miner'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.46, types: ['gargantuar', 'football', 'dancer', 'ghost'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.62, types: ['gargantuar', 'football'] },
    ],
  },
  {
    id: 'ch9',
    number: 9,
    title: '최첨단 로봇 공학 벙커 기지',
    subtitle: '티타늄 방벽과 레이저 그리드를 뚫고 진격하는 사이보그 병기들',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 3.15,
    enemyAtkMult: 2.3,
    enemySpeedMult: 1.32,
    goldReward: 170,
    evoXpBonus: 2200,
    unlockCompanionId: null,
    theme: {
      groundBg: '#06131d',
      gridColor: 'rgba(6, 182, 212, 0.18)',
      firewallColor: '#06b6d4',
      accentColor: '#22d3ee',
      detailType: 'cyber',
    },
    boss: {
      id: 'boss_ch9',
      name: '사이보그 메카 좀비',
      color: '#06b6d4',
      hpMult: 3.2,
      pattern: 'cyborg',
      role: 'cyborg',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.75, types: ['football', 'gargantuar', 'bomber', 'balloon'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.55, types: ['screendoor', 'miner', 'ghost', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.42, types: ['gargantuar', 'football', 'dancer', 'bomber'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.58, types: ['gargantuar', 'football', 'bomber'] },
    ],
  },
  {
    id: 'ch10',
    number: 10,
    title: '붉은 달의 좀비 왕국 성채',
    subtitle: '붉은 보름달 아래 모든 언데드 군단을 호령하는 절대 군주',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 3.5,
    enemyAtkMult: 2.5,
    enemySpeedMult: 1.35,
    goldReward: 200,
    evoXpBonus: 2600,
    unlockCompanionId: null,
    theme: {
      groundBg: '#1a090e',
      gridColor: 'rgba(239, 68, 68, 0.18)',
      firewallColor: '#ef4444',
      accentColor: '#f43f5e',
      detailType: 'bloodmoon',
    },
    boss: {
      id: 'boss_ch10',
      name: '좀비 킹 (최종 군주)',
      color: '#ef4444',
      hpMult: 3.6,
      pattern: 'zombie_king',
      role: 'king',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.7,  types: ['football', 'gargantuar', 'dancer', 'ghost'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.5,  types: ['balloon', 'bomber', 'screendoor', 'miner'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.38, types: ['gargantuar', 'football', 'dancer', 'balloon', 'ghost'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.52, types: ['gargantuar', 'football', 'dancer'] },
    ],
  },
]);

/**
 * 챕터 번호(1~10) 또는 ID로 챕터 데이터 조회
 * @param {number|string} idOrNumber
 * @returns {object}
 */
export function getChapter(idOrNumber) {
  return (
    CHAPTERS.find((c) => c.id === idOrNumber || c.number === Number(idOrNumber)) ||
    CHAPTERS[0]
  );
}

/**
 * 현재 문제 번호(1~30)에 해당하는 웨이브 설정 반환
 * @param {object} chapter
 * @param {number} questionNumber (1-based)
 * @returns {object}
 */
export function getWaveForQuestion(chapter, questionNumber) {
  const table = chapter?.waveTable || CHAPTERS[0].waveTable;
  return (
    table.find((w) => questionNumber >= w.fromQ && questionNumber <= w.toQ) ||
    table[table.length - 1]
  );
}

/**
 * 10개 챕터 스테이지 범위 정의 (10스테이지당 1챕터: Ch.1 1~10, Ch.2 11~20, ..., Ch.10 91+)
 * @param {number} [totalUnits]
 * @returns {Array<{ chapter: number, start: number, end: number }>}
 */
/**
 * 특정 유닛/스테이지 번호가 속한 챕터 번호 반환 (10스테이지당 1챕터: Ch.1 ~ Ch.10)
 * @param {number} unitNum
 * @param {number} [totalUnits]
 * @returns {number}
 */
export function getChapterNumberForUnit(unitNum, totalUnits) {
  const n = Number(unitNum) || 1;
  if (n <= 10) return 1;
  if (n <= 20) return 2;
  if (n <= 30) return 3;
  if (n <= 40) return 4;
  if (n <= 50) return 5;
  if (n <= 60) return 6;
  if (n <= 70) return 7;
  if (n <= 80) return 8;
  if (n <= 90) return 9;
  return 10;
}
