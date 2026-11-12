/**
 * js/data/data_en.js
 * 4,998단어(167유닛) 마스터 CSV 로더 및 표준 단어 스키마 변환기
 */

import { BALANCE } from '../config/balance.js';

let cachedWords = null;
let cachedUnits = null;
let loadingPromise = null;

/**
 * RFC-4180 호환 CSV 단일 라인 파서 (따옴표 내부 쉼표 처리)
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * 비석 표시용 뜻 8글자 이내 정제
 * 괄호 부연설명/다중 뜻 구분자를 제거해 핵심 뜻만 추출
 * @param {string} rawMeaning
 * @param {number} [maxChars=BALANCE.VOCA.MEANING_MAX_CHARS]
 * @returns {string}
 */
export function sanitizeMeaning(rawMeaning, maxChars = BALANCE.VOCA.MEANING_MAX_CHARS) {
  if (!rawMeaning) return '';
  let text = String(rawMeaning)
    .replace(/\([^)]*\)/g, '') // 괄호 제거
    .split(/[,;/·]/)[0]          // 첫 번째 핵심 뜻만 사용
    .trim();

  if (!text) {
    text = String(rawMeaning).trim();
  }

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trim();
  }
  return text;
}

/**
 * 한국어 뜻 어미 기반 간이 품사 추론 (표준 스키마 pos 채움용)
 * @param {string} rawMeaning
 * @returns {string}
 */
function inferPos(rawMeaning) {
  const clean = String(rawMeaning || '').trim();
  if (clean.endsWith('다')) return 'verb';
  if (clean.endsWith('는') || clean.endsWith('운') || clean.endsWith('적인')) return 'adj';
  if (clean.endsWith('히') || clean.endsWith('게')) return 'adv';
  return 'noun';
}

/**
 * CSV 텍스트를 표준 단어 스키마 배열로 파싱
 * 스키마: { id, unit, word, meaning, pos, level, phonetic, rawMeaning }
 * @param {string} csvText
 * @returns {Array<object>}
 */
function parseMasterCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const colIndex = Object.fromEntries(headers.map((h, idx) => [h, idx]));

  const words = [];
  const unitSet = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const rank = Number(cols[colIndex.Rank] || i);
    const word = (cols[colIndex.Word] || '').trim();
    const level = (cols[colIndex.Level] || 'A1').trim();
    const unit = (cols[colIndex.Unit_ID] || 'unit_001').trim();
    const rawMeaning = (cols[colIndex.Meaning] || '').trim();
    const phonetic = (cols[colIndex.Pronunciation] || '').trim();

    if (!word || !rawMeaning) continue;

    unitSet.add(unit);
    words.push({
      id: rank,
      unit,
      word,
      meaning: sanitizeMeaning(rawMeaning),
      pos: inferPos(rawMeaning),
      level,
      phonetic,
      rawMeaning,
    });
  }

  cachedUnits = Array.from(unitSet).sort();
  return words;
}

const FALLBACK_WORDS = [
  { id: 1, unit: 'unit_001', word: 'apple', rawMeaning: '사과', level: 'A1', phonetic: '/ˈæp.əl/' },
  { id: 2, unit: 'unit_001', word: 'water', rawMeaning: '물', level: 'A1', phonetic: '/ˈwɔː.tər/' },
  { id: 3, unit: 'unit_001', word: 'house', rawMeaning: '집', level: 'A1', phonetic: '/haʊs/' },
  { id: 4, unit: 'unit_001', word: 'friend', rawMeaning: '친구', level: 'A1', phonetic: '/frend/' },
  { id: 5, unit: 'unit_001', word: 'happy', rawMeaning: '행복한', level: 'A1', phonetic: '/ˈhæp.i/' },
  { id: 6, unit: 'unit_001', word: 'run', rawMeaning: '달리다', level: 'A1', phonetic: '/rʌn/' },
  { id: 7, unit: 'unit_001', word: 'book', rawMeaning: '책', level: 'A1', phonetic: '/bʊk/' },
  { id: 8, unit: 'unit_001', word: 'dog', rawMeaning: '강아지', level: 'A1', phonetic: '/dɒɡ/' },
  { id: 9, unit: 'unit_001', word: 'sun', rawMeaning: '태양', level: 'A1', phonetic: '/sʌn/' },
  { id: 10, unit: 'unit_001', word: 'moon', rawMeaning: '달', level: 'A1', phonetic: '/muːn/' },
  { id: 11, unit: 'unit_002', word: 'brave', rawMeaning: '용감한', level: 'A2', phonetic: '/breɪv/' },
  { id: 12, unit: 'unit_002', word: 'forest', rawMeaning: '숲', level: 'A2', phonetic: '/ˈfɒr.ɪst/' },
  { id: 13, unit: 'unit_002', word: 'bridge', rawMeaning: '다리', level: 'A2', phonetic: '/brɪdʒ/' },
  { id: 14, unit: 'unit_002', word: 'travel', rawMeaning: '여행하다', level: 'A2', phonetic: '/ˈtræv.əl/' },
  { id: 15, unit: 'unit_002', word: 'secret', rawMeaning: '비밀', level: 'A2', phonetic: '/ˈsiː.krət/' },
  { id: 16, unit: 'unit_002', word: 'strong', rawMeaning: '강한', level: 'A2', phonetic: '/strɒŋ/' },
  { id: 17, unit: 'unit_002', word: 'protect', rawMeaning: '보호하다', level: 'A2', phonetic: '/prəˈtekt/' },
  { id: 18, unit: 'unit_002', word: 'shadow', rawMeaning: '그림자', level: 'A2', phonetic: '/ˈʃæd.əʊ/' },
  { id: 19, unit: 'unit_002', word: 'island', rawMeaning: '섬', level: 'A2', phonetic: '/ˈaɪ.lənd/' },
  { id: 20, unit: 'unit_002', word: 'dream', rawMeaning: '꿈', level: 'A2', phonetic: '/driːm/' },
  { id: 21, unit: 'unit_003', word: 'courage', rawMeaning: '용기', level: 'B1', phonetic: '/ˈkʌr.ɪdʒ/' },
  { id: 22, unit: 'unit_003', word: 'survive', rawMeaning: '생존하다', level: 'B1', phonetic: '/səˈvaɪv/' },
  { id: 23, unit: 'unit_003', word: 'ancient', rawMeaning: '고대의', level: 'B1', phonetic: '/ˈeɪn.ʃənt/' },
  { id: 24, unit: 'unit_003', word: 'explore', rawMeaning: '탐험하다', level: 'B1', phonetic: '/ɪkˈsplɔːr/' },
  { id: 25, unit: 'unit_003', word: 'victory', rawMeaning: '승리', level: 'B1', phonetic: '/ˈvɪk.tər.i/' },
  { id: 26, unit: 'unit_003', word: 'danger', rawMeaning: '위험', level: 'B1', phonetic: '/ˈdeɪn.dʒər/' },
  { id: 27, unit: 'unit_003', word: 'escape', rawMeaning: '탈출하다', level: 'B1', phonetic: '/ɪˈskeɪp/' },
  { id: 28, unit: 'unit_003', word: 'energy', rawMeaning: '에너지', level: 'B1', phonetic: '/ˈen.ə.dʒi/' },
  { id: 29, unit: 'unit_003', word: 'guardian', rawMeaning: '수호자', level: 'B2', phonetic: '/ˈɡɑː.di.ən/' },
  { id: 30, unit: 'unit_003', word: 'whisper', rawMeaning: '속삭이다', level: 'B2', phonetic: '/ˈwɪs.pər/' },
  { id: 31, unit: 'unit_004', word: 'harmony', rawMeaning: '조화', level: 'B2', phonetic: '/ˈhɑː.mə.ni/' },
  { id: 32, unit: 'unit_004', word: 'miracle', rawMeaning: '기적', level: 'B2', phonetic: '/ˈmɪr.ə.kəl/' },
  { id: 33, unit: 'unit_004', word: 'resilient', rawMeaning: '회복력있는', level: 'C1', phonetic: '/rɪˈzɪl.i.ənt/' },
  { id: 34, unit: 'unit_004', word: 'eclipse', rawMeaning: '일식', level: 'C1', phonetic: '/ɪˈklɪps/' },
  { id: 35, unit: 'unit_004', word: 'luminous', rawMeaning: '빛나는', level: 'C1', phonetic: '/ˈluː.mɪ.nəs/' },
  { id: 36, unit: 'unit_004', word: 'triumph', rawMeaning: '대승리', level: 'C1', phonetic: '/ˈtraɪ.ʌmf/' },
  { id: 37, unit: 'unit_004', word: 'serenity', rawMeaning: '고요함', level: 'C2', phonetic: '/səˈren.ə.ti/' },
  { id: 38, unit: 'unit_004', word: 'ephemeral', rawMeaning: '덧없는', level: 'C2', phonetic: '/ɪˈfem.ər.əl/' },
  { id: 39, unit: 'unit_004', word: 'zenith', rawMeaning: '정점', level: 'C2', phonetic: '/ˈzen.ɪθ/' },
  { id: 40, unit: 'unit_004', word: 'vanguard', rawMeaning: '선봉대', level: 'C2', phonetic: '/ˈvæn.ɡɑːd/' },
];

function buildFallbackWords() {
  const unitSet = new Set();
  const words = FALLBACK_WORDS.map((item) => {
    unitSet.add(item.unit);
    return {
      id: item.id,
      unit: item.unit,
      word: item.word,
      meaning: sanitizeMeaning(item.rawMeaning),
      pos: inferPos(item.rawMeaning),
      level: item.level,
      phonetic: item.phonetic,
      rawMeaning: item.rawMeaning,
    };
  });
  cachedUnits = Array.from(unitSet).sort();
  return words;
}

/**
 * 마스터 CSV 비동기 로드 (중복 요청 방지 및 메모리 캐시, CSV 누락 시 폴백 샘플 로드)
 * @returns {Promise<Array<object>>}
 */
export async function loadWordDatabase() {
  if (cachedWords) return cachedWords;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch('./js/data/english_5000_master.csv')
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load word CSV: HTTP ${res.status}`);
      }
      return res.text();
    })
    .then((text) => {
      const parsed = parseMasterCsv(text);
      if (parsed.length === 0) {
        throw new Error('Parsed word CSV is empty');
      }
      cachedWords = parsed;
      return cachedWords;
    })
    .catch((err) => {
      console.warn('[data_en] CSV 로드 실패로 내장 폴백 단어 데이터를 사용합니다:', err.message);
      cachedWords = buildFallbackWords();
      return cachedWords;
    });

  return loadingPromise;
}

/**
 * 로드 완료된 전체 단어 배열 반환 (미로드 시 폴백 단어 반환)
 * @returns {Array<object>}
 */
export function getWords() {
  if (cachedWords && cachedWords.length > 0) return cachedWords;
  return buildFallbackWords();
}

/**
 * 로드 완료된 전체 유닛 ID 목록 반환 (167유닛)
 * @returns {string[]}
 */
export function getUnits() {
  if (cachedUnits && cachedUnits.length > 0) return cachedUnits;
  buildFallbackWords();
  return cachedUnits || [];
}

