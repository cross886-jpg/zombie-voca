/**
 * js/ui/lobbyUI.js
 * 메인 로비 전투 탭(4개 난이도 코스, 5개 챕터, 출격 버튼),
 * 일일 미션 4종 모달, 7일 연속 출석부 모달, 설정(Base64 백업/복원, 튜토리얼 다시보기, 언어 스위치) 제어
 */

import { BALANCE } from '../config/balance.js';
import { COMPANIONS, COSTUMES } from '../data/catalog.js';
import { CHAPTERS } from '../data/chapters.js';
import { SUPPORTED_LANGUAGES, applyI18nToDOM, getLanguage, setLanguage, t } from '../data/i18n.js';
import {
  exportSaveBase64,
  getSave,
  importSaveBase64,
  updateSave,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats, getEvolutionStage } from '../entities/player.js';

const DAILY_MISSION_DEFS = [
  { id: 'm_battle', key: 'battles', title: '전투 1회 출격', target: 1, gold: 100, snacks: 1 },
  { id: 'm_words', key: 'wordsCorrect', title: '영단어 20문제 정답', target: 20, gold: 150, snacks: 1 },
  { id: 'm_kills', key: 'kills', title: '좀비 50마리 처치', target: 50, gold: 140, snacks: 1 },
  { id: 'm_review', key: 'miniReview', title: '기억 수첩 미니 복습 1회', target: 1, gold: 120, snacks: 2 },
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
  onRenderWordbook,
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
  const btnOpenSettings = document.getElementById('btn-open-settings');

  const battlePanel = document.getElementById('tab-panel-battle');
  const tabPanels = {
    gear: document.getElementById('tab-panel-gear'),
    battle: battlePanel,
    training: document.getElementById('tab-panel-training'),
    wordbook: document.getElementById('tab-panel-wordbook'),
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

  function refreshHeader() {
    const save = getSave();
    const evo = getEvolutionStage(save.evoXp || 0);
    evoBadge.textContent = evo.icon;
    playerTitle.textContent = t('app.playerDefaultName');
    evoStageName.textContent = t(evo.key);
    resGold.textContent = String(save.gold || 0);
    resSnacks.textContent = String(save.snacks || 0);
    const shopDot = document.getElementById('supply-shop-dot');
    if (shopDot) {
      shopDot.classList.toggle('hidden', (save.gold || 0) < BALANCE.SHOP.NORMAL_BOX_GOLD);
    }
  }

  const battleCtaBar = document.getElementById('battle-cta-bar');
  let toastTimer = null;

  function showToast(msg) {
    let el = document.getElementById('lobby-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lobby-toast';
      el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#faf6ee] shadow-md border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] pointer-events-none whitespace-nowrap transition-opacity';
      lobbyLayer.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hidden', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('opacity-0'), 1500);
  }

  function switchTab(tabKey) {
    if (tabKey === 'challenge') {
      showToast('🔒 추후 오픈 예정인 도전 모드입니다!');
      return;
    }
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
      if (btnTab === 'challenge') return;
      const isCenter = btnTab === 'battle';
      const isActive = btnTab === tabKey;

      btn.classList.toggle('active', isActive);
      if (isCenter) {
        btn.classList.toggle('border-emerald-400/60', isActive);
        btn.classList.toggle('from-[#2d6a4f]', isActive);
        btn.classList.toggle('to-[#1b4332]', isActive);
        btn.classList.toggle('text-[#f8f5ec]', isActive);
        btn.classList.toggle('shadow-[0_6px_18px_rgba(45,106,79,0.45)]', isActive);
        btn.classList.toggle('border-[#2d5a43]', !isActive);
        btn.classList.toggle('bg-[#234735]', !isActive);
        btn.classList.toggle('text-[#a3b899]', !isActive);
      } else {
        btn.classList.toggle('text-[#f8f5ec]', isActive);
        btn.classList.toggle('bg-[#234735]', isActive);
        btn.classList.toggle('text-[#a3b899]', !isActive);
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
    } else if (activeTab === 'wordbook') {
      onRenderWordbook?.();
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
    const equippedIds = Object.values(save.costumes?.equipped || {}).filter(Boolean);
    const equippedItems = equippedIds
      .map((id) => COSTUMES.find((c) => c.id === id))
      .filter(Boolean);
    const unlockedCompSet = new Set(save.companions?.unlocked || []);
    const activeCompanions = (save.companions?.active || [])
      .filter((id) => unlockedCompSet.has(id))
      .map((id) => COMPANIONS.find((c) => c.id === id))
      .filter(Boolean);

    const companionSlotBadges = Array.from({ length: BALANCE.COMPANIONS.MAX_ACTIVE }, (_, idx) => {
      const comp = activeCompanions[idx];
      return comp
        ? `<span title="${comp.name}" class="w-6 h-6 rounded-lg bg-[#f0ebe0] border border-emerald-600/40 flex items-center justify-center text-xs">${comp.icon}</span>`
        : `<span title="빈 동료 슬롯" class="w-6 h-6 rounded-lg bg-[#efe9dc] border border-dashed border-[#d2c8b4] flex items-center justify-center text-[10px] font-bold text-[#4a584e]">?</span>`;
    });

    const visualBadgesHtml = [
      ...equippedItems.map((item) => `<span title="${item.name}" class="w-6 h-6 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-center text-xs">${item.icon}</span>`),
      ...companionSlotBadges,
    ].join('');

    const currentCourse = BALANCE.COURSES.find((c) => c.id === save.selectedCourse) || BALANCE.COURSES[0];

    const currentChNum = viewedChapter ?? (save.selectedChapter || 1);
    const chIndex = Math.max(0, CHAPTERS.findIndex((c) => c.number === currentChNum));
    const ch = CHAPTERS[chIndex] || CHAPTERS[0];
    const chUnlocked = ch.number <= (save.unlockedChapter || 1);
    const hasPrevCh = chIndex > 0;
    const hasNextCh = chIndex < CHAPTERS.length - 1;

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
              <span id="supply-shop-dot" class="${(save.gold || 0) >= BALANCE.SHOP.NORMAL_BOX_GOLD ? '' : 'hidden'} absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            </button>
          </div>

          <!-- 정중앙: 우유 오픈 스테이지 프리뷰 & 핵심 스탯 -->
          <div class="flex-1 min-w-0 flex flex-col items-center text-center pt-1">
            <div class="relative w-24 h-24 rounded-full bg-radial from-emerald-600/20 via-emerald-600/5 to-transparent flex items-center justify-center">
              <div class="w-20 h-20 rounded-full bg-[#faf6ee] border border-emerald-600/40 shadow-[0_0_24px_rgba(45,106,79,0.2)] flex items-center justify-center text-5xl">${stats.evoStage.icon}</div>
            </div>
            <div class="flex items-center justify-center gap-1.5 mt-1.5">
              <span class="text-sm font-black text-[#1f2d24]">🐶 우유</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-600/35 text-[10px] font-black text-amber-800">전투력 ${stats.combatPower}</span>
            </div>
            <div class="text-[11px] font-bold text-emerald-800 truncate max-w-full mt-0.5">${t(stats.evoStage.key)}</div>
            <div class="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[10px] font-bold text-[#1f2d24]">📚 ${t(currentCourse.labelKey)}</div>
            ${visualBadgesHtml ? `<div class="flex flex-wrap justify-center gap-1 mt-1.5">${visualBadgesHtml}</div>` : ''}

            <div class="flex items-center justify-center gap-3 mt-3 text-xs font-extrabold">
              <span class="text-emerald-800">⚔️ ${stats.atk}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-rose-600">❤️ ${stats.maxHp}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-amber-800">👟 ${Math.round(stats.speed)}</span>
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

      <!-- 심플 챕터 선택 (테두리 없는 미니멀 바) -->
      <div class="flex items-center justify-between gap-2 px-1 pt-2 ${chUnlocked ? '' : 'opacity-65'}">
        <button id="btn-chapter-prev" type="button" ${hasPrevCh ? '' : 'disabled'} class="w-9 h-9 rounded-full bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[#1f2d24] font-black text-sm flex items-center justify-center disabled:opacity-25 active:scale-95 transition shrink-0">◀</button>
        <div class="flex-1 min-w-0 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <span class="text-[11px] font-black" style="color:${ch.theme.accentColor}">CH.${ch.number}</span>
            <span class="font-extrabold text-sm text-[#1f2d24] truncate">${ch.title}</span>
          </div>
          <div class="text-[10px] text-[#4a584e] truncate mt-0.5">
            ${chUnlocked ? `${ch.subtitle} · +${ch.goldReward} 🪙` : `🔒 ${t('lobby.chapterLocked')}`}
          </div>
        </div>
        <button id="btn-chapter-next" type="button" ${hasNextCh ? '' : 'disabled'} class="w-9 h-9 rounded-full bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[#1f2d24] font-black text-sm flex items-center justify-center disabled:opacity-25 active:scale-95 transition shrink-0">▶</button>
      </div>
    `;

    const moveChapter = (delta) => {
      const nextIdx = Math.max(0, Math.min(CHAPTERS.length - 1, chIndex + delta));
      const targetCh = CHAPTERS[nextIdx];
      viewedChapter = targetCh.number;
      if (targetCh.number <= (save.unlockedChapter || 1)) {
        updateSave((s) => {
          s.selectedChapter = targetCh.number;
        });
      }
      renderBattleTab();
    };

    document.getElementById('btn-chapter-prev')?.addEventListener('click', () => moveChapter(-1));
    document.getElementById('btn-chapter-next')?.addEventListener('click', () => moveChapter(1));

    document.getElementById('btn-open-missions')?.addEventListener('click', openDailyMissionsModal);
    document.getElementById('btn-open-supply-shop')?.addEventListener('click', () => onOpenSupplyShop?.());
    document.getElementById('btn-open-attendance')?.addEventListener('click', openAttendanceModal);
  }

  document.getElementById('btn-start-battle')?.addEventListener('click', () => {
    console.log('[Lobby] Start Battle clicked');
    const cur = getSave();
    onStartBattle?.({
      chapterNumber: cur.selectedChapter,
      courseId: cur.selectedCourse,
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

    const langBtns = SUPPORTED_LANGUAGES.map(
      (l) => `
      <button type="button" data-lang="${l.code}" class="lang-btn px-3 py-1.5 rounded-lg text-xs font-bold border ${
        curLang === l.code
          ? 'bg-[#2d6a4f] border-[#2d6a4f] text-[#f8f5ec]'
          : 'bg-[#f0ebe0] border-[#d2c8b4] text-[#4a584e]'
      }">${l.label}</button>
    `
    ).join('');

    openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-[#1f2d24]">⚙️ ${t('modal.settingsTitle')}</h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-bold text-[#4a584e]">${t('modal.languageLabel')}</div>
          <div class="flex gap-2">${langBtns}</div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button id="btn-toggle-bgm" type="button" class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-between">
            <span>${t('modal.bgmLabel')}</span>
            <span>${save.audio.bgmEnabled ? '🔊 ON' : '🔇 OFF'}</span>
          </button>
          <button id="btn-toggle-sfx" type="button" class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-between">
            <span>${t('modal.sfxLabel')}</span>
            <span>${save.audio.sfxEnabled ? '🔊 ON' : '🔇 OFF'}</span>
          </button>
        </div>

        <div class="space-y-2 pt-1 border-t border-[#d2c8b4]">
          <button id="btn-export-save" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs">
            📋 ${t('modal.exportSave')}
          </button>
          <textarea id="input-import-save" rows="2" placeholder="${t('modal.importPlaceholder')}" class="w-full p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-xs text-[#1f2d24] font-mono"></textarea>
          <button id="btn-import-save" type="button" class="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-600/40 text-amber-800 font-bold text-xs">
            📥 ${t('modal.importSave')}
          </button>
          <div id="settings-feedback" class="text-center text-[11px] font-bold text-emerald-700 min-h-[16px]"></div>
        </div>

        <button id="btn-replay-tutorial" type="button" class="w-full py-2.5 rounded-xl bg-[#efe9dc] hover:bg-[#e6dec8] border border-[#d2c8b4] text-[#1f2d24] font-bold text-xs">
          🐾 튜토리얼 다시보기
        </button>
      </div>
    `);

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

    modalCard.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        setLanguage(lang);
        updateSave((s) => {
          s.language = lang;
        });
        applyI18nToDOM();
        refreshHeader();
        renderActiveTab();
        openSettingsModal();
      });
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

    document.getElementById('btn-export-save')?.addEventListener('click', async () => {
      const code = exportSaveBase64();
      const input = document.getElementById('input-import-save');
      const fb = document.getElementById('settings-feedback');
      if (input) input.value = code;
      try {
        await navigator.clipboard.writeText(code);
        if (fb) fb.textContent = t('modal.backupSuccess');
      } catch {
        if (fb) fb.textContent = t('modal.backupSuccess');
      }
    });

    document.getElementById('btn-import-save')?.addEventListener('click', () => {
      const input = document.getElementById('input-import-save');
      const fb = document.getElementById('settings-feedback');
      const res = importSaveBase64(input?.value || '');
      if (res.ok) {
        const restored = getSave();
        setLanguage(restored.language || 'ko');
        applyI18nToDOM();
        refreshHeader();
        renderActiveTab();
        if (fb) {
          fb.className = 'text-center text-[11px] font-bold text-emerald-400 min-h-[16px]';
          fb.textContent = t('modal.restoreSuccess');
        }
      } else if (fb) {
        fb.className = 'text-center text-[11px] font-bold text-rose-400 min-h-[16px]';
        fb.textContent = t('modal.restoreError');
      }
    });

    document.getElementById('btn-replay-tutorial')?.addEventListener('click', () => {
      closeModal();
      onStartTutorial?.();
    });
  }

  // 탭 버튼 이벤트 바인딩
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-lobby-tab');
      switchTab(tabKey);
    });
  });

  btnOpenSettings?.addEventListener('click', openSettingsModal);

  return {
    showLobby,
    hideLobby,
    refreshHeader,
    switchTab,
    renderActiveTab,
    openModal,
    closeModal,
  };
}

