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
import { clampIndicatorToThumbSafeZone } from '../entities/monoliths.js';

export function createHudUI(engine, { onReturnToLobby, onStartPath } = {}) {
  const hudLayer = document.getElementById('hud-layer');
  const modalLayer = document.getElementById('modal-layer');
  const modalCard = document.getElementById('modal-card');
  const canvas = document.getElementById('game-canvas');

  const btnPause = document.getElementById('btn-pause');
  const btnSkipTutorial = document.getElementById('btn-skip-tutorial');

  const bossWrap = document.getElementById('hud-boss-bar-wrap');
  const bossName = document.getElementById('hud-boss-name');
  const bossLockText = document.getElementById('hud-boss-lock-text');
  const bossHpBar = document.getElementById('hud-boss-hp-bar');

  const ledScoreboard = document.getElementById('led-scoreboard');
  const ledWordText = document.getElementById('led-word-text');

  const skillSparks = [
    document.getElementById('skill-spark-0'),
    document.getElementById('skill-spark-1'),
    document.getElementById('skill-spark-2'),
  ];
  const skillSparksWrap = document.getElementById('hud-skill-sparks');

  const edgeArrowsWrap = document.getElementById('edge-arrows');
  const hudUltReadyBadge = document.getElementById('hud-ult-ready-badge');
  const hudPlacementBadge = document.getElementById('hud-placement-badge');
  const hudPlacementText = document.getElementById('hud-placement-text');

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
    btnSkipTutorial?.classList.add('hidden');
    hudUltReadyBadge?.classList.add('hidden');
    hudPlacementBadge?.classList.add('hidden');
    skillSparks.forEach((el) => {
      if (el) el.className = 'text-xs leading-none select-none transition-all duration-300 opacity-25 grayscale scale-95';
    });
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
  btnPause?.addEventListener('click', () => {
    if (engine.state === GAME_STATES.PLAYING) {
      engine.pause();
    }
  });

  btnSkipTutorial?.addEventListener('click', () => {
    resetJoystick();
    engine.skipTutorial();
    hideHud();
    onReturnToLobby?.();
  });

  ledScoreboard?.addEventListener('click', () => {
    if (currentWordText) {
      audioEngine.unlock();
      audioEngine.speakWordOnce(currentWordText);
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
    const topPadding = 138; // 전광판 하단(약 105px) + 33px 여유 간격
    const minY = topPadding;
    const maxYBound = viewH - 78;

    // 레이-박스 교차 기준점(우유 화면 좌표)을 안전 영역 내로 클램프
    const ox = Math.max(minX + 1, Math.min(maxXBound - 1, playerScr.x));
    const oy = Math.max(minY + 1, Math.min(maxYBound - 1, playerScr.y));

    const htmlParts = [];
    for (const item of edgeArrows) {
      if (!item.outOfView) continue;
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
      const ptrX = cos * 28;
      const ptrY = sin * 20;
      const meaningText = item.meaning || '';

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
    edgeArrowsWrap.innerHTML = htmlParts.join('');
  }

  // === 모달 렌더러 ===
  function showPauseModal() {
    const save = getSave();
    const isRight = (save.dominantHand || 'right') === 'right';

    openModal(`
      <div class="text-center space-y-4">
        <div class="text-3xl">⏸️</div>
        <h2 class="text-xl font-black text-[#1f2d24]">${t('modal.pauseTitle')}</h2>

        <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2 text-left">
          <div class="text-xs font-bold text-[#4a584e] flex items-center justify-between">
            <span>🖐️ 조작 손 설정</span>
            <span class="text-[11px] font-semibold text-emerald-800">${isRight ? '필살기: 왼쪽 하단' : '필살기: 오른쪽 하단'}</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="pause-hand-btn py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${isRight ? 'bg-[#2d6a4f] text-[#f8f5ec] border-[#2d6a4f] shadow-xs' : 'bg-[#faf6ee] text-[#4a584e] border-[#d2c8b4]'}" data-hand="right">
              👉 오른손잡이
            </button>
            <button type="button" class="pause-hand-btn py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 ${!isRight ? 'bg-[#2d6a4f] text-[#f8f5ec] border-[#2d6a4f] shadow-xs' : 'bg-[#faf6ee] text-[#4a584e] border-[#d2c8b4]'}" data-hand="left">
              👈 왼손잡이
            </button>
          </div>
        </div>

        <div class="space-y-2.5 pt-1">
          <button id="btn-modal-resume" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition">
            ${t('modal.resume')}
          </button>
          <button id="btn-modal-quit" type="button" class="w-full py-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-sm active:scale-95 transition">
            ${t('modal.quitToLobby')}
          </button>
        </div>
      </div>
    `);

    modalCard.querySelectorAll('.pause-hand-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hand = btn.getAttribute('data-hand');
        updateSave((s) => {
          s.dominantHand = hand;
        });
        updateUltButtonPosition();
        showPauseModal();
      });
    });

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
          return `
            <button type="button" data-choice-idx="${idx}" class="skill-pick-btn w-full text-left p-3.5 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dec8] border border-[#d2c8b4] flex items-center gap-3 active:scale-98 transition">
              <div class="w-11 h-11 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0">${sk.icon}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-extrabold text-sm text-[#1f2d24] truncate">${sk.name}</span>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-800">Lv.${choice.nextLevel}</span>
                </div>
                <p class="text-xs text-[#4a584e] mt-0.5 line-clamp-2">${sk.desc}</p>
              </div>
            </button>
          `;
        }
        const comp = choice.companion;
        return `
          <button type="button" data-choice-idx="${idx}" class="skill-pick-btn w-full text-left p-3.5 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dec8] border border-amber-600/40 flex items-center gap-3 active:scale-98 transition">
            <div class="w-11 h-11 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0">${comp.icon}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="font-extrabold text-sm text-amber-900 truncate">${comp.name}</span>
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
      const passed = Boolean(res.placementPassed);
      const targetUnit = res.targetUnitNum || 1;
      const lives = Math.max(0, res.lives ?? 0);
      const hearts = '❤️'.repeat(lives) + '🤍'.repeat(Math.max(0, 3 - lives));
      openModal(`
        <div class="text-center space-y-4">
          <div class="text-4xl">${passed ? '🎉🎓' : '💦💀'}</div>
          <h2 class="text-xl font-black ${passed ? 'text-amber-600' : 'text-rose-600'}">
            ${passed ? `월반 성공! STAGE ${targetUnit} 해금!` : '월반 도전 실패'}
          </h2>
          <p class="text-xs text-[#4a584e] leading-relaxed">
            ${passed
              ? `뛰어난 실력으로 10문제를 모두 돌파했습니다!<br/><b>STAGE ${targetUnit}</b>까지 즉시 일괄 해금되었습니다.`
              : `목숨 3개를 모두 소진하거나 쓰러졌습니다.<br/>현재 스테이지를 조금 더 학습한 뒤 다시 도전해 보세요!`
            }
          </p>
          <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs">
            <div class="text-[#4a584e]">도전 스테이지</div>
            <div class="text-right font-extrabold text-[#1f2d24]">STAGE ${targetUnit}</div>
            <div class="text-[#4a584e]">정답 벙커</div>
            <div class="text-right font-extrabold text-[#1f2d24]">${res.correctCount || 0} / 10</div>
            <div class="text-[#4a584e]">남은 기회</div>
            <div class="text-right font-extrabold text-[#1f2d24]">${hearts}</div>
            <div class="text-[#4a584e]">판정 결과</div>
            <div class="text-right font-extrabold ${passed ? 'text-emerald-700 font-black' : 'text-rose-600'}">${passed ? '합격 (해금 완료)' : '불합격'}</div>
            <div class="text-[#4a584e]">처치 좀비</div>
            <div class="text-right font-extrabold text-[#1f2d24]">${res.kills || 0}마리</div>
          </div>
          <button id="btn-result-confirm" type="button" class="w-full py-3 rounded-xl ${passed ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#2d6a4f] hover:bg-[#245840]'} text-[#f8f5ec] font-black text-sm active:scale-95 transition">
            ${passed ? `⚔️ STAGE ${targetUnit} 로비로 이동` : '로비로 돌아가기'}
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

  function showStartPathModal() {
    const save = getSave?.() || {};
    const dogName = save.dogName || '우유';
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">🐶✨</div>
        <h2 class="text-xl font-black text-[#1f2d24]">튜토리얼 완료!</h2>
        <p class="text-xs text-[#4a584e] leading-relaxed">${dogName}와 함께 모험을 시작할 준비가 되었어요!</p>
        <div class="pt-1">
          <button id="btn-start-path-ch1" type="button" class="w-full py-3.5 px-4 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition text-center flex items-center justify-center gap-2">
            <span>⚔️ STAGE 1 모험 시작하기</span>
          </button>
        </div>
      </div>
    `);

    const handlePath = (path) => {
      closeModal();
      hideHud();
      if (onStartPath) {
        onStartPath(path);
      } else {
        onReturnToLobby?.();
      }
    };

    document.getElementById('btn-start-path-ch1')?.addEventListener('click', () => handlePath('ch1'));
  }

  // === GameEngine 핸들러 바인딩 ===
  engine.setHandlers({
    onQuestionChanged({ word, isTutorial }) {
      currentWordText = word?.word || '';
      if (ledWordText) {
        ledWordText.textContent = currentWordText || 'READY';
      }

      if (btnSkipTutorial) {
        if (isTutorial) {
          btnSkipTutorial.classList.remove('hidden');
        } else {
          btnSkipTutorial.classList.add('hidden');
        }
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

    onHudUpdate({ hp, maxHp, xp, xpToNext, ultGauge, evoXp, boss, edgeArrows, viewW, viewH, wrongReview, placement }) {
      if (hudPlacementBadge && hudPlacementText) {
        if (placement) {
          hudPlacementBadge.classList.remove('hidden');
          const lives = Math.max(0, placement.lives ?? 3);
          const hearts = '❤️'.repeat(lives) + '🤍'.repeat(Math.max(0, 3 - lives));
          hudPlacementText.textContent = `🎓 STAGE ${placement.targetUnitNum} 월반 도전 · ${hearts} (남은 기회 ${lives}회)`;
        } else {
          hudPlacementBadge.classList.add('hidden');
        }
      }

      if (wrongReviewOverlay) {
        if (wrongReview) {
          wrongReviewWord.textContent = wrongReview.word || '';
          wrongReviewMeaning.textContent = wrongReview.meaning || '';
          wrongReviewOverlay.classList.remove('hidden');
        } else {
          wrongReviewOverlay.classList.add('hidden');
        }
      }

      // 스킬 인디케이터 (번개 3개 아이콘)
      const step = xpToNext === 3 ? Math.max(0, Math.min(3, xp)) : Math.min(3, Math.floor((xp / Math.max(1, xpToNext)) * 3));
      skillSparks.forEach((el, idx) => {
        if (!el) return;
        if (idx < step) {
          el.className = 'text-xs leading-none select-none transition-all duration-300 opacity-100 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)] scale-110';
        } else {
          el.className = 'text-xs leading-none select-none transition-all duration-300 opacity-25 grayscale scale-95';
        }
      });

      if (prevSkillStep !== -1 && step > prevSkillStep && skillSparksWrap) {
        skillSparksWrap.classList.add('shadow-[0_0_14px_rgba(251,191,36,0.8)]', 'border-amber-400');
        clearTimeout(skillFlashTimer);
        skillFlashTimer = setTimeout(() => {
          skillSparksWrap.classList.remove('shadow-[0_0_14px_rgba(251,191,36,0.8)]', 'border-amber-400');
        }, 400);
      }
      prevSkillStep = step;

      const ultReady = ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE;
      if (hudUltReadyBadge) {
        hudUltReadyBadge.classList.toggle('hidden', !ultReady);
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
        showPauseModal();
      } else {
        closeModal();
      }
    },

    onGameOver({ canRevive }) {
      resetJoystick();
      showGameOverModal({ canRevive });
    },

    onStageResult(res) {
      resetJoystick();
      if (res.isTutorial && res.cleared) {
        showStartPathModal();
        return;
      }
      showStageResultModal(res);
    },
  });

  return {
    showHud,
    hideHud,
    closeModal,
  };
}

