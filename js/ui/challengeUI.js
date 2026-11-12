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
  bronze: { name: '브론즈 리그', icon: '🥉', badgeClass: 'bg-amber-900/30 text-amber-300 border-amber-700/50', rewardSnacks: 3 },
  silver: { name: '실버 리그', icon: '🥈', badgeClass: 'bg-slate-700/30 text-slate-200 border-slate-500/50', rewardSnacks: 4 },
  gold: { name: '골드 리그', icon: '🥇', badgeClass: 'bg-yellow-700/30 text-yellow-300 border-yellow-500/50', rewardSnacks: 5 },
  ruby: { name: '루비 리그', icon: '💎', badgeClass: 'bg-rose-800/30 text-rose-300 border-rose-500/50', rewardSnacks: 7 },
  diamond: { name: '다이아 리그', icon: '👑', badgeClass: 'bg-cyan-800/30 text-cyan-300 border-cyan-400/50', rewardSnacks: 10 },
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

  function getNextLevel(curLevel) {
    const idx = CEFR_LEVELS.indexOf(curLevel);
    if (idx === -1) return 'A2';
    if (idx >= CEFR_LEVELS.length - 1) return null; // 최고 등급
    return CEFR_LEVELS[idx + 1];
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
    const nextLevel = getNextLevel(certLevel);
    const isMaster = !nextLevel;

    const todayStr = getTodayString();
    const isFree = save.challenge.dailyFreeUsedDate !== todayStr;
    const curSnacks = save.snacks || 0;

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
      <!-- 🎓 상단 구역: 언어 등급 승급전 -->
      <div class="rounded-2xl bg-gradient-to-br from-[#1b3b2b] via-[#234735] to-[#12281d] border border-emerald-600/40 p-4 text-[#f8f5ec] shadow-md space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎓</span>
            <h2 class="text-sm font-black text-emerald-200">언어 등급 승급전</h2>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[10px] font-black text-amber-300">
            공인 CEFR 표준
          </span>
        </div>

        <div class="bg-[#12281d]/80 border border-emerald-700/50 rounded-xl p-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex flex-col items-center justify-center">
              <span class="text-base font-black text-amber-300">${certLevel}</span>
              <span class="text-[9px] font-bold text-amber-200/80">현재 등급</span>
            </div>
            <div>
              <div class="text-xs font-bold text-emerald-100 flex items-center gap-1.5">
                <span>${myDogName}의 언어 등급</span>
              </div>
              <div class="text-[11px] text-emerald-300/80 mt-0.5">
                ${isMaster ? '최고 등급 마스터 달성!' : `다음 목표: <b class="text-amber-300 font-black">${nextLevel}</b> 등급`}
              </div>
            </div>
          </div>

          <div class="text-right">
            <div class="text-[10px] font-semibold text-emerald-300/70">합격 기준</div>
            <div class="text-xs font-black text-amber-300">20문제 중 85% (17개)</div>
          </div>
        </div>

        ${
          isMaster
            ? `
          <div class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-black text-xs text-center shadow-sm">
            👑 최고 언어 등급(C2 마스터)에 도달했습니다!
          </div>
        `
            : `
          <button id="btn-start-promotion" type="button" class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2">
            <span>🔥 ${nextLevel} 승급전 도전하기</span>
            <span class="px-2 py-0.5 rounded-full ${isFree ? 'bg-amber-400 text-emerald-950 font-black' : 'bg-emerald-900/80 text-amber-300 border border-amber-400/40'} text-[10px]">
              ${isFree ? '오늘 1회 무료' : '🦴 1 소모'}
            </span>
          </button>
        `
        }
      </div>

      <!-- 🏆 하단 구역: 주간 20인 리그 순위표 -->
      <div class="rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] p-4 text-[#1f2d24] shadow-sm space-y-3.5">
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

        <!-- 3단계 구역 가이드 -->
        <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-extrabold">
          <div class="py-1 px-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
            🟢 1~5위 승급 (+${tierMeta.rewardSnacks}🦴)
          </div>
          <div class="py-1 px-1.5 rounded-lg bg-[#efe9dc] text-[#4a584e] border border-[#d2c8b4]">
            ⚪ 6~17위 유지
          </div>
          <div class="py-1 px-1.5 rounded-lg ${leagueTier === 'bronze' ? 'bg-[#efe9dc] text-[#4a584e] border-[#d2c8b4]' : 'bg-rose-100 text-rose-800 border-rose-300'}">
            ${leagueTier === 'bronze' ? '⚪ 18~20위 유지' : '🔴 18~20위 강등'}
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

    // 승급전 도전 이벤트 바인딩
    document.getElementById('btn-start-promotion')?.addEventListener('click', () => {
      handleStartPromotion(nextLevel, isFree, curSnacks);
    });
  }

  function handleStartPromotion(targetLevel, isFree, curSnacks) {
    if (!targetLevel) return;

    if (!isFree && curSnacks < 1) {
      openModal(`
        <div class="text-center space-y-3">
          <div class="text-3xl">🦴</div>
          <h3 class="text-base font-black text-rose-700">뼈다귀 부족</h3>
          <p class="text-xs text-[#4a584e] leading-relaxed">
            오늘 1회 무료 도전을 이미 사용했습니다.<br/>
            추가 도전에는 <b>🦴 1 뼈다귀</b>가 필요합니다.
          </p>
          <button id="btn-close-snack-err" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs">
            확인
          </button>
        </div>
      `);
      document.getElementById('btn-close-snack-err')?.addEventListener('click', closeModal);
      return;
    }

    const costText = isFree ? '오늘 1회 무료 도전' : '🦴 1 뼈다귀 소모';

    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">🔥</div>
        <div>
          <h3 class="text-base font-black text-[#1f2d24]">${targetLevel} 승급전 입장</h3>
          <p class="text-xs text-[#4a584e] mt-1 leading-relaxed">
            ${targetLevel} 등급 단어 <b>20문제</b>가 연속 출제됩니다.<br/>
            정답률 <b>85% 이상(17문제 정답)</b> 달성 시 즉시 승급 및 <b>+3 🦴 보상</b>을 획득합니다!
          </p>
        </div>

        <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-xs font-extrabold text-emerald-800">
          입장 비용: ${costText}
        </div>

        <div class="flex gap-2">
          <button id="btn-cancel-promo" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] text-[#1f2d24] font-bold text-xs active:scale-95 transition">
            취소
          </button>
          <button id="btn-confirm-promo" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">
            도전 시작 ⚔️
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-cancel-promo')?.addEventListener('click', closeModal);
    document.getElementById('btn-confirm-promo')?.addEventListener('click', () => {
      closeModal();
      // 비용 차감 및 세이브 갱신
      updateSave((s) => {
        if (!s.challenge) s.challenge = {};
        if (isFree) {
          s.challenge.dailyFreeUsedDate = getTodayString();
        } else {
          s.snacks = Math.max(0, (s.snacks || 0) - 1);
        }
      });
      audioEngine.unlock();
      onResourcesChanged?.();
      onStartPromotion?.({ targetLevel });
    });
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

