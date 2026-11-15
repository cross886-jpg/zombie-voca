/**
 * js/ui/hudUI.js
 * 인게임 HUD(LED 전광판, 보스 3단 체력바, 4방향 네온 화살표, 플로팅 가상 조이스틱,
 * 레벨업 3지선다 모달, 일회용 필살기 버튼, 일시정지/게임오버/클리어 정산 모달) 제어
 */

import { BALANCE } from '../config/balance.js';
import { t } from '../data/i18n.js';
import { audioEngine } from '../core/audioEngine.js';
import { GAME_STATES } from '../game/gameEngine.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { clampIndicatorToThumbSafeZone, isMonolithOffscreen } from '../entities/monoliths.js';
import { WORD_LEVEL_TIERS } from '../core/courseEngine.js';

export function createHudUI(engine, { onReturnToLobby, onStartPath, onStartBattle, onOpenWordLevelSelect } = {}) {
  const hudLayer = document.getElementById('hud-layer');
  const modalLayer = document.getElementById('modal-layer');
  const modalCard = document.getElementById('modal-card');
  const canvas = document.getElementById('game-canvas');

  const btnPause = document.getElementById('btn-pause');

  const bossWrap = document.getElementById('hud-boss-bar-wrap');
  const bossName = document.getElementById('hud-boss-name');
  const bossLockText = document.getElementById('hud-boss-lock-text');
  const bossHpBar = document.getElementById('hud-boss-hp-bar');

  const ledScoreboard = document.getElementById('led-scoreboard');
  const ledWordText = document.getElementById('led-word-text');

  const hudUltVertFill = document.getElementById('hud-ult-vert-fill');
  const hudUltVertTrack = document.getElementById('hud-ult-vert-track');
  const hudUltVertIcon = document.getElementById('hud-ult-vert-icon');

  const edgeArrowsWrap = document.getElementById('edge-arrows');
  const hudLeftWidget = document.getElementById('hud-left-widget');
  const hudPlacementBadge = document.getElementById('hud-placement-badge');
  const hudPlacementText = document.getElementById('hud-placement-text');

  const hudTutorialCoach = document.getElementById('hud-tutorial-coach');
  const tutorialCoachStep = document.getElementById('tutorial-coach-step');
  const tutorialCoachCount = document.getElementById('tutorial-coach-count');
  const tutorialCoachText = document.getElementById('tutorial-coach-text');
  const btnTutorialCoachAck = document.getElementById('btn-tutorial-coach-ack');

  const tutorialGestureOverlay = document.getElementById('tutorial-gesture-overlay');
  const tutorialGestureDrag = document.getElementById('tutorial-gesture-drag');
  const tutorialGestureDoubleTap = document.getElementById('tutorial-gesture-doubletap');
  const tutorialScoreboardPointer = document.getElementById('tutorial-scoreboard-pointer');
  const hudUltActionWrap = document.getElementById('hud-ult-action-wrap');
  const btnHudUltCast = document.getElementById('btn-hud-ult-cast');
  const hudUltBtnLabel = document.getElementById('hud-ult-btn-label');

  const joystickEl = document.getElementById('virtual-joystick');
  const joystickKnob = document.getElementById('joystick-knob');

  const wrongReviewOverlay = document.getElementById('wrong-review-overlay');
  const wrongReviewWord = document.getElementById('wrong-review-word');
  const wrongReviewMeaning = document.getElementById('wrong-review-meaning');



  let currentWordText = '';
  let prevSkillStep = -1;
  let skillFlashTimer = null;
  let activePointerId = null;
  let joyOrigin = { x: 0, y: 0 };
  const JOY_MAX_RADIUS = 38;

  const keysDown = new Set();

  function showHud() {
    closeModal();
    resetJoystick();
    prevSkillStep = -1;
    hudLayer.classList.remove('hidden');
  }

  function hideHud() {
    closeModal();
    resetJoystick();
    prevSkillStep = -1;
    clearTimeout(skillFlashTimer);
    hudLayer.classList.add('hidden');
    edgeArrowsWrap.innerHTML = '';
    bossWrap.classList.add('hidden');
    wrongReviewOverlay?.classList.add('hidden');
    hudPlacementBadge?.classList.add('hidden');
    hudTutorialCoach?.classList.add('hidden');
    tutorialGestureOverlay?.classList.add('hidden');
    tutorialGestureDrag?.classList.add('hidden');
    tutorialGestureDoubleTap?.classList.add('hidden');
    tutorialScoreboardPointer?.classList.add('hidden');
    hudUltActionWrap?.classList.add('hidden');
    ledScoreboard?.classList.remove('tutorial-highlight-pulse');
    hudLeftWidget?.classList.remove('tutorial-highlight-pulse', 'border-amber-300', 'shadow-[0_0_16px_rgba(251,191,36,0.9)]');
    if (hudUltVertFill) {
      hudUltVertFill.style.height = '0%';
    }
  }

  function openModal(html) {
    modalCard.innerHTML = html;
    modalLayer.classList.remove('hidden');
  }

  function closeModal() {
    modalLayer.classList.add('hidden');
    modalCard.innerHTML = '';
  }

  // === 키보드(WASD / 방향키) + 플로팅 가상 조이스틱 ===
  function updateKeyboardVector() {
    if (activePointerId !== null) return;
    let kx = 0;
    let ky = 0;
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) kx -= 1;
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) kx += 1;
    if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) ky -= 1;
    if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) ky += 1;
    const len = Math.hypot(kx, ky);
    if (len > 0) {
      engine.setInputVector(kx / len, ky / len);
    } else {
      engine.setInputVector(0, 0);
    }
  }

  function resetJoystick() {
    activePointerId = null;
    keysDown.clear();
    joystickEl.classList.add('hidden');
    joystickKnob.style.transform = 'translate(0px, 0px)';
    engine.setInputVector(0, 0);
  }

  let lastTapTime = 0;

  function handlePointerDown(e) {
    if (engine.state !== GAME_STATES.PLAYING) return;
    if (e.target.closest('button') || e.target.closest('#led-scoreboard')) return;

    audioEngine.unlock();

    const now = performance.now();
    const timeDiff = now - lastTapTime;
    const isUltReady = engine.player && engine.player.ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE;

    if (isUltReady && timeDiff < 300 && timeDiff > 40) {
      lastTapTime = 0;
      resetJoystick();
      engine.useUltimate();
      return;
    }
    lastTapTime = now;

    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    joyOrigin = { x: e.clientX, y: e.clientY };

    joystickEl.style.left = `${e.clientX - 48}px`;
    joystickEl.style.top = `${e.clientY - 48}px`;
    joystickKnob.style.transform = 'translate(0px, 0px)';
    joystickEl.classList.remove('hidden');
  }

  function handlePointerMove(e) {
    if (e.pointerId !== activePointerId) return;
    if (engine.state !== GAME_STATES.PLAYING) {
      resetJoystick();
      return;
    }

    const dx = e.clientX - joyOrigin.x;
    const dy = e.clientY - joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(JOY_MAX_RADIUS, dist);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clamped;
    const knobY = Math.sin(angle) * clamped;
    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

    if (dist > 6) {
      const mag = clamped / JOY_MAX_RADIUS;
      engine.setInputVector(Math.cos(angle) * mag, Math.sin(angle) * mag);
    } else {
      engine.setInputVector(0, 0);
    }
  }

  function handlePointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    resetJoystick();
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  window.addEventListener('keydown', (e) => {
    if (engine.state !== GAME_STATES.PLAYING) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      keysDown.add(e.code);
      updateKeyboardVector();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keysDown.delete(e.code)) {
      updateKeyboardVector();
    }
  });

  // === 버튼 이벤트 ===
  btnPause?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (engine.state === GAME_STATES.PLAYING) {
      engine.pause();
    }
  });

  // 튜토리얼 코칭 배너 터치가 캔버스/뒤쪽 버튼으로 관통하지 않도록 이벤트 전파 차단
  ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach((evt) => {
    hudTutorialCoach?.addEventListener(evt, (e) => {
      e.stopPropagation();
    });
    btnTutorialCoachAck?.addEventListener(evt, (e) => {
      e.stopPropagation();
    });
  });

  btnTutorialCoachAck?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    resetJoystick();
    engine.acknowledgeTutorialStep2();
  });

  btnHudUltCast?.addEventListener('click', (e) => {
    e.stopPropagation();
    audioEngine.unlock();
    resetJoystick();
    engine.useUltimate();
  });

  ledScoreboard?.addEventListener('click', () => {
    if (currentWordText) {
      audioEngine.unlock();
      audioEngine.speakWordOnce(currentWordText);
    }
    if (engine.runStats?.isTutorial && engine.tutorial?.step === 2) {
      resetJoystick();
      engine.acknowledgeTutorialStep2();
    }
  });

  // === 4방향 네온 화살표 인디케이터 ===
  function renderEdgeArrows(edgeArrows, viewW, viewH) {
    if (!edgeArrows || edgeArrows.length === 0) {
      edgeArrowsWrap.innerHTML = '';
      return;
    }

    const playerScr = engine.camera?.worldToScreen
      ? engine.camera.worldToScreen(engine.player.x, engine.player.y, viewW, viewH)
      : { x: viewW / 2, y: viewH / 2 };

    const minX = 46;
    const maxXBound = viewW - 46;
    const topPadding = 138;
    const minY = topPadding;
    const maxYBound = engine.runStats?.isTutorial ? viewH - 134 : viewH - 78;

    // 레이-박스 교차 기준점(우유 화면 좌표)을 안전 영역 내로 클램프
    const ox = Math.max(minX + 1, Math.min(maxXBound - 1, playerScr.x));
    const oy = Math.max(minY + 1, Math.min(maxYBound - 1, playerScr.y));

    const isTutStep3 = Boolean(engine.runStats?.isTutorial && engine.tutorial?.step === 3);
    const htmlParts = [];
    for (const item of edgeArrows) {
      if (!item.outOfView || !isMonolithOffscreen(item.screenX, item.screenY, viewW, viewH)) continue;
      const dx = item.screenX - playerScr.x;
      const dy = item.screenY - playerScr.y;
      const angle = Math.atan2(dy, dx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // 우유 → 비석 방향 레이와 Safe Viewport 테두리 사각형의 정확한 교차점 계산
      const tx = cos > 0.0001 ? (maxXBound - ox) / cos : cos < -0.0001 ? (minX - ox) / cos : Infinity;
      const ty = sin > 0.0001 ? (maxYBound - oy) / sin : sin < -0.0001 ? (minY - oy) / sin : Infinity;
      const tHit = Math.min(tx, ty);

      const rawAx = Math.max(minX, Math.min(maxXBound, ox + cos * tHit));
      const rawAy = Math.max(minY, Math.min(maxYBound, oy + sin * tHit));
      const hand = getSave().dominantHand || 'right';
      const { x: ax, y: ay } = clampIndicatorToThumbSafeZone(rawAx, rawAy, viewW, viewH, hand);
      const deg = (angle * 180) / Math.PI + 90;
      const arrowDeg = (angle * 180) / Math.PI;
      const ptrX = cos * 28;
      const ptrY = sin * 20;
      const meaningText = item.meaning || '';
      const isTutCorrectTarget = Boolean(isTutStep3 && item.isCorrect);

      if (isTutCorrectTarget) {
        htmlParts.push(`
          <div class="absolute pointer-events-none z-25" style="left:${ax.toFixed(1)}px;top:${ay.toFixed(1)}px;transform:translate(-50%,-50%);">
            <div class="relative flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#13261b]/98 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.95),0_2px_10px_rgba(0,0,0,0.9)] tutorial-highlight-pulse">
              <span class="text-xl leading-none select-none drop-shadow-[0_2px_6px_rgba(251,191,36,0.9)]">🐾</span>
              ${meaningText ? `<span class="text-[14px] font-black text-amber-200 whitespace-nowrap leading-none tracking-tight drop-shadow-sm">${meaningText}</span>` : ''}
              <span class="text-base font-black text-amber-300 leading-none inline-block select-none drop-shadow-[0_0_6px_rgba(251,191,36,0.95)]" style="transform:rotate(${arrowDeg.toFixed(1)}deg);">➤</span>
            </div>
          </div>
        `);
      } else {
        htmlParts.push(`
          <div class="absolute pointer-events-none" style="left:${ax.toFixed(1)}px;top:${ay.toFixed(1)}px;transform:translate(-50%,-50%);">
            <div class="relative flex items-center justify-center px-3.5 py-1.5 rounded-full bg-[#08150f]/98 border-2 border-[#10b981] shadow-[0_0_14px_rgba(16,185,129,0.7),0_2px_8px_rgba(0,0,0,0.85)]">
              <svg width="16" height="16" viewBox="0 0 16 16" style="position:absolute;left:50%;top:50%;transform:translate(calc(-50% + ${ptrX.toFixed(1)}px),calc(-50% + ${ptrY.toFixed(1)}px)) rotate(${deg.toFixed(1)}deg);filter:drop-shadow(0 0 4px #34d399) drop-shadow(0 1px 2px rgba(0,0,0,0.9));">
                <polygon points="8,0 15,14 8,11 1,14" fill="#34d399" stroke="#042f1a" stroke-width="1.2" />
              </svg>
              ${meaningText ? `<span class="text-[14px] font-bold text-[#f8f5ec] whitespace-nowrap leading-none tracking-tight drop-shadow-sm">${meaningText}</span>` : ''}
            </div>
          </div>
        `);
      }
    }
    edgeArrowsWrap.innerHTML = htmlParts.join('');
  }

  // === 모달 렌더러 ===
  function showPauseModal() {
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-3xl">⏸️</div>
        <h2 class="text-xl font-black text-[#1f2d24]">${t('modal.pauseTitle')}</h2>

        <div class="space-y-2.5 pt-1">
          <button id="btn-modal-resume" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition cursor-pointer">
            ${t('modal.resume')}
          </button>
          <button id="btn-modal-quit" type="button" class="w-full py-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-sm active:scale-95 transition cursor-pointer">
            ${t('modal.quitToLobby')}
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-modal-resume')?.addEventListener('click', () => {
      closeModal();
      engine.resume();
    });

    document.getElementById('btn-modal-quit')?.addEventListener('click', () => {
      closeModal();
      hideHud();
      engine.abortToLobby();
      onReturnToLobby?.();
    });
  }

  function showLevelUpModal(choices) {
    const cardsHtml = choices
      .map((choice, idx) => {
        if (choice.kind === 'skill') {
          const sk = choice.skill;
          const isAttackWeapon = sk.category === 'bark';
          const isAwakening = choice.nextLevel === 5 && isAttackWeapon;
          const name = isAwakening && sk.awakenedName ? sk.awakenedName : sk.name;
          const desc = isAwakening && sk.awakenedDesc ? sk.awakenedDesc : sk.desc;
          const roleBadgeHtml = isAttackWeapon
            ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-400/50 text-rose-800 text-[10px] font-black shrink-0">[ ⚔️ 공격 무기 ]</span>`
            : `<span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-900 text-[10px] font-black shrink-0">[ ✨ 능력 강화 ]</span>`;
          const badgeHtml = isAwakening
            ? `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs animate-pulse">🔥 Lv.5 각성 진화!</span>`
            : `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-800">Lv.${choice.nextLevel}</span>`;
          return `
            <button type="button" data-choice-idx="${idx}" class="skill-pick-btn w-full text-left p-3.5 rounded-xl ${isAwakening ? 'bg-amber-50/90 hover:bg-amber-100/90 border-2 border-amber-400 shadow-md' : 'bg-[#f0ebe0] hover:bg-[#e6dec8] border border-[#d2c8b4]'} flex items-center gap-3 active:scale-98 transition cursor-pointer">
              <div class="w-11 h-11 rounded-xl ${isAwakening ? 'bg-amber-200/80 border border-amber-400' : 'bg-[#faf6ee] border border-[#d2c8b4]'} flex items-center justify-center text-2xl shrink-0">${sk.icon}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1.5 flex-wrap">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-extrabold text-sm ${isAwakening ? 'text-amber-950 font-black' : 'text-[#1f2d24]'} truncate">${name}</span>
                    ${roleBadgeHtml}
                  </div>
                  ${badgeHtml}
                </div>
                <p class="text-xs ${isAwakening ? 'text-amber-900 font-medium' : 'text-[#4a584e]'} mt-0.5 line-clamp-2">${desc}</p>
              </div>
            </button>
          `;
        }
        const comp = choice.companion;
        return `
          <button type="button" data-choice-idx="${idx}" class="skill-pick-btn w-full text-left p-3.5 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dec8] border border-amber-600/40 flex items-center gap-3 active:scale-98 transition cursor-pointer">
            <div class="w-11 h-11 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0">${comp.icon}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1.5 flex-wrap">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-extrabold text-sm text-amber-900 truncate">${comp.name}</span>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-900 text-[10px] font-black shrink-0">[ ✨ 능력 강화 ]</span>
                </div>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800">Lv.${choice.nextLevel}</span>
              </div>
              <p class="text-xs text-[#4a584e] mt-0.5">${comp.role} 공격력 +20%</p>
            </div>
          </button>
        `;
      })
      .join('');

    openModal(`
      <div class="space-y-3">
        <div class="text-center">
          <div class="text-2xl mb-1">✨</div>
          <h2 class="text-lg font-black text-emerald-800">${t('modal.skillPickTitle')}</h2>
        </div>
        <div class="space-y-2.5">${cardsHtml}</div>
      </div>
    `);

    modalCard.querySelectorAll('.skill-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-choice-idx'));
        const picked = choices[idx];
        closeModal();
        if (picked) {
          engine.selectLevelUpChoice(picked);
        }
      });
    });
  }

  function showGameOverModal({ canRevive }) {
    const save = getSave?.() || {};
    const dogName = save.dogName || '우유';
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">🩹</div>
        <h2 class="text-xl font-black text-rose-600">${t('modal.gameOverTitle', { name: dogName })}</h2>
        <div class="space-y-2.5 pt-1">
          ${
            canRevive
              ? `<button id="btn-revive-ad" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#d97706] text-[#f8f5ec] font-black text-sm shadow-lg active:scale-95 transition">
                  ${t('modal.reviveAdBtn')}
                </button>`
              : ''
          }
          <button id="btn-give-up" type="button" class="w-full py-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-sm active:scale-95 transition">
            ${t('modal.giveUpBtn')}
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-revive-ad')?.addEventListener('click', () => {
      closeModal();
      engine.reviveWithAd();
    });

    document.getElementById('btn-give-up')?.addEventListener('click', () => {
      closeModal();
      hideHud();
      engine.abortToLobby();
      onReturnToLobby?.();
    });
  }

  function showStageResultModal(res) {
    if (res.isPlacement) {
      const isTest = Boolean(res.isPlacementTest);
      const passed = Boolean(res.placementPassed);
      const assignedTier = res.assignedTier || { label: '초급 Lv.1', badgeLabel: '초급 Lv.1', id: 'beginner_lv1', unitOffset: 0, cefr: 'A1', recommendMsg: '' };
      const recommendMsg = assignedTier.recommendMsg || '나에게 딱 맞는 레벨로 시작해 보세요!';

      if (isTest) {
        const testedTier = res.selectedTier || res.assignedTier || WORD_LEVEL_TIERS[0];
        const correctCount = res.correctCount || 0;
        const bossDefeated = Boolean(res.bossDefeated);
        const isPassed = Boolean(res.placementPassed);

        if (isPassed) {
          // ✅ 합격(통과) 시
          openModal(`
            <div class="text-center space-y-4 py-1">
              <div class="text-4xl animate-bounce">🎉✨</div>
              <div class="space-y-1.5">
                <span class="inline-block px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black">
                  레벨 테스트 합격!
                </span>
                <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
                  🎉 [${testedTier.label || testedTier.badgeLabel}] 테스트 통과!
                </h3>
                <p class="text-xs text-[#4a584e] font-bold">
                  (10문제 중 <b class="text-emerald-700 font-extrabold">${correctCount}문제</b> 정답 + 보스 격파)
                </p>
                <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs mt-2">
                  <div class="text-[#4a584e]">배정 레벨</div>
                  <div class="text-right font-extrabold text-emerald-800">${testedTier.label || testedTier.badgeLabel}</div>
                  <div class="text-[#4a584e]">정답 결과</div>
                  <div class="text-right font-extrabold text-emerald-800">${correctCount} / 10 (합격 ✓)</div>
                  <div class="text-[#4a584e]">보스 처치</div>
                  <div class="text-right font-extrabold text-emerald-800">격파 성공 ✓</div>
                  <div class="text-[#4a584e]">처치 좀비</div>
                  <div class="text-right font-extrabold text-[#1f2d24]">${res.kills || 0}마리</div>
                  <div class="text-[#4a584e]">출격 스테이지</div>
                  <div class="text-right font-extrabold text-emerald-800">CH.1 STAGE 1</div>
                </div>
              </div>
              <div class="pt-1">
                <button id="btn-result-launch" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-[#f8f5ec] font-black text-sm shadow-[0_4px_16px_rgba(16,185,129,0.35)] active:scale-95 transition cursor-pointer">
                  [ ⚔️ 이 레벨로 모험 시작하기 ]
                </button>
              </div>
            </div>
          `);

          document.getElementById('btn-result-launch')?.addEventListener('click', () => {
            updateSave((s) => {
              s.hasSelectedWordLevel = true;
              s.wordLevelTier = testedTier.id;
              s.wordUnitOffset = Number(testedTier.unitOffset) || 0;
              s.selectedLevelLabel = testedTier.badgeLabel;
              if (s.courseProgress && s.studyLang && s.courseProgress[s.studyLang]) {
                s.courseProgress[s.studyLang].cefr = testedTier.cefr;
              }
              s.selectedChapter = 1;
              s.selectedUnit = 'unit_001';
            });
            closeModal();
            hideHud();
            if (onStartBattle) {
              onStartBattle({ chapterNumber: 1, courseId: getSave().selectedCourse || 'lv1', unitId: 'unit_001', isTutorial: false });
            } else {
              onReturnToLobby?.();
            }
          });
        } else {
          // ❌ 불합격(탈락) 시
          const failReasonText = (correctCount >= 7 && !bossDefeated)
            ? '7문제 이상 맞혔지만 마지막 보스를 쓰러뜨리지 못했습니다.'
            : '조금 더 쉬운 단계에서 다시 도전해 볼까요?';

          openModal(`
            <div class="text-center space-y-4 py-1">
              <div class="text-4xl">🌱💦</div>
              <div class="space-y-1.5">
                <span class="inline-block px-3 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-900 text-xs font-black">
                  레벨 테스트 결과
                </span>
                <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
                  아쉬워요! (10문제 중 <b class="text-rose-600">${correctCount}문제</b> 정답)
                </h3>
                <p class="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 py-1.5 px-3 rounded-xl inline-block mt-1">
                  ${failReasonText}
                </p>
                <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs mt-2">
                  <div class="text-[#4a584e]">응시 레벨</div>
                  <div class="text-right font-extrabold text-[#1f2d24]">${testedTier.label || testedTier.badgeLabel}</div>
                  <div class="text-[#4a584e]">정답 결과</div>
                  <div class="text-right font-extrabold ${correctCount >= 7 ? 'text-emerald-700' : 'text-rose-600'}">${correctCount} / 10 (${correctCount >= 7 ? '기준 달성' : '미달'})</div>
                  <div class="text-[#4a584e]">보스 처치</div>
                  <div class="text-right font-extrabold ${bossDefeated ? 'text-emerald-700' : 'text-rose-600'}">${bossDefeated ? '격파 성공 ✓' : '격파 실패 ❌'}</div>
                  <div class="text-[#4a584e]">통과 기준</div>
                  <div class="text-right font-extrabold text-[#5c6e60]">7문제 이상 + 보스 격파</div>
                </div>
              </div>
              <div class="space-y-2 pt-1">
                <button id="btn-result-retry-same" type="button" class="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <span>[ 🔄 이 레벨 다시 도전하기 ]</span>
                </button>
                <button id="btn-result-choose-level" type="button" class="w-full py-2.5 px-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-black text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <span>[ 📋 레벨 다시 선택하기 ]</span>
                </button>
                <button id="btn-result-exit-lobby" type="button" class="w-full py-2.5 rounded-xl bg-[#faf6ee] hover:bg-[#f0ebe0] border border-[#d2c8b4] text-[#4a584e] hover:text-[#1f2d24] font-bold text-xs active:scale-95 transition cursor-pointer">
                  <span>[ 🏠 로비로 나가기 ]</span>
                </button>
              </div>
            </div>
          `);

          document.getElementById('btn-result-retry-same')?.addEventListener('click', () => {
            closeModal();
            hideHud();
            if (onStartBattle) {
              onStartBattle({
                chapterNumber: 1,
                courseId: getSave().selectedCourse || 'lv1',
                unitId: 'unit_001',
                isPlacement: true,
                isPlacementTest: true,
                selectedTier: testedTier,
                targetUnitNum: Number(testedTier.unitOffset) + 1,
              });
            } else {
              onReturnToLobby?.();
            }
          });

          document.getElementById('btn-result-choose-level')?.addEventListener('click', () => {
            updateSave((s) => {
              s.hasSelectedWordLevel = false;
            });
            closeModal();
            hideHud();
            onOpenWordLevelSelect?.();
          });

          document.getElementById('btn-result-exit-lobby')?.addEventListener('click', () => {
            updateSave((s) => {
              s.hasSelectedWordLevel = false;
            });
            closeModal();
            hideHud();
            onReturnToLobby?.();
          });
        }
        return;
      }

      openModal(`
        <div class="text-center space-y-4 py-1">
          <div class="text-4xl">🎯✨</div>
          <div class="space-y-1.5">
            <div class="text-xs font-bold text-[#5c6e60]">배치 테스트 완료!</div>
            <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
              회원님께 딱 맞는 추천 레벨은 <br/>
              <span class="text-emerald-700 font-black text-xl">[ ${assignedTier.label} ]</span> 입니다!
            </h3>
            <p class="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-xl inline-block mt-1">
              "${recommendMsg}"
            </p>
            <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs mt-2">
              <div class="text-[#4a584e]">배정 레벨</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${assignedTier.label}</div>
              <div class="text-[#4a584e]">정답 퀴즈</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${res.correctCount || 0} / 10</div>
              <div class="text-[#4a584e]">처치 좀비</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${res.kills || 0}마리</div>
              <div class="text-[#4a584e]">출격 스테이지</div>
              <div class="text-right font-extrabold text-emerald-800">CH.1 STAGE 1</div>
            </div>
          </div>
          <button id="btn-result-confirm" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-[#f8f5ec] font-black text-sm shadow-[0_4px_16px_rgba(16,185,129,0.35)] active:scale-95 transition cursor-pointer">
            ⚔️ [ ${assignedTier.label} 확정 및 로비 이동 ]
          </button>
        </div>
      `);

      document.getElementById('btn-result-confirm')?.addEventListener('click', () => {
        updateSave((s) => {
          s.hasSelectedWordLevel = true;
          s.wordLevelTier = assignedTier.id;
          s.wordUnitOffset = Number(assignedTier.unitOffset) || 0;
          s.selectedLevelLabel = assignedTier.badgeLabel;
          if (s.courseProgress && s.studyLang && s.courseProgress[s.studyLang]) {
            s.courseProgress[s.studyLang].cefr = assignedTier.cefr;
          }
          // 게임 전투 스테이지는 항상 CH.1 STAGE 1 유지
          s.selectedChapter = 1;
          s.selectedUnit = 'unit_001';
        });
        closeModal();
        hideHud();
        onReturnToLobby?.();
      });
      return;
    }

    if (res.isPromotion) {
      const passed = Boolean(res.promoPassed);
      openModal(`
        <div class="text-center space-y-4">
          <div class="text-4xl">${passed ? '🎓✨' : '📚💦'}</div>
          <h2 class="text-xl font-black ${passed ? 'text-amber-600' : 'text-slate-700'}">
            ${passed ? `축하합니다! ${res.targetLevel} 승급!` : '승급 기준 미달'}
          </h2>
          <p class="text-xs text-[#4a584e] leading-relaxed">
            ${passed
              ? `목표 등급 <b>${res.targetLevel}</b>을 성공적으로 달성했습니다!<br/>보너스 뼈다귀와 주간 랭킹 점수를 획득했습니다.`
              : `아쉽습니다! 정답률 85%(17문제) 이상이어야 승급됩니다.<br/>다시 도전해 보세요!`
            }
          </p>
          <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs">
            <div class="text-[#4a584e]">정답 수</div>
            <div class="text-right font-extrabold text-[#1f2d24]">${res.correctCount} / 20 (${Math.round((res.correctCount / 20) * 100)}%)</div>
            <div class="text-[#4a584e]">승급 판정</div>
            <div class="text-right font-extrabold ${passed ? 'text-emerald-700 font-black' : 'text-rose-600'}">${passed ? '합격 (PASSED)' : '불합격'}</div>
            <div class="text-[#4a584e]">획득 뼈다귀</div>
            <div class="text-right font-extrabold text-amber-900">+${res.earnedSnacks || 0} 🦴</div>
            <div class="text-[#4a584e]">주간 리그 점수</div>
            <div class="text-right font-extrabold text-emerald-800">+${res.score || 0}점</div>
            <div class="text-[#4a584e]">처치 좀비</div>
            <div class="text-right font-extrabold text-[#1f2d24]">${res.kills || 0}마리</div>
          </div>
          <button id="btn-result-confirm" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition">
            확인
          </button>
        </div>
      `);

      document.getElementById('btn-result-confirm')?.addEventListener('click', () => {
        closeModal();
        hideHud();
        onReturnToLobby?.();
      });
      return;
    }

    const title = res.cleared ? t('modal.resultClearTitle') : t('modal.resultFailTitle');
    const icon = res.cleared ? (res.isTutorial ? '🎉' : '🏆') : '💀';

    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">${icon}</div>
        <h2 class="text-xl font-black ${res.cleared ? 'text-amber-700' : 'text-rose-600'}">${title}</h2>
        ${res.isTutorial ? `<p class="text-xs text-emerald-800 font-semibold">${t('tutorial.complete')}</p>` : ''}
        <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs">
          <div class="text-[#4a584e]">${t('modal.resultCorrect')}</div>
          <div class="text-right font-extrabold text-[#1f2d24]">${res.correctCount}</div>
          <div class="text-[#4a584e]">${t('modal.resultEvoXp')}</div>
          <div class="text-right font-extrabold text-emerald-800">+${res.earnedEvoXp}</div>
          <div class="text-[#4a584e] flex items-center gap-1">
            <span>${t('modal.resultGold')}</span>
            ${res.isFirstClear ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 text-[9px] font-black">최초 돌파</span>` : res.isRepeatFarm ? `<span class="px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 text-[9px] font-bold">반복 50%</span>` : ''}
          </div>
          <div class="text-right font-extrabold text-amber-700">+${res.earnedGold} 🪙</div>
          <div class="text-[#4a584e]">획득 뼈다귀</div>
          <div class="text-right font-extrabold text-amber-900">+${res.earnedSnacks || 0} 🦴</div>
          <div class="text-[#4a584e]">주간 리그 점수</div>
          <div class="text-right font-extrabold text-emerald-800">+${res.score || 0}점</div>
          ${(res.earnedGems || 0) > 0 ? `
            <div class="text-[#4a584e]">획득 보석</div>
            <div class="text-right font-extrabold text-cyan-700">+${res.earnedGems} 💎</div>
          ` : ''}
          <div class="text-[#4a584e]">${t('modal.resultMastered')}</div>
          <div class="text-right font-extrabold text-emerald-800">${res.newlyMasteredCount}</div>
        </div>
        <button id="btn-result-confirm" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition">
          ${t('modal.confirm')}
        </button>
      </div>
    `);

    document.getElementById('btn-result-confirm')?.addEventListener('click', () => {
      closeModal();
      hideHud();
      onReturnToLobby?.();
    });
  }

  // === GameEngine 핸들러 바인딩 ===
  engine.setHandlers({
    onQuestionChanged({ word }) {
      currentWordText = word?.word || '';
      if (ledWordText) {
        ledWordText.textContent = currentWordText || 'READY';
      }
    },

    onWrongFeedback() {
      if (ledWordText) {
        ledWordText.classList.add('text-rose-400');
        setTimeout(() => {
          ledWordText?.classList.remove('text-rose-400');
        }, 500);
      }
    },

    onHudUpdate({ hp, maxHp, xp, xpToNext, ultGauge, evoXp, boss, edgeArrows, viewW, viewH, wrongReview, tutorialCoaching, placement }) {
      if (hudTutorialCoach) {
        if (tutorialCoaching && tutorialCoaching.active) {
          hudTutorialCoach.classList.remove('hidden');
          hudTutorialCoach.style.bottom = '16px';
          hudTutorialCoach.style.top = 'auto';
          if (tutorialCoachStep) {
            tutorialCoachStep.textContent = `STEP ${tutorialCoaching.step} / ${tutorialCoaching.totalSteps}`;
          }
          if (tutorialCoachText) {
            tutorialCoachText.textContent = tutorialCoaching.text || '';
          }
          if (tutorialCoachCount) {
            if (tutorialCoaching.countText) {
              tutorialCoachCount.textContent = tutorialCoaching.countText;
              tutorialCoachCount.classList.remove('hidden');
            } else {
              tutorialCoachCount.classList.add('hidden');
            }
          }
          if (btnTutorialCoachAck) {
            btnTutorialCoachAck.textContent = t('tutorial.ackBtn') || '🐾 알겠어!';
            btnTutorialCoachAck.classList.toggle('hidden', !tutorialCoaching.showAckButton);
          }

          if (tutorialGestureOverlay) {
            const hasGesture = tutorialCoaching.showDragGesture || tutorialCoaching.showDoubleTapGesture;
            tutorialGestureOverlay.classList.toggle('hidden', !hasGesture);
            tutorialGestureDrag?.classList.toggle('hidden', !tutorialCoaching.showDragGesture);
            tutorialGestureDoubleTap?.classList.toggle('hidden', !tutorialCoaching.showDoubleTapGesture);
          }

          ledScoreboard?.classList.toggle('tutorial-highlight-pulse', Boolean(tutorialCoaching.highlightScoreboard));
          tutorialScoreboardPointer?.classList.toggle('hidden', !tutorialCoaching.highlightScoreboard);
          hudLeftWidget?.classList.toggle('tutorial-highlight-pulse', Boolean(tutorialCoaching.highlightUltGauge));
        } else {
          hudTutorialCoach.classList.add('hidden');
          tutorialGestureOverlay?.classList.add('hidden');
          tutorialGestureDrag?.classList.add('hidden');
          tutorialGestureDoubleTap?.classList.add('hidden');
          tutorialScoreboardPointer?.classList.add('hidden');
          ledScoreboard?.classList.remove('tutorial-highlight-pulse');
          hudLeftWidget?.classList.remove('tutorial-highlight-pulse');
        }
      }
      if (hudPlacementBadge && hudPlacementText) {
        if (placement) {
          hudPlacementBadge.classList.remove('hidden');
          if (placement.isPlacementTest) {
            hudPlacementText.textContent = `🎯 실력 진단 테스트 진행 중 (${placement.questionNumber || 1} / 10)`;
          } else {
            const lives = Math.max(0, placement.lives ?? 3);
            const hearts = '❤️'.repeat(lives) + '🤍'.repeat(Math.max(0, 3 - lives));
            hudPlacementText.textContent = `🎓 STAGE ${placement.targetUnitNum} 월반 도전 · ${hearts} (남은 기회 ${lives}회)`;
          }
        } else {
          hudPlacementBadge.classList.add('hidden');
        }
      }

      if (wrongReviewOverlay) {
        if (wrongReview) {
          wrongReviewWord.textContent = wrongReview.word || '';
          wrongReviewMeaning.textContent = wrongReview.meaning || '';
          if (wrongReview.isPlacementTest) {
            wrongReviewMeaning.classList.add('hidden');
          } else {
            wrongReviewMeaning.classList.remove('hidden');
          }
          wrongReviewOverlay.classList.remove('hidden');
        } else {
          wrongReviewOverlay.classList.add('hidden');
        }
      }

      // 상단 좌측 세로형 슬림 필살기 게이지 바 (아래에서 위로 황금/노란색 차오름 & 100% 반짝임)
      const ultPct = Math.max(0, Math.min(100, (ultGauge / Math.max(1, BALANCE.COMBAT.ULT_MAX_GAUGE)) * 100));
      const isUltFull = ultPct >= 100;
      const shouldPulseLeft = isUltFull || Boolean(tutorialCoaching && tutorialCoaching.highlightUltGauge);
      if (hudUltVertFill) {
        hudUltVertFill.style.height = `${ultPct}%`;
        hudUltVertFill.classList.toggle('shadow-[0_0_10px_rgba(253,224,71,0.95)]', isUltFull);
      }
      if (hudUltVertTrack) {
        hudUltVertTrack.classList.toggle('border-yellow-200', isUltFull);
        hudUltVertTrack.classList.toggle('border-amber-400/45', !isUltFull);
      }
      if (hudUltVertIcon) {
        hudUltVertIcon.classList.toggle('scale-125', isUltFull);
        hudUltVertIcon.classList.toggle('drop-shadow-[0_0_6px_rgba(251,191,36,0.95)]', isUltFull);
      }
      if (hudLeftWidget) {
        hudLeftWidget.classList.toggle('border-amber-300', shouldPulseLeft);
        hudLeftWidget.classList.toggle('shadow-[0_0_16px_rgba(251,191,36,0.9)]', shouldPulseLeft);
        hudLeftWidget.classList.toggle('tutorial-highlight-pulse', shouldPulseLeft);
      }

      if (hudUltActionWrap) {
        const isTutorialActive = Boolean(tutorialCoaching && tutorialCoaching.active);
        const canShowUltBtn = ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE && (!isTutorialActive || tutorialCoaching.step === 6);
        if (canShowUltBtn) {
          if (hudUltBtnLabel) {
            hudUltBtnLabel.textContent = t('hud.ultGauge') || '필살기';
          }
          hudUltActionWrap.classList.toggle('bottom-[104px]', isTutorialActive);
          hudUltActionWrap.classList.toggle('bottom-6', !isTutorialActive);
          hudUltActionWrap.classList.remove('hidden');
        } else {
          hudUltActionWrap.classList.add('hidden');
        }
      }

      if (boss && boss.hp > 0) {
        bossWrap.classList.remove('hidden');
        bossName.textContent = boss.name || 'BOSS';
        bossLockText.textContent = boss.enraged ? t('hud.bossEnraged') : t('hud.bossLock');
        const bossPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
        bossHpBar.style.width = `${bossPct}%`;
      } else {
        bossWrap.classList.add('hidden');
      }

      renderEdgeArrows(edgeArrows, viewW, viewH);
    },

    onLevelUpChoices(choices) {
      resetJoystick();
      showLevelUpModal(choices);
    },

    onPauseChanged(paused) {
      resetJoystick();
      if (paused) {
        hudTutorialCoach?.classList.add('hidden');
        showPauseModal();
      } else {
        closeModal();
        if (engine.runStats?.isTutorial && engine.tutorial?.active) {
          hudTutorialCoach?.classList.remove('hidden');
        }
      }
    },

    onGameOver({ canRevive }) {
      resetJoystick();
      hudTutorialCoach?.classList.add('hidden');
      showGameOverModal({ canRevive });
    },

    onCompanionRescueTutorial({ companion, onConfirm }) {
      resetJoystick();
      openModal(`
        <div class="text-center space-y-4 py-2">
          <div class="text-5xl animate-bounce">🐶🎉</div>
          <div class="space-y-1.5">
            <span class="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black">
              서포트 동료 구출 성공!
            </span>
            <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
              🎉 새 서포트 동료 <span class="text-emerald-700 font-extrabold">[${companion.name}]</span> 구출!
            </h3>
            <p class="text-xs font-bold text-[#4a584e] bg-[#f0ebe0] border border-[#d2c8b4] p-3 rounded-2xl leading-relaxed mt-2 text-left">
              💡 <b>동료 배치 튜토리얼</b><br/>
              전투 종료 후 로비 <b>[내 강아지]</b> 메뉴에서 동료 슬롯에 장착하면 다음 전투부터 함께 싸웁니다!
            </p>
          </div>
          <button
            id="btn-confirm-companion-rescue"
            type="button"
            class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-[#f8f5ec] font-black text-sm shadow-md active:scale-95 transition cursor-pointer"
          >
            확인 (다음 문제 계속) 🐾
          </button>
        </div>
      `);

      document.getElementById('btn-confirm-companion-rescue')?.addEventListener('click', () => {
        audioEngine.playCaptureTick?.();
        closeModal();
        onConfirm?.();
      });
    },

    onStageResult(res) {
      resetJoystick();
      if (res.isTutorial && res.cleared) {
        closeModal();
        hideHud();
        onReturnToLobby?.();
        return;
      }
      showStageResultModal(res);
    },

    onTutorialCompleted() {
      resetJoystick();
      closeModal();
      hideHud();
      onReturnToLobby?.();
    },

    onBanner(text) {
      showBanner(text);
    },
  });

  let bannerEl = null;
  function showBanner(text, duration = 2500) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-black shadow-lg transition-all duration-300 pointer-events-none text-center whitespace-nowrap';
      hudLayer?.appendChild(bannerEl);
    }
    bannerEl.textContent = text;
    bannerEl.style.opacity = '1';
    bannerEl.style.transform = 'translate(-50%, 0)';
    setTimeout(() => {
      if (bannerEl) {
        bannerEl.style.opacity = '0';
        bannerEl.style.transform = 'translate(-50%, -10px)';
      }
    }, duration);
  }

  return {
    showHud,
    hideHud,
    closeModal,
    showBanner,
  };
}

