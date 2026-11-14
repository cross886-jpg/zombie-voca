/**
 * js/ui/modals/rewardModals.js
 * 퀘스트, 일일 보급품, 30일 출석부, 공지사항 모달
 */

import { ATTENDANCE_30_REWARDS, QUEST_DEFS } from '../../data/catalog.js';
import { t } from '../../data/i18n.js';
import {
  getSave,
  claimAttendance30,
  claimDailyAirDrop,
  openAirDropWithKey,
  claimQuestReward,
  ensureQuestsState,
  getTodayDateKey,
} from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';

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
  const today = getTodayDateKey();

  function rollReward() {
    const roll = Math.random();
    if (roll < 0.45) {
      const gold = Math.floor(Math.random() * 21) + 30; // 30 ~ 50
      return { gold, snacks: 0, gems: 0, label: `+${gold} 금화`, icon: '🪙', bg: 'bg-amber-50 border-amber-300 text-amber-900' };
    } else if (roll < 0.8) {
      return { gold: 0, snacks: 1, gems: 0, label: '+1 뼈다귀', icon: '🦴', bg: 'bg-amber-50 border-amber-300 text-amber-900' };
    } else {
      const gems = Math.floor(Math.random() * 2) + 2; // 2 ~ 3
      return { gold: 0, snacks: 0, gems, label: `+${gems} 보석`, icon: '💎', bg: 'bg-cyan-50 border-cyan-300 text-cyan-900' };
    }
  }

  const renderModalContent = (claimedReward = null) => {
    const curSave = getSave();
    const isAvailable = curSave.dailyAirDropDate !== today;
    const keysCount = curSave.keys || 0;

    // 수령 전 화면 (무료 보급품 수령 가능 상태)
    if (isAvailable && !claimedReward) {
      openModal(`
        <div class="space-y-4 text-center py-1">
          <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
            <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
              <span>🪂</span>
              <span>일일 보급품</span>
            </h2>
            <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
          </div>

          <div class="py-3 flex flex-col items-center justify-center">
            <div class="text-5xl select-none leading-none">🪂📦</div>
            <div class="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black">
              🪙 금화 · 🦴 간식 · 💎 보석 중 랜덤 무료 지급!
            </div>
          </div>

          <div class="pt-1">
            <button
              id="btn-claim-airdrop"
              type="button"
              class="w-full py-3.5 rounded-2xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>[ 🪂 무료 보급품 받기 ]</span>
            </button>
          </div>
        </div>
      `);

      document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

      document.getElementById('btn-claim-airdrop')?.addEventListener('click', () => {
        const reward = rollReward();
        const res = claimDailyAirDrop({ gold: reward.gold, snacks: reward.snacks, gems: reward.gems });
        if (res.ok) {
          audioEngine.playPowerUp?.();
          refreshHeader();
          renderBattleTab();
          renderModalContent(reward);
        }
      });
      return;
    }

    // 개봉 결과 화면 또는 이미 수령 완료 후 화면
    openModal(`
      <div class="space-y-4 text-center py-1">
        <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
          <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
            <span>🪂</span>
            <span>일일 보급품</span>
          </h2>
          <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
        </div>

        <div class="py-2 flex flex-col items-center justify-center">
          <div class="text-4xl select-none leading-none">🪂📦✨</div>
          <div class="text-sm font-black text-[#1f2d24] mt-2">
            ${claimedReward ? '보급품 개봉 완료!' : '오늘의 무료 보급품 수령 완료'}
          </div>
          ${
            claimedReward
              ? `
                <div class="mt-2.5 p-3 rounded-2xl ${claimedReward.bg} border text-center inline-flex items-center justify-center gap-2 min-w-[160px] shadow-xs">
                  <span class="text-2xl">${claimedReward.icon}</span>
                  <span class="text-sm font-black">${claimedReward.label}</span>
                </div>
              `
              : `
                <p class="text-xs text-[#5c6e60] mt-1">내일 새로운 무료 보급품이 다시 투하됩니다.</p>
              `
          }
        </div>

        <div class="space-y-2 pt-1 border-t border-[#d2c8b4]">
          <button
            id="btn-airdrop-key"
            type="button"
            class="w-full py-3 rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 ${
              keysCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer active:scale-95'
                : 'bg-[#e6dec8] text-[#8c9c8f] cursor-not-allowed opacity-75'
            }"
            ${keysCount > 0 ? '' : 'disabled'}
          >
            <span>[ 🔑 열쇠 1개로 보급품 열기 (보유: ${keysCount}개) ]</span>
          </button>
          ${
            keysCount === 0
              ? `
                <p class="text-[10px] text-[#5c6e60] leading-tight break-keep">
                  💡 보급 열쇠 획득처: 일일 미션 달성, 주간 챌린지 랭킹 보상, 30일 출석부
                </p>
              `
              : ''
          }

          <button
            id="btn-airdrop-confirm"
            type="button"
            class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-airdrop-confirm')?.addEventListener('click', closeModal);

    document.getElementById('btn-airdrop-key')?.addEventListener('click', () => {
      const reward = rollReward();
      const res = openAirDropWithKey({ gold: reward.gold, snacks: reward.snacks, gems: reward.gems });
      if (res.ok) {
        audioEngine.playPowerUp?.();
        refreshHeader();
        renderBattleTab();
        renderModalContent(reward);
      }
    });
  };

  renderModalContent();
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
