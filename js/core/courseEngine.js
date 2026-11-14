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

/** 9단계 세분화 단어 레벨 정의 (초급·중급·고급 × Lv.1 / Lv.2 / Lv.3) */
export const WORD_LEVEL_TIERS = Object.freeze([
  // 🌱 초급 (A1)
  {
    id: 'beginner_lv1',
    group: '초급',
    groupIcon: '🌱',
    groupCefr: 'A1',
    level: 1,
    label: '초급 Lv.1',
    badgeLabel: '초급 Lv.1',
    unitOffset: 0,
    unit: 1,
    cefr: 'A1',
    recommendMsg: '기초부터 탄탄하게 시작해 볼까요?',
  },
  {
    id: 'beginner_lv2',
    group: '초급',
    groupIcon: '🌱',
    groupCefr: 'A1',
    level: 2,
    label: '초급 Lv.2',
    badgeLabel: '초급 Lv.2',
    unitOffset: 80,
    unit: 80,
    cefr: 'A1',
    recommendMsg: '기초 어휘를 빠르게 마스터해 보세요!',
  },
  {
    id: 'beginner_lv3',
    group: '초급',
    groupIcon: '🌱',
    groupCefr: 'A1',
    level: 3,
    label: '초급 Lv.3',
    badgeLabel: '초급 Lv.3',
    unitOffset: 160,
    unit: 160,
    cefr: 'A2',
    recommendMsg: '탄탄한 기초를 바탕으로 도약해 보세요!',
  },

  // 🌿 중급 (A2~B1)
  {
    id: 'intermediate_lv1',
    group: '중급',
    groupIcon: '🌿',
    groupCefr: 'A2~B1',
    level: 1,
    label: '중급 Lv.1',
    badgeLabel: '중급 Lv.1',
    unitOffset: 240,
    unit: 240,
    cefr: 'B1',
    recommendMsg: '실전 회화와 독해에 도전해 보세요!',
  },
  {
    id: 'intermediate_lv2',
    group: '중급',
    groupIcon: '🌿',
    groupCefr: 'A2~B1',
    level: 2,
    label: '중급 Lv.2',
    badgeLabel: '중급 Lv.2',
    unitOffset: 320,
    unit: 320,
    cefr: 'B1',
    recommendMsg: '중급 핵심 어휘를 완벽히 정복해 보세요!',
  },
  {
    id: 'intermediate_lv3',
    group: '중급',
    groupIcon: '🌿',
    groupCefr: 'A2~B1',
    level: 3,
    label: '중급 Lv.3',
    badgeLabel: '중급 Lv.3',
    unitOffset: 400,
    unit: 400,
    cefr: 'B1',
    recommendMsg: '풍부한 어휘로 실전 응용력을 키워보세요!',
  },

  // 🔥 고급 (B2~C1)
  {
    id: 'advanced_lv1',
    group: '고급',
    groupIcon: '🔥',
    groupCefr: 'B2~C1',
    level: 1,
    label: '고급 Lv.1',
    badgeLabel: '고급 Lv.1',
    unitOffset: 480,
    unit: 480,
    cefr: 'B2',
    recommendMsg: '실력이 뛰어나시네요! 심화 단어로 도전해 보세요!',
  },
  {
    id: 'advanced_lv2',
    group: '고급',
    groupIcon: '🔥',
    groupCefr: 'B2~C1',
    level: 2,
    label: '고급 Lv.2',
    badgeLabel: '고급 Lv.2',
    unitOffset: 560,
    unit: 560,
    cefr: 'B2',
    recommendMsg: '고급 독해와 관용 표현을 마스터해 보세요!',
  },
  {
    id: 'advanced_lv3',
    group: '고급',
    groupIcon: '🔥',
    groupCefr: 'B2~C1',
    level: 3,
    label: '고급 Lv.3',
    badgeLabel: '고급 Lv.3',
    unitOffset: 640,
    unit: 640,
    cefr: 'C1',
    recommendMsg: '최상위 마스터 어휘에 도전해 보세요!',
  },
]);

export function getTierForUnit(unitNum) {
  const n = Number(unitNum) || 1;
  for (let i = WORD_LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (n >= WORD_LEVEL_TIERS[i].unit) {
      return WORD_LEVEL_TIERS[i];
    }
  }
  return WORD_LEVEL_TIERS[0];
}

export function calcQuizRecommendedTier(score) {
  const s = Math.max(0, Number(score) || 0);
  if (s >= 6) return WORD_LEVEL_TIERS.find((t) => t.id === 'advanced_lv1') || WORD_LEVEL_TIERS[6];
  if (s === 5) return WORD_LEVEL_TIERS.find((t) => t.id === 'intermediate_lv2') || WORD_LEVEL_TIERS[4];
  if (s === 4) return WORD_LEVEL_TIERS.find((t) => t.id === 'intermediate_lv1') || WORD_LEVEL_TIERS[3];
  if (s === 3) return WORD_LEVEL_TIERS.find((t) => t.id === 'beginner_lv3') || WORD_LEVEL_TIERS[2];
  if (s === 2) return WORD_LEVEL_TIERS.find((t) => t.id === 'beginner_lv2') || WORD_LEVEL_TIERS[1];
  return WORD_LEVEL_TIERS[0];
}

// 하위 호환
export const calcPlacementTier = calcQuizRecommendedTier;

export const NAME_BLACKLIST = new Set([
  'harris', 'smith', 'john', 'mary', 'james', 'robert', 'michael', 'william', 'david',
  'richard', 'joseph', 'thomas', 'charles', 'juan', 'carlos', 'maria', 'pedro', 'luis',
  'ana', 'george', 'edward', 'paul', 'mark', 'elizabeth', 'sarah', 'linda', 'barbara',
  'susan', 'jessica', 'margaret', 'dorothy', 'lisa', 'nancy', 'karen', 'betty', 'helen',
  'sandra', 'donna', 'carol', 'ruth', 'sharon', 'michelle', 'laura', 'kimberly', 'deborah',
  'anthony', 'brian', 'kevin', 'jason', 'matthew', 'gary', 'timothy', 'jose', 'larry',
  'jeffrey', 'frank', 'scott', 'eric', 'stephen', 'andrew', 'raymond', 'gregory', 'joshua',
  'jerry', 'dennis', 'walter', 'patrick', 'peter', 'harold', 'douglas', 'henry', 'carl',
  'arthur', 'ryan', 'roger', 'joe', 'jack', 'albert', 'jonathan', 'justin', 'terry',
  'gerald', 'keith', 'samuel', 'willie', 'ralph', 'lawrence', 'nicholas', 'roy', 'benjamin',
  'bruce', 'brandon', 'adam', 'harry', 'fred', 'wayne', 'billy', 'steve', 'louis', 'jeremy',
  'aaron', 'randy', 'howard', 'eugene', 'russell', 'bobby', 'victor', 'martin', 'ernest',
  'phillip', 'todd', 'jesse', 'craig', 'alan', 'shawn', 'clarence', 'sean', 'philip',
  'chris', 'johnny', 'earl', 'jimmy', 'antonio', 'danny', 'bryan', 'tony', 'mike', 'stanley',
  'leonard', 'nathan', 'dale', 'manuel', 'rodney', 'curtis', 'norman', 'allen', 'marvin',
  'vincent', 'glenn', 'travis', 'jeff', 'chad', 'jacob', 'lee', 'melvin', 'alfred', 'kyle',
  'francis', 'bradley', 'jesus', 'herbert', 'frederick', 'ray', 'joel', 'edwin', 'don',
  'eddie', 'ricky', 'troy', 'randall', 'barry', 'alexander', 'bernard', 'mario', 'leroy',
  'francisco', 'marcus', 'theodore', 'clifford', 'miguel', 'oscar', 'jay', 'jim', 'tom',
  'calvin', 'alex', 'jon', 'ronnie', 'bill', 'lloyd', 'tommy', 'leon', 'derek', 'warren',
  'darrell', 'jerome', 'floyd', 'leo', 'alvin', 'tim', 'wesley', 'gordon', 'dean', 'greg',
  'jorge', 'dustin', 'dan', 'lewis', 'zachary', 'corey', 'herman', 'maurice', 'vernon',
  'roberto', 'clyde', 'glen', 'hector', 'shane', 'ricardo', 'sam', 'rick', 'lester',
  'brent', 'ramon', 'charlie', 'tyler', 'gilbert', 'gene', 'marc', 'reginald', 'ruben',
  'brett', 'angel', 'nathaniel', 'rafael', 'leslie', 'edgar', 'milton', 'raul', 'ben',
  'chester', 'cecil', 'duane', 'franklin', 'andre', 'elmer', 'brad', 'gabriel', 'ronald',
  'doug', 'molly', 'lucy', 'daisy', 'oliver', 'charlotte', 'amelia', 'harper', 'evelyn',
  'abigail', 'emily', 'ella', 'camila', 'luna', 'sofia', 'avery', 'mila', 'aria',
  'scarlett', 'penelope', 'layla', 'chloe', 'victoria', 'madison', 'eleanor', 'grace',
  'nora', 'riley', 'zoey', 'hannah', 'hazel', 'lily', 'ellie', 'violet', 'lillian',
  'zoe', 'stella', 'aurora', 'natalie', 'emilia', 'everly', 'leah', 'aubrey', 'willow',
  'addison', 'audrey', 'bella', 'claire', 'skylar', 'isla', 'genesis', 'naomi', 'elena',
  'caroline', 'eliana', 'anna', 'maya', 'valentina', 'ruby', 'kennedy', 'ivy', 'ariana',
  'miller', 'davis', 'garcia', 'rodriguez', 'wilson', 'martinez', 'anderson', 'taylor',
  'hernandez', 'moore', 'jackson', 'thompson', 'white', 'lopez', 'gonzalez', 'clark',
  'robinson', 'walker', 'perez', 'hall', 'young', 'sanchez', 'wright', 'king', 'baker',
  'adams', 'nelson', 'hill', 'ramirez', 'campbell', 'mitchell', 'roberts', 'carter',
  'phillips', 'evans', 'turner', 'torres', 'parker', 'collins', 'edwards', 'stewart',
  'flores', 'morris', 'nguyen', 'murphy', 'rivera', 'cook', 'rogers', 'morgan',
  'peterson', 'cooper', 'reed', 'bailey', 'bell', 'gomez', 'kelly', 'ward', 'cox',
  'diaz', 'richardson', 'wood', 'watson', 'brooks', 'bennett', 'gray', 'reyes',
  'cruz', 'hughes', 'price', 'myers', 'long', 'foster', 'sanders', 'ross', 'morales',
  'powell', 'sullivan', 'ortiz', 'jenkins', 'gutierrez', 'perry', 'butler', 'barnes', 'fisher',
]);

export const KNOWN_PROPER_NAMES = new Set([
  '해리스', '스미스', '존', '메리', '제임스', '로버트', '마이클', '윌리엄', '데이비드', '리차드', '리처드',
  '조셉', '토마스', '찰스', '후안', '카를로스', '마리아', '페드로', '루이스', '아나', '피터', '더그',
  '몰리', '잭', '톰', '조지', '에드워드', '폴', '마크', '엘리자베스', '사라', '린다', '바바라', '수잔',
  '제시카', '마가렛', '도로시', '리사', '낸시', '카렌', '베티', '헬렌', '산드라', '도나', '캐롤', '루스',
  '샤론', '미셸', '로라', '킴벌리', '데보라', '앤서니', '브라이언', '케빈', '제이슨', '매튜', '게리',
  '티모시', '호세', '래리', '제프리', '프랭크', '스콧', '에릭', '스티븐', '앤드류', '레이몬드', '그레고리',
  '조슈아', '제리', '데니스', '월터', '패트릭', '해롤드', '더글러스', '헨리', '칼', '아서', '라이언',
  '로저', '조', '앨버트', '조나단', '저스틴', '테리', '제럴드', '키스', '사무엘', '윌리', '랄프', '로렌스',
  '니콜라스', '로이', '벤자민', '브루스', '브랜든', '아담', '해리', '프레드', '웨인', '빌리', '스티브',
  '제레미', '아론', '랜디', '하워드', '유진', '러셀', '바비', '빅터', '마틴', '어니스트', '필립',
  '토드', '제시', '크레이그', '앨런', '숀', '클라렌스', '조니', '얼', '지미', '안토니오', '대니',
  '토니', '마이크', '스탠리', '레너드', '네이선', '데일', '마누엘', '로드니', '커티스', '노먼', '마빈',
  '빈센트', '글렌', '트래비스', '제프', '채드', '제이콥', '리', '멜빈', '알프레드', '카일', '프랜시스',
  '헤르베르트', '레이', '조엘', '에드윈', '돈', '에디', '리키', '트로이', '랜달', '배리', '알렉산더',
  '버나드', '마리오', '르로이', '프란시스코', '마커스', '시어도어', '클리포드', '미겔', '오스카', '제이',
  '짐', '캘빈', '알렉스', '로니', '빌', '로이드', '토미', '레온', '데릭', '워렌', '대럴', '제롬',
  '플로이드', '레오', '앨빈', '팀', '웨슬리', '고든', '딘', '그렉', '호르헤', '더스틴', '댄',
  '재커리', '코리', '허먼', '모리스', '버넌', '로베르토', '클라이드', '헥터', '셰인', '리카르도', '샘',
  '릭', '레스터', '브렌트', '라몬', '찰리', '타일러', '길버트', '진', '레지널드', '루벤', '브렛',
  '엔젤', '나다니엘', '라파엘', '레슬리', '에드가', '밀턴', '라울', '벤', '체스터', '세실', '듀안',
  '프랭클린', '앙드레', '엘머', '브래드', '가브리엘', '로널드', '밀러', '데이비스', '가르시아', '로드리게스',
  '윌슨', '마르티네스', '앤더슨', '테일러', '에르난데스', '무어', '잭슨', '톰슨', '화이트', '로페스',
  '곤잘레스', '클라크', '로빈슨', '워커', '페레스', '홀', '영', '산체스', '라이트', '베이커', '아담스',
  '넬슨', '힐', '라미레스', '캠벨', '미첼', '로버츠', '카터', '에반스', '터너', '토레스', '파커',
  '콜린스', '에드워즈', '스튜어트', '플로레스', '모리스', '응우옌', '머피', '리베라', '쿠퍼', '피터슨',
  '모건', '베일리', '벨', '고메스', '켈리', '워드', '콕스', '디아스', '리차드슨', '왓슨', '브룩스',
  '베넷', '그레이', '레예스', '크루즈', '휴즈', '프라이스', '마이어스', '롱', '포스터', '샌더스', '로스',
  '모랄레스', '파월', '설리반', '오르티스', '젠킨스', '구티에레스', '페리', '버틀러', '반스', '피셔'
]);

/**
 * 인명·고유명사 여부 판별 (소문자 인명, 원어 대문자, 한글 뜻 음역 포괄 검사)
 * @param {object} wordObj
 * @returns {boolean}
 */
export function isProperNoun(wordObj) {
  if (!wordObj) return true;
  const rawWord = String(wordObj.word || wordObj.en || wordObj.es || '').trim();
  if (!rawWord) return true;

  // 1. 원어가 영문 대문자 또는 강세 대문자로 시작하는 단어 제외 (인명, 지명 등)
  if (/^[A-ZÁÉÍÓÚÑ]/.test(rawWord)) return true;

  // 2. 소문자 인명 블랙리스트 체크
  const lower = rawWord.toLowerCase();
  if (NAME_BLACKLIST.has(lower)) return true;

  // 3. 품사가 고유명사인 경우
  if (wordObj.pos === 'propn' || wordObj.pos === 'noun_prop') return true;

  // 4. 한글 뜻 검사
  const meaning = String(wordObj.meaning || '').trim();
  if (!meaning) return true;
  if (KNOWN_PROPER_NAMES.has(meaning)) return true;

  // 한글 뜻에 쉼표나 슬래시로 구분된 항목 중 하나라도 블랙리스트 인명인 경우
  const splitMeanings = meaning.split(/[,/·\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const m of splitMeanings) {
    if (KNOWN_PROPER_NAMES.has(m)) return true;
  }

  return false;
}

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
  const rawWords = lang === 'es'
    ? getSpanishWords().map((w) => ({ ...w, id: w.id + ES_ID_OFFSET }))
    : getEnglishWords();
  const words = rawWords.filter((w) => !isProperNoun(w));
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

/**
 * 전투 벙커 퀴즈 출제용 학습 유닛 id 계산:
 * 현재 게임 스테이지 번호(기본 1)에 선택한 단어 난이도 오프셋(wordUnitOffset)을 더한 유닛 반환
 * @param {string|number} [stageUnitId]
 * @returns {string} (예: 'unit_481')
 */
export function getEffectiveStudyUnitId(stageUnitId, saveObj = null) {
  const save = saveObj || getSave();
  const raw = stageUnitId !== undefined && stageUnitId !== null ? stageUnitId : (save.selectedUnit || 'unit_001');
  const stageNum = parseInt(String(raw).replace(/\D/g, ''), 10) || 1;
  const offset = Number(save.wordUnitOffset) || 0;
  const total = getActiveTotalUnits();
  const effectiveUnit = Math.min(total, Math.max(1, stageNum + offset));
  return `unit_${String(effectiveUnit).padStart(3, '0')}`;
}

export function getCurrentStudyUnitId(stageUnitId) {
  return getEffectiveStudyUnitId(stageUnitId);
}

export function formatCourseBadge(save = getSave()) {
  const lang = save.studyLang;
  const p = save.courseProgress?.[lang] || { cefr: 'A1' };
  const flag = LANG_META[lang]?.flag || '🇺🇸';
  if (save.selectedLevelLabel) {
    return `${flag} ${save.selectedLevelLabel}`;
  }
  return `${flag} ${p.cefr}`;
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

