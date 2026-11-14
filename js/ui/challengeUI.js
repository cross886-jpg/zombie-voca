/**
 * js/ui/challengeUI.js
 * 🏆 챌린지 탭:
 * 1) [🎓 언어 등급 승급전] - A1~C2 공인 등급, 1일 1회 무료(추가 시 🦴1개), 20문제 85% 이상 합격 시 즉시 승급 + 🦴3개
 * 2) [🏆 주간 20인 리그 순위표] - 브론즈~다이아 티어, 매주 월요일 0시 정산 (상위 5명 승급+보상, 하위 3명 강등)
 */

import {
  getSave,
  updateSave,
  checkAndSettleWeeklyLeague,
  getTimeUntilNextWeeklyReset,
  generateRivals,
  getWeekKey,
  LEAGUE_TIERS,
} from '../core/saveStore.js';
import { BREEDS } from '../data/catalog.js';
import { audioEngine } from '../core/audioEngine.js';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEAGUE_META = {
  bronze: { name: '브론즈 리그', icon: '🥉', badgeClass: 'bg-amber-100 text-amber-950 border-amber-400', rewardSnacks: 3 },
  silver: { name: '실버 리그', icon: '🥈', badgeClass: 'bg-slate-200 text-slate-900 border-slate-400', rewardSnacks: 4 },
  gold: { name: '골드 리그', icon: '🥇', badgeClass: 'bg-yellow-100 text-yellow-950 border-yellow-400', rewardSnacks: 5 },
  ruby: { name: '루비 리그', icon: '💎', badgeClass: 'bg-rose-100 text-rose-950 border-rose-300', rewardSnacks: 7 },
  diamond: { name: '다이아 리그', icon: '👑', badgeClass: 'bg-cyan-100 text-cyan-950 border-cyan-400', rewardSnacks: 10 },
};

const BREED_ICONS = {
  pomeranian: '🐶',
  retriever: '🐕',
  corgi: '🦊',
  shiba: '🐕‍🦺',
  beagle: '🐩',
};

export function createChallengeUI({ onResourcesChanged, openModal, closeModal, onStartPromotion }) {
  const panel = document.getElementById('tab-panel-challenge');

  function getTodayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderChallengeTab() {
    const targetPanel = panel || document.getElementById('tab-panel-challenge');
    if (!targetPanel) return;

    // 1. 주간 정산 검사 및 정산 모달 처리
    let save = getSave();
    const settlement = checkAndSettleWeeklyLeague(save);
    if (settlement) {
      onResourcesChanged?.();
      showSettlementModal(settlement);
    }
    save = getSave();

    const certLevel = save.certifiedLevel || 'A1';

    const leagueTier = save.challenge.leagueTier || 'bronze';
    const tierMeta = LEAGUE_META[leagueTier] || LEAGUE_META.bronze;
    const myScore = save.challenge.weeklyScore || 0;
    const curWeekKey = getWeekKey();

    // 2. 가상 라이벌 19명 + 내 강아지 = 20인 랭킹 생성
    const rivals = generateRivals(leagueTier, curWeekKey);
    const myDogName = save.dogName || '우유';
    const myBreedId = save.selectedBreed || 'pomeranian';

    const fullRoster = [
      {
        id: 'player_me',
        name: myDogName,
        breed: myBreedId,
        level: certLevel,
        score: myScore,
        isPlayer: true,
      },
      ...rivals,
    ].sort((a, b) => b.score - a.score);

    const myRank = fullRoster.findIndex((r) => r.isPlayer) + 1;
    const { days, hours, minutes } = getTimeUntilNextWeeklyReset();

    targetPanel.innerHTML = `
      <!-- 🏆 주간 20인 리그 순위표 -->
      <div id="challenge-league-roster-card" class="rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] p-4 text-[#1f2d24] shadow-sm space-y-3.5">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${tierMeta.icon}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <h3 class="text-sm font-black text-[#1f2d24]">${tierMeta.name}</h3>
                <span class="px-2 py-0.5 rounded-full border text-[10px] font-black ${tierMeta.badgeClass}">
                  내 순위: ${myRank}위
                </span>
              </div>
              <div class="text-[11px] font-semibold text-[#4a584e] mt-0.5">
                주간 정산까지: <b class="text-emerald-800">${days}일 ${hours}시간 ${minutes}분</b>
              </div>
            </div>
          </div>

          <div class="text-right">
            <div class="text-[10px] font-semibold text-[#4a584e]">내 주간 누적 점수</div>
            <div class="text-sm font-black text-emerald-700">${myScore.toLocaleString()} P</div>
          </div>
        </div>

        <!-- 순위 구간 범례 (정적 안내 칩 바) -->
        <div class="flex items-center justify-between gap-1 px-3 py-1.5 rounded-xl bg-[#efe9dc]/80 border border-[#dcd3bd] text-[10px] select-none pointer-events-none">
          <div class="flex items-center gap-1 font-bold text-emerald-800">
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>1~5위 승급</span>
            <span class="text-[9px] font-semibold text-emerald-700">(+${tierMeta.rewardSnacks}🦴)</span>
          </div>
          <span class="text-[#c5baa3] text-[9px]">•</span>
          <div class="flex items-center gap-1 font-semibold text-[#4a584e]">
            <span class="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
            <span>6~17위 유지</span>
          </div>
          <span class="text-[#c5baa3] text-[9px]">•</span>
          <div class="flex items-center gap-1 font-semibold ${leagueTier === 'bronze' ? 'text-[#4a584e]' : 'text-rose-700 font-bold'}">
            <span class="w-2 h-2 rounded-full ${leagueTier === 'bronze' ? 'bg-slate-400' : 'bg-rose-500'} shrink-0"></span>
            <span>${leagueTier === 'bronze' ? '18~20위 유지' : '18~20위 강등'}</span>
          </div>
        </div>

        <!-- 20인 랭킹 리스트 -->
        <div class="divide-y divide-[#e6dec8] rounded-xl border border-[#d2c8b4] bg-[#f8f5ec] overflow-hidden max-h-[380px] overflow-y-auto">
          ${fullRoster
            .map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.isPlayer;
              const breedIcon = BREED_ICONS[entry.breed] || '🐶';
              const breedName = BREEDS.find((b) => b.id === entry.breed)?.name || '강아지';

              let zoneBg = '';
              let rankBadge = `${rank}`;
              if (rank <= 5) {
                zoneBg = isMe ? 'bg-emerald-100/90 border-2 border-emerald-500' : 'bg-emerald-50/50';
                if (rank === 1) rankBadge = '🥇';
                else if (rank === 2) rankBadge = '🥈';
                else if (rank === 3) rankBadge = '🥉';
              } else if (rank >= 18 && leagueTier !== 'bronze') {
                zoneBg = isMe ? 'bg-rose-100/90 border-2 border-rose-500' : 'bg-rose-50/40';
              } else {
                zoneBg = isMe ? 'bg-amber-100/90 border-2 border-amber-500' : '';
              }

              return `
                <div class="flex items-center justify-between px-3 py-2 text-xs transition ${zoneBg}">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 text-center font-black ${rank <= 3 ? 'text-base' : 'text-xs text-[#4a584e]'}">${rankBadge}</span>
                    <span class="text-base">${breedIcon}</span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-extrabold truncate ${isMe ? 'text-emerald-900 font-black' : 'text-[#1f2d24]'}">
                          ${entry.name}
                        </span>
                        ${isMe ? '<span class="px-1.5 py-0.2 rounded-md bg-emerald-700 text-white text-[9px] font-black">ME</span>' : ''}
                        <span class="px-1 py-0.2 rounded bg-amber-400/20 text-amber-800 text-[9px] font-extrabold border border-amber-400/40">
                          ${entry.level}
                        </span>
                      </div>
                      <div class="text-[10px] text-[#4a584e]">${breedName}</div>
                    </div>
                  </div>

                  <div class="text-right shrink-0">
                    <div class="font-black text-[#1f2d24]">${entry.score.toLocaleString()} <span class="text-[10px] font-semibold text-[#4a584e]">P</span></div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  function showSettlementModal(res) {
    const prevMeta = LEAGUE_META[res.prevTier] || LEAGUE_META.bronze;
    const newMeta = LEAGUE_META[res.newTier] || LEAGUE_META.bronze;

    let icon = '🏆';
    let title = '';
    let desc = '';

    if (res.outcome === 'promoted') {
      icon = '🎉';
      title = `${newMeta.name} 승급 성공!`;
      desc = `지난주 최종 <b>${res.rank}위</b>를 기록하여 <b>${newMeta.name}</b>으로 승급했습니다!<br/>승급 축하 보너스로 <b>+${res.rewardSnacks} 🦴 뼈다귀</b>가 지급되었습니다.`;
    } else if (res.outcome === 'demoted') {
      icon = '😢';
      title = `${newMeta.name} 강등`;
      desc = `지난주 최종 <b>${res.rank}위</b>로 아쉽게 강등되었습니다.<br/>이번 주에 다시 승급에 도전해 보세요!`;
    } else {
      icon = '🛡️';
      title = `${prevMeta.name} 유지`;
      desc = `지난주 최종 <b>${res.rank}위</b>로 리그를 안전하게 유지했습니다!`;
    }

    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">${icon}</div>
        <h3 class="text-lg font-black text-[#1f2d24]">${title}</h3>
        <p class="text-xs text-[#4a584e] leading-relaxed">${desc}</p>
        <button id="btn-settle-ok" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] text-white font-black text-xs shadow-md active:scale-95 transition">
          확인
        </button>
      </div>
    `);

    document.getElementById('btn-settle-ok')?.addEventListener('click', () => {
      closeModal();
      renderChallengeTab();
    });
  }

  return {
    renderChallengeTab,
  };
}

