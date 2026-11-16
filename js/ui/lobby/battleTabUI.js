/**
 * js/ui/lobby/battleTabUI.js
 * 하단 3번째 탭 [⚔️ 전투] (스테이지 캐러셀, 좌우 기능 퀵버튼, 2.5D 스테이지 HUD, 출격/산책 CTA 바) 전담 UI 모듈
 */

import { BREEDS, QUEST_DEFS } from '../../data/catalog.js';
import { getChapter, getChapterNumberForUnit } from '../../data/chapters.js';
import { t } from '../../data/i18n.js';
import { getTotalUnits } from '../../data/data_en.js?v=2';
import {
  getSave,
  updateSave,
  getAffection,
  addAffection,
  ensureQuestsState,
  getTodayDateKey,
  getPetDailyStatus,
  recordPetAction,
} from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import { computePlayerStats } from '../../entities/player.js';
import settingsStore from '../../settingsStore.js';

export function createBattleTabUI({
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
  getOnboardingTour,
  onStartBattle,
  onStartTutorial,
} = {}) {
  const panel = battlePanel || document.getElementById('tab-panel-battle');
  let petCooldownUntil = 0;
  let petCooldownTimerId = null;

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
      btn.innerHTML = `<span class="text-lg">🎓</span> <span data-i18n="lobby.startTutorial">${t('lobby.startTutorial')}</span>`;
      btn.className = 'w-2/3 max-w-[240px] py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white font-black text-sm sm:text-base shadow-[0_8px_24px_rgba(217,119,6,0.45)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer animate-pulse mx-auto';
    } else {
      btn.innerHTML = `<span class="text-lg">⚔️</span> <span data-i18n="lobby.startBattle">${t('lobby.startBattle')}</span>`;
      btn.className = 'w-2/3 max-w-[240px] py-4 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm sm:text-base shadow-[0_8px_24px_rgba(45,106,79,0.4)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer mx-auto';
    }
  }

  function renderBattleTab() {
    if (!panel) return;
    ensureDailyReset?.();
    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const care = profile.careSystem || { hunger: 100, thirst: 100, poopCount: 0, wellCaredBuff: false, lastWalkTime: 0 };
    const hungerPct = Math.max(0, Math.min(100, Math.round(care.hunger ?? 100)));
    const thirstPct = Math.max(0, Math.min(100, Math.round(care.thirst ?? 100)));
    const poopCount = Math.max(0, Math.min(5, Math.round(care.poopCount ?? 0)));
    const wellCaredBuff = Boolean(care.wellCaredBuff);

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

    const canGoPrev = curUnitNum > 1;
    const canGoNext = curUnitNum < Math.min(maxUnlocked, totalUnits);
    const nextIsLocked = !canGoNext && curUnitNum < totalUnits;
    const isFarmStage = curUnitNum < maxUnlocked;

    const curBreedId = save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
    const aff = getAffection(curBreedId, save);
    const dogName = profile.dogName || save.dogName || '우유';

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

    panel.className = 'flex flex-col justify-between h-full py-1 overflow-hidden';
    panel.innerHTML = `
      <div class="flex-1 flex flex-col justify-start relative pt-1">
        <div class="w-full flex items-start justify-between pointer-events-none z-10 px-0.5">
          <div class="flex flex-col gap-2 shrink-0 pointer-events-auto">
            <button id="btn-open-missions" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="퀘스트 목록">
              <span class="text-lg leading-none">📜</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center" data-i18n="lobby.quests">${t('lobby.quests')}</span>
              ${claimableMissions > 0 ? `<span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black shadow">${claimableMissions}</span>` : ''}
            </button>
            <button id="btn-open-airdrop" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="하늘에서 떨어지는 일일 보급품">
              <span class="text-lg leading-none">🪂</span>
              <span class="text-[10px] font-bold text-amber-800 leading-tight text-center" data-i18n="lobby.airdrop">${t('lobby.airdrop')}</span>
              <span id="airdrop-dot" class="${canClaimAirDrop ? '' : 'hidden'} absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-300"></span>
              ${canClaimAirDrop ? `<span class="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black shadow" data-i18n="lobby.free">${t('lobby.free')}</span>` : ''}
            </button>
          </div>

          <div class="flex flex-col gap-2 shrink-0 pointer-events-auto relative">
            <div class="relative">
              <button id="btn-hamburger-menu" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="더보기 메뉴">
                <span class="text-lg leading-none">☰</span>
                <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center" data-i18n="lobby.menu">${t('lobby.menu')}</span>
              </button>
              <div id="header-dropdown-menu" class="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-xl p-1.5 z-[60] flex flex-col gap-1 opacity-0 -translate-y-2 pointer-events-none invisible transition-all duration-200 ease-out">
                <button id="btn-menu-notice" type="button" class="w-full px-2.5 py-2 rounded-lg hover:bg-[#efe9dc] text-xs font-bold text-[#1f2d24] flex items-center gap-2 text-left active:scale-95 transition cursor-pointer">
                  <span>📢</span>
                  <span data-i18n="lobby.notice">${t('lobby.notice')}</span>
                </button>
                <button id="btn-menu-settings" type="button" class="w-full px-2.5 py-2 rounded-lg hover:bg-[#efe9dc] text-xs font-bold text-[#1f2d24] flex items-center gap-2 text-left active:scale-95 transition cursor-pointer">
                  <span>⚙️</span>
                  <span data-i18n="modal.settingsTitle">${t('modal.settingsTitle')}</span>
                </button>
              </div>
            </div>
            <button id="btn-open-attendance" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="30일 출석부">
              <span class="text-lg leading-none">📅</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center" data-i18n="lobby.attendance30d">${t('lobby.attendance30d')}</span>
              ${canClaimAttendance ? `<span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-300"></span>` : ''}
            </button>
            <button id="btn-start-walk" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer" title="산책하기">
              <span class="text-lg leading-none">🦮</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center" data-i18n="lobby.walk">${t('lobby.walk')}</span>
            </button>
          </div>
        </div>

        <div id="lobby-hero-profile-card" class="flex flex-col items-center justify-center text-center mt-auto mb-1 pointer-events-auto w-full max-w-[290px] mx-auto">
          <div id="lobby-hero-stage" class="relative group select-none overflow-hidden rounded-2xl w-[285px] h-[256px] border border-emerald-600/30 shadow-[0_4px_20px_rgba(45,106,79,0.18)] cursor-pointer" style="perspective: 600px;" title="탭하여 교감 (더블탭: 돌아!, 앞발: 손!)">
            <div id="stage-parallax-bg" class="absolute inset-[-14px] bg-gradient-to-b from-emerald-900/10 via-amber-500/5 to-emerald-800/15 pointer-events-none transition-transform duration-100 ease-out rounded-2xl" style="background-image: radial-gradient(circle at 50% 30%, rgba(52,211,153,0.18), transparent 70%);"></div>

            <div id="stage-dog-wrapper" class="relative w-full h-full flex items-center justify-center transition-transform duration-150 ease-out origin-bottom">
              <canvas id="lobby-hero-canvas" width="285" height="256" class="w-full h-full block"></canvas>
            </div>

            ${(hungerPct < 80 || thirstPct < 80) ? `
              <button id="care-bubble-head" type="button" data-care-type="${hungerPct < 80 ? 'food' : 'water'}" class="absolute top-2 left-1/2 -translate-x-1/2 bg-white/95 text-emerald-950 border-2 border-amber-400 font-black text-xs px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce z-20 cursor-pointer active:scale-95" title="탭하여 케어 퍼즐 풀기">
                <span>${hungerPct < 80 ? '🍖 밥 줘!' : '💧 목말라!'}</span>
              </button>
            ` : ''}

            ${poopCount > 0 ? `
              <button id="care-floor-poop" type="button" class="absolute bottom-2 right-3 bg-amber-100/95 text-amber-950 border border-amber-400 font-black text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse z-20 cursor-pointer active:scale-95" title="탭하여 응가 치우기">
                <span>💩</span>
                <span class="text-[10px] font-black">${poopCount}</span>
              </button>
            ` : ''}

            <button id="pet-action-badge" type="button" class="${petBadgeClass}" title="우유 쓰다듬기 (터치하여 교감)">
              ${petBadgeInner}
            </button>
          </div>

          <div class="w-full flex flex-col items-center gap-0.5 mt-1 px-1">
            <div class="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#1f2d24] bg-[#faf6ee] px-2.5 py-0.5 rounded-full border border-[#d2c8b4] shadow-xs">
              <span>🍖 ${hungerPct}%</span>
              <span class="text-[#a3b899]">·</span>
              <span>💧 ${thirstPct}%</span>
              <span class="text-[#a3b899]">·</span>
              <span>💩 ${poopCount}개</span>
              ${wellCaredBuff ? `
                <span class="text-[#a3b899]">·</span>
                <span class="text-emerald-800 font-black" data-i18n="lobby.petBestCondition">${t('lobby.petBestCondition')}</span>
              ` : ''}
            </div>

            <div class="flex flex-col items-center justify-center w-full px-1 mt-1 gap-0.5">
              <button id="btn-stage-hero-name" type="button" class="flex items-center justify-center gap-1.5 text-xs font-black text-[#1f2d24] hover:text-emerald-800 cursor-pointer active:scale-95 transition mx-auto px-2 py-0.5 rounded-lg hover:bg-emerald-50/50" title="프로필 및 파트너 설정 열기">
                <span>${heroName}</span>
                <span class="text-[10px] font-bold text-[#5c6e60]">(${curBreed.name})</span>
                <span class="text-[11px] text-emerald-700">✏️</span>
              </button>
              <div class="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-800">
                <span>${aff.hearts}</span>
                <span>${aff.title}</span>
              </div>
            </div>

            <div class="w-full h-1 rounded-full bg-[#e6dec8] overflow-hidden shadow-inner" title="친밀도: ${aff.levelXp}/${aff.targetXp} XP">
              <div id="lobby-affection-bar" class="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300" style="width: ${Math.round(aff.ratio * 100)}%"></div>
            </div>

            <div class="flex items-center justify-center gap-2 mt-0.5 text-xs font-extrabold">
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
      </div>

      <div id="lobby-stage-selector" class="relative w-full flex items-center justify-center gap-1.5 py-1 px-1 select-none overflow-hidden touch-pan-y cursor-grab active:cursor-grabbing">
        <div id="card-stage-prev" class="stage-peek-card ${canGoPrev ? 'cursor-pointer hover:opacity-75' : 'opacity-0 pointer-events-none'} flex flex-col items-center justify-center w-18 py-2 px-1 rounded-xl bg-[#faf6ee]/70 border border-[#d2c8b4] scale-85 opacity-50 shrink-0 transition-all duration-200" title="${t('lobby.prevStage')}">
          <span class="text-[10px] font-black text-[#5c6e60]">STAGE</span>
          <span class="text-xs font-black text-[#1f2d24]">◀ ${curUnitNum - 1}</span>
        </div>

        <div id="card-stage-current" class="stage-current-card flex-1 min-w-0 rounded-2xl bg-[#faf6ee] border-2 border-emerald-600/40 shadow-md p-2 text-center transition-all duration-200">
          <div class="text-[11px] font-bold text-[#4a584e] truncate flex items-center justify-center gap-1.5">
            <span class="font-black" style="color:${ch.theme.accentColor}">CH.${ch.number} ${ch.title}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-emerald-800 font-extrabold" data-i18n="${isFarmStage ? 'lobby.stageFarm' : 'lobby.stageClear'}">${isFarmStage ? t('lobby.stageFarm') : t('lobby.stageClear')}</span>
          </div>
          <div class="flex items-center justify-center gap-1.5 mt-0.5 min-w-0">
            <span class="text-sm font-black text-[#1f2d24] tracking-tight shrink-0">STAGE ${curUnitNum}</span>
          </div>
        </div>

        <div id="card-stage-next" class="stage-peek-card ${canGoNext ? 'cursor-pointer hover:opacity-75' : nextIsLocked ? 'pointer-events-none' : 'opacity-0 pointer-events-none'} flex flex-col items-center justify-center w-18 py-2 px-1 rounded-xl bg-[#faf6ee]/70 border border-[#d2c8b4] scale-85 opacity-50 shrink-0 transition-all duration-200" title="${nextIsLocked ? (t('lobby.chapterLocked') || '순차 돌파로 해금') : t('lobby.nextStage')}">
          <span class="text-[10px] font-black text-[#5c6e60]">STAGE</span>
          <span class="text-xs font-black text-[#1f2d24]">${nextIsLocked ? `🔒 ${curUnitNum + 1}` : `${curUnitNum + 1} ▶`}</span>
        </div>
      </div>
    `;

    renderHeroPreview?.();

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
      audioEngine.playCaptureTick();
      renderBattleTab();
    };

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

    const handlePetClick = (e) => {
      e?.stopPropagation?.();
      const status = getPetDailyStatus();

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
      if (now < petCooldownUntil) {
        return;
      }

      petCooldownUntil = now + 3000;
      recordPetAction();

      const cur = getSave();
      const breed = cur.selectedBreed || 'pomeranian';
      const isOnboardingPet = !cur.lobbyTourCompleted && cur.onboardingStep === 3;

      const affBonus = isOnboardingPet ? 25 : 3;
      addAffection(breed, affBonus);

      const affBar = document.getElementById('lobby-affection-bar');
      if (affBar) {
        const affData = getAffection(breed);
        affBar.style.width = `${Math.round(affData.ratio * 100)}%`;
      }

      if (typeof audioEngine?.playHappyBark === 'function') {
        audioEngine.playHappyBark();
      } else {
        audioEngine.playCaptureTick?.();
      }
      try {
        navigator.vibrate?.(35);
      } catch (_) {}

      const stage = document.getElementById('lobby-hero-stage');
      triggerDogHappyReaction?.(stage);

      if (isOnboardingPet) {
        const onboardingTour = typeof getOnboardingTour === 'function' ? getOnboardingTour() : null;
        onboardingTour?.completeWithPet?.();
      }

      updatePetBadge();
      if (petCooldownTimerId) clearInterval(petCooldownTimerId);
      petCooldownTimerId = setInterval(updatePetBadge, 500);

      renderHeroPreview?.();
      refreshHeader?.();
    };

    document.getElementById('pet-action-badge')?.addEventListener('click', handlePetClick);

    if (cooldownMs > 0 && !petCooldownTimerId) {
      petCooldownTimerId = setInterval(updatePetBadge, 500);
    }

    if (canGoPrev) {
      document.getElementById('card-stage-prev')?.addEventListener('click', () => moveStage(-1));
    }
    if (canGoNext) {
      document.getElementById('card-stage-next')?.addEventListener('click', () => moveStage(1));
    }

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

    const handleStartWalk = () => {
      audioEngine.playCaptureTick?.();
      openModal?.(`
        <div class="text-center py-4 space-y-3 select-none">
          <div class="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-sm">
            🦮
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-black text-[#1f2d24]">산책 러너 모드 준비 중!</h3>
            <p class="text-xs text-[#5c6e60] font-bold leading-relaxed break-keep px-2">
              🦮 3레인 산책 러너 모드 준비 중! 곧 수호견과 함께 달릴 수 있어요.
            </p>
          </div>
          <div class="pt-2">
            <button id="btn-close-walk-notice" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-white font-black text-xs active:scale-95 transition cursor-pointer">
              확인
            </button>
          </div>
        </div>
      `);
      document.getElementById('btn-close-walk-notice')?.addEventListener('click', () => closeModal?.());
    };

    document.getElementById('btn-open-missions')?.addEventListener('click', () => openQuestsModal?.('daily'));
    document.getElementById('btn-open-airdrop')?.addEventListener('click', () => openAirDropSupplyModal?.());
    document.getElementById('btn-open-attendance')?.addEventListener('click', () => openAttendance30Modal?.());
    document.getElementById('btn-start-walk')?.addEventListener('click', handleStartWalk);
    document.getElementById('btn-stage-hero-name')?.addEventListener('click', () => openProfileModal?.());
    document.getElementById('care-bubble-head')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = e.currentTarget.getAttribute('data-care-type') || 'food';
      openCarePuzzleModal?.(type);
    });

    document.getElementById('care-floor-poop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCarePuzzleModal?.('poop');
    });

    setupPetStageInteractions?.({
      curBreedId,
      handlePetClick,
      refreshHeader,
    });

    const btnMenu = document.getElementById('btn-hamburger-menu');
    const btnNotice = document.getElementById('btn-menu-notice');
    const btnSettings = document.getElementById('btn-menu-settings');

    btnMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderDropdown();
    });

    btnNotice?.addEventListener('click', () => {
      toggleHeaderDropdown(false);
      openNoticeModal?.();
    });

    btnSettings?.addEventListener('click', () => {
      toggleHeaderDropdown(false);
      openSettingsModal?.();
    });

    updateBattleCtaButton();
  }

  document.getElementById('btn-start-battle')?.addEventListener('click', () => {
    const cur = getSave();
    const curUnitNum = parseInt((cur.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = cur.maxUnlockedUnit || 1;

    if (!cur.tutorialCompleted && !cur.tutorialDone) {
      onStartTutorial?.();
      return;
    }

    if (!cur.hasSelectedWordLevel) {
      onStartBattle?.({
        chapterNumber: 1,
        courseId: cur.selectedCourse || 'lv1',
        unitId: 'unit_001',
        isPlacement: true,
        isPlacementTest: false,
      });
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

  document.getElementById('btn-start-walk')?.addEventListener('click', () => {
    audioEngine.playCaptureTick?.();
    openModal?.(`
      <div class="text-center py-4 space-y-3 select-none">
        <div class="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-sm">
          🦮
        </div>
        <div class="space-y-1">
          <h3 class="text-base font-black text-[#1f2d24]">산책 러너 모드 준비 중!</h3>
          <p class="text-xs text-[#5c6e60] font-bold leading-relaxed break-keep px-2">
            🦮 3레인 산책 러너 모드 준비 중! 곧 수호견과 함께 달릴 수 있어요.
          </p>
        </div>
        <div class="pt-2">
          <button id="btn-close-walk-notice" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-white font-black text-xs active:scale-95 transition cursor-pointer">
            확인
          </button>
        </div>
      </div>
    `);
    document.getElementById('btn-close-walk-notice')?.addEventListener('click', () => closeModal?.());
  });

  window.addEventListener('click', (e) => {
    if (!e.target.closest('#header-dropdown-menu') && !e.target.closest('#btn-hamburger-menu')) {
      toggleHeaderDropdown(false);
    }
  });

  return {
    renderBattleTab,
    toggleHeaderDropdown,
    updateBattleCtaButton,
  };
}
