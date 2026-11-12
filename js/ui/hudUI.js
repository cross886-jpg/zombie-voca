/**
 * js/ui/hudUI.js
 * 인게임 HUD(LED 전광판, 보스 3단 체력바, 4방향 네온 화살표, 플로팅 가상 조이스틱,
 * 레벨업 3지선다 모달, 일회용 필살기 버튼, 일시정지/게임오버/클리어 정산 모달) 제어
 */

import { BALANCE } from '../config/balance.js';
import { t } from '../data/i18n.js';
import { audioEngine } from '../core/audioEngine.js';
import { GAME_STATES } from '../game/gameEngine.js';

export function createHudUI(engine, { onReturnToLobby, onStartPath } = {}) {
  const hudLayer = document.getElementById('hud-layer');
  const modalLayer = document.getElementById('modal-layer');
  const modalCard = document.getElementById('modal-card');
  const canvas = document.getElementById('game-canvas');

  const stageLabel = document.getElementById('hud-stage-label');
  const questionProgress = document.getElementById('hud-question-progress');
  const hpBar = document.getElementById('hud-hp-bar');
  const xpBar = document.getElementById('hud-xp-bar');
  const btnPause = document.getElementById('btn-pause');
  const btnSkipTutorial = document.getElementById('btn-skip-tutorial');

  const bossWrap = document.getElementById('hud-boss-bar-wrap');
  const bossName = document.getElementById('hud-boss-name');
  const bossLockText = document.getElementById('hud-boss-lock-text');
  const bossHpBar = document.getElementById('hud-boss-hp-bar');

  const ledScoreboard = document.getElementById('led-scoreboard');
  const ledCourseBadge = document.getElementById('led-course-badge');
  const ledStreakBadge = document.getElementById('led-streak-badge');
  const ledWordText = document.getElementById('led-word-text');
  const ledPhoneticText = document.getElementById('led-phonetic-text');

  const edgeArrowsWrap = document.getElementById('edge-arrows');
  const btnUlt = document.getElementById('btn-ult');
  const btnUltLabel = document.getElementById('btn-ult-label');
  const hudEvoXp = document.getElementById('hud-evo-xp');
  const hudUltPct = document.getElementById('hud-ult-pct');

  const joystickEl = document.getElementById('virtual-joystick');
  const joystickKnob = document.getElementById('joystick-knob');

  const wrongReviewOverlay = document.getElementById('wrong-review-overlay');
  const wrongReviewWord = document.getElementById('wrong-review-word');
  const wrongReviewPhonetic = document.getElementById('wrong-review-phonetic');
  const wrongReviewMeaning = document.getElementById('wrong-review-meaning');

  const skillWrap = document.getElementById('hud-skill-wrap');
  const skillFill = document.getElementById('hud-skill-fill');
  const skillLabel = document.getElementById('hud-skill-label');

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
    if (btnUlt) btnUlt.disabled = true;
    if (btnUltLabel) btnUltLabel.textContent = '0%';
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

  function handlePointerDown(e) {
    if (engine.state !== GAME_STATES.PLAYING) return;
    if (e.target.closest('button') || e.target.closest('#led-scoreboard')) return;
    if (activePointerId !== null) return;

    audioEngine.unlock();
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

  btnUlt?.addEventListener('click', () => {
    engine.useUltimate();
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

    const minX = 40;
    const maxXBound = viewW - 40;
    const minY = 20;
    const maxYBound = viewH - 74;

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

      const ax = Math.max(minX, Math.min(maxXBound, ox + cos * tHit));
      const ay = Math.max(minY, Math.min(maxYBound, oy + sin * tHit));
      const deg = (angle * 180) / Math.PI + 90;
      const ptrX = cos * 22;
      const ptrY = sin * 16;
      const meaningText = item.meaning || '';

      htmlParts.push(`
        <div class="absolute pointer-events-none" style="left:${ax.toFixed(1)}px;top:${ay.toFixed(1)}px;transform:translate(-50%,-50%);">
          <div class="relative flex items-center justify-center px-2.5 py-1 rounded-full bg-[#1b3b2b]/95 border border-emerald-400/85 shadow-[0_0_12px_rgba(45,106,79,0.55)]">
            <svg width="14" height="14" viewBox="0 0 14 14" style="position:absolute;left:50%;top:50%;transform:translate(calc(-50% + ${ptrX.toFixed(1)}px),calc(-50% + ${ptrY.toFixed(1)}px)) rotate(${deg.toFixed(1)}deg);filter:drop-shadow(0 0 4px rgba(52,211,153,0.9));">
              <polygon points="7,0 13,12 7,9 1,12" fill="#34d399" />
            </svg>
            ${meaningText ? `<span class="text-[11px] font-extrabold text-[#f8f5ec] whitespace-nowrap leading-none">${meaningText}</span>` : ''}
          </div>
        </div>
      `);
    }
    edgeArrowsWrap.innerHTML = htmlParts.join('');
  }

  // === 모달 렌더러 ===
  function showPauseModal() {
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-3xl">⏸️</div>
        <h2 class="text-xl font-black text-[#1f2d24]">${t('modal.pauseTitle')}</h2>
        <div class="space-y-2.5 pt-2">
          <button id="btn-modal-resume" type="button" class="w-full py-3 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition">
            ${t('modal.resume')}
          </button>
          <button id="btn-modal-quit" type="button" class="w-full py-3 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-sm active:scale-95 transition">
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
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">🩹</div>
        <h2 class="text-xl font-black text-rose-600">${t('modal.gameOverTitle')}</h2>
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
          <div class="text-[#4a584e]">${t('modal.resultGold')}</div>
          <div class="text-right font-extrabold text-amber-700">+${res.earnedGold} 🪙</div>
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
    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">🐶✨</div>
        <h2 class="text-xl font-black text-[#1f2d24]">튜토리얼 완료!</h2>
        <p class="text-xs text-[#4a584e] leading-relaxed">우유와 함께할 시작 경로를 선택해 주세요.</p>
        <div class="space-y-2.5 pt-1">
          <button id="btn-start-path-ch1" type="button" class="w-full py-3.5 px-4 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm active:scale-95 transition text-left flex items-center justify-between">
            <span>🌱 CH.1 기초부터 시작</span>
            <span class="text-xs font-extrabold opacity-80">LV.1 →</span>
          </button>
          <button id="btn-start-path-diag" type="button" class="w-full py-3.5 px-4 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white font-black text-sm active:scale-95 transition text-left flex items-center justify-between">
            <span>⚡ 30초 실력 진단 테스트</span>
            <span class="text-xs font-extrabold opacity-80">추천 레벨 찾기 →</span>
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
    document.getElementById('btn-start-path-diag')?.addEventListener('click', () => handlePath('diagnostic'));
  }

  // === GameEngine 핸들러 바인딩 ===
  engine.setHandlers({
    onQuestionChanged({ word, questionNumber, totalQuestions, streak, courseId, chapterNumber, tutorialText, isTutorial }) {
      currentWordText = word?.word || '';
      stageLabel.textContent = tutorialText ? 'TUTORIAL' : `CH.${chapterNumber}`;
      questionProgress.textContent = `${questionNumber} / ${totalQuestions}`;
      ledCourseBadge.textContent = courseId ? courseId.toUpperCase() : 'LV1';
      ledStreakBadge.textContent = `★ ${streak || 0}/${BALANCE.VOCA.MASTERY_STREAK}`;
      ledWordText.textContent = currentWordText || 'READY';
      ledPhoneticText.className = 'text-xs text-emerald-200/80 font-mono mt-1.5 leading-snug';
      ledPhoneticText.textContent = tutorialText || word?.phonetic || '';

      if (btnSkipTutorial) {
        if (isTutorial) {
          btnSkipTutorial.classList.remove('hidden');
        } else {
          btnSkipTutorial.classList.add('hidden');
        }
      }
    },

    onWrongFeedback(feedbackText) {
      ledPhoneticText.className = 'text-xs text-rose-300 font-extrabold mt-1.5 leading-snug';
      ledPhoneticText.textContent = feedbackText;
    },

    onHudUpdate({ hp, maxHp, xp, xpToNext, ultGauge, evoXp, boss, edgeArrows, viewW, viewH, wrongReview }) {
      if (wrongReviewOverlay) {
        if (wrongReview) {
          wrongReviewWord.textContent = wrongReview.word || '';
          wrongReviewPhonetic.textContent = wrongReview.phonetic || '';
          wrongReviewPhonetic.classList.toggle('hidden', !wrongReview.phonetic);
          wrongReviewMeaning.textContent = `⭕ 정답: ${wrongReview.meaning || ''}`;
          wrongReviewOverlay.classList.remove('hidden');
        } else {
          wrongReviewOverlay.classList.add('hidden');
        }
      }
      const hpPct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
      const xpPct = Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100));
      hpBar.style.width = `${hpPct}%`;
      xpBar.style.width = `${xpPct}%`;

      if (skillFill && skillLabel) {
        const step = xpToNext === 3 ? Math.max(0, Math.min(3, xp)) : Math.min(3, Math.floor((xp / Math.max(1, xpToNext)) * 3));
        const skillPct = (step / 3) * 100;
        skillFill.style.width = `${skillPct.toFixed(1)}%`;
        const dots = [0, 1, 2].map((i) => (i < step ? '●' : '○')).join(' ');
        skillLabel.textContent = `⚡ 스킬 충전 ${dots} (${step}/3)`;

        if (prevSkillStep !== -1 && step > prevSkillStep && skillWrap) {
          skillWrap.classList.add('shadow-[0_0_16px_rgba(52,211,153,0.9)]', 'border-emerald-300');
          clearTimeout(skillFlashTimer);
          skillFlashTimer = setTimeout(() => {
            skillWrap.classList.remove('shadow-[0_0_16px_rgba(52,211,153,0.9)]', 'border-emerald-300');
          }, 400);
        }
        prevSkillStep = step;
      }

      hudEvoXp.textContent = String(evoXp || 0);
      const ultPct = Math.min(100, Math.round((ultGauge / BALANCE.COMBAT.ULT_MAX_GAUGE) * 100));
      hudUltPct.textContent = `${ultPct}%`;

      const ultReady = ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE;
      if (btnUlt) {
        btnUlt.disabled = !ultReady;
        btnUlt.className = ultReady
          ? 'absolute pointer-events-auto w-16 h-16 rounded-full flex flex-col items-center justify-center ult-btn-pop bg-gradient-to-br from-orange-500 via-rose-500 to-amber-500 border-2 border-amber-200 text-white shadow-[0_0_24px_rgba(249,115,22,0.85)] opacity-100 transition-all active:scale-95 z-20'
          : 'absolute pointer-events-auto w-16 h-16 rounded-full flex flex-col items-center justify-center bg-[#1b3b2b]/80 border-2 border-emerald-600/60 text-emerald-100 opacity-55 transition-all z-20';
      }
      if (btnUltLabel) {
        btnUltLabel.textContent = ultReady ? '대폭발' : `${ultPct}%`;
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

