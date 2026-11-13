/**
 * js/core/audioEngine.js
 * Web Speech API 2.5초 원어민 발음 루프 + BGM 오디오 더킹(5%) + Web Audio 효과음
 */

import { BALANCE } from '../config/balance.js';
import { getSave } from './saveStore.js';

let audioCtx = null;
let bgmGain = null;
let bgmIntervalId = null;
let bgmPlaying = false;
let isDucked = false;

let duckFallbackTimer = null;
let loopRepeatTimer = null;
let activeWord = null;
let selectedVoice = null;
let pendingSpeech = null;
let lastSpokenWord = '';
let lastSpokenAt = 0;
let bgmStep = 0;

const WORD_REPEAT_INTERVAL_MS = 2500;

const BLOCKED_NOVELTY_VOICES = [
  'zarvox', 'fred', 'whisper', 'bells', 'boing', 'cellos', 'deranged',
  'bad news', 'good news', 'trinoids', 'hysterical', 'bahh', 'albert',
  'junior', 'princess', 'ralph', 'bubbles', 'pipe organ',
];

const PREFERRED_VOICE_NAMES = [
  'Samantha',
  'Google US English',
  'Alex',
  'Daniel',
  'Google UK English Female',
  'Ava',
  'Allison',
  'Victoria',
];

function isBlockedNoveltyVoice(voice) {
  const name = (voice?.name || '').toLowerCase();
  return BLOCKED_NOVELTY_VOICES.some((bad) => name.includes(bad));
}

function selectCleanEnglishVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const cleanEnVoices = voices.filter(
    (v) => v.lang?.toLowerCase().startsWith('en') && !isBlockedNoveltyVoice(v)
  );
  if (cleanEnVoices.length === 0) return null;

  for (const preferred of PREFERRED_VOICE_NAMES) {
    const match = cleanEnVoices.find((v) => v.name?.includes(preferred));
    if (match) return match;
  }

  return (
    cleanEnVoices.find((v) => v.lang === 'en-US') ||
    cleanEnVoices.find((v) => v.lang === 'en-GB') ||
    cleanEnVoices[0]
  );
}

function refreshSelectedVoice() {
  selectedVoice = selectCleanEnglishVoice();
  return selectedVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshSelectedVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    refreshSelectedVoice();
    if (selectedVoice && pendingSpeech) {
      const req = pendingSpeech;
      pendingSpeech = null;
      if (!activeWord || req.word === activeWord) {
        audioEngine.speakWordOnce(req.word, req.onFinished);
      }
    }
  });
}

const BGM_NOTES = [261.63, 311.13, 392.0, 311.13, 293.66, 349.23, 440.0, 349.23];

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = getTargetBgmGain();
    bgmGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getTargetBgmGain() {
  const { audio } = getSave();
  if (!audio.bgmEnabled) return 0;
  const base = audio.bgmVolume ?? 0.42;
  return isDucked ? base * BALANCE.VOCA.AUDIO_DUCKING_BGM_RATIO : base;
}

function applyBgmGain(smoothSec = 0.08) {
  if (!audioCtx || !bgmGain) return;
  const target = getTargetBgmGain();
  const now = audioCtx.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
  bgmGain.gain.linearRampToValueAtTime(target, now + smoothSec);
}

function setDucking(duck) {
  isDucked = duck;
  applyBgmGain(duck ? 0.05 : 0.2);
}

/**
 * 간단한 사인/트라이앵글 톤 재생
 */
function playTone(freq, duration, type = 'sine', volume = 0.14, destNode = null) {
  const { audio } = getSave();
  if (!audio.sfxEnabled && destNode !== bgmGain) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(destNode || ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export const audioEngine = {
  /**
   * 사용자 제스처 시점에 오디오 컨텍스트 잠금 해제
   */
  unlock() {
    ensureAudioContext();
  },

  startBgm() {
    const { audio } = getSave();
    if (!audio.bgmEnabled) return;
    ensureAudioContext();
    if (bgmPlaying) {
      applyBgmGain(0.1);
      return;
    }
    bgmPlaying = true;
    bgmIntervalId = window.setInterval(() => {
      if (!bgmPlaying || !getSave().audio.bgmEnabled) return;
      const freq = BGM_NOTES[bgmStep % BGM_NOTES.length];
      bgmStep++;
      playTone(freq * 0.5, 0.24, 'triangle', 0.16, bgmGain);
    }, 360);
    applyBgmGain(0.1);
  },

  stopBgm() {
    bgmPlaying = false;
    if (bgmIntervalId !== null) {
      clearInterval(bgmIntervalId);
      bgmIntervalId = null;
    }
  },

  /**
   * 목표 영단어 원어민 발음 1회 재생 (0.4초 디바운스 + 변조 음성 제외 + 오디오 더킹)
   * @param {string} word
   * @param {(() => void)|null} [onFinished]
   */
  speakWordOnce(word, onFinished = null) {
    const { audio } = getSave();
    if (!audio.sfxEnabled || !word) {
      onFinished?.();
      return;
    }
    if (!('speechSynthesis' in window)) {
      onFinished?.();
      return;
    }

    const cleanWord = String(word).trim();
    if (!selectedVoice) {
      refreshSelectedVoice();
    }
    const voicesLoaded = (window.speechSynthesis.getVoices?.() || []).length > 0;
    if (!selectedVoice && !voicesLoaded) {
      pendingSpeech = { word: cleanWord, onFinished };
      return;
    }

    const now = Date.now();
    if (cleanWord === lastSpokenWord && now - lastSpokenAt < 400) {
      onFinished?.();
      return;
    }
    lastSpokenWord = cleanWord;
    lastSpokenAt = now;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleanWord);
      if (selectedVoice) {
        utter.voice = selectedVoice;
        utter.lang = selectedVoice.lang || 'en-US';
      } else {
        utter.lang = 'en-US';
      }
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.volume = 1.0;

      let finished = false;
      const clearDuck = () => {
        if (finished) return;
        finished = true;
        if (duckFallbackTimer !== null) {
          clearTimeout(duckFallbackTimer);
          duckFallbackTimer = null;
        }
        setDucking(false);
        onFinished?.();
      };

      utter.onstart = () => {
        setDucking(true);
      };
      utter.onend = clearDuck;
      utter.onerror = clearDuck;

      setDucking(true);
      // 모바일 브라우저에서 onend 미발생 대비 안전 복구 타이머
      duckFallbackTimer = window.setTimeout(clearDuck, 2100);
      window.speechSynthesis.speak(utter);
    } catch {
      setDucking(false);
      onFinished?.();
    }
  },

  speakWord(word, onFinished = null) {
    this.speakWordOnce(word, onFinished);
  },

  /**
   * 새 문제 출제 시 목표 영단어를 재생하고, 발음 종료 시점 기준 2.5초(2500ms) 간격으로 반복 재생
   * @param {string} word
   */
  startWordLoop(word) {
    this.stopWordLoop();
    if (!word) return;
    activeWord = word;

    const playAndSchedule = () => {
      if (!activeWord) return;
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        loopRepeatTimer = window.setTimeout(playAndSchedule, 200);
        return;
      }
      const targetWord = activeWord;
      this.speakWordOnce(targetWord, () => {
        if (activeWord !== targetWord) return;
        if (loopRepeatTimer !== null) clearTimeout(loopRepeatTimer);
        loopRepeatTimer = window.setTimeout(playAndSchedule, WORD_REPEAT_INTERVAL_MS);
      });
    };

    playAndSchedule();
  },

  /**
   * 문제 확정 / 전환 / 일시정지 시 반복 타이머 및 speechSynthesis 즉시 정지
   */
  stopWordLoop() {
    activeWord = null;
    pendingSpeech = null;
    if (loopRepeatTimer !== null) {
      clearTimeout(loopRepeatTimer);
      loopRepeatTimer = null;
    }
    if (duckFallbackTimer !== null) {
      clearTimeout(duckFallbackTimer);
      duckFallbackTimer = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setDucking(false);
  },

  /**
   * 일시정지 또는 visibilitychange 시 모든 오디오 즉시 정지
   */
  pauseAll() {
    this.stopWordLoop();
    this.stopBgm();
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    }
  },

  resumeAll() {
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.startBgm();
  },

  refreshSettings() {
    const { audio } = getSave();
    if (!audio.bgmEnabled) {
      this.stopBgm();
    } else {
      applyBgmGain(0.1);
    }
  },

  triggerHaptic(pattern = 15) {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      const raw = localStorage.getItem('zombie_voca_save_v1');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.haptic === false) return;
      }
      navigator.vibrate(pattern);
    } catch (_) {}
  },

  // === 게임 효과음 (SFX) ===
  playBark() {
    playTone(520, 0.08, 'triangle', 0.1);
    setTimeout(() => playTone(660, 0.07, 'triangle', 0.08), 45);
  },

  playHappyBark() {
    // 경쾌하고 사랑스러운 강아지 기쁨 소리 (도-미-솔-도 아르페지오 + 통통 튀는 톤)
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => playTone(f, 0.08, 'sine', 0.12), idx * 55);
    });
    setTimeout(() => playTone(880, 0.12, 'triangle', 0.14), 240);
    this.triggerHaptic(35);
  },

  playCaptureTick() {
    playTone(740, 0.05, 'sine', 0.07);
    this.triggerHaptic(12);
  },

  playCorrect() {
    playTone(523.25, 0.1, 'sine', 0.16);
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.16), 70);
    setTimeout(() => playTone(783.99, 0.18, 'sine', 0.18), 140);
    this.triggerHaptic(20);
  },

  playWrong() {
    playTone(210, 0.16, 'sawtooth', 0.12);
    setTimeout(() => playTone(165, 0.22, 'sawtooth', 0.12), 110);
    this.triggerHaptic([30, 40, 30]);
  },

  playUlt() {
    playTone(140, 0.35, 'sawtooth', 0.22);
    setTimeout(() => playTone(880, 0.25, 'triangle', 0.18), 80);
    this.triggerHaptic([40, 30, 60]);
  },

  playLaser() {
    playTone(980, 0.14, 'sawtooth', 0.15);
    setTimeout(() => playTone(440, 0.2, 'sine', 0.16), 90);
  },

  playLevelUp() {
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      setTimeout(() => playTone(f, 0.14, 'triangle', 0.15), idx * 75);
    });
  },
};

