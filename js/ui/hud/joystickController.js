/**
 * js/ui/hud/joystickController.js
 * 키보드(WASD / 방향키) + 터치 플로팅 가상 조이스틱 & 더블탭 필살기 입력 제어 모듈
 */

import { BALANCE } from '../../config/balance.js';
import { audioEngine } from '../../core/audioEngine.js';
import { GAME_STATES } from '../../game/gameEngine.js';

export function createJoystickController(engine, { canvas, joystickEl, joystickKnob } = {}) {
  let activePointerId = null;
  let joyOrigin = { x: 0, y: 0 };
  const JOY_MAX_RADIUS = 38;
  const keysDown = new Set();
  let lastTapTime = 0;

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
    joystickEl?.classList.add('hidden');
    if (joystickKnob) {
      joystickKnob.style.transform = 'translate(0px, 0px)';
    }
    engine.setInputVector(0, 0);
  }

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

    if (joystickEl) {
      joystickEl.style.left = `${e.clientX - 48}px`;
      joystickEl.style.top = `${e.clientY - 48}px`;
      joystickEl.classList.remove('hidden');
    }
    if (joystickKnob) {
      joystickKnob.style.transform = 'translate(0px, 0px)';
    }
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
    if (joystickKnob) {
      joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

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

  canvas?.addEventListener('pointerdown', handlePointerDown);
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

  return {
    resetJoystick,
  };
}
