/**
 * js/data/i18n.js
 * 좀비 보카 (Zombie Voca) — 글로벌 다국어 사전 및 번역 헬퍼
 * 기본 언어: 'ko' | 확장 가능: 'en', 'es'
 */

const DICTIONARY = {
  ko: {
    app: {
      title: '좀비 보카 (Zombie Voca)',
      playerDefaultName: '우유',
    },
    evo: {
      stage0: '네 발 아기 강아지',
      stage1: '두 발 견습생',
      stage2: '에너지 블레이드 검사',
      stage3: '슈퍼 가디언',
    },
    course: {
      lv1: 'Lv.1 입문 (A1)',
      lv2: 'Lv.2 중급 (A1~A2)',
      lv3: 'Lv.3 고급 (B1~B2)',
      lv4: 'Lv.4 마스터 (B2~C2)',
    },
    hud: {
      ttsLoop: '발음 반복중',
      ultButton: '왕왕 대폭발',
      evoXp: '진화 XP',
      ultGauge: '필살기',
      bossLock: '3단계 잠금',
      bossEnraged: '광폭화!',
      slowDebuff: '이동속도 저하!',
      captureHold: '점령 중...',
      correctShockwave: '정답! 충격파 +100 XP',
      wrongPenalty: '오답! -50 XP',
      sonicLaser: '음파 레이저 격파!',
    },
    lobby: {
      tabGear: '장비·코스튬',
      tabBattle: '전투',
      tabTraining: '훈련소',
      tabWordbook: '기억수첩',
      startBattle: '전투 출격',
      selectCourse: '영단어 난이도 코스',
      selectChapter: '미국 횡단 챕터',
      chapterLocked: '이전 챕터 클리어 시 해금',
      dailyMissions: '일일 미션',
      attendance7d: '7일 출석부',
      claimReward: '보상 받기',
      claimed: '수령 완료',
      companionsTitle: '동물 친구 동료 (최대 2마리)',
      companionDeploy: '동행 중',
      companionSelect: '동행하기',
      companionLocked: '간식 {cost}개로 해금',
      costumesTitle: '코스튬 파츠 & 도감 보너스',
      equip: '착용하기',
      equipped: '착용 중',
      shopTitle: '보급 상점',
      normalBox: '일반 보급 상자',
      premiumSuitcase: '프리미엄 여행 가방',
      trainingTitle: '우유 & 동료 훈련소',
      upgradeAtk: '공격력 훈련',
      upgradeHp: '체력 훈련',
      upgradeCompanion: '동료 강화',
      wordbookTitle: '우유의 기억 수첩',
      masteryRate: '3연속 마스터 달성률',
      wrongQueueCount: '복습 대기 오답 단어',
      startMiniReview: '30초 미니 복습 시작',
      miniReviewDesc: '오답 단어를 30초간 빠르게 복습하고 골드와 간식을 획득하세요!',
    },
    modal: {
      pauseTitle: '일시 정지',
      resume: '계속하기',
      quitToLobby: '로비로 돌아가기',
      skillPickTitle: '레벨 업! 스킬 선택',
      gameOverTitle: '우유가 쓰러졌어요...',
      reviveAdBtn: '📺 광고 보고 1회 부활 (HP 70%)',
      giveUpBtn: '정산하고 로비로',
      resultClearTitle: '스테이지 클리어!',
      resultFailTitle: '작전 실패',
      resultCorrect: '정답 수',
      resultEvoXp: '획득 진화 XP',
      resultGold: '획득 골드',
      resultMastered: '신규 마스터 단어',
      confirm: '확인',
      close: '닫기',
      settingsTitle: '설정 & 세이브 백업',
      languageLabel: '언어 (Language)',
      bgmLabel: '배경음 (BGM)',
      sfxLabel: '효과음 & 발음 (SFX/TTS)',
      exportSave: '세이브 코드 복사 (Base64)',
      importSave: '세이브 코드 불러오기',
      importPlaceholder: '백업한 Base64 코드를 붙여넣으세요',
      backupSuccess: '세이브 코드가 클립보드에 복사되었습니다.',
      restoreSuccess: '데이터가 성공적으로 복원되었습니다!',
      restoreError: '올바르지 않은 세이브 코드입니다.',
    },
    tutorial: {
      step1: '이동해서 정답 비석을 부수세요!',
      step2: '이동해서 정답 비석을 부수세요!',
      step3: '🔥 우측 하단 대폭발 버튼을 눌러보세요!',
      complete: '튜토리얼 완료! 이제 본격적으로 주인을 찾아 떠나요!',
    },
  },

  en: {
    app: {
      title: 'Zombie Voca: Bark & Survive',
      playerDefaultName: 'Milk',
    },
    evo: {
      stage0: 'Four-Paw Puppy',
      stage1: 'Bipedal Apprentice',
      stage2: 'Energy Blade Knight',
      stage3: 'Super Guardian',
    },
    course: {
      lv1: 'Lv.1 Starter (A1)',
      lv2: 'Lv.2 Intermediate (A1~A2)',
      lv3: 'Lv.3 Advanced (B1~B2)',
      lv4: 'Lv.4 Master (B2~C2)',
    },
    hud: {
      ttsLoop: 'Audio Loop',
      ultButton: 'Mega Bark Blast',
      evoXp: 'Evo XP',
      ultGauge: 'Ultimate',
      bossLock: '3-Stage Lock',
      bossEnraged: 'Enraged!',
      slowDebuff: 'Speed Down!',
      captureHold: 'Capturing...',
      correctShockwave: 'Correct! Shockwave +100 XP',
      wrongPenalty: 'Wrong! -50 XP',
      sonicLaser: 'Sonic Laser Strike!',
    },
    lobby: {
      tabGear: 'Gear·Skins',
      tabBattle: 'Battle',
      tabTraining: 'Training',
      tabWordbook: 'Wordbook',
      startBattle: 'Start Battle',
      selectCourse: 'Vocabulary Course',
      selectChapter: 'Cross-USA Chapter',
      chapterLocked: 'Clear previous chapter to unlock',
      dailyMissions: 'Daily Missions',
      attendance7d: '7-Day Check-In',
      claimReward: 'Claim',
      claimed: 'Claimed',
      companionsTitle: 'Animal Companions (Max 2)',
      companionDeploy: 'Deployed',
      companionSelect: 'Deploy',
      companionLocked: 'Unlock with {cost} Snacks',
      costumesTitle: 'Costume Parts & Collection Bonus',
      equip: 'Equip',
      equipped: 'Equipped',
      shopTitle: 'Supply Shop',
      normalBox: 'Standard Supply Box',
      premiumSuitcase: 'Premium Travel Suitcase',
      trainingTitle: 'Milk & Companion Training',
      upgradeAtk: 'Attack Training',
      upgradeHp: 'HP Training',
      upgradeCompanion: 'Upgrade Companion',
      wordbookTitle: "Milk's Memory Wordbook",
      masteryRate: '3-Streak Mastery Rate',
      wrongQueueCount: 'Words to Review',
      startMiniReview: 'Start 30s Mini Review',
      miniReviewDesc: 'Review missed words for 30s to earn Gold and Snacks!',
    },
    modal: {
      pauseTitle: 'Paused',
      resume: 'Resume',
      quitToLobby: 'Return to Lobby',
      skillPickTitle: 'Level Up! Pick a Skill',
      gameOverTitle: 'Milk Collapsed...',
      reviveAdBtn: '📺 Watch Ad to Revive (70% HP)',
      giveUpBtn: 'Finish & Return',
      resultClearTitle: 'Stage Cleared!',
      resultFailTitle: 'Mission Failed',
      resultCorrect: 'Correct Answers',
      resultEvoXp: 'Evo XP Earned',
      resultGold: 'Gold Earned',
      resultMastered: 'Newly Mastered',
      confirm: 'OK',
      close: 'Close',
      settingsTitle: 'Settings & Save Backup',
      languageLabel: 'Language',
      bgmLabel: 'BGM',
      sfxLabel: 'SFX & Voice',
      exportSave: 'Copy Save Code (Base64)',
      importSave: 'Restore Save Code',
      importPlaceholder: 'Paste your Base64 save code here',
      backupSuccess: 'Save code copied to clipboard.',
      restoreSuccess: 'Save data restored successfully!',
      restoreError: 'Invalid save code.',
    },
    tutorial: {
      step1: 'Drag to move! Milk barks automatically to defeat zombies.',
      step2: 'Listen to the word and stand on the matching monolith for 0.4s!',
      step3: 'Ultimate Gauge full! Tap [🔥 Mega Bark Blast] below!',
      complete: 'Tutorial Complete! Time to find Milk’s owner!',
    },
  },

  es: {
    app: {
      title: 'Zombie Voca: Bark & Survive',
      playerDefaultName: 'Leche',
    },
    hud: {
      ttsLoop: 'Audio Repetido',
      ultButton: 'Super Ladrido',
      evoXp: 'XP Evo',
      ultGauge: 'Definitiva',
    },
    lobby: {
      tabGear: 'Equipo',
      tabBattle: 'Batalla',
      tabTraining: 'Entreno',
      tabWordbook: 'Libreta',
      startBattle: 'Iniciar Batalla',
    },
  },
};

let currentLang = 'ko';

/**
 * 현재 언어 설정
 * @param {'ko'|'en'|'es'} lang
 */
export function setLanguage(lang) {
  if (DICTIONARY[lang]) {
    currentLang = lang;
  } else {
    currentLang = 'ko';
  }
}

/**
 * 현재 언어 반환
 * @returns {string}
 */
export function getLanguage() {
  return currentLang;
}

/**
 * 점(.) 경로 기반 다국어 키 조회 및 {param} 치환
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const parts = key.split('.');
  const lookup = (langObj) => {
    let node = langObj;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) {
        node = node[part];
      } else {
        return undefined;
      }
    }
    return typeof node === 'string' ? node : undefined;
  };

  let text = lookup(DICTIONARY[currentLang]) ?? lookup(DICTIONARY.ko) ?? key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

/**
 * DOM 내 data-i18n 속성을 가진 요소들의 텍스트 일괄 갱신
 * @param {ParentNode} [root=document]
 */
export function applyI18nToDOM(root = document) {
  const nodes = root.querySelectorAll('[data-i18n]');
  nodes.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
}

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]);

