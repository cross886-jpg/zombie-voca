/**
 * js/ui/growthUI.js
 * 하단 [🐾 우리 팀] 탭(수호견 / 파트너 / 브레멘 동행 3단 중앙 쇼케이스 및 인벤토리) 전담 UI 모듈
 * (훈련소 탭은 js/ui/trainingUI.js 모듈에 위임)
 */

import {
  OWNER_WEAPONS,
} from '../config/balance.js';
import {
  BREEDS,
  COMPANIONS,
  DOG_GEAR,
  getCostumeCollectionBonus,
  isBreedUnlocked,
} from '../data/catalog.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';
import { drawOwnerCharacter } from '../render/ownerRenderer.js';
import { getChapterInfo } from '../data/chapters.js';
import { createTrainingUI } from './trainingUI.js';
import settingsStore from '../settingsStore.js';

export function createGrowthUI({ onResourcesChanged } = {}) {
  const gearPanel = document.getElementById('tab-panel-gear');
  const trainingPanel = document.getElementById('tab-panel-training');
  const { renderTrainingTab } = createTrainingUI({ trainingPanel, onResourcesChanged });
  let teamSubTab = 'dog'; // 'dog' | 'owner' | 'companion'
  let inventoryFilter = 'all'; // 'all' | 'harness' | 'vest' | 'boots' | 'scarf'

  function renderGearTab() {
    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const dogName = profile.dogName || save.dogName || '우유';
    const ownerName = profile.ownerName || save.ownerName || '민우';
    const maxUnlocked = save.maxUnlockedUnit || 1;
    const ownedSet = new Set(save.costumes?.owned || ['basic_harness']);
    const equipped = save.costumes?.equipped || {};
    const collectionBonus = getCostumeCollectionBonus(save.costumes?.owned || ['basic_harness'], maxUnlocked);

    // 주인 상태 정보
    if (!profile.ownerState) {
      profile.ownerState = {
        recoveryStage: 1,
        cureProgress: 0,
        gear: { backpack: 1, shoes: 1, outfit: 1, weapon: 1 },
        materials: { cloth: 0, bandage: 0, parts: 0, herb: 0 },
      };
    }
    const ownerState = profile.ownerState;
    if (!ownerState.gear) ownerState.gear = { backpack: 1, shoes: 1, outfit: 1, weapon: 1 };
    if (!ownerState.materials) ownerState.materials = { cloth: 0, bandage: 0, parts: 0, herb: 0 };
    const gear = ownerState.gear;
    const materials = ownerState.materials;

    if (!Array.isArray(profile.unlockedOwnerWeapons)) profile.unlockedOwnerWeapons = ['stone'];
    const unlockedWeapons = profile.unlockedOwnerWeapons;
    const equippedWeaponId = profile.equippedOwnerWeapon || save.equippedOwnerWeapon || 'stone';
    const equippedWeaponDef = OWNER_WEAPONS[equippedWeaponId] || OWNER_WEAPONS.stone;

    if (!profile.companions) {
      profile.companions = { unlocked: [], activeGround: null, activeRider: null, levels: {} };
    }
    const compData = profile.companions;
    const activeGroundId = compData.activeGround || (save.companions?.active?.[0]) || null;
    const activeRiderId = compData.activeRider || (save.companions?.active?.[1]) || null;
    const groundComp = COMPANIONS.find((c) => c.id === activeGroundId);
    const riderComp = COMPANIONS.find((c) => c.id === activeRiderId);
    const dogBreedDef = BREEDS.find((b) => b.id === (save.selectedBreed || 'pomeranian')) || BREEDS[0];

    const curStage = Number(profile.stage) || 1;
    const chInfo = getChapterInfo(curStage);

    // 상단 3단 서브탭 바 (수호견 vs 파트너 vs 브레멘 동행)
    const subtabsHtml = `
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-2xl text-xs font-black mb-3 select-none">
        <button id="team-subtab-dog" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'dog' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🐕</span>
          <span class="truncate">수호견 ${dogName}</span>
        </button>
        <button id="team-subtab-owner" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'owner' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🩹</span>
          <span class="truncate">파트너 ${ownerName}</span>
        </button>
        <button id="team-subtab-companion" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'companion' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🎺</span>
          <span class="truncate">브레멘 동행</span>
        </button>
      </div>
    `;

    if (teamSubTab === 'dog') {
      // ==========================================
      // [서브탭 1: 반려견 — 중앙 쇼케이스 & 4열 장비 그리드]
      // ==========================================
      const curHarness = DOG_GEAR.find((g) => g.id === equipped.harness) || DOG_GEAR.find((g) => g.id === 'basic_harness');
      const curVest = DOG_GEAR.find((g) => g.id === equipped.vest) || null;
      const curBoots = DOG_GEAR.find((g) => g.id === equipped.boots) || null;
      const curScarf = DOG_GEAR.find((g) => g.id === equipped.scarf) || null;

      const totalEquippedAtk = (curHarness?.atkBonus || 0) + (curVest?.atkBonus || 0) + (curBoots?.atkBonus || 0) + (curScarf?.atkBonus || 0);
      const totalEquippedHp = (curHarness?.hpBonus || 0) + (curVest?.hpBonus || 0) + (curBoots?.hpBonus || 0) + (curScarf?.hpBonus || 0);

      // 1. 강아지 대칭 중앙 쇼케이스 박스 (중앙 주인공 확대 & 양옆 컴팩트 슬롯)
      const showcaseHtml = `
        <div id="gear-showcase-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🐾</span>
              <span>${dogName} 장비 쇼케이스</span>
            </span>
            <span class="text-[10px] font-bold text-amber-800">4대 부위 장착</span>
          </div>

          <!-- 12컬럼 비대칭 그리드: 좌(col-span-3) - 중앙 주인공(col-span-6) - 우(col-span-3) -->
          <div class="grid grid-cols-12 items-center gap-1.5 sm:gap-2">
            <!-- 좌측 2슬롯 (하네스, 조끼) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border ${curHarness ? 'border-emerald-600/50 bg-emerald-50/60 ring-1 ring-emerald-500/30' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🦺</span>
                  <span class="truncate">하네스</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">${curHarness ? curHarness.name : '미착용'}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold">${curHarness ? `+${curHarness.atkBonus}A +${curHarness.hpBonus}H` : '-'}</div>
              </div>

              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border ${curVest ? 'border-emerald-600/50 bg-emerald-50/60 ring-1 ring-emerald-500/30' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🛡️</span>
                  <span class="truncate">조끼</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">${curVest ? curVest.name : '미착용'}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold">${curVest ? `+${curVest.atkBonus}A +${curVest.hpBonus}H` : '-'}</div>
              </div>
            </div>

            <!-- 중앙 캐릭터 대형 프리뷰 캔버스 (col-span-6) -->
            <div class="col-span-6 flex flex-col items-center justify-center">
              <div class="relative w-full max-w-[160px] aspect-square rounded-2xl bg-gradient-to-b from-emerald-100/70 to-emerald-50/30 border-2 border-emerald-600/40 shadow-sm flex items-center justify-center p-1 shrink-0 mx-auto">
                <canvas id="gear-showcase-hero-canvas" width="160" height="160" class="w-[145px] h-[145px] sm:w-[155px] sm:h-[155px] block"></canvas>
              </div>
            </div>

            <!-- 우측 2슬롯 (부츠, 스카프) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border ${curBoots ? 'border-emerald-600/50 bg-emerald-50/60 ring-1 ring-emerald-500/30' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🥾</span>
                  <span class="truncate">부츠</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">${curBoots ? curBoots.name : '미착용'}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold">${curBoots ? `+${curBoots.atkBonus}A +${curBoots.hpBonus}H` : '-'}</div>
              </div>

              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border ${curScarf ? 'border-emerald-600/50 bg-emerald-50/60 ring-1 ring-emerald-500/30' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🧣</span>
                  <span class="truncate">스카프</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">${curScarf ? curScarf.name : '미착용'}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold">${curScarf ? `+${curScarf.atkBonus}A +${curScarf.hpBonus}H` : '-'}</div>
              </div>
            </div>
          </div>

          <!-- 하단 장비 합산 및 도감 누적 보너스 -->
          <div class="mt-2.5 pt-2 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
            <span class="text-[#4a584e]">착용 합산: <b class="text-emerald-800">⚔️ +${totalEquippedAtk} · ❤️ +${totalEquippedHp}</b></span>
            <span class="text-amber-800">도감 누적: ⚔️ +${collectionBonus.atkBonus} · ❤️ +${collectionBonus.hpBonus}</span>
          </div>
        </div>
      `;

      // 2. 장비 인벤토리 필터 & 4열 정사각형 그리드
      const slotKoMap = { harness: '하네스', vest: '조끼', boots: '부츠', scarf: '스카프' };
      const filterCategories = [
        { id: 'all', label: '전체' },
        { id: 'harness', label: '하네스' },
        { id: 'vest', label: '조끼' },
        { id: 'boots', label: '부츠' },
        { id: 'scarf', label: '스카프' },
      ];

      const filterHtml = `
        <div class="flex items-center gap-1 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-[11px] font-black mb-2 overflow-x-auto">
          ${filterCategories.map((f) => `
            <button type="button" data-inventory-filter="${f.id}" class="flex-1 py-1 px-2 rounded-lg transition active:scale-95 cursor-pointer whitespace-nowrap text-center ${inventoryFilter === f.id ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              ${f.label}
            </button>
          `).join('')}
        </div>
      `;

      const filteredGear = inventoryFilter === 'all'
        ? DOG_GEAR
        : DOG_GEAR.filter((g) => g.slot === inventoryFilter);

      const gearItemsHtml = filteredGear.map((item) => {
        const isEquipped = equipped[item.slot] === item.id;
        const isOwned = ownedSet.has(item.id) || (item.unlockStage && maxUnlocked >= item.unlockStage);
        const rarityBorder = item.rarity === 'legend'
          ? 'border-amber-400 ring-1 ring-amber-300/40'
          : item.rarity === 'epic'
          ? 'border-purple-400'
          : item.rarity === 'rare'
          ? 'border-sky-400'
          : item.rarity === 'uncommon'
          ? 'border-emerald-500/80'
          : 'border-emerald-600/50';

        return `
          <div class="p-2 rounded-xl border flex flex-col justify-between text-center relative transition min-h-[114px] ${
            isEquipped
              ? 'bg-emerald-50/95 border-emerald-600 ring-2 ring-emerald-500/40 shadow-sm'
              : isOwned
              ? 'bg-[#faf6ee] ' + rarityBorder + ' hover:border-emerald-500'
              : 'bg-stone-100 border-stone-300 opacity-60'
          }">
            <div class="flex items-center justify-between text-[8px] font-bold">
              <span class="text-[#5c6e60] uppercase">${slotKoMap[item.slot] || item.slot}</span>
              ${isEquipped ? '<span class="px-1 py-0.2 rounded-full bg-[#2d6a4f] text-white font-black text-[7.5px]">착용</span>' : ''}
            </div>
            <div class="text-2xl my-0.5 ${isOwned ? '' : 'filter brightness-0 opacity-20 select-none'}">${isOwned ? item.icon : '🔒'}</div>
            <div class="text-[10px] font-black ${isOwned ? 'text-[#1f2d24]' : 'text-stone-400'} truncate">${isOwned ? item.name : '???'}</div>
            <div class="text-[8.5px] ${isOwned ? 'text-emerald-800 font-bold' : 'text-stone-400 font-semibold'} mt-0.5 leading-tight">
              ${isOwned ? `+${item.atkBonus}A +${item.hpBonus}H` : '🔒 미보유'}
            </div>
            ${isOwned ? `
              <button type="button" data-costume-equip="${item.id}" class="costume-equip-btn mt-1 py-1 px-1 rounded-lg ${isEquipped ? 'bg-stone-200 text-[#4a584e] hover:bg-stone-300' : 'bg-[#2d6a4f] text-white hover:bg-[#245840]'} text-[9px] font-black active:scale-95 transition cursor-pointer">
                ${isEquipped ? '벗기' : '착용'}
              </button>
            ` : `
              <div class="mt-1 py-0.5 px-0.5 rounded-lg bg-stone-200 text-stone-500 text-[8px] font-bold truncate">St.${item.unlockStage || 1} 해금</div>
            `}
          </div>
        `;
      }).join('');

      // 3. 대표 수호견 품종 선택 (미해금 잠금 처리)
      const breedsHtml = BREEDS.map((b) => {
        const isCurrent = (save.selectedBreed || 'pomeranian') === b.id;
        const isUnlocked = isBreedUnlocked(b.id, save);
        return `
          <button
            type="button"
            data-breed-switch="${b.id}"
            ${isUnlocked ? '' : 'disabled data-locked="true"'}
            class="breed-switch-btn p-2 rounded-xl border flex flex-col items-center justify-center text-center transition ${
              isCurrent
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs active:scale-95 cursor-pointer'
                : isUnlocked
                ? 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f0ebe0] active:scale-95 cursor-pointer'
                : 'bg-stone-100 border-stone-300 opacity-50 cursor-not-allowed pointer-events-none'
            }"
            title="${isUnlocked ? b.name : `STAGE ${b.unlockStage || 1} 구조 후 해금`}"
          >
            <span class="text-2xl ${isUnlocked ? '' : 'filter brightness-0 opacity-20 select-none'}">${isUnlocked ? (b.icon || '🐕') : '🐕'}</span>
            <span class="text-xs font-black ${isUnlocked ? 'text-[#1f2d24]' : 'text-stone-400'} mt-1 truncate w-full">${isUnlocked ? b.name : '???'}</span>
            ${
              isCurrent
                ? '<span class="text-[9px] font-black text-emerald-800 mt-0.5">대표견 ✓</span>'
                : isUnlocked
                ? '<span class="text-[9px] text-[#5c6e60] mt-0.5">선택</span>'
                : `<span class="text-[8px] text-stone-500 mt-0.5 leading-tight">🔒 St.${b.unlockStage || 1} 해금</span>`
            }
          </button>
        `;
      }).join('');

      gearPanel.innerHTML = `
        ${subtabsHtml}
        ${showcaseHtml}

        <!-- 2. 장비 라인업 4열 그리드 -->
        <div class="p-3 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] mb-3 space-y-2">
          <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
            <span class="flex items-center gap-1"><span>🦺</span><span>수호견 장비 인벤토리</span></span>
            <span class="text-[10px] text-[#5c6e60]">터치하여 즉시 착용</span>
          </div>
          ${filterHtml}
          <div class="grid grid-cols-4 gap-1.5 max-h-[290px] overflow-y-auto pr-0.5">
            ${gearItemsHtml}
          </div>
        </div>

        <!-- 3. 대표 견종 교체 -->
        <div class="p-3 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] space-y-2">
          <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
            <span class="flex items-center gap-1"><span>🐶</span><span>대표 수호견 품종 선택</span></span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            ${breedsHtml}
          </div>
        </div>
      `;
    } else if (teamSubTab === 'owner') {
      // ==========================================
      // [서브탭 2: 주인 — 중앙 쇼케이스 & 지원사격 무기 & 4대 장비 강화]
      // ==========================================
      const ownerHp = 100 + (save.ownerTraining?.hpLv || 0) * 15;

      // 1. 파트너 대칭 중앙 쇼케이스 카드 (중앙 주인공 확대 & 양옆 4대 생존 장비 슬롯)
      const ownerShowcaseHtml = `
        <div id="gear-showcase-owner-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🧑</span>
              <span>${ownerName} 생존 장비 쇼케이스</span>
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9.5px] font-black">
              회복 Lv.${ownerState.recoveryStage || 1}/5 (${ownerState.cureProgress || 0}%)
            </span>
          </div>

          <!-- 12컬럼 대칭 그리드: 좌(col-span-3, 배낭/신발) - 중앙 주인공(col-span-6) - 우(col-span-3, 의상/지원무기) -->
          <div class="grid grid-cols-12 items-center gap-1.5 sm:gap-2">
            <!-- 좌측 2슬롯 (배낭, 신발) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🎒</span>
                  <span class="truncate">배낭</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">Lv.${gear.backpack || 1}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold truncate">기력/회복</div>
              </div>

              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>👟</span>
                  <span class="truncate">신발</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">Lv.${gear.shoes || 1}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold truncate">이속/추종</div>
              </div>
            </div>

            <!-- 중앙: 파트너 캔버스 대형 프리뷰 (col-span-6) -->
            <div class="col-span-6 flex flex-col items-center justify-center">
              <div class="relative w-full max-w-[160px] aspect-square rounded-2xl bg-gradient-to-b from-emerald-100/70 to-emerald-50/30 border-2 border-emerald-600/40 shadow-sm flex items-center justify-center p-1 shrink-0 mx-auto">
                <canvas id="gear-showcase-owner-canvas" width="160" height="160" class="w-[145px] h-[145px] sm:w-[155px] sm:h-[155px] block"></canvas>
              </div>
            </div>

            <!-- 우측 2슬롯 (의상, 지원무기) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>🦺</span>
                  <span class="truncate">의상</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">Lv.${gear.outfit || 1}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold truncate">방어/억제</div>
              </div>

              <div class="p-1.5 rounded-xl bg-[#f0ebe0] border border-emerald-600/50 bg-emerald-50/60 ring-1 ring-emerald-500/30 flex flex-col justify-center min-h-[58px] text-center">
                <div class="text-[9px] font-bold text-[#5c6e60] flex items-center justify-center gap-0.5">
                  <span>${equippedWeaponDef.icon || '🔫'}</span>
                  <span class="truncate">${equippedWeaponDef.name || '지원무기'}</span>
                </div>
                <div class="text-[10.5px] font-black text-[#1f2d24] truncate mt-0.5">Lv.${gear.weapon || 1}</div>
                <div class="text-[8.5px] text-emerald-800 font-extrabold truncate">x${equippedWeaponDef.damageMult} · ${equippedWeaponDef.cooldown}s</div>
              </div>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
            <span class="text-[#4a584e]">지원 사격: <b class="text-emerald-800">${equippedWeaponDef.name}</b> (쿨 ${equippedWeaponDef.cooldown}초 · 사거리 ${equippedWeaponDef.range}px)</span>
            <span class="text-amber-800 font-bold">📍 거점: ${chInfo.base}</span>
          </div>
        </div>
      `;

      // 2. 주인 지원사격 무기 그리드
      const weaponsGridHtml = Object.values(OWNER_WEAPONS).filter((w) => w.id !== 'firearm').map((w) => {
        const isUnlocked = unlockedWeapons.includes(w.id);
        const isEquipped = equippedWeaponId === w.id;
        return `
          <div class="p-2.5 rounded-xl border flex flex-col justify-between gap-1 transition ${
            isEquipped
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 shadow-xs'
              : isUnlocked
              ? 'bg-[#f0ebe0] border-[#d2c8b4] hover:border-emerald-400'
              : 'bg-stone-100 border-stone-300 opacity-60'
          }">
            <div class="flex items-center gap-2">
              <span class="text-xl">${w.icon}</span>
              <div class="min-w-0">
                <div class="text-xs font-black text-[#1f2d24] truncate">${w.name}</div>
                <div class="text-[9.5px] text-[#5c6e60]">위력 x${w.damageMult} · 사거리 ${w.range}</div>
              </div>
            </div>
            ${isEquipped ? `
              <div class="mt-1 py-1 px-2 rounded-lg bg-emerald-600 text-white font-black text-[10px] text-center">장착 중 ✓</div>
            ` : isUnlocked ? `
              <button type="button" data-equip-owner-weapon="${w.id}" class="mt-1 py-1 px-2 rounded-lg bg-[#2d6a4f] hover:bg-[#245840] text-white font-black text-[10px] text-center active:scale-95 transition cursor-pointer">장착하기</button>
            ` : `
              <div class="mt-1 py-1 px-2 rounded-lg bg-stone-200 text-stone-500 font-bold text-[9px] text-center">🔒 챕터 보스 해금</div>
            `}
          </div>
        `;
      }).join('');

      // 3. 주인 4대 장비 강화
      const gearSlotsHtml = [
        { slot: 'backpack', name: '🎒 배낭', desc: '기력 최대치 & 회복력', mat: 'cloth', matName: '🧵 천 2개' },
        { slot: 'shoes', name: '👟 신발', desc: '이동속도 & 추종력', mat: 'parts', matName: '⚙️ 부품 2개' },
        { slot: 'outfit', name: '🦺 의상', desc: '기력 감소 억제 & 방어력', mat: 'bandage', matName: '🩹 붕대 2개' },
        { slot: 'weapon', name: '⚔️ 지원무기', desc: '지원사격 쿨다운 단축', mat: 'herb', matName: '🌿 약초 2개' },
      ].map((g) => `
        <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] space-y-1.5 flex flex-col justify-between">
          <div>
            <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
              <span>${g.name}</span>
              <span class="text-emerald-800 font-extrabold">Lv.${gear[g.slot] || 1}</span>
            </div>
            <div class="text-[10px] text-[#5c6e60]">${g.desc}</div>
          </div>
          <button type="button" data-upgrade-owner-gear="${g.slot}" class="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1 shadow-xs">
            <span>강화</span>
            <span class="text-[9px] opacity-80">(${g.matName} + 100🪙)</span>
          </button>
        </div>
      `).join('');

      gearPanel.innerHTML = `
        ${subtabsHtml}
        ${ownerShowcaseHtml}

        <!-- 2. 지원사격 무기 선택 -->
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] mb-3 space-y-2">
          <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
            <span class="flex items-center gap-1"><span>🔫</span><span>주인 지원사격 무기 (장착 중: ${equippedWeaponDef.name})</span></span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${weaponsGridHtml}
          </div>
        </div>

        <!-- 3. 주인 4대 장비 강화 -->
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] mb-3 space-y-2">
          <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
            <span>🛠️ 주인 4대 생존 장비</span>
            <span class="text-[10px] font-bold text-amber-900">골드: ${(save.gold || 0).toLocaleString()} 🪙</span>
          </div>
          <div class="grid grid-cols-4 gap-1 p-2 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] text-[10px] font-black text-center text-[#1f2d24]">
            <div>🧵 천: ${materials.cloth || 0}</div>
            <div>🩹 붕대: ${materials.bandage || 0}</div>
            <div>⚙️ 부품: ${materials.parts || 0}</div>
            <div>🌿 약초: ${materials.herb || 0}</div>
          </div>
          <div class="grid grid-cols-2 gap-2 pt-1">
            ${gearSlotsHtml}
          </div>
        </div>
      `;
    } else {
      // ==========================================
      // [서브탭 3: 브레멘 동행 — 대열 쇼케이스 & 좌우 2등분 동행 편성]
      // ==========================================
      const formationCount = (groundComp ? 1 : 0) + (riderComp ? 1 : 0);
      const formationLabel = formationCount === 2 ? '3단 대열 편성' : formationCount === 1 ? '2단 대열 편성' : '단독 출격';

      // 1. 브레멘 동행 대열 중앙 쇼케이스 카드 (중앙 주인공 확대 & 양옆 컴팩트 슬롯)
      const bremenShowcaseHtml = `
        <div id="gear-showcase-bremen-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🎺</span>
              <span>브레멘 동행 대열 쇼케이스</span>
            </span>
            <span class="text-[10px] font-bold text-amber-800">${formationLabel}</span>
          </div>

          <div class="grid grid-cols-12 items-center gap-1.5 sm:gap-2">
            <!-- 좌측: 등 탑승 슬롯 (col-span-3) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl ${groundComp ? 'bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-[#f0ebe0] border-dashed border-[#d2c8b4]'} border flex flex-col justify-center min-h-[58px] text-center">
                <div class="flex items-center justify-between text-[8.5px] font-bold text-[#5c6e60]">
                  <span>🐎 등</span>
                  ${groundComp ? `<button type="button" data-comp-ground="clear" class="text-[8px] text-rose-600 font-bold hover:underline cursor-pointer">해제</button>` : ''}
                </div>
                <div class="text-base my-0.5">${groundComp ? groundComp.icon : '🐎'}</div>
                <div class="text-[9.5px] font-black text-[#1f2d24] truncate">${groundComp ? groundComp.name : '미편성'}</div>
              </div>
            </div>

            <!-- 중앙: 브레멘 동행 진형 대형 프리뷰 (col-span-6) -->
            <div class="col-span-6 flex flex-col items-center justify-center">
              <div class="relative w-full max-w-[160px] aspect-square rounded-2xl bg-gradient-to-b from-amber-100/70 to-emerald-50/30 border-2 border-emerald-600/40 shadow-sm flex flex-col items-center justify-center p-2 shrink-0 mx-auto">
                <div class="text-[9px] font-black text-amber-800 mb-1">${formationLabel}</div>
                <div class="flex flex-col items-center justify-center -space-y-1">
                  <span class="text-xl sm:text-2xl animate-bounce leading-none drop-shadow-xs">${riderComp ? riderComp.icon : '🪶'}</span>
                  <span class="text-3xl sm:text-4xl leading-none drop-shadow-sm my-0.5">${dogBreedDef?.icon || '🐶'}</span>
                  <span class="text-xl sm:text-2xl leading-none drop-shadow-xs">${groundComp ? groundComp.icon : '🐎'}</span>
                </div>
              </div>
            </div>

            <!-- 우측: 어깨/공중 탑승 슬롯 (col-span-3) -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="p-1.5 rounded-xl ${riderComp ? 'bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-[#f0ebe0] border-dashed border-[#d2c8b4]'} border flex flex-col justify-center min-h-[58px] text-center">
                <div class="flex items-center justify-between text-[8.5px] font-bold text-[#5c6e60]">
                  <span>🦜 어깨</span>
                  ${riderComp ? `<button type="button" data-comp-rider="clear" class="text-[8px] text-rose-600 font-bold hover:underline cursor-pointer">해제</button>` : ''}
                </div>
                <div class="text-base my-0.5">${riderComp ? riderComp.icon : '🦜'}</div>
                <div class="text-[9.5px] font-black text-[#1f2d24] truncate">${riderComp ? riderComp.name : '미편성'}</div>
              </div>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
            <span class="text-[#4a584e] truncate">동행 버프: <b class="text-emerald-800">${groundComp ? groundComp.buffText : '등 미편성'} · ${riderComp ? riderComp.buffText : '어깨 미편성'}</b></span>
          </div>
        </div>
      `;

      // 2. 하단 좌우 세로 2등분 독립 스크롤 선택 UI
      const groundList = COMPANIONS.filter((c) => c.mountType === 'ground' || (!c.mountType && c.role && !c.role.includes('음파')));
      const riderList = COMPANIONS.filter((c) => c.mountType === 'rider' || (!c.mountType && c.role && c.role.includes('음파')));

      const groundCardsHtml = groundList.map((c) => {
        const isUnlocked = (compData.unlocked || []).includes(c.id) || maxUnlocked >= (c.unlockStage || 1);
        const isSelected = activeGroundId === c.id;
        return `
          <div
            data-comp-ground="${c.id}"
            class="p-2 rounded-xl border flex flex-col justify-between text-left transition select-none ${
              isSelected
                ? 'bg-emerald-50/95 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs cursor-pointer'
                : isUnlocked
                ? 'bg-[#f0ebe0] border-[#d2c8b4] hover:bg-[#e6dec8] active:scale-95 cursor-pointer'
                : 'bg-stone-100 border-stone-300 opacity-50 cursor-not-allowed'
            }"
            title="${isUnlocked ? c.name : `STAGE ${c.unlockStage} 해금`}"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-xl">${c.icon}</span>
              ${isSelected ? '<span class="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-black text-[8px]">탑승 중 ✓</span>' : isUnlocked ? '<span class="text-[8.5px] text-[#5c6e60] font-bold">선택</span>' : `<span class="text-[8px] text-stone-500 font-bold">🔒 St.${c.unlockStage}</span>`}
            </div>
            <div class="text-[11px] font-black text-[#1f2d24] truncate mt-1">${c.name}</div>
            <div class="text-[8.5px] text-emerald-800 font-bold truncate mt-0.5">${c.buffText || ''}</div>
          </div>
        `;
      }).join('');

      const riderCardsHtml = riderList.map((c) => {
        const isUnlocked = (compData.unlocked || []).includes(c.id) || maxUnlocked >= (c.unlockStage || 1);
        const isSelected = activeRiderId === c.id;
        return `
          <div
            data-comp-rider="${c.id}"
            class="p-2 rounded-xl border flex flex-col justify-between text-left transition select-none ${
              isSelected
                ? 'bg-emerald-50/95 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs cursor-pointer'
                : isUnlocked
                ? 'bg-[#f0ebe0] border-[#d2c8b4] hover:bg-[#e6dec8] active:scale-95 cursor-pointer'
                : 'bg-stone-100 border-stone-300 opacity-50 cursor-not-allowed'
            }"
            title="${isUnlocked ? c.name : `STAGE ${c.unlockStage} 해금`}"
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-xl">${c.icon}</span>
              ${isSelected ? '<span class="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-black text-[8px]">동행 중 ✓</span>' : isUnlocked ? '<span class="text-[8.5px] text-[#5c6e60] font-bold">선택</span>' : `<span class="text-[8px] text-stone-500 font-bold">🔒 St.${c.unlockStage}</span>`}
            </div>
            <div class="text-[11px] font-black text-[#1f2d24] truncate mt-1">${c.name}</div>
            <div class="text-[8.5px] text-emerald-800 font-bold truncate mt-0.5">${c.buffText || ''}</div>
          </div>
        `;
      }).join('');

      gearPanel.innerHTML = `
        ${subtabsHtml}
        ${bremenShowcaseHtml}

        <!-- 2. 브레멘 동행 선택 (좌우 2등분 독립 스크롤) -->
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] space-y-2">
          <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
            <span class="flex items-center gap-1"><span>🎺</span><span>브레멘 동행 대열 편성</span></span>
            <span class="text-[10px] text-emerald-800 font-bold">1마리 단독 동행 가능</span>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <!-- 좌측: 등 탑승 친구 -->
            <div class="flex flex-col gap-1.5">
              <div class="text-[11px] font-black text-[#1f2d24] flex items-center justify-between px-1">
                <span>🐎 등 탑승 친구</span>
                <span class="text-[9px] text-[#5c6e60] font-bold">대형·지상</span>
              </div>
              <div class="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                ${groundCardsHtml}
              </div>
            </div>

            <!-- 우측: 어깨/공중 친구 -->
            <div class="flex flex-col gap-1.5">
              <div class="text-[11px] font-black text-[#1f2d24] flex items-center justify-between px-1">
                <span>🦜 어깨/공중 친구</span>
                <span class="text-[9px] text-[#5c6e60] font-bold">소형·비행</span>
              </div>
              <div class="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                ${riderCardsHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // ----------------------------------------------------
    // 이벤트 리스너 바인딩
    // ----------------------------------------------------
    document.getElementById('team-subtab-dog')?.addEventListener('click', () => {
      teamSubTab = 'dog';
      renderGearTab();
    });

    document.getElementById('team-subtab-owner')?.addEventListener('click', () => {
      teamSubTab = 'owner';
      renderGearTab();
    });

    document.getElementById('team-subtab-companion')?.addEventListener('click', () => {
      teamSubTab = 'companion';
      renderGearTab();
    });

    if (teamSubTab === 'dog') {
      // 캔버스 렌더링 (대형 160px 캔버스용 2.2배율)
      const heroCanvas = document.getElementById('gear-showcase-hero-canvas');
      if (heroCanvas) {
        renderDogToCanvas(heroCanvas, {
          save,
          breedId: save.selectedBreed || 'pomeranian',
          scale: 2.2,
          withEquipment: true,
        });
      }

      // 인벤토리 필터 탭
      gearPanel.querySelectorAll('[data-inventory-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          inventoryFilter = btn.getAttribute('data-inventory-filter') || 'all';
          renderGearTab();
        });
      });

      // 장비 착용 버튼
      gearPanel.querySelectorAll('.costume-equip-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-costume-equip');
          const item = DOG_GEAR.find((c) => c.id === id);
          if (!item) return;
          updateSave((s) => {
            if (!s.costumes) s.costumes = { owned: ['basic_harness'], equipped: {} };
            if (!s.costumes.equipped) s.costumes.equipped = {};
            if (!s.costumes.owned.includes(item.id)) s.costumes.owned.push(item.id);

            const curSlotVal = s.costumes.equipped[item.slot];
            if (curSlotVal === item.id) {
              s.costumes.equipped[item.slot] = item.slot === 'harness' ? 'basic_harness' : null;
            } else {
              s.costumes.equipped[item.slot] = item.id;
            }
          });
          audioEngine.playLevelUp?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });

      // 품종 선택 (미해금 잠금 가드)
      gearPanel.querySelectorAll('.breed-switch-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.hasAttribute('disabled') || btn.dataset.locked === 'true') return;
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
    } else if (teamSubTab === 'owner') {
      // 주인 캔버스 렌더링 (대형 160px 캔버스용 2.3배율)
      const ownerCanvas = document.getElementById('gear-showcase-owner-canvas');
      if (ownerCanvas) {
        drawOwnerCharacter(ownerCanvas, {
          recoveryStage: ownerState.recoveryStage || 1,
          scale: 2.3,
          clearCanvas: true,
        });
      }

      // 주인 무기 장착
      gearPanel.querySelectorAll('[data-equip-owner-weapon]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const wId = btn.getAttribute('data-equip-owner-weapon');
          updateSave((s) => {
            s.equippedOwnerWeapon = wId;
          });
          if (profile) profile.equippedOwnerWeapon = wId;
          settingsStore?.save?.();
          audioEngine.playCaptureTick?.();
          renderGearTab();
        });
      });

      // 주인 4대 장비 강화
      gearPanel.querySelectorAll('[data-upgrade-owner-gear]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slot = btn.getAttribute('data-upgrade-owner-gear');
          const matMap = { backpack: 'cloth', shoes: 'parts', outfit: 'bandage', weapon: 'herb' };
          const mat = matMap[slot];
          if (!mat) return;
          const curMat = materials[mat] || 0;
          const curGold = save.gold || 0;
          if (curMat < 2 || curGold < 100) {
            audioEngine.playWrong?.();
            alert('강화 재료가 부족합니다! (재료 2개 + 100골드 필요)');
            return;
          }
          materials[mat] -= 2;
          gear[slot] = (gear[slot] || 1) + 1;
          updateSave((s) => {
            s.gold = Math.max(0, curGold - 100);
          });
          settingsStore?.save?.();
          audioEngine.playLevelUp?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });
    } else {
      // 브레멘 등 탑승 토글
      gearPanel.querySelectorAll('[data-comp-ground]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('cursor-not-allowed')) return;
          const cid = btn.getAttribute('data-comp-ground');
          compData.activeGround = (cid === 'clear' || compData.activeGround === cid) ? null : cid;
          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [] };
            s.companions.activeGround = compData.activeGround;
            s.companions.activeRider = compData.activeRider;
            s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
          });
          if (profile) {
            if (!profile.companions) profile.companions = { unlocked: [], active: [] };
            profile.companions.activeGround = compData.activeGround;
            profile.companions.activeRider = compData.activeRider;
            profile.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
            settingsStore?.save?.();
          }
          audioEngine.playCorrect?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });

      // 브레멘 어깨/공중 탑승 토글
      gearPanel.querySelectorAll('[data-comp-rider]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('cursor-not-allowed')) return;
          const cid = btn.getAttribute('data-comp-rider');
          compData.activeRider = (cid === 'clear' || compData.activeRider === cid) ? null : cid;
          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [] };
            s.companions.activeGround = compData.activeGround;
            s.companions.activeRider = compData.activeRider;
            s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
          });
          if (profile) {
            if (!profile.companions) profile.companions = { unlocked: [], active: [] };
            profile.companions.activeGround = compData.activeGround;
            profile.companions.activeRider = compData.activeRider;
            profile.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
            settingsStore?.save?.();
          }
          audioEngine.playCorrect?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });
    }
  }

  return {
    renderGearTab,
    renderTrainingTab,
  };
}

