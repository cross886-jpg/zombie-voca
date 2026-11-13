/**
 * js/core/courseEngine.js
 * 학습 언어(en/es)별 독립 코스 진도 관리:
 * - 언어별 단어·유닛 풀 라우터 (전체 유닛을 4등급(A1~B2) × 3티어 = 12개 구간으로 균등 매핑)
 * - 현재 학습 유닛/진도 게이지(◈◇◇ ~ ◈◈◈) 계산 및 유닛 마스터 시 자동 진급
 * - 10문제 계단식 배치 테스트 출제 및 코스 확정
 */

import { getSave, updateSave, STUDY_CEFRS } from './saveStore.js';
import { getWords as getEnglishWords } from '../data/data_en.js?v=2';
import { getWords as getSpanishWords } from '../data/data_es.js';

/** 스페인어 단어 id가 영어 단어 id(wordStats 키)와 충돌하지 않도록 분리하는 오프셋 */
export const ES_ID_OFFSET = 100000;
export const BAND_COUNT = STUDY_CEFRS.length * 3;
export const PLACEMENT_QUESTION_COUNT = 10;
export const PLACEMENT_PASS_COUNT = 7;

export const TIER_GAUGE = Object.freeze({ 1: '◈◇◇', 2: '◈◈◇', 3: '◈◈◈' });

export const LANG_META = Object.freeze({
  en: { flag: '🇺🇸', name: '영어' },
  es: { flag: '🇪🇸', name: '스페인어' },
});

export const CEFR_META = Object.freeze({
  A1: '왕초보',
  A2: '초급',
  B1: '중급',
  B2: '고급',
});

/** 등급별 3티어 시작 코스 라벨 (tier 1 = ◈◇◇, 2 = ◈◈◇, 3 = ◈◈◈) */
export const COURSE_TIER_LABELS = Object.freeze({
  A1: ['완전 처음', '기초 단어 암기', '왕초보 마무리'],
  A2: ['여행·일상 시작', '기본 회화 확장', '초급 마무리'],
  B1: ['실전 표현 입문', '뉴스·업무 핵심', '중급 마무리'],
  B2: ['심화 어휘 도약', '원어민 관용구', '고급 마스터'],
});

const poolCache = {};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPool(lang) {
  const words = lang === 'es'
    ? getSpanishWords().map((w) => ({ ...w, id: w.id + ES_ID_OFFSET }))
    : getEnglishWords();
  const unitIds = [];
  const byUnit = new Map();
  for (const w of words) {
    if (!byUnit.has(w.unit)) {
      byUnit.set(w.unit, []);
      unitIds.push(w.unit);
    }
    byUnit.get(w.unit).push(w);
  }
  return { words, unitIds, byUnit };
}

function getPool(lang) {
  if (!poolCache[lang]) poolCache[lang] = buildPool(lang);
  return poolCache[lang];
}

export function unitIdFromIndex(unitIndex) {
  return `unit_${String(unitIndex + 1).padStart(3, '0')}`;
}

export function getLangWords(lang) {
  return getPool(lang).words;
}

export function getLangTotalUnits(lang) {
  return getPool(lang).unitIds.length;
}

export function getLangUnitWords(lang, unitIndex) {
  return getPool(lang).byUnit.get(unitIdFromIndex(unitIndex)) || [];
}

/** 구간(0~11) 시작 유닛 인덱스 (0-based) */
export function getBandStart(bandIdx, totalUnits) {
  return Math.floor((bandIdx * totalUnits) / BAND_COUNT);
}

export function getBandIndex(cefr, tier) {
  return STUDY_CEFRS.indexOf(cefr) * 3 + (tier - 1);
}

export function bandToCourse(bandIdx) {
  return { cefr: STUDY_CEFRS[Math.floor(bandIdx / 3)], tier: (bandIdx % 3) + 1 };
}

export function unitIndexToBand(unitIndex, totalUnits) {
  for (let i = BAND_COUNT - 1; i >= 0; i--) {
    if (unitIndex >= getBandStart(i, totalUnits)) return i;
  }
  return 0;
}

function collectUnitRangeWords(lang, startUnit, endUnit) {
  const pool = getPool(lang);
  const result = [];
  for (let u = startUnit; u <= endUnit; u++) {
    const list = pool.byUnit.get(unitIdFromIndex(u));
    if (list) result.push(...list);
  }
  return result;
}

/** 현재 구간(등급 × 티어) 전체 유닛의 단어 */
export function getBandWords(lang, bandIdx) {
  const total = getLangTotalUnits(lang);
  return collectUnitRangeWords(lang, getBandStart(bandIdx, total), getBandStart(bandIdx + 1, total) - 1);
}

/** CEFR 등급 전체(3티어) 유닛의 단어 */
export function getCefrWords(lang, cefr) {
  const total = getLangTotalUnits(lang);
  const firstBand = STUDY_CEFRS.indexOf(cefr) * 3;
  return collectUnitRangeWords(lang, getBandStart(firstBand, total), getBandStart(firstBand + 3, total) - 1);
}

export function getStudyLang() {
  return getSave().studyLang;
}

export function getActiveProgress() {
  const save = getSave();
  return save.courseProgress[save.studyLang];
}

export function getActiveWords() {
  return getLangWords(getStudyLang());
}

export function getActiveTotalUnits() {
  return getLangTotalUnits(getStudyLang());
}

export function getActiveCefrWords() {
  return getCefrWords(getStudyLang(), getActiveProgress().cefr);
}

/** 전투 벙커 퀴즈 출제용 현재 학습 유닛 id (전투 스테이지 번호와 무관) */
export function getCurrentStudyUnitId() {
  return unitIdFromIndex(getActiveProgress().unitIndex);
}

export function formatCourseBadge(save = getSave()) {
  const lang = save.studyLang;
  const p = save.courseProgress[lang];
  return `${LANG_META[lang].flag} ${p.cefr}`;
}

/**
 * 단어 마스터 기록 + 현재 학습 유닛 전체 마스터 시 다음 유닛/티어/등급으로 자동 진급
 * @param {number} wordId
 * @returns {boolean} 진급 여부
 */
export function recordStudyMastery(wordId) {
  updateSave((s) => {
    const p = s.courseProgress[s.studyLang];
    if (!p.masteredWords.includes(wordId)) p.masteredWords.push(wordId);
  });

  const save = getSave();
  const lang = save.studyLang;
  const total = getLangTotalUnits(lang);
  let nextIndex = save.courseProgress[lang].unitIndex;
  const isUnitMastered = (idx) => {
    const list = getLangUnitWords(lang, idx);
    return list.length > 0 && list.every((w) => save.wordStats[String(w.id)]?.mastered);
  };

  while (nextIndex < total - 1 && isUnitMastered(nextIndex)) {
    nextIndex += 1;
  }
  if (nextIndex === save.courseProgress[lang].unitIndex) return false;

  const course = bandToCourse(unitIndexToBand(nextIndex, total));
  updateSave((s) => {
    const p = s.courseProgress[lang];
    p.unitIndex = nextIndex;
    p.cefr = course.cefr;
    p.tier = course.tier;
  });
  return true;
}

export function switchStudyLang(lang) {
  updateSave((s) => {
    s.studyLang = lang;
  });
}

/** 선택한 언어/등급/티어의 시작 유닛으로 코스 확정 (다른 언어 진도는 보존) */
export function confirmCourseSelection(lang, cefr, tier) {
  const total = getLangTotalUnits(lang);
  const startIndex = getBandStart(getBandIndex(cefr, tier), total);
  updateSave((s) => {
    s.studyLang = lang;
    const p = s.courseProgress[lang];
    p.cefr = cefr;
    p.tier = tier;
    p.unitIndex = startIndex;
    s.courseOnboardingDone = true;
  });
}

/**
 * 선택 구간 전체 유닛에서 서로 다른 단어 10문제를 무작위 추출해 난이도(순번)순 4지선다로 구성
 * @returns {Array<{ word: string, phonetic: string, choices: Array<{ meaning: string, isCorrect: boolean }> }>}
 */
export function buildPlacementTest(lang, cefr, tier) {
  const pool = getBandWords(lang, getBandIndex(cefr, tier));
  const picked = shuffle(pool)
    .slice(0, PLACEMENT_QUESTION_COUNT)
    .sort((a, b) => a.id - b.id);

  return picked.map((target) => {
    const distractors = [];
    const usedMeanings = new Set([target.meaning]);
    for (const cand of shuffle(pool)) {
      if (distractors.length >= 3) break;
      if (usedMeanings.has(cand.meaning)) continue;
      usedMeanings.add(cand.meaning);
      distractors.push(cand);
    }
    const choices = shuffle([
      { meaning: target.meaning, isCorrect: true },
      ...distractors.map((d) => ({ meaning: d.meaning, isCorrect: false })),
    ]);
    return { word: target.word, phonetic: target.phonetic || '', choices };
  });
}

