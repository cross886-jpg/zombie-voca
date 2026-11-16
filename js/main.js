/**
 * js/main.js
 * 앱 초기화 진입점:
 * - 세이브 로드, 다국어 적용, 마스터 영단어 CSV 로드
 * - #game-canvas 및 GameEngine, UI 모듈(hudUI, lobbyUI, growthUI, wordbookUI) 바인딩
 * - visibilitychange / blur 백그라운드 자동 일시정지 연결
 * - 첫 접속 시 30초 프롤로그 튜토리얼 자동 진입
 */

import { loadSave, getSave } from './core/saveStore.js';
import { audioEngine } from './core/audioEngine.js';
import { applyI18nToDOM, setLanguage } from './data/i18n.js';
import { loadWordDatabase } from './data/data_en.js?v=2';
import { GAME_STATES, GameEngine } from './game/gameEngine.js';
import { createHudUI } from './ui/hudUI.js';
import { createLobbyUI } from './ui/lobbyUI.js';
import { openInitialStudyLangModal } from './ui/lobbyModals.js';
import { createGrowthUI } from './ui/growthUI.js';
import { createShopUI } from './ui/shopUI.js';

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

  const hudUI = createHudUI(engine, {
    onReturnToLobby() {
      hudUI.closeModal();
      hudUI.hideHud();
      lobbyUI?.showLobby();
    },
    onStartBattle(opts) {
      hudUI.closeModal();
      hudUI.hideHud();
      startBattleFlow(opts);
    },
    onOpenWordLevelSelect() {
      hudUI.closeModal();
      hudUI.hideHud();
      lobbyUI?.showLobby();
      lobbyUI?.openWordLevelSelectModal?.({ isChange: false });
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

  function startBattleFlow({ chapterNumber, courseId, unitId, isTutorial = false, isPromotion = false, targetLevel = 'A2', isPlacement = false, isPlacementTest = false, targetUnitNum = 1, selectedTier = null } = {}) {
    audioEngine.unlock();
    lobbyUI.closeModal();
    lobbyUI.hideLobby();
    hudUI.closeModal();
    hudUI.showHud();
    canvas.classList.remove('hidden');
    engine.startBattle({ chapterNumber, courseId, unitId, isTutorial, isPromotion, targetLevel, isPlacement, isPlacementTest, targetUnitNum, selectedTier });
  }

  lobbyUI = createLobbyUI({
    onStartBattle({ chapterNumber, courseId, unitId, isPlacement = false, isPlacementTest = false, targetUnitNum = 1, isPromotion = false, targetLevel = null, selectedTier = null } = {}) {
      startBattleFlow({ chapterNumber, courseId, unitId, isTutorial: false, isPlacement, isPlacementTest, targetUnitNum, isPromotion, targetLevel, selectedTier });
    },
    onStartTutorial() {
      if (!getSave().langSelected) {
        openInitialStudyLangModal(
          {
            openModal: lobbyUI.openModal,
            closeModal: lobbyUI.closeModal,
            refreshHeader: lobbyUI.refreshHeader,
          },
          {
            onStartTutorial: () => startBattleFlow({ chapterNumber: 1, courseId: 'lv1', isTutorial: true }),
          }
        );
        return;
      }
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

  // 메인 로비 진입
  lobbyUI.showLobby();

  // 최초 접속 시 공부할 언어 선택 팝업 오픈
  if (!getSave().langSelected) {
    openInitialStudyLangModal(
      {
        openModal: lobbyUI.openModal,
        closeModal: lobbyUI.closeModal,
        refreshHeader: lobbyUI.refreshHeader,
      },
      {
        onStartTutorial: () => startBattleFlow({ chapterNumber: 1, courseId: 'lv1', isTutorial: true }),
      }
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

