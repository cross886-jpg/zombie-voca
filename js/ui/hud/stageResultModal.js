/**
 * js/ui/hud/stageResultModal.js
 * 스테이지 클리어/실패/12문제 배치테스트/승급전/6단계 튜토리얼 완료 정산 모달 전담 모듈
 */

import { t } from '../../data/i18n.js';
import { audioEngine } from '../../core/audioEngine.js';
import { getSave, updateSave } from '../../core/saveStore.js';
import { CHAPTER_BOSS_RECOVERY } from '../../data/chapters.js';

export function createStageResultModals({
  openModal,
  closeModal,
  hideHud,
  onReturnToLobby,
  onStartBattle,
} = {}) {
  function showStageResultModal(res) {
    if (res.isPlacement) {
      const assignedTier = res.assignedTier || { label: '초급 Lv.1', badgeLabel: '초급 Lv.1', id: 'beginner', unitOffset: 0, cefr: 'A1', recommendMsg: '' };
      const recommendMsg = assignedTier.recommendMsg || '나에게 딱 맞는 레벨로 시작해 보세요!';
      const tierLabel = assignedTier.label || assignedTier.badgeLabel || '초급 Lv.1';
      openModal(`
        <div class="text-center space-y-4 py-1">
          <div class="text-4xl">🎯✨</div>
          <div class="space-y-1.5">
            <div class="text-xs font-bold text-[#5c6e60]">전투형 배치 테스트 완료!</div>
            <h3 class="text-base sm:text-lg font-black text-[#1f2d24]">
              회원님께 딱 맞는 추천 레벨은 <br/>
              <span class="text-emerald-700 font-black text-xl">[ ${tierLabel} ]</span> 입니다!
            </h3>
            <p class="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-xl inline-block mt-1">
              "${recommendMsg}"
            </p>
            <div class="grid grid-cols-2 gap-2 text-left bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-xs mt-2">
              <div class="text-[#4a584e]">배정 레벨</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${tierLabel}</div>
              <div class="text-[#4a584e]">정답 해치</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${res.correctCount || 0} / 12</div>
              <div class="text-[#4a584e]">남은 목숨</div>
              <div class="text-right font-extrabold ${res.lives > 0 ? 'text-emerald-700' : 'text-rose-600'}">${res.lives ?? 0}개</div>
              <div class="text-[#4a584e]">처치 좀비</div>
              <div class="text-right font-extrabold text-[#1f2d24]">${res.kills || 0}마리</div>
              <div class="text-[#4a584e]">출격 스테이지</div>
              <div class="text-right font-extrabold text-emerald-800">CH.1 STAGE 1</div>
            </div>
            <!-- 지급 보상 안내 카드 -->
            <div class="p-2.5 rounded-xl bg-emerald-50/95 border-2 border-emerald-300 text-xs font-bold text-emerald-950 flex items-center justify-between shadow-xs">
              <span class="flex items-center gap-1.5">
                <span>🎁</span>
                <span>레벨테스트 완료 보상</span>
              </span>
              <span class="font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                🦺 기본 하네스 획득!
              </span>
            </div>
          </div>
          <button id="btn-result-confirm" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-[#f8f5ec] font-black text-sm shadow-[0_4px_16px_rgba(16,185,129,0.35)] active:scale-95 transition cursor-pointer">
            ⚔️ [ ${tierLabel} 확정 및 로비 이동 ]
          </button>
        </div>
      `);

      document.getElementById('btn-result-confirm')?.addEventListener('click', () => {
        const wordCursor = res.assignedCursor ?? (res.evalResult?.wordCursor ?? 0);
        updateSave((s) => {
          s.onboardingCompleted = true;
          s.onboardingStep = 1;
          s.lobbyTourCompleted = false;
          s.hasSelectedWordLevel = true;
          s.wordLevelTier = assignedTier.id;
          s.wordUnitOffset = Number(assignedTier.unitOffset) || 0;
          s.selectedLevelLabel = assignedTier.badgeLabel || tierLabel;
          if (s.courseProgress && s.studyLang && s.courseProgress[s.studyLang]) {
            s.courseProgress[s.studyLang].cefr = assignedTier.cefr;
          }
          // 게임 전투 스테이지는 항상 CH.1 STAGE 1 유지
          s.selectedChapter = 1;
          s.selectedUnit = 'unit_001';

          // 🦺 12문제 전투형 레벨테스트 정상 완료 보상: basic_harness 지급 및 미착용 상태 (투어 1단계에서 직접 착용)
          if (!s.costumes) s.costumes = { owned: [], equipped: {} };
          if (!Array.isArray(s.costumes.owned)) s.costumes.owned = [];
          if (!s.costumes.owned.includes('basic_harness')) {
            s.costumes.owned.unshift('basic_harness');
          }
          if (!s.costumes.equipped) s.costumes.equipped = {};
          s.costumes.equipped.harness = null;
        });

        if (typeof window !== 'undefined' && window.settingsStore) {
          window.settingsStore.onboardingCompleted = true;
          window.settingsStore.set('onboardingStep', 1);
          window.settingsStore.set('lobbyTourCompleted', false);
          const p = window.settingsStore.getCurrentProfile();
          if (p) {
            p.wordCursor = wordCursor;
            p.onboardingCompleted = true;
            p.onboardingStep = 1;
            p.lobbyTourCompleted = false;
          }
          window.settingsStore.save();
        }

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

    // === 챕터 보스 (30, 60, 90, 120, 150) 클리어 컷신 모달 연출 ===
    if (res.cleared && res.chapterBossClear) {
      const bossData = CHAPTER_BOSS_RECOVERY[res.stageNumber] || CHAPTER_BOSS_RECOVERY[30];
      const petName = (typeof window !== 'undefined' && window.settingsStore?.get?.('dogName')) || getSave().petName || '바둑이';
      const lang = (typeof window !== 'undefined' && window.settingsStore?.get?.('activeLanguage')) || getSave().studyLang || 'es';
      const isSpanish = lang === 'es';

      const rawVoiceText = isSpanish ? bossData.dialog.es : bossData.dialog.en;
      const voiceText = rawVoiceText.replace(/\{petName\}/g, petName);
      const subtitleKo = bossData.dialog.ko.replace(/\{petName\}/g, petName);

      audioEngine.speakWordOnce(voiceText, null, lang);

      openModal(`
        <div class="text-center space-y-3.5 py-1">
          <div class="space-y-1">
            <span class="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black">
              CHAPTER ${bossData.chapter} BOSS CLEAR 🏆
            </span>
            <h2 class="text-lg font-black text-[#1f2d24]">
              🎉 [${bossData.nextBase}] 향한 탈출 성공!
            </h2>
            <p class="text-xs text-[#5c6e60] font-bold">
              ${bossData.recoveryDescription}
            </p>
          </div>

          <div class="bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl p-3 text-left space-y-2">
            <div class="flex items-center justify-between text-xs font-black">
              <span class="text-[#1f2d24]">🧑 주인 회복 단계</span>
              <span class="text-emerald-800 font-extrabold">Lv.${res.chapterBossClear.recoveryStage} / 5 (${res.chapterBossClear.cureProgress}%)</span>
            </div>
            <div class="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden border border-[#d2c8b4]">
              <div class="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-700" style="width: ${res.chapterBossClear.cureProgress}%"></div>
            </div>

            <div class="bg-[#faf6ee] border border-amber-300/80 rounded-lg p-2.5 mt-2 space-y-1">
              <div class="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                <span class="animate-pulse">🔊</span>
                <span>주인의 목소리 (${isSpanish ? '스페인어' : '영어'} TTS)</span>
              </div>
              <div class="text-xs font-black text-[#1f2d24] italic tracking-wide">
                "${voiceText}"
              </div>
              <div class="text-[11px] font-bold text-[#4a584e]">
                "${subtitleKo}"
              </div>
            </div>
          </div>

          <div class="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-xs text-left space-y-1.5">
            <div class="font-black text-amber-900 flex items-center gap-1">
              <span>🎁</span>
              <span>챕터 돌파 해금 보상</span>
            </div>
            <div class="space-y-1 font-bold text-[#1f2d24]">
              <div class="flex items-center gap-1.5 text-emerald-800">
                <span>⚔️</span>
                <span>주인 무기 <b>[ ${bossData.weaponName} ]</b> 해금 및 장착 완료!</span>
              </div>
              ${bossData.bremenUnlock ? `
                <div class="flex items-center gap-1.5 text-indigo-800">
                  <span>🐾</span>
                  <span><b>[브레멘 동행(등·어깨 동반 탑승)]</b> 해금! 등과 어깨에 동료를 동시 편성 가능!</span>
                </div>
              ` : ''}
              ${res.chapterBossClear.season2Unlocked ? `
                <div class="flex items-center gap-1.5 text-amber-900">
                  <span>🌍</span>
                  <span><b>[시즌 1 명예 구조자 훈장]</b> 수여 & <b>[시즌 2 글로벌 구조 월드 투어]</b> 오픈!</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="pt-1">
            <button id="btn-chapter-vehicle-depart" type="button" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 text-[#f8f5ec] font-black text-sm shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-95 transition cursor-pointer flex items-center justify-center gap-2">
              <span>${bossData.vehicleIcon}</span>
              <span>[ 다음 거점으로 출발 ▶ ]</span>
            </button>
          </div>
        </div>
      `);

      document.getElementById('btn-chapter-vehicle-depart')?.addEventListener('click', () => {
        audioEngine.playPowerUp?.();
        const btn = document.getElementById('btn-chapter-vehicle-depart');
        if (btn) {
          btn.innerHTML = `<span>${bossData.vehicleIcon} [${bossData.vehicle}] 출발 중... 💨</span>`;
          btn.setAttribute('disabled', 'true');
        }
        setTimeout(() => {
          closeModal();
          hideHud();
          onReturnToLobby?.();
        }, 1100);
      });
      return;
    }

    const title = res.cleared ? t('modal.resultClearTitle') : t('modal.resultFailTitle');
    const icon = res.cleared ? (res.isTutorial ? '🎉' : '🏆') : '💀';

    const stage3Banner = (res.cleared && res.stage3FirstClear) ? `
      <div class="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-center space-y-1">
        <div class="text-xs font-black text-emerald-900 flex items-center justify-center gap-1">
          <span>🎉</span>
          <span>첫 동료 [공항 탐지견] 구출!</span>
        </div>
        <p class="text-[11px] text-emerald-800 font-bold leading-tight">
          "이제 떨어진 코인과 보석을 자석처럼 끌어당깁니다!"<br/>
          (지상 동료 슬롯에 자동 장착되었습니다)
        </p>
      </div>
    ` : '';

    const reviewBonusBox = (res.cleared && res.isReviewStage && res.reviewMaterials) ? `
      <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs text-left">
        <div class="font-black text-amber-900 flex items-center justify-between">
          <span>🎁 5판 오답 복습 완료 보너스!</span>
          <span class="text-[10px] text-amber-700 font-bold">주인 장비 제작 재료</span>
        </div>
        <div class="grid grid-cols-2 gap-1 font-bold text-[#1f2d24]">
          ${Object.entries(res.reviewMaterials).map(([mat, count]) => {
            const labelMap = { cloth: '🧵 천', bandage: '🩹 붕대', parts: '⚙️ 부품', herb: '🌿 약초' };
            return `<div>${labelMap[mat] || mat} +${count}</div>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    openModal(`
      <div class="text-center space-y-4">
        <div class="text-4xl">${icon}</div>
        <h2 class="text-xl font-black ${res.cleared ? 'text-amber-700' : 'text-rose-600'}">${title}</h2>
        ${res.isTutorial ? `<p class="text-xs text-emerald-800 font-semibold">${t('tutorial.complete')}</p>` : ''}
        ${stage3Banner}
        ${reviewBonusBox}
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

  function showTutorialCompleteModal() {
    audioEngine.playLevelUp?.();
    const save = getSave?.() || {};
    const dogName = save.dogName || '우유';

    openModal(`
      <div class="text-center space-y-4 py-1 select-none">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 border-2 border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.5)] flex items-center justify-center text-3xl animate-bounce">
          ⚡
        </div>

        <div class="space-y-1.5">
          <div class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black">
            ✓ 6단계 기초 훈련 & 보카-큐어 연동 완료!
          </div>
          <h2 class="text-lg sm:text-xl font-black text-[#1f2d24]">
            보카-큐어 주파수 튜닝 완료!
          </h2>
          <p class="text-xs font-extrabold text-[#4a584e] leading-relaxed break-keep">
            단어를 맞혀 <b>보카-큐어 백신 주파수</b>를 해독하고, 감염된 도시를 정화하며 <b>사랑하는 주인을 구출하는 대장정</b>이 시작됩니다!<br/>
            이제 <b>${dogName}</b>의 실전 전투 실력과 어휘력을 진단할 차례입니다.
          </p>
        </div>

        <div class="bg-[#f0ebe0] border border-[#d2c8b4] rounded-2xl p-3.5 text-left space-y-2 text-xs">
          <div class="flex items-center justify-between font-black">
            <span class="text-[#5c6e60]">🐾 기초 행동 훈련</span>
            <span class="text-emerald-800 font-extrabold">STEP 6 / 6 완료 ✓</span>
          </div>
          <div class="flex items-center justify-between font-black">
            <span class="text-[#5c6e60]">📟 보카-큐어 주파수</span>
            <span class="text-teal-800 font-extrabold">영점 동기화 100% ✓</span>
          </div>
          <div class="flex items-center justify-between font-black border-t border-[#d5ccb8] pt-1.5">
            <span class="text-[#1f2d24]">🎯 다음 관문</span>
            <span class="text-rose-700 font-extrabold">전투형 레벨 테스트 (❤️ 3목숨)</span>
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-cyan-50/90 border border-cyan-200 text-[11px] font-bold text-cyan-950 text-left space-y-1">
          <div class="font-black text-cyan-900 flex items-center gap-1">
            <span>🧬</span>
            <span>보카-큐어 해독 & 주인 구출 가이드</span>
          </div>
          <p class="text-[10.5px] leading-relaxed text-[#334155]">
            벙커 해치에서 단어를 맞힐 때마다 <b>보카-큐어 백신 파동</b>이 방출되어 좀비를 정화합니다. 12문제 진단 테스트로 최적의 레벨을 배정받고, 완료 시 <b>[🦺 기본 하네스]</b>를 보상으로 획득합니다!
          </p>
        </div>

        <button
          id="btn-start-placement-test-direct"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-[#1b4332] text-white font-black text-sm shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>⚡ 3목숨 실력 진단 레벨테스트 시작하기</span>
          <span>▶</span>
        </button>
      </div>
    `);

    document.getElementById('btn-start-placement-test-direct')?.addEventListener('click', () => {
      audioEngine.playCaptureTick?.();
      closeModal();
      hideHud();

      const curSave = getSave?.() || {};
      const chosenCourse = curSave.selectedCourse || 'lv1';

      if (typeof onStartBattle === 'function') {
        onStartBattle({
          chapterNumber: 1,
          courseId: chosenCourse,
          unitId: 'unit_001',
          isPlacement: true,
          isPlacementTest: false,
          targetUnitNum: 1,
        });
      } else {
        onReturnToLobby?.();
      }
    });
  }

  return {
    showStageResultModal,
    showTutorialCompleteModal,
  };
}
