/**
 * js/main.js
 * 앱 초기화 진입점:
 * - 세이브 로드, 다국어 적용, 마스터 영단어 CSV 로드
 * - #game-canvas 및 GameEngine, UI 모듈(hudUI, lobbyUI, growthUI, wordbookUI) 바인딩
 * - visibilitychange / blur 백그라운드 자동 일시정지 연결
 * - 첫 접속 시 30초 프롤로그 튜토리얼 자동 진입
 */

import { loadSave } from './core/saveStore.js';
import { audioEngine } from './core/audioEngine.js';
import { applyI18nToDOM, setLanguage } from './data/i18n.js';
import { loadWordDatabase } from './data/data_en.js?v=2';
import { GAME_STATES, GameEngine } from './game/gameEngine.js';
import { createHudUI } from './ui/hudUI.js';
import { createLobbyUI } from './ui/lobbyUI.js';
import { createGrowthUI } from './ui/growthUI.js';
import { createShopUI } from './ui/shopUI.js';
import { createChallengeUI } from './ui/challengeUI.js';

async function bootstrap() {
  const save = loadSave();
  setLanguage(save.language || 'ko');
  applyI18nToDOM();

  try {
    await loadWordDatabase();
  } catch (err) {
    console.warn('[main] 단어 CSV 로드 실패 (로컬 서버 및 english_5000_master.csv 경로를 확인하세요):', err);
  }

  const canvas = document.getElementById('game-canvas');
  const engine = new GameEngine(canvas);

  let lobbyUI = null;
  let growthUI = null;
  let shopUI = null;
  let challengeUI = null;

  const hudUI = createHudUI(engine, {
    onReturnToLobby() {
      hudUI.closeModal();
      hudUI.hideHud();
      lobbyUI?.showLobby();
    },
    onStartPath(path) {
      hudUI.closeModal();
      hudUI.hideHud();
      if (path === 'ch1') {
        startBattleFlow({ chapterNumber: 1, courseId: 'lv1', isTutorial: false });
      } else {
        lobbyUI?.showLobby();
      }
    },
  });

  function startBattleFlow({ chapterNumber, courseId, unitId, isTutorial = false, isPromotion = false, targetLevel = 'A2', isPlacement = false, targetUnitNum = 1 } = {}) {
    audioEngine.unlock();
    lobbyUI.closeModal();
    lobbyUI.hideLobby();
    hudUI.closeModal();
    hudUI.showHud();
    canvas.classList.remove('hidden');
    engine.startBattle({ chapterNumber, courseId, unitId, isTutorial, isPromotion, targetLevel, isPlacement, targetUnitNum });
  }

  lobbyUI = createLobbyUI({
    onStartBattle({ chapterNumber, courseId, unitId, isPlacement = false, targetUnitNum = 1 }) {
      startBattleFlow({ chapterNumber, courseId, unitId, isTutorial: false, isPlacement, targetUnitNum });
    },
    onStartTutorial() {
      startBattleFlow({ chapterNumber: 1, courseId: 'lv1', isTutorial: true });
    },
    onRenderGear() {
      growthUI?.renderGearTab();
    },
    onRenderTraining() {
      growthUI?.renderTrainingTab();
    },
    onRenderShop() {
      shopUI?.renderShopTab();
    },
    onRenderChallenge() {
      challengeUI?.renderChallengeTab();
    },
    onOpenSupplyShop() {
      growthUI?.openSupplyShopModal();
    },
  });

  growthUI = createGrowthUI({
    onResourcesChanged: () => lobbyUI.refreshHeader(),
    openModal: (html) => lobbyUI.openModal(html),
    closeModal: () => lobbyUI.closeModal(),
  });

  shopUI = createShopUI({
    onResourcesChanged: () => lobbyUI.refreshHeader(),
    openModal: (html) => lobbyUI.openModal(html),
    closeModal: () => lobbyUI.closeModal(),
  });

  challengeUI = createChallengeUI({
    onResourcesChanged: () => lobbyUI.refreshHeader(),
    openModal: (html) => lobbyUI.openModal(html),
    closeModal: () => lobbyUI.closeModal(),
    onStartPromotion({ targetLevel }) {
      startBattleFlow({ isPromotion: true, targetLevel });
    },
  });

  // 화면 리사이즈 대응
  window.addEventListener('resize', () => {
    engine.resizeCanvas();
  });

  // 백그라운드 전환 시 자동 일시정지 & 오디오 정지
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (engine.state === GAME_STATES.PLAYING) {
        engine.pause();
      } else {
        audioEngine.pauseAll();
      }
    }
  });

  window.addEventListener('blur', () => {
    if (engine.state === GAME_STATES.PLAYING) {
      engine.pause();
    }
  });

  // 첫 접속 언어 선택 및 메인 로비 진입 분기
  if (!save.langConfirmed) {
    lobbyUI.showLobby();
    lobbyUI.openInitialLanguageModal(() => {
      lobbyUI.showLobby();
      lobbyUI.renderActiveTab();
    });
  } else {
    lobbyUI.showLobby();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

