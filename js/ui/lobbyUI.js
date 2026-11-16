/**
 * js/ui/lobbyUI.js
 * 메인 로비 컨트롤러 (상단 헤더 갱신, 하단 5탭 전환, 하위 로비 UI 모듈 오케스트레이션)
 * - lobby/petStageUI.js   : 2.5D 아웃포스트 스테이지 렌더링, 터치 교감, 케어 퍼즐 모달
 * - lobby/battleTabUI.js  : [⚔️ 전투] 탭 스테이지 캐러셀, 좌우 퀵버튼, 출격/산책 CTA 바
 * - lobby/compendiumUI.js : [📖 도감] 탭 4대 서브탭(단어장 / 장비 / 스킬 / 캐릭터)
 */

import { BREEDS } from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { formatCourseBadge, getActiveCefrWords } from '../core/courseEngine.js';
import {
  getSave,
  updateSave,
  getTodayDateKey,
} from '../core/saveStore.js';
import { createLobbyModals } from './lobbyModals.js';
import { createPetStageUI } from './lobby/petStageUI.js';
import { createCompendiumUI } from './lobby/compendiumUI.js';
import { createBattleTabUI } from './lobby/battleTabUI.js';

export function formatCompactNumber(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

export function getProfileProgress(save) {
  const curLevelWords = getActiveCefrWords();
  const total = curLevelWords.length;
  if (total <= 0) return { pct: 0, mastered: 0, total: 0 };

  const statsObj = save?.wordStats || {};
  let mastered = 0;
  curLevelWords.forEach((w) => {
    const st = statsObj[w.id];
    if (st && ((st.correct || 0) >= 3 || st.mastered)) {
      mastered++;
    }
  });

  const pct = Math.max(0, Math.min(100, Math.round((mastered / total) * 100)));
  return { pct, mastered, total };
}

export function createLobbyUI({
  onStartBattle,
  onStartTutorial,
  onRenderGear,
  onRenderTraining,
  onRenderShop,
} = {}) {
  const lobbyLayer = document.getElementById('lobby-layer');
  const modalLayer = document.getElementById('modal-layer');
  const modalCard = document.getElementById('modal-card');

  const evoBadge = document.getElementById('lobby-evo-badge');
  const playerTitle = document.getElementById('lobby-player-title');
  const certBadge = document.getElementById('lobby-cert-badge');
  const headerXpBar = document.getElementById('lobby-header-xp-bar');
  const resGold = document.getElementById('res-gold');
  const resSnacks = document.getElementById('res-snacks');
  const resGems = document.getElementById('res-gems');

  const battlePanel = document.getElementById('tab-panel-battle');
  const compendiumPanel = document.getElementById('tab-panel-compendium');
  const tabPanels = {
    gear: document.getElementById('tab-panel-gear'),
    battle: battlePanel,
    training: document.getElementById('tab-panel-training'),
    shop: document.getElementById('tab-panel-shop'),
    compendium: compendiumPanel,
  };
  const tabButtons = document.querySelectorAll('.lobby-tab-btn');
  const battleCtaBar = document.getElementById('battle-cta-bar');

  let activeTab = 'battle';
  let onboardingTour = null;

  function ensureDailyReset() {
    const today = getTodayDateKey();
    const save = getSave();
    if (save.dailyMissions.date !== today) {
      updateSave((s) => {
        s.dailyMissions.date = today;
        s.dailyMissions.progress = { battles: 0, wordsCorrect: 0, kills: 0, miniReview: 0 };
        s.dailyMissions.claimed = [];
      });
    }
  }

  function openModal(html) {
    modalCard.innerHTML = html;
    modalLayer.classList.remove('hidden');
  }

  function closeModal() {
    modalLayer.classList.add('hidden');
    modalCard.innerHTML = '';
  }

  const {
    triggerDogHappyReaction,
    openCarePuzzleModal,
    renderHeroPreview,
    setupPetStageInteractions,
  } = createPetStageUI({
    openModal,
    closeModal,
    getActiveTab: () => activeTab,
    onRefreshAll: () => {
      renderBattleTab();
      refreshHeader();
    },
  });

  const { renderCompendiumTab } = createCompendiumUI({
    compendiumPanel,
    openModal,
    closeModal,
    onStartBattle,
  });

  const {
    openQuestsModal,
    openAirDropSupplyModal,
    openAttendance30Modal,
    openNoticeModal,
    openProfileModal,
    openSettingsModal,
    openWordLevelSelectModal,
    createLobbyOnboardingTour,
  } = createLobbyModals({
    openModal,
    closeModal,
    modalCard,
    refreshHeader,
    renderBattleTab: () => renderBattleTab(),
    renderActiveTab,
    onStartBattle,
    getProfileProgress,
  });

  const { renderBattleTab } = createBattleTabUI({
    battlePanel,
    openModal,
    closeModal,
    ensureDailyReset,
    refreshHeader,
    renderHeroPreview,
    setupPetStageInteractions,
    triggerDogHappyReaction,
    openCarePuzzleModal,
    openQuestsModal,
    openAirDropSupplyModal,
    openAttendance30Modal,
    openProfileModal,
    openNoticeModal,
    openSettingsModal,
    getOnboardingTour: () => onboardingTour,
    onStartBattle,
    onStartTutorial,
  });

  onboardingTour = createLobbyOnboardingTour({
    switchTab,
    getActiveTab: () => activeTab,
  });

  function showLobby() {
    lobbyLayer.classList.remove('hidden');
    refreshHeader();
    renderActiveTab();
    onboardingTour?.syncTour();
  }

  function hideLobby() {
    onboardingTour?.hideTour();
    lobbyLayer.classList.add('hidden');
  }

  function refreshHeader() {
    const save = getSave();
    const curBreedId = save.profileAvatarBreedId || save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];

    if (evoBadge) {
      let skinBadge = '';
      if (save.equippedSkin === 'skin_crown') skinBadge = '<span class="absolute -top-1.5 -left-1 text-[11px] leading-none select-none">👑</span>';
      else if (save.equippedSkin === 'skin_astronaut') skinBadge = '<span class="absolute -top-1.5 -left-1 text-[11px] leading-none select-none">🧑‍🚀</span>';
      else if (save.equippedSkin === 'skin_detective') skinBadge = '<span class="absolute -top-1.5 -left-1 text-[11px] leading-none select-none">🕵️</span>';

      const avatarIcon = save.profileAvatarIcon || curBreed.icon || '🐶';
      evoBadge.innerHTML = `
        <span class="text-xl select-none leading-none">${avatarIcon}</span>
        ${skinBadge}
      `;
    }

    if (playerTitle) playerTitle.textContent = save.dogName || t('app.playerDefaultName');
    if (certBadge) certBadge.textContent = formatCourseBadge(save);

    if (headerXpBar) {
      const { pct, mastered, total } = getProfileProgress(save);
      headerXpBar.style.width = `${pct}%`;
      headerXpBar.parentElement?.setAttribute('title', `마스터 진행도: ${mastered}/${total} (${pct}%)`);
    }

    if (resGold) resGold.textContent = formatCompactNumber(save.gold || 0);
    if (resSnacks) resSnacks.textContent = formatCompactNumber(save.snacks || 0);
    if (resGems) resGems.textContent = formatCompactNumber(save.gems ?? 0);
    const airdropDot = document.getElementById('airdrop-dot');
    if (airdropDot) {
      const today = getTodayDateKey();
      const canClaimAirDrop = save.dailyAirDropDate !== today;
      airdropDot.classList.toggle('hidden', !canClaimAirDrop);
    }
    renderHeroPreview();
  }

  function switchTab(tabKey) {
    if (!tabPanels[tabKey]) return;
    activeTab = tabKey;

    battleCtaBar?.classList.toggle('hidden', tabKey !== 'battle');

    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (key === tabKey) {
        panel?.classList.remove('hidden');
      } else {
        panel?.classList.add('hidden');
      }
    });

    tabButtons.forEach((btn) => {
      const btnTab = btn.getAttribute('data-lobby-tab');
      const isActive = btnTab === tabKey;
      const isBattle = btnTab === 'battle';

      btn.classList.toggle('active', isActive);

      if (isBattle) {
        btn.classList.toggle('bg-[#234735]', isActive);
        btn.classList.toggle('bg-[#1e3f2e]', !isActive);
        btn.classList.toggle('border-emerald-400/60', isActive);
        btn.classList.toggle('border-emerald-700/40', !isActive);
        btn.classList.toggle('text-[#f8f5ec]', isActive);
        btn.classList.toggle('text-[#a3b899]', !isActive);
        btn.classList.toggle('shadow-[0_4px_12px_rgba(0,0,0,0.35)]', isActive);
        btn.classList.toggle('shadow-sm', !isActive);
      } else {
        btn.classList.toggle('bg-[#234735]', isActive);
        btn.classList.toggle('text-[#f8f5ec]', isActive);
        btn.classList.toggle('border-emerald-400/50', isActive);
        btn.classList.toggle('shadow-sm', isActive);

        btn.classList.toggle('text-[#a3b899]', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
      }
    });

    renderActiveTab();
    onboardingTour?.syncTour();
  }

  function renderActiveTab() {
    if (activeTab === 'battle') {
      renderBattleTab();
    } else if (activeTab === 'gear') {
      onRenderGear?.();
    } else if (activeTab === 'training') {
      onRenderTraining?.();
    } else if (activeTab === 'shop') {
      updateSave((s) => {
        if (!s.dailyMissions) s.dailyMissions = { progress: {} };
        if (!s.dailyMissions.progress) s.dailyMissions.progress = {};
        s.dailyMissions.progress.shopVisit = 1;
      });
      onRenderShop?.();
    } else if (activeTab === 'compendium') {
      renderCompendiumTab();
    }
  }

  // 탭 버튼 이벤트 바인딩
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-lobby-tab');
      switchTab(tabKey);
    });
  });

  // 상단 헤더 프로필 & 레벨 설정 & 재화 바로가기 바인딩
  document.getElementById('btn-header-profile')?.addEventListener('click', openProfileModal);
  certBadge?.addEventListener('click', (e) => {
    e.stopPropagation();
    openWordLevelSelectModal({ isChange: true });
  });
  document.getElementById('btn-header-gold')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-snacks')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-gems')?.addEventListener('click', () => switchTab('shop'));

  return {
    showLobby,
    hideLobby,
    refreshHeader,
    switchTab,
    renderActiveTab,
    openModal,
    closeModal,
    openProfileModal,
    openSettingsModal,
    openNoticeModal,
    openAirDropSupplyModal,
    openWordLevelSelectModal,
    openCarePuzzleModal,
    renderCompendiumTab,
  };
}
