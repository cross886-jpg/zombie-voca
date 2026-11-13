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
import { getSave, updateSave, getAffection, addAffection, MAX_SUPPORTERS } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats } from '../entities/player.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';

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
  let gearSubTab = 'companion'; // 'companion' | 'costume'
  let inventoryFilter = 'all'; // 'all' | 'weapon' | 'hat' | 'top' | 'acc'

  function renderGearTab() {
    const save = getSave();
    const dogName = save.dogName || '우유';
    const stats = computePlayerStats(save);
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const ownedSet = new Set(save.costumes?.owned || []);
    const equipped = save.costumes?.equipped || {};
    const collectionBonus = getCostumeCollectionBonus(save.costumes?.owned || [], maxUnlocked);
    const activeCompIds = (save.companions?.active || []).slice(0, MAX_SUPPORTERS);
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
              <canvas id="gear-showcase-hero-canvas" width="128" height="128" class="w-16 h-16 rounded-full bg-[#f0ebe0] border border-emerald-600/40 shadow-[0_0_16px_rgba(45,106,79,0.2)] block"></canvas>
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

    // 3. 수호견 & 동행 서포터 편성
    const curBreedId = save.selectedBreed || 'pomeranian';
    const mainAff = getAffection(curBreedId, save);
    const curBreedObj = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];

    // 서포터 슬롯 렌더링 (좌측 1, 우측 2)
    const renderSupportSlot = (idx) => {
      const compId = activeCompIds[idx];
      const comp = compId ? COMPANIONS.find((c) => c.id === compId) : null;
      if (comp) {
        return `
          <div class="relative w-full p-2 rounded-xl bg-[#faf6ee] border border-amber-500/50 flex flex-col items-center justify-center text-center shadow-xs">
            <button type="button" data-comp-toggle="${comp.id}" class="comp-toggle-btn absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold" title="휴식하기">✕</button>
            <span class="text-2xl leading-none">${comp.icon}</span>
            <span class="text-[10px] font-black text-[#1f2d24] truncate max-w-full mt-0.5">${comp.name.split(' ').pop()}</span>
            <span class="text-[8px] font-bold text-amber-700">서포터 ${idx + 1}</span>
            <div class="text-[8px] font-extrabold text-emerald-800 truncate max-w-full mt-0.5 leading-tight" title="${comp.buffText || comp.role || ''}">
              ${comp.buffText || comp.role || ''}
            </div>
          </div>
        `;
      }
      return `
        <div class="w-full p-2 rounded-xl bg-[#efe9dc]/70 border border-dashed border-[#d2c8b4] flex flex-col items-center justify-center text-center text-[#a3b899]">
          <span class="text-xl leading-none opacity-50">🐾</span>
          <span class="text-[9px] font-bold mt-0.5">+ 서포터 ${idx + 1}</span>
          <span class="text-[8px] text-[#a3b899] mt-0.5">미편성</span>
        </div>
      `;
    };

    // 쇼케이스: 중앙 메인 무대(오직 주인공 강아지) + 좌/우 서포터 슬롯
    const formationHtml = `
      <div class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] space-y-2.5 mb-3">
        <div class="flex items-center justify-between pb-1.5 border-b border-[#e6dec8]">
          <div>
            <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1.5">
              <span>🐾</span> 내 강아지 &amp; 서포터 동행
            </div>
            <div class="text-[10px] text-[#5f6c62]">주인공 1마리 + 서포터 최대 ${MAX_SUPPORTERS}마리 동행 편성</div>
          </div>
          <button id="btn-open-breed-book" type="button" class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs shadow-xs active:scale-95 transition flex items-center gap-1 cursor-pointer">
            <span>📖</span> 전체 도감
          </button>
        </div>

        <div class="grid grid-cols-[1fr_2.2fr_1fr] gap-2 items-start">
          <!-- 중앙 상단: 현재 장착된 주인공 수호견 캔버스 -->
          <div class="col-start-2 row-start-1 flex justify-center">
            <canvas id="gear-formation-hero-canvas" width="240" height="150" class="w-40 h-24 rounded-2xl bg-[#f0ebe0] border border-emerald-600/40 shadow-[0_0_18px_rgba(45,106,79,0.2)] block"></canvas>
          </div>

          <!-- 좌측 하단: 서포터 1 슬롯 -->
          <div class="col-start-1 row-start-2 flex">${renderSupportSlot(0)}</div>

          <!-- 중앙 하단: 주인공 강아지 정보 (불필요한 버튼 없이 깔끔하게 표시) -->
          <div class="col-start-2 row-start-2 text-center min-w-0 space-y-1 px-1">
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <span class="text-xs font-black text-[#1f2d24] truncate">${curBreedObj.name}</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800">대표 수호견</span>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">${mainAff.hearts} Lv.${mainAff.level}</span>
            </div>
            <div class="text-[11px] font-bold text-emerald-800 leading-tight">${curBreedObj.trait || ''}</div>
            <div class="text-[10px] text-[#4a584e] leading-tight">${curBreedObj.desc || ''}</div>
          </div>

          <!-- 우측 하단: 서포터 2 슬롯 -->
          <div class="col-start-3 row-start-2 flex">${renderSupportSlot(1)}</div>
        </div>
      </div>
    `;

    // 3-2. 내 수호견 (주인공 강아지) 전용 그리드
    const unlockedBreedsCount = BREEDS.filter((b) => isBreedUnlocked(b.id, save)).length;
    const breedsGridHtml = BREEDS.map((b) => {
      const isUnlocked = isBreedUnlocked(b.id, save);
      const isCurrent = curBreedId === b.id;
      const aff = getAffection(b.id, save);

      if (isUnlocked) {
        const activeStyle = isCurrent
          ? 'bg-emerald-600/15 border-emerald-600 ring-2 ring-emerald-500/40 shadow-[0_0_10px_rgba(45,106,79,0.25)]'
          : 'bg-[#faf6ee] shadow-sm border border-[#d2c8b4] hover:border-emerald-600/50';

        return `
          <button type="button" data-breed-switch="${b.id}" class="breed-switch-btn aspect-square rounded-xl p-1.5 flex flex-col items-center justify-between text-center relative transition active:scale-95 cursor-pointer ${activeStyle}">
            <span class="absolute top-1 left-1 text-[9px] leading-none opacity-80">🐶</span>
            ${isCurrent ? '<span class="absolute top-1 right-1 px-1 py-0.2 rounded-full bg-[#2d6a4f] text-[#f8f5ec] text-[8px] font-black leading-tight">대표</span>' : ''}
            <span class="text-2xl leading-none mt-2">${b.icon}</span>
            <div class="w-full min-w-0">
              <div class="text-[10px] font-extrabold text-[#1f2d24] truncate">${b.name.split(' ').pop()}</div>
              <div class="text-[8px] text-rose-600 truncate font-bold">${aff.hearts} Lv.${aff.level}</div>
            </div>
          </button>
        `;
      }

      return `
        <button type="button" class="btn-open-breed-book-lock aspect-square rounded-xl border border-dashed border-[#d2c8b4] bg-[#efe9dc]/50 flex flex-col items-center justify-center text-center p-1 relative active:scale-95 transition cursor-pointer" title="${b.name} (도감에서 보석 입양)">
          <span class="text-xl opacity-30">${b.icon}</span>
          <span class="text-[9px] font-bold text-[#8c9c8e] mt-1 truncate max-w-full">${b.name.split(' ').pop()}</span>
          <span class="text-[8px] text-amber-700 font-extrabold mt-0.5">🔒 💎${b.gemCost || 80}</span>
        </button>
      `;
    }).join('');

    // 3-3. 서포터 동료 전용 그리드
    const unlockedCompsCount = COMPANIONS.filter((c) => isCompanionUnlocked(c.id, save) || (save.companions?.unlocked || []).includes(c.id)).length;
    const compsGridHtml = COMPANIONS.map((c) => {
      const isUnlocked = isCompanionUnlocked(c.id, save) || (save.companions?.unlocked || []).includes(c.id);
      const isActive = activeCompIds.includes(c.id);

      if (isUnlocked) {
        const activeStyle = isActive
          ? 'bg-amber-500/15 border-amber-600 ring-2 ring-amber-500/40 shadow-[0_0_10px_rgba(217,119,6,0.25)]'
          : 'bg-[#faf6ee] shadow-sm border border-[#d2c8b4] hover:border-amber-600/50';

        return `
          <button type="button" data-comp-toggle="${c.id}" class="comp-toggle-btn aspect-square rounded-xl p-1.5 flex flex-col items-center justify-between text-center relative transition active:scale-95 cursor-pointer ${activeStyle}">
            <span class="absolute top-1 left-1 text-[9px] leading-none opacity-80">🐾</span>
            ${isActive ? '<span class="absolute top-1 right-1 px-1 py-0.2 rounded-full bg-amber-600 text-white text-[8px] font-black leading-tight">동행</span>' : ''}
            <span class="text-2xl leading-none mt-2">${c.icon}</span>
            <div class="w-full min-w-0">
              <div class="text-[10px] font-extrabold text-[#1f2d24] truncate">${c.name.split(' ').pop()}</div>
              <div class="text-[8px] text-emerald-800 truncate font-extrabold leading-tight">${c.buffText || c.role || ''}</div>
            </div>
          </button>
        `;
      }

      return `
        <div class="aspect-square rounded-xl border border-dashed border-[#d2c8b4] bg-[#efe9dc]/50 flex flex-col items-center justify-center text-center p-1 select-none">
          <span class="text-xl opacity-25">${c.icon}</span>
          <span class="text-[9px] font-bold text-[#8c9c8e] mt-1 truncate max-w-full">${c.name.split(' ').pop()}</span>
          <span class="text-[8px] text-[#a3b899] font-bold mt-0.5">🔒 Stage ${c.unlockStage || 1}</span>
        </div>
      `;
    }).join('');

    // 4. 서브 탭 분리 HTML 구조
    const subTabHtml = `
      <div class="flex items-center p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold gap-1">
        <button type="button" data-gear-subtab="companion" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          gearSubTab === 'companion' ? 'bg-[#faf6ee] text-emerald-800 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🐾 내 강아지 & 서포터
        </button>
        <button type="button" data-gear-subtab="costume" class="flex-1 py-1.5 rounded-lg text-center transition-all ${
          gearSubTab === 'costume' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🎒 장비·코스튬
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
            <div class="space-y-3">
              ${formationHtml}

              <!-- 1. 수호견 (주인공 강아지) 전용 구역 -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-extrabold text-emerald-800 flex items-center gap-1">
                    <span>🐕</span> 내 수호견 (주인공 강아지)
                  </h3>
                  <span class="text-[10px] font-bold text-[#4a584e]">보유 ${unlockedBreedsCount}/${BREEDS.length}마리</span>
                </div>
                <div class="grid grid-cols-4 gap-2">${breedsGridHtml}</div>
              </div>

              <!-- 2. 서포터 동료 전용 구역 -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-extrabold text-amber-800 flex items-center gap-1">
                    <span>🦉</span> 서포터 동료 (동행 ${activeCompIds.length}/${MAX_SUPPORTERS})
                  </h3>
                  <span class="text-[10px] font-bold text-[#4a584e]">보유 ${unlockedCompsCount}/${COMPANIONS.length}마리</span>
                </div>
                <div class="grid grid-cols-4 gap-2">${compsGridHtml}</div>
              </div>
            </div>
          `
      }
    `;

    // 캔버스 아바타 렌더링 (견종 비주얼 + 장착 스킨/무기)
    renderDogToCanvas(document.getElementById('gear-showcase-hero-canvas'), {
      save,
      breedId: curBreedId,
      scale: 1.0,
      ratio: 2,
    });
    // 중앙 쇼케이스 캔버스는 항상 현재 선택된 대표 주인공 수호견만 렌더링
    renderDogToCanvas(document.getElementById('gear-formation-hero-canvas'), {
      save,
      breedId: curBreedId,
      scale: 1.45,
      ratio: 1.5,
      withEquipment: true,
    });

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
      document.getElementById('btn-open-breed-book')?.addEventListener('click', () => {
        openBreedBookModal();
      });

      gearPanel.querySelectorAll('.btn-open-breed-book-lock').forEach((btn) => {
        btn.addEventListener('click', () => {
          openBreedBookModal();
        });
      });

      // 하단 수호견 카드 클릭 시 별도 확인 버튼 없이 즉시 대표 주인공으로 교체
      gearPanel.querySelectorAll('.breed-switch-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-breed-switch');
          if (!id || id === save.selectedBreed) return;
          updateSave((s) => {
            s.selectedBreed = id;
          });
          audioEngine.playBark?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });

      // 서포터 목록 또는 서포터 슬롯 클릭 시 즉시 장착/해제 토글
      gearPanel.querySelectorAll('.comp-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-comp-toggle');
          if (!id) return;
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
              if (active.length >= MAX_SUPPORTERS) {
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

  function openBreedBookModal() {
    if (!openModal) return;
    const save = getSave();

    const breedsHtml = BREEDS.map((b) => {
      const isUnlocked = isBreedUnlocked(b.id, save);
      const isCurrent = (save.selectedBreed || 'pomeranian') === b.id;
      const aff = getAffection(b.id, save);
      const cost = b.gemCost || 80;

      let actionHtml = '';
      if (isCurrent) {
        actionHtml = `<span class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-800 text-xs font-black border border-emerald-600/40">✓ 현재 대표견</span>`;
      } else if (isUnlocked) {
        actionHtml = `<button type="button" data-book-switch="${b.id}" class="book-switch-btn px-2.5 py-1 rounded-lg bg-[#2d6a4f] hover:bg-[#245840] text-white text-xs font-black active:scale-95 transition shadow-xs">🐶 대표 지정</button>`;
      } else {
        actionHtml = `<button type="button" data-book-adopt="${b.id}" data-book-cost="${cost}" class="book-adopt-btn px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black active:scale-95 transition shadow-xs flex items-center gap-1">💎 ${cost} 보석 입양</button>`;
      }

      return `
        <div class="p-3 rounded-xl ${isUnlocked ? 'bg-[#faf6ee] border-[#d2c8b4]' : 'bg-[#efe9dc]/60 border-[#d2c8b4]/60'} border flex items-center justify-between gap-2.5 shadow-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-12 h-12 rounded-xl ${isUnlocked ? 'bg-[#f0ebe0] border-[#d2c8b4]' : 'bg-[#e6dec8] border-dashed border-[#b8ab94] opacity-60'} border flex items-center justify-center text-3xl shrink-0">
              ${b.icon}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-[#1f2d24] truncate">${b.name}</span>
                <span class="text-[10px] text-[#5f6c62] truncate">(${b.subName})</span>
                ${isUnlocked ? `<span class="px-1.5 py-0.2 rounded text-[8px] font-bold bg-rose-100 text-rose-800">${aff.hearts} Lv.${aff.level}</span>` : `<span class="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-200 text-slate-700">미입양</span>`}
              </div>
              <div class="text-[11px] font-bold text-emerald-800 truncate mt-0.5">${b.trait}</div>
              <div class="text-[10px] text-[#4a584e] truncate mt-0.5">${b.desc}</div>
            </div>
          </div>
          <div class="shrink-0">
            ${actionHtml}
          </div>
        </div>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3.5">
        <div class="flex items-center justify-between border-b border-[#d2c8b4] pb-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">📖</span>
            <div>
              <h3 class="text-sm font-black text-[#1f2d24]">수호견 전체 도감 (12종)</h3>
              <div class="text-[10px] text-[#4a584e]">보석으로 입양 시 초기 친밀도 보너스(Lv.2 💖) 즉시 부여!</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-black text-amber-700">💎 ${save.gems || 0}</span>
            <button id="btn-close-breed-book" type="button" class="w-7 h-7 rounded-full bg-[#efe9dc] hover:bg-[#e6dec8] text-[#1f2d24] text-xs font-bold flex items-center justify-center">✕</button>
          </div>
        </div>

        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          ${breedsHtml}
        </div>
      </div>
    `);

    document.getElementById('btn-close-breed-book')?.addEventListener('click', () => {
      closeModal();
    });

    document.querySelectorAll('.book-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-book-switch');
        updateSave((s) => {
          s.selectedBreed = id;
        });
        audioEngine.playBark?.();
        onResourcesChanged?.();
        closeModal();
        renderGearTab();
      });
    });

    document.querySelectorAll('.book-adopt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-book-adopt');
        const cost = parseInt(btn.getAttribute('data-book-cost'), 10) || 80;
        const curSave = getSave();

        if ((curSave.gems || 0) < cost) {
          audioEngine.playWrong?.();
          alert(`💎 보석이 부족합니다! (필요: ${cost}개 / 보유: ${curSave.gems || 0}개)`);
          return;
        }

        updateSave((s) => {
          s.gems = Math.max(0, (s.gems || 0) - cost);
          if (!s.unlockedBreeds) s.unlockedBreeds = ['pomeranian'];
          if (!s.unlockedBreeds.includes(id)) {
            s.unlockedBreeds.push(id);
          }
        });
        addAffection(id, 50); // 초기 친밀도 보너스 부여
        audioEngine.playPowerUp?.();
        onResourcesChanged?.();
        openBreedBookModal();
        renderGearTab();
      });
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

    renderDogToCanvas(document.getElementById('training-hero-canvas'), {
      save,
      breedId: save.selectedBreed || 'pomeranian',
      scale: 1.25,
      offsetY: 4,
      withEquipment: true,
      withWeapon: false,
    });
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
  };
}

