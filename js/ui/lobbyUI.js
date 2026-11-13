/**
 * js/ui/lobbyUI.js
 * 메인 로비 전투 탭(4개 난이도 코스, 5개 챕터, 출격 버튼),
 * 일일 미션 4종 모달, 7일 연속 출석부 모달, 설정(Base64 백업/복원, 튜토리얼 다시보기, 언어 스위치) 제어
 */

import { BALANCE } from '../config/balance.js';
import { BREEDS, COMPANIONS, COSTUMES } from '../data/catalog.js';
import { CHAPTERS, getChapter, getChapterNumberForUnit } from '../data/chapters.js';
import { SUPPORTED_LANGUAGES, applyI18nToDOM, detectDeviceLanguage, getLanguage, setLanguage, t } from '../data/i18n.js';
import { getWords, getTotalUnits } from '../data/data_en.js?v=2';
import {
  getSave,
  updateSave,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import {
  computePlayerStats,
  drawDogCharacter,
  drawDogSkin,
  getEvolutionStage,
} from '../entities/player.js';

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

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function createLobbyUI({
  onStartBattle,
  onStartTutorial,
  onRenderGear,
  onRenderTraining,
  onRenderShop,
  onRenderChallenge,
  onOpenSupplyShop,
} = {}) {
  const lobbyLayer = document.getElementById('lobby-layer');
  const modalLayer = document.getElementById('modal-layer');
  const modalCard = document.getElementById('modal-card');

  const evoBadge = document.getElementById('lobby-evo-badge');
  const playerTitle = document.getElementById('lobby-player-title');
  const evoStageName = document.getElementById('lobby-evo-stage-name');
  const resGold = document.getElementById('res-gold');
  const resSnacks = document.getElementById('res-snacks');
  const resGems = document.getElementById('res-gems');
  const btnOpenSettings = document.getElementById('btn-open-settings');

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
    const today = getTodayKey();
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

  function showLobby() {
    lobbyLayer.classList.remove('hidden');
    viewedChapter = getSave().selectedChapter || 1;
    refreshHeader();
    renderActiveTab();
  }

  function hideLobby() {
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

  function renderHeroPreview() {
    const canvas = document.getElementById('lobby-hero-canvas');
    if (!canvas) return;
    const save = getSave();
    const curBreedId = save.selectedBreed || 'pomeranian';
    const evo = getEvolutionStage(save);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 5);
    drawDogCharacter(ctx, {
      breedId: curBreedId,
      scale: 1.45,
      bodyY: 0,
      lookX: 0,
      isBipedal: evo.stage >= 2,
    });
    if (save.equippedSkin) {
      drawDogSkin(ctx, save.equippedSkin, 1.45, 0);
    }
    ctx.restore();
  }

  function refreshHeader() {
    const save = getSave();
    const evo = getEvolutionStage(save);
    evoBadge.textContent = evo.icon;
    playerTitle.textContent = save.dogName || t('app.playerDefaultName');
    const certLevel = save.certifiedLevel || 'A1';
    evoStageName.textContent = `${t(evo.key)} · ${certLevel}`;
    resGold.textContent = String(save.gold || 0);
    resSnacks.textContent = String(save.snacks || 0);
    if (resGems) resGems.textContent = String(save.gems ?? 300);
    const shopDot = document.getElementById('supply-shop-dot');
    if (shopDot) {
      const today = getTodayKey();
      const hasFreeSupply = save.lastFreeSupplyDate !== today;
      shopDot.classList.toggle('hidden', !hasFreeSupply);
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
    const today = getTodayKey();
    const canClaimAttendance = save.attendance.lastClaimDate !== today;
    const claimableMissions = DAILY_MISSION_DEFS.filter(
      (m) =>
        (save.dailyMissions.progress[m.key] || 0) >= m.target &&
        !save.dailyMissions.claimed.includes(m.id)
    ).length;

    const stats = computePlayerStats(save);
    const curUnitNum = parseInt((save.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const totalUnits = getTotalUnits();
    const curChapterNum = getChapterNumberForUnit(curUnitNum, totalUnits);
    const ch = getChapter(curChapterNum);

    const allWords = getWords();
    const curUnitId = `unit_${String(curUnitNum).padStart(3, '0')}`;
    const curUnitWords = allWords.filter((w) => w.unit === curUnitId);
    const sample = curUnitWords.slice(0, 3).map((w) => w.word).join(', ');
    const level = curUnitWords[0]?.level || 'A1';
    const categoryName = level === 'A1' ? '기초 필수' : level === 'A2' ? '초급 실용' : level === 'B1' ? '중급 핵심' : level === 'B2' ? '중고급 도약' : '고급 심화';

    const canGoPrev = curUnitNum > 1;
    const canGoNext = curUnitNum < totalUnits;
    const isLockedCurrent = curUnitNum > maxUnlocked;

    const curBreedId = save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
    const dogName = save.dogName || '우유';

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
      <!-- 오픈 스테이지 히어로 영역 (좌: 일일 미션 / 중: 우유 / 우: 7일 출석부) -->
      <div class="flex-1 flex flex-col justify-center gap-4">
        <div class="flex items-start justify-between gap-2">
          <!-- 왼쪽 가장자리: 일일 미션 + 보급 상점 -->
          <div class="flex flex-col gap-2 shrink-0 mt-2">
            <button id="btn-open-missions" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition">
              <span class="text-lg leading-none">📋</span>
              <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center">${t('lobby.dailyMissions')}</span>
              ${claimableMissions > 0 ? `<span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black shadow">${claimableMissions}</span>` : ''}
            </button>
            <button id="btn-open-supply-shop" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition">
              <span class="text-lg leading-none">🎁</span>
              <span class="text-[10px] font-bold text-amber-700 leading-tight text-center">${t('lobby.shopTitle')}</span>
              <span id="supply-shop-dot" class="${save.lastFreeSupplyDate !== today ? '' : 'hidden'} absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ${save.lastFreeSupplyDate !== today ? '<span class="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black shadow">무료</span>' : ''}
            </button>
          </div>

          <!-- 정중앙: 강아지 오픈 스테이지 프리뷰 & 견종명 배지 & 순수 이름표 & 핵심 스탯 -->
          <div class="flex-1 min-w-0 flex flex-col items-center text-center pt-1">
            <!-- 캐릭터 프리뷰 원형 및 좌우 견종 전환 화살표 -->
            <div class="flex items-center justify-center gap-2">
              <button id="btn-breed-prev" type="button" class="w-8 h-8 rounded-full bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[#1f2d24] hover:bg-[#efe9dc] font-black text-xs flex items-center justify-center active:scale-90 transition shrink-0" title="이전 견종">
                ◀
              </button>

              <div class="relative w-24 h-24 rounded-full bg-radial from-emerald-600/20 via-emerald-600/5 to-transparent flex items-center justify-center">
                <canvas id="lobby-hero-canvas" width="88" height="88" class="w-20 h-20 rounded-full bg-[#faf6ee] border border-emerald-600/40 shadow-[0_0_24px_rgba(45,106,79,0.2)] block"></canvas>
              </div>

              <button id="btn-breed-next" type="button" class="w-8 h-8 rounded-full bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[#1f2d24] hover:bg-[#efe9dc] font-black text-xs flex items-center justify-center active:scale-90 transition shrink-0" title="다음 견종">
                ▶
              </button>
            </div>

            <!-- 현재 선택된 견종명 배지 & 진화 단계 -->
            <div class="flex items-center justify-center gap-1.5 mt-2">
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">
                🐾 ${curBreed.name} · ${t(stats.evoStage.key)}
              </span>
            </div>

            <!-- 순수 강아지 이름표 (수정은 프로필 & 설정 모달에서 전담) -->
            <div class="text-base font-black text-[#1f2d24] mt-1 tracking-tight">
              ${heroName}
            </div>

            <!-- 핵심 4종 스탯 (전투력 · 공격력 · 체력 · 이동속도) -->
            <div class="flex items-center justify-center gap-2 mt-2 text-xs font-extrabold">
              <span class="text-amber-800">⚡ ${stats.combatPower}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-emerald-800">⚔️ ${stats.atk}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-rose-600">❤️ ${stats.maxHp}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-teal-800">👟 ${Math.round(stats.speed)}</span>
            </div>
          </div>

          <!-- 오른쪽 가장자리: 7일 출석부 -->
          <button id="btn-open-attendance" type="button" class="relative w-16 py-2 px-1 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col items-center justify-center gap-1 active:scale-95 transition shrink-0 mt-2">
            <span class="text-lg leading-none">📅</span>
            <span class="text-[10px] font-bold text-[#1f2d24] leading-tight text-center">${t('lobby.attendance7d')}</span>
            ${canClaimAttendance ? `<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>` : ''}
          </button>
        </div>
      </div>

      <!-- 로비 하단 2단 스테이지 선택기 & 좌우 화살표/스와이프 제어 -->
      <div id="lobby-stage-selector" class="flex items-center justify-between gap-2 px-2 py-1.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] shadow-xs select-none touch-pan-y cursor-grab active:cursor-grabbing">
        <button id="btn-stage-prev" type="button" ${canGoPrev ? '' : 'disabled'} class="w-10 h-10 rounded-xl bg-[#efe9dc] shadow-2xs border border-[#d2c8b4] text-[#1f2d24] font-black text-sm flex items-center justify-center disabled:opacity-25 active:scale-95 transition shrink-0" title="이전 스테이지">◀</button>

        <div class="flex-1 min-w-0 text-center select-none py-0.5">
          <!-- 위쪽 작은 글씨: 큰 카테고리/챕터 표기 -->
          <div class="text-[11px] font-bold text-[#4a584e] truncate flex items-center justify-center gap-1.5">
            <span class="font-black" style="color:${ch.theme.accentColor}">CH.${ch.number} ${ch.title}</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-emerald-800 font-extrabold">${categoryName}</span>
          </div>

          <!-- 가운데 큰 글씨: 현재 선택된 스테이지(유닛) 표기 및 대표 단어 미리보기 -->
          <div class="flex items-center justify-center gap-1.5 mt-0.5 min-w-0">
            <span class="text-sm font-black text-[#1f2d24] tracking-tight shrink-0">STAGE ${curUnitNum}</span>
            ${isLockedCurrent ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 border border-amber-600/30 text-[10px] font-black shrink-0">🔒 미해금</span>` : ''}
            ${sample ? `<span class="text-[11px] text-[#4a584e] truncate font-medium">(${sample})</span>` : ''}
          </div>
        </div>

        <button id="btn-stage-next" type="button" ${canGoNext ? '' : 'disabled'} class="w-10 h-10 rounded-xl bg-[#efe9dc] shadow-2xs border border-[#d2c8b4] text-[#1f2d24] font-black text-sm flex items-center justify-center disabled:opacity-25 active:scale-95 transition shrink-0" title="다음 스테이지">
          ▶
        </button>
      </div>
    `;

    renderHeroPreview();

    const moveStage = (delta) => {
      const cur = getSave();
      const curNum = parseInt((cur.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
      const tot = getTotalUnits();
      const nextNum = curNum + delta;

      if (nextNum < 1 || nextNum > tot) {
        return;
      }

      const nextUnitId = `unit_${String(nextNum).padStart(3, '0')}`;
      const nextCh = getChapterNumberForUnit(nextNum, tot);
      const allW = getWords();
      const uW = allW.filter((w) => w.unit === nextUnitId);
      const lvl = uW[0]?.level || 'A1';

      updateSave((s) => {
        s.selectedUnit = nextUnitId;
        s.selectedChapter = nextCh;
        if (lvl === 'A1') s.selectedCourse = 'lv1';
        else if (lvl === 'A2') s.selectedCourse = 'lv2';
        else if (lvl === 'B1' || lvl === 'B2') s.selectedCourse = 'lv3';
        else s.selectedCourse = 'lv4';
      });
      viewedChapter = nextCh;
      audioEngine.playCaptureTick();
      renderBattleTab();
    };

    const switchBreed = (delta) => {
      const cur = getSave();
      const id = cur.selectedBreed || 'pomeranian';
      const idx = Math.max(0, BREEDS.findIndex((b) => b.id === id));
      const nextIdx = (idx + delta + BREEDS.length) % BREEDS.length;
      updateSave((s) => {
        s.selectedBreed = BREEDS[nextIdx].id;
      });
      audioEngine.playCaptureTick();
      renderBattleTab();
    };

    document.getElementById('btn-breed-prev')?.addEventListener('click', () => switchBreed(-1));
    document.getElementById('btn-breed-next')?.addEventListener('click', () => switchBreed(1));
    document.getElementById('btn-stage-prev')?.addEventListener('click', () => moveStage(-1));
    document.getElementById('btn-stage-next')?.addEventListener('click', () => moveStage(1));

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
        if (e.target.closest('button')) return;
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

    document.getElementById('btn-open-missions')?.addEventListener('click', openDailyMissionsModal);
    document.getElementById('btn-open-supply-shop')?.addEventListener('click', () => onOpenSupplyShop?.());
    document.getElementById('btn-open-attendance')?.addEventListener('click', openAttendanceModal);
    updateBattleCtaButton();
  }

  function updateBattleCtaButton() {
    const btn = document.getElementById('btn-start-battle');
    if (!btn) return;
    const save = getSave();
    const curUnitNum = parseInt((save.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const isLockedCurrent = curUnitNum > maxUnlocked;
    const isTutorialNeeded = !save.tutorialCompleted && !save.tutorialDone;

    if (isLockedCurrent) {
      btn.innerHTML = `🎓 <span>월반 도전 (STAGE ${curUnitNum})</span>`;
      btn.className = 'w-[220px] mx-auto block py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700 text-white font-black text-sm shadow-[0_6px_20px_rgba(79,70,229,0.35)] active:scale-95 transition';
    } else if (isTutorialNeeded) {
      btn.innerHTML = `🎓 <span data-i18n="lobby.startTutorial">${t('lobby.startTutorial')}</span>`;
      btn.className = 'w-[190px] mx-auto block py-3 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white font-black text-sm shadow-[0_6px_20px_rgba(217,119,6,0.4)] active:scale-95 transition animate-pulse';
    } else {
      btn.innerHTML = `⚔️ <span data-i18n="lobby.startBattle">${t('lobby.startBattle')}</span>`;
      btn.className = 'w-[180px] mx-auto block py-3 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm shadow-[0_6px_20px_rgba(45,106,79,0.35)] active:scale-95 transition';
    }
  }

  function openEditDogNameModal(options = {}) {
    const onSaved = typeof options === 'function' ? options : options.onSaved;
    const onCancel = options.onCancel;
    const save = getSave();
    const currentName = save.dogName || '우유';

    openModal(`
      <div class="space-y-3.5 text-center">
        <div class="text-4xl">🐾</div>
        <div>
          <h3 class="text-base font-black text-emerald-800">강아지 이름 변경</h3>
          <p class="text-xs text-[#4a584e] mt-0.5">내 강아지의 새 이름을 입력해 주세요 (최대 8자)</p>
        </div>
        <div>
          <input
            id="input-dog-name"
            type="text"
            maxlength="8"
            value="${currentName}"
            placeholder="이름 입력 (1~8자)"
            class="w-full px-3 py-2.5 rounded-xl border border-emerald-600/40 bg-[#faf6ee] text-[#1f2d24] font-black text-center text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
          />
          <div id="dog-name-error" class="text-[11px] font-bold text-rose-600 mt-1.5 hidden">이름을 1~8글자로 입력해 주세요.</div>
        </div>
        <div class="flex gap-2 pt-1">
          <button id="btn-cancel-dog-name" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">
            취소
          </button>
          <button id="btn-save-dog-name" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">
            저장
          </button>
        </div>
      </div>
    `);

    const input = document.getElementById('input-dog-name');
    input?.focus();
    input?.select();

    const doSave = () => {
      const newName = input?.value?.trim() || '';
      if (!newName || newName.length > 8) {
        const err = document.getElementById('dog-name-error');
        if (err) err.classList.remove('hidden');
        return;
      }
      updateSave((s) => {
        s.dogName = newName;
      });
      audioEngine.playCaptureTick();
      closeModal();
      refreshHeader();
      renderBattleTab();
      if (onSaved) onSaved();
    };

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSave();
      }
    });

    document.getElementById('btn-cancel-dog-name')?.addEventListener('click', () => {
      closeModal();
      if (onCancel) onCancel();
    });
    document.getElementById('btn-save-dog-name')?.addEventListener('click', doSave);
  }

  document.getElementById('btn-start-battle')?.addEventListener('click', () => {
    console.log('[Lobby] Start Battle / Placement clicked');
    const cur = getSave();
    const curUnitNum = parseInt((cur.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = cur.maxUnlockedUnit || 1;

    // 미해금 상위 스테이지인 경우 -> 실제 인게임 월반 전투 모드로 즉시 출격
    if (curUnitNum > maxUnlocked) {
      onStartBattle?.({
        chapterNumber: cur.selectedChapter,
        courseId: cur.selectedCourse,
        unitId: cur.selectedUnit,
        isPlacement: true,
        targetUnitNum: curUnitNum,
      });
      return;
    }

    if (!cur.tutorialCompleted && !cur.tutorialDone) {
      onStartTutorial?.();
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
    });
  });

  function openDailyMissionsModal() {
    ensureDailyReset();
    const save = getSave();

    const rows = DAILY_MISSION_DEFS.map((m) => {
      const prog = Math.min(m.target, save.dailyMissions.progress[m.key] || 0);
      const claimed = save.dailyMissions.claimed.includes(m.id);
      const ready = prog >= m.target && !claimed;

      return `
        <div class="p-3 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-[#1f2d24]">${m.title}</div>
            <div class="text-[11px] text-[#4a584e] mt-0.5">${prog} / ${m.target} · +${m.gold}🪙 +${m.snacks}🦴</div>
          </div>
          <button type="button" data-mission-id="${m.id}" ${ready ? '' : 'disabled'} class="mission-claim-btn px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
            claimed
              ? 'bg-[#e6dec8] text-[#4a584e]'
              : ready
                ? 'bg-[#2d6a4f] text-[#f8f5ec] active:scale-95'
                : 'bg-[#e6dec8] text-[#4a584e] opacity-60'
          }">
            ${claimed ? t('lobby.claimed') : t('lobby.claimReward')}
          </button>
        </div>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-emerald-800">📋 ${t('lobby.dailyMissions')}</h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
        </div>
        <div class="space-y-2">${rows}</div>
      </div>
    `);

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    modalCard.querySelectorAll('.mission-claim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-mission-id');
        const def = DAILY_MISSION_DEFS.find((d) => d.id === id);
        if (!def) return;
        updateSave((s) => {
          if (!s.dailyMissions.claimed.includes(id)) {
            s.dailyMissions.claimed.push(id);
            s.gold += def.gold;
            s.snacks += def.snacks;
          }
        });
        refreshHeader();
        openDailyMissionsModal();
        renderBattleTab();
      });
    });
  }

  function openAttendanceModal() {
    const save = getSave();
    const today = getTodayKey();
    const claimedToday = save.attendance.lastClaimDate === today;
    const currentDay = save.attendance.streakDay || 0;
    const nextDay = (currentDay % 7) + 1;

    const grid = ATTENDANCE_REWARDS.map((item) => {
      const isDone = item.day <= currentDay && (claimedToday || currentDay < 7);
      const isNext = !claimedToday && item.day === nextDay;
      return `
        <div class="p-2.5 rounded-xl border text-center ${
          isNext
            ? 'bg-emerald-600/15 border-emerald-600 text-[#1f2d24] ring-2 ring-emerald-500/40'
            : isDone
              ? 'bg-[#faf6ee] border-[#d2c8b4] text-[#4a584e]'
              : 'bg-[#f0ebe0] border-[#d2c8b4] text-[#4a584e]'
        }">
          <div class="text-[11px] font-black">DAY ${item.day}</div>
          <div class="text-xs font-bold text-amber-700 mt-1">+${item.gold}🪙</div>
          <div class="text-[11px] text-rose-600">+${item.snacks}🦴</div>
          <div class="text-[10px] mt-1">${isDone ? '✅' : isNext ? '🎁' : '·'}</div>
        </div>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-amber-700">📅 ${t('lobby.attendance7d')}</h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
        </div>
        <div class="grid grid-cols-4 gap-2">${grid}</div>
        <button id="btn-claim-attendance" type="button" ${claimedToday ? 'disabled' : ''} class="w-full py-3 rounded-xl font-black text-sm ${
          claimedToday
            ? 'bg-[#e6dec8] text-[#4a584e]'
            : 'bg-[#2d6a4f] text-[#f8f5ec] active:scale-95 transition'
        }">
          ${claimedToday ? t('lobby.claimed') : `${t('lobby.claimReward')} (DAY ${nextDay})`}
        </button>
      </div>
    `);

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-claim-attendance')?.addEventListener('click', () => {
      if (getSave().attendance.lastClaimDate === today) return;
      const reward = ATTENDANCE_REWARDS.find((r) => r.day === nextDay) || ATTENDANCE_REWARDS[0];
      updateSave((s) => {
        s.attendance.lastClaimDate = today;
        s.attendance.streakDay = nextDay;
        s.gold += reward.gold;
        s.snacks += reward.snacks;
      });
      refreshHeader();
      openAttendanceModal();
      renderBattleTab();
    });
  }

  function openSettingsModal() {
    const save = getSave();
    const curLang = getLanguage();
    const curBreedId = save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
    const evo = getEvolutionStage(save);
    const certLevel = save.certifiedLevel || 'A1';
    const dogName = save.dogName || '우유';

    const hapticOn = save.haptic !== false;
    const lowFxOn = Boolean(save.lowFx);

    openModal(`
      <div class="space-y-3.5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-[#1f2d24]">⚙️ ${t('modal.settingsTitle')}</h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
        </div>

        <!-- 강아지 프로필 카드 -->
        <div class="p-3 rounded-2xl bg-gradient-to-r from-[#234735] to-[#1b3b2b] text-[#f8f5ec] shadow-sm flex items-center gap-3 border border-[#2d5a43]">
          <div class="w-16 h-16 rounded-xl bg-[#142c20]/60 border border-[#2d5a43] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            <canvas id="settings-dog-canvas" width="64" height="64" class="w-16 h-16"></canvas>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-sm font-black text-amber-200 truncate">${dogName}</span>
              <button id="btn-settings-edit-name" type="button" class="px-1.5 py-0.5 rounded-md bg-[#2d5a43] hover:bg-[#386d52] text-[10px] font-bold text-white active:scale-95 transition" title="이름 변경">
                ✏️ 수정
              </button>
            </div>
            <div class="text-[11px] font-medium text-emerald-200/80 mt-0.5">
              ${curBreed.name} · ${t(evo.key)}
            </div>
            <div class="mt-1 flex items-center gap-1.5">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[10px] font-black text-amber-300">
                🏅 공인 등급: ${certLevel}
              </span>
            </div>
          </div>
        </div>

        <!-- 1. 언어 선택 (1줄 컴팩트 드롭다운) -->
        <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between gap-2">
          <div class="text-xs font-bold text-[#1f2d24] flex items-center gap-1.5">
            <span>🌐</span>
            <span>${t('modal.languageLabel')}</span>
          </div>
          <select id="select-settings-lang" class="py-1 px-2.5 rounded-lg bg-[#faf6ee] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] focus:outline-none focus:ring-1 focus:ring-[#2d6a4f] cursor-pointer">
            ${SUPPORTED_LANGUAGES.map((l) => `<option value="${l.code}" ${curLang === l.code ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
        </div>

        <!-- 2. 사운드 조절 -->
        <div class="space-y-1.5">
          <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
            <span>🔊</span>
            <span>${t('modal.sfxLabel')} & ${t('modal.bgmLabel')}</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button id="btn-toggle-bgm" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 ${
              save.audio.bgmEnabled
                ? 'bg-[#f0ebe0] border-[#2d6a4f] text-[#1f2d24]'
                : 'bg-[#e6dec8] border-[#d2c8b4] text-[#7d8c80]'
            }">
              <span>${t('modal.bgmLabel')}</span>
              <span class="font-black ${save.audio.bgmEnabled ? 'text-[#2d6a4f]' : 'text-stone-500'}">${save.audio.bgmEnabled ? '🔊 ON' : '🔇 OFF'}</span>
            </button>
            <button id="btn-toggle-sfx" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 ${
              save.audio.sfxEnabled
                ? 'bg-[#f0ebe0] border-[#2d6a4f] text-[#1f2d24]'
                : 'bg-[#e6dec8] border-[#d2c8b4] text-[#7d8c80]'
            }">
              <span>${t('modal.sfxLabel')}</span>
              <span class="font-black ${save.audio.sfxEnabled ? 'text-[#2d6a4f]' : 'text-stone-500'}">${save.audio.sfxEnabled ? '🔊 ON' : '🔇 OFF'}</span>
            </button>
          </div>
        </div>

        <!-- 3. 진동 & 저사양 모드 -->
        <div class="space-y-1.5">
          <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
            <span>📳</span>
            <span>디바이스 & 그래픽</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button id="btn-toggle-haptic" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 ${
              hapticOn
                ? 'bg-[#f0ebe0] border-[#2d6a4f] text-[#1f2d24]'
                : 'bg-[#e6dec8] border-[#d2c8b4] text-[#7d8c80]'
            }">
              <span>${t('modal.hapticLabel')}</span>
              <span class="font-black ${hapticOn ? 'text-[#2d6a4f]' : 'text-stone-500'}">${hapticOn ? '📳 ON' : 'OFF'}</span>
            </button>
            <button id="btn-toggle-lowfx" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 ${
              lowFxOn
                ? 'bg-amber-100 border-amber-600/50 text-amber-900'
                : 'bg-[#f0ebe0] border-[#d2c8b4] text-[#1f2d24]'
            }">
              <span>${t('modal.lowFxLabel')}</span>
              <span class="font-black ${lowFxOn ? 'text-amber-700' : 'text-stone-500'}">${lowFxOn ? '⚡ ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <!-- 4. 계정 연동 & 피드백 -->
        <div class="space-y-2 pt-2 border-t border-[#d2c8b4]">
          <div class="p-2.5 rounded-xl bg-[#ece5d8] border border-[#d2c8b4] flex items-center justify-between text-xs font-bold text-[#4a584e]">
            <span class="flex items-center gap-1.5">☁️ ${t('modal.accountLabel')}</span>
            <span class="px-2 py-0.5 rounded-full bg-[#ded4c1] text-[#606d62] text-[10px] font-extrabold">${t('modal.accountComingSoon')}</span>
          </div>

          <button id="btn-feedback" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-xs">
            <span>${t('modal.sendFeedback')}</span>
          </button>
        </div>
      </div>
    `);

    const drawSettingsDog = () => {
      const canvas = document.getElementById('settings-dog-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 + 5);
      drawDogCharacter(ctx, {
        breedId: curBreedId,
        scale: 1.15,
        bodyY: 0,
        lookX: 0,
        isBipedal: false,
      });
      if (save.equippedSkin) {
        drawDogSkin(ctx, save.equippedSkin, 1.15, 0);
      }
      ctx.restore();
    };

    drawSettingsDog();

    document.getElementById('btn-settings-edit-name')?.addEventListener('click', () => {
      openEditDogNameModal({
        onSaved: () => openSettingsModal(),
        onCancel: () => openSettingsModal(),
      });
    });

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

    document.getElementById('select-settings-lang')?.addEventListener('change', (e) => {
      const lang = e.target.value;
      if (lang && lang !== getLanguage()) {
        audioEngine.playCorrect?.();
        setLanguage(lang);
        updateSave((s) => {
          s.language = lang;
          s.lang = lang;
          s.langConfirmed = true;
        });
        applyI18nToDOM();
        refreshHeader();
        renderActiveTab();
        openSettingsModal();
      }
    });

    document.getElementById('btn-toggle-bgm')?.addEventListener('click', () => {
      updateSave((s) => {
        s.audio.bgmEnabled = !s.audio.bgmEnabled;
      });
      audioEngine.refreshSettings();
      openSettingsModal();
    });

    document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
      updateSave((s) => {
        s.audio.sfxEnabled = !s.audio.sfxEnabled;
      });
      audioEngine.refreshSettings();
      openSettingsModal();
    });

    document.getElementById('btn-toggle-haptic')?.addEventListener('click', () => {
      updateSave((s) => {
        s.haptic = s.haptic === false ? true : false;
      });
      audioEngine.triggerHaptic?.(25);
      openSettingsModal();
    });

    document.getElementById('btn-toggle-lowfx')?.addEventListener('click', () => {
      updateSave((s) => {
        s.lowFx = !s.lowFx;
      });
      openSettingsModal();
    });

    document.getElementById('btn-feedback')?.addEventListener('click', () => {
      const email = 'support@zombievoca.com';
      const subject = encodeURIComponent(`[Zombie Voca Feedback] ${save.dogName} (Lv.${save.certifiedLevel})`);
      window.open(`mailto:${email}?subject=${subject}`, '_blank');
    });
  }

  function openInitialLanguageModal(onConfirm) {
    const save = getSave();
    let selectedLang = save.language || save.lang || detectDeviceLanguage();
    if (!['ko', 'en', 'es'].includes(selectedLang)) {
      selectedLang = 'en';
    }

    const LANG_OPTIONS = [
      {
        code: 'ko',
        flag: '🇰🇷',
        nativeName: '한국어',
        subName: 'Korean',
        desc: '모든 미션과 인터페이스를 한국어로 진행합니다.',
      },
      {
        code: 'en',
        flag: '🇺🇸',
        nativeName: 'English',
        subName: '영어',
        desc: 'Play missions and interface in English.',
      },
      {
        code: 'es',
        flag: '🇪🇸',
        nativeName: 'Español',
        subName: '스페인어',
        desc: 'Juega todas las misiones y la interfaz en español.',
      },
    ];

    const CONFIRM_TEXTS = {
      ko: '시작하기 ➜',
      en: 'Start Game ➜',
      es: 'Comenzar ➜',
    };

    function renderContent() {
      const detected = detectDeviceLanguage();
      const cardsHtml = LANG_OPTIONS.map((opt) => {
        const isSelected = opt.code === selectedLang;
        const isDetected = opt.code === detected;
        return `
          <button type="button" data-lang-code="${opt.code}" class="initial-lang-btn w-full p-3.5 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between group ${
            isSelected
              ? 'bg-[#2d6a4f] text-[#f8f5ec] border-[#52b788] shadow-md ring-2 ring-[#52b788]/60'
              : 'bg-[#f0ebe0] text-[#1f2d24] border-[#d2c8b4] hover:bg-[#e6dfd1]'
          }">
            <div class="flex items-center gap-3">
              <span class="text-3xl">${opt.flag}</span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-base font-black ${isSelected ? 'text-white' : 'text-[#1f2d24]'}">${opt.nativeName}</span>
                  <span class="text-xs font-semibold ${isSelected ? 'text-emerald-200' : 'text-[#5f6c62]'}">(${opt.subName})</span>
                  ${
                    isDetected
                      ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-black ${
                          isSelected ? 'bg-amber-400 text-stone-900' : 'bg-emerald-700 text-white'
                        }">★ Device</span>`
                      : ''
                  }
                </div>
                <div class="text-xs mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-[#5f6c62]'}">${opt.desc}</div>
              </div>
            </div>
            <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${
              isSelected ? 'bg-white text-[#2d6a4f]' : 'border-2 border-[#b8ae9c] text-transparent'
            }">
              ✓
            </div>
          </button>
        `;
      }).join('');

      openModal(`
        <div class="space-y-4 py-1">
          <div class="text-center space-y-1">
            <div class="text-3xl animate-bounce">🌐</div>
            <h2 class="text-xl font-black text-[#1f2d24] tracking-tight">언어 선택 · Language</h2>
            <p class="text-xs text-[#5f6c62]">원하시는 언어를 선택해 주세요.<br><span class="text-[11px] text-[#7d8c80]">(게임 내 프로필/설정에서 언제든 변경할 수 있습니다)</span></p>
          </div>

          <div class="space-y-2.5">
            ${cardsHtml}
          </div>

          <div class="pt-2">
            <button id="btn-confirm-initial-lang" type="button" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] text-white font-black text-base shadow-lg shadow-[#2d6a4f]/30 active:scale-[0.98] transition hover:brightness-110 flex items-center justify-center gap-2">
              <span>${CONFIRM_TEXTS[selectedLang] || CONFIRM_TEXTS.en}</span>
            </button>
          </div>
        </div>
      `);

      // 언어 카드 선택 이벤트 바인딩
      modalCard.querySelectorAll('.initial-lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const code = btn.getAttribute('data-lang-code');
          if (code && code !== selectedLang) {
            audioEngine.playCaptureTick?.();
            selectedLang = code;
            renderContent();
          }
        });
      });

      // 시작하기 버튼 바인딩
      document.getElementById('btn-confirm-initial-lang')?.addEventListener('click', () => {
        audioEngine.playCorrect?.();
        setLanguage(selectedLang);
        updateSave((s) => {
          s.language = selectedLang;
          s.lang = selectedLang;
          s.langConfirmed = true;
          if (!s.dogName || s.dogName === '우유' || s.dogName === 'Milk' || s.dogName === 'Leche') {
            s.dogName = selectedLang === 'es' ? 'Leche' : selectedLang === 'en' ? 'Milk' : '우유';
          }
        });
        applyI18nToDOM();
        refreshHeader();
        renderActiveTab();
        closeModal();
        if (typeof onConfirm === 'function') {
          onConfirm(selectedLang);
        }
      });
    }

    renderContent();
  }

  // 탭 버튼 이벤트 바인딩
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-lobby-tab');
      switchTab(tabKey);
    });
  });

  // 상단 헤더 프로필 & 재화 바로가기 바인딩
  document.getElementById('btn-header-profile')?.addEventListener('click', openSettingsModal);
  document.getElementById('btn-header-gold')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-snacks')?.addEventListener('click', () => switchTab('training'));
  document.getElementById('btn-header-gems')?.addEventListener('click', () => switchTab('shop'));
  btnOpenSettings?.addEventListener('click', openSettingsModal);

  return {
    showLobby,
    hideLobby,
    refreshHeader,
    switchTab,
    renderActiveTab,
    openModal,
    closeModal,
    openInitialLanguageModal,
  };
}

