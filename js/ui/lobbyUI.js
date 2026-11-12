/**
 * js/ui/lobbyUI.js
 * 메인 로비 전투 탭(4개 난이도 코스, 5개 챕터, 출격 버튼),
 * 일일 미션 4종 모달, 7일 연속 출석부 모달, 설정(Base64 백업/복원, 튜토리얼 다시보기, 언어 스위치) 제어
 */

import { BALANCE } from '../config/balance.js';
import { CHAPTERS } from '../data/chapters.js';
import { SUPPORTED_LANGUAGES, applyI18nToDOM, getLanguage, setLanguage, t } from '../data/i18n.js';
import {
  exportSaveBase64,
  getSave,
  importSaveBase64,
  updateSave,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { getEvolutionStage } from '../entities/player.js';

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

  function showLobby() {
    lobbyLayer.classList.remove('hidden');
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
  }

  function switchTab(tabKey) {
    if (!tabPanels[tabKey]) return;
    activeTab = tabKey;

    Object.entries(tabPanels).forEach(([key, panel]) => {
      if (key === tabKey) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    tabButtons.forEach((btn) => {
      const btnTab = btn.getAttribute('data-lobby-tab');
      if (btnTab === tabKey) {
        btn.classList.add('active', 'text-cyan-300', 'bg-cyan-500/15');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('active', 'text-cyan-300', 'bg-cyan-500/15');
        btn.classList.add('text-slate-400');
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

    const courseCards = BALANCE.COURSES.map((course) => {
      const selected = save.selectedCourse === course.id;
      return `
        <button type="button" data-course-id="${course.id}" class="course-select-btn p-2.5 rounded-xl border text-left transition active:scale-98 ${
          selected
            ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
        }">
          <div class="text-xs font-extrabold">${t(course.labelKey)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">보상 x${course.rewardMult} · 적 x${course.enemyMult}</div>
        </button>
      `;
    }).join('');

    const chapterCards = CHAPTERS.map((ch) => {
      const unlocked = ch.number <= (save.unlockedChapter || 1);
      const selected = save.selectedChapter === ch.number;
      return `
        <button type="button" data-chapter-num="${ch.number}" ${unlocked ? '' : 'disabled'} class="chapter-select-btn w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition ${
          !unlocked
            ? 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60 cursor-not-allowed'
            : selected
              ? 'bg-slate-800/90 border-amber-400 text-white shadow-[0_0_14px_rgba(251,191,36,0.2)]'
              : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
        }">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-black px-2 py-0.5 rounded bg-slate-950 border border-slate-700" style="color:${ch.theme.accentColor}">CH.${ch.number}</span>
              <span class="font-extrabold text-sm truncate">${ch.title}</span>
            </div>
            <div class="text-[11px] text-slate-400 mt-1 truncate">
              ${unlocked ? ch.subtitle : `🔒 ${t('lobby.chapterLocked')}`}
            </div>
          </div>
          <div class="text-right shrink-0 text-[11px] font-bold text-amber-300">
            ${unlocked ? `+${ch.goldReward} 🪙` : '🔒'}
          </div>
        </button>
      `;
    }).join('');

    battlePanel.classList.add('pb-28');
    battlePanel.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <button id="btn-open-missions" type="button" class="relative py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-center gap-1.5 active:scale-95 transition">
          📋 ${t('lobby.dailyMissions')}
          ${claimableMissions > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">${claimableMissions}</span>` : ''}
        </button>
        <button id="btn-open-attendance" type="button" class="relative py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-100 flex items-center justify-center gap-1.5 active:scale-95 transition">
          📅 ${t('lobby.attendance7d')}
          ${canClaimAttendance ? `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>` : ''}
        </button>
      </div>

      <button id="btn-start-battle" type="button" class="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-slate-950 font-black text-base shadow-[0_0_24px_rgba(34,211,238,0.45)] active:scale-98 transition">
        ⚔️ ${t('lobby.startBattle')}
      </button>

      <div class="space-y-2">
        <div class="text-xs font-extrabold text-cyan-300">${t('lobby.selectCourse')}</div>
        <div class="grid grid-cols-2 gap-2">${courseCards}</div>
      </div>

      <div class="space-y-2">
        <div class="text-xs font-extrabold text-amber-300">${t('lobby.selectChapter')}</div>
        <div class="space-y-2">${chapterCards}</div>
      </div>
    `;

    battlePanel.querySelectorAll('.course-select-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-course-id');
        updateSave((s) => {
          s.selectedCourse = id;
        });
        renderBattleTab();
      });
    });

    battlePanel.querySelectorAll('.chapter-select-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chNum = Number(btn.getAttribute('data-chapter-num'));
        updateSave((s) => {
          s.selectedChapter = chNum;
        });
        renderBattleTab();
      });
    });

    document.getElementById('btn-open-missions')?.addEventListener('click', openDailyMissionsModal);
    document.getElementById('btn-open-attendance')?.addEventListener('click', openAttendanceModal);
  }

  // 출격 버튼은 탭 재렌더링과 무관하게 이벤트 위임으로 항상 동작 보장
  battlePanel.addEventListener('click', (e) => {
    const startBtn = e.target.closest('#btn-start-battle');
    if (!startBtn) return;
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
        <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-white">${m.title}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">${prog} / ${m.target} · +${m.gold}🪙 +${m.snacks}🦴</div>
          </div>
          <button type="button" data-mission-id="${m.id}" ${ready ? '' : 'disabled'} class="mission-claim-btn px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
            claimed
              ? 'bg-slate-800 text-slate-500'
              : ready
                ? 'bg-emerald-500 text-slate-950 active:scale-95'
                : 'bg-slate-800 text-slate-400 opacity-60'
          }">
            ${claimed ? t('lobby.claimed') : t('lobby.claimReward')}
          </button>
        </div>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-cyan-300">📋 ${t('lobby.dailyMissions')}</h2>
          <button id="btn-close-modal" type="button" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
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
            ? 'bg-emerald-500/15 border-emerald-400 text-white'
            : isDone
              ? 'bg-slate-900/50 border-slate-800 text-slate-500'
              : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }">
          <div class="text-[11px] font-black">DAY ${item.day}</div>
          <div class="text-xs font-bold text-amber-300 mt-1">+${item.gold}🪙</div>
          <div class="text-[11px] text-rose-300">+${item.snacks}🦴</div>
          <div class="text-[10px] mt-1">${isDone ? '✅' : isNext ? '🎁' : '·'}</div>
        </div>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-amber-300">📅 ${t('lobby.attendance7d')}</h2>
          <button id="btn-close-modal" type="button" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
        </div>
        <div class="grid grid-cols-4 gap-2">${grid}</div>
        <button id="btn-claim-attendance" type="button" ${claimedToday ? 'disabled' : ''} class="w-full py-3 rounded-xl font-black text-sm ${
          claimedToday
            ? 'bg-slate-800 text-slate-500'
            : 'bg-emerald-500 text-slate-950 active:scale-95 transition'
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
          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
          : 'bg-slate-800 border-slate-700 text-slate-300'
      }">${l.label}</button>
    `
    ).join('');

    openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-black text-white">⚙️ ${t('modal.settingsTitle')}</h2>
          <button id="btn-close-modal" type="button" class="text-slate-400 hover:text-white text-lg font-bold">✕</button>
        </div>

        <div class="space-y-1.5">
          <div class="text-xs font-bold text-slate-400">${t('modal.languageLabel')}</div>
          <div class="flex gap-2">${langBtns}</div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button id="btn-toggle-bgm" type="button" class="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-between">
            <span>${t('modal.bgmLabel')}</span>
            <span>${save.audio.bgmEnabled ? '🔊 ON' : '🔇 OFF'}</span>
          </button>
          <button id="btn-toggle-sfx" type="button" class="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-between">
            <span>${t('modal.sfxLabel')}</span>
            <span>${save.audio.sfxEnabled ? '🔊 ON' : '🔇 OFF'}</span>
          </button>
        </div>

        <div class="space-y-2 pt-1 border-t border-slate-800">
          <button id="btn-export-save" type="button" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-bold text-xs">
            📋 ${t('modal.exportSave')}
          </button>
          <textarea id="input-import-save" rows="2" placeholder="${t('modal.importPlaceholder')}" class="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono"></textarea>
          <button id="btn-import-save" type="button" class="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-xs">
            📥 ${t('modal.importSave')}
          </button>
          <div id="settings-feedback" class="text-center text-[11px] font-bold text-emerald-400 min-h-[16px]"></div>
        </div>

        <button id="btn-replay-tutorial" type="button" class="w-full py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-200 font-bold text-xs">
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

