/**
 * js/data/i18n.js
 * 영단어 특공대: 멍멍 수호대 (Voca Squad: Puppy Guardians) — 글로벌 다국어 사전 및 번역 헬퍼
 * 기본 언어: 'ko' | 확장 가능: 'en', 'es'
 */

const DICTIONARY = {
  ko: {
    app: {
      title: '영단어 특공대: 멍멍 수호대',
      playerDefaultName: '우유',
    },
    evo: {
      stage0: '네 발 아기 강아지',
      stage1: '활발한 성장기 강아지',
      stage2: '두 발 보행 수호견',
      stage3: '전설의 알파 수호견',
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
      placementTest: '🎯 실력 진단 테스트 ({current} / {total}) · {hearts} (남은 기회 {lives}회)',
    },
    lobby: {
      tabGear: '우리 팀',
      tabBattle: '전투',
      tabTraining: '훈련소',
      tabWordbook: '기억수첩',
      tabShop: '상점',
      tabCompendium: '도감',
      tabChallenge: '챌린지',
      startBattle: '전투 출격',
      startTutorial: '튜토리얼 시작',
      airdrop: '보급품',
      walk: '산책하기',
      menu: '메뉴',
      notice: '공지사항',
      free: '무료',
      stageFarm: '복습·코인 파밍',
      stageClear: '순차 돌파',
      petBestCondition: '🥰 최상 컨디션',
      prevStage: '이전 스테이지',
      nextStage: '다음 스테이지',
      selectCourse: '영단어 난이도 코스',
      selectChapter: '미국 횡단 챕터',
      chapterLocked: '이전 챕터 클리어 시 해금',
      dailyMissions: '일일 미션',
      attendance7d: '7일 출석부',
      quests: '📜 퀘스트',
      attendance30d: '30일 출석',
      dailyQuests: '일일 퀘스트',
      weeklyQuests: '주간 퀘스트',
      achievements: '영구 업적',
      petTreats: '강아지 간식',
      supplyBoxes: '보급 상자',
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
      trainingTitle: '{name} & 동료 훈련소',
      upgradeAtk: '공격력 훈련',
      upgradeHp: '체력 훈련',
      upgradeCompanion: '동료 강화',
      wordbookTitle: '{name}의 기억 수첩',
      masteryRate: '3연속 마스터 달성률',
      wrongQueueCount: '복습 대기 오답 단어',
      startMiniReview: '30초 미니 복습 시작',
      miniReviewDesc: '오답 단어를 30초간 빠르게 복습하고 골드와 간식을 획득하세요!',
    },
    compendium: {
      subtabWords: '🔤 단어장',
      subtabGear: '🦺 장비',
      subtabSkills: '⚡ 스킬',
      subtabChars: '🐾 도감',
      showMeaning: '🙈 뜻 보기',
      hideMeaningOn: '뜻 가리기 ON',
      hideMeaningOff: '뜻 가리기 OFF',
      wrongReviewMode: '오답 집중 복습 모드',
      wrongReviewDesc: '틀린 단어만 집중 출제하여 정화합니다',
      wrongReviewBattle: '⚔️ 오답 복습 출격',
    },
    modal: {
      pauseTitle: '일시 정지',
      resume: '계속하기',
      quitToLobby: '로비로 돌아가기',
      skillPickTitle: '레벨 업! 스킬 선택',
      gameOverTitle: '{name}(이)가 쓰러졌어요...',
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
      settingsTitle: '설정',
      languageLabel: '언어 (Language)',
      bgmLabel: '배경음 (BGM)',
      sfxLabel: '효과음 (SFX/TTS)',
      hapticLabel: '진동 (Haptic)',
      lowFxLabel: '저사양 모드 (Low FX)',
      accountLabel: '계정 연동',
      accountComingSoon: 'Google / Apple (준비 중)',
      sendFeedback: '💬 피드백 및 문의 보내기',
      backupSuccess: '세이브 코드가 클립보드에 복사되었습니다.',
      restoreSuccess: '데이터가 성공적으로 복원되었습니다!',
      restoreError: '올바르지 않은 세이브 코드입니다.',
    },
    tutorial: {
      step1: '멍! 화면을 드래그해서 나를 움직여 봐! 사격은 내가 자동으로 할게!',
      step2: "위 전광판은 해독할 목표 단어, 왼쪽 세로 게이지는 스킬(필살기) 에너지야! 확인했으면 아래 '알겠어!'를 눌러 봐!",
      step3: "멍! 전광판의 '{word}'는 '{meaning}'라는 뜻이야! 화살표를 따라 벙커 해치 원 안에서 정답을 골라 봐! ({current} / {target})",
      step3Retry: "앗, 그건 오답 벙커야! 위 전광판 단어와 맞는 발바닥(🐾) 표시 해치로 들어가 봐!",
      step4: '멍! 단어를 해독해 레벨이 올랐어! 새 공격 무기를 배우거나 강아지 능력을 키울 수 있어. 마음에 드는 스킬 하나를 골라 봐!',
      step4Applied: '좋아! [{skillName}] 스킬 덕분에 내 공격이 더 강하고 빨라졌어!',
      step5: '새 스킬로 좀비를 무찌르고 바닥에 떨어진 보석들을 주워서 필살기 게이지를 꽉 채워 보자!',
      step6: "게이지가 꽉 찼어! 화면 아무 곳이나 빠르게 '두 번 터치(더블탭)'하거나 필살기 버튼을 눌러 봐!",
      step6Done: '완벽해! 이제 진짜 특공대원 다워졌어!',
      ackBtn: '🐾 알겠어!',
      complete: '완벽해! 이제 진짜 특공대원 다워졌어!',
    },
  },

  en: {
    app: {
      title: 'Voca Squad: Puppy Guardians',
      playerDefaultName: 'Milk',
    },
    evo: {
      stage0: 'Four-Paw Puppy',
      stage1: 'Active Growing Pup',
      stage2: 'Bipedal Guardian Dog',
      stage3: 'Legendary Alpha Guardian',
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
      placementTest: '🎯 Placement Test ({current} / {total}) · {hearts} ({lives} Left)',
    },
    lobby: {
      tabGear: 'Team',
      tabBattle: 'Battle',
      tabTraining: 'Training',
      tabWordbook: 'Wordbook',
      tabShop: 'Shop',
      tabCompendium: 'Compendium',
      tabChallenge: 'Challenge',
      startBattle: 'Start Battle',
      startTutorial: 'Start Tutorial',
      airdrop: 'Supplies',
      walk: 'Walk',
      menu: 'Menu',
      notice: 'Notice',
      free: 'Free',
      stageFarm: 'Review & Farm',
      stageClear: 'Stage Clear',
      petBestCondition: '🥰 Best Condition',
      prevStage: 'Previous Stage',
      nextStage: 'Next Stage',
      selectCourse: 'Vocabulary Course',
      selectChapter: 'Cross-USA Chapter',
      chapterLocked: 'Clear previous chapter to unlock',
      dailyMissions: 'Daily Missions',
      attendance7d: '7-Day Check-In',
      quests: '📜 Quests',
      attendance30d: '30D Check-In',
      dailyQuests: 'Daily Quests',
      weeklyQuests: 'Weekly Quests',
      achievements: 'Achievements',
      petTreats: 'Pet Treats',
      supplyBoxes: 'Supply Boxes',
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
      trainingTitle: '{name} & Companion Training',
      upgradeAtk: 'Attack Training',
      upgradeHp: 'HP Training',
      upgradeCompanion: 'Upgrade Companion',
      wordbookTitle: "{name}'s Memory Wordbook",
      masteryRate: '3-Streak Mastery Rate',
      wrongQueueCount: 'Words to Review',
      startMiniReview: 'Start 30s Mini Review',
      miniReviewDesc: 'Review missed words for 30s to earn Gold and Snacks!',
    },
    compendium: {
      subtabWords: '🔤 Wordbook',
      subtabGear: '🦺 Gear',
      subtabSkills: '⚡ Skills',
      subtabChars: '🐾 Codex',
      showMeaning: '🙈 Show Meaning',
      hideMeaningOn: 'Hide Meaning ON',
      hideMeaningOff: 'Hide Meaning OFF',
      wrongReviewMode: 'Missed Words Review',
      wrongReviewDesc: 'Focus drill on words you missed',
      wrongReviewBattle: '⚔️ Review Battle',
    },
    modal: {
      pauseTitle: 'Paused',
      resume: 'Resume',
      quitToLobby: 'Return to Lobby',
      skillPickTitle: 'Level Up! Pick a Skill',
      gameOverTitle: '{name} Collapsed...',
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
      settingsTitle: 'Settings',
      languageLabel: 'Language',
      bgmLabel: 'Music (BGM)',
      sfxLabel: 'Sound (SFX/TTS)',
      hapticLabel: 'Haptic (Vibration)',
      lowFxLabel: 'Low FX Mode',
      accountLabel: 'Account Sync',
      accountComingSoon: 'Google / Apple (Coming Soon)',
      sendFeedback: '💬 Send Feedback & Inquiries',
      backupSuccess: 'Save code copied to clipboard.',
      restoreSuccess: 'Save data restored successfully!',
      restoreError: 'Invalid save code.',
    },
    tutorial: {
      step1: 'Woof! Drag the screen to move me! I will shoot automatically!',
      step2: 'Look at the scoreboard above! That is the target word we need to decode!',
      step3: "Woof! '{word}' on the scoreboard means '{meaning}'! Follow the arrows and pick the answer inside the bunker hatch circle! ({current} / {target})",
      step3Retry: "Almost! '{word}' means '{meaning}'! Try picking it again!",
      step4: 'Awesome! Decoding words lets you learn battle skills. Pick one you like!',
      step4Applied: 'Nice! With [{skillName}], my attacks are now stronger and faster!',
      step5: 'Defeat zombies with your new skill and pick up gems on the ground to fill the Ultimate gauge!',
      step6: 'Gauge is full! Quickly double-tap the screen to unleash your Ultimate!',
      step6Done: 'Perfect! Now you are a true Voca Squad commando!',
      ackBtn: '🐾 Got it!',
      complete: 'Perfect! Now you are a true Voca Squad commando!',
    },
  },

  es: {
    app: {
      title: 'Voca Squad: Puppy Guardians',
      playerDefaultName: 'Leche',
    },
    evo: {
      stage0: 'Cachorro de Cuatro Patas',
      stage1: 'Cachorro en Crecimiento',
      stage2: 'Perro Guardián Bípedo',
      stage3: 'Guardián Alfa Legendario',
    },
    course: {
      lv1: 'Nivel 1 Básico (A1)',
      lv2: 'Nivel 2 Intermedio (A1~A2)',
      lv3: 'Nivel 3 Avanzado (B1~B2)',
      lv4: 'Nivel 4 Maestro (B2~C2)',
    },
    hud: {
      ttsLoop: 'Audio Repetido',
      ultButton: 'Super Ladrido',
      evoXp: 'XP Evo',
      ultGauge: 'Definitiva',
      bossLock: 'Bloqueo Nivel 3',
      bossEnraged: '¡Enfurecido!',
      placementTest: '🎯 Prueba de Nivel ({current} / {total}) · {hearts} ({lives} restantes)',
    },
    lobby: {
      tabGear: 'Equipo',
      tabBattle: 'Batalla',
      tabTraining: 'Entreno',
      tabWordbook: 'Libreta',
      tabShop: 'Tienda',
      tabCompendium: 'Compendio',
      tabChallenge: 'Desafío',
      startBattle: 'Iniciar Batalla',
      startTutorial: 'Iniciar Tutorial',
      airdrop: 'Suministros',
      walk: 'Pasear',
      menu: 'Menú',
      notice: 'Avisos',
      free: 'Gratis',
      stageFarm: 'Repaso y Monedas',
      stageClear: 'Avance',
      petBestCondition: '🥰 Condición Óptima',
      prevStage: 'Etapa Anterior',
      nextStage: 'Siguiente Etapa',
      dailyMissions: 'Misiones',
      shopTitle: 'Tienda',
      attendance7d: 'Asistencia',
      quests: '📜 Misiones',
      attendance30d: 'Asistencia 30D',
      dailyQuests: 'Misiones Diarias',
      weeklyQuests: 'Misiones Semanales',
      achievements: 'Logros',
      petTreats: 'Premios para Mascotas',
      supplyBoxes: 'Cajas de Suministro',
      chapterLocked: 'Capítulo Bloqueado',
    },
    compendium: {
      subtabWords: '🔤 Libreta',
      subtabGear: '🦺 Equipo',
      subtabSkills: '⚡ Habilidades',
      subtabChars: '🐾 Compendio',
      showMeaning: '🙈 Ver Significado',
      hideMeaningOn: 'Ocultar Significado ON',
      hideMeaningOff: 'Ocultar Significado OFF',
      wrongReviewMode: 'Repaso de Errores',
      wrongReviewDesc: 'Práctica enfocada en palabras falladas',
      wrongReviewBattle: '⚔️ Batalla de Repaso',
    },
    modal: {
      settingsTitle: 'Ajustes',
      languageLabel: 'Idioma (Language)',
      bgmLabel: 'Música (BGM)',
      sfxLabel: 'Sonido (SFX/TTS)',
      hapticLabel: 'Vibración (Haptic)',
      lowFxLabel: 'Modo Bajo Rendimiento',
      accountLabel: 'Vincular Cuenta',
      accountComingSoon: 'Google / Apple (Próximamente)',
      sendFeedback: '💬 Enviar Comentarios',
      close: 'Cerrar',
      backupRestore: 'Copia de Seguridad / Restaurar',
      exportCode: 'Exportar Código',
      importCode: 'Importar Código',
      importPlaceholder: 'Pega tu código Base64 aquí',
      backupSuccess: 'Código copiado al portapapeles.',
      restoreSuccess: '¡Datos restaurados con éxito!',
      restoreError: 'Código de guardado inválido.',
    },
    tutorial: {
      step1: '¡Guau! ¡Arrastra la pantalla para moverme! ¡Yo dispararé automáticamente!',
      step2: '¡Mira el marcador de arriba! ¡Ahí está la palabra objetivo que debemos descifrar!',
      step3: "¡Guau! '{word}' en el marcador significa '{meaning}'. ¡Sigue las flechas y elige la respuesta en la escotilla! ({current} / {target})",
      step3Retry: "¡Casi! '{word}' significa '{meaning}'. ¡Inténtalo de nuevo!",
      step4: '¡Genial! Al descifrar palabras aprendes habilidades. ¡Elige una!',
      step4Applied: '¡Bien! ¡Con [{skillName}] mi ataque es más fuerte y rápido!',
      step5: '¡Derrota zombis con tu nueva habilidad y recoge gemas para llenar el medidor definitivo!',
      step6: '¡Medidor lleno! ¡Toca dos veces rápido la pantalla para usar tu habilidad definitiva!',
      step6Done: '¡Perfecto! ¡Ya eres todo un miembro del escuadrón!',
      ackBtn: '🐾 ¡Entendido!',
      complete: '¡Perfecto! ¡Ya eres todo un miembro del escuadrón!',
    },
  },
};

let currentLang = 'ko';

/**
 * 브라우저/기기 언어 자동 감지 (ko, es 지원, 그 외 기본값 en)
 * @returns {'ko'|'en'|'es'}
 */
export function detectDeviceLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  const navLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
  if (navLang.startsWith('ko')) return 'ko';
  if (navLang.startsWith('es')) return 'es';
  return 'en';
}

/**
 * 현재 언어 설정
 * @param {'ko'|'en'|'es'} lang
 */
export function setLanguage(lang) {
  if (DICTIONARY[lang]) {
    currentLang = lang;
  } else {
    currentLang = detectDeviceLanguage();
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
  const effectiveParams = { name: '우유', ...params };
  for (const [k, v] of Object.entries(effectiveParams)) {
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

