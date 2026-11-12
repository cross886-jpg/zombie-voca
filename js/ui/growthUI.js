/**
 * js/ui/growthUI.js
 * 하단 탭의 훈련소(우유·동물 친구 공/방 레벨업),
 * 장비·코스튬 착용(도감 수집 보너스 표시 및 동료 최대 2마리 동행 편성),
 * 상점 뽑기(일반 보급 상자 / 프리미엄 여행 가방) UI 제어
 */

import {
  BALANCE,
  MAX_EQUIPPED_COMPANIONS,
  getTrainingBonusValue,
  getTrainingUpgradeCost,
  isCompanionUnlockable,
} from '../config/balance.js';
import { COMPANIONS, COSTUMES, SNACKS, getCostumeCollectionBonus } from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats } from '../entities/player.js';

const TRAINING_UI_DEFS = [
  {
    key: 'atkLevel',
    icon: '⚡',
    label: '공격력',
    accent: 'text-emerald-800',
    btnBg: 'bg-[#2d6a4f] text-[#f8f5ec]',
    getCurNext: (save, lv, cfg) => {
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
    getCurNext: (save, lv, cfg) => {
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
    getCurNext: (save, lv, cfg) => {
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
    getCurNext: (save, lv, cfg) => {
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

function getCompanionUpgradeCost(level) {
  return Math.round(
    BALANCE.COMPANIONS.BASE_UPGRADE_GOLD * Math.pow(BALANCE.COMPANIONS.UPGRADE_GOLD_GROWTH, Math.max(0, level - 1))
  );
}

export function createGrowthUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const gearPanel = document.getElementById('tab-panel-gear');
  const trainingPanel = document.getElementById('tab-panel-training');
  let selectedCompId = COMPANIONS[0]?.id || 'rookie';
  let trainingSubTab = 'hero'; // 'hero' | 'companion'
  let statBoostFlash = { key: null, timer: null };
  let gearSubTab = 'costume'; // 'costume' | 'companion'
  let inventoryFilter = 'all'; // 'all' | 'weapon' | 'hat' | 'top' | 'acc'

  function rollSupplyBox(box) {
    const save = getSave();
    const cost = box.cost;
    if (save.gold < cost) return;

    const roll = Math.random();
    let targetRarity = 'common';
    let acc = 0;
    for (const [r, w] of Object.entries(box.rarityWeights)) {
      acc += w;
      if (roll <= acc) {
        targetRarity = r;
        break;
      }
    }

    const isCostume = Math.random() < box.costumeChance;
    let resultHtml = '';

    if (isCostume) {
      let pool = COSTUMES.filter((c) => c.rarity === targetRarity);
      if (pool.length === 0) pool = COSTUMES;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwned = save.costumes.owned.includes(picked.id);
      const refundSnacks = box.refundSnacks;

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
          <div class="text-xs font-bold uppercase tracking-wider text-emerald-800">${picked.rarity}</div>
          <h3 class="text-lg font-black text-[#1f2d24]">${picked.name}</h3>
          <p class="text-xs text-[#4a584e]">
            ${
              alreadyOwned
                ? `이미 보유 중인 파츠입니다! 간식 +${refundSnacks}🦴으로 변환되었습니다.`
                : `새 코스튬 획득! 도감 보너스 (+${picked.atkBonus} ATK / +${picked.hpBonus} HP)`
            }
          </p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-sm active:scale-95 transition">${t('modal.confirm')}</button>
        </div>
      `;
    } else {
      const snack = SNACKS[Math.floor(Math.random() * SNACKS.length)];
      const qty = box.snackQty;
      updateSave((s) => {
        s.gold -= cost;
        s.snacks += qty;
      });

      resultHtml = `
        <div class="text-center space-y-3">
          <div class="text-5xl">${snack.icon}</div>
          <h3 class="text-lg font-black text-amber-700">${snack.name} x${qty}</h3>
          <p class="text-xs text-[#4a584e]">동물 친구 해금에 사용할 수 있는 간식 +${qty}🦴 획득!</p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#d97706] text-white font-black text-sm active:scale-95 transition">${t('modal.confirm')}</button>
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

  function openSupplyBoxConfirmModal(box) {
    if (!openModal) {
      rollSupplyBox(box);
      return;
    }

    const canAfford = getSave().gold >= box.cost;
    openModal(`
      <div class="space-y-4">
        <div class="text-center space-y-1.5">
          <div class="text-4xl">${box.icon}</div>
          <h3 class="text-lg font-black text-[#1f2d24]">${t(box.nameKey)}</h3>
          <p class="text-xs font-semibold text-emerald-800">${box.summary}</p>
        </div>
        <div class="rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] p-3 text-xs text-[#4a584e] leading-relaxed whitespace-pre-line">${box.rewardsInfo}</div>
        <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-xs">
          <span class="text-[#4a584e] font-semibold">필요 비용</span>
          <span class="font-black text-amber-700">${box.cost} 🪙</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button id="btn-box-confirm-cancel" type="button" class="py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-sm active:scale-95 transition">취소</button>
          <button id="btn-box-confirm-open" type="button" ${canAfford ? '' : 'disabled'} class="py-2.5 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] disabled:opacity-50 text-[#f8f5ec] font-black text-sm active:scale-95 transition">열기</button>
        </div>
      </div>
    `);

    const modalLayer = document.getElementById('modal-layer');
    const cleanup = () => modalLayer?.removeEventListener('click', onBackdropClick);
    const onBackdropClick = (e) => {
      if (e.target === modalLayer) {
        cleanup();
        closeModal?.();
      }
    };
    modalLayer?.addEventListener('click', onBackdropClick);

    document.getElementById('btn-box-confirm-cancel')?.addEventListener('click', () => {
      cleanup();
      closeModal?.();
    });

    document.getElementById('btn-box-confirm-open')?.addEventListener('click', () => {
      cleanup();
      rollSupplyBox(box);
    });
  }

  function renderGearTab() {
    const save = getSave();
    const stats = computePlayerStats(save);
    const ownedSet = new Set(save.costumes?.owned || []);
    const equipped = save.costumes?.equipped || {};
    const collectionBonus = getCostumeCollectionBonus(save.costumes?.owned || []);
    const activeCompIds = save.companions?.active || [];
    const unlockedCompSet = new Set(save.companions?.unlocked || []);

    // 1. 쇼케이스용 장착 아이템 추출
    const eqWeapon = COSTUMES.find((c) => c.id === equipped.weapon);
    const eqAcc = COSTUMES.find((c) => c.id === equipped.acc) || COSTUMES.find((c) => c.id === equipped.aura);
    const eqHat = COSTUMES.find((c) => c.id === equipped.hat);
    const eqTop = COSTUMES.find((c) => c.id === equipped.outfit);

    const equippedList = [eqWeapon, eqHat, eqTop, eqAcc].filter(Boolean);
    const equippedAtkBonus = equippedList.reduce((sum, item) => sum + (item.atkBonus || 0), 0);
    const equippedHpBonus = equippedList.reduce((sum, item) => sum + (item.hpBonus || 0), 0);

    function renderShowcaseSlot(placeholderIcon, label, item) {
      if (item) {
        const rarityBorder =
          item.rarity === 'legend'
            ? 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
            : item.rarity === 'epic'
              ? 'border-purple-400'
              : item.rarity === 'rare'
                ? 'border-sky-400'
                : 'border-emerald-600/70';
        return `
          <button type="button" data-costume-equip="${item.id}" title="${item.name} (클릭하여 해제)" class="costume-equip-btn w-14 h-14 rounded-xl bg-[#f0ebe0] border-2 ${rarityBorder} p-1 flex flex-col items-center justify-center relative active:scale-95 transition shadow-xs">
            <span class="text-xl leading-none">${item.icon}</span>
            <span class="text-[9px] font-black text-[#1f2d24] truncate max-w-full mt-0.5">${item.name}</span>
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] flex items-center justify-center font-bold">✓</span>
          </button>
        `;
      }
      return `
        <div class="w-14 h-14 rounded-xl bg-[#efe9dc] border border-dashed border-[#d2c8b4] p-1 flex flex-col items-center justify-center text-[#a3b899]">
          <span class="text-base leading-none opacity-60">${placeholderIcon}</span>
          <span class="text-[9px] font-bold mt-0.5">${label}</span>
        </div>
      `;
    }

    const showcaseHtml = `
      <div class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
          <span class="font-extrabold text-[#1f2d24]">우유 장착 쇼케이스</span>
          <span class="text-[11px] font-bold text-amber-700">도감 +${collectionBonus.atkBonus} ATK / +${collectionBonus.hpBonus} HP</span>
        </div>

        <div class="flex items-center justify-between gap-3">
          <!-- 왼쪽 2개 슬롯: ⚔️ 무기, 💍 악세사리 -->
          <div class="flex flex-col gap-2 shrink-0">
            ${renderShowcaseSlot('⚔️', '무기', eqWeapon)}
            ${renderShowcaseSlot('💍', '악세', eqAcc)}
          </div>

          <!-- 정중앙: 우유 캐릭터 프리뷰 & 장착 합산 스탯 -->
          <div class="flex-1 flex flex-col items-center justify-center text-center">
            <div class="relative w-20 h-20 rounded-full bg-radial from-emerald-600/20 via-emerald-600/5 to-transparent flex items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-[#f0ebe0] border border-emerald-600/40 shadow-[0_0_16px_rgba(45,106,79,0.2)] flex items-center justify-center text-4xl">
                ${stats.evoStage.icon || '🐶'}
              </div>
            </div>
            <div class="text-xs font-black text-[#1f2d24] mt-1.5">우유</div>
            <div class="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-[#f0ebe0] border border-[#d2c8b4] text-[10px] font-extrabold">
              <span class="text-emerald-800">⚔️ +${equippedAtkBonus}</span>
              <span class="text-[#a3b899]">·</span>
              <span class="text-rose-600">❤️ +${equippedHpBonus}</span>
            </div>
          </div>

          <!-- 오른쪽 2개 슬롯: 🧢 모자, 👕 상의 -->
          <div class="flex flex-col gap-2 shrink-0">
            ${renderShowcaseSlot('🧢', '모자', eqHat)}
            ${renderShowcaseSlot('👕', '상의', eqTop)}
          </div>
        </div>
      </div>
    `;

    // 2. 통합 인벤토리 필터 및 4열 정사각형 그리드
    const filterDefs = [
      { key: 'all', label: '전체' },
      { key: 'weapon', label: '⚔️ 무기' },
      { key: 'hat', label: '🧢 모자' },
      { key: 'top', label: '👕 상의' },
      { key: 'acc', label: '💍 악세' },
    ];

    const filteredCostumes = COSTUMES.filter((c) => {
      if (inventoryFilter === 'all') return true;
      if (inventoryFilter === 'weapon') return c.slot === 'weapon';
      if (inventoryFilter === 'hat') return c.slot === 'hat';
      if (inventoryFilter === 'top') return c.slot === 'outfit';
      if (inventoryFilter === 'acc') return c.slot === 'acc' || c.slot === 'aura';
      return true;
    });

    const inventoryGridHtml = filteredCostumes.map((item) => {
      const isOwned = ownedSet.has(item.id);
      const isEquipped = Object.values(equipped).includes(item.id);
      const slotIcon = item.slot === 'weapon' ? '⚔️' : item.slot === 'hat' ? '🧢' : item.slot === 'outfit' ? '👕' : '💍';

      const rarityBorder =
        item.rarity === 'legend'
          ? 'border-amber-500'
          : item.rarity === 'epic'
            ? 'border-purple-400'
            : item.rarity === 'rare'
              ? 'border-sky-400'
              : 'border-[#d2c8b4]';

      const cardBase = `aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-between text-center relative transition select-none ${
        isEquipped
          ? 'bg-emerald-600/15 border-emerald-600 ring-2 ring-emerald-500/40 shadow-[0_0_10px_rgba(45,106,79,0.25)]'
          : isOwned
            ? `bg-[#faf6ee] shadow-sm ${rarityBorder} active:scale-95 hover:border-emerald-600/50 cursor-pointer`
            : 'bg-[#efe9dc] border-dashed border-[#d2c8b4] opacity-55'
      }`;

      const innerHtml = `
        <span class="absolute top-1 left-1 text-[10px] leading-none opacity-80">${slotIcon}</span>
        ${isEquipped ? `<span class="absolute top-1 right-1 px-1 py-0.2 rounded-full bg-[#2d6a4f] text-[#f8f5ec] text-[8px] font-black leading-tight">장착</span>` : ''}
        <span class="text-2xl leading-none mt-2">${item.icon}</span>
        <div class="w-full min-w-0">
          <div class="text-[10px] font-extrabold text-[#1f2d24] truncate">${item.name}</div>
          <div class="text-[9px] text-[#4a584e] truncate leading-tight">${item.atkBonus > 0 ? `+${item.atkBonus} ATK` : ''}${item.atkBonus > 0 && item.hpBonus > 0 ? ' · ' : ''}${item.hpBonus > 0 ? `+${item.hpBonus} HP` : ''}</div>
        </div>
      `;

      return isOwned
        ? `<button type="button" data-costume-equip="${item.id}" class="costume-equip-btn ${cardBase}">${innerHtml}</button>`
        : `<div class="${cardBase}">${innerHtml}</div>`;
    }).join('');

    // 3. 동물 친구 슬롯 & 상세 카드
    const companionSlots = COMPANIONS.map((comp) => {
      const isUnlocked = unlockedCompSet.has(comp.id);
      const isActive = activeCompIds.includes(comp.id);
      const unlockable = isCompanionUnlockable(comp.id, save);
      const isLockedSeq = !isUnlocked && !unlockable;
      const isSelected = selectedCompId === comp.id;

      return `
        <button type="button" data-comp-select="${comp.id}" class="comp-slot-btn aspect-square rounded-xl p-1.5 flex flex-col items-center justify-center relative transition active:scale-95 ${
          isLockedSeq
            ? 'bg-[#efe9dc] border border-dashed border-[#d2c8b4] opacity-75'
            : isActive
              ? 'bg-emerald-600/15 border border-emerald-600'
              : 'bg-[#faf6ee] shadow-sm border border-[#d2c8b4]'
        } ${isSelected ? 'ring-2 ring-emerald-600' : ''}">
          ${
            isLockedSeq
              ? `<span class="text-xl leading-none text-[#4a584e]">❓</span>
                 <span class="text-[9px] font-bold text-[#4a584e] mt-1 truncate max-w-full">${comp.shortHint}</span>`
              : `<span class="text-2xl leading-none">${comp.icon}</span>
                 <span class="text-[9px] font-extrabold text-[#1f2d24] mt-1 truncate max-w-full">${comp.name.split(' ').pop()}</span>
                 ${
                   isActive
                     ? `<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600"></span>`
                     : !isUnlocked
                       ? `<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>`
                       : ''
                 }`
          }
        </button>
      `;
    }).join('');

    const selComp = COMPANIONS.find((c) => c.id === selectedCompId) || COMPANIONS[0];
    const selUnlocked = unlockedCompSet.has(selComp.id);
    const selActive = activeCompIds.includes(selComp.id);
    const selUnlockable = isCompanionUnlockable(selComp.id, save);
    const selLockedSeq = !selUnlocked && !selUnlockable;
    const selCanUnlock = !selUnlocked && selUnlockable && save.snacks >= selComp.unlockSnacks;

    const companionDetailHtml = selLockedSeq
      ? `
        <div class="p-3 rounded-xl bg-[#f0ebe0] border border-dashed border-[#d2c8b4] flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#faf6ee] shadow-sm border border-dashed border-[#d2c8b4] flex items-center justify-center text-xl shrink-0">❓</div>
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-[#4a584e]">❓ 미확인 동료</div>
              <div class="text-[11px] text-[#4a584e] mt-0.5">🔒 ${selComp.unlockDesc}</div>
            </div>
          </div>
          <span class="px-2.5 py-1.5 rounded-lg bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-[11px] font-bold text-[#4a584e] shrink-0">잠금</span>
        </div>
      `
      : `
        <div class="p-3 rounded-xl bg-[#faf6ee] shadow-sm border ${selActive ? 'border-emerald-600' : 'border-[#d2c8b4]'} flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0">${selComp.icon}</div>
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-[#1f2d24] truncate">${selComp.name} <span class="text-[10px] font-bold text-emerald-800">· ${selComp.role}</span></div>
              <div class="text-[10px] text-[#4a584e] truncate mt-0.5">${selComp.desc}</div>
              <div class="text-[10px] text-[#4a584e] mt-0.5">조건: ${selComp.unlockDesc}</div>
            </div>
          </div>
          ${
            selUnlocked
              ? `<button type="button" data-comp-toggle="${selComp.id}" class="comp-toggle-btn px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                  selActive
                    ? 'bg-[#2d6a4f] text-[#f8f5ec]'
                    : 'bg-[#e6dec8] border border-[#d2c8b4] text-[#1f2d24]'
                }">${selActive ? t('lobby.companionDeploy') : t('lobby.companionSelect')}</button>`
              : `<button type="button" data-comp-unlock="${selComp.id}" ${selCanUnlock ? '' : 'disabled'} class="comp-unlock-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
                  selCanUnlock
                    ? 'bg-[#d97706] text-white active:scale-95'
                    : 'bg-[#e6dec8] text-[#4a584e] opacity-60'
                }">${t('lobby.companionLocked', { cost: selComp.unlockSnacks })}</button>`
          }
        </div>
      `;

    // 4. 서브 탭 분리 HTML 구조
    const subTabHtml = `
      <div class="flex items-center p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold gap-1">
        <button type="button" data-gear-subtab="costume" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          gearSubTab === 'costume' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🎒 장비·코스튬
        </button>
        <button type="button" data-gear-subtab="companion" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          gearSubTab === 'companion' ? 'bg-[#faf6ee] text-emerald-800 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🐾 동물 친구
        </button>
      </div>
    `;

    gearPanel.classList.add('pb-24');
    gearPanel.innerHTML = `
      ${subTabHtml}
      ${
        gearSubTab === 'costume'
          ? `
            ${showcaseHtml}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-extrabold text-emerald-800">📦 보유 인벤토리</h3>
                <span class="text-[10px] font-bold text-[#4a584e]">${ownedSet.size} / ${COSTUMES.length} 보유</span>
              </div>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
                ${filterDefs.map((f) => `
                  <button type="button" data-inv-filter="${f.key}" class="px-2.5 py-1 rounded-lg transition-all ${
                    inventoryFilter === f.key
                      ? 'bg-[#2d6a4f] text-[#f8f5ec] font-black shadow-xs'
                      : 'bg-[#e6dec8] text-[#4a584e] hover:text-[#1f2d24]'
                  }">
                    ${f.label}
                  </button>
                `).join('')}
              </div>
              <div class="grid grid-cols-4 gap-2">${inventoryGridHtml}</div>
            </div>
          `
          : `
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-extrabold text-emerald-800">🐾 ${t('lobby.companionsTitle')}</h3>
                <span class="text-[11px] text-[#4a584e]">${activeCompIds.length} / ${MAX_EQUIPPED_COMPANIONS}</span>
              </div>
              <div class="grid grid-cols-4 gap-2">${companionSlots}</div>
              ${companionDetailHtml}
            </div>
          `
      }
    `;

    // 이벤트 리스너 등록
    gearPanel.querySelectorAll('[data-gear-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-gear-subtab');
        if (tab && tab !== gearSubTab) {
          gearSubTab = tab;
          renderGearTab();
        }
      });
    });

    if (gearSubTab === 'costume') {
      gearPanel.querySelectorAll('[data-inv-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-inv-filter');
          if (filter && filter !== inventoryFilter) {
            inventoryFilter = filter;
            renderGearTab();
          }
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
    } else {
      gearPanel.querySelectorAll('.comp-slot-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedCompId = btn.getAttribute('data-comp-select');
          renderGearTab();
        });
      });

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
    }
  }

  function openSupplyShopModal() {
    if (!openModal) return;
    const save = getSave();
    const boxesHtml = Object.values(BALANCE.SHOP.BOXES).map((box) => `
      <button type="button" data-supply-box="${box.id}" ${save.gold >= box.cost ? '' : 'disabled'} class="modal-supply-box-btn p-3 rounded-xl border ${
        box.isPremium ? 'border-amber-600/50 bg-amber-500/15' : 'border-[#d2c8b4] bg-[#f0ebe0]'
      } text-left disabled:opacity-50 active:scale-95 transition flex flex-col justify-between">
        <div>
          <div class="text-2xl mb-1">${box.icon}</div>
          <div class="text-xs font-extrabold ${box.isPremium ? 'text-amber-800' : 'text-[#1f2d24]'}">${t(box.nameKey)}</div>
          <div class="text-[10px] text-[#4a584e] mt-0.5 leading-snug">${box.summary}</div>
        </div>
        <div class="text-[11px] font-bold text-amber-700 mt-2">${box.cost} 🪙</div>
      </button>
    `).join('');

    openModal(`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-black text-emerald-800">🎁 ${t('lobby.shopTitle')}</h3>
          <span class="text-xs font-extrabold text-amber-700">🪙 ${save.gold || 0}</span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">${boxesHtml}</div>
        <button id="btn-close-supply-shop" type="button" class="w-full py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] border border-[#d2c8b4] text-[#1f2d24] font-bold text-xs active:scale-95 transition">${t('modal.close')}</button>
      </div>
    `);

    const modalLayer = document.getElementById('modal-layer');
    const cleanup = () => modalLayer?.removeEventListener('click', onBackdropClick);
    const onBackdropClick = (e) => {
      if (e.target === modalLayer) {
        cleanup();
        closeModal?.();
      }
    };
    modalLayer?.addEventListener('click', onBackdropClick);

    document.getElementById('btn-close-supply-shop')?.addEventListener('click', () => {
      cleanup();
      closeModal?.();
    });

    document.querySelectorAll('.modal-supply-box-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cleanup();
        const boxId = btn.getAttribute('data-supply-box');
        const box = BALANCE.SHOP.BOXES[boxId];
        if (box) openSupplyBoxConfirmModal(box);
      });
    });
  }

  function renderTrainingTab() {
    const save = getSave();
    const training = save.training || {};
    const stats = computePlayerStats(save);
    const totalTrainLv = Object.values(training).reduce((sum, v) => sum + (Number(v) || 0), 0);

    const statMap = [
      { key: 'atkLevel', label: '공격력', icon: '⚔️', val: Math.round(stats.atk) },
      { key: 'hpLevel', label: '체력', icon: '❤️', val: Math.round(stats.maxHp) },
      { key: 'speedLv', label: '이동속도', icon: '👟', val: Math.round(stats.speed) },
      { key: 'magnetLv', label: '흡수반경', icon: '🧲', val: Math.round(stats.pickupRadius) },
    ];

    const statSummaryHtml = `
      <div class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-[#e6dec8]">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${stats.evoStage.icon || '🥛'}</span>
            <div>
              <div class="text-xs font-black text-[#1f2d24]">우유 실시간 상태</div>
              <div class="text-[11px] font-bold text-emerald-800">총 훈련 Lv.${totalTrainLv}</div>
            </div>
          </div>
          <div class="text-right">
            <span class="text-[11px] font-bold text-[#4a584e]">전투력</span>
            <span class="text-xs font-black text-amber-700 ml-1">⚡ ${stats.combatPower.toLocaleString()}</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${statMap.map((s) => {
            const isFlashed = statBoostFlash.key === s.key;
            return `
              <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#f0ebe0] border border-[#d2c8b4] ${isFlashed ? 'ring-2 ring-emerald-600 bg-emerald-500/15 transition-all' : ''}">
                <span class="text-[11px] text-[#4a584e] font-medium">${s.icon} ${s.label}</span>
                <span class="text-xs font-extrabold text-[#1f2d24]">
                  ${s.val}
                  ${isFlashed ? '<span class="text-emerald-700 font-black ml-0.5 animate-pulse">▲</span>' : ''}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const subTabHtml = `
      <div class="flex items-center p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold gap-1">
        <button type="button" data-train-subtab="hero" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          trainingSubTab === 'hero' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          💪 우유 기초 훈련
        </button>
        <button type="button" data-train-subtab="companion" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          trainingSubTab === 'companion' ? 'bg-[#faf6ee] text-amber-800 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🐾 동료 강화
        </button>
      </div>
    `;

    const trainCardsHtml = TRAINING_UI_DEFS.map((def) => {
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

    const unlockedComps = (save.companions.unlocked || [])
      .map((id) => COMPANIONS.find((c) => c.id === id))
      .filter(Boolean);

    const compTrainHtml =
      unlockedComps.length === 0
        ? `<div class="p-4 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] text-xs text-[#4a584e] text-center">챕터를 클리어하면 새로운 동물 친구가 합류합니다!</div>`
        : unlockedComps
            .map((comp) => {
              const lv = save.companions.levels?.[comp.id] || 1;
              const cost = getCompanionUpgradeCost(lv);
              const canBuy = save.gold >= cost;
              return `
                <div class="p-3 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xl">${comp.icon}</span>
                    <div>
                      <div class="text-xs font-extrabold text-[#1f2d24]">${comp.name} <span class="text-amber-700">Lv.${lv}</span></div>
                      <div class="text-[11px] text-[#4a584e]">공격력 +${Math.round((lv - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL * 100)}%</div>
                    </div>
                  </div>
                  <button type="button" data-comp-train="${comp.id}" ${canBuy ? '' : 'disabled'} class="comp-train-btn px-3 py-2 rounded-xl text-xs font-bold ${
                    canBuy ? 'bg-[#d97706] text-white active:scale-95' : 'bg-[#e6dec8] text-[#4a584e] opacity-60'
                  }">
                    ${t('lobby.upgradeCompanion')} (${cost}🪙)
                  </button>
                </div>
              `;
            })
            .join('');

    trainingPanel.classList.add('pb-24');
    trainingPanel.innerHTML = `
      ${statSummaryHtml}
      ${subTabHtml}
      ${
        trainingSubTab === 'hero'
          ? `<div class="grid grid-cols-3 gap-2.5">${trainCardsHtml}</div>`
          : `<div class="space-y-2">${compTrainHtml}</div>`
      }
    `;
  }

  // 훈련소 단일 이벤트 위임 핸들러
  trainingPanel.addEventListener('click', (e) => {
    const subTabBtn = e.target.closest('[data-train-subtab]');
    if (subTabBtn) {
      const tab = subTabBtn.getAttribute('data-train-subtab');
      if (tab && tab !== trainingSubTab) {
        trainingSubTab = tab;
        renderTrainingTab();
      }
      return;
    }

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
        if (statBoostFlash.timer) clearTimeout(statBoostFlash.timer);
        statBoostFlash.key = key;
        statBoostFlash.timer = setTimeout(() => {
          statBoostFlash.key = null;
          statBoostFlash.timer = null;
          renderTrainingTab();
        }, 900);
      }
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
    openSupplyShopModal,
  };
}

