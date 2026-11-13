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
import {
  BREEDS,
  COMPANIONS,
  COSTUMES,
  SNACKS,
  getCostumeCollectionBonus,
  isBreedUnlocked,
  isCompanionUnlocked,
} from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats, drawDogCharacter, drawDogSkin, getEvolutionStage } from '../entities/player.js';

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
  let statBoostFlash = { key: null, isLevelUp: false, timer: null };
  let gearSubTab = 'costume'; // 'costume' | 'companion'
  let inventoryFilter = 'all'; // 'all' | 'weapon' | 'hat' | 'top' | 'acc'
  let friendFilter = 'all'; // 'all' | 'breed' | 'support'
  let selectedFriendId = 'pomeranian';

  function rollSupplyBox({ isFree, gemCost } = {}) {
    const save = getSave();
    const today = new Date().toISOString().slice(0, 10);

    // 확률: 35% 희귀 강아지 코스튬, 35% 장비 강화 조각(뼈다귀), 30% 훈련용 금화
    const roll = Math.random();
    let resultHtml = '';

    if (roll < 0.35) {
      // 1. 희귀 강아지 코스튬
      const rRoll = Math.random();
      let targetRarity = 'common';
      if (rRoll > 0.97) targetRarity = 'legend';
      else if (rRoll > 0.88) targetRarity = 'epic';
      else if (rRoll > 0.60) targetRarity = 'rare';

      let pool = COSTUMES.filter((c) => c.rarity === targetRarity);
      if (pool.length === 0) pool = COSTUMES;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const alreadyOwned = save.costumes.owned.includes(picked.id);
      const refundSnacks = targetRarity === 'legend' ? 4 : targetRarity === 'epic' ? 3 : 2;

      updateSave((s) => {
        if (isFree) {
          s.lastFreeSupplyDate = today;
        } else {
          s.gems = Math.max(0, (s.gems ?? 300) - gemCost);
        }
        if (alreadyOwned) {
          s.snacks = (s.snacks || 0) + refundSnacks;
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
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-sm active:scale-95 transition">확인</button>
        </div>
      `;
    } else if (roll < 0.70) {
      // 2. 장비 강화 조각 (뼈다귀 🦴 2~3개)
      const qty = Math.random() < 0.6 ? 2 : 3;
      updateSave((s) => {
        if (isFree) {
          s.lastFreeSupplyDate = today;
        } else {
          s.gems = Math.max(0, (s.gems ?? 300) - gemCost);
        }
        s.snacks = (s.snacks || 0) + qty;
      });

      resultHtml = `
        <div class="text-center space-y-3">
          <div class="text-5xl">🦴</div>
          <h3 class="text-lg font-black text-amber-700">장비 강화 조각 (뼈다귀 +${qty}개)</h3>
          <p class="text-xs text-[#4a584e]">동물 친구 해금 및 승급전에 사용할 수 있는 뼈다귀를 획득했습니다!</p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#d97706] text-white font-black text-sm active:scale-95 transition">확인</button>
        </div>
      `;
    } else {
      // 3. 훈련용 금화 (🪙 60~100개)
      const goldAmt = Math.floor(Math.random() * 5 + 6) * 10; // 60, 70, 80, 90, 100
      updateSave((s) => {
        if (isFree) {
          s.lastFreeSupplyDate = today;
        } else {
          s.gems = Math.max(0, (s.gems ?? 300) - gemCost);
        }
        s.gold = (s.gold || 0) + goldAmt;
      });

      resultHtml = `
        <div class="text-center space-y-3">
          <div class="text-5xl">🪙</div>
          <h3 class="text-lg font-black text-amber-800">훈련용 금화 (+${goldAmt} 🪙)</h3>
          <p class="text-xs text-[#4a584e]">훈련소에서 강아지 기초 스탯 강화에 사용하세요!</p>
          <button id="btn-gacha-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-[#f8f5ec] font-black text-sm active:scale-95 transition">확인</button>
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
    const dogName = save.dogName || '우유';
    const stats = computePlayerStats(save);
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const ownedSet = new Set(save.costumes?.owned || []);
    const equipped = save.costumes?.equipped || {};
    const collectionBonus = getCostumeCollectionBonus(save.costumes?.owned || [], maxUnlocked);
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
          <span class="font-extrabold text-[#1f2d24]">${dogName} 장착 쇼케이스</span>
          <span class="text-[11px] font-bold text-amber-700">도감 +${collectionBonus.atkBonus} ATK / +${collectionBonus.hpBonus} HP</span>
        </div>

        <div class="flex items-center justify-between gap-3">
          <!-- 왼쪽 2개 슬롯: ⚔️ 무기, 💍 악세사리 -->
          <div class="flex flex-col gap-2 shrink-0">
            ${renderShowcaseSlot('⚔️', '무기', eqWeapon)}
            ${renderShowcaseSlot('💍', '악세', eqAcc)}
          </div>

          <!-- 정중앙: 캐릭터 프리뷰 & 장착 합산 스탯 -->
          <div class="flex-1 flex flex-col items-center justify-center text-center">
            <div class="relative w-20 h-20 rounded-full bg-radial from-emerald-600/20 via-emerald-600/5 to-transparent flex items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-[#f0ebe0] border border-emerald-600/40 shadow-[0_0_16px_rgba(45,106,79,0.2)] flex items-center justify-center text-4xl">
                ${stats.evoStage.icon || '🐶'}
              </div>
            </div>
            <div class="text-xs font-black text-[#1f2d24] mt-1.5">${dogName}</div>
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

    const ownedItems = [];
    const unownedItems = [];
    for (const item of filteredCostumes) {
      const isUnlockedByStage = Boolean(item.unlockStage && maxUnlocked >= item.unlockStage);
      if (ownedSet.has(item.id) || isUnlockedByStage) {
        ownedItems.push(item);
      } else {
        unownedItems.push(item);
      }
    }

    const ownedGridHtml = ownedItems.map((item) => {
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
          : `bg-[#faf6ee] shadow-sm ${rarityBorder} active:scale-95 hover:border-emerald-600/50 cursor-pointer`
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

      return `<button type="button" data-costume-equip="${item.id}" class="costume-equip-btn ${cardBase}">${innerHtml}</button>`;
    }).join('');

    // 미획득 장비 스포일러 방지: 빈 점선 잠금 슬롯 1~2줄(4~8칸)만 은은하게 노출
    const unownedCount = unownedItems.length;
    const remainderInRow = (4 - (ownedItems.length % 4)) % 4;
    const emptyCount = Math.min(unownedCount, Math.max(4, remainderInRow + 4));

    const emptySlotsHtml = Array.from({ length: emptyCount }, () => `
      <div class="aspect-square rounded-xl border border-dashed border-[#d2c8b4] bg-[#efe9dc]/50 flex items-center justify-center text-center select-none">
        <span class="text-lg opacity-25">🔒</span>
      </div>
    `).join('');

    const inventoryGridHtml = ownedGridHtml + emptySlotsHtml;

    // 3. 동물 친구 슬롯 & 상세 카드
    const curBreedId = save.selectedBreed || 'pomeranian';
    const allFriends = [
      ...BREEDS.map((b) => ({
        id: b.id,
        type: 'breed',
        name: b.name,
        icon: b.icon,
        role: '플레이어블 수호견',
        trait: b.trait || '고유 특성',
        desc: b.desc || '',
        unlockStage: b.unlockStage || 1,
        isUnlocked: isBreedUnlocked(b.id, save),
        isSelected: curBreedId === b.id,
      })),
      ...COMPANIONS.map((c) => ({
        id: c.id,
        type: 'companion',
        name: c.name,
        icon: c.icon,
        role: c.role || '전투 서포터',
        trait: c.buffText || c.role || '',
        desc: c.desc || '',
        unlockStage: c.unlockStage || 1,
        isUnlocked: isCompanionUnlocked(c.id, save) || (save.companions?.unlocked || []).includes(c.id),
        isActive: activeCompIds.includes(c.id),
      })),
    ];

    const totalJoinedFriends = allFriends.filter((f) => f.isUnlocked).length;

    const friendFilterDefs = [
      { key: 'all', label: '전체' },
      { key: 'breed', label: '🐶 수호견' },
      { key: 'support', label: '🐾 서포터' },
    ];

    const currentFilteredFriends = allFriends.filter((f) => {
      if (friendFilter === 'breed') return f.type === 'breed';
      if (friendFilter === 'support') return f.type === 'companion';
      return true;
    });

    const joinedFriends = currentFilteredFriends.filter((f) => f.isUnlocked);
    const unjoinedFriends = currentFilteredFriends.filter((f) => !f.isUnlocked);

    const joinedSlotsHtml = joinedFriends.map((f) => {
      const isBreed = f.type === 'breed';
      const isSelectedBreed = isBreed && f.isSelected;
      const isActiveComp = !isBreed && f.isActive;
      const isViewing = selectedFriendId === f.id;

      const badgeHtml = isSelectedBreed
        ? `<span class="absolute top-1 right-1 px-1 py-0.2 rounded-full bg-[#2d6a4f] text-[#f8f5ec] text-[8px] font-black leading-tight">대표</span>`
        : isActiveComp
          ? `<span class="absolute top-1 right-1 px-1 py-0.2 rounded-full bg-amber-600 text-white text-[8px] font-black leading-tight">동행</span>`
          : '';

      const activeStyle = isSelectedBreed || isActiveComp
        ? 'bg-emerald-600/15 border-emerald-600 ring-2 ring-emerald-500/40'
        : 'bg-[#faf6ee] shadow-sm border border-[#d2c8b4]';

      const viewRing = isViewing ? 'ring-2 ring-amber-500' : '';

      return `
        <button type="button" data-friend-select="${f.id}" data-friend-type="${f.type}" class="friend-slot-btn aspect-square rounded-xl p-1.5 flex flex-col items-center justify-between text-center relative transition active:scale-95 cursor-pointer ${activeStyle} ${viewRing}">
          <span class="absolute top-1 left-1 text-[10px] leading-none opacity-80">${isBreed ? '🐶' : '🐾'}</span>
          ${badgeHtml}
          <span class="text-2xl leading-none mt-2">${f.icon}</span>
          <div class="w-full min-w-0">
            <div class="text-[10px] font-extrabold text-[#1f2d24] truncate">${f.name.split(' ').pop()}</div>
            <div class="text-[9px] text-[#4a584e] truncate leading-tight">${isBreed ? '수호견' : f.role.split(' ')[0]}</div>
          </div>
        </button>
      `;
    }).join('');

    // 미스터리 발자국 슬롯 (🐾) 1~2줄 (4~8칸)
    const remainder = (4 - (joinedFriends.length % 4)) % 4;
    const mysteryCount = Math.min(unjoinedFriends.length, Math.max(4, remainder + 4));

    const mysterySlotsHtml = Array.from({ length: mysteryCount }, () => `
      <div class="aspect-square rounded-xl border border-dashed border-[#d2c8b4] bg-[#efe9dc]/50 flex flex-col items-center justify-center text-center select-none shadow-2xs">
        <span class="text-xl opacity-25">🐾</span>
      </div>
    `).join('');

    const friendsGridHtml = joinedSlotsHtml + mysterySlotsHtml;

    // 선택된 친구 상세 정보 카드
    const selFriend = allFriends.find((f) => f.id === selectedFriendId) || joinedFriends[0] || allFriends[0];
    let detailActionBtnHtml = '';
    if (selFriend.type === 'breed') {
      const isCur = curBreedId === selFriend.id;
      detailActionBtnHtml = isCur
        ? `<button type="button" disabled class="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-700/20 text-emerald-800 border border-emerald-600/40 cursor-default">✓ 대표 수호견</button>`
        : `<button type="button" data-breed-switch="${selFriend.id}" class="breed-switch-btn px-3 py-1.5 rounded-lg text-xs font-black bg-[#2d6a4f] hover:bg-[#245840] text-white active:scale-95 transition shadow-xs">🐶 대표 지정</button>`;
    } else {
      const isAct = activeCompIds.includes(selFriend.id);
      detailActionBtnHtml = isAct
        ? `<button type="button" data-comp-toggle="${selFriend.id}" class="comp-toggle-btn px-3 py-1.5 rounded-lg text-xs font-black bg-[#d97706] hover:bg-[#b45309] text-white active:scale-95 transition shadow-xs">휴식하기</button>`
        : `<button type="button" data-comp-toggle="${selFriend.id}" class="comp-toggle-btn px-3 py-1.5 rounded-lg text-xs font-black bg-[#2d6a4f] hover:bg-[#245840] text-white active:scale-95 transition shadow-xs">🐾 동행하기</button>`;
    }

    const friendDetailHtml = `
      <div class="p-3 rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-center text-3xl shrink-0">
            ${selFriend.icon}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-black text-[#1f2d24] truncate">${selFriend.name}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${selFriend.type === 'breed' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}">${selFriend.type === 'breed' ? '수호견' : '서포터'}</span>
            </div>
            <div class="text-[11px] font-bold text-emerald-800 truncate mt-0.5">${selFriend.trait}</div>
            <div class="text-[10px] text-[#4a584e] truncate mt-0.5">${selFriend.desc}</div>
          </div>
        </div>
        <div class="shrink-0">
          ${detailActionBtnHtml}
        </div>
      </div>
    `;

    const friendBannerHtml = `
      <div class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-emerald-600/30 text-center space-y-1">
        <div class="text-xs font-black text-[#2d6a4f] flex items-center justify-center gap-1">
          <span>🐾</span> 새로운 모험 지역에서 더 많은 동물 친구들이 합류를 기다리고 있어요!
        </div>
        <div class="text-[10px] text-[#5f6c62]">스테이지를 클리어하고 월반에 도전하여 갇혀 있는 동물 친구들을 구출하세요.</div>
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
                <span class="text-[10px] font-bold text-[#4a584e]">보유 ${COSTUMES.filter((c) => ownedSet.has(c.id) || (c.unlockStage && maxUnlocked >= c.unlockStage)).length}개</span>
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
                <h3 class="text-xs font-extrabold text-emerald-800">🐾 동물 친구</h3>
                <span class="text-[10px] font-bold text-[#4a584e]">함께하는 친구 ${totalJoinedFriends}마리</span>
              </div>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
                ${friendFilterDefs.map((f) => `
                  <button type="button" data-friend-filter="${f.key}" class="px-2.5 py-1 rounded-lg transition-all ${
                    friendFilter === f.key
                      ? 'bg-[#2d6a4f] text-[#f8f5ec] font-black shadow-xs'
                      : 'bg-[#e6dec8] text-[#4a584e] hover:text-[#1f2d24]'
                  }">
                    ${f.label}
                  </button>
                `).join('')}
              </div>
              <div class="grid grid-cols-4 gap-2">${friendsGridHtml}</div>
              ${friendDetailHtml}
              ${friendBannerHtml}
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
          const slotKey = item.slot === 'aura' ? 'acc' : item.slot;
          updateSave((s) => {
            if (!s.costumes) s.costumes = { owned: ['weapon_boomerang'], equipped: {} };
            if (!s.costumes.owned.includes(item.id)) {
              s.costumes.owned.push(item.id);
            }
            if (s.costumes.equipped[slotKey] === item.id) {
              s.costumes.equipped[slotKey] = null;
            } else {
              s.costumes.equipped[slotKey] = item.id;
            }
          });
          renderGearTab();
        });
      });
    } else {
      gearPanel.querySelectorAll('[data-friend-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-friend-filter');
          if (filter && filter !== friendFilter) {
            friendFilter = filter;
            renderGearTab();
          }
        });
      });

      gearPanel.querySelectorAll('.friend-slot-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-friend-select');
          const type = btn.getAttribute('data-friend-type');
          selectedFriendId = id;
          if (type === 'breed') {
            updateSave((s) => {
              s.selectedBreed = id;
            });
            audioEngine.playBark?.();
            onResourcesChanged?.();
          }
          renderGearTab();
        });
      });

      gearPanel.querySelectorAll('.breed-switch-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-breed-switch');
          updateSave((s) => {
            s.selectedBreed = id;
          });
          audioEngine.playBark?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });

      gearPanel.querySelectorAll('.comp-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-comp-toggle');
          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [], levels: {} };
            if (!s.companions.unlocked.includes(id)) {
              s.companions.unlocked.push(id);
            }
            const active = s.companions.active || [];
            const idx = active.indexOf(id);
            if (idx >= 0) {
              active.splice(idx, 1);
            } else {
              if (active.length >= (BALANCE.COMPANIONS?.MAX_ACTIVE || 2)) {
                active.shift();
              }
              active.push(id);
            }
            s.companions.active = active;
          });
          audioEngine.playCorrect?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });
    }
  }

  function openSupplyShopModal() {
    if (!openModal) return;
    const save = getSave();
    const today = new Date().toISOString().slice(0, 10);
    const isFree = save.lastFreeSupplyDate !== today;
    const gemCost = BALANCE.SHOP.SUPPLY_BOX_GEM_COST || 50;

    openModal(`
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-b border-[#d2c8b4] pb-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎁</span>
            <div>
              <h3 class="text-sm font-black text-emerald-800">일일 보급 상자</h3>
              <div class="text-[10px] text-[#4a584e]">매일 1회 무료 지급되는 특별 보급품</div>
            </div>
          </div>
          <button id="btn-close-supply-modal" type="button" class="w-7 h-7 rounded-full bg-[#f0ebe0] hover:bg-[#e6dec8] text-[#1f2d24] flex items-center justify-center text-xs font-black transition" title="닫기">✕</button>
        </div>

        <!-- 일일 무료 상태 배너 -->
        <div class="p-3 rounded-2xl ${isFree ? 'bg-gradient-to-r from-emerald-600/15 via-teal-600/15 to-emerald-600/10 border border-emerald-500/50' : 'bg-[#f0ebe0] border border-[#d2c8b4]'} flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl ${isFree ? 'bg-emerald-600 text-white' : 'bg-[#e6dec8] text-[#4a584e]'} flex items-center justify-center text-xl shadow-xs">
              📦
            </div>
            <div>
              <div class="text-xs font-black ${isFree ? 'text-emerald-900' : 'text-[#1f2d24]'}">
                ${isFree ? '🎉 오늘 무료 오픈 가능!' : '오늘 무료 오픈 완료'}
              </div>
              <div class="text-[10px] ${isFree ? 'text-emerald-800' : 'text-[#4a584e]'}">
                ${isFree ? '매일 0시 초기화 · 무료 보급을 받아가세요' : '보석을 사용하여 추가 오픈할 수 있습니다'}
              </div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${isFree ? 'bg-emerald-600 text-white shadow-xs animate-pulse' : 'bg-[#d2c8b4] text-[#4a584e]'}">
            ${isFree ? '무료' : `💎 ${gemCost}`}
          </span>
        </div>

        <!-- 획득 가능한 보상 목록 -->
        <div class="rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] p-3 space-y-2">
          <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1.5">
            <span>📋</span>
            <span>획득 가능한 보상 목록</span>
          </div>
          <div class="space-y-1.5 text-[11px]">
            <div class="flex items-center justify-between p-2 rounded-xl bg-[#faf6ee] border border-[#d2c8b4]">
              <div class="flex items-center gap-2">
                <span class="text-base">👔</span>
                <div>
                  <div class="font-black text-[#1f2d24]">희귀 강아지 코스튬</div>
                  <div class="text-[10px] text-[#4a584e]">일반~전설 코스튬 (중복 시 뼈다귀 변환)</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">35%</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-[#faf6ee] border border-[#d2c8b4]">
              <div class="flex items-center gap-2">
                <span class="text-base">🦴</span>
                <div>
                  <div class="font-black text-[#1f2d24]">장비 강화 조각</div>
                  <div class="text-[10px] text-[#4a584e]">뼈다귀 +2~3개 (동료 해금 & 승급전)</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">35%</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-xl bg-[#faf6ee] border border-[#d2c8b4]">
              <div class="flex items-center gap-2">
                <span class="text-base">🪙</span>
                <div>
                  <div class="font-black text-[#1f2d24]">훈련용 금화</div>
                  <div class="text-[10px] text-[#4a584e]">금화 +60~100개 (스탯 기초 훈련)</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-black">30%</span>
            </div>
          </div>
        </div>

        <!-- 오픈 액션 버튼 -->
        <button id="btn-open-supply-box" type="button" class="w-full py-3 rounded-2xl ${
          isFree
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md'
            : 'bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 text-white shadow-md'
        } font-black text-sm active:scale-95 transition flex items-center justify-center gap-1.5">
          <span>${isFree ? '🎁 오늘 무료 오픈!' : `💎 ${gemCost} 보석으로 오픈`}</span>
        </button>
      </div>
    `);

    document.getElementById('btn-close-supply-modal')?.addEventListener('click', () => closeModal?.());

    document.getElementById('btn-open-supply-box')?.addEventListener('click', () => {
      const cur = getSave();
      const freeNow = cur.lastFreeSupplyDate !== today;
      const curGems = cur.gems ?? 300;

      if (!freeNow && curGems < gemCost) {
        openModal(`
          <div class="text-center space-y-3">
            <div class="text-3xl">💎</div>
            <h3 class="text-sm font-black text-rose-600">보석이 부족합니다</h3>
            <p class="text-xs text-[#4a584e]">추가 오픈에 필요한 보석 ${gemCost - curGems}개가 부족해요.<br/>내일 무료 오픈을 기다리거나 상점에서 충전해 주세요.</p>
            <button id="btn-supply-gem-fail" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">확인</button>
          </div>
        `);
        document.getElementById('btn-supply-gem-fail')?.addEventListener('click', () => closeModal?.());
        return;
      }

      rollSupplyBox({ isFree: freeNow, gemCost });
    });
  }

  function renderTrainingTab() {
    const save = getSave();
    const dogName = save.dogName || '우유';
    const training = save.training || {};
    const stats = computePlayerStats(save);
    const totalTrainLv = Object.values(training).reduce((sum, v) => sum + (Number(v) || 0), 0);

    const isLevelUp = !!statBoostFlash.isLevelUp;

    function renderStatBox(s) {
      const isFlashed = statBoostFlash.key === s.key;
      return `
        <div class="relative w-full max-w-[68px] aspect-square rounded-2xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col items-center justify-center text-center p-1 shadow-2xs transition-all ${
          isFlashed ? 'ring-2 ring-emerald-600 bg-emerald-500/20' : ''
        }">
          <span class="text-base leading-none">${s.icon}</span>
          <span class="text-[10px] text-[#4a584e] font-bold mt-1 leading-none whitespace-nowrap">${s.label}</span>
          <span class="text-xs font-black text-[#1f2d24] mt-1 leading-none whitespace-nowrap">${s.val}</span>
          ${isFlashed ? '<span class="absolute top-1 right-1.5 text-emerald-700 font-black text-[9px] animate-pulse">▲</span>' : ''}
        </div>
      `;
    }

    const statSummaryHtml = `
      <div class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <!-- 상단 헤더: 가운데 정렬 -->
        <div class="flex flex-wrap items-center justify-center gap-2 pb-2 mb-2.5 border-b border-[#e6dec8] text-center">
          <span class="text-xs font-black text-[#1f2d24]">${dogName} 실시간 상태</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">총 훈련 Lv.${totalTrainLv}</span>
          <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 border border-amber-600/35 text-[10px] font-black">⚡ 전투력 ${stats.combatPower.toLocaleString()}</span>
        </div>

        <!-- 3단 좌우 대칭 그리드: 좌(공격력/이속) · 중(강아지 아바타 프리뷰) · 우(체력/흡수반경) -->
        <div class="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2">
          <!-- 좌측 열: 공격력, 이동속도 -->
          <div class="flex flex-col items-center gap-2 w-full">
            ${renderStatBox({ key: 'atkLevel', label: '공격력', icon: '⚔️', val: Math.round(stats.atk) })}
            ${renderStatBox({ key: 'speedLv', label: '이동속도', icon: '👟', val: Math.round(stats.speed) })}
          </div>

          <!-- 중앙 열: 캐릭터 캔버스 및 레벨업 이펙트 -->
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

          <!-- 우측 열: 체력, 흡수반경 -->
          <div class="flex flex-col items-center gap-2 w-full">
            ${renderStatBox({ key: 'hpLevel', label: '체력', icon: '❤️', val: Math.round(stats.maxHp) })}
            ${renderStatBox({ key: 'magnetLv', label: '흡수반경', icon: '🧲', val: Math.round(stats.pickupRadius) })}
          </div>
        </div>
      </div>
    `;

    const subTabHtml = `
      <div class="flex items-center p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold gap-1">
        <button type="button" data-train-subtab="hero" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          trainingSubTab === 'hero' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          💪 ${dogName} 기초 훈련
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

    const unlockedComps = COMPANIONS.filter((c) => isCompanionUnlocked(c.id, save) || (save.companions?.unlocked || []).includes(c.id));

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

    const canvas = document.getElementById('training-hero-canvas');
    if (canvas) {
      const curBreedId = save.selectedBreed || 'pomeranian';
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2 + 4);
      const evo = getEvolutionStage(save);
      drawDogCharacter(ctx, {
        breedId: curBreedId,
        scale: 1.25,
        bodyY: 0,
        lookX: 0,
        isBipedal: evo.stage >= 2,
      });
      if (save.equippedSkin) {
        drawDogSkin(ctx, save.equippedSkin, 1.25, 0);
      }
      ctx.restore();
    }
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
        audioEngine.playLevelUp();
        if (statBoostFlash.timer) clearTimeout(statBoostFlash.timer);
        statBoostFlash.key = key;
        statBoostFlash.isLevelUp = true;
        statBoostFlash.timer = setTimeout(() => {
          statBoostFlash.key = null;
          statBoostFlash.isLevelUp = false;
          statBoostFlash.timer = null;
          renderTrainingTab();
        }, 1000);
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

