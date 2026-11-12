/**
 * js/ui/growthUI.js
 * 하단 탭의 훈련소(우유·동물 친구 공/방 레벨업),
 * 장비·코스튬 착용(도감 수집 보너스 표시 및 동료 최대 2마리 동행 편성),
 * 상점 뽑기(일반 보급 상자 / 프리미엄 여행 가방) UI 제어
 */

import { BALANCE, getTrainingBonusValue, getTrainingUpgradeCost, isCompanionUnlockable } from '../config/balance.js';
import { COMPANIONS, COSTUMES, SNACKS, getCostumeCollectionBonus } from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';

const TRAINING_UI_DEFS = [
  { key: 'atkLevel', icon: '⚡', label: () => t('lobby.upgradeAtk'), accent: 'text-cyan-300', btnBg: 'bg-cyan-500', format: (v) => `기본 공격력 +${v}` },
  { key: 'hpLevel', icon: '❤️', label: () => t('lobby.upgradeHp'), accent: 'text-emerald-300', btnBg: 'bg-emerald-500', format: (v) => `기본 체력 +${v}` },
  { key: 'speedLv', icon: '👟', label: () => '이동 속도 훈련', accent: 'text-sky-300', btnBg: 'bg-sky-400', format: (v) => `이동 속도 +${(v * 100).toFixed(1)}%` },
  { key: 'magnetLv', icon: '🧲', label: () => '보석 자석 훈련', accent: 'text-violet-300', btnBg: 'bg-violet-400', format: (v) => `흡수 반경 +${v}px` },
  { key: 'ultChargeLv', icon: '🔥', label: () => '필살기 충전 효율', accent: 'text-orange-300', btnBg: 'bg-orange-400', format: (v) => `게이지 충전 +${Math.round(v * 100)}%` },
  { key: 'shieldLv', icon: '🛡️', label: () => '오답 방어막 훈련', accent: 'text-rose-300', btnBg: 'bg-rose-400', format: (v) => `오답 페널티 -${Math.round(v * 100)}%` },
];

function getCompanionUpgradeCost(level) {
  return Math.round(
    BALANCE.COMPANIONS.BASE_UPGRADE_GOLD * Math.pow(BALANCE.COMPANIONS.UPGRADE_GOLD_GROWTH, Math.max(0, level - 1))
  );
}

export function createGrowthUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const gearPanel = document.getElementById('tab-panel-gear');
  const trainingPanel = document.getElementById('tab-panel-training');

  function rollSupplyBox(isPremium) {
    const save = getSave();
    const cost = isPremium ? BALANCE.SHOP.PREMIUM_SUITCASE_GOLD : BALANCE.SHOP.NORMAL_BOX_GOLD;
    if (save.gold < cost) return;

    const rarityWeights = isPremium
      ? { common: 0.25, rare: 0.38, epic: 0.25, legend: 0.12 }
      : { common: 0.62, rare: 0.28, epic: 0.08, legend: 0.02 };

    const roll = Math.random();
    let targetRarity = 'common';
    let acc = 0;
    for (const [r, w] of Object.entries(rarityWeights)) {
      acc += w;
      if (roll <= acc) {
        targetRarity = r;
        break;
      }
    }

    // 70% 확률로 코스튬, 30% 확률로 간식 다발
    const isCostume = Math.random() < (isPremium ? 0.8 : 0.6);
    let resultHtml = '';

    if (isCostume) {
      let pool = COSTUMES.filter((c) => c.rarity === targetRarity);
      if (pool.length === 0) pool = COSTUMES;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwned = save.costumes.owned.includes(picked.id);
      const refundSnacks = isPremium ? 3 : 1;

      updateSave((s) => {
        s.gold -= cost;
        if (alreadyOwned) {
          s.snacks += refundSnacks;
        } else {
          s.costumes.owned.push(picked.id);
        }
      });

      resultHtml = `
        <div class="text-center space-y-3">
          <div class="text-5xl">${picked.icon}</div>
          <div class="text-xs font-bold uppercase tracking-wider text-cyan-300">${picked.rarity}</div>
          <h3 class="text-lg font-black text-white">${picked.name}</h3>
          <p class="text-xs text-slate-300">
            ${
              alreadyOwned
                ? `이미 보유 중인 파츠입니다! 간식 +${refundSnacks}🦴으로 변환되었습니다.`
                : `새 코스튬 획득! 도감 보너스 (+${picked.atkBonus} ATK / +${picked.hpBonus} HP)`
            }
          </p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-sm">${t('modal.confirm')}</button>
        </div>
      `;
    } else {
      const snack = SNACKS[Math.floor(Math.random() * SNACKS.length)];
      const qty = isPremium ? 4 : 2;
      updateSave((s) => {
        s.gold -= cost;
        s.snacks += qty;
      });

      resultHtml = `
        <div class="text-center space-y-3">
          <div class="text-5xl">${snack.icon}</div>
          <h3 class="text-lg font-black text-amber-300">${snack.name} x${qty}</h3>
          <p class="text-xs text-slate-300">동물 친구 해금에 사용할 수 있는 간식 +${qty}🦴 획득!</p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm">${t('modal.confirm')}</button>
        </div>
      `;
    }

    audioEngine.playCorrect();
    onResourcesChanged?.();
    renderGearTab();

    if (openModal) {
      openModal(resultHtml);
      document.getElementById('btn-gacha-ok')?.addEventListener('click', () => closeModal?.());
    }
  }

  function renderGearTab() {
    const save = getSave();
    const ownedSet = new Set(save.costumes.owned || []);
    const equipped = save.costumes.equipped || {};
    const collectionBonus = getCostumeCollectionBonus(save.costumes.owned || []);
    const activeCompIds = save.companions.active || [];
    const unlockedCompSet = new Set(save.companions.unlocked || []);

    const companionCards = COMPANIONS.map((comp) => {
      const isUnlocked = unlockedCompSet.has(comp.id);
      const isActive = activeCompIds.includes(comp.id);
      const unlockable = isCompanionUnlockable(comp.id, save);
      const isLockedSeq = !isUnlocked && !unlockable;
      const canUnlock = !isUnlocked && unlockable && save.snacks >= comp.unlockSnacks;
      const prevComp = comp.unlockReq ? COMPANIONS.find((c) => c.id === comp.unlockReq.prevId) : null;

      return `
        <div class="p-3 rounded-xl ${
          isLockedSeq
            ? 'bg-slate-950/75 border border-slate-800/80 opacity-65'
            : `bg-slate-900/90 border ${isActive ? 'border-emerald-400' : 'border-slate-800'}`
        } flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-2xl shrink-0">${comp.icon}</div>
            <div class="min-w-0">
              <div class="text-xs font-extrabold ${isLockedSeq ? 'text-slate-400' : 'text-white'} truncate">${comp.name}</div>
              <div class="text-[11px] ${isLockedSeq ? 'text-slate-500' : 'text-slate-400'} truncate">${comp.role}</div>
            </div>
          </div>
          ${
            isUnlocked
              ? `<button type="button" data-comp-toggle="${comp.id}" class="comp-toggle-btn px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 border border-slate-700 text-slate-200'
                }">${isActive ? t('lobby.companionDeploy') : t('lobby.companionSelect')}</button>`
              : isLockedSeq
                ? `<span class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] font-bold text-slate-400 shrink-0 select-none">🔒 ${prevComp?.name || comp.unlockReq.prevId} Lv.${comp.unlockReq.prevLv} 달성 시 오픈</span>`
                : `<button type="button" data-comp-unlock="${comp.id}" ${canUnlock ? '' : 'disabled'} class="comp-unlock-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
                    canUnlock
                      ? 'bg-rose-500 text-white active:scale-95'
                      : 'bg-slate-800 text-slate-500 opacity-60'
                  }">${t('lobby.companionLocked', { cost: comp.unlockSnacks })}</button>`
          }
        </div>
      `;
    }).join('');

    const costumeCards = COSTUMES.map((item) => {
      const isOwned = ownedSet.has(item.id);
      const isEquipped = equipped[item.slot] === item.id;

      return `
        <div class="p-2.5 rounded-xl border ${
          isEquipped
            ? 'bg-cyan-500/15 border-cyan-400'
            : isOwned
              ? 'bg-slate-900/90 border-slate-700'
              : 'bg-slate-950/50 border-slate-800/60 opacity-55'
        } flex flex-col justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${item.icon}</span>
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-white truncate">${item.name}</div>
              <div class="text-[10px] text-slate-400">+${item.atkBonus} ATK · +${item.hpBonus} HP</div>
            </div>
          </div>
          ${
            isOwned
              ? `<button type="button" data-costume-equip="${item.id}" class="costume-equip-btn w-full py-1.5 rounded-lg text-[11px] font-bold ${
                  isEquipped ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200'
                }">${isEquipped ? t('lobby.equipped') : t('lobby.equip')}</button>`
              : `<div class="text-center text-[10px] text-slate-500 py-1">미보유 (상점 뽑기)</div>`
          }
        </div>
      `;
    }).join('');

    gearPanel.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-extrabold text-emerald-300">🐾 ${t('lobby.companionsTitle')}</h3>
          <span class="text-[11px] text-slate-400">${activeCompIds.length} / ${BALANCE.COMPANIONS.MAX_ACTIVE}</span>
        </div>
        <div class="space-y-2">${companionCards}</div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-extrabold text-cyan-300">🎭 ${t('lobby.costumesTitle')}</h3>
          <span class="text-[11px] font-bold text-amber-300">도감 +${collectionBonus.atkBonus} ATK / +${collectionBonus.hpBonus} HP</span>
        </div>
        <div class="grid grid-cols-2 gap-2">${costumeCards}</div>
      </div>

      <div class="space-y-2">
        <h3 class="text-xs font-extrabold text-amber-300">🎁 ${t('lobby.shopTitle')}</h3>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-buy-normal-box" type="button" ${save.gold >= BALANCE.SHOP.NORMAL_BOX_GOLD ? '' : 'disabled'} class="p-3 rounded-xl border border-slate-700 bg-slate-900 text-left disabled:opacity-50 active:scale-95 transition">
            <div class="text-xl mb-1">📦</div>
            <div class="text-xs font-extrabold text-white">${t('lobby.normalBox')}</div>
            <div class="text-[11px] font-bold text-amber-300 mt-1">${BALANCE.SHOP.NORMAL_BOX_GOLD} 🪙</div>
          </button>
          <button id="btn-buy-premium-box" type="button" ${save.gold >= BALANCE.SHOP.PREMIUM_SUITCASE_GOLD ? '' : 'disabled'} class="p-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-left disabled:opacity-50 active:scale-95 transition">
            <div class="text-xl mb-1">🧳</div>
            <div class="text-xs font-extrabold text-amber-200">${t('lobby.premiumSuitcase')}</div>
            <div class="text-[11px] font-bold text-amber-300 mt-1">${BALANCE.SHOP.PREMIUM_SUITCASE_GOLD} 🪙</div>
          </button>
        </div>
      </div>
    `;

    gearPanel.querySelectorAll('.comp-unlock-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-comp-unlock');
        const def = COMPANIONS.find((c) => c.id === id);
        if (!def) return;
        updateSave((s) => {
          if (!isCompanionUnlockable(id, s)) return;
          if (s.snacks < def.unlockSnacks || s.companions.unlocked.includes(id)) return;
          s.snacks -= def.unlockSnacks;
          s.companions.unlocked.push(id);
          s.companions.levels[id] = 1;
          if (s.companions.active.length < BALANCE.COMPANIONS.MAX_ACTIVE) {
            s.companions.active.push(id);
          }
        });
        onResourcesChanged?.();
        renderGearTab();
      });
    });

    gearPanel.querySelectorAll('.comp-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-comp-toggle');
        updateSave((s) => {
          const idx = s.companions.active.indexOf(id);
          if (idx >= 0) {
            s.companions.active.splice(idx, 1);
          } else {
            if (s.companions.active.length >= BALANCE.COMPANIONS.MAX_ACTIVE) {
              s.companions.active.shift();
            }
            s.companions.active.push(id);
          }
        });
        renderGearTab();
      });
    });

    gearPanel.querySelectorAll('.costume-equip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-costume-equip');
        const item = COSTUMES.find((c) => c.id === id);
        if (!item) return;
        updateSave((s) => {
          if (s.costumes.equipped[item.slot] === item.id) {
            s.costumes.equipped[item.slot] = null;
          } else {
            s.costumes.equipped[item.slot] = item.id;
          }
        });
        renderGearTab();
      });
    });

    document.getElementById('btn-buy-normal-box')?.addEventListener('click', () => rollSupplyBox(false));
    document.getElementById('btn-buy-premium-box')?.addEventListener('click', () => rollSupplyBox(true));
  }

  function renderTrainingTab() {
    const save = getSave();
    const training = save.training || {};

    const trainCardsHtml = TRAINING_UI_DEFS.map((def) => {
      const cfg = BALANCE.TRAINING.ITEMS[def.key];
      const lv = training[def.key] || 0;
      const isMax = lv >= cfg.maxLv;
      const cost = getTrainingUpgradeCost(def.key, lv);
      const canBuy = !isMax && save.gold >= cost;
      const bonusVal = getTrainingBonusValue(def.key, lv);

      return `
        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-extrabold text-white">${def.icon} ${def.label()} <span class="${def.accent}">Lv.${lv}${cfg.maxLv < 99 ? `/${cfg.maxLv}` : ''}</span></div>
            <div class="text-xs text-slate-400 mt-0.5">${def.format(bonusVal)}</div>
          </div>
          <button type="button" data-train-key="${def.key}" ${canBuy ? '' : 'disabled'} class="px-3.5 py-2 rounded-xl text-xs font-black shrink-0 ${
            isMax
              ? 'bg-slate-800 text-amber-300 border border-amber-400/40'
              : canBuy
                ? `${def.btnBg} text-slate-950 active:scale-95`
                : 'bg-slate-800 text-slate-500 opacity-60'
          }">
            ${isMax ? 'MAX' : `${cost} 🪙`}
          </button>
        </div>
      `;
    }).join('');

    const unlockedComps = (save.companions.unlocked || [])
      .map((id) => COMPANIONS.find((c) => c.id === id))
      .filter(Boolean);

    const compTrainHtml =
      unlockedComps.length === 0
        ? `<div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 text-center">해금된 동물 친구가 없습니다. 장비·코스튬 탭에서 간식으로 해금하세요!</div>`
        : unlockedComps
            .map((comp) => {
              const lv = save.companions.levels?.[comp.id] || 1;
              const cost = getCompanionUpgradeCost(lv);
              const canBuy = save.gold >= cost;
              return `
                <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xl">${comp.icon}</span>
                    <div>
                      <div class="text-xs font-extrabold text-white">${comp.name} <span class="text-amber-300">Lv.${lv}</span></div>
                      <div class="text-[11px] text-slate-400">공격력 +${Math.round((lv - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL * 100)}%</div>
                    </div>
                  </div>
                  <button type="button" data-comp-train="${comp.id}" ${canBuy ? '' : 'disabled'} class="comp-train-btn px-3 py-2 rounded-xl text-xs font-bold ${
                    canBuy ? 'bg-amber-400 text-slate-950 active:scale-95' : 'bg-slate-800 text-slate-500 opacity-60'
                  }">
                    ${t('lobby.upgradeCompanion')} (${cost}🪙)
                  </button>
                </div>
              `;
            })
            .join('');

    trainingPanel.classList.add('pb-24');
    trainingPanel.innerHTML = `
      <div class="space-y-2.5">
        <h3 class="text-xs font-extrabold text-cyan-300">🏋️ ${t('lobby.trainingTitle')}</h3>
        ${trainCardsHtml}
      </div>

      <div class="space-y-2 pt-2 border-t border-slate-800">
        <div class="text-xs font-extrabold text-amber-300">🐾 동료 강화</div>
        <div class="space-y-2">${compTrainHtml}</div>
      </div>
    `;
  }

  // 훈련소 단일 이벤트 위임 핸들러
  trainingPanel.addEventListener('click', (e) => {
    const trainBtn = e.target.closest('[data-train-key]');
    if (trainBtn) {
      const key = trainBtn.getAttribute('data-train-key');
      const cfg = BALANCE.TRAINING.ITEMS[key];
      if (!cfg) return;
      updateSave((s) => {
        const lv = s.training[key] || 0;
        if (lv >= cfg.maxLv) return;
        const cost = getTrainingUpgradeCost(key, lv);
        if (s.gold >= cost) {
          s.gold -= cost;
          s.training[key] = lv + 1;
        }
      });
      onResourcesChanged?.();
      renderTrainingTab();
      return;
    }

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
    renderGearTab,
    renderTrainingTab,
  };
}

