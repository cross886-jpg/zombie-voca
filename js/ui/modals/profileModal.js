/**
 * js/ui/modals/profileModal.js
 * 통합 프로필 모달 (아바타 선택, 강아지/주인 이름 즉시 수정, 학습 언어 타일 전환, 레벨 변경 연결)
 */

import { BREEDS } from '../../data/catalog.js';
import { t } from '../../data/i18n.js';
import { getSave, updateSave } from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import { getEvolutionStage } from '../../entities/player.js';
import { renderDogToCanvas } from '../../render/dogRenderer.js';
import { openWordLevelSelectModal } from './onboardingModals.js';
import {
  renderLanguageTilesHtml,
  attachLanguageTileEvents,
} from './settingsModal.js';
import settingsStore from '../../settingsStore.js';

export const PROFILE_AVATARS = Object.freeze([
  { id: 'pomeranian', icon: '🐶', name: '우유', breedId: 'pomeranian', isDefault: true },
  { id: 'maltese', icon: '🤍', name: '구름이', breedId: 'maltese' },
  { id: 'poodle', icon: '🐩', name: '초코', breedId: 'poodle' },
  { id: 'corgi', icon: '🦊', name: '코기', breedId: 'corgi' },
  { id: 'retriever', icon: '🦮', name: '인절미', breedId: 'retriever' },
  { id: 'beagle', icon: '🐶', name: '바우', breedId: 'beagle' },
  { id: 'owner_male', icon: '🧑', name: '민우', isDefault: true },
  { id: 'owner_female', icon: '👧', name: '지우', isDefault: true },
  { id: 'hero_shield', icon: '🛡️', name: '수호대', isDefault: true },
]);

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

  const { pct: progressPct, mastered: levelMasteredCount, total: levelTotalCount } = getProfileProgress(save);

  const unlockedBreeds = Array.isArray(save.unlockedBreeds) ? save.unlockedBreeds : ['pomeranian'];
  const unlockedCompanions = Array.isArray(save.companions?.unlocked)
    ? save.companions.unlocked
    : (Array.isArray(save.unlockedCompanions) ? save.unlockedCompanions : []);

  const curAvatarId = profile.profileAvatarId || save.profileAvatarId || curBreedId;
  const curAvatar = PROFILE_AVATARS.find((a) => a.id === curAvatarId) || PROFILE_AVATARS[0];

  const avatarListHtml = PROFILE_AVATARS.map((av) => {
    const isUnlocked = av.isDefault ||
      (av.breedId && (unlockedBreeds.includes(av.breedId) || av.breedId === curBreedId)) ||
      (av.companionId && unlockedCompanions.includes(av.companionId));
    const isSelected = av.id === curAvatarId;
    return `
      <button
        type="button"
        data-profile-avatar-id="${av.id}"
        ${isUnlocked ? '' : 'disabled data-locked="true"'}
        class="relative shrink-0 p-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-150 ${
          isUnlocked
            ? (isSelected
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs active:scale-95 cursor-pointer'
                : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0] active:scale-95 cursor-pointer')
            : 'bg-stone-100 border-stone-300 opacity-50 cursor-not-allowed'
        }"
        title="${isUnlocked ? av.name : `${av.name} (미해금 캐릭터)`}"
      >
        <div class="relative w-10 h-10 rounded-lg bg-[#f0ebe0] flex items-center justify-center text-xl shadow-inner pointer-events-none">
          <span class="${isUnlocked ? '' : 'grayscale opacity-60'} pointer-events-none">${av.icon}</span>
          ${!isUnlocked ? '<span class="absolute inset-0 flex items-center justify-center text-xs bg-black/20 rounded-lg pointer-events-none">🔒</span>' : ''}
          ${isSelected && isUnlocked ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center shadow pointer-events-none">✓</span>' : ''}
        </div>
        <span class="text-[9.5px] font-black text-[#1f2d24] mt-1 max-w-[50px] truncate text-center pointer-events-none">${isUnlocked ? av.name : '🔒 ' + av.name}</span>
      </button>
    `;
  }).join('');

  openModal(`
    <div class="space-y-3.5 max-h-[85vh] overflow-y-auto pr-1 select-none text-left">
      <!-- 상단 헤더 -->
      <div class="flex items-center justify-between pb-1 border-b border-[#d2c8b4]">
        <h2 class="text-base font-black text-[#1f2d24] flex items-center gap-1.5">
          <span>🎖️</span>
          <span>수호견 & 파트너 프로필</span>
        </h2>
        <button id="btn-close-modal" type="button" class="text-[#4a584e] hover:text-[#1f2d24] text-lg font-bold cursor-pointer">✕</button>
      </div>

      <!-- 1. 수호견 & 파트너 정보 카드 -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-r from-[#234735] to-[#1b3b2b] text-[#f8f5ec] shadow-md flex items-center gap-3.5 border border-[#2d5a43]">
        <div class="w-16 h-16 rounded-2xl bg-[#142c20]/70 border-2 border-[#2d5a43] flex items-center justify-center shrink-0 overflow-hidden shadow-inner relative">
          ${curAvatar.breedId ? `
            <canvas id="profile-dog-canvas" width="64" height="64" class="w-16 h-16 block"></canvas>
          ` : `
            <span class="text-3xl leading-none select-none">${curAvatar.icon}</span>
          `}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base font-black text-amber-200 truncate">${dogName}</span>
            <span class="text-xs font-bold text-emerald-200/90">(${curBreed.name})</span>
          </div>
          <div class="text-[11px] text-[#e6dec8] font-bold mt-0.5">
            파트너: <b class="text-white">${ownerName}</b> · ${t(evo.key)}
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

      <!-- 3. 이름 즉시 수정 (수호견 이름 & 파트너 이름) -->
      <div class="p-3 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] space-y-2">
        <div class="text-xs font-bold text-[#4a584e] flex items-center gap-1">
          <span>✏️</span>
          <span>이름 수정 (터치하여 즉시 변경)</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-[#5c6e60] mb-0.5">🐕 수호견 이름</label>
            <input id="input-profile-dog-name" type="text" maxlength="8" value="${dogName}" class="w-full py-1.5 px-2 rounded-xl bg-white border border-[#d2c8b4] font-black text-xs text-[#1f2d24] focus:outline-none focus:ring-1 focus:ring-emerald-600">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[#5c6e60] mb-0.5">🩹 파트너 이름</label>
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

      <button id="btn-close-profile" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-bold text-xs active:scale-95 transition cursor-pointer">
        확인
      </button>
    </div>
  `);

  const profileDogCanvas = document.getElementById('profile-dog-canvas');
  if (profileDogCanvas) {
    renderDogToCanvas(profileDogCanvas, {
      save,
      breedId: curAvatar.breedId || curBreedId,
      scale: 1.15,
      offsetY: 5,
    });
  }

  // 프로필 아바타 선택
  document.querySelectorAll('[data-profile-avatar-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget;
      if (button.hasAttribute('disabled') || button.dataset.locked === 'true') {
        audioEngine.playCaptureTick?.();
        return;
      }
      const avId = button.getAttribute('data-profile-avatar-id');
      const av = PROFILE_AVATARS.find((a) => a.id === avId);
      if (!av) return;
      updateSave((s) => {
        s.profileAvatarId = av.id;
        s.profileAvatarIcon = av.icon;
        if (av.breedId) {
          s.profileAvatarBreedId = av.breedId;
        } else {
          s.profileAvatarBreedId = null;
        }
      });
      const prof = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
        ? settingsStore.getCurrentProfile()
        : null;
      if (prof) {
        prof.profileAvatarId = av.id;
        prof.profileAvatarIcon = av.icon;
        prof.profileAvatarBreedId = av.breedId || null;
        settingsStore.saveCurrentProfile?.();
      }
      if (typeof settingsStore !== 'undefined' && settingsStore.save) {
        settingsStore.save();
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
