/**
 * js/core/audioEngine.js
 * Web Speech API 2.5초 원어민 발음 루프 + BGM 오디오 더킹(5%) + Web Audio 효과음
 */

import { BALANCE } from '../config/balance.js';
import { getSave, updateSave } from './saveStore.js';
import settingsStore from '../settingsStore.js';

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

const PREFERRED_ES_VOICE_NAMES = [
  'Google español',
  'Paulina',
  'Monica',
  'Mónica',
  'Jorge',
  'Lucia',
  'Lucía',
  'Diego',
  'Rosa',
  'Soledad',
  'Carlos',
  'Francisca',
  'Juan',
];

function isBlockedNoveltyVoice(voice) {
  const name = (voice?.name || '').toLowerCase();
  return BLOCKED_NOVELTY_VOICES.some((bad) => name.includes(bad));
}

function selectCleanSpanishVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (voices.length === 0) return null;

  const cleanEsVoices = voices.filter(
    (v) => (v.lang?.toLowerCase().startsWith('es') || v.lang?.toLowerCase().includes('spanish')) && !isBlockedNoveltyVoice(v)
  );
  if (cleanEsVoices.length === 0) {
    return voices.find((v) => v.lang?.toLowerCase().startsWith('es')) || null;
  }

  // 1. Google español, Monica, Paulina, Jorge 등 원어민 대표 음성 최우선 매칭
  for (const preferred of PREFERRED_ES_VOICE_NAMES) {
    const match = cleanEsVoices.find((v) => v.name?.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }

  // 2. es-ES 또는 es-MX 원어민 음성 매칭
  const esES = cleanEsVoices.find((v) => v.lang === 'es-ES' || v.lang === 'es_ES');
  if (esES) return esES;
  const esMX = cleanEsVoices.find((v) => v.lang === 'es-MX' || v.lang === 'es_MX');
  if (esMX) return esMX;

  return (
    cleanEsVoices.find((v) => v.lang?.toLowerCase().startsWith('es')) ||
    cleanEsVoices[0]
  );
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

export function selectCleanVoiceForLang(lang = 'en') {
  if (lang === 'es') {
    return selectCleanSpanishVoice();
  }
  return selectCleanEnglishVoice();
}

function onVoicesReady() {
  if (pendingSpeech) {
    const req = pendingSpeech;
    pendingSpeech = null;
    if (!activeWord || req.word === activeWord) {
      audioEngine.speakWordOnce(req.word, req.onFinished, req.lang);
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesReady);
  window.speechSynthesis.onvoiceschanged = onVoicesReady;
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

function getBgmConfig() {
  const storeBgmVol = settingsStore?.get ? settingsStore.get('bgmVolume') : null;
  const storeBgmMuted = settingsStore?.get ? settingsStore.get('bgmMuted') : null;
  const saveAudio = getSave()?.audio || {};

  const volume = storeBgmVol !== null && storeBgmVol !== undefined ? Number(storeBgmVol) : ((saveAudio.bgmVolume ?? 0.7) * 100);
  const muted = storeBgmMuted !== null && storeBgmMuted !== undefined ? Boolean(storeBgmMuted) : (saveAudio.bgmEnabled === false);

  return { volume: Math.max(0, Math.min(100, Math.round(volume))), muted };
}

function getSfxConfig() {
  const storeSfxVol = settingsStore?.get ? settingsStore.get('sfxVolume') : null;
  const storeSfxMuted = settingsStore?.get ? settingsStore.get('sfxMuted') : null;
  const saveAudio = getSave()?.audio || {};

  const volume = storeSfxVol !== null && storeSfxVol !== undefined ? Number(storeSfxVol) : ((saveAudio.sfxVolume ?? 0.8) * 100);
  const muted = storeSfxMuted !== null && storeSfxMuted !== undefined ? Boolean(storeSfxMuted) : (saveAudio.sfxEnabled === false);

  return { volume: Math.max(0, Math.min(100, Math.round(volume))), muted };
}

function getTtsConfig() {
  const storeTtsVol = settingsStore?.get ? settingsStore.get('ttsVolume') : null;
  const storeTtsMuted = settingsStore?.get ? settingsStore.get('ttsMuted') : null;
  const storeTtsEnabled = settingsStore?.get ? settingsStore.get('ttsEnabled') : null;

  const volume = storeTtsVol !== null && storeTtsVol !== undefined ? Number(storeTtsVol) : 100;
  const muted = storeTtsMuted !== null && storeTtsMuted !== undefined ? Boolean(storeTtsMuted) : (storeTtsEnabled === false);

  return { volume: Math.max(0, Math.min(100, Math.round(volume))), muted };
}

function getTargetBgmGain() {
  const { volume, muted } = getBgmConfig();
  if (muted) return 0;
  const base = (volume / 100) * 0.42;
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
 * 간단한 사인/트라이앵글 톤 재생 (독립 SFX 볼륨 반영)
 */
function playTone(freq, duration, type = 'sine', volume = 0.14, destNode = null) {
  const { volume: sfxVol, muted } = getSfxConfig();
  if (destNode !== bgmGain && muted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const effectiveVol = destNode === bgmGain ? volume : (volume * (sfxVol / 100));
  if (effectiveVol <= 0.0001) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(effectiveVol, now + 0.012);
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
  speakWordOnce(word, onFinished = null, forcedLang = null) {
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
    const studyLang = forcedLang || getSave().studyLang || 'en';
    const isSpanish = studyLang === 'es';

    // 음성 목록이 비동기로 늦게 로드되는 환경 대비: 재생 직전 getVoices() 및 보이스 재조회 방어 로직
    const voicesLoaded = (window.speechSynthesis.getVoices?.() || []).length > 0;
    const voice = selectCleanVoiceForLang(studyLang);
    if (!voice && !voicesLoaded) {
      pendingSpeech = { word: cleanWord, onFinished, lang: studyLang };
      return;
    }

    const now = Date.now();
    if (cleanWord === lastSpokenWord && now - lastSpokenAt < 400) {
      onFinished?.();
      return;
    }
    lastSpokenWord = cleanWord;
    lastSpokenAt = now;

    const { volume: ttsVol, muted: ttsMuted } = getTtsConfig();
    if (ttsMuted || ttsVol <= 0) {
      onFinished?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleanWord);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang || (isSpanish ? 'es-ES' : 'en-US');
      } else {
        utter.lang = isSpanish ? 'es-ES' : 'en-US';
      }
      utter.rate = isSpanish ? 0.92 : 0.95;
      utter.pitch = 1.0;
      utter.volume = Math.max(0, Math.min(1, ttsVol / 100));

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

  speakWord(word, onFinished = null, forcedLang = null) {
    this.speakWordOnce(word, onFinished, forcedLang);
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

  playBossSiren() {
    const { audio } = getSave();
    if (!audio.sfxEnabled) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // 2단계 긴박한 보스 사이렌 주파수 스윕 (440Hz -> 880Hz -> 520Hz -> 960Hz, 약 1.35초)
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.55);
      osc.frequency.linearRampToValueAtTime(520, now + 0.85);
      osc.frequency.linearRampToValueAtTime(960, now + 1.35);

      const vol = (audio.sfxVolume ?? 0.5) * 0.28;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.12);
      gain.gain.setValueAtTime(vol, now + 1.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.48);
      this.triggerHaptic([60, 50, 80, 50, 100]);
    } catch {
      // ignore
    }
  },

  playLevelUp() {
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      setTimeout(() => playTone(f, 0.14, 'triangle', 0.15), idx * 75);
    });
  },

  getBgmConfig,
  getSfxConfig,
  getTtsConfig,

  setBgmVolume(val) {
    const num = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    settingsStore?.set?.('bgmVolume', num);
    updateSave?.((s) => {
      if (!s.audio) s.audio = {};
      s.audio.bgmVolume = num / 100;
    });
    applyBgmGain(0.05);
  },

  setBgmMuted(muted) {
    const isMuted = Boolean(muted);
    settingsStore?.set?.('bgmMuted', isMuted);
    updateSave?.((s) => {
      if (!s.audio) s.audio = {};
      s.audio.bgmEnabled = !isMuted;
    });
    applyBgmGain(0.05);
  },

  setSfxVolume(val) {
    const num = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    settingsStore?.set?.('sfxVolume', num);
    updateSave?.((s) => {
      if (!s.audio) s.audio = {};
      s.audio.sfxVolume = num / 100;
    });
  },

  setSfxMuted(muted) {
    const isMuted = Boolean(muted);
    settingsStore?.set?.('sfxMuted', isMuted);
    updateSave?.((s) => {
      if (!s.audio) s.audio = {};
      s.audio.sfxEnabled = !isMuted;
    });
  },

  setTtsVolume(val) {
    const num = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    settingsStore?.set?.('ttsVolume', num);
  },

  setTtsMuted(muted) {
    const isMuted = Boolean(muted);
    settingsStore?.set?.('ttsMuted', isMuted);
    settingsStore?.set?.('ttsEnabled', !isMuted);
  },

  playSampleSfx() {
    playTone(880, 0.08, 'triangle', 0.16);
  },

  playSampleTts(forcedLang = null) {
    const lang = forcedLang || (settingsStore?.get ? settingsStore.get('activeLanguage') : null) || getSave().studyLang || 'es';
    const sample = lang === 'es' ? '¡Excelente!' : 'Wonderful!';
    this.speakWordOnce(sample, null, lang);
  },
};

