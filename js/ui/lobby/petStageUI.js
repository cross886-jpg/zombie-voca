/**
 * js/ui/lobby/petStageUI.js
 * 로비 2.5D 아웃포스트 캔버스 프리뷰(수호견 + 회복 중인 파트너),
 * 시선 추적/패럴랙스/터치 교감(쓰다듬기, 더블탭 회전, 앞발 하이파이브),
 * 행복 말풍선 및 케어 문장 퍼즐 모달 전담 모듈
 */

import { getSave, addAffection, MAX_SUPPORTERS } from '../../core/saveStore.js';
import { COMPANIONS } from '../../data/catalog.js';
import { audioEngine } from '../../core/audioEngine.js';
import { renderDogToCanvas } from '../../render/dogRenderer.js';
import { drawOwnerCharacter } from '../../render/ownerRenderer.js';
import settingsStore from '../../settingsStore.js';

export function createPetStageUI({
  openModal,
  closeModal,
  getActiveTab,
  onRefreshAll,
} = {}) {
  const petStageState = {
    targetLookX: 0,
    targetLookY: 0,
    currentLookX: 0,
    currentLookY: 0,
    isSpinning: false,
  };

  let happyUntil = 0;
  let happyAnimFrameId = null;

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

  function openCarePuzzleModal(careType = 'food') {
    if (!window.CareSentenceBuilder || typeof window.CareSentenceBuilder.buildCarePuzzle !== 'function') {
      console.warn('[petStageUI] CareSentenceBuilder not loaded');
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
          onRefreshAll?.();
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

  function renderHeroPreview() {
    const canvas = document.getElementById('lobby-hero-canvas');
    if (!canvas) return;
    const save = getSave();
    const curBreedId = save.selectedBreed || 'pomeranian';
    const now = Date.now();
    const isHappy = now < happyUntil;

    petStageState.currentLookX += (petStageState.targetLookX - petStageState.currentLookX) * 0.15;
    petStageState.currentLookY += (petStageState.targetLookY - petStageState.currentLookY) * 0.15;

    const dogWrapper = document.getElementById('stage-dog-wrapper');
    if (dogWrapper && !petStageState.isSpinning) {
      const offsetX = petStageState.currentLookX * 6;
      const offsetY = petStageState.currentLookY * 4;
      const rot = petStageState.currentLookX * 2.5;
      dogWrapper.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rot}deg)`;
    }

    // 1. 수호견 렌더링 (하네스 착용, 무대 우측 배치)
    renderDogToCanvas(canvas, {
      save,
      breedId: curBreedId,
      scale: 2.5,
      x: canvas.width * 0.65,
      y: canvas.height * 0.58,
      isHappy,
      time: now,
      companions: [],
      withEquipment: true,
      withWeapon: true,
    });

    const ctx = canvas.getContext('2d');
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;

    // 1-B. 브레멘 동행 친구들 탑승 대열 렌더링 (등 탑승 + 어깨/공중)
    if (ctx) {
      const compData = profile.companions || save.companions || {};
      const activeGroundId = compData.activeGround || save.companions?.active?.[0];
      const activeRiderId = compData.activeRider || (save.companions?.activeGround ? save.companions?.active?.[1] : null);
      const groundComp = COMPANIONS.find((c) => c.id === activeGroundId);
      const riderComp = COMPANIONS.find((c) => c.id === activeRiderId);

      const dogX = canvas.width * 0.65;
      const dogY = canvas.height * 0.58;

      // 등 탑승 친구
      if (groundComp) {
        ctx.save();
        const gx = dogX - 24;
        const gy = dogY - 10 + Math.sin(now * 0.005) * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(gx, gy + 11, 9, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(groundComp.icon, gx, gy);
        ctx.restore();
      }

      // 어깨/공중 친구
      if (riderComp) {
        ctx.save();
        const rx = dogX + 16;
        const ry = dogY - 32 + Math.sin(now * 0.007 + 1.2) * 2.8;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(rx, ry + 11, 8, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '19px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(riderComp.icon, rx, ry);
        ctx.restore();
      }
    }

    // 2. 동반 파트너 렌더링 (회복 중인 파트너, 무대 좌측 배치)
    if (ctx) {
      const recoveryStage = profile.ownerState?.recoveryStage || Math.min(5, Math.floor(((save.maxUnlockedUnit || 1) - 1) / 30) + 1);
      drawOwnerCharacter(ctx, {
        x: canvas.width * 0.28,
        y: canvas.height * 0.56,
        scale: 2.1,
        recoveryStage,
        time: now,
        isSitting: recoveryStage === 1,
        showLabel: true,
      });
    }

    const isTracking = Math.abs(petStageState.targetLookX - petStageState.currentLookX) > 0.01 ||
                       Math.abs(petStageState.targetLookY - petStageState.currentLookY) > 0.01;
    const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : 'battle';

    if ((isHappy || isTracking || activeTab === 'battle') && typeof window !== 'undefined' && window.requestAnimationFrame) {
      happyAnimFrameId = requestAnimationFrame(renderHeroPreview);
    }
  }

  function setupPetStageInteractions({ curBreedId, handlePetClick, refreshHeader }) {
    const stage = document.getElementById('lobby-hero-stage');
    const bg = document.getElementById('stage-parallax-bg');
    const dogWrapper = document.getElementById('stage-dog-wrapper');
    if (!stage) return;
    if (stage.dataset.stageBound === 'true') return;
    stage.dataset.stageBound = 'true';

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
      const isPawArea = relY > 0.52 && relY < 0.78 && relX > 0.42 && relX < 0.82;

      if (isPawArea) {
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

  return {
    triggerDogHappyReaction,
    openCarePuzzleModal,
    renderHeroPreview,
    setupPetStageInteractions,
  };
}
