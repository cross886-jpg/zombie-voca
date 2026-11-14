/**
 * js/ui/lobbyUI.js
 * 메인 로비 전투 탭(4개 난이도 코스, 5개 챕터, 출격 버튼),
 * 일일 미션 4종 모달, 7일 연속 출석부 모달, 설정(Base64 백업/복원, 튜토리얼 다시보기, 언어 스위치) 제어
 */

import { BREEDS, COSTUMES, QUEST_DEFS } from '../data/catalog.js';
import { CHAPTERS, getChapter, getChapterNumberForUnit } from '../data/chapters.js';
import { applyI18nToDOM, getLanguage, t } from '../data/i18n.js';
import { getTotalUnits } from '../data/data_en.js?v=2';
import { formatCourseBadge, getActiveCefrWords } from '../core/courseEngine.js';
import {
  getSave,
  updateSave,
  getAffection,
  addAffection,
  ensureQuestsState,
  getTodayDateKey,
  getPetDailyStatus,
  recordPetAction,
  MAX_SUPPORTERS,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats } from '../entities/player.js';
import { createLobbyModals } from './lobbyModals.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';

const DAILY_MISSION_DEFS = [
  { id: 'm_battle', key: 'battles', title: '전투 1회 출격', target: 1, gold: 100, snacks: 1 },
  { id: 'm_words', key: 'wordsCorrect', title: '영단어 20문제 정답', target: 20, gold: 150, snacks: 1 },
  { id: 'm_kills', key: 'kills', title: '좀비 50마리 처치', target: 50, gold: 140, snacks: 1 },
  { id: 'm_shop', key: 'shopVisit', title: '💎 상점 방문하기', target: 1, gold: 120, snacks: 2 },
];

const ATTENDANCE_REWARDS = [
  { day: 1, gold: 100, snacks: 1 },
  { day: 2, gold: 150, snacks: 1 },
  { day: 3, gold: 200, snacks: 2 },
  { day: 4, gold: 250, snacks: 2 },
  { day: 5, gold: 320, snacks: 3 },
  { day: 6, gold: 400, snacks: 3 },
  { day: 7, gold: 700, snacks: 5 },
];

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
  onRenderChallenge,
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
  const tabPanels = {
    gear: document.getElementById('tab-panel-gear'),
    battle: battlePanel,
    training: document.getElementById('tab-panel-training'),
    shop: document.getElementById('tab-panel-shop'),
    challenge: document.getElementById('tab-panel-challenge'),
  };
  const tabButtons = document.querySelectorAll('.lobby-tab-btn');

  let activeTab = 'battle';

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

  let viewedChapter = null;

  let onboardingTour = null;

  function showLobby() {
    lobbyLayer.classList.remove('hidden');
    viewedChapter = getSave().selectedChapter || 1;
    refreshHeader();
    renderActiveTab();
    onboardingTour?.syncTour();
  }

  function hideLobby() {
    onboardingTour?.hideTour();
    lobbyLayer.classList.add('hidden');
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
    openEditDogNameModal,
    openQuestsModal,
    openAirDropSupplyModal,
    openCefrModal,
    openAttendance30Modal,
    openNoticeModal,
    openProfileModal,
    openSettingsModal,
    openCourseSetupModal,
    openWordLevelSelectModal,
    createLobbyOnboardingTour,
  } = createLobbyModals({
    openModal,
    closeModal,
    modalCard,
    refreshHeader,
    renderBattleTab,
    renderActiveTab,
    onStartBattle,
    getProfileProgress,
  });

  onboardingTour = createLobbyOnboardingTour({
    switchTab,
    getActiveTab: () => activeTab,
  });

  let happyUntil = 0;
  let happyAnimFrameId = null;
  let petCooldownUntil = 0;
  let petCooldownTimerId = null;

  function triggerDogHappyReaction() {
    happyUntil = Date.now() + 2500;
    if (typeof window !== 'undefined' && window.cancelAnimationFrame && happyAnimFrameId) {
      cancelAnimationFrame(happyAnimFrameId);
    }
    renderHeroPreview();

    const stage = document.getElementById('lobby-hero-stage');
    if (!stage) return;

    // 1. 행복 말풍선
    const oldBubble = stage.querySelector('.dog-speech-bubble');
    if (oldBubble) oldBubble.remove();

    const bubble = document.createElement('div');
    bubble.className = 'dog-speech-bubble absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none bg-white text-emerald-950 border border-emerald-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-lg whitespace-nowrap z-30 animate-bounce select-none';
    const cheers = ['멍! 기분 최고예요! 💕', '와앙! 너무 좋아요! ✨', '꼬리 살랑살랑~ 💖', '헤헤 기분 짱이다 멍! 🐾'];
    bubble.textContent = cheers[Math.floor(Math.random() * cheers.length)];
    stage.appendChild(bubble);

    setTimeout(() => {
      bubble.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      bubble.style.opacity = '0';
      bubble.style.transform = 'translate(-50%, -10px)';
      setTimeout(() => bubble.remove(), 400);
    }, 1800);

    // 2. 다채로운 하트 파티클 여러 개 솟아오름
    const hearts = ['💕', '💖', '✨', '🐾', '🥰'];
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        const offsetX = (Math.random() - 0.5) * 80;
        p.className = 'absolute -top-3 left-1/2 pointer-events-none text-xl animate-float-heart z-20 select-none';
        p.style.transform = `translate(calc(-50% + ${offsetX}px), 0)`;
        p.textContent = hearts[i % hearts.length];
        stage.appendChild(p);
        setTimeout(() => p.remove(), 900);
      }, i * 160);
    }
  }

  function renderHeroPreview() {
    const canvas = document.getElementById('lobby-hero-canvas');
    if (!canvas) return;
    const save = getSave();
    const curBreedId = save.profileAvatarBreedId || save.selectedBreed || 'pomeranian';
    const now = Date.now();
    const isHappy = now < happyUntil;

    renderDogToCanvas(canvas, {
      save,
      breedId: curBreedId,
      scale: 2.65,
      y: canvas.height / 2 + 14,
      isHappy,
      time: now,
      companions: (save.companions?.active || []).slice(0, MAX_SUPPORTERS),
      withEquipment: true,
      withWeapon: true,
    });

    if (isHappy && typeof window !== 'undefined' && window.requestAnimationFrame) {
      happyAnimFrameId = requestAnimationFrame(renderHeroPreview);
    }
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

      evoBadge.innerHTML = `
        <span class="text-xl select-none leading-none">${curBreed.icon || '🐶'}</span>
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

  const battleCtaBar = document.getElementById('battle-cta-bar');

  function switchTab(tabKey) {
    if (!tabPanels[tabKey]) return;
    activeTab = tabKey;

    battleCtaBar?.classList.toggle('hidden', tabKey !== 'battle');

    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (key === tabKey) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
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
    } else if (activeTab === 'challenge') {
      onRenderChallenge?.();
    }
  }

  function renderBattleTab() {
    ensureDailyReset();
    const save = getSave();
    const today = getTodayDateKey();
    ensureQuestsState(save);
    const canClaimAttendance = (save.attendance30?.lastClaimDate || save.attendance?.lastClaimDate) !== today;
    const canClaimAirDrop = save.dailyAirDropDate !== today;
    const dReady = (QUEST_DEFS.daily || []).filter((q) => (save.quests?.daily?.progress?.[q.key] || 0) >= q.target && !save.quests?.daily?.claimed?.includes(q.id)).length;
    const wReady = (QUEST_DEFS.weekly || []).filter((q) => (save.quests?.weekly?.progress?.[q.key] || 0) >= q.target && !save.quests?.weekly?.claimed?.includes(q.id)).length;
    const aReady = (QUEST_DEFS.achievements || []).filter((q) => (save.quests?.achievements?.progress?.[q.key] || 0) >= q.target && !save.quests?.achievements?.claimed?.includes(q.id)).length;
    const claimableMissions = dReady + wReady + aReady;

    const stats = computePlayerStats(save);
    const curUnitNum = parseInt((save.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const totalUnits = getTotalUnits();
    const curChapterNum = getChapterNumberForUnit(curUnitNum, totalUnits);
    const ch = getChapter(curChapterNum);

    // 스테이지는 순차 돌파 전용: 클리어한 과거 스테이지만 복습·파밍 이동 가능, 미개방 다음 스테이지는 잠금
    const canGoPrev = curUnitNum > 1;
    const canGoNext = curUnitNum < Math.min(maxUnlocked, totalUnits);
    const nextIsLocked = !canGoNext && curUnitNum < totalUnits;
    const isFarmStage = curUnitNum < maxUnlocked;

    const curBreedId = save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
    const aff = getAffection(curBreedId, save);
    const dogName = save.dogName || '우유';

    const petStatus = getPetDailyStatus();
    const now = Date.now();
    const cooldownMs = Math.max(0, petCooldownUntil - now);
    let petBadgeInner = '<span class="text-sm leading-none drop-shadow-xs">🩷</span>';
    let petBadgeClass = 'absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#faf6ee] hover:bg-rose-50 border-2 border-rose-400/80 shadow-md flex items-center justify-center text-sm active:scale-90 hover:scale-105 transition cursor-pointer select-none';

    if (!petStatus.canPet) {
      petBadgeInner = '<span class="text-xs leading-none grayscale opacity-60">🤍</span>';
      petBadgeClass = 'absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#f0ebe0] border border-[#d2c8b4] shadow-xs flex items-center justify-center cursor-default opacity-70 select-none';
    } else if (cooldownMs > 0) {
      petBadgeInner = `<span class="text-[10px] font-bold text-amber-700">${Math.ceil(cooldownMs / 1000)}s</span>`;
      petBadgeClass = 'absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-50 border border-amber-300 shadow-xs flex items-center justify-center animate-pulse select-none';
    }

    let heroName = dogName;
    if (save.equippedSkin === 'skin_crown') {
      heroName = `👑 황금 왕관 ${dogName}`;
    } else if (save.equippedSkin === 'skin_astronaut') {
      heroName = `🧑‍🚀 우주비행사 ${dogName}`;
    } else if (save.equippedSkin === 'skin_detective') {
      heroName = `🕵️ 탐정 ${dogName}`;
    }

    battlePanel.className = 'flex flex-col justify-between min-h-full py-2';
    battlePanel.innerHTML = `
      <!-- 오픈 스테이지 히어로 영역 (상단 좌우 기능 버튼 + 중앙 수호견 오픈 스테이지) -->
      <div class="flex-1 flex flex-col justify-start relative pt-1">
        <!-- 상단 고정 좌우 사이드 버튼 행 (상단 녹색 헤더 바로 아래) -->
        <div class="w-full flex items-start justify-between pointer-events-none z-10 px-0.5">
          <!-- 좌측 상단 (프로필 위젯 바로 아래): 📜 퀘스트 -> 🪂 보급품 -->
          <div class="flex flex-col gap-2 shrink-0 pointer-events-auto">
            <button id="btn-open-missions" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="퀘스트 목록">
              <span class="text-lg leading-none">📜</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center">${t('lobby.quests')}</span>
              ${claimableMissions > 0 ? `<span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black shadow">${claimableMissions}</span>` : ''}
            </button>
            <button id="btn-open-airdrop" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="하늘에서 떨어지는 일일 보급품">
              <span class="text-lg leading-none">🪂</span>
              <span class="text-[10px] font-bold text-amber-800 leading-tight text-center">보급품</span>
              <span id="airdrop-dot" class="${canClaimAirDrop ? '' : 'hidden'} absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-300"></span>
              ${canClaimAirDrop ? '<span class="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black shadow">무료</span>' : ''}
            </button>
          </div>

          <!-- 우측 상단 (보석 재화 바로 아래): ☰ 메뉴 -> 📅 30일 출석 (메뉴가 위, 30일 출석이 아래) -->
          <div class="flex flex-col gap-2 shrink-0 pointer-events-auto relative">
            <div class="relative">
            <button id="btn-hamburger-menu" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="더보기 메뉴">
              <span class="text-lg leading-none">☰</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center">메뉴</span>
            </button>
              <!-- 햄버거 드롭다운 팝업 (우측 정렬) -->
              <div id="header-dropdown-menu" class="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-xl p-1.5 z-[60] flex flex-col gap-1 opacity-0 -translate-y-2 pointer-events-none invisible transition-all duration-200 ease-out">
                <button id="btn-menu-notice" type="button" class="w-full px-2.5 py-2 rounded-lg hover:bg-[#efe9dc] text-xs font-bold text-[#1f2d24] flex items-center gap-2 text-left active:scale-95 transition cursor-pointer">
                  <span>📢</span>
                  <span>공지사항</span>
                </button>
                <button id="btn-menu-settings" type="button" class="w-full px-2.5 py-2 rounded-lg hover:bg-[#efe9dc] text-xs font-bold text-[#1f2d24] flex items-center gap-2 text-left active:scale-95 transition cursor-pointer">
                  <span>⚙️</span>
                  <span>${t('modal.settingsTitle') || '게임 설정'}</span>
                </button>
              </div>
            </div>
            <button id="btn-open-attendance" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="30일 출석부">
              <span class="text-lg leading-none">📅</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center">${t('lobby.attendance30d')}</span>
              ${canClaimAttendance ? `<span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-300"></span>` : ''}
            </button>
          </div>
        </div>

        <!-- 하단 무대 영역: 하단 스테이지 네비게이션(CH.1 STAGE 1) 바로 위쪽에 배치된 큼직한 수호견 쇼케이스 무대 -->
        <div id="lobby-hero-profile-card" class="flex flex-col items-center justify-center text-center mt-auto mb-1 pointer-events-auto w-full max-w-[280px] mx-auto">
          <div id="lobby-hero-stage" class="relative group cursor-pointer active:scale-95 transition select-none" title="탭하여 쓰다듬기 🩷">
            <div class="relative w-52 h-[156px] rounded-2xl bg-radial from-emerald-600/20 via-emerald-600/5 to-transparent flex items-center justify-center p-1">
              <canvas id="lobby-hero-canvas" width="208" height="156" class="w-52 h-[156px] rounded-2xl bg-[#faf6ee] border border-emerald-600/40 shadow-[0_0_24px_rgba(45,106,79,0.2)] block"></canvas>
              <button id="pet-action-badge" type="button" class="${petBadgeClass}" title="우유 쓰다듬기 (터치하여 교감)">
                ${petBadgeInner}
              </button>
            </div>
          </div>

          <!-- 현재 선택된 견종명 배지 & 친밀도 5단계 게이지 -->
          <div class="flex items-center justify-center gap-1.5 mt-1.5">
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">
              🐾 ${curBreed.name} · ${t(stats.evoStage.key)}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black flex items-center gap-1">
              ${aff.hearts} ${aff.title}
            </span>
          </div>

          <!-- 친밀도 미니 게이지 바 -->
          <div class="w-36 h-1.5 rounded-full bg-[#e6dec8] mt-1 overflow-hidden shadow-inner" title="친밀도 경험치: ${aff.levelXp}/${aff.targetXp} XP">
            <div id="lobby-affection-bar" class="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300" style="width: ${Math.round(aff.ratio * 100)}%"></div>
          </div>

          <!-- 순수 강아지 이름표 (수정은 프로필 & 설정 모달에서 전담) -->
          <div class="text-base font-black text-[#1f2d24] mt-0.5 tracking-tight">
            ${heroName}
          </div>

          <!-- 핵심 4종 스탯 (전투력 · 공격력 · 체력 · 이동속도) -->
          <div class="flex items-center justify-center gap-2 mt-1 text-xs font-extrabold">
            <span class="text-amber-800">⚡ ${stats.combatPower}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-emerald-800">⚔️ ${stats.atk}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-rose-600">❤️ ${stats.maxHp}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-teal-800">👟 ${Math.round(stats.speed)}</span>
          </div>
        </div>
      </div>

      <!-- 로비 하단 3단 스테이지 스냅 캐러셀 & 스와이프 제어 -->
      <div id="lobby-stage-selector" class="relative w-full flex items-center justify-center gap-1.5 py-1 px-1 select-none overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing">
        <!-- 좌측 카드 (이전 스테이지 살짝 엿보기) -->
        <div id="card-stage-prev" class="stage-peek-card ${canGoPrev ? 'cursor-pointer hover:opacity-75' : 'opacity-0 pointer-events-none'} flex flex-col items-center justify-center w-18 py-2 px-1 rounded-xl bg-[#faf6ee]/70 border border-[#d2c8b4] scale-85 opacity-50 shrink-0 transition-all duration-200" title="이전 스테이지">
          <span class="text-[10px] font-black text-[#5c6e60]">STAGE</span>
          <span class="text-xs font-black text-[#1f2d24]">◀ ${curUnitNum - 1}</span>
        </div>

        <!-- 중앙 카드 (현재 스테이지 메인) -->
        <div id="card-stage-current" class="stage-current-card flex-1 min-w-0 rounded-2xl bg-[#faf6ee] border-2 border-emerald-600/40 shadow-md p-2 text-center transition-all duration-200">
          <div class="text-[11px] font-bold text-[#4a584e] truncate flex items-center justify-center gap-1.5">
            <span class="font-black" style="color:${ch.theme.accentColor}">CH.${ch.number} ${ch.title}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-emerald-800 font-extrabold">${isFarmStage ? '복습·코인 파밍' : '순차 돌파'}</span>
          </div>
          <div class="flex items-center justify-center gap-1.5 mt-0.5 min-w-0">
            <span class="text-sm font-black text-[#1f2d24] tracking-tight shrink-0">STAGE ${curUnitNum}</span>
          </div>
        </div>

        <!-- 우측 카드 (다음 스테이지 살짝 엿보기) -->
        <div id="card-stage-next" class="stage-peek-card ${canGoNext ? 'cursor-pointer hover:opacity-75' : nextIsLocked ? 'pointer-events-none' : 'opacity-0 pointer-events-none'} flex flex-col items-center justify-center w-18 py-2 px-1 rounded-xl bg-[#faf6ee]/70 border border-[#d2c8b4] scale-85 opacity-50 shrink-0 transition-all duration-200" title="${nextIsLocked ? '순차 돌파로 해금' : '다음 스테이지'}">
          <span class="text-[10px] font-black text-[#5c6e60]">STAGE</span>
          <span class="text-xs font-black text-[#1f2d24]">${nextIsLocked ? `🔒 ${curUnitNum + 1}` : `${curUnitNum + 1} ▶`}</span>
        </div>
      </div>
    `;

    renderHeroPreview();

    const moveStage = (delta) => {
      const cur = getSave();
      const curNum = parseInt((cur.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
      const tot = getTotalUnits();
      const nextNum = curNum + delta;

      if (nextNum < 1 || nextNum > Math.min(cur.maxUnlockedUnit || 1, tot)) {
        return;
      }

      const nextUnitId = `unit_${String(nextNum).padStart(3, '0')}`;
      const nextCh = getChapterNumberForUnit(nextNum, tot);

      updateSave((s) => {
        s.selectedUnit = nextUnitId;
        s.selectedChapter = nextCh;
      });
      viewedChapter = nextCh;
      audioEngine.playCaptureTick();
      renderBattleTab();
    };

    // 중앙 무대 쓰다듬기 인터랙션 뱃지 실시간 상태 갱신 함수
    const updatePetBadge = () => {
      const badgeEl = document.getElementById('pet-action-badge');
      if (!badgeEl) return;
      const status = getPetDailyStatus();
      const now = Date.now();
      const remainingCooldown = Math.max(0, petCooldownUntil - now);

      if (!status.canPet) {
        badgeEl.innerHTML = '<span class="text-xs leading-none grayscale opacity-60">🤍</span>';
        badgeEl.className = 'absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#f0ebe0] border border-[#d2c8b4] shadow-xs flex items-center justify-center cursor-default opacity-70 select-none';
        if (petCooldownTimerId) {
          clearInterval(petCooldownTimerId);
          petCooldownTimerId = null;
        }
      } else if (remainingCooldown > 0) {
        const sec = Math.ceil(remainingCooldown / 1000);
        badgeEl.innerHTML = `<span class="text-[10px] font-bold text-amber-700">${sec}s</span>`;
        badgeEl.className = 'absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-50 border border-amber-300 shadow-xs flex items-center justify-center animate-pulse select-none';
      } else {
        badgeEl.innerHTML = '<span class="text-sm leading-none drop-shadow-xs">🩷</span>';
        badgeEl.className = 'absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#faf6ee] hover:bg-rose-50 border-2 border-rose-400/80 shadow-md flex items-center justify-center text-sm active:scale-90 hover:scale-105 transition cursor-pointer select-none';
        if (petCooldownTimerId) {
          clearInterval(petCooldownTimerId);
          petCooldownTimerId = null;
        }
      }
    };

    // 중앙 무대 쓰다듬기 상호작용 (일일 5회 제한, 3초 쿨타임, 행복 반응 애니메이션 & 친밀도 상승)
    const handlePetClick = (e) => {
      e?.stopPropagation?.();
      const status = getPetDailyStatus();

      // 오늘 5회 모두 소진 시 안내
      if (!status.canPet) {
        const stage = document.getElementById('lobby-hero-stage');
        if (stage && !stage.querySelector('.pet-limit-bubble')) {
          const bubble = document.createElement('div');
          bubble.className = 'pet-limit-bubble absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1f2d24]/90 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg pointer-events-none whitespace-nowrap z-30 animate-bounce';
          bubble.textContent = '오늘 교감 완료! 내일 또 만나요 🐾';
          stage.appendChild(bubble);
          setTimeout(() => bubble.remove(), 1800);
        }
        return;
      }

      const now = Date.now();
      // 3초 쿨타임 검사
      if (now < petCooldownUntil) {
        return;
      }

      // 쿨타임 3초 설정
      petCooldownUntil = now + 3000;

      // 일일 횟수 & 일일 퀘스트 반영
      recordPetAction();

      const cur = getSave();
      const breed = cur.selectedBreed || 'pomeranian';
      const isOnboardingPet = !cur.onboardingCompleted && cur.onboardingStep === 4;

      // 튜토리얼 4단계 쓰다듬기 시에는 친밀도 게이지가 눈에 띄게 쑥 차오르도록 25점 부여
      const affBonus = isOnboardingPet ? 25 : 3;
      addAffection(breed, affBonus);

      // 하트 친밀도 게이지 바 즉시 폭 갱신
      const affBar = document.getElementById('lobby-affection-bar');
      if (affBar) {
        const affData = getAffection(breed);
        affBar.style.width = `${Math.round(affData.ratio * 100)}%`;
      }

      // 효과음 & 햅틱 진동
      if (typeof audioEngine?.playHappyBark === 'function') {
        audioEngine.playHappyBark();
      } else {
        audioEngine.playCaptureTick?.();
      }
      try {
        navigator.vibrate?.(35);
      } catch (_) {}

      // 강아지 행복 애니메이션 + 파티클 + 말풍선 트리거
      const stage = document.getElementById('lobby-hero-stage');
      triggerDogHappyReaction(stage, breed);

      // 온보딩 쓰다듬기 완료 시 축하 및 투어 종료 연동
      if (isOnboardingPet) {
        onboardingTour?.completeWithPet?.();
      }

      // 인터랙션 뱃지 즉시 갱신 및 쿨타임 인터벌 시작
      updatePetBadge();
      if (petCooldownTimerId) clearInterval(petCooldownTimerId);
      petCooldownTimerId = setInterval(updatePetBadge, 500);

      renderHeroPreview();
      refreshHeader();
    };

    document.getElementById('lobby-hero-stage')?.addEventListener('click', handlePetClick);
    document.getElementById('pet-action-badge')?.addEventListener('click', handlePetClick);

    // 이전 턴 쿨타임이 남아있다면 인터벌 이어가기
    if (cooldownMs > 0 && !petCooldownTimerId) {
      petCooldownTimerId = setInterval(updatePetBadge, 500);
    }

    if (canGoPrev) {
      document.getElementById('card-stage-prev')?.addEventListener('click', () => moveStage(-1));
    }
    if (canGoNext) {
      document.getElementById('card-stage-next')?.addEventListener('click', () => moveStage(1));
    }

    // 터치/마우스 좌우 스와이프(드래그) 지원
    const stageSelectorEl = document.getElementById('lobby-stage-selector');
    if (stageSelectorEl) {
      let touchStartX = 0;
      let touchStartY = 0;
      stageSelectorEl.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      stageSelectorEl.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) moveStage(1);
            else moveStage(-1);
          }
        }
      });

      let mouseStartX = 0;
      let isMouseDown = false;
      stageSelectorEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('#card-stage-prev') || e.target.closest('#card-stage-next')) return;
        isMouseDown = true;
        mouseStartX = e.clientX;
      });
      stageSelectorEl.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        isMouseDown = false;
        const dx = e.clientX - mouseStartX;
        if (Math.abs(dx) > 35) {
          if (dx < 0) moveStage(1);
          else moveStage(-1);
        }
      });
      stageSelectorEl.addEventListener('mouseleave', () => {
        isMouseDown = false;
      });
    }

    document.getElementById('btn-open-missions')?.addEventListener('click', () => openQuestsModal('daily'));
    document.getElementById('btn-open-airdrop')?.addEventListener('click', openAirDropSupplyModal);
    document.getElementById('btn-open-attendance')?.addEventListener('click', openAttendance30Modal);

    const btnMenu = document.getElementById('btn-hamburger-menu');
    const btnNotice = document.getElementById('btn-menu-notice');
    const btnSettings = document.getElementById('btn-menu-settings');

    btnMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderDropdown();
    });

    btnNotice?.addEventListener('click', () => {
      toggleHeaderDropdown(false);
      openNoticeModal();
    });

    btnSettings?.addEventListener('click', () => {
      toggleHeaderDropdown(false);
      openSettingsModal();
    });

    updateBattleCtaButton();
  }

  function toggleHeaderDropdown(forceOpen) {
    const dropdown = document.getElementById('header-dropdown-menu');
    if (!dropdown) return;
    const isOpen = !dropdown.classList.contains('invisible');
    const open = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    dropdown.classList.toggle('invisible', !open);
    dropdown.classList.toggle('opacity-0', !open);
    dropdown.classList.toggle('-translate-y-2', !open);
    dropdown.classList.toggle('pointer-events-none', !open);
  }

  function updateBattleCtaButton() {
    const btn = document.getElementById('btn-start-battle');
    if (!btn) return;
    const save = getSave();
    const isTutorialNeeded = !save.tutorialCompleted && !save.tutorialDone;

    if (isTutorialNeeded) {
      btn.innerHTML = `🎓 <span data-i18n="lobby.startTutorial">${t('lobby.startTutorial')}</span>`;
      btn.className = 'w-[190px] mx-auto block py-3 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white font-black text-sm shadow-[0_6px_20px_rgba(217,119,6,0.4)] active:scale-95 transition animate-pulse';
    } else {
      btn.innerHTML = `⚔️ <span data-i18n="lobby.startBattle">${t('lobby.startBattle')}</span>`;
      btn.className = 'w-[180px] mx-auto block py-3 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm shadow-[0_6px_20px_rgba(45,106,79,0.35)] active:scale-95 transition';
    }
  }

  document.getElementById('btn-start-battle')?.addEventListener('click', () => {
    const cur = getSave();
    const curUnitNum = parseInt((cur.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = cur.maxUnlockedUnit || 1;

    if (!cur.tutorialCompleted && !cur.tutorialDone) {
      onStartTutorial?.();
      return;
    }

    // 튜토리얼 완료 후 첫 출격 시 9단계 단어 레벨 선택 모달 노출 (이미 선택했거나 배치 완료 시 직행)
    if (!cur.hasSelectedWordLevel) {
      openWordLevelSelectModal({ isChange: false });
      return;
    }

    const totalUnits = getTotalUnits();
    let unitToPlay = cur.selectedUnit || 'unit_001';
    if (curUnitNum > maxUnlocked || curUnitNum > totalUnits) {
      const safeUnit = Math.min(maxUnlocked, totalUnits);
      unitToPlay = `unit_${String(safeUnit).padStart(3, '0')}`;
      updateSave((s) => {
        s.selectedUnit = unitToPlay;
      });
    }
    onStartBattle?.({
      chapterNumber: cur.selectedChapter,
      courseId: cur.selectedCourse,
      unitId: unitToPlay,
      isPlacement: false,
      isPlacementTest: false,
    });
  });

  // 탭 버튼 이벤트 바인딩
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-lobby-tab');
      switchTab(tabKey);
    });
  });

  // 상단 헤더 프로필 & CEFR 레벨 설정 & 재화 바로가기 바인딩
  document.getElementById('btn-header-profile')?.addEventListener('click', openProfileModal);
  certBadge?.addEventListener('click', (e) => {
    e.stopPropagation();
    openWordLevelSelectModal({ isChange: true });
  });
  document.getElementById('btn-header-gold')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-snacks')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-gems')?.addEventListener('click', () => switchTab('shop'));

  window.addEventListener('click', (e) => {
    if (!e.target.closest('#header-dropdown-menu') && !e.target.closest('#btn-hamburger-menu')) {
      toggleHeaderDropdown(false);
    }
  });

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
    openCefrModal,
    openAirDropSupplyModal,
    openWordLevelSelectModal,
  };
}

