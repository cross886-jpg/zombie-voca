/**
 * js/ui/lobbyModals.js
 * 로비 전용 팝업 모달 제어 모듈
 * - 강아지 이름 변경 모달 (openEditDogNameModal)
 * - 퀘스트 모달 (openQuestsModal)
 * - 일일 공중 투하 보급품 모달 (openAirDropSupplyModal)
 * - CEFR 등급 심사 모달 (openCefrModal)
 * - 30일 출석부 모달 (openAttendance30Modal)
 * - 공지사항 모달 (openNoticeModal)
 * - 프로필 모달 (openProfileModal)
 * - 게임 설정 모달 (openSettingsModal)
 * - 특공대 학습 코스 설정 + 10문제 배치 테스트 모달 (openCourseSetupModal)
 */

import { BREEDS, COSTUMES, ATTENDANCE_30_REWARDS, QUEST_DEFS } from '../data/catalog.js';
import { SUPPORTED_LANGUAGES, applyI18nToDOM, getLanguage, setLanguage, t } from '../data/i18n.js';
import { getWords } from '../data/data_en.js?v=2';
import {
  getSave,
  updateSave,
  exportSaveBase64,
  importSaveBase64,
  claimAttendance30,
  claimDailyAirDrop,
  claimQuestReward,
  ensureQuestsState,
  getTodayDateKey,
  STUDY_LANGS,
  STUDY_CEFRS,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import {
  CEFR_META,
  COURSE_TIER_LABELS,
  LANG_META,
  PLACEMENT_PASS_COUNT,
  PLACEMENT_QUESTION_COUNT,
  TIER_GAUGE,
  bandToCourse,
  buildPlacementTest,
  confirmCourseSelection,
  getBandIndex,
  switchStudyLang,
} from '../core/courseEngine.js';
import {
  computePlayerStats,
  getEvolutionStage,
} from '../entities/player.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';

export function openEditDogNameModal(ctx, options = {}) {
  const { openModal, closeModal, refreshHeader, renderBattleTab } = ctx;
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

export function openQuestsModal(ctx, activeSubtab = 'daily') {
  const { openModal, closeModal, modalCard, refreshHeader, renderBattleTab } = ctx;
  ensureQuestsState();
  const save = getSave();

  const tabs = [
    { key: 'daily', label: t('lobby.dailyQuests') || '일일 퀘스트', icon: '☀️' },
    { key: 'weekly', label: t('lobby.weeklyQuests') || '주간 퀘스트', icon: '📆' },
    { key: 'achievements', label: t('lobby.achievements') || '영구 업적', icon: '🏆' },
  ];

  const tabButtons = tabs.map((tb) => {
    const isActive = tb.key === activeSubtab;
    const countReady = (QUEST_DEFS[tb.key] || []).filter(
      (q) => (save.quests?.[tb.key]?.progress?.[q.key] || 0) >= q.target && !save.quests?.[tb.key]?.claimed?.includes(q.id)
    ).length;

    return `
      <button type="button" data-subtab="${tb.key}" class="quest-subtab-btn flex-1 py-2 rounded-xl text-xs font-black transition relative active:scale-95 ${
        isActive
          ? 'bg-[#2d6a4f] text-[#f8f5ec] shadow-sm'
          : 'bg-[#e6dec8] text-[#1f2d24] hover:bg-[#dcd3bd]'
      }">
        <span>${tb.icon} ${tb.label}</span>
        ${countReady > 0 ? `<span class="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">${countReady}</span>` : ''}
      </button>
    `;
  }).join('');

  const questState = save.quests?.[activeSubtab];
  const questOrder = (q) => {
    const done = (questState?.progress?.[q.key] || 0) >= q.target;
    const claimed = Boolean(questState?.claimed?.includes(q.id));
    if (claimed) return 2;
    return done ? 0 : 1;
  };
  const questList = [...(QUEST_DEFS[activeSubtab] || [])].sort((a, b) => questOrder(a) - questOrder(b));
  const questRows = questList.map((q) => {
    const currentProg = save.quests?.[activeSubtab]?.progress?.[q.key] || 0;
    const target = q.target;
    const progDisplay = Math.min(target, currentProg);
    const isClaimed = save.quests?.[activeSubtab]?.claimed?.includes(q.id);
    const isReady = currentProg >= target && !isClaimed;
    const ratio = Math.min(100, Math.round((progDisplay / target) * 100));

    const rewardPills = [];
    if (q.gold) rewardPills.push(`<span class="text-amber-700 font-bold">+${q.gold}🪙</span>`);
    if (q.gems) rewardPills.push(`<span class="text-cyan-700 font-bold">+${q.gems}💎</span>`);
    if (q.snacks) rewardPills.push(`<span class="text-amber-800 font-bold">+${q.snacks}🦴</span>`);
    if (q.box) rewardPills.push(`<span class="text-purple-700 font-black">📦 보급상자</span>`);

    return `
      <div class="p-3 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between gap-2.5">
        <div class="text-2xl select-none shrink-0">${q.icon || '📜'}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-extrabold text-[#1f2d24] truncate">${q.title}</span>
            <span class="text-[10px] font-bold text-[#5c6e60]">${progDisplay} / ${target}</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-[#d2c8b4] overflow-hidden my-1">
            <div class="h-full rounded-full ${isReady ? 'bg-emerald-600' : 'bg-amber-600'}" style="width: ${ratio}%"></div>
          </div>
          <div class="text-[10px] text-[#4a584e] flex items-center gap-1.5 flex-wrap">
            ${rewardPills.join(' · ')}
          </div>
        </div>
        <button type="button" data-quest-tab="${activeSubtab}" data-quest-id="${q.id}" ${isReady ? '' : 'disabled'} class="quest-claim-btn px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition active:scale-95 shadow-xs ${
          isClaimed
            ? 'bg-[#e6dec8] text-[#7a8c7e] cursor-default'
            : isReady
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white animate-pulse'
              : 'bg-[#e6dec8] text-[#7a8c7e] opacity-60 cursor-default'
        }">
          ${isClaimed ? t('lobby.claimed') : isReady ? t('lobby.claimReward') : '진행중'}
        </button>
      </div>
    `;
  }).join('');

  openModal(`
    <div class="flex flex-col h-[75dvh] max-h-[580px] space-y-3">
      <!-- 상단 고정: 제목 & 닫기 버튼 (shrink-0) -->
      <div class="flex items-center justify-between shrink-0">
        <h2 class="text-base font-black text-emerald-800 flex items-center gap-1.5">
          <span>${t('lobby.quests')}</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>
      <!-- 상단 고정: 서브탭 바 (shrink-0) -->
      <div class="flex gap-1.5 shrink-0">${tabButtons}</div>
      <!-- 하단 단독 스크롤: 퀘스트 리스트 -->
      <div class="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">${questRows}</div>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

  modalCard.querySelectorAll('.quest-subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openQuestsModal(ctx, btn.dataset.subtab);
    });
  });

  modalCard.querySelectorAll('.quest-claim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.questTab;
      const id = btn.dataset.questId;
      const res = claimQuestReward(tab, id);
      if (res.ok) {
        audioEngine.playPowerUp?.();
        refreshHeader();
        openQuestsModal(ctx, tab);
        renderBattleTab();
      }
    });
  });
}

export function openAirDropSupplyModal(ctx) {
  const { openModal, closeModal, refreshHeader, renderBattleTab } = ctx;
  const save = getSave();
  const today = getTodayDateKey();
  const dogName = save.dogName || '우유';

  const renderModalContent = (claimedResult = null) => {
    const curSave = getSave();
    if (claimedResult) {
      const rewardPills = [];
      if (claimedResult.gold) rewardPills.push(`<div class="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-center"><div class="text-xl">🪙</div><div class="text-xs font-black text-amber-800">+${claimedResult.gold.toLocaleString()} 금화</div></div>`);
      if (claimedResult.snacks) rewardPills.push(`<div class="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-center"><div class="text-xl">🦴</div><div class="text-xs font-black text-amber-900">+${claimedResult.snacks} 뼈다귀</div></div>`);
      if (claimedResult.gems) rewardPills.push(`<div class="p-2.5 rounded-xl bg-cyan-50 border border-cyan-300 text-center"><div class="text-xl">💎</div><div class="text-xs font-black text-cyan-800">+${claimedResult.gems} 보석</div></div>`);

      openModal(`
        <div class="space-y-4 text-center py-1">
          <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
            <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
              <span>🪂</span>
              <span>하늘 보급품 투하 완료!</span>
            </h2>
            <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
          </div>

          <div class="py-2">
            <div class="text-5xl animate-bounce">🎁✨</div>
            <div class="text-sm font-black text-emerald-800 mt-2">구조 비행기 보급품 개봉!</div>
            <p class="text-xs text-[#5c6e60] mt-1">${dogName}를 위한 전술 보급품이 안전하게 도착했습니다.</p>
          </div>

          <div class="grid grid-cols-${rewardPills.length} gap-2 px-2">
            ${rewardPills.join('')}
          </div>

          <div class="pt-2">
            <button id="btn-airdrop-confirm" type="button" class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer">
              확인
            </button>
          </div>
        </div>
      `);

      document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
      document.getElementById('btn-airdrop-confirm')?.addEventListener('click', closeModal);
      return;
    }

    const isAvailable = curSave.dailyAirDropDate !== today;

    openModal(`
      <div class="space-y-4 text-center py-1">
        <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
          <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
            <span>🪂</span>
            <span>하늘에서 떨어진 보급품</span>
          </h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
        </div>

        <div class="p-3.5 rounded-2xl bg-gradient-to-b from-[#e8f5e9] to-[#faf6ee] border border-emerald-600/30 text-center">
          <div class="text-xs text-[#4a584e] font-semibold leading-relaxed">
            ✈️ <em>"매일 전장 상공을 지나는 구조 비행기가<br/><strong class="text-emerald-800">${dogName}</strong>를 위해 낙하산 보급품을 투하합니다!"</em>
          </div>

          <div class="my-4 flex flex-col items-center justify-center">
            ${isAvailable ? `
              <div class="text-5xl animate-bounce select-none">🪂</div>
              <div class="text-3xl -mt-2 animate-pulse select-none">📦</div>
              <div class="mt-2 text-xs font-black text-amber-800">상공에서 낙하 중인 보급 상자!</div>
            ` : `
              <div class="text-5xl select-none opacity-80">📦✨</div>
              <div class="mt-2 text-xs font-black text-emerald-800">오늘의 보급품 수령 완료</div>
              <div class="text-[11px] text-[#5c6e60] mt-0.5">내일 새로운 구조 비행기가 다시 찾아옵니다.</div>
            `}
          </div>

          <div class="text-[11px] text-[#5c6e60] bg-[#faf6ee] rounded-xl p-2 border border-[#d2c8b4]">
            💡 <strong>일일 보급 혜택</strong>: 금화, 간식(뼈다귀), 보석 중 1~2종 매일 무료 지급
          </div>
        </div>

        <div class="pt-1">
          ${isAvailable ? `
            <button id="btn-claim-airdrop" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer animate-pulse">
              <span>🪂</span>
              <span>보급품 투하 받기</span>
            </button>
          ` : `
            <button id="btn-airdrop-done" type="button" class="w-full py-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#7d8c80] font-bold text-xs cursor-pointer active:scale-95 transition">
              오늘의 하늘 보급품 수령 완료 (내일 다시 투하됩니다)
            </button>
          `}
        </div>
      </div>
    `);

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-airdrop-done')?.addEventListener('click', closeModal);

    document.getElementById('btn-claim-airdrop')?.addEventListener('click', () => {
      const gold = Math.floor(Math.random() * 300) + 200;
      const rand = Math.random();
      let snacks = 0;
      let gems = 0;
      if (rand < 0.45) {
        snacks = Math.floor(Math.random() * 3) + 2;
      } else if (rand < 0.8) {
        gems = Math.floor(Math.random() * 20) + 10;
      } else {
        snacks = 2;
        gems = 10;
      }

      const res = claimDailyAirDrop({ gold, snacks, gems });
      if (res.ok) {
        audioEngine.playPowerUp?.();
        refreshHeader();
        renderBattleTab();
        renderModalContent(res);
      }
    });
  };

  renderModalContent();
}

export function openCefrModal(ctx) {
  const { openModal, closeModal, onStartBattle } = ctx;
  const save = getSave();
  const curLevel = save.certifiedLevel || 'A1';
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const CEFR_NAMES = {
    A1: '입문 (Beginner)',
    A2: '초급 (Elementary)',
    B1: '중급 (Intermediate)',
    B2: '중고급 (Upper-Int.)',
    C1: '고급 (Advanced)',
    C2: '최고급 (Mastery)',
  };

  const allWords = getWords();
  const statsObj = save.wordStats || {};

  const levelStats = CEFR_LEVELS.map((lvl) => {
    const wordsAtLvl = allWords.filter((w) => w.level === lvl);
    const total = wordsAtLvl.length;
    let mastered = 0;
    wordsAtLvl.forEach((w) => {
      const st = statsObj[w.id];
      if (st && ((st.correct || 0) >= 3 || st.mastered)) {
        mastered++;
      }
    });
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { level: lvl, name: CEFR_NAMES[lvl] || lvl, total, mastered, pct };
  });

  const curIdx = CEFR_LEVELS.indexOf(curLevel);
  const nextLevel = curIdx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[curIdx + 1] : null;

  const cardsHtml = levelStats.map((item, idx) => {
    const isAcquired = idx <= curIdx;
    const isNext = idx === curIdx + 1;
    let statusBadge = '';
    if (isAcquired) {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">취득 완료 🏅</span>';
    } else if (isNext) {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">승급 대상 ⚔️</span>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-[#e6dec8] text-[#7d8c80] text-[10px] font-bold">잠김 🔒</span>';
    }

    return `
      <div class="p-2.5 rounded-xl ${isNext ? 'bg-[#faf6ee] border-2 border-amber-500/50 shadow-sm' : isAcquired ? 'bg-[#f0ebe0] border border-[#d2c8b4]' : 'bg-[#e6dec8]/50 border border-[#d2c8b4]/60 opacity-60'} flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-8 h-8 rounded-lg ${isAcquired ? 'bg-emerald-600 text-white' : isNext ? 'bg-amber-500 text-white' : 'bg-[#d2c8b4] text-[#4a584e]'} flex items-center justify-center text-xs font-black shrink-0">${item.level}</span>
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-[#1f2d24] truncate">${item.name}</div>
            <div class="text-[10px] font-bold text-[#5c6e60]">${item.mastered}/${item.total} 단어 마스터 (${item.pct}%)</div>
          </div>
        </div>
        <div class="shrink-0">${statusBadge}</div>
      </div>
    `;
  }).join('');

  openModal(`
    <div class="space-y-3.5">
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🎓</span>
          <span>CEFR 공인 등급 심사</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>

      <div class="p-3 rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl font-black text-white shadow-md">${curLevel}</div>
          <div>
            <div class="text-xs font-black text-[#1f2d24]">현재 공인 등급: <span class="text-amber-700">${curLevel}</span></div>
            <div class="text-[10px] text-[#4a584e] mt-0.5">${CEFR_NAMES[curLevel] || ''}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-bold text-[#4a584e]">보스 승급 시험</div>
          <div class="text-xs font-black text-emerald-700">${nextLevel ? `${nextLevel} 승급 도전` : '최고 등급 달성'}</div>
        </div>
      </div>

      <div class="space-y-1.5 max-h-[42dvh] overflow-y-auto pr-0.5">
        ${cardsHtml}
      </div>

      <div class="pt-1">
        ${nextLevel ? `
          <button id="btn-challenge-promotion" type="button" class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>⚔️</span>
            <span>${nextLevel} 승급 심사 보스전 도전</span>
          </button>
        ` : `
          <button id="btn-close-cefr" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer">
            확인
          </button>
        `}
      </div>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-cefr')?.addEventListener('click', closeModal);
  document.getElementById('btn-challenge-promotion')?.addEventListener('click', () => {
    closeModal();
    onStartBattle?.({ isPromotion: true, targetLevel: nextLevel });
  });
}

export function openAttendance30Modal(ctx) {
  const { openModal, closeModal, refreshHeader, renderBattleTab } = ctx;
  const save = getSave();
  const today = getTodayDateKey();
  const claimedToday = (save.attendance30?.lastClaimDate || save.attendance?.lastClaimDate) === today;
  const claimedDays = new Set(save.attendance30?.claimedDays || []);
  const nextDay = Math.min(30, claimedDays.size + 1);

  const cellsHtml = ATTENDANCE_30_REWARDS.map((r) => {
    const isClaimed = claimedDays.has(r.day);
    const isTodayReady = !claimedToday && r.day === nextDay;
    const isMilestone = r.milestone || [7, 14, 21, 30].includes(r.day);
    const isFuture = !isClaimed && !isTodayReady;

    let borderClass = 'border-[#d2c8b4] bg-[#f0ebe0] text-[#7a8c7e]';
    let iconHtml = r.icon || '🎁';
    let labelHtml = r.label;
    let badgeHtml = '';

    if (isClaimed) {
      borderClass = 'border-[#d2c8b4] bg-[#faf6ee] text-[#7a8c7e] opacity-75';
      labelHtml = '✅ 수령';
      if (isMilestone) {
        badgeHtml = '<span class="absolute -top-1 -right-1 text-[7px] px-1 rounded bg-amber-600/70 text-white font-bold">특식</span>';
      }
    } else if (isTodayReady) {
      borderClass = 'border-amber-500 bg-amber-50 text-[#1f2d24] ring-2 ring-amber-400 shadow-md animate-pulse';
      if (isMilestone) {
        badgeHtml = '<span class="absolute -top-1 -right-1 text-[7px] px-1 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black shadow-xs">특식</span>';
      }
    } else if (isFuture) {
      if (isMilestone) {
        // 핵심 마일스톤 (7일, 14일, 21일, 30일차): 특수 황금 상자 (✨? + 금빛 테두리/광택 효과 + 황금상자 뱃지)
        borderClass = 'border-amber-400/80 bg-gradient-to-b from-amber-100/80 to-amber-200/50 text-amber-900 shadow-sm ring-1 ring-amber-300/70';
        iconHtml = '<span class="inline-block animate-pulse drop-shadow-sm">✨?</span>';
        labelHtml = '<span class="text-amber-800 font-extrabold">대박 보급</span>';
        badgeHtml = '<span class="absolute -top-1 -right-1 text-[7px] px-1 rounded bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-black shadow-xs">황금상자</span>';
      } else {
        // 일반 미래 출석일: 잠긴 선물 상자(🎁 ?)와 미스터리 텍스트로 보상을 가려 기대감 유발
        borderClass = 'border-[#d2c8b4]/70 bg-[#ece6d8]/60 text-[#8c9c8e] opacity-70';
        iconHtml = '<span class="opacity-80">🎁 ?</span>';
        labelHtml = '<span class="text-[#8c9c8e] font-semibold">미스터리</span>';
      }
    }

    return `
      <div class="aspect-square rounded-xl border ${borderClass} p-1 flex flex-col justify-between items-center text-center relative select-none">
        <span class="text-[9px] font-black leading-none ${isMilestone ? 'text-amber-700' : 'text-[#5c6e60]'}">
          D-${r.day}
        </span>
        <div class="text-xl leading-none my-0.5">${iconHtml}</div>
        <div class="text-[8px] font-bold leading-tight truncate w-full px-0.5">
          ${labelHtml}
        </div>
        ${badgeHtml}
      </div>
    `;
  }).join('');

  openModal(`
    <div class="space-y-3 max-h-[85dvh] flex flex-col">
      <div class="flex items-center justify-between shrink-0">
        <div>
          <h2 class="text-base font-black text-amber-800 flex items-center gap-1.5">
            <span>📅</span>
            <span>${t('lobby.attendance30d')}</span>
          </h2>
          <p class="text-[10px] text-[#5c6e60] mt-0.5">출석 시 7·14·21·30일 특별 코스튬 & 신화 무기 증정!</p>
        </div>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
      </div>

      <div class="grid grid-cols-5 gap-1.5 overflow-y-auto max-h-[52dvh] p-1.5 bg-[#e6dec8]/40 rounded-2xl border border-[#d2c8b4]">
        ${cellsHtml}
      </div>

      <button id="btn-claim-attendance-30" type="button" ${claimedToday ? 'disabled' : ''} class="w-full py-3 rounded-xl font-black text-xs shadow-md transition active:scale-95 shrink-0 ${
        claimedToday
          ? 'bg-[#e6dec8] text-[#7a8c7e] cursor-default'
          : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white animate-pulse'
      }">
        ${claimedToday ? '✅ 오늘 출석 완료 (내일 다시 만나요)' : `✨ 오늘의 출석 보상 받기 (Day ${nextDay})`}
      </button>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-claim-attendance-30')?.addEventListener('click', () => {
    const res = claimAttendance30();
    if (res.ok) {
      audioEngine.playPowerUp?.();
      refreshHeader();
      openAttendance30Modal(ctx);
      renderBattleTab();
    }
  });
}

export function openNoticeModal(ctx) {
  const { openModal, closeModal } = ctx;

  openModal(`
    <div class="space-y-3.5">
      <div class="flex items-center justify-between pb-2 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>📢</span>
          <span>공지사항 (Notice)</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
      </div>

      <div class="p-3.5 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black">v1.04 안내</span>
          <span class="text-xs font-black text-[#1f2d24]">영단어 특공대: 멍멍 수호대 공식 런칭!</span>
        </div>
        <p class="text-[11px] text-[#4a584e] leading-relaxed">
          주인을 찾아 떠나는 700여 개의 대장정! 영단어를 학습하며 좀비 아포칼립스 전장을 돌파하는 모바일 서바이벌 RPG입니다.
        </p>
      </div>

      <div class="space-y-2 text-xs text-[#1f2d24]">
        <div class="font-extrabold text-[#2d6a4f] flex items-center gap-1">
          <span>🚀</span>
          <span>최신 업데이트 주요 내용</span>
        </div>
        <div class="space-y-1.5 text-[11px] text-[#4a584e]">
          <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1">
            <div class="font-bold text-[#1f2d24]">🛡️ 지하 벙커 해치 & 엄폐물 시스템</div>
            <p>단어 비석이 강철 벙커 해치와 정면 진입 발판으로 리뉴얼되었습니다. 벙커는 좀비의 공격을 차단하는 든든한 엄폐물이 됩니다.</p>
          </div>
          <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1">
            <div class="font-bold text-[#1f2d24]">🐾 동물 친구 18종 대규모 확장</div>
            <p>웰시코기, 시바이누 등 10종의 견종과 아기 고양이, 부엉이 등 8종의 서포트 동물 친구들이 함께합니다.</p>
          </div>
          <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1">
            <div class="font-bold text-[#1f2d24]">⚔️ 50종 전술 무기 & 보급 상자</div>
            <p>부메랑, 전술 권총, 저격총부터 신화 골든 본까지 다양한 무기와 3종 보급 상자 뽑기를 즐겨보세요.</p>
          </div>
        </div>
      </div>

      <button id="btn-close-notice" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-xs active:scale-95 transition cursor-pointer">
        확인
      </button>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-notice')?.addEventListener('click', closeModal);
}

export function openProfileModal(ctx) {
  const { openModal, closeModal, getProfileProgress } = ctx;
  const save = getSave();
  const curBreedId = save.selectedBreed || 'pomeranian';
  const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
  const evo = getEvolutionStage(save);
  const certLevel = save.certifiedLevel || 'A1';
  const dogName = save.dogName || '우유';

  const stats = computePlayerStats(save);
  const { pct: progressPct, mastered: levelMasteredCount, total: levelTotalCount } = getProfileProgress(save);
  const totalTrainLv = Object.values(save.training || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const masteredCount = Object.values(save.wordStats || {}).filter((st) => st?.mastered || (st?.correct || 0) >= 3).length;
  const learnedCount = Object.keys(save.wordStats || {}).length;
  const ownedCostumesCount = (save.costumes?.owned || []).length;
  const totalCostumesCount = COSTUMES.length;
  const collectionPct = Math.round((ownedCostumesCount / Math.max(1, totalCostumesCount)) * 100);

  openModal(`
    <div class="space-y-3.5">
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🐶</span>
          <span>모험가 프로필</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
      </div>

      <!-- 강아지 영웅 카드 -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-[#234735] to-[#1b3b2b] text-[#f8f5ec] shadow-md flex items-center gap-3.5 border border-[#2d5a43]">
        <div class="w-16 h-16 rounded-2xl bg-[#142c20]/70 border border-[#2d5a43] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
          <canvas id="profile-dog-canvas" width="64" height="64" class="w-16 h-16"></canvas>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-base font-black text-amber-200 truncate">${dogName}</span>
            <button id="btn-profile-edit-name" type="button" class="px-2 py-0.5 rounded-md bg-[#2d5a43] hover:bg-[#386d52] text-[10px] font-bold text-white active:scale-95 transition cursor-pointer" title="이름 변경">
              ✏️ 수정
            </button>
          </div>
          <div class="text-xs font-semibold text-emerald-200/90 mt-0.5">
            ${curBreed.name} · ${t(evo.key)}
          </div>
          <div class="mt-1.5 flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-[10px] font-black text-amber-300 shadow-xs">
              🏅 공인 등급: ${certLevel}
            </span>
            <div class="flex items-center gap-1.5">
              <div class="w-16 h-1.5 rounded-full bg-[#142c20] border border-[#2d5a43] overflow-hidden" title="등급 마스터 진행도: ${levelMasteredCount}/${levelTotalCount} (${progressPct}%)">
                <div class="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
              </div>
              <span class="text-[10px] font-black text-emerald-300 tabular-nums">${progressPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 핵심 성장 스탯 4열 그리드 -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-0.5">
          <div class="text-[10px] font-bold text-[#4a584e] flex items-center gap-1">
            <span>⚡</span>
            <span>종합 전투력</span>
          </div>
          <div class="text-sm font-black text-amber-700">${stats.combatPower.toLocaleString()}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-0.5">
          <div class="text-[10px] font-bold text-[#4a584e] flex items-center gap-1">
            <span>🏋️</span>
            <span>총 훈련 레벨</span>
          </div>
          <div class="text-sm font-black text-emerald-700">Lv.${totalTrainLv}</div>
        </div>
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-0.5">
          <div class="text-[10px] font-bold text-[#4a584e] flex items-center gap-1">
            <span>📖</span>
            <span>마스터 단어</span>
          </div>
          <div class="text-sm font-black text-cyan-700">${masteredCount}개 <span class="text-[10px] font-normal text-[#5f6c62]">(${learnedCount}개)</span></div>
        </div>
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-0.5">
          <div class="text-[10px] font-bold text-[#4a584e] flex items-center gap-1">
            <span>🎒</span>
            <span>도감 수집률</span>
          </div>
          <div class="text-sm font-black text-purple-700">${ownedCostumesCount} / ${totalCostumesCount} <span class="text-[10px] font-normal text-[#5f6c62]">(${collectionPct}%)</span></div>
        </div>
      </div>

      <!-- 하단 최고 돌파 스테이지 안내 -->
      <div class="p-2.5 rounded-xl bg-[#efe9dc] border border-[#d2c8b4] flex items-center justify-between text-xs font-bold text-[#4a584e]">
        <span>🏆 최고 돌파 스테이지</span>
        <span class="text-[#1f2d24] font-black">STAGE ${save.maxUnlockedUnit || 1}</span>
      </div>

      <button id="btn-close-profile" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer">
        확인
      </button>
    </div>
  `);

  renderDogToCanvas('profile-dog-canvas', {
    save,
    breedId: curBreedId,
    scale: 1.15,
    offsetY: 5,
    isBipedal: false,
  });

  document.getElementById('btn-profile-edit-name')?.addEventListener('click', () => {
    openEditDogNameModal(ctx, {
      onSaved: () => openProfileModal(ctx),
      onCancel: () => openProfileModal(ctx),
    });
  });

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-profile')?.addEventListener('click', closeModal);
}

export function openSettingsModal(ctx) {
  const { openModal, closeModal, refreshHeader, renderActiveTab } = ctx;
  const save = getSave();
  const curLang = getLanguage();
  const hapticOn = save.haptic !== false;
  const lowFxOn = Boolean(save.lowFx);

  openModal(`
    <div class="space-y-3.5">
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>⚙️</span>
          <span>${t('modal.settingsTitle')}</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold">✕</button>
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
        <p class="text-[10px] text-[#5f6c62] px-0.5">※ 저사양 모드: 배터리 절약 및 부드러운 프레임 유지</p>
      </div>

      <!-- 4. 데이터 백업 / 복원 / 초기화 -->
      <div class="space-y-1.5 pt-2 border-t border-[#d2c8b4]">
        <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
          <span>💾</span>
          <span>데이터 관리</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-backup-save" type="button" class="py-2.5 px-2 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dfd1] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
            <span>📋</span>
            <span>세이브 백업</span>
          </button>
          <button id="btn-restore-save" type="button" class="py-2.5 px-2 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dfd1] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
            <span>📥</span>
            <span>데이터 복원</span>
          </button>
        </div>
        <button id="btn-reset-save" type="button" class="w-full py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-[11px] font-bold text-rose-700 flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
          <span>🗑️ 데이터 초기화</span>
        </button>
      </div>

      <!-- 5. 피드백 -->
      <div class="pt-1">
        <button id="btn-feedback" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-xs cursor-pointer">
          <span>${t('modal.sendFeedback')}</span>
        </button>
      </div>
    </div>
  `);

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
      openSettingsModal(ctx);
    }
  });

  document.getElementById('btn-toggle-bgm')?.addEventListener('click', () => {
    updateSave((s) => {
      s.audio.bgmEnabled = !s.audio.bgmEnabled;
    });
    audioEngine.refreshSettings();
    openSettingsModal(ctx);
  });

  document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
    updateSave((s) => {
      s.audio.sfxEnabled = !s.audio.sfxEnabled;
    });
    audioEngine.refreshSettings();
    openSettingsModal(ctx);
  });

  document.getElementById('btn-toggle-haptic')?.addEventListener('click', () => {
    updateSave((s) => {
      s.haptic = s.haptic === false ? true : false;
    });
    audioEngine.triggerHaptic?.(25);
    openSettingsModal(ctx);
  });

  document.getElementById('btn-toggle-lowfx')?.addEventListener('click', () => {
    updateSave((s) => {
      s.lowFx = !s.lowFx;
    });
    openSettingsModal(ctx);
  });

  document.getElementById('btn-backup-save')?.addEventListener('click', async () => {
    try {
      const code = exportSaveBase64();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        alert(t('modal.backupSuccess') || '세이브 코드가 클립보드에 복사되었습니다.');
      } else {
        prompt('아래 세이브 코드를 복사하세요:', code);
      }
    } catch (err) {
      prompt('아래 세이브 코드를 복사하세요:', exportSaveBase64());
    }
  });

  document.getElementById('btn-restore-save')?.addEventListener('click', () => {
    const input = prompt('복원할 세이브 코드를 붙여넣으세요:');
    if (!input) return;
    const res = importSaveBase64(input.trim());
    if (res.ok) {
      alert(t('modal.restoreSuccess') || '데이터가 성공적으로 복원되었습니다!');
      applyI18nToDOM();
      refreshHeader();
      renderActiveTab();
      closeModal();
    } else {
      alert(t('modal.restoreError') || '올바르지 않은 세이브 코드입니다.');
    }
  });

  document.getElementById('btn-reset-save')?.addEventListener('click', () => {
    const confirmed = confirm('정말 모든 데이터를 초기화하고 처음부터 다시 시작하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
    if (confirmed) {
      localStorage.removeItem('zombie_voca_save_v1');
      window.location.reload();
    }
  });

  document.getElementById('btn-feedback')?.addEventListener('click', () => {
    const email = 'support@zombievoca.com';
    const subject = encodeURIComponent(`[영단어 특공대 피드백] ${save.dogName} (Lv.${save.certifiedLevel})`);
    window.open(`mailto:${email}?subject=${subject}`, '_blank');
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openCourseSetupModal(ctx) {
  const { openModal, closeModal, refreshHeader, renderActiveTab } = ctx;
  const initial = getSave();
  const state = {
    lang: initial.studyLang,
    cefr: initial.courseProgress[initial.studyLang].cefr,
  };
  let test = null;

  function finish() {
    closeModal();
    refreshHeader();
    renderActiveTab();
  }

  function renderSetup() {
    const save = getSave();
    const canClose = save.courseOnboardingDone;

    const langCards = STUDY_LANGS.map((lang) => {
      const p = save.courseProgress[lang];
      const active = lang === state.lang;
      return `
        <button type="button" data-course-lang="${lang}" class="flex-1 py-2.5 px-2 rounded-xl border-2 ${active ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-[#faf6ee] border-[#d2c8b4]'} flex flex-col items-center gap-0.5 active:scale-95 transition cursor-pointer">
          <span class="text-xl leading-none">${LANG_META[lang].flag}</span>
          <span class="text-xs font-black text-[#1f2d24]">${LANG_META[lang].name}</span>
          <span class="text-[10px] font-bold text-amber-700">${p.cefr} ${TIER_GAUGE[p.tier]}</span>
        </button>`;
    }).join('');

    const cefrButtons = STUDY_CEFRS.map((cefr) => {
      const active = cefr === state.cefr;
      return `
        <button type="button" data-course-cefr="${cefr}" class="py-2 rounded-xl border-2 ${active ? 'bg-amber-500 border-amber-600 text-white' : 'bg-[#faf6ee] border-[#d2c8b4] text-[#1f2d24]'} text-[11px] font-black active:scale-95 transition cursor-pointer">
          ${cefr} · ${CEFR_META[cefr]}
        </button>`;
    }).join('');

    const tierButtons = COURSE_TIER_LABELS[state.cefr].map((label, i) => {
      const tier = i + 1;
      const noTest = state.cefr === 'A1' && tier === 1;
      return `
        <button type="button" data-course-tier="${tier}" class="w-full py-2.5 px-3 rounded-xl border border-[#d2c8b4] bg-[#faf6ee] hover:bg-emerald-50 flex items-center justify-between gap-2 active:scale-95 transition cursor-pointer">
          <span class="text-xs font-black text-[#1f2d24]">${TIER_GAUGE[tier]} ${label}</span>
          <span class="text-[10px] font-bold ${noTest ? 'text-emerald-700' : 'text-[#5c6e60]'}">${noTest ? '테스트 없이 1유닛부터' : `${PLACEMENT_QUESTION_COUNT}문제 배치 테스트`}</span>
        </button>`;
    }).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
          <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5"><span>🎯</span><span>특공대 학습 코스 설정</span></h2>
          ${canClose ? '<button id="btn-course-close" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>' : ''}
        </div>
        <div>
          <div class="text-[11px] font-black text-[#4a584e] mb-1">1. 학습 언어 선택</div>
          <div class="flex gap-2">${langCards}</div>
        </div>
        <div>
          <div class="text-[11px] font-black text-[#4a584e] mb-1">2. 목표 등급 선택</div>
          <div class="grid grid-cols-2 gap-1.5">${cefrButtons}</div>
        </div>
        <div>
          <div class="text-[11px] font-black text-[#4a584e] mb-1">3. 시작 코스 선택</div>
          <div class="space-y-1.5">${tierButtons}</div>
        </div>
      </div>
    `);

    document.getElementById('btn-course-close')?.addEventListener('click', closeModal);
    document.querySelectorAll('[data-course-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.lang = btn.getAttribute('data-course-lang');
        switchStudyLang(state.lang);
        state.cefr = getSave().courseProgress[state.lang].cefr;
        refreshHeader();
        renderSetup();
      });
    });
    document.querySelectorAll('[data-course-cefr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.cefr = btn.getAttribute('data-course-cefr');
        renderSetup();
      });
    });
    document.querySelectorAll('[data-course-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = Number(btn.getAttribute('data-course-tier'));
        if (state.cefr === 'A1' && tier === 1) {
          confirmCourseSelection(state.lang, 'A1', 1);
          finish();
          return;
        }
        startTest(state.cefr, tier);
      });
    });
  }

  function startTest(cefr, tier) {
    state.cefr = cefr;
    test = {
      cefr,
      tier,
      questions: buildPlacementTest(state.lang, cefr, tier),
      index: 0,
      correct: 0,
    };
    renderQuestion();
  }

  function renderQuestion() {
    const q = test.questions[test.index];
    const total = test.questions.length;
    const choicesHtml = q.choices.map((c, i) => `
      <button type="button" data-test-choice="${i}" class="w-full py-2.5 px-3 rounded-xl border border-[#d2c8b4] bg-[#faf6ee] hover:bg-emerald-50 text-sm font-black text-[#1f2d24] text-left active:scale-95 transition cursor-pointer">${escapeHtml(c.meaning)}</button>
    `).join('');

    openModal(`
      <div class="space-y-3">
        <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
          <h2 class="text-sm font-black text-[#1f2d24]">📝 ${PLACEMENT_QUESTION_COUNT}문제 배치 테스트 (${test.index + 1} / ${total})</h2>
          <span class="text-[10px] font-black text-amber-700">${test.cefr} ${TIER_GAUGE[test.tier]}</span>
        </div>
        <div class="h-1.5 rounded-full bg-[#e6dec8] overflow-hidden">
          <div class="h-full bg-emerald-500 transition-all" style="width:${Math.round((test.index / total) * 100)}%"></div>
        </div>
        <div class="text-center py-3 rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4]">
          <div class="text-2xl font-black text-[#1f2d24]">${escapeHtml(q.word)}</div>
          ${q.phonetic ? `<div class="text-[11px] font-bold text-[#5c6e60] mt-0.5">${escapeHtml(q.phonetic)}</div>` : ''}
        </div>
        <div class="space-y-1.5">${choicesHtml}</div>
      </div>
    `);

    document.querySelectorAll('[data-test-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = q.choices[Number(btn.getAttribute('data-test-choice'))];
        if (picked.isCorrect) test.correct += 1;
        test.index += 1;
        if (test.index >= total) renderResult();
        else renderQuestion();
      });
    });
  }

  function renderResult() {
    const { cefr, tier, correct } = test;
    const total = test.questions.length;
    const bandIdx = getBandIndex(cefr, tier);

    if (correct >= PLACEMENT_PASS_COUNT) {
      confirmCourseSelection(state.lang, cefr, tier);
      refreshHeader();
      openModal(`
        <div class="space-y-3 text-center">
          <div class="text-4xl">🎉</div>
          <h3 class="text-base font-black text-emerald-800">합격! (${correct} / ${total} 정답)</h3>
          <p class="text-xs text-[#4a584e]">${LANG_META[state.lang].flag} ${cefr} ${TIER_GAUGE[tier]} ${COURSE_TIER_LABELS[cefr][tier - 1]} 코스로 배정되었어요!</p>
          <button id="btn-course-done" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-xs active:scale-95 transition cursor-pointer">학습 시작</button>
        </div>
      `);
      document.getElementById('btn-course-done')?.addEventListener('click', finish);
      return;
    }

    const lower = bandIdx >= 2 ? bandToCourse(bandIdx - 1) : null;
    openModal(`
      <div class="space-y-3 text-center">
        <div class="text-4xl">🌱</div>
        <h3 class="text-sm font-black text-[#1f2d24]">아쉽네요! (${correct} / ${total} 정답)</h3>
        <p class="text-xs text-[#4a584e]">조금 더 기초부터 다져볼까요?</p>
        ${lower ? `<button id="btn-course-lower" type="button" class="w-full py-3 rounded-xl bg-amber-500 text-white font-black text-xs active:scale-95 transition cursor-pointer">⬇️ 한 단계 아래 코스 테스트 보기 (${lower.cefr} ${TIER_GAUGE[lower.tier]})</button>` : ''}
        <button id="btn-course-a1" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-xs active:scale-95 transition cursor-pointer">🌱 A1 완전 처음부터 차근차근 시작하기</button>
      </div>
    `);
    document.getElementById('btn-course-lower')?.addEventListener('click', () => startTest(lower.cefr, lower.tier));
    document.getElementById('btn-course-a1')?.addEventListener('click', () => {
      confirmCourseSelection(state.lang, 'A1', 1);
      finish();
    });
  }

  renderSetup();
}

export function openInitialStudyLangModal(ctx, { onStartTutorial } = {}) {
  const { openModal, closeModal, refreshHeader } = ctx;
  let selectedLang = 'en';

  const LANG_OPTIONS = [
    { id: 'en', flag: '🇺🇸', label: '영어', sub: 'English' },
    { id: 'es', flag: '🇪🇸', label: '스페인어', sub: 'Español' },
  ];

  function render() {
    const cardsHtml = LANG_OPTIONS.map((opt) => {
      const isSelected = opt.id === selectedLang;
      return `
        <button
          type="button"
          data-init-study-lang="${opt.id}"
          class="relative aspect-square w-full p-4 rounded-2xl border-2 ${
            isSelected
              ? 'bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-500/35'
              : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
          } flex flex-col items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <div class="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
            isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'border-2 border-[#d2c8b4] text-transparent'
          }">✓</div>
          <span class="text-5xl leading-none select-none">${opt.flag}</span>
          <div class="text-base font-black text-[#1f2d24] mt-1">${opt.flag} ${opt.label}</div>
          <div class="text-xs font-bold ${isSelected ? 'text-emerald-800' : 'text-[#5c6e60]'}">${opt.sub}</div>
        </button>
      `;
    }).join('');

    openModal(`
      <div class="space-y-4 py-1">
        <h2 class="text-lg font-black text-[#1f2d24] text-center">🐾 어떤 언어로 모험할까멍?</h2>

        <div class="grid grid-cols-2 gap-3">
          ${cardsHtml}
        </div>

        <button
          id="btn-start-initial-tutorial"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🐾 출발하기멍!</span>
        </button>
      </div>
    `);

    document.querySelectorAll('[data-init-study-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-init-study-lang');
        if (chosen && chosen !== selectedLang) {
          audioEngine.playCaptureTick?.();
          selectedLang = chosen;
          render();
        }
      });
    });

    document.getElementById('btn-start-initial-tutorial')?.addEventListener('click', () => {
      audioEngine.playCorrect?.();
      updateSave((s) => {
        s.studyLang = selectedLang;
        s.langSelected = true;
      });
      refreshHeader?.();
      closeModal();
      if (typeof onStartTutorial === 'function') {
        onStartTutorial();
      }
    });
  }

  render();
}

export function createLobbyModals(ctx) {
  return {
    openEditDogNameModal: (options) => openEditDogNameModal(ctx, options),
    openQuestsModal: (activeSubtab) => openQuestsModal(ctx, activeSubtab),
    openAirDropSupplyModal: () => openAirDropSupplyModal(ctx),
    openCefrModal: () => openCefrModal(ctx),
    openAttendance30Modal: () => openAttendance30Modal(ctx),
    openNoticeModal: () => openNoticeModal(ctx),
    openProfileModal: () => openProfileModal(ctx),
    openSettingsModal: () => openSettingsModal(ctx),
    openCourseSetupModal: () => openCourseSetupModal(ctx),
    openInitialStudyLangModal: (options) => openInitialStudyLangModal(ctx, options),
  };
}

