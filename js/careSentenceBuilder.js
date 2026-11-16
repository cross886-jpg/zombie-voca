/**
 * js/careSentenceBuilder.js
 * 반려견 로비 케어(사료/물/응가) 문장 퍼즐 빌더 모듈
 * - 단어 데이터 안전 탐색 (wordId, 텍스트, wordCursor 폴백)
 * - 1순위: DB 3~5단어 예문 자동 블록화
 * - 2순위: 케어 프레임 + 복습 단어 하이브리드 3조각 결합
 * - 셔플 타일 생성 (원래 정답 순서와 다른 셔플 보장)
 * - 퍼즐 정답 제출 및 케어 수치·보카-큐어(+2) 보상 갱신
 */

(function () {
  'use strict';

  // 비상용 스타터 기초 단어 풀 (비동기 DB 로드 지연 시 폴백)
  const STARTER_WORDS_ES = [
    { id: 1, word: 'hola', meaning: '안녕하세요', phonetic: '[올라]', example: '¡Hola! ¿Cómo estás?', exampleKo: '안녕하세요! 어떻게 지내세요?' },
    { id: 2, word: 'gracias', meaning: '감사합니다', phonetic: '[그라시아스]', example: 'Muchas gracias por su ayuda.', exampleKo: '도와주셔서 대단히 감사합니다.' },
    { id: 3, word: 'sí', meaning: '네', phonetic: '[시]', example: 'Sí. estoy de acuerdo.', exampleKo: '네 동의합니다.' },
    { id: 4, word: 'no', meaning: '아니요', phonetic: '[노]', example: 'No. gracias.', exampleKo: '아니요 괜찮습니다.' },
    { id: 5, word: 'de', meaning: '~의', phonetic: '[데]', example: 'Soy de Corea.', exampleKo: '저는 한국 출신입니다.' },
    { id: 6, word: 'amigo', meaning: '친구', phonetic: '[아미고]', example: 'Juan es mi mejor amigo.', exampleKo: '후안은 내 가장 친한 친구다.' },
    { id: 7, word: 'café', meaning: '커피', phonetic: '[카페]', example: 'Tomo una taza de café caliente.', exampleKo: '따뜻한 커피 한 잔을 마신다.' },
    { id: 8, word: 'es', meaning: '이다', phonetic: '[에스]', example: 'Es una buena idea.', exampleKo: '좋은 생각이다.' },
    { id: 9, word: 'agua', meaning: '물', phonetic: '[아구아]', example: 'Bebo agua fresca.', exampleKo: '나는 시원한 물을 마신다.' },
    { id: 10, word: 'bueno', meaning: '좋은', phonetic: '[부에노]', example: 'Este restaurante es muy bueno.', exampleKo: '이 식당은 정말 좋다.' },
    { id: 11, word: 'comida', meaning: '음식', phonetic: '[코미다]', example: 'La comida es muy deliciosa.', exampleKo: '음식이 매우 맛있습니다.' },
    { id: 12, word: 'limpio', meaning: '깨끗한', phonetic: '[림피오]', example: 'El piso está muy limpio.', exampleKo: '바닥이 아주 깨끗합니다.' },
  ];

  const STARTER_WORDS_EN = [
    { id: 1, word: 'hello', meaning: '안녕하세요', phonetic: '/həlˈoʊ/', example: 'Hello nice to meet you.', exampleKo: '안녕하세요 만나서 반갑습니다.' },
    { id: 2, word: 'yes', meaning: '네', phonetic: '/jˈɛs/', example: 'Yes I agree with you.', exampleKo: '네 당신 의견에 동의합니다.' },
    { id: 3, word: 'no', meaning: '아니요', phonetic: '/nˈoʊ/', example: 'No I am fine.', exampleKo: '아니요 저는 괜찮습니다.' },
    { id: 4, word: 'thanks', meaning: '감사', phonetic: '/θˈæŋks/', example: 'Thanks for your help.', exampleKo: '도와주셔서 감사합니다.' },
    { id: 5, word: 'good', meaning: '좋은', phonetic: '/ɡˈʊd/', example: 'Have a good day.', exampleKo: '좋은 하루 보내세요.' },
    { id: 6, word: 'friend', meaning: '친구', phonetic: '/frˈɛnd/', example: 'He is my best friend.', exampleKo: '그는 내 가장 친한 친구입니다.' },
    { id: 7, word: 'water', meaning: '물', phonetic: '/wˈɔtər/', example: 'Drink fresh cold water.', exampleKo: '신선하고 차가운 물을 마시자.' },
    { id: 8, word: 'food', meaning: '음식', phonetic: '/fˈud/', example: 'Give healthy delicious food.', exampleKo: '건강하고 맛있는 음식을 주자.' },
    { id: 9, word: 'dog', meaning: '개', phonetic: '/dˈɔɡ/', example: 'I love my cute dog.', exampleKo: '나는 귀여운 내 강아지를 사랑한다.' },
    { id: 10, word: 'clean', meaning: '깨끗한', phonetic: '/klˈin/', example: 'Clean up the messy room.', exampleKo: '어질러진 방을 깨끗이 치우자.' },
  ];

  const _wordCache = {
    es: [],
    en: [],
  };

  // 모듈 환경에서 비동기 DB 프리로드
  if (typeof window !== 'undefined' && typeof importScripts === 'undefined') {
    import('./data/data_es.js')
      .then((m) => {
        if (m && Array.isArray(m.WORDS)) {
          _wordCache.es = m.WORDS;
          if (typeof window !== 'undefined') window.VOCAB_DATA_ES = m.WORDS;
        }
      })
      .catch(() => {});

    import('./data/data_en.js')
      .then((m) => {
        if (m && Array.isArray(m.WORDS)) {
          _wordCache.en = m.WORDS;
          if (typeof window !== 'undefined') window.VOCAB_DATA_EN = m.WORDS;
        }
      })
      .catch(() => {});

    if (!window.settingsStore) {
      import('./settingsStore.js')
        .then((m) => {
          if (m && m.settingsStore) {
            window.settingsStore = m.settingsStore;
          }
        })
        .catch(() => {});
    }
  }

  function getStore() {
    if (typeof window !== 'undefined' && window.settingsStore) {
      return window.settingsStore;
    }
    return null;
  }

  function getActiveLanguage() {
    const store = getStore();
    if (store && store.activeLanguage) return store.activeLanguage;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('zombieVoca_account_v2');
        if (raw) {
          const acc = JSON.parse(raw);
          if (acc && acc.activeLanguage) return acc.activeLanguage;
        }
      }
    } catch (_) {}
    return 'es';
  }

  /**
   * 전역 및 캐시된 단어 데이터 배열 반환
   * @param {string} lang ('en' | 'es')
   * @returns {Array}
   */
  function getWordList(lang) {
    const safeLang = lang === 'en' ? 'en' : 'es';
    if (typeof window !== 'undefined') {
      if (safeLang === 'es') {
        if (Array.isArray(window.VOCAB_DATA_ES) && window.VOCAB_DATA_ES.length) return window.VOCAB_DATA_ES;
        if (Array.isArray(window.data_es) && window.data_es.length) return window.data_es;
        if (Array.isArray(window.WORDS_ES) && window.WORDS_ES.length) return window.WORDS_ES;
      } else {
        if (Array.isArray(window.VOCAB_DATA_EN) && window.VOCAB_DATA_EN.length) return window.VOCAB_DATA_EN;
        if (Array.isArray(window.data_en) && window.data_en.length) return window.data_en;
        if (Array.isArray(window.WORDS_EN) && window.WORDS_EN.length) return window.WORDS_EN;
      }
      if (Array.isArray(window.WORDS) && window.WORDS.length) return window.WORDS;
    }

    if (_wordCache[safeLang] && _wordCache[safeLang].length) {
      return _wordCache[safeLang];
    }

    return safeLang === 'en' ? STARTER_WORDS_EN : STARTER_WORDS_ES;
  }

  /**
   * 1. 단어 데이터 안전 탐색
   * @param {string|number} [wordId]
   * @param {string} [lang]
   * @returns {Object} 단어 객체
   */
  function findWordEntry(wordId, lang) {
    const safeLang = (lang || getActiveLanguage()) === 'en' ? 'en' : 'es';
    const list = getWordList(safeLang);

    if (wordId !== undefined && wordId !== null && wordId !== '') {
      const idNum = Number(wordId);
      const idStr = String(wordId).trim().toLowerCase();

      // 1-1. 숫자/문자열 ID 매칭
      let found = list.find((w) => w.id === idNum || String(w.id) === idStr);
      if (found) return found;

      // 1-2. 원어 텍스트 매칭
      found = list.find((w) => String(w.word || '').trim().toLowerCase() === idStr);
      if (found) return found;
    }

    // 1-3. 폴백: recentLearnedWords가 없거나 미지정 시 wordCursor 기준 0~5번 기초 단어 탐색
    let cursor = 0;
    const store = getStore();
    if (store) {
      const profile = store.getCurrentProfile ? store.getCurrentProfile() : (store.state || {});
      cursor = Number(profile.wordCursor) || 0;
    }

    const safeIdx = cursor >= 0 && cursor < list.length
      ? cursor % Math.min(6, list.length)
      : Math.floor(Math.random() * Math.min(6, list.length));

    return list[safeIdx] || list[0] || (safeLang === 'en' ? STARTER_WORDS_EN[0] : STARTER_WORDS_ES[0]);
  }

  /**
   * 예문 문자열에서 구두점을 제거하고 공백 기준으로 단어 토큰 배열 추출
   * @param {string} text
   * @returns {string[]}
   */
  function extractTokensFromExample(text) {
    if (!text || typeof text !== 'string') return [];
    const cleaned = text
      .replace(/[.,!?;:¿¡"“”'()[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return [];
    return cleaned.split(' ').filter(Boolean);
  }

  /**
   * 2. 케어 타입별 문장 퍼즐 생성
   * @param {'food'|'water'|'poop'} careType
   * @param {string} [lang]
   * @returns {Object}
   */
  function buildCarePuzzle(careType = 'food', lang = null) {
    const safeLang = (lang || getActiveLanguage()) === 'en' ? 'en' : 'es';
    const safeCareType = ['food', 'water', 'poop'].includes(careType) ? careType : 'food';

    // 대상 단어 탐색: 최근 맞힌 단어가 있으면 최우선 복습 대상 선정
    let targetWordId = null;
    const store = getStore();
    if (store) {
      const profile = store.getCurrentProfile ? store.getCurrentProfile() : (store.state || {});
      const recent = profile.careSystem?.recentLearnedWords;
      if (Array.isArray(recent) && recent.length > 0) {
        targetWordId = recent[0];
      }
    }

    const targetWord = findWordEntry(targetWordId, safeLang);

    // [1순위 — 기존 DB 예문 자동 블록화]
    const exText = (
      targetWord.example_es ||
      targetWord.example_en ||
      targetWord.example ||
      ''
    ).trim();
    const exKo = (
      targetWord.example_ko ||
      targetWord.exampleKo ||
      ''
    ).trim();

    const parsedTokens = extractTokensFromExample(exText);
    let correctTokens = [];
    let fullSentence = '';
    let promptKo = '';

    if (parsedTokens.length >= 3 && parsedTokens.length <= 5) {
      correctTokens = parsedTokens;
      fullSentence = exText;
      promptKo = exKo || (targetWord.meaning ? `${targetWord.meaning} 예문` : fullSentence);
    } else {
      // [2순위 — 케어 프레임 + 방금 배운 단어 하이브리드 조립 (3조각)]
      const targetText = String(targetWord.word || (safeLang === 'es' ? 'amigo' : 'friend')).trim();
      const meaningStr = String(targetWord.meaning || targetText).trim();

      if (safeLang === 'es') {
        if (safeCareType === 'food') {
          correctTokens = ['Dar', 'comida', targetText];
          promptKo = `${meaningStr} 음식을 주자`;
        } else if (safeCareType === 'water') {
          correctTokens = ['Beber', 'agua', targetText];
          promptKo = `${meaningStr} 물을 마시자`;
        } else {
          correctTokens = ['Limpiar', 'aquí', targetText];
          promptKo = `${meaningStr} 여기를 청소하자`;
        }
      } else {
        if (safeCareType === 'food') {
          correctTokens = ['Give', 'food', targetText];
          promptKo = `${meaningStr} 음식을 주자`;
        } else if (safeCareType === 'water') {
          correctTokens = ['Drink', 'water', targetText];
          promptKo = `${meaningStr} 물을 마시자`;
        } else {
          correctTokens = ['Clean', 'up', targetText];
          promptKo = `${meaningStr} 깨끗이 치우자`;
        }
      }
      fullSentence = `${correctTokens.join(' ')}.`;
    }

    // 셔플 타일 생성 (정답 순서와 다른 순서 보장)
    const baseTiles = correctTokens.map((tokenText, idx) => {
      const isTarget =
        tokenText.toLowerCase() === String(targetWord.word || '').toLowerCase() ||
        (correctTokens.length === 3 && idx === 2);
      return {
        id: idx,
        text: tokenText,
        isTargetWord: Boolean(isTarget),
      };
    });

    const shuffledTiles = [...baseTiles];
    for (let i = shuffledTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledTiles[i];
      shuffledTiles[i] = shuffledTiles[j];
      shuffledTiles[j] = temp;
    }

    // 길이가 2개 이상일 때 원래 정답 순서와 100% 동일하면 강제 교환
    if (
      shuffledTiles.length >= 2 &&
      shuffledTiles.every((tile, i) => tile.id === i)
    ) {
      const temp = shuffledTiles[0];
      shuffledTiles[0] = shuffledTiles[1];
      shuffledTiles[1] = temp;
    }

    return {
      careType: safeCareType,
      lang: safeLang,
      promptKo,
      fullSentence,
      correctTokens,
      shuffledTiles,
      targetWordInfo: {
        word: targetWord.word || '',
        meaning: targetWord.meaning || '',
        pron: targetWord.phonetic || '',
      },
    };
  }

  /**
   * 3. 정답 검증 및 케어 보상 반영 헬퍼
   * @param {'food'|'water'|'poop'} careType
   * @param {boolean} isSuccess
   * @returns {Object} 갱신된 케어 상태 요약
   */
  function submitCarePuzzleResult(careType = 'food', isSuccess = false) {
    const safeCareType = ['food', 'water', 'poop'].includes(careType) ? careType : 'food';
    const store = getStore();

    if (store) {
      const profile = store.getCurrentProfile ? store.getCurrentProfile() : (store.state || {});
      if (!profile.careSystem) {
        profile.careSystem = {
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

      const care = profile.careSystem;

      if (isSuccess) {
        if (safeCareType === 'food') {
          care.hunger = 100;
        } else if (safeCareType === 'water') {
          care.thirst = 100;
        } else if (safeCareType === 'poop') {
          care.poopCount = 0;
          care.stagesSinceLastCare = 0;
        }
        care.lastUpdatedAt = Date.now();

        // hunger >= 80 && thirst >= 80 && poopCount === 0 달성 시 버프 활성 및 보카-큐어 +2
        const h = Number(care.hunger) ?? 0;
        const t = Number(care.thirst) ?? 0;
        const p = Number(care.poopCount) ?? 0;

        if (h >= 80 && t >= 80 && p === 0) {
          care.wellCaredBuff = true;

          if (!profile.ownerState) {
            profile.ownerState = {
              recoveryStage: 1,
              cureProgress: 0,
              gear: { backpack: 1, shoes: 1, outfit: 1, weapon: 1 },
              materials: { cloth: 0, bandage: 0, parts: 0, herb: 0 },
            };
          }

          profile.ownerState.cureProgress = Math.min(
            100,
            (Number(profile.ownerState.cureProgress) || 0) + 2
          );
          profile.ownerState.recoveryStage = Math.max(
            1,
            Math.min(5, Math.floor(profile.ownerState.cureProgress / 20) + 1)
          );
        } else {
          care.wellCaredBuff = false;
        }
      }

      if (typeof store.save === 'function') {
        store.save();
      } else if (typeof store.saveProfile === 'function') {
        store.saveProfile();
      }

      return {
        isSuccess: Boolean(isSuccess),
        careType: safeCareType,
        hunger: care.hunger,
        thirst: care.thirst,
        poopCount: care.poopCount,
        wellCaredBuff: Boolean(care.wellCaredBuff),
        cureProgress: profile.ownerState?.cureProgress ?? 0,
        recoveryStage: profile.ownerState?.recoveryStage ?? 1,
      };
    }

    // fallback if settingsStore not yet wired in current scope
    return {
      isSuccess: Boolean(isSuccess),
      careType: safeCareType,
      hunger: safeCareType === 'food' && isSuccess ? 100 : 80,
      thirst: safeCareType === 'water' && isSuccess ? 100 : 80,
      poopCount: safeCareType === 'poop' && isSuccess ? 0 : 0,
      wellCaredBuff: Boolean(isSuccess),
      cureProgress: isSuccess ? 2 : 0,
      recoveryStage: 1,
    };
  }

  const CareSentenceBuilder = {
    findWordEntry,
    buildCarePuzzle,
    submitCarePuzzleResult,
    extractTokensFromExample,
    getWordList,
  };

  if (typeof window !== 'undefined') {
    window.CareSentenceBuilder = CareSentenceBuilder;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.CareSentenceBuilder = CareSentenceBuilder;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CareSentenceBuilder;
  }
})();
