/**
 * js/data/chapters.js
 * 미국 횡단 5개 챕터 테마, 네온 광장 크기, 챕터별 좀비 배율 및 보스/웨이브 테이블
 */

import { BALANCE } from '../config/balance.js';
import { getTotalUnits } from './data_en.js?v=2';

export const CHAPTERS = Object.freeze([
  {
    id: 'ch1',
    number: 1,
    title: '샌프란시스코 피어 39',
    subtitle: '안개 낀 부두에서 시작된 첫 번째 생존',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.0,
    enemyAtkMult: 1.0,
    enemySpeedMult: 1.0,
    goldReward: 30,
    evoXpBonus: 300,
    unlockCompanionId: 'rookie',
    theme: {
      groundBg: '#0b1324',
      gridColor: 'rgba(56, 189, 248, 0.12)',
      firewallColor: '#38bdf8',
      accentColor: '#22d3ee',
    },
    boss: {
      id: 'boss_ch1',
      name: '부두의 거대 선장 좀비',
      color: '#38bdf8',
      hpMult: 1.0,
      pattern: 'slam',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.35, types: ['walker', 'runner'] },
      { fromQ: 10, toQ: 19, spawnInterval: 1.05, types: ['walker', 'runner', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.85, types: ['walker', 'runner', 'brute', 'spitter'] },
      { fromQ: 28, toQ: 30, spawnInterval: 1.15, types: ['runner', 'brute'] },
    ],
  },
  {
    id: 'ch2',
    number: 2,
    title: '그랜드 캐니언 협곡',
    subtitle: '붉은 바위 광장을 뒤덮은 야생 좀비 떼',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.35,
    enemyAtkMult: 1.2,
    enemySpeedMult: 1.05,
    goldReward: 45,
    evoXpBonus: 450,
    unlockCompanionId: 'nuts',
    theme: {
      groundBg: '#1c1014',
      gridColor: 'rgba(251, 146, 60, 0.14)',
      firewallColor: '#fb923c',
      accentColor: '#f97316',
    },
    boss: {
      id: 'boss_ch2',
      name: '협곡의 골렘 폭주 좀비',
      color: '#fb923c',
      hpMult: 1.4,
      pattern: 'charge',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.2,  types: ['walker', 'runner', 'spitter'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.95, types: ['runner', 'brute', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.78, types: ['runner', 'brute', 'armored', 'spitter'] },
      { fromQ: 28, toQ: 30, spawnInterval: 1.05, types: ['brute', 'spitter'] },
    ],
  },
  {
    id: 'ch3',
    number: 3,
    title: '시카고 네온 다운타운',
    subtitle: '사이렌이 울리는 마천루 중앙 광장',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 1.75,
    enemyAtkMult: 1.45,
    enemySpeedMult: 1.1,
    goldReward: 55,
    evoXpBonus: 650,
    unlockCompanionId: 'max',
    theme: {
      groundBg: '#100d24',
      gridColor: 'rgba(167, 139, 250, 0.14)',
      firewallColor: '#a78bfa',
      accentColor: '#c084fc',
    },
    boss: {
      id: 'boss_ch3',
      name: '중장갑 SWAT 뮤턴트',
      color: '#a78bfa',
      hpMult: 1.85,
      pattern: 'shockwave',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 1.1,  types: ['runner', 'spitter', 'armored'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.85, types: ['runner', 'brute', 'armored', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.68, types: ['brute', 'armored', 'spitter', 'runner'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.95, types: ['armored', 'runner'] },
    ],
  },
  {
    id: 'ch4',
    number: 4,
    title: '마이애미 비치 보드워크',
    subtitle: '열대의 네온 야자수 아래 몰려오는 해안 군단',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.25,
    enemyAtkMult: 1.7,
    enemySpeedMult: 1.15,
    goldReward: 70,
    evoXpBonus: 900,
    unlockCompanionId: 'piji',
    theme: {
      groundBg: '#091a22',
      gridColor: 'rgba(45, 212, 191, 0.15)',
      firewallColor: '#2dd4bf',
      accentColor: '#f472b6',
    },
    boss: {
      id: 'boss_ch4',
      name: '네온 웨이브 타이탄',
      color: '#f472b6',
      hpMult: 2.35,
      pattern: 'barrage',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.95, types: ['runner', 'brute', 'spitter'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.75, types: ['runner', 'brute', 'armored', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.58, types: ['brute', 'armored', 'spitter', 'runner'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.85, types: ['armored', 'spitter'] },
    ],
  },
  {
    id: 'ch5',
    number: 5,
    title: '뉴욕 타임스퀘어',
    subtitle: '주인이 기다리는 최후의 전광판 광장!',
    arenaScale: BALANCE.ARENA.SCALE_MULTIPLIER,
    enemyHpMult: 2.85,
    enemyAtkMult: 2.0,
    enemySpeedMult: 1.2,
    goldReward: 85,
    evoXpBonus: 1300,
    unlockCompanionId: null,
    theme: {
      groundBg: '#120b1f',
      gridColor: 'rgba(250, 204, 21, 0.15)',
      firewallColor: '#facc15',
      accentColor: '#38bdf8',
    },
    boss: {
      id: 'boss_ch5',
      name: '오메가 바이러스 로드',
      color: '#f43f5e',
      hpMult: 3.0,
      pattern: 'omega',
    },
    waveTable: [
      { fromQ: 1,  toQ: 9,  spawnInterval: 0.85, types: ['runner', 'brute', 'armored', 'spitter'] },
      { fromQ: 10, toQ: 19, spawnInterval: 0.65, types: ['runner', 'brute', 'armored', 'spitter'] },
      { fromQ: 20, toQ: 27, spawnInterval: 0.48, types: ['brute', 'armored', 'spitter', 'runner'] },
      { fromQ: 28, toQ: 30, spawnInterval: 0.72, types: ['armored', 'brute', 'spitter'] },
    ],
  },
]);

/**
 * 챕터 번호(1~5) 또는 ID로 챕터 데이터 조회
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
 * 전체 유닛 수를 5개 챕터(CH.1 ~ CH.5)에 균등하게 동적 분할 매핑
 * @param {number} [totalUnits]
 * @returns {Array<{ chapter: number, start: number, end: number }>}
 */
export function getChapterUnitRanges(totalUnits) {
  const count = typeof totalUnits === 'number' && totalUnits > 0
    ? totalUnits
    : getTotalUnits();
  const numChapters = CHAPTERS.length; // 5
  const baseSize = Math.floor(count / numChapters);
  const remainder = count % numChapters;

  const ranges = [];
  let currentStart = 1;
  for (let i = 0; i < numChapters; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const end = Math.min(count, currentStart + size - 1);
    ranges.push({
      chapter: CHAPTERS[i].number,
      start: currentStart,
      end,
    });
    currentStart = end + 1;
  }
  return ranges;
}

/**
 * 특정 유닛 번호가 속한 챕터 번호 반환 (1~5)
 * @param {number} unitNum
 * @param {number} [totalUnits]
 * @returns {number}
 */
export function getChapterNumberForUnit(unitNum, totalUnits) {
  const ranges = getChapterUnitRanges(totalUnits);
  const found = ranges.find((r) => unitNum >= r.start && unitNum <= r.end);
  return found ? found.chapter : (unitNum < 1 ? 1 : CHAPTERS[CHAPTERS.length - 1].number);
}

