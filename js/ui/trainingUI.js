/**
 * js/ui/trainingUI.js
 * 하단 [🏋️ 훈련소] 탭 전담 UI 모듈
 * - 반려견 기초 훈련 6종 (공격력, 체력, 이동속도, 보석자석, 필살기, 오답방어)
 * - 파트너 생존 훈련 4종 (기초 체력 단련, 신속 발걸음, 백신 항체 강화, 호신 사격술)
 * - 브레멘 동료 강화
 */

import {
  BALANCE,
  getTrainingUpgradeCost,
  getOwnerTrainingUpgradeCost,
} from '../config/balance.js';
import {
  COMPANIONS,
  isCompanionUnlocked,
} from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats } from '../entities/player.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';
import { drawOwnerCharacter } from '../render/ownerRenderer.js';
import settingsStore from '../settingsStore.js';

export const TRAINING_UI_DEFS = [
  {
    key: 'atkLevel',
    icon: '⚡',
    label: '공격력',
    accent: 'text-emerald-800',
    btnBg: 'bg-[#2d6a4f] text-[#f8f5ec]',
    getCurNext: (save, lv) => {
      const cur = Math.round(computePlayerStats(save).atk);
      const nextSave = { ...save, training: { ...(save.training || {}), atkLevel: lv + 1 } };
      const next = Math.round(computePlayerStats(nextSave).atk);
      return { cur: String(cur), next: String(next) };
    },
  },
  {
    key: 'hpLevel',
    icon: '❤️',
    label: '체력',
    accent: 'text-rose-600',
    btnBg: 'bg-rose-600 text-white',
    getCurNext: (save, lv) => {
      const cur = Math.round(computePlayerStats(save).maxHp);
      const nextSave = { ...save, training: { ...(save.training || {}), hpLevel: lv + 1 } };
      const next = Math.round(computePlayerStats(nextSave).maxHp);
      return { cur: String(cur), next: String(next) };
    },
  },
  {
    key: 'speedLv',
    icon: '👟',
    label: '이동속도',
    accent: 'text-amber-800',
    btnBg: 'bg-[#d97706] text-white',
    getCurNext: (save, lv) => {
      const cur = Math.round(computePlayerStats(save).speed);
      const nextSave = { ...save, training: { ...(save.training || {}), speedLv: lv + 1 } };
      const next = Math.round(computePlayerStats(nextSave).speed);
      return { cur: String(cur), next: String(next) };
    },
  },
  {
    key: 'magnetLv',
    icon: '🧲',
    label: '보석자석',
    accent: 'text-amber-800',
    btnBg: 'bg-[#d97706] text-white',
    getCurNext: (save, lv) => {
      const cur = Math.round(computePlayerStats(save).pickupRadius);
      const nextSave = { ...save, training: { ...(save.training || {}), magnetLv: lv + 1 } };
      const next = Math.round(computePlayerStats(nextSave).pickupRadius);
      return { cur: String(cur), next: String(next) };
    },
  },
  {
    key: 'ultChargeLv',
    icon: '🔥',
    label: '필살기',
    accent: 'text-orange-700',
    btnBg: 'bg-orange-600 text-white',
    getCurNext: (save, lv, cfg) => {
      const cur = Math.round(lv * cfg.perLv * 100);
      const next = Math.round((lv + 1) * cfg.perLv * 100);
      return { cur: `+${cur}%`, next: `+${next}%` };
    },
  },
  {
    key: 'shieldLv',
    icon: '🛡️',
    label: '오답방어',
    accent: 'text-rose-600',
    btnBg: 'bg-rose-600 text-white',
    getCurNext: (save, lv, cfg) => {
      const cur = Math.round(lv * cfg.perLv * 100);
      const next = Math.round((lv + 1) * cfg.perLv * 100);
      return { cur: `-${cur}%`, next: `-${next}%` };
    },
  },
];

export const OWNER_TRAINING_UI_DEFS = [
  {
    key: 'hpLv',
    name: '기초 체력 단련',
    icon: '❤️',
    accent: 'text-rose-600',
    btnBg: 'bg-rose-600 text-white',
    formatCurNext: (lv, cfg) => {
      const cur = 100 + lv * cfg.perLv;
      const next = 100 + (lv + 1) * cfg.perLv;
      return { cur: `${cur} HP`, next: `${next} HP` };
    },
  },
  {
    key: 'speedLv',
    name: '신속 발걸음',
    icon: '👟',
    accent: 'text-amber-800',
    btnBg: 'bg-[#d97706] text-white',
    formatCurNext: (lv, cfg) => {
      const cur = Math.round(lv * cfg.perLv * 100);
      const next = Math.round((lv + 1) * cfg.perLv * 100);
      return { cur: `+${cur}%`, next: `+${next}%` };
    },
  },
  {
    key: 'cureEfficiencyLv',
    name: '백신 항체 강화',
    icon: '💉',
    accent: 'text-teal-700',
    btnBg: 'bg-teal-600 text-white',
    formatCurNext: (lv, cfg) => {
      const cur = Math.round(lv * cfg.perLv * 100);
      const next = Math.round((lv + 1) * cfg.perLv * 100);
      return { cur: `+${cur}%`, next: `+${next}%` };
    },
  },
  {
    key: 'supportAtkLv',
    name: '호신 사격술',
    icon: '🎯',
    accent: 'text-emerald-800',
    btnBg: 'bg-[#2d6a4f] text-white',
    formatCurNext: (lv, cfg) => {
      const cur = lv * cfg.perLv;
      const next = (lv + 1) * cfg.perLv;
      return { cur: `+${cur}`, next: `+${next}` };
    },
  },
];

function getCompanionUpgradeCost(level) {
  return Math.round(
    BALANCE.COMPANIONS.BASE_UPGRADE_GOLD * Math.pow(BALANCE.COMPANIONS.UPGRADE_GOLD_GROWTH, Math.max(0, level - 1))
  );
}

export function createTrainingUI({ trainingPanel, onResourcesChanged } = {}) {
  const panel = trainingPanel || document.getElementById('tab-panel-training');
  let trainingSubTab = 'hero'; // 'hero' | 'owner' | 'companion'
  let statBoostFlash = { key: null, isLevelUp: false, timer: null };

  function renderTrainingTab() {
    if (!panel) return;
    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const dogName = save.dogName || '우유';
    const ownerName = profile.ownerName || save.ownerName || '민우';
    const training = save.training || {};
    const ownerTraining = save.ownerTraining || { hpLv: 0, speedLv: 0, cureEfficiencyLv: 0, supportAtkLv: 0 };
    const stats = computePlayerStats(save);
    const totalTrainLv = Object.values(training).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const totalOwnerTrainLv = Object.values(ownerTraining).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const ownerState = profile.ownerState || { recoveryStage: 1, cureProgress: 0 };

    const isLevelUp = !!statBoostFlash.isLevelUp;

    function renderStatBox(s) {
      const isFlashed = statBoostFlash.key === s.key;
      const isAtkHighlight = s.key === 'atkLevel' && (isFlashed || (save.onboardingStep === 2 && (training.atkLevel || 0) >= 1));
      let valHtml = `<span class="text-xs font-black text-[#1f2d24] mt-1 leading-none whitespace-nowrap">${s.val}</span>`;
      if (isAtkHighlight) {
        const curAtk = Math.round(stats.atk);
        const prevAtk = Math.max(1, curAtk - 1);
        valHtml = `
          <div class="flex items-center gap-0.5 justify-center mt-1 leading-none">
            <span class="text-[10px] text-[#4a584e] font-bold">${prevAtk}</span>
            <span class="text-[9px] text-[#a3b899]">→</span>
            <span class="text-xs font-black text-emerald-800">${curAtk}</span>
          </div>
          <span class="text-[8px] font-black text-amber-700 leading-none mt-0.5">(Lv.${training.atkLevel || 1})</span>
        `;
      }

      return `
        <div class="relative w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs transition-all ${
          isFlashed || isAtkHighlight ? 'ring-2 ring-emerald-600 bg-emerald-500/20' : ''
        }">
          <span class="text-base leading-none">${s.icon}</span>
          <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none whitespace-nowrap">${s.label}</span>
          ${valHtml}
          ${isFlashed || isAtkHighlight ? '<span class="absolute top-1 right-1.5 text-emerald-700 font-black text-[9px] animate-pulse">▲</span>' : ''}
        </div>
      `;
    }

    // 반려견 스탯 요약 박스
    const heroStatSummaryHtml = `
      <div id="training-stat-summary-card" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex flex-wrap items-center justify-center gap-2 pb-2 mb-2.5 border-b border-[#e6dec8] text-center">
          <span class="text-xs font-black text-[#1f2d24]">${dogName} 실시간 상태</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">총 훈련 Lv.${totalTrainLv}</span>
          <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 border border-amber-600/35 text-[10px] font-black">⚡ 전투력 ${stats.combatPower.toLocaleString()}</span>
        </div>

        <div class="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2">
          <div class="flex flex-col items-center gap-2 w-full">
            ${renderStatBox({ key: 'atkLevel', label: '공격력', icon: '⚔️', val: Math.round(stats.atk) })}
            ${renderStatBox({ key: 'speedLv', label: '이동속도', icon: '👟', val: Math.round(stats.speed) })}
          </div>

          <div class="relative flex flex-col items-center justify-center px-1">
            <div class="relative w-20 h-20 rounded-full flex items-center justify-center">
              ${
                isLevelUp
                  ? `
                  <div class="absolute -inset-1 rounded-full border-2 border-amber-400 animate-ping opacity-75 pointer-events-none"></div>
                  <div class="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400/30 via-yellow-300/40 to-amber-500/20 blur-sm animate-pulse pointer-events-none"></div>
                  <div class="absolute -top-3.5 z-20 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[9px] shadow-md animate-bounce whitespace-nowrap pointer-events-none">
                    ⚡ LEVEL UP!
                  </div>
                  `
                  : ''
              }
              <canvas id="training-hero-canvas" width="76" height="76" class="w-18 h-18 rounded-full bg-[#faf6ee] border ${
                isLevelUp
                  ? 'border-amber-400 ring-2 ring-amber-300/60 shadow-[0_0_16px_rgba(251,191,36,0.6)]'
                  : 'border-emerald-600/40 shadow-sm'
              } transition-all duration-300 block"></canvas>
            </div>
          </div>

          <div class="flex flex-col items-center gap-2 w-full">
            ${renderStatBox({ key: 'hpLevel', label: '체력', icon: '❤️', val: Math.round(stats.maxHp) })}
            ${renderStatBox({ key: 'magnetLv', label: '흡수반경', icon: '🧲', val: Math.round(stats.pickupRadius) })}
          </div>
        </div>
      </div>
    `;

    // 파트너 생존 훈련 요약 박스
    const ownerStatSummaryHtml = `
      <div id="training-owner-summary-card" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex flex-wrap items-center justify-center gap-2 pb-2 mb-2.5 border-b border-[#e6dec8] text-center">
          <span class="text-xs font-black text-[#1f2d24]">파트너(${ownerName}) 생존 스탯 요약</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">생존 훈련 Lv.${totalOwnerTrainLv}</span>
          <span class="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 border border-teal-600/35 text-[10px] font-black">회복 Lv.${ownerState.recoveryStage || 1}</span>
        </div>

        <div class="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2">
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">❤️</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">체력</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">${100 + (ownerTraining.hpLv || 0) * 15}</span>
            </div>
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">👟</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">이동속도</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">+${Math.round((ownerTraining.speedLv || 0) * 3)}%</span>
            </div>
          </div>

          <div class="relative flex flex-col items-center justify-center px-1">
            <div class="w-20 h-20 rounded-full flex items-center justify-center">
              <canvas id="training-owner-canvas" width="76" height="76" class="w-18 h-18 rounded-full bg-[#faf6ee] border border-emerald-600/40 shadow-sm block"></canvas>
            </div>
          </div>

          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">💉</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">해독효율</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">+${Math.round((ownerTraining.cureEfficiencyLv || 0) * 5)}%</span>
            </div>
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">🎯</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">지원공격</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">+${(ownerTraining.supportAtkLv || 0) * 2}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 브레멘 동료 특훈 요약 박스
    const compData = profile.companions || save.companions || {};
    const activeGroundId = compData.activeGround || save.companions?.active?.[0] || null;
    const activeRiderId = compData.activeRider || save.companions?.active?.[1] || null;
    const unlockedComps = COMPANIONS.filter((c) => isCompanionUnlocked(c.id, save) || (save.companions?.unlocked || []).includes(c.id));
    const totalCompLv = unlockedComps.reduce((acc, c) => acc + (save.companions?.levels?.[c.id] || 1), 0);
    const totalCompAtkBonus = unlockedComps.reduce(
      (acc, comp) => acc + Math.round(((save.companions?.levels?.[comp.id] || 1) - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL * 100),
      0
    );
    const activeCompCount = (activeGroundId ? 1 : 0) + (activeRiderId ? 1 : 0);

    const companionStatSummaryHtml = `
      <div id="training-companion-summary-card" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex flex-wrap items-center justify-center gap-2 pb-2 mb-2.5 border-b border-[#e6dec8] text-center">
          <span class="text-xs font-black text-[#1f2d24]">동료들의 총 지원 전력</span>
          <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-600/30 text-[10px] font-black">구출 ${unlockedComps.length}/${COMPANIONS.length}마리</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">총합 Lv.${totalCompLv}</span>
        </div>

        <div class="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2">
          <!-- 좌측 2스탯 -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">⚔️</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">화력지원</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">+${totalCompAtkBonus}%</span>
            </div>
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">🐾</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">출격동행</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">${activeCompCount}/2</span>
            </div>
          </div>

          <!-- 중앙 브레멘 엠블럼 -->
          <div class="relative flex flex-col items-center justify-center px-1">
            <div class="w-20 h-20 rounded-full bg-gradient-to-b from-amber-100/90 to-emerald-50/70 border border-amber-600/40 shadow-sm flex flex-col items-center justify-center">
              <span class="text-2xl leading-none">🎺</span>
              <span class="text-[9.5px] font-black text-amber-900 mt-1 leading-none">동행단</span>
            </div>
          </div>

          <!-- 우측 2스탯 -->
          <div class="flex flex-col items-center gap-2 w-full">
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">✨</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">동행스킬</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">${unlockedComps.length}종</span>
            </div>
            <div class="w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs">
              <span class="text-base leading-none">⭐</span>
              <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none">육성합계</span>
              <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none">Lv.${totalCompLv}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 훈련소 3단 서브탭 바
    const subTabHtml = `
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold">
        <button type="button" data-train-subtab="hero" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'hero' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🦴 멍멍 특훈
        </button>
        <button type="button" data-train-subtab="owner" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'owner' ? 'bg-[#faf6ee] text-emerald-900 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🩹 파트너 재활·훈련
        </button>
        <button type="button" data-train-subtab="companion" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'companion' ? 'bg-[#faf6ee] text-amber-800 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🤝 동료 특훈
        </button>
      </div>
    `;

    // 반려견 6대 훈련 카드
    const heroTrainCardsHtml = TRAINING_UI_DEFS.map((def) => {
      const cfg = BALANCE.TRAINING.ITEMS[def.key];
      const lv = training[def.key] || 0;
      const isMax = lv >= cfg.maxLv;
      const cost = getTrainingUpgradeCost(def.key, lv);
      const canBuy = !isMax && save.gold >= cost;
      const { cur, next } = def.getCurNext(save, lv, cfg);

      const valDisplay = isMax
        ? `<span class="text-[#1f2d24] font-bold">${cur}</span> <span class="text-amber-700 font-extrabold text-[9px]">(MAX)</span>`
        : `<span class="text-[#1f2d24] font-bold">${cur}</span> <span class="text-[#a3b899]">→</span> <span class="text-emerald-800 font-black">${next}</span>`;

      return `
        <div data-train-key="${def.key}" class="p-2.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col justify-between items-center text-center select-none transition ${
          canBuy ? 'active:scale-95 cursor-pointer hover:border-emerald-600/50' : 'cursor-default'
        }">
          <div class="w-full">
            <div class="text-xs font-black text-[#1f2d24] truncate">
              ${def.icon} ${def.label}
            </div>
            <div class="text-[11px] font-extrabold ${def.accent} mt-0.5">
              Lv.${lv}${cfg.maxLv < 99 ? `/${cfg.maxLv}` : ''}
            </div>
          </div>

          <div class="text-[10px] font-bold mt-1 text-[#4a584e] truncate w-full">
            ${valDisplay}
          </div>

          <button type="button" data-train-key="${def.key}" ${canBuy ? '' : 'disabled'} class="w-full mt-2 py-1.5 rounded-xl text-xs font-black shrink-0 transition ${
            isMax
              ? 'bg-[#e6dec8] text-amber-800 border border-amber-600/40 pointer-events-none'
              : canBuy
                ? `${def.btnBg} active:scale-95 shadow-xs`
                : 'bg-[#e6dec8] text-[#4a584e] opacity-60 pointer-events-none'
          }">
            ${isMax ? 'MAX' : `${cost} 🪙`}
          </button>
        </div>
      `;
    }).join('');

    // 파트너 4대 생존 훈련 카드 (2열 정사각형 그리드)
    const ownerTrainCardsHtml = OWNER_TRAINING_UI_DEFS.map((def) => {
      const cfg = BALANCE.OWNER_TRAINING.ITEMS[def.key];
      const lv = ownerTraining[def.key] || 0;
      const isMax = lv >= cfg.maxLv;
      const cost = getOwnerTrainingUpgradeCost(def.key, lv);
      const canBuy = !isMax && save.gold >= cost;
      const { cur, next } = def.formatCurNext(lv, cfg);

      const valDisplay = isMax
        ? `<span class="text-[#1f2d24] font-bold">${cur}</span> <span class="text-amber-700 font-extrabold text-[9px]">(MAX)</span>`
        : `<span class="text-[#1f2d24] font-bold">${cur}</span> <span class="text-[#a3b899]">→</span> <span class="text-emerald-800 font-black">${next}</span>`;

      return `
        <div data-train-owner-key="${def.key}" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col justify-between items-center text-center select-none transition ${
          canBuy ? 'active:scale-95 cursor-pointer hover:border-emerald-600/50' : 'cursor-default'
        }">
          <div class="w-full">
            <div class="text-xs font-black text-[#1f2d24] truncate flex items-center justify-center gap-1">
              <span>${def.icon}</span>
              <span>${def.name}</span>
            </div>
            <div class="text-[11px] font-extrabold ${def.accent} mt-0.5">
              Lv.${lv}/${cfg.maxLv}
            </div>
          </div>

          <div class="text-[10px] font-bold mt-1 text-[#4a584e] truncate w-full">
            ${valDisplay}
          </div>

          <div class="text-[9.5px] text-[#5c6e60] mt-1 line-clamp-1 leading-tight">${cfg.desc}</div>

          <button type="button" data-train-owner-key="${def.key}" ${canBuy ? '' : 'disabled'} class="w-full mt-2.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition ${
            isMax
              ? 'bg-[#e6dec8] text-amber-800 border border-amber-600/40 pointer-events-none'
              : canBuy
                ? `${def.btnBg} active:scale-95 shadow-xs`
                : 'bg-[#e6dec8] text-[#4a584e] opacity-60 pointer-events-none'
          }">
            ${isMax ? 'MAX' : `${cost} 🪙`}
          </button>
        </div>
      `;
    }).join('');

    // 브레멘 동료 특훈 카드 (2열 그리드)
    const compTrainCardsHtml =
      unlockedComps.length === 0
        ? `<div class="col-span-2 p-4 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-xs text-[#4a584e] text-center">챕터를 클리어하면 새로운 동물 친구가 합류합니다!</div>`
        : unlockedComps
            .map((comp) => {
              const lv = save.companions?.levels?.[comp.id] || 1;
              const cost = getCompanionUpgradeCost(lv);
              const canBuy = save.gold >= cost;
              const isGround = comp.mountType === 'ground' || (!comp.mountType && comp.role && !comp.role.includes('음파'));
              return `
                <div data-comp-train="${comp.id}" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col justify-between items-center text-center select-none transition ${
                  canBuy ? 'active:scale-95 cursor-pointer hover:border-emerald-600/50' : 'cursor-default'
                }">
                  <div class="w-full">
                    <div class="text-xs font-black text-[#1f2d24] truncate flex items-center justify-center gap-1">
                      <span class="text-xl">${comp.icon}</span>
                      <span class="truncate">${comp.name}</span>
                    </div>
                    <div class="text-[11px] font-extrabold text-amber-700 mt-0.5">
                      Lv.${lv} · ${isGround ? '🐎 등' : '🦜 어깨'}
                    </div>
                  </div>

                  <div class="text-[10px] font-bold mt-1 text-emerald-800 truncate w-full">
                    공격력 +${Math.round((lv - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL * 100)}%
                  </div>

                  <div class="text-[9.5px] text-[#5c6e60] mt-1 line-clamp-1 leading-tight">${comp.buffText || comp.role || ''}</div>

                  <button type="button" data-comp-train="${comp.id}" ${canBuy ? '' : 'disabled'} class="comp-train-btn w-full mt-2.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition ${
                    canBuy
                      ? 'bg-[#d97706] text-white active:scale-95 shadow-xs'
                      : 'bg-[#e6dec8] text-[#4a584e] opacity-60 pointer-events-none'
                  }">
                    ${cost} 🪙
                  </button>
                </div>
              `;
            })
            .join('');

    panel.classList.add('pb-24');
    panel.innerHTML = `
      ${trainingSubTab === 'hero' ? heroStatSummaryHtml : trainingSubTab === 'owner' ? ownerStatSummaryHtml : companionStatSummaryHtml}
      ${subTabHtml}
      ${
        trainingSubTab === 'hero'
          ? `<div class="grid grid-cols-3 gap-2.5">${heroTrainCardsHtml}</div>`
          : trainingSubTab === 'owner'
          ? `<div class="grid grid-cols-2 gap-2.5">${ownerTrainCardsHtml}</div>`
          : `<div class="grid grid-cols-2 gap-2.5">${compTrainCardsHtml}</div>`
      }
    `;

    if (trainingSubTab === 'hero') {
      renderDogToCanvas(document.getElementById('training-hero-canvas'), {
        save,
        breedId: save.selectedBreed || 'pomeranian',
        scale: 1.25,
        offsetY: 4,
        withEquipment: true,
        withWeapon: false,
      });
    } else if (trainingSubTab === 'owner') {
      const ownerCanvas = document.getElementById('training-owner-canvas');
      if (ownerCanvas) {
        drawOwnerCharacter(ownerCanvas, {
          recoveryStage: ownerState.recoveryStage || 1,
          scale: 1.6,
          clearCanvas: true,
        });
      }
    }
  }

  // 훈련소 단일 이벤트 위임 핸들러
  panel?.addEventListener('click', (e) => {
    const subTabBtn = e.target.closest('[data-train-subtab]');
    if (subTabBtn) {
      const tab = subTabBtn.getAttribute('data-train-subtab');
      if (tab && tab !== trainingSubTab) {
        trainingSubTab = tab;
        renderTrainingTab();
      }
      return;
    }

    // 1. 반려견 훈련 레벨업
    const trainBtn = e.target.closest('[data-train-key]');
    if (trainBtn) {
      const key = trainBtn.getAttribute('data-train-key');
      const cfg = BALANCE.TRAINING.ITEMS[key];
      if (!cfg) return;
      let upgraded = false;
      updateSave((s) => {
        const lv = s.training[key] || 0;
        if (lv >= cfg.maxLv) return;
        const cost = getTrainingUpgradeCost(key, lv);
        if (s.gold >= cost) {
          s.gold -= cost;
          s.training[key] = lv + 1;
          upgraded = true;
        }
      });
      if (upgraded) {
        audioEngine.playLevelUp?.();
        if (statBoostFlash.timer) clearTimeout(statBoostFlash.timer);
        statBoostFlash.key = key;
        statBoostFlash.isLevelUp = true;
        statBoostFlash.timer = setTimeout(() => {
          statBoostFlash.key = null;
          statBoostFlash.isLevelUp = false;
          statBoostFlash.timer = null;
          renderTrainingTab();
        }, 2500);
      }
      onResourcesChanged?.();
      renderTrainingTab();
      return;
    }

    // 2. 파트너 생존 훈련 레벨업
    const ownerTrainBtn = e.target.closest('[data-train-owner-key]');
    if (ownerTrainBtn) {
      const key = ownerTrainBtn.getAttribute('data-train-owner-key');
      const cfg = BALANCE.OWNER_TRAINING?.ITEMS?.[key];
      if (!cfg) return;
      let upgraded = false;
      updateSave((s) => {
        if (!s.ownerTraining) {
          s.ownerTraining = { hpLv: 0, speedLv: 0, cureEfficiencyLv: 0, supportAtkLv: 0 };
        }
        const lv = s.ownerTraining[key] || 0;
        if (lv >= cfg.maxLv) return;
        const cost = getOwnerTrainingUpgradeCost(key, lv);
        if ((s.gold || 0) >= cost) {
          s.gold -= cost;
          s.ownerTraining[key] = lv + 1;
          upgraded = true;
        }
      });
      if (upgraded) {
        audioEngine.playLevelUp?.();
        onResourcesChanged?.();
        renderTrainingTab();
      } else {
        audioEngine.playWrong?.();
      }
      return;
    }

    // 3. 동료 강화
    const compBtn = e.target.closest('[data-comp-train]');
    if (compBtn) {
      const id = compBtn.getAttribute('data-comp-train');
      updateSave((s) => {
        const lv = s.companions.levels?.[id] || 1;
        const c = getCompanionUpgradeCost(lv);
        if (s.gold >= c) {
          s.gold -= c;
          s.companions.levels[id] = lv + 1;
        }
      });
      onResourcesChanged?.();
      renderTrainingTab();
    }
  });

  return {
    renderTrainingTab,
  };
}
