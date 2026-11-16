/**
 * js/ui/lobbyUI.js
 * 메인 로비 전투 탭(4개 난이도 코스, 5개 챕터, 출격 버튼),
 * 일일 미션 4종 모달, 7일 연속 출석부 모달, 설정(Base64 백업/복원, 튜토리얼 다시보기, 언어 스위치) 제어
 */

import { BREEDS, QUEST_DEFS, COMPANIONS, DOG_GEAR, SNACKS, PET_TREATS, SKILLS } from '../data/catalog.js';
import { BALANCE, DOG_WILD_SKILLS } from '../config/balance.js';
import { getChapter, getChapterNumberForUnit, getChapterInfo, CHAPTER_INFO, CHAPTER_BOSS_RECOVERY } from '../data/chapters.js';
import { t } from '../data/i18n.js';
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
import settingsStore from '../settingsStore.js';

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
  const compendiumPanel = document.getElementById('tab-panel-compendium') || document.getElementById('tab-panel-journey');
  const tabPanels = {
    gear: document.getElementById('tab-panel-gear'),
    battle: battlePanel,
    training: document.getElementById('tab-panel-training'),
    shop: document.getElementById('tab-panel-shop'),
    compendium: compendiumPanel,
    journey: compendiumPanel,
  };
  const tabButtons = document.querySelectorAll('.lobby-tab-btn');

  let activeTab = 'battle';
  let compendiumSubTab = 'words'; // 'words' | 'gear' | 'skills' | 'characters'
  let hideMeaningMode = false;
  let wordsFilter = 'all'; // 'all' | 'wrong'
  let charSubTab = 'breeds'; // 'breeds' | 'companions' | 'zombies'

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
    openWordLevelSelectModal,
    openOwnerCompanionModal,
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

  const petStageState = {
    targetLookX: 0,
    targetLookY: 0,
    currentLookX: 0,
    currentLookY: 0,
    isSpinning: false,
  };

  let journeySubTab = 'outposts';
  let wordsFilter = 'all';

  let happyUntil = 0;
  let happyAnimFrameId = null;
  let petCooldownUntil = 0;
  let petCooldownTimerId = null;
  let walkCooldownTimerId = null;

  function triggerDogHappyReaction(stage, customSpeech) {
    happyUntil = Date.now() + 2500;
    if (typeof window !== 'undefined' && window.cancelAnimationFrame && happyAnimFrameId) {
      cancelAnimationFrame(happyAnimFrameId);
    }
    renderHeroPreview();

    const stageEl = stage || document.getElementById('lobby-hero-stage');
    if (!stageEl) return;

    // 1. 행복 말풍선
    const oldBubble = stageEl.querySelector('.dog-speech-bubble');
    if (oldBubble) oldBubble.remove();

    const bubble = document.createElement('div');
    bubble.className = 'dog-speech-bubble absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none bg-white text-emerald-950 border border-emerald-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-lg whitespace-nowrap z-30 animate-bounce select-none';
    const cheers = ['멍! 기분 최고예요! 💕', '와앙! 너무 좋아요! ✨', '꼬리 살랑살랑~ 💖', '헤헤 기분 짱이다 멍! 🐾'];
    bubble.textContent = customSpeech || cheers[Math.floor(Math.random() * cheers.length)];
    stageEl.appendChild(bubble);

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
        stageEl.appendChild(p);
        setTimeout(() => p.remove(), 900);
      }, i * 160);
    }
  }

  function getWalkRemainingSeconds() {
    const prof = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : getSave();
    const lastWalk = prof.careSystem?.lastWalkTime || 0;
    const elapsed = Date.now() - lastWalk;
    const cooldownMs = 120000; // 2분 (120초)
    return Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000));
  }

  function openCarePuzzleModal(careType = 'food') {
    if (!window.CareSentenceBuilder || typeof window.CareSentenceBuilder.buildCarePuzzle !== 'function') {
      console.warn('[lobbyUI] CareSentenceBuilder not loaded');
      return;
    }

    const puzzle = window.CareSentenceBuilder.buildCarePuzzle(careType);
    let currentPlaced = [];

    const titles = {
      food: { icon: '🍖', text: '맛있는 밥 주기' },
      water: { icon: '💧', text: '시원한 물 주기' },
      poop: { icon: '💩', text: '깨끗하게 응가 치우기' },
    };
    const titleInfo = titles[careType] || titles.food;

    const renderPuzzle = () => {
      const remainingTiles = puzzle.shuffledTiles.filter(
        (tile) => !currentPlaced.some((p) => p.id === tile.id)
      );

      const html = `
        <div class="p-4 sm:p-5 flex flex-col gap-3 relative select-none">
          <button id="btn-care-puzzle-close" type="button" class="absolute top-3 right-3 text-[#5c6e60] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>

          <div class="text-center">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black shadow-xs">
              <span>${titleInfo.icon}</span>
              <span>${titleInfo.text}</span>
            </div>
            <p class="text-xs text-[#5c6e60] mt-1.5 font-bold">단어 타일을 올바른 순서로 터치해 문장을 완성하세요!</p>
          </div>

          <div class="rounded-xl bg-[#faf6ee] border border-amber-300/80 p-2.5 text-center shadow-xs">
            <div class="flex items-center justify-center gap-2">
              <span class="text-xs font-black text-amber-700">✨ 목표 단어:</span>
              <span class="text-sm font-black text-[#1f2d24]">${puzzle.targetWordInfo.word}</span>
              ${puzzle.targetWordInfo.pron ? `<span class="text-[11px] text-[#5c6e60] font-mono">${puzzle.targetWordInfo.pron}</span>` : ''}
            </div>
            <div class="text-xs font-extrabold text-emerald-800 mt-0.5">뜻: ${puzzle.targetWordInfo.meaning}</div>
          </div>

          <div class="text-center font-black text-sm text-[#1f2d24]">
            "${puzzle.promptKo}"
          </div>

          <div id="care-puzzle-slots" class="min-h-[52px] rounded-xl bg-white/80 border-2 border-dashed border-[#b8cbb8] p-2 flex flex-wrap items-center justify-center gap-2">
            ${currentPlaced.length === 0 ? `
              <span class="text-xs text-[#8a9b8e] font-bold">아래 타일을 순서대로 터치하세요</span>
            ` : currentPlaced.map((t, idx) => `
              <button type="button" data-placed-idx="${idx}" class="btn-placed-tile px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-black text-xs shadow active:scale-95 transition cursor-pointer flex items-center gap-1">
                <span>${t.text}</span>
                <span class="text-[10px] opacity-75">✕</span>
              </button>
            `).join('')}
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2 py-2">
            ${remainingTiles.map((tile) => `
              <button type="button" data-tile-id="${tile.id}" class="btn-tile-option px-3.5 py-2 rounded-xl ${tile.isTargetWord ? 'bg-amber-100 hover:bg-amber-200 border-2 border-amber-400 text-amber-950 ring-2 ring-amber-300/60 font-black scale-105' : 'bg-[#faf6ee] hover:bg-[#efe9dc] border border-[#d2c8b4] text-[#1f2d24] font-extrabold'} text-xs shadow-sm active:scale-95 transition cursor-pointer">
                ${tile.isTargetWord ? '✨ ' : ''}${tile.text}
              </button>
            `).join('')}
          </div>

          <div id="care-puzzle-feedback" class="text-center min-h-[22px] text-xs font-black text-emerald-800"></div>
        </div>
      `;

      openModal(html);

      document.getElementById('btn-care-puzzle-close')?.addEventListener('click', closeModal);

      document.querySelectorAll('.btn-tile-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tileId = parseInt(btn.getAttribute('data-tile-id'), 10);
          const found = puzzle.shuffledTiles.find((t) => t.id === tileId);
          if (found) {
            audioEngine.playCaptureTick?.();
            currentPlaced.push(found);
            renderPuzzle();
            checkCompletion();
          }
        });
      });

      document.querySelectorAll('.btn-placed-tile').forEach((btn) => {
        btn.addEventListener('click', () => {
          const placedIdx = parseInt(btn.getAttribute('data-placed-idx'), 10);
          audioEngine.playCaptureTick?.();
          currentPlaced.splice(placedIdx, 1);
          renderPuzzle();
        });
      });
    };

    const checkCompletion = () => {
      if (currentPlaced.length < puzzle.correctTokens.length) return;

      const isCorrect = currentPlaced.every((t, i) => t.id === i);
      const feedbackEl = document.getElementById('care-puzzle-feedback');

      if (isCorrect) {
        if (feedbackEl) {
          feedbackEl.className = 'text-center min-h-[22px] text-xs font-black text-emerald-800 animate-bounce';
          feedbackEl.textContent = '🎉 정답입니다! 문장 완성!';
        }
        audioEngine.playCorrect?.();
        if (typeof audioEngine.speakWordOnce === 'function') {
          audioEngine.speakWordOnce(puzzle.fullSentence, null, puzzle.lang);
        }

        window.CareSentenceBuilder.submitCarePuzzleResult(careType, true);
        if (typeof settingsStore !== 'undefined' && settingsStore.saveCurrentProfile) {
          settingsStore.saveCurrentProfile();
        }

        const happyMsg = careType === 'food' ? '냠냠! 너무 맛있어요 🐾💕' : careType === 'water' ? '꿀꺽꿀꺽! 시원해요 💧✨' : '화장실 청소 완료! 상쾌해요 💩✨';
        triggerDogHappyReaction(null, happyMsg);

        setTimeout(() => {
          closeModal();
          renderBattleTab();
          refreshHeader();
        }, 1500);
      } else {
        if (feedbackEl) {
          feedbackEl.className = 'text-center min-h-[22px] text-xs font-black text-rose-600 animate-shake';
          feedbackEl.textContent = '순서가 맞지 않습니다! 다시 시도해 보세요.';
        }
        audioEngine.playWrong?.();
        setTimeout(() => {
          currentPlaced = [];
          renderPuzzle();
        }, 800);
      }
    };

    renderPuzzle();
  }

  function openWalkModal() {
    const remainingSec = getWalkRemainingSeconds();
    if (remainingSec > 0) {
      const stage = document.getElementById('lobby-hero-stage');
      if (stage) {
        const bubble = document.createElement('div');
        bubble.className = 'walk-limit-bubble absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1f2d24]/90 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg pointer-events-none whitespace-nowrap z-30 animate-bounce';
        bubble.textContent = `산책 쿨타임 중! ${remainingSec}초 후 가능 🐾`;
        stage.appendChild(bubble);
        setTimeout(() => bubble.remove(), 1800);
      }
      return;
    }

    let walkStep = 1;
    let collectedCount = 0;
    const itemsToCollect = [
      { id: 'coin', name: '🪙 코인', collected: false },
      { id: 'cloth', name: '🧵 천조각', collected: false },
      { id: 'herb', name: '🌿 약초', collected: false },
    ];
    let quizBonus = false;
    let wipedPaws = [false, false, false, false];

    const prof = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : getSave();
    const lang = settingsStore?.activeLanguage || 'es';
    const recentWords = prof.careSystem?.recentLearnedWords || [];
    let quizWord = null;
    if (window.CareSentenceBuilder && typeof window.CareSentenceBuilder.findWordEntry === 'function') {
      const targetId = recentWords.length > 0 ? recentWords[recentWords.length - 1] : 1;
      quizWord = window.CareSentenceBuilder.findWordEntry(targetId, lang);
    }
    if (!quizWord || !quizWord.word) {
      quizWord = lang === 'es'
        ? { word: 'parque', meaning: '공원', phonetic: '[파르케]' }
        : { word: 'park', meaning: '공원', phonetic: '/pɑrk/' };
    }

    const renderStep = () => {
      if (walkStep === 1) {
        const html = `
          <div class="p-4 sm:p-5 flex flex-col gap-3 relative select-none">
            <button id="btn-walk-close" type="button" class="absolute top-3 right-3 text-[#5c6e60] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
            <div class="text-center">
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-black text-xs">
                <span>🚶 동네 산책 (1/3)</span>
              </div>
              <p class="text-xs text-[#5c6e60] font-bold mt-1">길가에 떨어진 보급품 3개를 모두 탭해 주워 담으세요!</p>
            </div>

            <div class="relative w-full h-36 rounded-2xl bg-gradient-to-b from-sky-200 via-emerald-100 to-amber-100 border-2 border-emerald-600/30 overflow-hidden flex items-end justify-around pb-3 shadow-inner">
              <div class="absolute top-2 left-3 text-xl opacity-70 animate-pulse">☁️</div>
              <div class="absolute top-3 right-5 text-xl opacity-70">🌳</div>
              <div class="absolute bottom-2 left-4 text-3xl animate-bounce">🐕</div>

              ${itemsToCollect.map((item, idx) => `
                <button type="button" data-item-idx="${idx}" class="btn-gather-item ${item.collected ? 'opacity-20 scale-75 pointer-events-none' : 'animate-bounce hover:scale-110 active:scale-95'} p-2 rounded-2xl bg-white/90 border-2 border-amber-400 shadow-md flex flex-col items-center justify-center cursor-pointer transition">
                  <span class="text-2xl">${item.name.split(' ')[0]}</span>
                  <span class="text-[10px] font-black text-[#1f2d24]">${item.name.split(' ')[1]}</span>
                </button>
              `).join('')}
            </div>

            <div class="text-center text-xs font-black text-emerald-800">
              수집 현황: ${collectedCount} / 3
            </div>

            <button id="btn-walk-next-step" type="button" class="${collectedCount >= 3 ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-gray-200 text-gray-400 pointer-events-none'} w-full py-2.5 rounded-xl font-black text-xs shadow transition cursor-pointer">
              ${collectedCount >= 3 ? '공원 쉼터로 이동 ➔' : '보급품을 모두 수집하세요'}
            </button>
          </div>
        `;
        openModal(html);
        document.getElementById('btn-walk-close')?.addEventListener('click', closeModal);
        document.querySelectorAll('.btn-gather-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-item-idx'), 10);
            if (!itemsToCollect[idx].collected) {
              itemsToCollect[idx].collected = true;
              collectedCount++;
              audioEngine.playCaptureTick?.();
              renderStep();
            }
          });
        });
        document.getElementById('btn-walk-next-step')?.addEventListener('click', () => {
          if (collectedCount >= 3) {
            walkStep = 2;
            renderStep();
          }
        });
      } else if (walkStep === 2) {
        const distractors = lang === 'es'
          ? ['친구', '물', '음식', '안녕', '감사']
          : ['friend', 'water', 'food', 'hello', 'thanks'];
        const wrongChoices = distractors.filter((d) => d !== quizWord.meaning).slice(0, 3);
        const choices = [...wrongChoices, quizWord.meaning].sort(() => Math.random() - 0.5);

        const html = `
          <div class="p-4 sm:p-5 flex flex-col gap-3 relative select-none">
            <button id="btn-walk-close" type="button" class="absolute top-3 right-3 text-[#5c6e60] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
            <div class="text-center">
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-black text-xs">
                <span>🌳 쉼터 퀴즈 (2/3)</span>
              </div>
              <p class="text-xs text-[#5c6e60] font-bold mt-1">벤치에서 쉬며 단어 퀴즈를 풀고 보너스 코인을 받으세요!</p>
            </div>

            <div class="rounded-2xl bg-[#faf6ee] border-2 border-emerald-600/30 p-4 text-center shadow-sm">
              <div class="text-xs font-black text-emerald-800">이 단어의 알맞은 뜻은?</div>
              <div class="flex items-center justify-center gap-2 mt-1">
                <span class="text-xl font-black text-[#1f2d24]">${quizWord.word}</span>
                <button id="btn-quiz-audio" type="button" class="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 cursor-pointer">🔊</button>
              </div>
              ${quizWord.phonetic ? `<div class="text-xs text-[#5c6e60] font-mono mt-0.5">${quizWord.phonetic}</div>` : ''}
            </div>

            <div class="grid grid-cols-2 gap-2" id="quiz-choices-grid">
              ${choices.map((c) => `
                <button type="button" data-choice="${c}" class="btn-walk-quiz-choice py-2.5 px-2 rounded-xl bg-white hover:bg-emerald-50 border border-[#d2c8b4] font-black text-xs text-[#1f2d24] shadow-xs active:scale-95 transition cursor-pointer">
                  ${c}
                </button>
              `).join('')}
            </div>

            <div id="walk-quiz-feedback" class="text-center min-h-[20px] text-xs font-black text-emerald-800"></div>

            <button id="btn-walk-to-return" type="button" class="hidden w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow transition cursor-pointer">
              집으로 귀가하기 ➔
            </button>
          </div>
        `;
        openModal(html);
        document.getElementById('btn-walk-close')?.addEventListener('click', closeModal);
        document.getElementById('btn-quiz-audio')?.addEventListener('click', () => {
          if (typeof audioEngine.speakWordOnce === 'function') {
            audioEngine.speakWordOnce(quizWord.word, null, lang);
          }
        });

        document.querySelectorAll('.btn-walk-quiz-choice').forEach((btn) => {
          btn.addEventListener('click', () => {
            const chosen = btn.getAttribute('data-choice');
            const isRight = chosen === quizWord.meaning;
            const feedback = document.getElementById('walk-quiz-feedback');
            const returnBtn = document.getElementById('btn-walk-to-return');

            document.querySelectorAll('.btn-walk-quiz-choice').forEach((b) => {
              b.classList.add('pointer-events-none');
              if (b.getAttribute('data-choice') === quizWord.meaning) {
                b.className = 'btn-walk-quiz-choice py-2.5 px-2 rounded-xl bg-emerald-100 border-2 border-emerald-500 font-black text-xs text-emerald-900 shadow';
              }
            });

            if (isRight) {
              quizBonus = true;
              audioEngine.playCorrect?.();
              if (feedback) feedback.textContent = '🎉 정답입니다! 보너스 +10 코인 획득!';
            } else {
              btn.className = 'btn-walk-quiz-choice py-2.5 px-2 rounded-xl bg-rose-100 border-2 border-rose-400 font-black text-xs text-rose-900 shadow';
              audioEngine.playWrong?.();
              if (feedback) feedback.textContent = `아쉬워요! 정답은 "${quizWord.meaning}" 입니다.`;
            }

            returnBtn?.classList.remove('hidden');
            returnBtn?.addEventListener('click', () => {
              walkStep = 3;
              renderStep();
            });
          });
        });
      } else if (walkStep === 3) {
        const pawNames = ['앞왼발', '앞오른발', '뒤왼발', '뒤오른발'];
        const allWiped = wipedPaws.every(Boolean);

        const html = `
          <div class="p-4 sm:p-5 flex flex-col gap-3 relative select-none">
            <button id="btn-walk-close" type="button" class="absolute top-3 right-3 text-[#5c6e60] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
            <div class="text-center">
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 font-black text-xs">
                <span>🏡 귀가 완료 (3/3)</span>
              </div>
              <p class="text-xs text-[#5c6e60] font-bold mt-1">산책 후엔 깨끗하게! 강아지 발 4개를 톡톡 닦아주세요 🐾</p>
            </div>

            <div class="grid grid-cols-2 gap-3 max-w-[240px] mx-auto py-2">
              ${wipedPaws.map((wiped, idx) => `
                <button type="button" data-paw-idx="${idx}" class="btn-wipe-paw ${wiped ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300 text-amber-950 scale-95' : 'bg-white hover:bg-amber-50 border-[#d2c8b4] text-[#1f2d24] animate-pulse'} py-3 px-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition cursor-pointer">
                  <span class="text-2xl">${wiped ? '✨' : '🐾'}</span>
                  <span class="text-[11px] font-black">${pawNames[idx]} ${wiped ? '깨끗!' : '닦기'}</span>
                </button>
              `).join('')}
            </div>

            ${allWiped ? `
              <div class="rounded-2xl bg-emerald-50 border-2 border-emerald-400 p-3 text-center shadow-sm">
                <div class="text-xs font-black text-emerald-900">🎉 산책 대성공! 보상 획득</div>
                <div class="flex items-center justify-center gap-2 mt-1.5 text-xs font-extrabold text-[#1f2d24]">
                  <span>🪙 +${30 + (quizBonus ? 10 : 0)}</span>
                  <span>·</span>
                  <span>🧵 천 +1</span>
                  <span>·</span>
                  <span>🌿 약초 +1</span>
                  <span>·</span>
                  <span class="text-rose-700">💉 치료 +3%</span>
                </div>
              </div>
            ` : ''}

            <button id="btn-walk-finish" type="button" class="${allWiped ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-gray-200 text-gray-400 pointer-events-none'} w-full py-2.5 rounded-xl font-black text-xs shadow transition cursor-pointer">
              ${allWiped ? '산책 완료!' : '발 4개를 모두 닦아주세요'}
            </button>
          </div>
        `;
        openModal(html);
        document.getElementById('btn-walk-close')?.addEventListener('click', closeModal);

        document.querySelectorAll('.btn-wipe-paw').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-paw-idx'), 10);
            if (!wipedPaws[idx]) {
              wipedPaws[idx] = true;
              audioEngine.playCaptureTick?.();
              renderStep();
            }
          });
        });

        document.getElementById('btn-walk-finish')?.addEventListener('click', () => {
          if (!allWiped) return;

          const earnedGold = 30 + (quizBonus ? 10 : 0);
          if (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile) {
            const curProf = settingsStore.getCurrentProfile();
            curProf.gold = (curProf.gold || 0) + earnedGold;
            if (!curProf.materials) curProf.materials = { cloth: 0, parts: 0, bandage: 0, herb: 0 };
            curProf.materials.cloth = (curProf.materials.cloth || 0) + 1;
            curProf.materials.herb = (curProf.materials.herb || 0) + 1;
            if (!curProf.ownerState) curProf.ownerState = { recoveryStage: 1, cureProgress: 0 };
            curProf.ownerState.cureProgress = Math.min(100, (curProf.ownerState.cureProgress || 0) + 3);
            if (!curProf.careSystem) curProf.careSystem = {};
            curProf.careSystem.lastWalkTime = Date.now();
            settingsStore.saveCurrentProfile();
          }

          audioEngine.playCorrect?.();
          triggerDogHappyReaction(null, '산책 다녀왔어요! 깨끗하고 상쾌해요 🐾✨');
          closeModal();
          renderBattleTab();
          refreshHeader();
        });
      }
    };

    renderStep();
  }

  function drawOutpostOwner(ctx, { x, y, scale = 1.95, recoveryStage = 1, time = 0, isSitting = false }) {
    ctx.save();
    ctx.translate(x, y);

    const s = scale;
    const breathe = Math.sin(time / 450) * 1.5;

    // 1. 바닥 타원 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 주인 자세 (회복 단계 1~5 연동)
    if (recoveryStage === 1) {
      // Ch.1: 다리를 다쳐 붕대를 감고 회복 중 (생존 배낭 + 짝짝이 양말 + 이마 붕대)
      const sitOffset = isSitting ? 5 : 0;

      // 생존 배낭 (뒤)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-13 * s, (-9 + sitOffset + breathe * 0.4) * s, 8.5 * s, 14 * s, 3) : ctx.rect(-13 * s, (-9 + sitOffset) * s, 8.5 * s, 14 * s);
      ctx.fill();

      // 환자복 티셔츠 몸통
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, (2 + sitOffset + breathe * 0.6) * s, 8 * s, 10.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 다리 & 양말
      ctx.fillStyle = '#10b981'; // 녹색 양말
      ctx.fillRect(-5.5 * s, (10 + sitOffset) * s, 3.5 * s, 5 * s);
      ctx.fillStyle = '#f59e0b'; // 노란 줄무늬 양말
      ctx.fillRect(2 * s, (10 + sitOffset) * s, 3.5 * s, 5 * s);

      // 머리 & 얼굴
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, (-9 + sitOffset + breathe * 0.8) * s, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 이마 붕대
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-7 * s, (-12 + sitOffset + breathe * 0.8) * s, 14 * s, 2.5 * s);

      // 갈색 머리카락
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, (-10.5 + sitOffset + breathe * 0.8) * s, 7.5 * s, Math.PI, Math.PI * 2);
      ctx.fill();

      // 눈웃음
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-2.5 * s, (-8 + sitOffset + breathe * 0.8) * s, 1.2 * s, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2.5 * s, (-8 + sitOffset + breathe * 0.8) * s, 1.2 * s, 0, Math.PI);
      ctx.stroke();
    } else if (recoveryStage === 2) {
      // Ch.2: 구부정한 자세에서 회복 중 (후드티)
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.ellipse(0, (3 + breathe * 0.6) * s, 9 * s, 10 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.fillRect(-5.5 * s, 11 * s, 3.5 * s, 6.5 * s);
      ctx.fillRect(1.5 * s, 11 * s, 3.5 * s, 6.5 * s);

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(2 * s, (-7.5 + breathe * 0.8) * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(2 * s, (-9 + breathe * 0.8) * s, 7 * s, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      // Ch.3~5: 건강하게 서서 파트너와 함께하는 주인
      ctx.fillStyle = recoveryStage >= 5 ? '#d97706' : recoveryStage === 4 ? '#f8fafc' : '#065f46';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-7.5 * s, (-4 + breathe * 0.4) * s, 15 * s, 16 * s, 3.5) : ctx.rect(-7.5 * s, -4 * s, 15 * s, 16 * s);
      ctx.fill();

      ctx.fillStyle = '#1e40af';
      ctx.fillRect(-5.5 * s, 11 * s, 4 * s, 6.5 * s);
      ctx.fillRect(1 * s, 11 * s, 4 * s, 6.5 * s);

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, (-10 + breathe * 0.8) * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, (-12 + breathe * 0.8) * s, 7 * s, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();
    }

    // 머리 위 미니 라벨: "주인 민우 (치료 중)"
    ctx.fillStyle = 'rgba(27, 59, 43, 0.88)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-24 * s, -22 * s, 48 * s, 9 * s, 3) : ctx.rect(-24 * s, -22 * s, 48 * s, 9 * s);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = `bold ${Math.round(6 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(recoveryStage <= 2 ? '주인 (치료 중)' : '주인 (회복)', 0, -15.5 * s);

    ctx.restore();
  }

  function renderHeroPreview() {
    const canvas = document.getElementById('lobby-hero-canvas');
    if (!canvas) return;
    const save = getSave();
    const curBreedId = save.selectedBreed || 'pomeranian';
    const now = Date.now();
    const isHappy = now < happyUntil;

    // Smooth lerp for Look-At
    petStageState.currentLookX += (petStageState.targetLookX - petStageState.currentLookX) * 0.15;
    petStageState.currentLookY += (petStageState.targetLookY - petStageState.currentLookY) * 0.15;

    const dogWrapper = document.getElementById('stage-dog-wrapper');
    if (dogWrapper && !petStageState.isSpinning) {
      const offsetX = petStageState.currentLookX * 6;
      const offsetY = petStageState.currentLookY * 4;
      const rot = petStageState.currentLookX * 2.5;
      dogWrapper.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rot}deg)`;
    }

    // 1. 강아지 렌더링 (하네스 착용, 무대 우측 배치)
    renderDogToCanvas(canvas, {
      save,
      breedId: curBreedId,
      scale: 2.35,
      x: canvas.width * 0.65,
      y: canvas.height / 2 + 18,
      isHappy,
      time: now,
      companions: (save.companions?.active || []).slice(0, MAX_SUPPORTERS),
      withEquipment: true,
      withWeapon: true,
    });

    // 2. 동반 주인 렌더링 (회복 중인 주인, 무대 좌측 배치)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
        ? settingsStore.getCurrentProfile()
        : save;
      const recoveryStage = profile.ownerState?.recoveryStage || Math.min(5, Math.floor(((save.maxUnlockedUnit || 1) - 1) / 30) + 1);
      drawOutpostOwner(ctx, {
        x: canvas.width * 0.28,
        y: canvas.height / 2 + 10,
        scale: 1.95,
        recoveryStage,
        time: now,
        isSitting: recoveryStage === 1,
      });
    }

    const isTracking = Math.abs(petStageState.targetLookX - petStageState.currentLookX) > 0.01 ||
                       Math.abs(petStageState.targetLookY - petStageState.currentLookY) > 0.01;

    if ((isHappy || isTracking || activeTab === 'battle') && typeof window !== 'undefined' && window.requestAnimationFrame) {
      happyAnimFrameId = requestAnimationFrame(renderHeroPreview);
    }
  }

  function setupPetStageInteractions({ curBreedId, handlePetClick, refreshHeader }) {
    const stage = document.getElementById('lobby-hero-stage');
    const bg = document.getElementById('stage-parallax-bg');
    const dogWrapper = document.getElementById('stage-dog-wrapper');
    if (!stage) return;

    const onPointerMove = (clientX, clientY) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const nx = (relX - 0.5) * 2;
      const ny = (relY - 0.5) * 2;

      petStageState.targetLookX = nx;
      petStageState.targetLookY = ny;

      if (bg) {
        bg.style.transform = `translate3d(${-nx * 8}px, ${-ny * 6}px, 0)`;
      }

      if (typeof window !== 'undefined' && window.requestAnimationFrame && !happyAnimFrameId) {
        happyAnimFrameId = requestAnimationFrame(renderHeroPreview);
      }
    };

    stage.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    stage.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    stage.addEventListener('mouseleave', () => {
      petStageState.targetLookX = 0;
      petStageState.targetLookY = 0;
      if (bg) bg.style.transform = 'translate3d(0, 0, 0)';
      if (typeof window !== 'undefined' && window.requestAnimationFrame && !happyAnimFrameId) {
        happyAnimFrameId = requestAnimationFrame(renderHeroPreview);
      }
    });

    let lastTapTime = 0;
    stage.addEventListener('click', (e) => {
      if (e.target.closest('#pet-action-badge') || e.target.closest('#care-bubble-head') || e.target.closest('#care-floor-poop')) {
        return;
      }

      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime;
      lastTapTime = now;

      // 더블탭: 360도 회전 ("돌아!")
      if (timeSinceLastTap < 380) {
        if (dogWrapper && !petStageState.isSpinning) {
          petStageState.isSpinning = true;
          dogWrapper.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
          dogWrapper.style.transform = 'rotate(360deg)';
          setTimeout(() => {
            if (dogWrapper) {
              dogWrapper.style.transition = '';
              dogWrapper.style.transform = 'rotate(0deg)';
            }
            petStageState.isSpinning = false;
          }, 620);
        }
        audioEngine.playHappyBark?.();
        triggerDogHappyReaction(stage, '빙글빙글 턴! 나 멋지지 멍? ✨');
        addAffection?.(curBreedId, 2);
        refreshHeader?.();
        return;
      }

      // 탭 위치 확인: 앞발 vs 머리/몸통
      const rect = stage.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const isPawArea = relY > 0.62 && relX > 0.42 && relX < 0.78;

      if (isPawArea) {
        // 앞발 부위 터치: 하이파이브 "손!"
        if (dogWrapper) {
          dogWrapper.style.transition = 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
          dogWrapper.style.transform = 'translateY(-12px) rotate(6deg)';
          setTimeout(() => {
            if (dogWrapper) {
              dogWrapper.style.transform = 'translateY(0) rotate(0deg)';
            }
          }, 250);
        }
        audioEngine.playHappyBark?.();
        triggerDogHappyReaction(stage, '앞발 척! 하이파이브 성공이다 멍! 🐾');
        addAffection?.(curBreedId, 2);
        refreshHeader?.();
      } else {
        // 머리/몸통 터치: 탄성 스쿼시&스트레치 + 쓰다듬기
        if (dogWrapper) {
          dogWrapper.style.transition = 'transform 0.12s ease-out';
          dogWrapper.style.transform = 'scale(1.15, 0.85)';
          setTimeout(() => {
            if (dogWrapper) {
              dogWrapper.style.transform = 'scale(0.9, 1.1)';
              setTimeout(() => {
                if (dogWrapper) {
                  dogWrapper.style.transform = 'scale(1, 1)';
                }
              }, 120);
            }
          }, 120);
        }
        handlePetClick(e);
      }
    });
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

      const avatarIcon = save.profileAvatarIcon || curBreed.icon || '🐶';
      evoBadge.innerHTML = `
        <span class="text-xl select-none leading-none">${avatarIcon}</span>
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
    } else if (activeTab === 'compendium' || activeTab === 'journey') {
      renderCompendiumTab();
    }
  }

  function renderBattleTab() {
    ensureDailyReset();
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

    // 스테이지는 순차 돌파 전용: 클리어한 과거 스테이지만 복습·파밍 이동 가능, 미개방 다음 스테이지는 잠금
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

    battlePanel.className = 'flex flex-col justify-between h-full py-1 overflow-hidden';
    battlePanel.innerHTML = `
      <!-- 오픈 스테이지 히어로 영역 (상단 좌우 기능 버튼 + 중앙 수호견 오픈 스테이지) -->
      <div class="flex-1 flex flex-col justify-start relative pt-1">
        <!-- 상단 고정 좌우 사이드 버튼 행 (상단 녹색 헤더 바로 아래) -->
        <div class="w-full flex items-start justify-between pointer-events-none z-10 px-0.5">
          <!-- 좌측 상단 (프로필 위젯 바로 아래): 📜 퀘스트 -> 🪂 보급품 -> 🧟 주인·동료 -->
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

<!-- 하단 무대 영역: 2.5D 인터랙티브 펫 스테이지 (수호견 + 동반 주인) -->
        <div id="lobby-hero-profile-card" class="flex flex-col items-center justify-center text-center mt-auto mb-1 pointer-events-auto w-full max-w-[285px] mx-auto">
          <!-- 2.5D 인터랙티브 펫 스테이지 -->
          <div id="lobby-hero-stage" class="relative group select-none overflow-hidden rounded-2xl w-[270px] h-[166px] border border-emerald-600/30 shadow-[0_4px_20px_rgba(45,106,79,0.18)] cursor-pointer" style="perspective: 600px;" title="탭하여 교감 (더블탭: 돌아!, 앞발: 손!)">
            <!-- 배경 시차 레이어 (거점 테마 배경) -->
            <div id="stage-parallax-bg" class="absolute inset-[-14px] bg-gradient-to-b from-emerald-900/10 via-amber-500/5 to-emerald-800/15 pointer-events-none transition-transform duration-100 ease-out rounded-2xl" style="background-image: radial-gradient(circle at 50% 30%, rgba(52,211,153,0.18), transparent 70%);"></div>

            <!-- 캔버스 래퍼 (스쿼시/스트레치, 회전, 시선 추적 반응) -->
            <div id="stage-dog-wrapper" class="relative w-full h-full flex items-center justify-center transition-transform duration-150 ease-out origin-bottom">
              <canvas id="lobby-hero-canvas" width="270" height="166" class="w-full h-full block"></canvas>
            </div>

            <!-- 상황별 플로팅 케어 말풍선 (hunger < 80 또는 thirst < 80 일 때만 노출) -->
            ${(hungerPct < 80 || thirstPct < 80) ? `
              <button id="care-bubble-head" type="button" data-care-type="${hungerPct < 80 ? 'food' : 'water'}" class="absolute top-2 left-1/2 -translate-x-1/2 bg-white/95 text-emerald-950 border-2 border-amber-400 font-black text-xs px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce z-20 cursor-pointer active:scale-95" title="탭하여 케어 퍼즐 풀기">
                <span>${hungerPct < 80 ? '🍖 밥 줘!' : '💧 목말라!'}</span>
              </button>
            ` : ''}

            <!-- 상황별 바닥 똥 아이콘 (poopCount > 0 일 때만 노출) -->
            ${poopCount > 0 ? `
              <button id="care-floor-poop" type="button" class="absolute bottom-2 right-3 bg-amber-100/95 text-amber-950 border border-amber-400 font-black text-xs px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse z-20 cursor-pointer active:scale-95" title="탭하여 응가 치우기">
                <span>💩</span>
                <span class="text-[10px] font-black">${poopCount}</span>
              </button>
            ` : ''}

            <!-- 우측 상단 쓰다듬기 배지 -->
            <button id="pet-action-badge" type="button" class="${petBadgeClass}" title="우유 쓰다듬기 (터치하여 교감)">
              ${petBadgeInner}
            </button>
          </div>

          <!-- 초슬림 스탯/요약 바 -->
          <div class="w-full flex flex-col items-center gap-0.5 mt-1 px-1">
            <!-- 케어 수치 & 컨디션 버프 단일 행 -->
            <div class="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[#1f2d24] bg-[#faf6ee] px-2.5 py-0.5 rounded-full border border-[#d2c8b4] shadow-xs">
              <span>🍖 ${hungerPct}%</span>
              <span class="text-[#a3b899]">·</span>
              <span>💧 ${thirstPct}%</span>
              <span class="text-[#a3b899]">·</span>
              <span>💩 ${poopCount}개</span>
              ${wellCaredBuff ? `
                <span class="text-[#a3b899]">·</span>
                <span class="text-emerald-800 font-black">🥰 최상 컨디션</span>
              ` : ''}
            </div>

            <!-- 현재 선택된 견종 & 친밀도 & 이름표 (정중앙 정렬) -->
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

            <!-- 친밀도 미니 게이지 바 -->
            <div class="w-full h-1 rounded-full bg-[#e6dec8] overflow-hidden shadow-inner" title="친밀도: ${aff.levelXp}/${aff.targetXp} XP">
              <div id="lobby-affection-bar" class="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-300" style="width: ${Math.round(aff.ratio * 100)}%"></div>
            </div>

            <!-- 핵심 4종 스탯 (전투력 · 공격력 · 체력 · 이동속도) -->
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
      const isOnboardingPet = !cur.lobbyTourCompleted && cur.onboardingStep === 3;

      // 튜토리얼 3단계 쓰다듬기 시에는 친밀도 게이지가 눈에 띄게 쑥 차오르도록 25점 부여
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
    document.getElementById('btn-stage-hero-name')?.addEventListener('click', openProfileModal);
    document.getElementById('care-bubble-head')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = e.currentTarget.getAttribute('data-care-type') || 'food';
      openCarePuzzleModal(type);
    });

    document.getElementById('care-floor-poop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCarePuzzleModal('poop');
    });

    setupPetStageInteractions({
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
      btn.innerHTML = `<span>🎓</span> <span data-i18n="lobby.startTutorial">${t('lobby.startTutorial')}</span>`;
      btn.className = 'w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(217,119,6,0.4)] active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer animate-pulse';
    } else {
      btn.innerHTML = `<span>⚔️</span> <span data-i18n="lobby.startBattle">${t('lobby.startBattle')}</span>`;
      btn.className = 'w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-xs sm:text-sm shadow-[0_6px_20px_rgba(45,106,79,0.35)] active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer';
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

    // 튜토리얼 완료 후 첫 출격 시 (배치 테스트 미완료 시 자동 난이도 3목숨 배치 테스트 직행)
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
    openModal(`
      <div class="text-center py-4 space-y-3 select-none">
        <div class="w-16 h-16 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-3xl mx-auto shadow-sm">
          🦮
        </div>
        <div class="space-y-1">
          <h3 class="text-base font-black text-[#1f2d24]">산책 러너 모드 준비 중!</h3>
          <p class="text-xs text-[#5c6e60] font-bold leading-relaxed break-keep px-2">
            🦮 3레인 산책 러너 모드 준비 중! 곧 강아지와 함께 달릴 수 있어요.
          </p>
        </div>
        <div class="pt-2">
          <button id="btn-close-walk-notice" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-white font-black text-xs active:scale-95 transition cursor-pointer">
            확인
          </button>
        </div>
      </div>
    `);
    document.getElementById('btn-close-walk-notice')?.addEventListener('click', closeModal);
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


  function renderCompendiumTab() {
    const compPanel = tabPanels.compendium || tabPanels.journey;
    if (!compPanel) return;

    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const lang = (typeof settingsStore !== 'undefined' && settingsStore.get ? settingsStore.get('activeLanguage') : null) || save.studyLang || 'es';
    const maxUnlocked = save.maxUnlockedUnit || 1;

    const care = profile.careSystem || save.careSystem || {};
    const rawLearned = Array.isArray(care.recentLearnedWords) ? care.recentLearnedWords : [];
    const rawWrong = Array.isArray(care.wrongAnswerQueue) ? care.wrongAnswerQueue : [];

    const resolveEntry = (item) => {
      if (!item) return null;
      if (typeof item === 'object' && item.word && item.meaning) return item;
      const wid = typeof item === 'object' ? item.id : item;
      if (typeof window !== 'undefined' && window.CareSentenceBuilder?.findWordEntry) {
        const f = window.CareSentenceBuilder.findWordEntry(wid, lang);
        if (f) return f;
      }
      return { id: wid, word: String(wid), meaning: '해독된 암호', phonetic: '' };
    };

    let learnedWords = rawLearned.map(resolveEntry).filter(Boolean);
    if (learnedWords.length === 0) {
      const allWords = (typeof window !== 'undefined' && window.CareSentenceBuilder?.getWordList)
        ? window.CareSentenceBuilder.getWordList(lang)
        : [];
      learnedWords = allWords.slice(0, 15);
    }
    const wrongWords = rawWrong.map(resolveEntry).filter(Boolean);

    compPanel.className = 'p-3 max-w-md mx-auto space-y-3 select-none text-left';
    compPanel.innerHTML = `
      <!-- 상단 헤더 -->
      <div class="rounded-2xl bg-[#faf6ee] border-2 border-emerald-600/30 p-3 shadow-sm flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl leading-none">📖</span>
          <div>
            <h2 class="text-sm font-black text-[#1f2d24]">보카-큐어 서바이벌 대도감</h2>
            <p class="text-[10px] text-[#5c6e60] font-bold">생존 단어·장비·스킬·도감 마스터</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
          해독 ${learnedWords.length}단어
        </span>
      </div>

      <!-- 4개 서브탭 내비게이션 바 -->
      <div class="grid grid-cols-4 gap-1 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-center text-[10.5px] font-black">
        <button id="subtab-comp-words" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'words' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          🔤 단어장
        </button>
        <button id="subtab-comp-gear" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'gear' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          🦺 장비
        </button>
        <button id="subtab-comp-skills" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'skills' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          ⚡ 스킬
        </button>
        <button id="subtab-comp-chars" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'characters' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          🐾 도감
        </button>
      </div>

      <!-- 서브탭 1: 단어장 -->
      ${compendiumSubTab === 'words' ? `
        <div class="space-y-2.5">
          <!-- 상단 툴바: 필터 + 뜻 가리기 토글 -->
          <div class="flex items-center justify-between gap-1.5 flex-wrap">
            <div class="flex items-center gap-1">
              <button id="btn-words-filter-all" type="button" class="py-1 px-2.5 rounded-full text-xs font-black transition cursor-pointer ${wordsFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-white border border-[#d2c8b4] text-[#4a584e]'}">
                해독 단어 (${learnedWords.length})
              </button>
              <button id="btn-words-filter-wrong" type="button" class="py-1 px-2.5 rounded-full text-xs font-black transition cursor-pointer ${wordsFilter === 'wrong' ? 'bg-rose-600 text-white' : 'bg-white border border-[#d2c8b4] text-[#4a584e]'}">
                ⚠️ 오답 큐 (${wrongWords.length})
              </button>
            </div>
            <!-- 뜻 가리기 암기 모드 토글 -->
            <button id="btn-toggle-hide-meaning" type="button" class="py-1 px-2.5 rounded-full text-[11px] font-black border transition cursor-pointer flex items-center gap-1 ${hideMeaningMode ? 'bg-amber-600 border-amber-700 text-white shadow-xs' : 'bg-white border-[#d2c8b4] text-[#4a584e] hover:bg-amber-50'}">
              <span>${hideMeaningMode ? '🙈' : '👀'}</span>
              <span>뜻 가리기 ${hideMeaningMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <!-- 오답 집중 복습 출격 배너 -->
          <div class="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-600/15 border border-amber-400/40 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
                <span>⚔️</span>
                <span>오답 집중 복습 모드</span>
              </div>
              <div class="text-[10px] text-[#5c6e60] font-bold mt-0.5">틀린 단어만 집중 출제하여 정화합니다</div>
            </div>
            <button id="btn-start-wrong-review-battle" type="button" class="shrink-0 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-black shadow-md active:scale-95 transition cursor-pointer whitespace-nowrap">
              ⚔️ 오답 복습 출격
            </button>
          </div>

          <!-- 단어 카드 리스트 -->
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-0.5">
            ${(wordsFilter === 'all' ? learnedWords : wrongWords).length === 0 ? `
              <div class="p-6 text-center text-xs font-bold text-[#5c6e60] bg-[#faf6ee] rounded-2xl border border-[#d2c8b4]">
                ${wordsFilter === 'all' ? '아직 해독된 단어가 없습니다. 전투에서 벙커 해치를 열어보세요!' : '🎉 오답 큐가 비어있습니다! 완벽하게 마스터했어요!'}
              </div>
            ` : (wordsFilter === 'all' ? learnedWords : wrongWords).map((w, idx) => `
              <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-2xs flex items-center justify-between gap-2 transition hover:border-emerald-300">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-black text-[#1f2d24]">${w.word}</span>
                    ${w.phonetic ? `<span class="text-[10px] text-[#5c6e60] font-mono">${w.phonetic}</span>` : ''}
                  </div>
                  <div class="mt-0.5">
                    ${hideMeaningMode ? `
                      <span data-masked-meaning="${idx}" class="inline-block text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-100 px-2 py-0.5 rounded cursor-pointer select-none transition" title="터치하여 뜻 보기">
                        🙈 터치하여 뜻 확인
                      </span>
                      <span data-revealed-meaning="${idx}" class="hidden text-xs font-bold text-emerald-800">
                        ${w.meaning}
                      </span>
                    ` : `
                      <div class="text-xs font-bold text-emerald-800 truncate">${w.meaning}</div>
                    `}
                  </div>
                </div>
                <button type="button" data-tts-word="${w.word}" class="btn-play-tts shrink-0 w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 flex items-center justify-center text-sm shadow-xs active:scale-90 transition cursor-pointer" title="원어민 발음 듣기">
                  🔊
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 서브탭 2: 장비·아이템 -->
      ${compendiumSubTab === 'gear' ? `
        <div class="space-y-3">
          <!-- 1. 수호견 장비 라인업 -->
          <div class="space-y-1.5">
            <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1 px-1">
              <span>🦺</span>
              <span>수호견 장비 (하네스·조끼·부츠·스카프)</span>
            </h3>
            <div class="grid grid-cols-2 gap-2">
              ${(DOG_GEAR || []).map((g) => {
                const isOwned = (save.costumes?.owned || []).includes(g.id) || maxUnlocked >= (g.unlockStage || 1);
                return `
                  <div class="p-2.5 rounded-xl border flex flex-col justify-between ${isOwned ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'}">
                    <div class="flex items-start gap-2">
                      <div class="w-10 h-10 rounded-lg ${isOwned ? 'bg-emerald-100 border border-emerald-300' : 'bg-stone-200'} flex items-center justify-center text-xl shrink-0">
                        ${isOwned ? g.icon : '<span class="text-sm grayscale opacity-40">🔒</span>'}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-black text-[#1f2d24] truncate">${isOwned ? g.name : '???'}</div>
                        <div class="text-[9.5px] font-bold text-emerald-800">공+${g.atkBonus || 0} 체+${g.hpBonus || 0}</div>
                      </div>
                    </div>
                    <div class="text-[9px] font-medium text-[#5c6e60] mt-1.5 leading-snug">
                      ${isOwned ? g.desc : `STAGE ${g.unlockStage || 1} 클리어 시 해금`}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. 영양 간식 & 돌봄 아이템 -->
          <div class="space-y-1.5">
            <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1 px-1">
              <span>🍖</span>
              <span>영양 간식 & 돌봄 아이템</span>
            </h3>
            <div class="grid grid-cols-2 gap-2">
              ${(SNACKS || []).map((snk) => `
                <div class="p-2 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-xs flex items-center gap-2">
                  <span class="text-2xl">${snk.icon}</span>
                  <div class="min-w-0">
                    <div class="text-xs font-black text-[#1f2d24] truncate">${snk.name}</div>
                    <div class="text-[9.5px] text-emerald-800 font-bold">체력 +${snk.healHp}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 서브탭 3: 스킬 -->
      ${compendiumSubTab === 'skills' ? `
        <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
          <div class="text-xs font-black text-[#1f2d24] px-1 flex items-center gap-1">
            <span>🗣️</span>
            <span>강아지 액션 음파 & 야생 스킬</span>
          </div>
          ${(SKILLS || []).map((sk) => `
            <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-2xs space-y-1">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xl">${sk.icon}</span>
                  <div>
                    <span class="text-xs font-black text-[#1f2d24]">${sk.name}</span>
                    ${sk.awakenedName ? `<span class="ml-1 text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full border border-amber-300">각성: ${sk.awakenedName}</span>` : ''}
                  </div>
                </div>
                <span class="text-[10px] font-bold text-emerald-800">쿨 ${sk.cooldown || 1}s</span>
              </div>
              <p class="text-[10.5px] text-[#4a584e] font-medium leading-snug">${sk.desc}</p>
              ${sk.awakenedDesc ? `<p class="text-[9.5px] text-amber-800 font-bold bg-amber-50 p-1.5 rounded-lg border border-amber-200/60 leading-tight">✨ ${sk.awakenedDesc}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 서브탭 4: 수호견·동료·좀비 -->
      ${compendiumSubTab === 'characters' ? `
        <div class="space-y-2.5">
          <!-- 3단 세부 토글: 수호견 vs 보조 동료 vs 좀비 -->
          <div class="grid grid-cols-3 gap-1 p-0.5 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-center text-[10.5px] font-black">
            <button id="btn-char-subtab-breeds" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'breeds' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🐶 수호견 (12종)
            </button>
            <button id="btn-char-subtab-companions" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'companions' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🐾 동료 (12종)
            </button>
            <button id="btn-char-subtab-zombies" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'zombies' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🧟 좀비 & 보스
            </button>
          </div>

          <!-- 견종 12종 리스트 -->
          ${charSubTab === 'breeds' ? `
            <div class="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-0.5">
              ${(BREEDS || []).map((b) => {
                const isUnlocked = (save.unlockedBreeds || []).includes(b.id) || (b.id === (save.selectedBreed || 'pomeranian'));
                return `
                  <div class="p-2 rounded-xl border ${isUnlocked ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'}">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xl">${isUnlocked ? b.icon : '🔒'}</span>
                      <div class="min-w-0">
                        <div class="text-xs font-black text-[#1f2d24] truncate">${isUnlocked ? b.name : '???'}</div>
                        <div class="text-[9px] text-[#5c6e60] font-bold">${b.subName || ''}</div>
                      </div>
                    </div>
                    <div class="text-[9.5px] font-bold text-emerald-800 mt-1">${isUnlocked ? b.trait : `STAGE ${b.unlockStage} 해금`}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- 동료 12종 리스트 -->
          ${charSubTab === 'companions' ? `
            <div class="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-0.5">
              ${(COMPANIONS || []).map((c) => {
                const isUnlocked = (save.companions?.unlocked || []).includes(c.id) || maxUnlocked >= (c.unlockStage || 1);
                return `
                  <div class="p-2 rounded-xl border ${isUnlocked ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'}">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xl">${isUnlocked ? c.icon : '🔒'}</span>
                      <div class="min-w-0">
                        <div class="text-xs font-black text-[#1f2d24] truncate">${isUnlocked ? c.name : '???'}</div>
                        <div class="text-[9px] text-amber-800 font-bold">${c.mountType === 'ground' ? '지상 지원' : '탑승 지원'}</div>
                      </div>
                    </div>
                    <div class="text-[9px] font-bold text-emerald-800 mt-1">${isUnlocked ? c.buffText : `STAGE ${c.unlockStage} 해금`}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- 좀비 도감 -->
          ${charSubTab === 'zombies' ? `
            <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-0.5">
              ${[
                { name: '일반 보행 좀비', icon: '🧟', desc: '평범하지만 떼지어 몰려오는 감염자', danger: '★☆☆☆☆' },
                { name: '고깔 좀비', icon: '🪖', desc: '도로용 안전 고깔을 머리에 써 방어력 상승', danger: '★★☆☆☆' },
                { name: '질주 좀비', icon: '🏃', desc: '소리에 민첩하게 반응해 고속으로 달려듦', danger: '★★★☆☆' },
                { name: '양철통 좀비', icon: '🪣', desc: '단단한 양철통으로 머리를 보호하는 돌격병', danger: '★★★☆☆' },
                { name: '산성 침 좀비', icon: '🧪', desc: '원거리에서 위험한 산성 침을 뱉어냄', danger: '★★★☆☆' },
                { name: '자폭 폭탄 좀비', icon: '💣', desc: '체력이 다하면 폭발하여 주변에 피해를 입힘', danger: '★★★★☆' },
                { name: '럭비 미식축구 좀비', icon: '🏈', desc: '엄청난 체력과 빠른 스피드로 라인을 파괴', danger: '★★★★☆' },
                { name: '거대 가르강튀아', icon: '👹', desc: '전봇대를 휘두르는 전설의 거대 군단장', danger: '★★★★★' },
              ].map((zb) => `
                <div class="p-2 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-2xs flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-2xl">${zb.icon}</span>
                    <div>
                      <div class="text-xs font-black text-[#1f2d24]">${zb.name}</div>
                      <div class="text-[10px] text-[#5c6e60] font-medium">${zb.desc}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-rose-700 whitespace-nowrap">${zb.danger}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    // 서브탭 1: 단어장 관련 이벤트 바인딩
    document.getElementById('subtab-comp-words')?.addEventListener('click', () => {
      compendiumSubTab = 'words';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-gear')?.addEventListener('click', () => {
      compendiumSubTab = 'gear';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-skills')?.addEventListener('click', () => {
      compendiumSubTab = 'skills';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-chars')?.addEventListener('click', () => {
      compendiumSubTab = 'characters';
      renderCompendiumTab();
    });

    document.getElementById('btn-words-filter-all')?.addEventListener('click', () => {
      wordsFilter = 'all';
      renderCompendiumTab();
    });
    document.getElementById('btn-words-filter-wrong')?.addEventListener('click', () => {
      wordsFilter = 'wrong';
      renderCompendiumTab();
    });

    document.getElementById('btn-toggle-hide-meaning')?.addEventListener('click', () => {
      hideMeaningMode = !hideMeaningMode;
      renderCompendiumTab();
    });

    document.getElementById('btn-start-wrong-review-battle')?.addEventListener('click', () => {
      if (wrongWords.length === 0) {
        audioEngine.playCaptureTick?.();
        openModal(`
          <div class="text-center py-4 space-y-3">
            <div class="text-3xl">🎉</div>
            <h3 class="text-base font-black text-[#1f2d24]">오답 큐가 비어있습니다!</h3>
            <p class="text-xs text-[#5c6e60] font-bold leading-relaxed">
              모든 단어를 완벽하게 마스터하셨습니다. 일반 출격에서 새로운 단어에 도전해 보세요!
            </p>
            <div class="pt-2">
              <button id="btn-close-review-empty" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-black text-xs cursor-pointer">
                확인
              </button>
            </div>
          </div>
        `);
        document.getElementById('btn-close-review-empty')?.addEventListener('click', closeModal);
        return;
      }

      closeModal();
      onStartBattle?.({
        chapterNumber: 1,
        courseId: save.selectedCourse || 'lv1',
        unitId: save.selectedUnit || 'unit_001',
        isReview: true,
        targetUnitNum: 1,
      });
    });

    // 뜻 마스킹 해제 클릭 이벤트
    compPanel.querySelectorAll('[data-masked-meaning]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = el.getAttribute('data-masked-meaning');
        el.classList.add('hidden');
        const rev = compPanel.querySelector(`[data-revealed-meaning="${idx}"]`);
        if (rev) rev.classList.remove('hidden');
      });
    });

    // TTS 재생
    compPanel.querySelectorAll('.btn-play-tts').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wordText = btn.getAttribute('data-tts-word');
        if (wordText && typeof audioEngine.speakWordOnce === 'function') {
          audioEngine.speakWordOnce(wordText, null, lang);
        }
      });
    });

    // 캐릭터 도감 3단 서브탭
    document.getElementById('btn-char-subtab-breeds')?.addEventListener('click', () => {
      charSubTab = 'breeds';
      renderCompendiumTab();
    });
    document.getElementById('btn-char-subtab-companions')?.addEventListener('click', () => {
      charSubTab = 'companions';
      renderCompendiumTab();
    });
    document.getElementById('btn-char-subtab-zombies')?.addEventListener('click', () => {
      charSubTab = 'zombies';
      renderCompendiumTab();
    });
  }

  // 하위 호환 별칭
  const renderJourneyTab = renderCompendiumTab;

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
    openOwnerCompanionModal,
    openCarePuzzleModal,
    openWalkModal,
    renderCompendiumTab,
  };
}

