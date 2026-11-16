/**
 * js/ui/modals/settingsModal.js
 * 사운드 3분할 슬라이더(BGM/SFX/TTS), 학습 언어 전환 타일, 진동/저사양 토글, Base64 백업/복원 환경 설정 모달
 */

import { SUPPORTED_LANGUAGES, applyI18nToDOM, getLanguage, setLanguage, t } from '../../data/i18n.js';
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
import settingsStore from '../../settingsStore.js';

export function renderLanguageTilesHtml(curStudyLang) {
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

export function renderSoundControlsHtml() {
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

export function attachSoundEvents() {
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

export function attachLanguageTileEvents(ctx, curStudyLang, onRefresh) {
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
          isPlacementTest: false,
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
    updateSave((s) => {
      s.language = lang;
      s.uiLang = lang;
    });
    applyI18nToDOM();
    refreshHeader?.();
    renderActiveTab?.();
    if (ctx.renderBattleTab) {
      ctx.renderBattleTab();
    }
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
