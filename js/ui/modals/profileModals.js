/**
 * js/ui/modals/profileModals.js
 * 프로필, 강아지 이름 수정, CEFR 등급 심사, 환경 설정, 코스 설정 모달
 */

import { BREEDS, COSTUMES, COMPANIONS } from '../../data/catalog.js';
import { SUPPORTED_LANGUAGES, applyI18nToDOM, getLanguage, setLanguage, t } from '../../data/i18n.js';
import { getWords } from '../../data/data_en.js?v=2';
import {
  getSave,
  updateSave,
  exportSaveBase64,
  importSaveBase64,
} from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import {
  LANG_META,
  switchStudyLang,
} from '../../core/courseEngine.js';
import {
  computePlayerStats,
  getEvolutionStage,
} from '../../entities/player.js';
import { renderDogToCanvas } from '../../render/dogRenderer.js';
import { openWordLevelSelectModal } from './onboardingModals.js';
import { OWNER_WEAPONS } from '../../config/balance.js';
import { getChapterInfo } from '../../data/chapters.js';
import settingsStore from '../../settingsStore.js';

export function openEditDogNameModal(ctx, options = {}) {
  const { openModal, closeModal, refreshHeader, renderBattleTab } = ctx;
  const onSaved = typeof options === 'function' ? options : options.onSaved;
  const onCancel = options.onCancel;
  const save = getSave();
  const currentName = save.dogName || '우유';

  openModal(`
    <div class="space-y-3.5 text-center">
      <div class="text-4xl">🐾</div>
      <div>
        <h3 class="text-base font-black text-emerald-800">강아지 이름 변경</h3>
        <p class="text-xs text-[#4a584e] mt-0.5">내 강아지의 새 이름을 입력해 주세요 (최대 8자)</p>
      </div>
      <div>
        <input
          id="input-dog-name"
          type="text"
          maxlength="8"
          value="${currentName}"
          placeholder="이름 입력 (1~8자)"
          class="w-full px-3 py-2.5 rounded-xl border border-emerald-600/40 bg-[#faf6ee] text-[#1f2d24] font-black text-center text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
        />
        <div id="dog-name-error" class="text-[11px] font-bold text-rose-600 mt-1.5 hidden">이름을 1~8글자로 입력해 주세요.</div>
      </div>
      <div class="flex gap-2 pt-1">
        <button id="btn-cancel-dog-name" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">
          취소
        </button>
        <button id="btn-save-dog-name" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">
          저장
        </button>
      </div>
    </div>
  `);

  const input = document.getElementById('input-dog-name');
  input?.focus();
  input?.select();

  const doSave = () => {
    const newName = input?.value?.trim() || '';
    if (!newName || newName.length > 8) {
      const err = document.getElementById('dog-name-error');
      if (err) err.classList.remove('hidden');
      return;
    }
    updateSave((s) => {
      s.dogName = newName;
    });
    audioEngine.playCaptureTick();
    closeModal();
    refreshHeader();
    renderBattleTab();
    if (onSaved) onSaved();
  };

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave();
    }
  });

  document.getElementById('btn-cancel-dog-name')?.addEventListener('click', () => {
    closeModal();
    if (onCancel) onCancel();
  });
  document.getElementById('btn-save-dog-name')?.addEventListener('click', doSave);
}

export function openCefrModal(ctx) {
  const { openModal, closeModal, onStartBattle } = ctx;
  const save = getSave();
  const curLevel = save.certifiedLevel || 'A1';
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const CEFR_NAMES = {
    A1: '입문 (Beginner)',
    A2: '초급 (Elementary)',
    B1: '중급 (Intermediate)',
    B2: '중고급 (Upper-Int.)',
    C1: '고급 (Advanced)',
    C2: '최고급 (Mastery)',
  };

  const allWords = getWords();
  const statsObj = save.wordStats || {};

  const levelStats = CEFR_LEVELS.map((lvl) => {
    const wordsAtLvl = allWords.filter((w) => w.level === lvl);
    const total = wordsAtLvl.length;
    let mastered = 0;
    wordsAtLvl.forEach((w) => {
      const st = statsObj[w.id];
      if (st && ((st.correct || 0) >= 3 || st.mastered)) {
        mastered++;
      }
    });
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { level: lvl, name: CEFR_NAMES[lvl] || lvl, total, mastered, pct };
  });

  const curIdx = CEFR_LEVELS.indexOf(curLevel);
  const nextLevel = curIdx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[curIdx + 1] : null;

  const cardsHtml = levelStats.map((item, idx) => {
    const isAcquired = idx <= curIdx;
    const isNext = idx === curIdx + 1;
    let statusBadge = '';
    if (isAcquired) {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">취득 완료 🏅</span>';
    } else if (isNext) {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">승급 대상 ⚔️</span>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded-full bg-[#e6dec8] text-[#7d8c80] text-[10px] font-bold">잠김 🔒</span>';
    }

    return `
      <div class="p-2.5 rounded-xl ${isNext ? 'bg-[#faf6ee] border-2 border-amber-500/50 shadow-sm' : isAcquired ? 'bg-[#f0ebe0] border border-[#d2c8b4]' : 'bg-[#e6dec8]/50 border border-[#d2c8b4]/60 opacity-60'} flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-8 h-8 rounded-lg ${isAcquired ? 'bg-emerald-600 text-white' : isNext ? 'bg-amber-500 text-white' : 'bg-[#d2c8b4] text-[#4a584e]'} flex items-center justify-center text-xs font-black shrink-0">${item.level}</span>
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-[#1f2d24] truncate">${item.name}</div>
            <div class="text-[10px] font-bold text-[#5c6e60]">${item.mastered}/${item.total} 단어 마스터 (${item.pct}%)</div>
          </div>
        </div>
        <div class="shrink-0">${statusBadge}</div>
      </div>
    `;
  }).join('');

  openModal(`
    <div class="space-y-3.5">
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🎓</span>
          <span>CEFR 공인 등급 심사</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>

      <div class="p-3 rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl font-black text-white shadow-md">${curLevel}</div>
          <div>
            <div class="text-xs font-black text-[#1f2d24]">현재 공인 등급: <span class="text-amber-700">${curLevel}</span></div>
            <div class="text-[10px] text-[#4a584e] mt-0.5">${CEFR_NAMES[curLevel] || ''}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-bold text-[#4a584e]">보스 승급 시험</div>
          <div class="text-xs font-black text-emerald-700">${nextLevel ? `${nextLevel} 승급 도전` : '최고 등급 달성'}</div>
        </div>
      </div>

      <div class="space-y-1.5 max-h-[42dvh] overflow-y-auto pr-0.5">
        ${cardsHtml}
      </div>

      <div class="pt-1">
        ${nextLevel ? `
          <button id="btn-cefr-promotion" type="button" class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>⚔️</span>
            <span>${nextLevel} 승급 심사 보스전 도전</span>
          </button>
        ` : `
          <button id="btn-close-cefr" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer">
            확인
          </button>
        `}
      </div>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-cefr')?.addEventListener('click', closeModal);
  document.getElementById('btn-cefr-promotion')?.addEventListener('click', () => {
    closeModal();
    onStartBattle?.({ isPromotion: true, targetLevel: nextLevel });
  });
}


function renderLanguageTilesHtml(curStudyLang) {
  const isEn = curStudyLang === 'en';
  const isEs = curStudyLang === 'es';

  return `
    <div class="space-y-2">
      <div class="text-[10px] text-emerald-950 font-bold bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-400/60 leading-relaxed shadow-xs">
        ℹ️ 계정 공통 유료 자산/스킨은 유지되며, 새 언어는 독립 세이브 프로필로 시작됩니다.
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-switch-lang="en"
          class="btn-lang-tile p-3 rounded-2xl border text-center font-black active:scale-95 transition cursor-pointer ${
            isEn
              ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-400/50'
              : 'border-[#d2c8b4] bg-[#faf6ee] text-[#1f2d24] hover:bg-emerald-50/60'
          }"
        >
          <div class="text-3xl mb-1">🇺🇸</div>
          <div class="text-xs font-black">영어 (English)</div>
          <div class="text-[9.5px] font-bold ${isEn ? 'text-emerald-700' : 'text-[#5c6e60]'} mt-0.5">
            ${isEn ? '학습 중 ✓' : '선택하기 ➔'}
          </div>
        </button>
        <button
          type="button"
          data-switch-lang="es"
          class="btn-lang-tile p-3 rounded-2xl border text-center font-black active:scale-95 transition cursor-pointer ${
            isEs
              ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-400/50'
              : 'border-[#d2c8b4] bg-[#faf6ee] text-[#1f2d24] hover:bg-emerald-50/60'
          }"
        >
          <div class="text-3xl mb-1">🇪🇸</div>
          <div class="text-xs font-black">스페인어 (Español)</div>
          <div class="text-[9.5px] font-bold ${isEs ? 'text-emerald-700' : 'text-[#5c6e60]'} mt-0.5">
            ${isEs ? '학습 중 ✓' : '선택하기 ➔'}
          </div>
        </button>
      </div>
    </div>
  `;
}

function renderSoundControlsHtml() {
  const bgmCfg = typeof audioEngine?.getBgmConfig === 'function' ? audioEngine.getBgmConfig() : { volume: 70, muted: false };
  const sfxCfg = typeof audioEngine?.getSfxConfig === 'function' ? audioEngine.getSfxConfig() : { volume: 80, muted: false };
  const ttsCfg = typeof audioEngine?.getTtsConfig === 'function' ? audioEngine.getTtsConfig() : { volume: 100, muted: false };

  return `
    <div class="space-y-2">
      <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
        <span class="flex items-center gap-1.5">
          <span>🔊</span>
          <span>사운드 & 볼륨 조절 (독립 3채널)</span>
        </span>
      </div>

      <div class="space-y-1.5">
        <!-- 1. BGM -->
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1.5 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-[#1f2d24] flex items-center gap-1">🎵 배경음악 (BGM)</span>
            <div class="flex items-center gap-2">
              <span id="label-vol-bgm" class="font-mono font-black text-emerald-800 text-[11px]">${bgmCfg.volume}%</span>
              <button id="btn-mute-bgm" type="button" class="px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
                bgmCfg.muted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
              }">
                ${bgmCfg.muted ? '🔇 음소거' : '🔊 켜짐'}
              </button>
            </div>
          </div>
          <input id="slider-vol-bgm" type="range" min="0" max="100" value="${bgmCfg.volume}" ${bgmCfg.muted ? 'disabled' : ''} class="w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${bgmCfg.muted ? 'opacity-40 cursor-not-allowed' : ''}">
        </div>

        <!-- 2. SFX -->
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1.5 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-[#1f2d24] flex items-center gap-1">🔔 효과음 (SFX)</span>
            <div class="flex items-center gap-2">
              <span id="label-vol-sfx" class="font-mono font-black text-emerald-800 text-[11px]">${sfxCfg.volume}%</span>
              <button id="btn-mute-sfx" type="button" class="px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
                sfxCfg.muted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
              }">
                ${sfxCfg.muted ? '🔇 음소거' : '🔊 켜짐'}
              </button>
            </div>
          </div>
          <input id="slider-vol-sfx" type="range" min="0" max="100" value="${sfxCfg.volume}" ${sfxCfg.muted ? 'disabled' : ''} class="w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${sfxCfg.muted ? 'opacity-40 cursor-not-allowed' : ''}">
        </div>

        <!-- 3. TTS -->
        <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] space-y-1.5 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-[#1f2d24] flex items-center gap-1">🗣️ 원어민 음성 (TTS)</span>
            <div class="flex items-center gap-2">
              <span id="label-vol-tts" class="font-mono font-black text-emerald-800 text-[11px]">${ttsCfg.volume}%</span>
              <button id="btn-test-tts" type="button" class="px-1.5 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 text-[10px] font-black cursor-pointer active:scale-95">
                🔊 샘플
              </button>
              <button id="btn-mute-tts" type="button" class="px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
                ttsCfg.muted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
              }">
                ${ttsCfg.muted ? '🔇 음소거' : '🔊 켜짐'}
              </button>
            </div>
          </div>
          <input id="slider-vol-tts" type="range" min="0" max="100" value="${ttsCfg.volume}" ${ttsCfg.muted ? 'disabled' : ''} class="w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${ttsCfg.muted ? 'opacity-40 cursor-not-allowed' : ''}">
        </div>
      </div>
    </div>
  `;
}

function attachSoundEvents() {
  const sliderBgm = document.getElementById('slider-vol-bgm');
  const labelBgm = document.getElementById('label-vol-bgm');
  const btnMuteBgm = document.getElementById('btn-mute-bgm');

  const sliderSfx = document.getElementById('slider-vol-sfx');
  const labelSfx = document.getElementById('label-vol-sfx');
  const btnMuteSfx = document.getElementById('btn-mute-sfx');

  const sliderTts = document.getElementById('slider-vol-tts');
  const labelTts = document.getElementById('label-vol-tts');
  const btnMuteTts = document.getElementById('btn-mute-tts');
  const btnTestTts = document.getElementById('btn-test-tts');

  sliderBgm?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    audioEngine.setBgmVolume?.(val);
    if (labelBgm) labelBgm.textContent = `${val}%`;
  });

  btnMuteBgm?.addEventListener('click', () => {
    const cfg = audioEngine.getBgmConfig?.() || { muted: false };
    const nextMuted = !cfg.muted;
    audioEngine.setBgmMuted?.(nextMuted);
    if (btnMuteBgm) {
      btnMuteBgm.textContent = nextMuted ? '🔇 음소거' : '🔊 켜짐';
      btnMuteBgm.className = `px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
        nextMuted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
      }`;
    }
    if (sliderBgm) {
      sliderBgm.disabled = nextMuted;
      sliderBgm.className = `w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${nextMuted ? 'opacity-40 cursor-not-allowed' : ''}`;
    }
  });

  sliderSfx?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    audioEngine.setSfxVolume?.(val);
    if (labelSfx) labelSfx.textContent = `${val}%`;
    audioEngine.playSampleSfx?.();
  });

  btnMuteSfx?.addEventListener('click', () => {
    const cfg = audioEngine.getSfxConfig?.() || { muted: false };
    const nextMuted = !cfg.muted;
    audioEngine.setSfxMuted?.(nextMuted);
    if (btnMuteSfx) {
      btnMuteSfx.textContent = nextMuted ? '🔇 음소거' : '🔊 켜짐';
      btnMuteSfx.className = `px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
        nextMuted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
      }`;
    }
    if (sliderSfx) {
      sliderSfx.disabled = nextMuted;
      sliderSfx.className = `w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${nextMuted ? 'opacity-40 cursor-not-allowed' : ''}`;
    }
  });

  sliderTts?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    audioEngine.setTtsVolume?.(val);
    if (labelTts) labelTts.textContent = `${val}%`;
  });

  sliderTts?.addEventListener('change', () => {
    audioEngine.playSampleTts?.();
  });

  btnTestTts?.addEventListener('click', () => {
    audioEngine.playSampleTts?.();
  });

  btnMuteTts?.addEventListener('click', () => {
    const cfg = audioEngine.getTtsConfig?.() || { muted: false };
    const nextMuted = !cfg.muted;
    audioEngine.setTtsMuted?.(nextMuted);
    if (btnMuteTts) {
      btnMuteTts.textContent = nextMuted ? '🔇 음소거' : '🔊 켜짐';
      btnMuteTts.className = `px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer active:scale-95 ${
        nextMuted ? 'bg-stone-300 text-stone-700' : 'bg-emerald-600 text-white'
      }`;
    }
    if (sliderTts) {
      sliderTts.disabled = nextMuted;
      sliderTts.className = `w-full h-1.5 rounded-lg accent-emerald-600 cursor-pointer ${nextMuted ? 'opacity-40 cursor-not-allowed' : ''}`;
    }
  });
}

export const PROFILE_AVATARS = Object.freeze([
  { id: 'pomeranian', icon: '🐶', name: '우유', breedId: 'pomeranian' },
  { id: 'french_bulldog', icon: '🐾', name: '불리', breedId: 'french_bulldog' },
  { id: 'beagle', icon: '🐶', name: '바우', breedId: 'beagle' },
  { id: 'corgi', icon: '🦊', name: '코기', breedId: 'corgi' },
  { id: 'retriever', icon: '🦮', name: '인절미', breedId: 'retriever' },
  { id: 'owner_male', icon: '🧑', name: '민우' },
  { id: 'owner_female', icon: '👧', name: '지우' },
  { id: 'hero_shield', icon: '🛡️', name: '수호대' },
]);

function attachLanguageTileEvents(ctx, curStudyLang, onRefresh) {
  document.querySelectorAll('.btn-lang-tile').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = btn.getAttribute('data-switch-lang');
      if (!chosen) return;
      if (chosen === curStudyLang) {
        audioEngine.playCaptureTick?.();
        return;
      }

      const targetMeta = LANG_META[chosen] || { name: chosen === 'es' ? '스페인어' : '영어', flag: chosen === 'es' ? '🇪🇸' : '🇺🇸' };

      ctx.openModal(`
        <div class="space-y-3.5 py-1 text-center select-none">
          <div class="text-4xl">${targetMeta.flag}</div>
          <div class="space-y-1">
            <h3 class="text-base font-black text-[#1f2d24]">${targetMeta.name} 여정을 시작합니다!</h3>
            <p class="text-xs text-[#5c6e60] font-bold leading-relaxed break-keep">
              내 실력에 맞는 레벨 진단을 위해 12문제 테스트를 진행할까요?
            </p>
          </div>
          <div class="space-y-2 pt-2">
            <button
              id="btn-confirm-lang-test"
              type="button"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🎯</span>
              <span>12문제 테스트 시작 ➔</span>
            </button>
            <button
              id="btn-confirm-lang-novice"
              type="button"
              class="w-full py-2.5 rounded-xl bg-[#eee7d7] hover:bg-[#e4ddcc] text-[#1f2d24] font-black text-xs border border-[#d2c8b4] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🐣</span>
              <span>왕초보부터 시작</span>
            </button>
            <button
              id="btn-cancel-lang-switch"
              type="button"
              class="w-full py-2 text-[11px] text-[#5c6e60] font-bold hover:text-[#1f2d24] cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      `);

      document.getElementById('btn-cancel-lang-switch')?.addEventListener('click', () => {
        onRefresh ? onRefresh() : ctx.closeModal();
      });

      document.getElementById('btn-confirm-lang-test')?.addEventListener('click', () => {
        settingsStore.switchLanguage(chosen);
        switchStudyLang(chosen);
        updateSave((s) => {
          s.studyLang = chosen;
          s.hasSelectedWordLevel = false;
        });
        audioEngine.playPowerUp?.();
        ctx.closeModal();
        ctx.refreshHeader?.();
        ctx.renderActiveTab?.();
        ctx.renderBattleTab?.();
        ctx.onStartBattle?.({
          chapterNumber: 1,
          courseId: 'lv1',
          unitId: 'unit_001',
          isPlacement: true,
          isPlacementTest: true,
          targetUnitNum: 1,
        });
      });

      document.getElementById('btn-confirm-lang-novice')?.addEventListener('click', () => {
        settingsStore.switchLanguage(chosen);
        switchStudyLang(chosen);
        updateSave((s) => {
          s.studyLang = chosen;
          s.hasSelectedWordLevel = true;
          s.wordLevelTier = 'novice';
          s.wordUnitOffset = 0;
          s.selectedLevelLabel = '왕초보';
          if (s.courseProgress && s.courseProgress[chosen]) {
            s.courseProgress[chosen].cefr = 'A1';
          }
        });
        audioEngine.playPowerUp?.();
        ctx.refreshHeader?.();
        ctx.renderActiveTab?.();
        ctx.renderBattleTab?.();
        onRefresh ? onRefresh() : ctx.closeModal();
      });
    });
  });
}


export function openProfileModal(ctx) {
  const { openModal, closeModal, refreshHeader, renderActiveTab, renderBattleTab, getProfileProgress } = ctx;
  const save = getSave();
  const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
    ? settingsStore.getCurrentProfile()
    : save;

  const curBreedId = save.selectedBreed || 'pomeranian';
  const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
  const evo = getEvolutionStage(save);
  const certLevel = save.certifiedLevel || 'A1';

  const dogName = profile.dogName || save.dogName || profile.petName || '우유';
  const ownerName = profile.ownerName || save.ownerName || '민우';

  const curStudyLang = (typeof settingsStore !== 'undefined' && settingsStore.get ? settingsStore.get('activeLanguage') : null) || save.studyLang || 'es';
  const curLevelLabel = save.selectedLevelLabel || '왕초보';

  const stats = computePlayerStats(save);
  const { pct: progressPct, mastered: levelMasteredCount, total: levelTotalCount } = getProfileProgress(save);

  const curAvatarId = save.profileAvatarId || save.profileAvatarBreedId || curBreedId;
  const avatarListHtml = PROFILE_AVATARS.map((av) => {
    const isSelected = av.id === curAvatarId;
    return `
      <button
        type="button"
        data-profile-avatar-id="${av.id}"
        class="relative shrink-0 p-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer ${
          isSelected
            ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs'
            : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
        }"
        title="${av.name}"
      >
        <div class="relative w-10 h-10 rounded-lg bg-[#f0ebe0] flex items-center justify-center text-xl shadow-inner">
          <span>${av.icon}</span>
          ${isSelected ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center shadow">✓</span>' : ''}
        </div>
        <span class="text-[9.5px] font-black text-[#1f2d24] mt-1 max-w-[50px] truncate text-center">${av.name}</span>
      </button>
    `;
  }).join('');

  openModal(`
    <div class="space-y-3.5 max-h-[85vh] overflow-y-auto pr-1 select-none text-left">
      <!-- 상단 헤더 -->
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🐶</span>
          <span>모험가 & 파트너 통합 프로필</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>

      <!-- 1. 반려견 & 파트너 정보 카드 -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-[#234735] to-[#1b3b2b] text-[#f8f5ec] shadow-md flex items-center gap-3.5 border border-[#2d5a43]">
        <div class="w-16 h-16 rounded-2xl bg-[#142c20]/70 border-2 border-[#2d5a43] flex items-center justify-center shrink-0 overflow-hidden shadow-inner relative">
          <canvas id="profile-dog-canvas" width="64" height="64" class="w-16 h-16 block"></canvas>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base font-black text-amber-200 truncate">${dogName}</span>
            <span class="text-xs font-bold text-emerald-200/90">(${curBreed.name})</span>
          </div>
          <div class="text-[11px] text-[#e6dec8] font-bold mt-0.5">
            파트너 주인: <b class="text-white">${ownerName}</b> · ${t(evo.key)}
          </div>
          <div class="mt-1.5 flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-[10px] font-black text-amber-300 shadow-xs">
              🏅 공인 등급: ${certLevel}
            </span>
            <div class="flex items-center gap-1.5">
              <div class="w-16 h-1.5 rounded-full bg-[#142c20] border border-[#2d5a43] overflow-hidden" title="등급 마스터 진행도: ${levelMasteredCount}/${levelTotalCount} (${progressPct}%)">
                <div class="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
              </div>
              <span class="text-[10px] font-black text-emerald-300 tabular-nums">${progressPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 프로필 아바타 선택 (독립 프로필 사진) -->
      <div class="p-2.5 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-1.5">
        <div class="flex items-center justify-between px-0.5">
          <div class="flex items-center gap-1.5 text-xs font-bold text-[#4a584e]">
            <span>📷</span>
            <span>프로필 아바타 선택</span>
          </div>
          <span class="text-[9.5px] font-semibold text-[#5c6e60]">터치하여 프로필 사진 변경</span>
        </div>
        <div class="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar">
          ${avatarListHtml}
        </div>
      </div>

      <!-- 3. 이름 즉시 수정 (강아지 이름 & 주인 이름) -->
      <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2">
        <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
          <span>✏️</span>
          <span>이름 수정 (터치하여 즉시 변경)</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-[#5c6e60] mb-0.5">🐕 강아지 이름</label>
            <input id="input-profile-dog-name" type="text" maxlength="8" value="${dogName}" class="w-full py-1.5 px-2 rounded-xl bg-white border border-[#d2c8b4] font-black text-xs text-[#1f2d24] focus:outline-none focus:ring-1 focus:ring-emerald-600">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#5c6e60] mb-0.5">🧑 주인 이름</label>
            <input id="input-profile-owner-name" type="text" maxlength="8" value="${ownerName}" class="w-full py-1.5 px-2 rounded-xl bg-white border border-[#d2c8b4] font-black text-xs text-[#1f2d24] focus:outline-none focus:ring-1 focus:ring-emerald-600">
          </div>
        </div>
        <button id="btn-save-profile-names" type="button" class="w-full py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer">
          <span>💾</span>
          <span>이름 저장</span>
        </button>
      </div>

      <!-- 4. 학습 언어 전환 대형 선택 타일 2개 -->
      <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-bold text-[#4a584e]">
            <span>🌐</span>
            <span>학습 언어 전환</span>
          </div>
          <button id="btn-profile-change-level" type="button" class="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black active:scale-95 transition cursor-pointer">
            🎯 레벨 재조정
          </button>
        </div>
        ${renderLanguageTilesHtml(curStudyLang)}
      </div>

      <!-- 5. 사운드 3분할 독립 볼륨 조절 -->
      <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2">
        ${renderSoundControlsHtml()}
      </div>

      <button id="btn-close-profile" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer">
        확인
      </button>
    </div>
  `);

  renderDogToCanvas('profile-dog-canvas', {
    save,
    breedId: curBreedId,
    scale: 1.15,
    offsetY: 5,
  });

  // 프로필 아바타 선택
  document.querySelectorAll('[data-profile-avatar-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const avId = btn.getAttribute('data-profile-avatar-id');
      const av = PROFILE_AVATARS.find((a) => a.id === avId);
      if (!av) return;
      updateSave((s) => {
        s.profileAvatarId = av.id;
        if (av.breedId) {
          s.profileAvatarBreedId = av.breedId;
        }
        s.profileAvatarIcon = av.icon;
      });
      const prof = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
        ? settingsStore.getCurrentProfile()
        : null;
      if (prof) {
        prof.profileAvatarId = av.id;
        if (av.breedId) prof.profileAvatarBreedId = av.breedId;
        prof.profileAvatarIcon = av.icon;
        settingsStore.saveCurrentProfile?.();
      }
      audioEngine.playCaptureTick?.();
      refreshHeader?.();
      openProfileModal(ctx);
    });
  });

  // 이름 저장
  const dogInput = document.getElementById('input-profile-dog-name');
  const ownerInput = document.getElementById('input-profile-owner-name');
  const saveBtn = document.getElementById('btn-save-profile-names');

  const handleSaveNames = () => {
    const newDog = (dogInput?.value || '').trim() || dogName;
    const newOwner = (ownerInput?.value || '').trim() || ownerName;

    updateSave((s) => {
      s.dogName = newDog;
      s.ownerName = newOwner;
    });

    const prof = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : null;
    if (prof) {
      prof.dogName = newDog;
      prof.ownerName = newOwner;
      if (prof.ownerState) prof.ownerState.ownerName = newOwner;
      settingsStore.saveCurrentProfile?.();
    }

    audioEngine.playCaptureTick?.();
    refreshHeader?.();
    renderBattleTab?.();

    if (saveBtn) {
      const oldHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span>✓</span><span>저장 완료!</span>';
      saveBtn.classList.remove('bg-emerald-700', 'hover:bg-emerald-800');
      saveBtn.classList.add('bg-teal-600');
      setTimeout(() => {
        if (saveBtn) {
          saveBtn.innerHTML = oldHtml;
          saveBtn.classList.remove('bg-teal-600');
          saveBtn.classList.add('bg-emerald-700', 'hover:bg-emerald-800');
        }
      }, 1500);
    }
  };

  saveBtn?.addEventListener('click', handleSaveNames);

  // 학습 언어 전환 타일 이벤트 바인딩
  attachLanguageTileEvents(ctx, curStudyLang, () => openProfileModal(ctx));

  // 사운드 슬라이더 이벤트 바인딩
  attachSoundEvents();

  // 레벨 변경 / 재테스트
  document.getElementById('btn-profile-change-level')?.addEventListener('click', () => {
    openWordLevelSelectModal(ctx, {
      isChange: true,
      onSelectTier: (tier) => {
        updateSave((s) => {
          s.hasSelectedWordLevel = true;
          s.wordLevelTier = tier.id;
          s.wordUnitOffset = Number(tier.unitOffset) || 0;
          s.selectedLevelLabel = tier.badgeLabel;
          if (s.courseProgress && s.studyLang && s.courseProgress[s.studyLang]) {
            s.courseProgress[s.studyLang].cefr = tier.cefr;
          }
        });
        refreshHeader?.();
        renderActiveTab?.();
        openProfileModal(ctx);
      },
    });
  });

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-profile')?.addEventListener('click', closeModal);
}

export function openSettingsModal(ctx) {
  const { openModal, closeModal, refreshHeader, renderActiveTab } = ctx;
  const save = getSave();
  const curLang = getLanguage();
  const curStudyLang = (typeof settingsStore !== 'undefined' && settingsStore.get ? settingsStore.get('activeLanguage') : null) || save.studyLang || 'es';
  const hapticOn = save.haptic !== false;
  const lowFxOn = Boolean(save.lowFx);

  openModal(`
    <div class="space-y-3.5 max-h-[85vh] overflow-y-auto pr-1 select-none text-left">
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>⚙️</span>
          <span>${t('modal.settingsTitle')}</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>

      <!-- 1. 앱 UI 표시 언어 (한국어 / 영어 / 일본어 / 스페인어) -->
      <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between gap-2">
        <div class="text-xs font-bold text-[#1f2d24] flex items-center gap-1.5">
          <span>🌐</span>
          <span>${t('modal.languageLabel')}</span>
        </div>
        <select id="select-settings-lang" class="py-1 px-2.5 rounded-lg bg-[#faf6ee] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] focus:outline-none focus:ring-1 focus:ring-[#2d6a4f] cursor-pointer">
          ${SUPPORTED_LANGUAGES.map((l) => `<option value="${l.code}" ${curLang === l.code ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
      </div>

      <!-- 2. 학습 언어 변경 대형 타일 2개 -->
      <div class="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500/60 shadow-xs space-y-2">
        <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🎓</span>
          <span>학습 언어 전환 (독립 프로필)</span>
        </div>
        ${renderLanguageTilesHtml(curStudyLang)}
      </div>

      <!-- 3. 사운드 3분할 독립 볼륨 슬라이더 -->
      <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2">
        ${renderSoundControlsHtml()}
      </div>

      <!-- 4. 진동 & 저사양 모드 -->
      <div class="space-y-1.5">
        <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
          <span>📳</span>
          <span>디바이스 & 그래픽</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-toggle-haptic" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 cursor-pointer ${
            hapticOn
              ? 'bg-[#f0ebe0] border-[#2d6a4f] text-[#1f2d24]'
              : 'bg-[#e6dec8] border-[#d2c8b4] text-[#7d8c80]'
          }">
            <span>${t('modal.hapticLabel')}</span>
            <span class="font-black ${hapticOn ? 'text-[#2d6a4f]' : 'text-stone-500'}">${hapticOn ? '📳 ON' : 'OFF'}</span>
          </button>
          <button id="btn-toggle-lowfx" type="button" class="p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition active:scale-95 cursor-pointer ${
            lowFxOn
              ? 'bg-amber-100 border-amber-600/50 text-amber-900'
              : 'bg-[#f0ebe0] border-[#d2c8b4] text-[#1f2d24]'
          }">
            <span>${t('modal.lowFxLabel')}</span>
            <span class="font-black ${lowFxOn ? 'text-amber-700' : 'text-stone-500'}">${lowFxOn ? '⚡ ON' : 'OFF'}</span>
          </button>
        </div>
        <p class="text-[10px] text-[#5f6c62] px-0.5">※ 저사양 모드: 배터리 절약 및 부드러운 프레임 유지</p>
      </div>

      <!-- 5. 데이터 백업 / 복원 / 초기화 -->
      <div class="space-y-1.5 pt-2 border-t border-[#d2c8b4]">
        <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
          <span>💾</span>
          <span>데이터 관리</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-backup-save" type="button" class="py-2.5 px-2 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dfd1] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
            <span>📋</span>
            <span>세이브 백업</span>
          </button>
          <button id="btn-restore-save" type="button" class="py-2.5 px-2 rounded-xl bg-[#f0ebe0] hover:bg-[#e6dfd1] border border-[#d2c8b4] text-xs font-bold text-[#1f2d24] flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
            <span>📥</span>
            <span>데이터 복원</span>
          </button>
        </div>
        <button id="btn-reset-save" type="button" class="w-full py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-[11px] font-bold text-rose-700 flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer">
          <span>🗑️ 데이터 초기화</span>
        </button>
      </div>

      <!-- 6. 피드백 -->
      <div class="pt-1">
        <button id="btn-feedback" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-xs cursor-pointer">
          <span>${t('modal.sendFeedback')}</span>
        </button>
      </div>
    </div>
  `);

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

  // 언어 타일 바인딩
  attachLanguageTileEvents(ctx, curStudyLang, () => openSettingsModal(ctx));

  // 사운드 슬라이더 바인딩
  attachSoundEvents();

  // 앱 언어 선택 바인딩
  document.getElementById('select-settings-lang')?.addEventListener('change', (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    applyI18nToDOM();
    refreshHeader?.();
    renderActiveTab?.();
    openSettingsModal(ctx);
  });

  document.getElementById('btn-toggle-haptic')?.addEventListener('click', () => {
    updateSave((s) => {
      s.haptic = !hapticOn;
    });
    audioEngine.playCaptureTick?.();
    openSettingsModal(ctx);
  });

  document.getElementById('btn-toggle-lowfx')?.addEventListener('click', () => {
    updateSave((s) => {
      s.lowFx = !lowFxOn;
    });
    audioEngine.playCaptureTick?.();
    openSettingsModal(ctx);
  });

  document.getElementById('btn-backup-save')?.addEventListener('click', async () => {
    try {
      const code = exportSaveBase64();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        alert(t('modal.backupSuccess') || '세이브 코드가 클립보드에 복사되었습니다.');
      } else {
        prompt('아래 세이브 코드를 복사하세요:', code);
      }
    } catch (err) {
      prompt('아래 세이브 코드를 복사하세요:', exportSaveBase64());
    }
  });

  document.getElementById('btn-restore-save')?.addEventListener('click', () => {
    const input = prompt('복원할 세이브 코드를 붙여넣으세요:');
    if (!input) return;
    const res = importSaveBase64(input.trim());
    if (res.ok) {
      alert(t('modal.restoreSuccess') || '데이터가 성공적으로 복원되었습니다!');
      applyI18nToDOM();
      refreshHeader();
      renderActiveTab();
      closeModal();
    } else {
      alert(t('modal.restoreError') || '올바르지 않은 세이브 코드입니다.');
    }
  });

  document.getElementById('btn-reset-save')?.addEventListener('click', () => {
    const confirmed = confirm('정말 모든 데이터를 초기화하고 처음부터 다시 시작하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
    if (confirmed) {
      localStorage.removeItem('zombie_voca_save_v1');
      window.location.reload();
    }
  });

  document.getElementById('btn-feedback')?.addEventListener('click', () => {
    const email = 'support@zombievoca.com';
    const subject = encodeURIComponent(`[영단어 특공대 피드백] ${save.dogName} (Lv.${save.certifiedLevel})`);
    window.open(`mailto:${email}?subject=${subject}`, '_blank');
  });
}

export function openOwnerCompanionModal(ctx, initialTab = 'owner') {
  const { openModal, closeModal, refreshHeader, renderBattleTab } = ctx;
  const save = getSave();
  const profile = settingsStore.getCurrentProfile ? settingsStore.getCurrentProfile() : save;
  const curStage = Number(profile.stage) || 1;
  const chInfo = getChapterInfo(curStage);

  if (!profile.ownerState) {
    profile.ownerState = {
      recoveryStage: 1,
      cureProgress: 0,
      gear: { backpack: 1, shoes: 1, outfit: 1, weapon: 1 },
      materials: { cloth: 0, bandage: 0, parts: 0, herb: 0 },
    };
  }
  const ownerState = profile.ownerState;
  if (!ownerState.gear) ownerState.gear = { backpack: 1, shoes: 1, outfit: 1, weapon: 1 };
  if (!ownerState.materials) ownerState.materials = { cloth: 0, bandage: 0, parts: 0, herb: 0 };
  const gear = ownerState.gear;
  const materials = ownerState.materials;

  if (!Array.isArray(profile.unlockedOwnerWeapons)) profile.unlockedOwnerWeapons = ['stone'];
  const unlockedWeapons = profile.unlockedOwnerWeapons;
  const equippedWeaponId = profile.equippedOwnerWeapon || 'stone';

  if (!profile.companions) {
    profile.companions = { unlocked: [], activeGround: null, activeRider: null, levels: {} };
  }
  const compData = profile.companions;
  const activeGroundId = compData.activeGround || null;
  const activeRiderId = compData.activeRider || compData.activeAir || null;
  const bremenUnlocked = Boolean(profile.bremenUnlocked || curStage >= 60);

  let currentTab = initialTab;

  const render = () => {
    const isOwner = currentTab === 'owner';
    const equippedWeaponDef = OWNER_WEAPONS[equippedWeaponId] || OWNER_WEAPONS.stone;

    const groundComp = COMPANIONS.find((c) => c.id === activeGroundId);
    const riderComp = COMPANIONS.find((c) => c.id === activeRiderId);

    const unlockedCompanionsList = COMPANIONS.filter((c) => (compData.unlocked || []).includes(c.id));

    openModal(`
      <div class="space-y-3.5 max-h-[85vh] overflow-y-auto pr-0.5">
        <!-- 헤더 -->
        <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
          <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
            <span>🧟</span>
            <span>주인 & 동료 관리</span>
          </h2>
          <button id="btn-close-owner-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
        </div>

        <!-- 2단 탭 바 -->
        <div class="grid grid-cols-2 gap-1.5 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-xs font-black">
          <button id="tab-btn-owner" type="button" class="py-2 rounded-lg transition active:scale-95 cursor-pointer ${isOwner ? 'bg-[#2d6a4f] text-white shadow-sm' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
            🧑 주인 회복 & 4대 장비
          </button>
          <button id="tab-btn-bremen" type="button" class="py-2 rounded-lg transition active:scale-95 cursor-pointer ${!isOwner ? 'bg-[#2d6a4f] text-white shadow-sm' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
            🐾 브레멘 동물 합체
          </button>
        </div>

        ${isOwner ? `
          <!-- [탭 1: 주인 회복 & 4대 장비] -->
          <div class="space-y-3 text-left">
            <!-- 1. 거점 및 회복 현황 카드 -->
            <div class="p-3 bg-gradient-to-br from-[#faf6ee] to-[#f0ebe0] border border-[#d2c8b4] rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs font-black">
                <span class="text-[#1f2d24]">📍 거점: <b class="text-emerald-800">${chInfo.base}</b></span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  회복 Lv.${ownerState.recoveryStage || 1} / 5
                </span>
              </div>
              <div class="space-y-1">
                <div class="flex justify-between text-[11px] font-bold text-[#4a584e]">
                  <span>보카-큐어 백신 치료도</span>
                  <span class="text-emerald-800 font-black">${ownerState.cureProgress || 0}%</span>
                </div>
                <div class="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden border border-[#d2c8b4]">
                  <div class="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-500" style="width: ${ownerState.cureProgress || 0}%"></div>
                </div>
              </div>
            </div>

            <!-- 2. 주인 지원사격 무기 선택 -->
            <div class="p-3 bg-[#faf6ee] border border-[#d2c8b4] rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
                <span class="flex items-center gap-1"><span>🔫</span><span>지원사격 무기 (장착 중: ${equippedWeaponDef.name})</span></span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                ${Object.values(OWNER_WEAPONS).filter(w => w.id !== 'firearm').map((w) => {
                  const isUnlocked = unlockedWeapons.includes(w.id);
                  const isEquipped = equippedWeaponId === w.id;
                  return `
                    <div class="p-2 rounded-xl border flex flex-col justify-between gap-1 transition ${
                      isEquipped
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40'
                        : isUnlocked
                        ? 'bg-[#f0ebe0] border-[#d2c8b4]'
                        : 'bg-stone-100 border-stone-300 opacity-60'
                    }">
                      <div class="flex items-center gap-1.5">
                        <span class="text-lg">${w.icon}</span>
                        <div class="min-w-0">
                          <div class="text-[11px] font-black text-[#1f2d24] truncate">${w.name}</div>
                          <div class="text-[9px] text-[#5c6e60]">위력 x${w.damageMult} · 사거리 ${w.range}</div>
                        </div>
                      </div>
                      ${isEquipped ? `
                        <div class="py-1 px-2 rounded-lg bg-emerald-600 text-white font-black text-[10px] text-center">장착 중 ✓</div>
                      ` : isUnlocked ? `
                        <button type="button" data-equip-weapon="${w.id}" class="py-1 px-2 rounded-lg bg-[#2d6a4f] hover:bg-[#245840] text-white font-black text-[10px] text-center active:scale-95 transition cursor-pointer">장착하기</button>
                      ` : `
                        <div class="py-1 px-2 rounded-lg bg-stone-200 text-stone-500 font-bold text-[9px] text-center">🔒 챕터 해금</div>
                      `}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 3. 주인 4대 장비 강화 (배낭, 신발, 의상, 지원무기) -->
            <div class="p-3 bg-[#faf6ee] border border-[#d2c8b4] rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
                <span>🛠️ 주인 4대 장비 강화</span>
                <span class="text-[10px] font-bold text-amber-900">골드: ${(save.gold || 0).toLocaleString()} 🪙</span>
              </div>
              <!-- 보유 재료 인벤토리 -->
              <div class="grid grid-cols-4 gap-1 p-2 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4] text-[10px] font-black text-center text-[#1f2d24]">
                <div>🧵 천: ${materials.cloth || 0}</div>
                <div>🩹 붕대: ${materials.bandage || 0}</div>
                <div>⚙️ 부품: ${materials.parts || 0}</div>
                <div>🌿 약초: ${materials.herb || 0}</div>
              </div>

              <!-- 4대 슬롯 -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                      <span>🎒 배낭</span>
                      <span class="text-emerald-800 font-extrabold">Lv.${gear.backpack || 1}</span>
                    </div>
                    <div class="text-[10px] text-[#5c6e60]">기력 최대치 & 회복력 상승</div>
                  </div>
                  <button type="button" data-upgrade-gear="backpack" class="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1">
                    <span>강화</span>
                    <span class="text-[9px] opacity-80">(🧵2개 + 100🪙)</span>
                  </button>
                </div>

                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                      <span>👟 신발</span>
                      <span class="text-emerald-800 font-extrabold">Lv.${gear.shoes || 1}</span>
                    </div>
                    <div class="text-[10px] text-[#5c6e60]">이동속도 & 추종력 상승</div>
                  </div>
                  <button type="button" data-upgrade-gear="shoes" class="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1">
                    <span>강화</span>
                    <span class="text-[9px] opacity-80">(⚙️2개 + 100🪙)</span>
                  </button>
                </div>

                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                      <span>🦺 의상</span>
                      <span class="text-emerald-800 font-extrabold">Lv.${gear.outfit || 1}</span>
                    </div>
                    <div class="text-[10px] text-[#5c6e60]">기력 감소 억제 & 방어력</div>
                  </div>
                  <button type="button" data-upgrade-gear="outfit" class="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1">
                    <span>강화</span>
                    <span class="text-[9px] opacity-80">(🩹2개 + 100🪙)</span>
                  </button>
                </div>

                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                      <span>🔫 무기</span>
                      <span class="text-emerald-800 font-extrabold">Lv.${gear.weapon || 1}</span>
                    </div>
                    <div class="text-[10px] text-[#5c6e60]">사격 공격력 +10%</div>
                  </div>
                  <button type="button" data-upgrade-gear="weapon" class="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1">
                    <span>강화</span>
                    <span class="text-[9px] opacity-80">(🌿2개 + 100🪙)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <!-- [탭 2: 브레멘 동물 합체 편성] -->
          <div class="space-y-3 text-left">
            <div class="p-3 bg-[#faf6ee] border-2 border-emerald-500/50 rounded-2xl space-y-2">
              <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                <span>🐾 브레멘 동물 합체 편성 (상하 슬롯)</span>
                ${bremenUnlocked ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-extrabold">합체 활성 ✓</span>' : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">🔒 Stage 60 보스 격파 시 탑승 슬롯 해금</span>'}
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1">
                  <div class="text-[10px] font-bold text-[#5c6e60]">지상 슬롯 (activeGround)</div>
                  <div class="flex items-center gap-2">
                    <span class="text-2xl">${groundComp?.icon || '🐾'}</span>
                    <div class="min-w-0">
                      <div class="text-xs font-black text-[#1f2d24] truncate">${groundComp?.name || '미장착'}</div>
                      <div class="text-[9px] text-emerald-800 font-bold">${groundComp ? '지상 엄호 중' : '동료를 선택하세요'}</div>
                    </div>
                  </div>
                  ${groundComp ? `
                    <button type="button" data-unequip-comp="ground" class="w-full py-1 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-black active:scale-95 transition cursor-pointer">해제</button>
                  ` : ''}
                </div>

                <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1">
                  <div class="text-[10px] font-bold text-[#5c6e60]">탑승 슬롯 (activeRider)</div>
                  <div class="flex items-center gap-2">
                    <span class="text-2xl">${riderComp?.icon || '🪶'}</span>
                    <div class="min-w-0">
                      <div class="text-xs font-black text-[#1f2d24] truncate">${riderComp?.name || (bremenUnlocked ? '미장착' : '잠김 🔒')}</div>
                      <div class="text-[9px] text-emerald-800 font-bold">${riderComp ? '머리 위 탑승 중' : bremenUnlocked ? '동료를 선택하세요' : 'Stage 60 해금'}</div>
                    </div>
                  </div>
                  ${riderComp ? `
                    <button type="button" data-unequip-comp="rider" class="w-full py-1 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-black active:scale-95 transition cursor-pointer">해제</button>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- 보유 중인 구출 동료 리스트 -->
            <div class="space-y-1.5">
              <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
                <span>구출된 동료 목록 (${unlockedCompanionsList.length}마리)</span>
              </div>
              <div class="space-y-1.5 max-h-[40vh] overflow-y-auto pr-0.5">
                ${unlockedCompanionsList.map((c) => {
                  const isGround = c.mountType === 'ground' || !c.mountType;
                  const isEquippedGround = activeGroundId === c.id;
                  const isEquippedRider = activeRiderId === c.id;
                  const isEquipped = isEquippedGround || isEquippedRider;

                  return `
                    <div class="p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      isEquipped ? 'bg-emerald-50 border-emerald-400' : 'bg-[#faf6ee] border-[#d2c8b4]'
                    }">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-2xl shrink-0">${c.icon}</span>
                        <div class="min-w-0">
                          <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1.5">
                            <span class="truncate">${c.name}</span>
                            <span class="text-[9px] px-1.5 py-0.2 rounded-full font-bold ${isGround ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}">${isGround ? '지상형' : '탑승형'}</span>
                          </div>
                          <div class="text-[10px] text-[#5c6e60] truncate">${c.desc || c.skillDesc || '전투 지원 특기'}</div>
                        </div>
                      </div>
                      <div class="shrink-0">
                        ${isEquipped ? `
                          <button type="button" data-unequip-comp="${isEquippedGround ? 'ground' : 'rider'}" class="py-1 px-2.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-black active:scale-95 transition cursor-pointer">장착 중 (해제)</button>
                        ` : `
                          <button type="button" data-equip-comp="${c.id}" class="py-1 px-2.5 rounded-lg bg-[#2d6a4f] hover:bg-[#245840] text-white text-xs font-black active:scale-95 transition cursor-pointer">장착</button>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `}
      </div>
    `);

    document.getElementById('btn-close-owner-modal')?.addEventListener('click', closeModal);

    document.getElementById('tab-btn-owner')?.addEventListener('click', () => {
      currentTab = 'owner';
      render();
    });

    document.getElementById('tab-btn-bremen')?.addEventListener('click', () => {
      currentTab = 'bremen';
      render();
    });

    document.querySelectorAll('[data-equip-weapon]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const wid = e.currentTarget.getAttribute('data-equip-weapon');
        if (wid) {
          profile.equippedOwnerWeapon = wid;
          settingsStore.saveProfile();
          audioEngine.playPowerUp?.();
          refreshHeader();
          render();
        }
      });
    });

    document.querySelectorAll('[data-upgrade-gear]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const gKey = e.currentTarget.getAttribute('data-upgrade-gear');
        const matReqMap = { backpack: 'cloth', shoes: 'parts', outfit: 'bandage', weapon: 'herb' };
        const reqMat = matReqMap[gKey];
        const curMatCount = materials[reqMat] || 0;
        const curGold = save.gold || 0;

        if (curMatCount < 2) {
          alert(`재료가 부족합니다! (필요: ${reqMat} 2개, 보유: ${curMatCount}개)\n복습 스테이지나 산책에서 획득할 수 있습니다.`);
          return;
        }
        if (curGold < 100) {
          alert('골드가 부족합니다! (필요: 100 🪙)');
          return;
        }

        materials[reqMat] -= 2;
        updateSave((s) => {
          s.gold = Math.max(0, (s.gold || 0) - 100);
        });
        gear[gKey] = (Number(gear[gKey]) || 1) + 1;
        settingsStore.saveProfile();
        audioEngine.playLevelUp?.();
        refreshHeader();
        render();
      });
    });

    document.querySelectorAll('[data-equip-comp]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const cid = e.currentTarget.getAttribute('data-equip-comp');
        const cDef = COMPANIONS.find((c) => c.id === cid);
        if (!cDef) return;

        const isGround = cDef.mountType === 'ground' || !cDef.mountType;
        if (isGround) {
          compData.activeGround = cid;
        } else {
          if (!bremenUnlocked) {
            alert('탑승 슬롯은 Stage 60 보스 격파 후 해금됩니다!');
            return;
          }
          compData.activeRider = cid;
          compData.activeAir = cid;
        }

        updateSave((s) => {
          if (!s.companions) s.companions = { unlocked: [], active: [], levels: {} };
          s.companions.activeGround = compData.activeGround;
          s.companions.activeRider = compData.activeRider;
          s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
        });
        settingsStore.saveProfile();
        audioEngine.playPowerUp?.();
        refreshHeader();
        render();
      });
    });

    document.querySelectorAll('[data-unequip-comp]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = e.currentTarget.getAttribute('data-unequip-comp');
        if (slot === 'ground') {
          compData.activeGround = null;
        } else {
          compData.activeRider = null;
          compData.activeAir = null;
        }
        updateSave((s) => {
          if (!s.companions) s.companions = { unlocked: [], active: [], levels: {} };
          s.companions.activeGround = compData.activeGround;
          s.companions.activeRider = compData.activeRider;
          s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
        });
        settingsStore.saveProfile();
        audioEngine.playCaptureTick?.();
        refreshHeader();
        render();
      });
    });
  };

  render();
}
