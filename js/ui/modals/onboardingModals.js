/**
 * js/ui/modals/onboardingModals.js
 * 단어 레벨 선택 및 온보딩 투어 모달 (스토리 온보딩은 js/ui/onboarding.js 위임)
 */

import { getSave, updateSave } from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import { LANG_META, WORD_LEVEL_TIERS } from '../../core/courseEngine.js';

// 스토리 기반 온보딩 신규 모듈 re-export (하위 호환성 100% 보장)
export {
  startStoryOnboarding,
  initOnboarding,
  showOnboarding,
  openInitialStudyLangModal,
  openStarterAdoptionModal,
} from '../onboarding.js';

export function openWordLevelSelectModal(ctx, options = {}) {
  const { openModal, closeModal, refreshHeader, renderActiveTab, renderBattleTab, onStartBattle } = ctx;
  const { isChange = false, onSelectTier } = options;

  if (!isChange) {
    // 수동 선택창 없이 즉시 자동 난이도 계단식 3목숨 배치 테스트 출격
    onStartBattle?.({
      chapterNumber: 1,
      courseId: getSave().selectedCourse || 'lv1',
      unitId: 'unit_001',
      isPlacement: true,
      isPlacementTest: false,
    });
    return;
  }

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
  }

  function renderLevelSelection(highlightTierId = null) {
    const currentSave = getSave();
    const activeLabel = currentSave.selectedLevelLabel || '왕초보';

    const renderTierButtons = () => {
      return WORD_LEVEL_TIERS.map((t) => {
        const isSelected = highlightTierId ? t.id === highlightTierId : (t.badgeLabel === activeLabel || t.label === activeLabel);
        return `
          <button
            type="button"
            data-tier-id="${t.id}"
            class="tier-btn relative py-2.5 px-2 rounded-xl border text-center font-black active:scale-95 transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              isSelected
                ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-400/50'
                : 'border-[#d2c8b4] bg-[#faf6ee] text-[#1f2d24] hover:bg-emerald-50/60 hover:border-emerald-300'
            }"
          >
            ${isSelected ? '<span class="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-[8px] font-black text-white leading-tight shadow-xs">선택</span>' : ''}
            <div class="flex items-center gap-1">
              <span class="text-base leading-none">${t.groupIcon || '🌱'}</span>
              <span class="text-xs font-black text-[#1f2d24]">${t.label}</span>
            </div>
            <span class="text-[9px] font-bold text-[#5c6e60]">${t.groupCefr}</span>
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
              <p class="text-[11px] text-[#5c6e60] mt-1">${langName} 단어 난이도를 선택해 주세요 (6단계)</p>
            </div>
          </div>
          ${isChange ? '<button id="btn-close-word-level" type="button" class="w-8 h-8 rounded-full bg-[#eee7d7] text-[#4a584e] hover:text-[#1f2d24] flex items-center justify-center text-sm font-bold active:scale-95 transition cursor-pointer">✕</button>' : ''}
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${renderTierButtons()}
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
                <div class="text-[9.5px] text-amber-100 font-medium mt-0.5">12문제로 내게 딱 맞는 레벨 자동 진단</div>
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
        isPlacementTest: false,
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

    // 전투 튜토리얼 미완료이거나 로비 투어를 이미 완료한 유저는 즉시 종료
    if (!save.tutorialCompleted || save.lobbyTourCompleted || (save.onboardingStep && save.onboardingStep >= 5)) {
      if (!celebratingComplete) {
        hideTour();
      }
      return;
    }

    // 구버전 강아지 선택 창(Step 0) 호출 제거: 이미 오프닝 프롤로그에서 입양 완료됨
    if (!save.onboardingStep || save.onboardingStep <= 0) {
      updateSave((s) => {
        s.onboardingStep = 1;
      });
    }

    const step = save.onboardingStep;
    const curTab = getActiveTab?.() || 'battle';
    overlayEl.classList.remove('hidden');
    actionBtn?.classList.add('hidden');

    if (step === 1) {
      // Tour Step 1 / 3 — 강아지 기본 하네스 착용
      if (curTab !== 'gear') {
        if (stepEl) stepEl.textContent = 'TOUR 1 / 3 · 하네스 착용';
        if (textEl) textEl.textContent = "멍! 레벨테스트 보상으로 받은 [🦺 기본 하네스]를 입혀 보자! 아래 [🐾 우리 팀] 탭을 눌러 봐!";
        actionBtn?.classList.add('hidden');
        updateSpotlightAsync(() => document.querySelector('[data-lobby-tab="gear"]'), 6);
      } else {
        const isHarnessEquipped = Boolean(save.costumes?.equipped?.harness === 'basic_harness' || save.costumes?.equipped?.harness);
        if (!isHarnessEquipped) {
          let harnessEquipBtn = document.querySelector('#tab-panel-gear [data-costume-equip="basic_harness"]') || document.querySelector('#tab-panel-gear [data-costume-equip]');
          if (stepEl) stepEl.textContent = 'TOUR 1 / 3 · 하네스 착용';
          if (textEl) textEl.textContent = "인벤토리에서 방금 받은 [🦺 기본 하네스]를 직접 터치하여 착용해 봐!";
          actionBtn?.classList.add('hidden');
          updateSpotlightAsync(() => harnessEquipBtn, 6);
        } else {
          if (stepEl) stepEl.textContent = 'TOUR 1 / 3 · 하네스 착용 완료';
          if (textEl) textEl.textContent = "우와, [기본 하네스]가 몸에 딱 맞아! 공격력과 체력도 올랐어!";
          if (actionBtn) {
            actionBtn.textContent = '다음으로 🐾';
            actionBtn.classList.remove('hidden');
          }
          pointerEl?.classList.add('hidden');
          updateSpotlightAsync(() => document.getElementById('gear-showcase-card') || document.querySelector('#tab-panel-gear .p-3.rounded-2xl'), 8);
        }
      }
    } else if (step === 2) {
      // Tour Step 2 / 3 — 훈련소(기초 훈련) 체험
      if (curTab !== 'training') {
        if (stepEl) stepEl.textContent = 'TOUR 2 / 3 · 훈련소 체험';
        if (textEl) textEl.textContent = "하네스가 정말 잘 어울려! 이제 아래 [🏋️ 훈련소] 탭을 눌러 훈련소로 가 보자!";
        actionBtn?.classList.add('hidden');
        updateSpotlightAsync(() => document.querySelector('[data-lobby-tab="training"]'), 6);
      } else {
        const isUpgraded = (save.training?.atkLevel || 0) >= 1;
        if (!isUpgraded) {
          if (stepEl) stepEl.textContent = 'TOUR 2 / 3 · 훈련소 체험';
          if (textEl) textEl.textContent = "훈련소에서는 전투로 모은 금화로 능력치를 올려! [⚡ 공격력] 훈련 버튼을 눌러 레벨업해 봐!";
          actionBtn?.classList.add('hidden');
          updateSpotlightAsync(() => document.querySelector('#tab-panel-training [data-train-key="atkLevel"] button') || document.querySelector('#tab-panel-training [data-train-key="atkLevel"]'), 6);
        } else {
          if (stepEl) stepEl.textContent = 'TOUR 2 / 3 · 훈련 완료';
          if (textEl) textEl.textContent = "우와, 공격력이 올라서 우유가 훨씬 강해졌어! 이제 로비에서 첫 실전 출격을 준비하자!";
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
      // Tour Step 3 / 3 — 내 강아지 쓰다듬기 & 온보딩 완료
      if (curTab !== 'battle') {
        switchTab?.('battle');
        return;
      }
      if (stepEl) stepEl.textContent = 'TOUR 3 / 3 · 강아지 쓰다듬기';
      if (textEl) textEl.textContent = "멍! 마지막으로 내 머리를 한 번 쓰다듬어 줄래? 기분이 좋아지면 바로 실전 출격하자!";
      actionBtn?.classList.add('hidden');
      updateSpotlightAsync(() => document.getElementById('lobby-hero-profile-card') || document.getElementById('lobby-hero-stage') || document.getElementById('pet-action-badge'), 10);
    }
  }

  function completeWithPet() {
    celebratingComplete = true;
    updateSave((s) => {
      s.onboardingCompleted = true;
      s.lobbyTourCompleted = true;
      s.onboardingStep = 5;
    });
    if (typeof window !== 'undefined' && window.settingsStore) {
      window.settingsStore.onboardingCompleted = true;
      window.settingsStore.set('lobbyTourCompleted', true);
      window.settingsStore.set('onboardingStep', 5);
      const p = window.settingsStore.getCurrentProfile();
      if (p) {
        p.onboardingCompleted = true;
        p.lobbyTourCompleted = true;
        p.onboardingStep = 5;
      }
      window.settingsStore.save();
    }
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

  // 액션 버튼 클릭 핸들러 (Step 1 하네스 장착 확인 / Step 2 훈련 확인 후 메인 로비 battle 탭 복귀)
  actionBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const save = getSave();
    const isHarnessEquipped = Boolean(save.costumes?.equipped?.harness === 'basic_harness' || save.costumes?.equipped?.harness);
    if (save.onboardingStep === 1 && isHarnessEquipped) {
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
    if (!save.tutorialCompleted || save.lobbyTourCompleted || (save.onboardingStep && save.onboardingStep >= 5)) return;

    // Step 1: 하네스 장착 감지
    if (save.onboardingStep === 1 && e.target.closest('[data-costume-equip]')) {
      setTimeout(() => {
        audioEngine.playLevelUp?.();
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

    // Step 3: 로비 중앙 내 강아지 쓰다듬기 감지
    if (save.onboardingStep === 3 && (e.target.closest('#lobby-hero-profile-card') || e.target.closest('#lobby-hero-stage') || e.target.closest('#pet-action-badge'))) {
      setTimeout(() => {
        completeWithPet();
      }, 50);
    }
  });

  window.addEventListener('resize', () => {
    const save = getSave();
    if (save.tutorialCompleted && (!save.lobbyTourCompleted || celebratingComplete)) {
      syncTour();
    }
  });

  return {
    syncTour,
    hideTour,
    completeWithPet,
  };
}
