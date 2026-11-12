/**
 * js/ui/wordbookUI.js
 * 하단 탭의 우유의 기억 수첩(전체·유닛별 streak 0~3 마스터 달성률,
 * 오답 단어 집중 30초 미니 복습 퀴즈 및 골드/간식 보상) 제어
 */

import { BALANCE } from '../config/balance.js';
import { t } from '../data/i18n.js';
import { getUnits, getWords } from '../data/data_en.js?v=2';
import { getSave, updateSave } from '../core/saveStore.js';
import { wordEngine } from '../core/wordEngine.js';
import { audioEngine } from '../core/audioEngine.js';

export function createWordbookUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const wordbookPanel = document.getElementById('tab-panel-wordbook');
  let unitFilter = '';

  function computeStreakDistribution() {
    const allWords = getWords();
    const stats = getSave().wordStats || {};
    const counts = [0, 0, 0, 0]; // streak 0, 1, 2, 3

    for (const w of allWords) {
      const st = stats[String(w.id)];
      if (!st) {
        counts[0] += 1;
      } else {
        const s = Math.max(0, Math.min(3, st.streak || 0));
        counts[s] += 1;
      }
    }
    return counts;
  }

  function computeUnitProgressList() {
    const allWords = getWords();
    const units = getUnits();
    const stats = getSave().wordStats || {};

    const unitMap = new Map();
    for (const u of units) {
      unitMap.set(u, { unit: u, total: 0, mastered: 0, streakSum: 0 });
    }

    for (const w of allWords) {
      let entry = unitMap.get(w.unit);
      if (!entry) {
        entry = { unit: w.unit, total: 0, mastered: 0, streakSum: 0 };
        unitMap.set(w.unit, entry);
      }
      entry.total += 1;
      const st = stats[String(w.id)];
      if (st) {
        if (st.mastered) entry.mastered += 1;
        entry.streakSum += Math.min(3, st.streak || 0);
      }
    }

    return Array.from(unitMap.values()).map((u) => ({
      ...u,
      masteryPct: u.total > 0 ? Math.round((u.mastered / u.total) * 100) : 0,
      avgStreak: u.total > 0 ? (u.streakSum / u.total).toFixed(1) : '0.0',
    }));
  }

  function startMiniReviewQuiz() {
    const summary = wordEngine.getWordbookSummary();
    const allWords = getWords();
    if (allWords.length < 4) {
      if (openModal) {
        openModal(`
          <div class="text-center space-y-3">
            <div class="text-3xl">📖</div>
            <p class="text-xs text-[#4a584e]">단어 데이터베이스가 아직 로드되지 않았습니다.</p>
            <button id="btn-mini-close" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-sm active:scale-95 transition">${t('modal.close')}</button>
          </div>
        `);
        document.getElementById('btn-mini-close')?.addEventListener('click', () => closeModal?.());
      }
      return;
    }

    const queue = [...summary.reviewQueue];
    if (queue.length < 10) {
      const used = new Set(queue.map((w) => w.id));
      const extras = allWords.filter((w) => !used.has(w.id)).sort(() => Math.random() - 0.5);
      queue.push(...extras.slice(0, 15 - queue.length));
    }

    let timeLeft = BALANCE.VOCA.MIN_REVIEW_REWARD_SEC;
    let qIdx = 0;
    let correctCount = 0;
    let solvedCount = 0;
    let timerId = null;
    let feedbackTimerId = null;
    let isShowingFeedback = false;
    let finished = false;

    const cleanupTimer = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      if (feedbackTimerId !== null) {
        clearTimeout(feedbackTimerId);
        feedbackTimerId = null;
      }
    };

    const finishQuiz = (completedFullTime) => {
      if (finished) return;
      finished = true;
      cleanupTimer();

      let goldReward = 0;
      let snackReward = 0;
      if (completedFullTime) {
        goldReward = BALANCE.SHOP.MINI_REVIEW_REWARD_GOLD;
        snackReward = BALANCE.SHOP.MINI_REVIEW_REWARD_SNACKS;
        updateSave((s) => {
          s.gold += goldReward;
          s.snacks += snackReward;
          s.dailyMissions.progress.miniReview += 1;
        });
        audioEngine.playCorrect();
        onResourcesChanged?.();
      }

      renderWordbookTab();

      openModal?.(`
        <div class="text-center space-y-4">
          <div class="text-4xl">${completedFullTime ? '🎉' : '⏱️'}</div>
          <h3 class="text-lg font-black text-emerald-800">${completedFullTime ? '30초 미니 복습 완료!' : '미니 복습 종료'}</h3>
          <div class="bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs space-y-1.5">
            <div class="flex justify-between"><span class="text-[#4a584e]">풀이 수</span><strong class="text-[#1f2d24]">${solvedCount}문제</strong></div>
            <div class="flex justify-between"><span class="text-[#4a584e]">정답 수</span><strong class="text-emerald-800">${correctCount}문제</strong></div>
            ${
              completedFullTime
                ? `<div class="flex justify-between"><span class="text-[#4a584e]">획득 보상</span><strong class="text-amber-700">+${goldReward}🪙 +${snackReward}🦴</strong></div>`
                : `<div class="text-[11px] text-rose-600 pt-1">30초를 모두 완주하면 골드와 간식 보상을 받을 수 있어요!</div>`
            }
          </div>
          <button id="btn-mini-finish-ok" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-sm active:scale-95 transition">${t('modal.confirm')}</button>
        </div>
      `);

      document.getElementById('btn-mini-finish-ok')?.addEventListener('click', () => {
        closeModal?.();
      });
    };

    const renderQuestion = () => {
      if (finished) return;
      isShowingFeedback = false;
      const word = queue[qIdx % queue.length];
      const choices = wordEngine.createQuestionChoices(word);
      const streak = wordEngine.getWordStreak(word.id);

      audioEngine.speakWordOnce(word.word);

      const choicesHtml = choices
        .map(
          (ch, idx) => `
          <button type="button" data-choice-idx="${idx}" class="mini-choice-btn w-full py-3 px-4 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dec8] border border-[#d2c8b4] text-sm font-bold text-[#1f2d24] text-left active:scale-98 transition">
            ${idx + 1}. ${ch.meaning}
          </button>
        `
        )
        .join('');

      openModal?.(`
        <div class="space-y-4">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-emerald-800">⏱️ <span id="mini-timer-text">${timeLeft}s</span></span>
            <span class="text-amber-700">★ ${streak}/3 · 정답 ${correctCount}</span>
            <button id="btn-mini-quit" type="button" class="text-[#4a584e] hover:text-[#1f2d24]">✕</button>
          </div>

          <div class="led-board rounded-xl p-4 text-center">
            <div class="text-2xl font-black text-[#f8f5ec]">${word.word}</div>
            <div class="text-xs text-emerald-200/80 font-mono mt-1">${word.phonetic || ''}</div>
          </div>

          <div class="space-y-2">${choicesHtml}</div>
        </div>
      `);

      document.getElementById('btn-mini-quit')?.addEventListener('click', () => finishQuiz(false));

      const choiceButtons = document.querySelectorAll('.mini-choice-btn');
      choiceButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (finished || isShowingFeedback) return;
          const idx = Number(btn.getAttribute('data-choice-idx'));
          const picked = choices[idx];
          solvedCount += 1;

          if (picked?.isCorrect) {
            correctCount += 1;
            wordEngine.submitAnswer(word.id, true);
            audioEngine.playCorrect();
            qIdx += 1;
            renderQuestion();
            return;
          }

          isShowingFeedback = true;
          wordEngine.submitAnswer(word.id, false);
          audioEngine.playWrong();

          btn.classList.remove('bg-[#f0ebe0]', 'hover:bg-[#e6dec8]', 'border-[#d2c8b4]');
          btn.classList.add('bg-rose-500/80', 'border-rose-400', 'text-white');

          choiceButtons.forEach((cBtn) => {
            const cIdx = Number(cBtn.getAttribute('data-choice-idx'));
            if (choices[cIdx]?.isCorrect) {
              cBtn.classList.remove('bg-[#f0ebe0]', 'hover:bg-[#e6dec8]', 'border-[#d2c8b4]');
              cBtn.classList.add('bg-[#2d6a4f]', 'border-emerald-500', 'text-[#f8f5ec]', 'ring-2', 'ring-emerald-400');
            }
          });

          feedbackTimerId = window.setTimeout(() => {
            feedbackTimerId = null;
            isShowingFeedback = false;
            if (!finished) {
              qIdx += 1;
              renderQuestion();
            }
          }, 900);
        });
      });
    };

    renderQuestion();
    timerId = window.setInterval(() => {
      timeLeft -= 1;
      const timerEl = document.getElementById('mini-timer-text');
      if (timerEl) timerEl.textContent = `${Math.max(0, timeLeft)}s`;
      if (timeLeft <= 0) {
        finishQuiz(true);
      }
    }, 1000);
  }

  function renderWordbookTab() {
    const summary = wordEngine.getWordbookSummary();
    const dist = computeStreakDistribution();
    const unitList = computeUnitProgressList();
    const filteredUnits = unitFilter
      ? unitList.filter((u) => u.unit.toLowerCase().includes(unitFilter.toLowerCase()))
      : unitList;

    const unitRowsHtml =
      filteredUnits.length === 0
        ? `<div class="text-xs text-[#4a584e] text-center py-4">표시할 유닛이 없습니다.</div>`
        : filteredUnits
            .slice(0, 40)
            .map(
              (u) => `
              <div class="p-2.5 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-extrabold text-[#1f2d24] uppercase">${u.unit}</span>
                  <span class="text-emerald-800 font-bold">${u.mastered}/${u.total} (${u.masteryPct}%) · avg ★${u.avgStreak}</span>
                </div>
                <div class="h-1.5 bg-[#e6dec8] rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-emerald-600 to-amber-500" style="width:${u.masteryPct}%"></div>
                </div>
              </div>
            `
            )
            .join('');

    wordbookPanel.innerHTML = `
      <div class="p-4 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-emerald-800">📖 ${t('lobby.wordbookTitle')}</h3>
          <span class="text-xs font-extrabold text-amber-700">${summary.masteredCount} / ${summary.totalCount} (${summary.masteryPercent}%)</span>
        </div>

        <div class="h-2.5 bg-[#e6dec8] rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-[#2d6a4f] via-emerald-500 to-amber-500" style="width:${summary.masteryPercent}%"></div>
        </div>

        <div class="grid grid-cols-4 gap-1.5 text-center text-[11px]">
          <div class="p-1.5 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4]"><div class="text-[#4a584e]">★0</div><div class="font-bold text-[#1f2d24]">${dist[0]}</div></div>
          <div class="p-1.5 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4]"><div class="text-emerald-800">★1</div><div class="font-bold text-[#1f2d24]">${dist[1]}</div></div>
          <div class="p-1.5 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4]"><div class="text-amber-700">★2</div><div class="font-bold text-[#1f2d24]">${dist[2]}</div></div>
          <div class="p-1.5 rounded-lg bg-[#f0ebe0] border border-emerald-600/40"><div class="text-emerald-800">★3</div><div class="font-bold text-emerald-800">${dist[3]}</div></div>
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-[#1b3b2b] border border-[#2d5a43] text-[#f8f5ec] space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold text-emerald-200">${t('lobby.wrongQueueCount')}</span>
          <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-black">${summary.reviewQueue.length}개</span>
        </div>
        <p class="text-[11px] text-[#a3b899]">${t('lobby.miniReviewDesc')}</p>
        <button id="btn-start-mini-review" type="button" class="w-full py-3 rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] hover:opacity-95 text-[#f8f5ec] font-black text-xs active:scale-95 transition">
          ⚡ ${t('lobby.startMiniReview')} (+${BALANCE.SHOP.MINI_REVIEW_REWARD_GOLD}🪙 +${BALANCE.SHOP.MINI_REVIEW_REWARD_SNACKS}🦴)
        </button>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-extrabold text-[#4a584e]">유닛별 달성률 (총 ${unitList.length}개 유닛)</span>
          <input id="input-unit-filter" type="text" value="${unitFilter}" placeholder="예: unit_001" class="w-28 px-2.5 py-1 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4] text-xs text-[#1f2d24]" />
        </div>
        <div class="space-y-1.5">${unitRowsHtml}</div>
      </div>
    `;

    document.getElementById('btn-start-mini-review')?.addEventListener('click', startMiniReviewQuiz);
    document.getElementById('input-unit-filter')?.addEventListener('input', (e) => {
      unitFilter = e.target.value;
      renderWordbookTab();
    });
  }

  return {
    renderWordbookTab,
  };
}

