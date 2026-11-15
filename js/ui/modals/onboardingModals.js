/**
 * js/ui/modals/onboardingModals.js
 * 최초 학습 언어 선택, 강아지 입양, 단어 레벨 선택, 온보딩 투어 모달
 */

import { getSave, updateSave } from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import { LANG_META, WORD_LEVEL_TIERS } from '../../core/courseEngine.js';
import { computePlayerStats } from '../../entities/player.js';
import { renderDogToCanvas } from '../../render/dogRenderer.js';

export function openInitialStudyLangModal(ctx, { onStartTutorial } = {}) {
  const { openModal, closeModal, refreshHeader } = ctx;
  let selectedLang = 'en';

  const LANG_OPTIONS = [
    { id: 'en', flag: '🇺🇸', label: '영어', sub: 'English' },
    { id: 'es', flag: '🇪🇸', label: '스페인어', sub: 'Español' },
  ];

  function render() {
    const cardsHtml = LANG_OPTIONS.map((opt) => {
      const isSelected = opt.id === selectedLang;
      return `
        <button
          type="button"
          data-init-study-lang="${opt.id}"
          class="relative aspect-square w-full p-4 rounded-2xl border-2 ${
            isSelected
              ? 'bg-emerald-50 border-emerald-600 shadow-md ring-2 ring-emerald-500/35'
              : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
          } flex flex-col items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <div class="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
            isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'border-2 border-[#d2c8b4] text-transparent'
          }">✓</div>
          <span class="text-5xl leading-none select-none">${opt.flag}</span>
          <div class="text-base font-black text-[#1f2d24] mt-1">${opt.label}</div>
          <div class="text-xs font-bold ${isSelected ? 'text-emerald-800' : 'text-[#5c6e60]'}">${opt.sub}</div>
        </button>
      `;
    }).join('');

    openModal(`
      <div class="space-y-4 py-1">
        <h2 class="text-lg font-black text-[#1f2d24] text-center">🐾 어떤 언어로 모험할까멍?</h2>

        <div class="grid grid-cols-2 gap-3">
          ${cardsHtml}
        </div>

        <button
          id="btn-start-initial-tutorial"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🐾 출발하기멍!</span>
        </button>
      </div>
    `);

    document.querySelectorAll('[data-init-study-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-init-study-lang');
        if (chosen && chosen !== selectedLang) {
          audioEngine.playCaptureTick?.();
          selectedLang = chosen;
          render();
        }
      });
    });

    document.getElementById('btn-start-initial-tutorial')?.addEventListener('click', () => {
      audioEngine.playCorrect?.();
      updateSave((s) => {
        s.studyLang = selectedLang;
        s.langSelected = true;
      });
      refreshHeader?.();
      closeModal();
      if (typeof onStartTutorial === 'function') {
        onStartTutorial();
      }
    });
  }

  render();
}

export function openStarterAdoptionModal(ctx, { onAdopted } = {}) {
  const { openModal, closeModal, refreshHeader, renderActiveTab } = ctx;
  let selectedId = 'pomeranian';

  const STARTER_OPTIONS = [
    {
      id: 'french_bulldog',
      name: '불독',
      defaultName: '불리',
      roleBadge: '[ 🛡️ 체력·방어형 ]',
      badgeClass: 'bg-sky-500/15 border-sky-500/45 text-sky-900',
      desc: '높은 체력으로 좀비 충돌을 잘 버티는 탱커',
    },
    {
      id: 'pomeranian',
      name: '우유',
      defaultName: '우유',
      roleBadge: '[ ⚖️ 균형형 ]',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/45 text-emerald-900',
      desc: '모든 능력이 고른 만능 파트너',
    },
    {
      id: 'beagle',
      name: '비글',
      defaultName: '바우',
      roleBadge: '[ ⚡ 기동·탐색형 ]',
      badgeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-900',
      desc: '빠른 이동속도로 해치와 보석을 누비는 스피드견',
    },
  ];

  function render() {
    const baseSave = getSave();
    const cardsHtml = STARTER_OPTIONS.map((opt) => {
      const isSelected = opt.id === selectedId;
      const previewSave = { ...baseSave, selectedBreed: opt.id };
      const st = computePlayerStats(previewSave);

      return `
        <button
          type="button"
          data-starter-breed="${opt.id}"
          class="relative p-2.5 rounded-2xl border-2 text-center flex flex-col items-center justify-between transition-all duration-200 transform active:scale-95 cursor-pointer ${
            isSelected
              ? 'scale-105 z-10 bg-emerald-50/95 border-emerald-600 shadow-[0_6px_20px_rgba(16,185,129,0.32)] ring-2 ring-emerald-500/40'
              : 'scale-100 opacity-90 bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0] hover:opacity-100'
          }"
        >
          <div class="w-full flex items-center justify-center">
            <span class="px-1.5 py-0.5 rounded-md border text-[9px] font-black leading-none whitespace-nowrap ${opt.badgeClass}">
              ${opt.roleBadge}
            </span>
          </div>

          <div class="my-1.5 relative flex items-center justify-center">
            <div class="relative w-[84px] h-[72px] flex items-center justify-center">
              ${
                isSelected
                  ? '<div class="absolute -inset-2 rounded-2xl bg-gradient-to-r from-emerald-400/50 via-amber-300/40 to-teal-400/50 blur-md animate-pulse pointer-events-none"></div>'
                  : ''
              }
              <canvas data-starter-canvas="${opt.id}" width="80" height="68" class="relative z-10 w-[80px] h-[68px] rounded-xl ${
                isSelected
                  ? 'bg-gradient-to-b from-emerald-100/90 to-[#f0ebe0] border-2 border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.55)] ring-2 ring-emerald-400/50'
                  : 'bg-[#f0ebe0] border border-[#d2c8b4]'
              } block"></canvas>
              ${
                isSelected
                  ? '<span class="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow">✓</span>'
                  : ''
              }
            </div>
          </div>

          <div class="w-full space-y-1">
            <div class="text-xs font-black text-[#1f2d24] leading-tight truncate">${opt.name}</div>
            <p class="text-[10px] font-bold text-[#4a584e] leading-snug break-keep min-h-[26px] flex items-center justify-center">
              ${opt.desc}
            </p>
            <div class="rounded-lg bg-[#efe9dc] border border-[#dcd3bd] px-1.5 py-1 text-[9.5px] font-extrabold text-[#1f2d24] space-y-0.5">
              <div class="flex items-center justify-between">
                <span class="text-rose-700">❤️ 체력</span>
                <span>${st.maxHp}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-teal-800">👟 이동속도</span>
                <span>${Math.round(st.speed)}</span>
              </div>
            </div>
          </div>
        </button>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3.5 py-1">
        <div class="text-center">
          <h2 class="text-base sm:text-lg font-black text-[#1f2d24]">🐾 함께 모험할 첫 파트너를 선택하세요!</h2>
        </div>

        <div class="grid grid-cols-3 gap-2">
          ${cardsHtml}
        </div>

        <button
          id="btn-confirm-starter-adopt"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>[ 🐾 이 강아지와 함께하기 ]</span>
        </button>
      </div>
    `);

    document.querySelectorAll('[data-starter-canvas]').forEach((cvs) => {
      const bId = cvs.getAttribute('data-starter-canvas');
      renderDogToCanvas(cvs, {
        save: { ...baseSave, selectedBreed: bId },
        breedId: bId,
        scale: 1.1,
        y: cvs.height / 2 + 6,
        withWeapon: false,
        withEquipment: false,
        isHappy: bId === selectedId,
        time: Date.now(),
      });
    });

    document.querySelectorAll('[data-starter-breed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-starter-breed');
        if (chosen && chosen !== selectedId) {
          audioEngine.playCaptureTick?.();
          selectedId = chosen;
          render();
        }
      });
    });

    document.getElementById('btn-confirm-starter-adopt')?.addEventListener('click', () => {
      const chosenOpt = STARTER_OPTIONS.find((o) => o.id === selectedId) || STARTER_OPTIONS[0];
      audioEngine.playLevelUp?.();
      updateSave((s) => {
        s.selectedBreed = chosenOpt.id;
        if (!Array.isArray(s.unlockedBreeds)) s.unlockedBreeds = ['pomeranian'];
        if (!s.unlockedBreeds.includes(chosenOpt.id)) {
          s.unlockedBreeds.push(chosenOpt.id);
        }
        if (!s.affection || typeof s.affection !== 'object') s.affection = {};
        if (!s.affection[chosenOpt.id]) {
          s.affection[chosenOpt.id] = { level: 1, xp: 0 };
        }
        if (!s.dogName || s.dogName === '우유' || s.dogName === 'Milk' || s.dogName === 'Leche') {
          s.dogName = chosenOpt.defaultName;
        }
        s.gold = Math.max(35, s.gold || 0);
      });
      refreshHeader?.();
      renderActiveTab?.();

      // 「🎁 입양 축하 선물 도착!」 미니 팝업 표출
      openModal(`
        <div class="text-center space-y-4 py-2">
          <div class="relative inline-flex items-center justify-center">
            <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 via-amber-200 to-yellow-300 border-2 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.6)] flex items-center justify-center text-4xl animate-bounce">
              🧢
            </div>
            <span class="absolute -top-1 -right-1 text-lg">✨</span>
            <span class="absolute -bottom-1 -left-1 text-lg">🎉</span>
          </div>

          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black">
              🎁 입양 축하 선물 도착!
            </div>
            <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
              신입 대원 특별 보급 장비
            </h3>
            <p class="text-xs font-bold text-[#4a584e] leading-relaxed break-keep">
              <b>${chosenOpt.name}</b>의 합류를 축하하며 전술 방어구<br/>
              <b class="text-emerald-800 font-extrabold">[🧢 네온 야구모자]</b>를 선물로 드립니다!
            </p>
          </div>

          <div class="rounded-xl bg-[#efe9dc] border border-[#dcd3bd] px-3 py-2 text-[11px] font-extrabold text-[#1f2d24] flex items-center justify-center gap-3">
            <span class="text-emerald-800 font-black">⚔️ 공격력 +2</span>
            <span class="text-[#a3b899]">·</span>
            <span class="text-rose-700 font-black">❤️ 체력 +10</span>
          </div>

          <button
            id="btn-claim-adopt-gift"
            type="button"
            class="w-full py-3.5 rounded-2xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-black text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>[ 🎒 모자 받고 입혀보기 ]</span>
          </button>
        </div>
      `);

      document.getElementById('btn-claim-adopt-gift')?.addEventListener('click', () => {
        audioEngine.playPowerUp?.();
        updateSave((s) => {
          if (!s.costumes) s.costumes = { owned: ['weapon_boomerang'], equipped: { weapon: 'weapon_boomerang', hat: null, outfit: null, aura: null, acc: null } };
          if (!Array.isArray(s.costumes.owned)) s.costumes.owned = ['weapon_boomerang'];
          if (!s.costumes.owned.includes('hat_cap')) {
            s.costumes.owned.push('hat_cap');
          }
          // Tour Step 1에서 유저가 직접 터치해 장착할 수 있도록 모자 슬롯을 비워둠
          if (s.costumes.equipped) {
            s.costumes.equipped.hat = null;
          }
          s.gold = Math.max(35, s.gold || 0);
          s.onboardingCompleted = false;
          s.onboardingStep = 1;
        });
        refreshHeader?.();
        renderActiveTab?.();
        closeModal();
        onAdopted?.();
      });
    });
  }

  render();
}

export function openWordLevelSelectModal(ctx, options = {}) {
  const { openModal, closeModal, refreshHeader, renderActiveTab, renderBattleTab, onStartBattle } = ctx;
  const { isChange = false, onSelectTier } = options;

  const save = getSave();
  const lang = save.studyLang || 'en';
  const flag = LANG_META[lang]?.flag || '🇺🇸';
  const langName = LANG_META[lang]?.name || '영어';

  function applyTierAndLaunch(tier) {
    if (onSelectTier) {
      onSelectTier(tier);
      return;
    }

    updateSave((s) => {
      s.hasSelectedWordLevel = isChange ? true : false;
      s.wordLevelTier = tier.id;
      s.wordUnitOffset = Number(tier.unitOffset) || 0;
      s.selectedLevelLabel = tier.badgeLabel;
      if (s.courseProgress && s.studyLang && s.courseProgress[s.studyLang]) {
        s.courseProgress[s.studyLang].cefr = tier.cefr;
      }
      // 중요: selectedUnit과 maxUnlockedUnit은 항상 CH.1 STAGE 1부터 시작하는 게임 스테이지 진행도이므로 건드리지 않음
    });
    closeModal();
    refreshHeader();
    renderActiveTab();
    renderBattleTab?.();

    if (!isChange) {
      const cur = getSave();
      onStartBattle?.({
        chapterNumber: 1,
        courseId: cur.selectedCourse || 'lv1',
        unitId: 'unit_001',
        isPlacement: true,
        isPlacementTest: true,
        selectedTier: tier,
        targetUnitNum: Number(tier.unitOffset) + 1,
      });
    }
  }

  function renderLevelSelection(highlightTierId = null) {
    const currentSave = getSave();
    const activeLabel = currentSave.selectedLevelLabel || '초급 Lv.1';

    const renderRowButtons = (groupName) => {
      const groupTiers = WORD_LEVEL_TIERS.filter((t) => t.group === groupName);
      return groupTiers.map((t) => {
        const isSelected = highlightTierId ? t.id === highlightTierId : t.badgeLabel === activeLabel;
        return `
          <button
            type="button"
            data-tier-id="${t.id}"
            class="tier-btn relative py-3 px-2 rounded-xl border text-center font-black text-sm active:scale-95 transition cursor-pointer ${
              isSelected
                ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-400/50'
                : 'border-[#d2c8b4] bg-[#faf6ee] text-[#1f2d24] hover:bg-emerald-50/60 hover:border-emerald-300'
            }"
          >
            ${isSelected ? '<span class="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-[8px] font-black text-white leading-tight shadow-xs">선택</span>' : ''}
            <span>Lv.${t.level}</span>
          </button>
        `;
      }).join('');
    };

    openModal(`
      <div class="space-y-4 py-1">
        <div class="flex items-center justify-between pb-2 border-b border-[#d2c8b4]">
          <div class="flex items-center gap-2">
            <span class="text-2xl leading-none">${flag}</span>
            <div>
              <h2 class="text-base font-black text-[#1f2d24] leading-none">학습 단어 레벨 선택</h2>
              <p class="text-[11px] text-[#5c6e60] mt-1">${langName} 단어 난이도를 선택해 주세요</p>
            </div>
          </div>
          ${isChange ? '<button id="btn-close-word-level" type="button" class="w-8 h-8 rounded-full bg-[#eee7d7] text-[#4a584e] hover:text-[#1f2d24] flex items-center justify-center text-sm font-bold active:scale-95 transition cursor-pointer">✕</button>' : ''}
        </div>

        <div class="space-y-3">
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 px-1 text-xs font-black text-[#1f2d24]">
              <span>🌱</span>
              <span>초급</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              ${renderRowButtons('초급')}
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 px-1 text-xs font-black text-[#1f2d24]">
              <span>🌿</span>
              <span>중급</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              ${renderRowButtons('중급')}
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 px-1 text-xs font-black text-[#1f2d24]">
              <span>🔥</span>
              <span>고급</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              ${renderRowButtons('고급')}
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-[#d2c8b4]">
          <button
            id="btn-start-quick-quiz"
            type="button"
            class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-between cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg leading-none">🎯</span>
              <div class="text-left">
                <div class="font-black text-xs leading-none">잘 모르겠어요! 빠른 실력 테스트</div>
                <div class="text-[9.5px] text-amber-100 font-medium mt-0.5">10문제로 내게 딱 맞는 레벨 자동 진단</div>
              </div>
            </div>
            <span class="text-[11px] font-black bg-amber-800/40 px-2.5 py-1 rounded-lg border border-amber-300/30 whitespace-nowrap">
              시작 🐾
            </span>
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-close-word-level')?.addEventListener('click', closeModal);

    document.querySelectorAll('.tier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier-id');
        const tier = WORD_LEVEL_TIERS.find((t) => t.id === tierId);
        if (tier) {
          applyTierAndLaunch(tier);
        }
      });
    });

    document.getElementById('btn-start-quick-quiz')?.addEventListener('click', () => {
      closeModal();
      updateSave((s) => {
        s.hasSelectedWordLevel = false;
      });
      const cur = getSave();
      onStartBattle?.({
        chapterNumber: 1,
        courseId: cur.selectedCourse || 'lv1',
        unitId: 'unit_001',
        isPlacement: true,
        isPlacementTest: true,
        targetUnitNum: 1,
      });
    });
  }

  renderLevelSelection();
}

export function createLobbyOnboardingTour(ctx) {
  const { switchTab, getActiveTab, refreshHeader, renderActiveTab } = ctx;
  const overlayEl = document.getElementById('lobby-tour-overlay');
  const spotlightEl = document.getElementById('lobby-tour-spotlight');
  const pointerEl = document.getElementById('lobby-tour-pointer');
  const coachEl = document.getElementById('lobby-tour-coach');
  const stepEl = document.getElementById('lobby-tour-step');
  const textEl = document.getElementById('lobby-tour-text');
  const actionBtn = document.getElementById('btn-lobby-tour-action');

  let celebrationTimer = null;
  let celebratingComplete = false;
  let rafId = null;

  function hideTour() {
    overlayEl?.classList.add('hidden');
    if (spotlightEl) {
      spotlightEl.style.width = '0px';
      spotlightEl.style.height = '0px';
    }
    pointerEl?.classList.add('hidden');
  }

  function positionSpotlight(targetEl, pad = 6) {
    if (!overlayEl || !spotlightEl || !pointerEl || !coachEl) return;
    if (!targetEl) {
      spotlightEl.style.width = '0px';
      spotlightEl.style.height = '0px';
      pointerEl.classList.add('hidden');
      return;
    }

    let left, top, right, bottom;
    if (Array.isArray(targetEl)) {
      const validRects = targetEl
        .map((el) => (typeof el?.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null))
        .filter((r) => r && (r.width > 0 || r.height > 0));
      if (validRects.length === 0) {
        spotlightEl.style.width = '0px';
        spotlightEl.style.height = '0px';
        pointerEl.classList.add('hidden');
        return;
      }
      left = Math.min(...validRects.map((r) => r.left));
      top = Math.min(...validRects.map((r) => r.top));
      right = Math.max(...validRects.map((r) => r.right));
      bottom = Math.max(...validRects.map((r) => r.bottom));
    } else {
      const rect = targetEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        spotlightEl.style.width = '0px';
        spotlightEl.style.height = '0px';
        pointerEl.classList.add('hidden');
        return;
      }
      left = rect.left;
      top = rect.top;
      right = rect.right;
      bottom = rect.bottom;
    }

    const width = right - left + pad * 2;
    const height = bottom - top + pad * 2;
    const spotLeft = left - pad;
    const spotTop = top - pad;

    spotlightEl.style.cssText = `
      position: fixed;
      left: ${spotLeft.toFixed(1)}px;
      top: ${spotTop.toFixed(1)}px;
      width: ${width.toFixed(1)}px;
      height: ${height.toFixed(1)}px;
      border: 3px solid #fbbf24;
      border-radius: 16px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.78);
      pointer-events: none;
      z-index: 9991;
      transition: all 0.2s ease-out;
    `;

    // 우유 교관 말풍선: 항상 화면 하단 중앙 배치 (하단 탭 바 바로 위)
    coachEl.style.position = 'fixed';
    coachEl.style.zIndex = '9993';
    coachEl.style.backgroundColor = '#fffbeb';
    coachEl.style.opacity = '1';
    coachEl.style.left = '50%';
    coachEl.style.transform = 'translateX(-50%)';
    coachEl.style.width = 'calc(100% - 24px)';
    coachEl.style.maxWidth = '400px';
    coachEl.style.boxSizing = 'border-box';
    coachEl.style.top = 'auto';

    const isBottomNav = top > window.innerHeight * 0.72;
    if (isBottomNav) {
      coachEl.style.bottom = '92px';
      pointerEl.classList.remove('hidden');
      pointerEl.style.position = 'fixed';
      pointerEl.style.zIndex = '9992';
      const ptrX = Math.max(8, Math.min(window.innerWidth - 40, left + width / 2 - 15));
      pointerEl.style.left = `${ptrX.toFixed(1)}px`;
      pointerEl.style.top = `${Math.max(8, top - 38).toFixed(1)}px`;
    } else {
      coachEl.style.bottom = '84px';
      if (!Array.isArray(targetEl)) {
        pointerEl.classList.remove('hidden');
        pointerEl.style.position = 'fixed';
        pointerEl.style.zIndex = '9992';
        const ptrX = Math.max(8, Math.min(window.innerWidth - 40, left + width / 2 - 15));
        pointerEl.style.left = `${ptrX.toFixed(1)}px`;
        if (top > 45) {
          pointerEl.style.top = `${Math.max(8, top - 36).toFixed(1)}px`;
        } else {
          pointerEl.style.top = `${(top + height + 6).toFixed(1)}px`;
        }
      } else {
        pointerEl.classList.add('hidden');
      }
    }
  }

  function updateSpotlightAsync(targetGetter, pad = 6) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = typeof targetGetter === 'function' ? targetGetter() : targetGetter;
        positionSpotlight(target, pad);
      });
    });
  }

  function syncTour() {
    if (!overlayEl) return;
    const save = getSave();

    // 전투 튜토리얼 미완료 상태이거나 이미 온보딩 완료된 기존 유저는 즉시 종료
    if (!save.tutorialCompleted || save.onboardingCompleted) {
      if (!celebratingComplete) {
        hideTour();
      }
      return;
    }

    // Step 0: 첫 파트너 강아지 무료 입양 모달 오픈
    if (!save.onboardingStep || save.onboardingStep <= 0) {
      hideTour();
      openStarterAdoptionModal(ctx, {
        onAdopted: () => {
          syncTour();
        },
      });
      return;
    }

    const step = save.onboardingStep;
    const curTab = getActiveTab?.() || 'battle';
    overlayEl.classList.remove('hidden');
    actionBtn?.classList.add('hidden');

    if (step === 1) {
      // Tour Step 1 / 4 — 강아지 옷 입히기(장비 착용)
      if (curTab !== 'gear') {
        if (stepEl) stepEl.textContent = 'TOUR 1 / 4 · 장비 착용';
        if (textEl) textEl.textContent = "멍! 입양 선물로 받은 [🧢 네온 야구모자]를 입혀 보자! 아래 [🐾 내 강아지] 탭을 눌러 봐!";
        actionBtn?.classList.add('hidden');
        updateSpotlightAsync(() => document.querySelector('[data-lobby-tab="gear"]'), 6);
      } else {
        const isHatEquipped = Boolean(save.costumes?.equipped?.hat);
        if (!isHatEquipped) {
          // 장비·코스튬 서브탭 자동 활성화
          let hatEquipBtn = document.querySelector('#tab-panel-gear .grid [data-costume-equip="hat_cap"]') || document.querySelector('#tab-panel-gear [data-costume-equip="hat_cap"]');
          if (!hatEquipBtn) {
            const costumeSubBtn = document.querySelector('#tab-panel-gear [data-gear-subtab="costume"]');
            if (costumeSubBtn) {
              costumeSubBtn.click();
              hatEquipBtn = document.querySelector('#tab-panel-gear .grid [data-costume-equip="hat_cap"]') || document.querySelector('#tab-panel-gear [data-costume-equip="hat_cap"]');
            }
          }
          if (stepEl) stepEl.textContent = 'TOUR 1 / 4 · 장비 착용';
          if (textEl) textEl.textContent = "인벤토리에서 방금 선물 받은 [🧢 네온 야구모자] 슬롯을 직접 터치해 장착해 봐!";
          actionBtn?.classList.add('hidden');
          updateSpotlightAsync(() => document.querySelector('#tab-panel-gear .grid [data-costume-equip="hat_cap"]') || document.querySelector('#tab-panel-gear [data-costume-equip="hat_cap"]'), 6);
        } else {
          if (stepEl) stepEl.textContent = 'TOUR 1 / 4 · 장비 착용 완료';
          if (textEl) textEl.textContent = "우와, [네온 야구모자]가 정말 잘 어울려! 공격력과 체력도 올랐어!";
          if (actionBtn) {
            actionBtn.textContent = '다음으로 🐾';
            actionBtn.classList.remove('hidden');
          }
          pointerEl?.classList.add('hidden');
          updateSpotlightAsync(() => document.getElementById('gear-showcase-card') || document.querySelector('#tab-panel-gear .p-3.rounded-2xl'), 8);
        }
      }
    } else if (step === 2) {
      // Tour Step 2 / 4 — 훈련소(기초 훈련) 체험
      if (curTab !== 'training') {
        if (stepEl) stepEl.textContent = 'TOUR 2 / 4 · 훈련소 체험';
        if (textEl) textEl.textContent = "모자가 정말 잘 어울려! 이제 아래 [🏋️ 훈련소] 탭을 눌러 훈련소로 가 보자!";
        actionBtn?.classList.add('hidden');
        updateSpotlightAsync(() => document.querySelector('[data-lobby-tab="training"]'), 6);
      } else {
        const isUpgraded = (save.training?.atkLevel || 0) >= 1;
        if (!isUpgraded) {
          if (stepEl) stepEl.textContent = 'TOUR 2 / 4 · 훈련소 체험';
          if (textEl) textEl.textContent = "훈련소에서는 전투로 모은 금화로 능력치를 올려! [⚡ 공격력] 훈련 버튼을 눌러 레벨업해 봐!";
          actionBtn?.classList.add('hidden');
          updateSpotlightAsync(() => document.querySelector('#tab-panel-training [data-train-key="atkLevel"] button') || document.querySelector('#tab-panel-training [data-train-key="atkLevel"]'), 6);
        } else {
          if (stepEl) stepEl.textContent = 'TOUR 2 / 4 · 훈련 완료';
          if (textEl) textEl.textContent = "우와, 공격력이 올라서 우유가 훨씬 강해졌어! 이제 주간 챌린지도 확인해 보자!";
          if (actionBtn) {
            actionBtn.textContent = '다음으로 🐾';
            actionBtn.classList.remove('hidden');
          }
          updateSpotlightAsync(() => {
            const summary = document.getElementById('training-stat-summary-card');
            const atkCard = document.querySelector('#tab-panel-training [data-train-key="atkLevel"]');
            return [summary, atkCard].filter(Boolean);
          }, 8);
        }
      }
    } else if (step === 3) {
      // Tour Step 3 / 4 — 챌린지 리그 안내
      if (curTab !== 'challenge') {
        if (stepEl) stepEl.textContent = 'TOUR 3 / 4 · 챌린지 탭';
        if (textEl) textEl.textContent = "이번엔 오른쪽 아래 [🏆 챌린지] 탭을 눌러 주간 리그를 확인해 봐!";
        actionBtn?.classList.add('hidden');
        updateSpotlightAsync(() => document.querySelector('[data-lobby-tab="challenge"]'), 6);
      } else {
        if (stepEl) stepEl.textContent = 'TOUR 3 / 4 · 챌린지 리그';
        if (textEl) textEl.textContent = "여기는 주간 리그 순위를 겨루는 챌린지야! 스테이지를 깨고 점수를 모아 상위 리그로 승급해 봐!";
        if (actionBtn) {
          actionBtn.textContent = '다음으로 🐾';
          actionBtn.classList.remove('hidden');
        }
        updateSpotlightAsync(() => document.getElementById('challenge-league-roster-card') || document.querySelector('#tab-panel-challenge .rounded-2xl'), 6);
      }
    } else if (step === 4) {
      // Tour Step 4 / 4 — 내 강아지 쓰다듬기 & 온보딩 완료
      if (curTab !== 'battle') {
        switchTab?.('battle');
        return;
      }
      if (stepEl) stepEl.textContent = 'TOUR 4 / 4 · 강아지 쓰다듬기';
      if (textEl) textEl.textContent = "멍! 마지막으로 내 머리를 한 번 쓰다듬어 줄래? 기분이 좋아지면 바로 실전 출격하자!";
      actionBtn?.classList.add('hidden');
      updateSpotlightAsync(() => document.getElementById('lobby-hero-profile-card') || document.getElementById('lobby-hero-stage'), 10);
    }
  }

  function completeWithPet() {
    celebratingComplete = true;
    updateSave((s) => {
      s.onboardingCompleted = true;
      s.onboardingStep = 5;
    });
    audioEngine.playLevelUp?.();
    if (!overlayEl) return;
    overlayEl.classList.remove('hidden');
    if (stepEl) stepEl.textContent = '🎉 온보딩 완료!';
    if (textEl) textEl.textContent = "교감 완료! 이제 기분이 최고조야! 드디어 첫 실전 전투로 출격하자!";
    if (actionBtn) actionBtn.classList.add('hidden');
    pointerEl?.classList.add('hidden');

    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => {
      celebratingComplete = false;
      hideTour();
    }, 1800);
  }

  // 액션 버튼 클릭 핸들러 (Step 1 모자 장착 확인 / Step 2 훈련 확인 후 챌린지 탭 이동 / Step 3 챌린지 확인 후 메인 로비 battle 탭 복귀)
  actionBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const save = getSave();
    if (save.onboardingStep === 1 && save.costumes?.equipped?.hat) {
      audioEngine.playCaptureTick?.();
      updateSave((s) => {
        s.onboardingStep = 2;
      });
      syncTour();
      return;
    }
    if (save.onboardingStep === 2 && (save.training?.atkLevel || 0) >= 1) {
      audioEngine.playCaptureTick?.();
      updateSave((s) => {
        s.onboardingStep = 3;
      });
      syncTour();
      return;
    }
    if (save.onboardingStep === 3) {
      audioEngine.playCaptureTick?.();
      updateSave((s) => {
        s.onboardingStep = 4;
      });
      switchTab?.('battle');
      syncTour();
      return;
    }
  });

  // 로비 내부 클릭 위임 감지
  document.getElementById('lobby-layer')?.addEventListener('click', (e) => {
    const save = getSave();
    if (celebratingComplete && e.target.closest('#btn-start-battle')) {
      celebratingComplete = false;
      clearTimeout(celebrationTimer);
      hideTour();
      return;
    }
    if (!save.tutorialCompleted || save.onboardingCompleted) return;

    // Step 1: 모자 장착 감지
    if (save.onboardingStep === 1 && e.target.closest('[data-costume-equip]')) {
      setTimeout(() => {
        if (getSave().costumes?.equipped?.hat) {
          audioEngine.playLevelUp?.();
        }
        syncTour();
      }, 40);
      return;
    }

    // Step 2: 훈련소 강화 버튼 클릭 감지
    if (save.onboardingStep === 2 && getActiveTab?.() === 'training' && e.target.closest('[data-train-key]')) {
      setTimeout(() => {
        syncTour();
      }, 60);
      return;
    }

    // Step 4: 로비 중앙 내 강아지 쓰다듬기 감지
    if (save.onboardingStep === 4 && (e.target.closest('#lobby-hero-profile-card') || e.target.closest('#lobby-hero-stage') || e.target.closest('#pet-action-badge'))) {
      setTimeout(() => {
        completeWithPet();
      }, 50);
    }
  });

  window.addEventListener('resize', () => {
    const save = getSave();
    if (save.tutorialCompleted && (!save.onboardingCompleted || celebratingComplete)) {
      syncTour();
    }
  });

  return {
    syncTour,
    hideTour,
    completeWithPet,
  };
}
