/**
 * js/ui/shopUI.js
 * 💎 상점 탭: 1:1 정사각형(aspect-square) 통일 규격
 * - 📦 3종 보급 상자 (일반, 고급 전술, 특급 영웅)
 * - 🍖 펫 간식 3종 (뼈다귀, 스테이크, 생일 케이크)
 * - 💎 보석 충전소 3종 인앱 패키지
 * - 💱 재화 교환소 4종
 * - 🦸 캐릭터 전용 스킨 3종
 * - ✨ 영구 능력치 강화 3종
 */

import {
  getSave,
  updateSave,
  addAffection,
  getAffection,
  recordQuestProgress,
  rollSupplyBox,
  getTodayDateKey,
} from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { PET_TREATS, SUPPLY_BOX_DEFS, BREEDS } from '../data/catalog.js';
import { t } from '../data/i18n.js';

const IN_APP_PACKAGES = [
  {
    id: 'pkg_starter',
    name: '스타터 주머니',
    icon: '👛',
    gems: 500,
    price: '₩1,500',
    badge: '실속',
    badgeColor: 'bg-emerald-600',
    desc: '모험가를 위한 알뜰 주머니',
  },
  {
    id: 'pkg_popular',
    name: '인기 보석 상자',
    icon: '📦',
    gems: 2500,
    price: '₩5,900',
    badge: 'BEST',
    badgeColor: 'bg-amber-500',
    desc: '가성비 최고 (+25% 보너스)',
  },
  {
    id: 'pkg_royal',
    name: '왕실 보물함',
    icon: '👑',
    gems: 6500,
    price: '₩12,900',
    badge: '최고 혜택',
    badgeColor: 'bg-purple-600',
    desc: '대용량 묶음 (+40% 보너스)',
  },
];

const MILK_SKINS = [
  {
    id: 'skin_detective',
    titleSuffix: '탐정',
    icon: '🕵️',
    cost: 150,
    desc: '셜록의 명추리 모자와 코트',
    statText: '공격 +3 · 체력 +10',
  },
  {
    id: 'skin_astronaut',
    titleSuffix: '우주비행사',
    icon: '🧑‍🚀',
    cost: 300,
    desc: '산소 헬멧과 네온 우주복',
    statText: '공격 +5 · 체력 +20',
  },
  {
    id: 'skin_crown',
    titleSuffix: '황금 왕관',
    icon: '👑',
    cost: 500,
    desc: '빛나는 황실 왕관과 후광',
    statText: '공격 +8 · 체력 +30',
  },
];

function getSkinName(skin, dogName = '우유') {
  return `${skin.titleSuffix} ${dogName}`;
}

const PERMANENT_UPGRADES = [
  {
    key: 'gemMagnet',
    name: '자석 범위 확장',
    icon: '🧲',
    maxLevel: 5,
    costs: [150, 250, 350, 450, 550],
    descPerLv: '흡수 반경 +25px 영구 확장',
  },
  {
    key: 'bonusHp',
    name: '시작 최대 체력',
    icon: '💖',
    maxLevel: 5,
    costs: [200, 320, 440, 560, 680],
    descPerLv: '기본 시작 HP +20 영구 추가',
  },
  {
    key: 'bonusWeapon',
    name: '시작 보너스 공격',
    icon: '⚔️',
    maxLevel: 3,
    costs: [350, 600, 850],
    descPerLv: '기본 공격력 +5 추가 증가',
  },
];

export const CURRENCY_EXCHANGE_ITEMS = [
  {
    id: 'exch_gold_small',
    name: '금화 주머니',
    icon: '🪙',
    type: 'gold',
    amount: 150,
    costGems: 30,
    badge: '실속',
    desc: '훈련소 스탯 강화용',
  },
  {
    id: 'exch_gold_large',
    name: '금화 상자',
    icon: '💰',
    type: 'gold',
    amount: 600,
    costGems: 100,
    badge: '+20%',
    desc: '대량의 훈련 급성장용',
  },
  {
    id: 'exch_snacks_small',
    name: '뼈다귀 번들',
    icon: '🦴',
    type: 'snacks',
    amount: 2,
    costGems: 40,
    badge: '인기',
    desc: '승급전 & 동료 간식용',
  },
  {
    id: 'exch_snacks_large',
    name: '특대 바구니',
    icon: '🍖',
    type: 'snacks',
    amount: 8,
    costGems: 150,
    badge: '대용량',
    desc: '동료 동물 모집 & 성장용',
  },
];

export function createShopUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const shopPanel = document.getElementById('tab-panel-shop');

  function renderShopTab() {
    if (!shopPanel) return;
    const save = getSave();
    const curGold = save.gold ?? 0;
    const curGems = save.gems ?? 0;
    const dogName = save.dogName || '우유';
    const curBreedId = save.selectedBreed || 'pomeranian';
    const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];
    const today = getTodayDateKey();
    const isFreeAvailable = save.lastFreeSupplyDate !== today;
    const pityHero = save.gachaPity?.heroCount || 0;
    const ownedItems = new Set(save.ownedItems || []);
    const equippedSkin = save.equippedSkin || null;
    const upgrades = save.shopUpgrades || { gemMagnet: 0, bonusHp: 0, bonusWeapon: 0 };

    // 1. 📦 보급 상자 카드 (aspect-square)
    const supplyBoxesHtml = SUPPLY_BOX_DEFS.map((box) => {
      let costText = '';
      let isFree = false;
      if (box.id === 'box_normal') {
        if (isFreeAvailable) {
          costText = '무료 뽑기';
          isFree = true;
        } else {
          costText = `🪙 ${box.cost}`;
        }
      } else if (box.id === 'box_tactical') {
        costText = `💎 ${box.cost}`;
      } else if (box.id === 'box_hero') {
        costText = `💎 ${box.cost} ~ `;
      }

      const extraSub = box.id === 'box_hero'
        ? `<span class="text-[9px] text-purple-700 font-bold">천장: ${pityHero}/20</span>`
        : `<span class="text-[9px] text-[#5c6e60] font-medium">${box.badge}</span>`;

      return `
        <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-emerald-500/60 transition">
          <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black text-white ${box.badgeColor}">${box.badge}</span>
          <div class="text-3xl mt-1 select-none">${box.icon}</div>
          <div class="min-w-0 px-1">
            <div class="text-xs font-black text-[#1f2d24] truncate">${box.name}</div>
            <div class="mt-0.5">${extraSub}</div>
          </div>
          <button type="button" data-box-id="${box.id}" data-is-free="${isFree}" class="btn-open-box w-full py-1.5 rounded-xl font-black text-[11px] transition active:scale-95 shadow-xs ${
            isFree
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white animate-pulse'
              : box.id === 'box_hero'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white'
                : 'bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] text-white'
          }">
            ${costText}
          </button>
        </div>
      `;
    }).join('');

    // 2. 🍖 펫 간식 카드 (aspect-square)
    const petTreatsHtml = PET_TREATS.map((treat) => {
      let priceLabel = '';
      if (treat.id === 'treat_bone') priceLabel = `🪙 ${treat.costGold}`;
      else if (treat.id === 'treat_steak') priceLabel = `🪙 350 / 💎 25`;
      else if (treat.id === 'treat_cake') priceLabel = `💎 ${treat.costGems}`;

      return `
        <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-amber-500/60 transition">
          <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-500 text-white">+${treat.xp} XP</span>
          <div class="text-3xl mt-1 select-none">${treat.icon}</div>
          <div class="min-w-0 px-1">
            <div class="text-xs font-black text-[#1f2d24] truncate">${treat.name}</div>
            <div class="text-[9px] text-amber-700 font-bold mt-0.5">친밀도 +${treat.xp}</div>
          </div>
          <button type="button" data-treat-id="${treat.id}" class="btn-buy-treat w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-[11px] shadow-xs transition active:scale-95">
            ${priceLabel}
          </button>
        </div>
      `;
    }).join('');

    // 3. 💎 보석 충전소 패키지 카드 (aspect-square)
    const packagesHtml = IN_APP_PACKAGES.map((pkg) => `
      <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-cyan-500/60 transition">
        <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black text-white ${pkg.badgeColor}">${pkg.badge}</span>
        <div class="text-3xl mt-1 select-none">${pkg.icon}</div>
        <div class="min-w-0 px-1">
          <div class="text-xs font-black text-[#1f2d24] truncate">${pkg.name}</div>
          <div class="text-[11px] font-extrabold text-cyan-700 mt-0.5">💎 ${pkg.gems.toLocaleString()}</div>
        </div>
        <button type="button" data-pkg-id="${pkg.id}" class="btn-buy-package w-full py-1.5 rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] text-white font-black text-[11px] shadow-xs transition active:scale-95">
          ${pkg.price}
        </button>
      </div>
    `).join('');

    // 4. 💱 재화 교환소 카드 (aspect-square)
    const exchangesHtml = CURRENCY_EXCHANGE_ITEMS.map((item) => {
      const rewardIcon = item.type === 'gold' ? '🪙' : '🦴';
      return `
        <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-amber-500/60 transition">
          <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-500 text-white">${item.badge}</span>
          <div class="text-3xl mt-1 select-none">${item.icon}</div>
          <div class="min-w-0 px-1">
            <div class="text-xs font-black text-[#1f2d24] truncate">${item.name}</div>
            <div class="text-[11px] font-black text-emerald-700 mt-0.5">+${item.amount.toLocaleString()} ${rewardIcon}</div>
          </div>
          <button type="button" data-item-id="${item.id}" class="btn-exchange-currency w-full py-1.5 rounded-xl bg-gradient-to-r from-cyan-700 to-teal-800 text-white font-black text-[11px] shadow-xs transition active:scale-95">
            💎 ${item.costGems}
          </button>
        </div>
      `;
    }).join('');

    // 5. 🦸 스킨 카드 (aspect-square)
    const skinsHtml = MILK_SKINS.map((skin) => {
      const isOwned = ownedItems.has(skin.id);
      const isEquipped = equippedSkin === skin.id;
      const skinName = getSkinName(skin, dogName);

      return `
        <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-purple-500/60 transition">
          <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-600 text-white">스킨</span>
          <div class="text-3xl mt-1 select-none">${skin.icon}</div>
          <div class="min-w-0 px-1">
            <div class="text-xs font-black text-[#1f2d24] truncate">${skinName}</div>
            <div class="text-[9px] text-[#5c6e60] font-bold mt-0.5 truncate">${skin.statText}</div>
          </div>
          ${
            isOwned
              ? `
                <button type="button" data-skin-id="${skin.id}" class="btn-toggle-skin w-full py-1.5 rounded-xl font-black text-[11px] transition active:scale-95 shadow-xs ${
                  isEquipped
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#e6dec8] text-[#1f2d24] hover:bg-[#dcd3bd]'
                }">
                  ${isEquipped ? '착용 중' : '장착하기'}
                </button>
              `
              : `
                <button type="button" data-skin-id="${skin.id}" data-skin-cost="${skin.cost}" class="btn-buy-skin w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black text-[11px] shadow-xs transition active:scale-95">
                  💎 ${skin.cost}
                </button>
              `
          }
        </div>
      `;
    }).join('');

    // 6. ✨ 영구 특성 강화 카드 (aspect-square)
    const upgradesHtml = PERMANENT_UPGRADES.map((u) => {
      const curLv = upgrades[u.key] || 0;
      const isMax = curLv >= u.maxLevel;
      const cost = isMax ? 0 : u.costs[curLv];

      return `
        <div class="aspect-square rounded-2xl bg-[#faf6ee] p-2.5 border border-[#d2c8b4] flex flex-col justify-between items-center text-center shadow-sm relative group hover:border-emerald-500/60 transition">
          <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black ${
            isMax ? 'bg-amber-500 text-white' : 'bg-[#2d6a4f] text-white'
          }">Lv.${curLv}/${u.maxLevel}</span>
          <div class="text-3xl mt-1 select-none">${u.icon}</div>
          <div class="min-w-0 px-1">
            <div class="text-xs font-black text-[#1f2d24] truncate">${u.name}</div>
            <div class="text-[9px] text-[#5c6e60] font-medium mt-0.5 truncate">${u.descPerLv}</div>
          </div>
          <button type="button" data-up-key="${u.key}" data-up-cost="${cost}" ${isMax ? 'disabled' : ''} class="btn-upgrade-perm w-full py-1.5 rounded-xl font-black text-[11px] transition active:scale-95 shadow-xs ${
            isMax
              ? 'bg-[#e6dec8] text-[#7a8c7e] cursor-default'
              : 'bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] text-white'
          }">
            ${isMax ? 'MAX 달성' : `💎 ${cost}`}
          </button>
        </div>
      `;
    }).join('');

    // 전체 상점 탭 조립
    shopPanel.innerHTML = `
      <!-- 상점 헤더 배너 -->
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#1b3b2b] via-[#234735] to-[#142c20] text-[#f8f5ec] shadow-md border border-[#2d5a43] flex items-center justify-between">
        <div>
          <div class="text-[10px] font-bold text-emerald-300">Puppy Guardians Armory & Shop</div>
          <h2 class="text-base font-black text-[#f8f5ec] flex items-center gap-1.5 mt-0.5">
            <span>💎</span>
            <span>수호대 보급 상점</span>
          </h2>
        </div>
        <div class="flex items-center gap-2 text-xs font-black">
          <span class="px-2.5 py-1 rounded-full bg-[#11261b] text-amber-300 border border-amber-400/30">🪙 ${curGold.toLocaleString()}</span>
          <span class="px-2.5 py-1 rounded-full bg-[#11261b] text-cyan-300 border border-cyan-400/30">💎 ${curGems.toLocaleString()}</span>
        </div>
      </div>

      <!-- 1. 📦 보급 상자 코너 (aspect-square 3칸) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>📦</span>
            <span>전술 보급 상자</span>
          </h3>
          <span class="text-[10px] text-[#5c6e60] font-bold">무기 50종 & 재화 획득</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${supplyBoxesHtml}
        </div>
      </div>

      <!-- 2. 🍖 펫 간식 코너 (aspect-square 3칸) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>🍖</span>
            <span>강아지 특식 & 간식</span>
          </h3>
          <span class="text-[10px] text-amber-700 font-bold">${curBreed.name} 친밀도 즉시 상승</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${petTreatsHtml}
        </div>
      </div>

      <!-- 3. 💎 보석 충전소 (aspect-square 3칸) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>💎</span>
            <span>보석 충전소</span>
          </h3>
          <span class="text-[10px] text-cyan-700 font-bold">인앱 패키지 3종</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${packagesHtml}
        </div>
      </div>

      <!-- 4. 💱 재화 환전소 (aspect-square 4칸 2x2) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>💱</span>
            <span>보석 재화 환전소</span>
          </h3>
          <span class="text-[10px] text-[#5c6e60] font-bold">금화 & 뼈다귀 번들</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${exchangesHtml}
        </div>
      </div>

      <!-- 5. 🦸 캐릭터 스킨 코너 (aspect-square 3칸) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>🦸</span>
            <span>${dogName} 전용 코스튬</span>
          </h3>
          <span class="text-[10px] text-[#5c6e60] font-bold">스탯 보너스 부여</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${skinsHtml}
        </div>
      </div>

      <!-- 6. ✨ 영구 특성 강화 (aspect-square 3칸) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
            <span>✨</span>
            <span>영구 능력치 특성</span>
          </h3>
          <span class="text-[10px] text-emerald-800 font-bold">모든 전투 영구 적용</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${upgradesHtml}
        </div>
      </div>
    `;

    bindShopEvents();
  }

  function bindShopEvents() {
    if (!shopPanel) return;

    // --- 1. 보급 상자 뽑기 이벤트 ---
    shopPanel.querySelectorAll('.btn-open-box').forEach((btn) => {
      btn.addEventListener('click', () => {
        const boxId = btn.dataset.boxId;
        const isFree = btn.dataset.isFree === 'true';
        const box = SUPPLY_BOX_DEFS.find((b) => b.id === boxId);
        if (!box) return;

        if (boxId === 'box_hero') {
          // 영웅 상자는 단차 vs 10연차 선택 모달
          const save = getSave();
          const pityHero = save.gachaPity?.heroCount || 0;
          openModal?.(`
            <div class="text-center space-y-3.5">
              <div class="text-4xl">${box.icon}</div>
              <h3 class="text-base font-black text-purple-900">${box.name}</h3>
              <p class="text-xs text-[#4a584e] leading-relaxed">
                전설~신화 무기 초고확률 등장!<br/>
                현재 천장 카운트: <strong class="text-purple-700 font-black">${pityHero} / 20회</strong> (20회 시 전설 이상 100% 확정)
              </p>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button id="btn-pull-1x" type="button" class="py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md active:scale-95 transition">
                  단차 (💎 150)
                </button>
                <button id="btn-pull-10x" type="button" class="py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition">
                  10연차 (💎 1,350)
                </button>
              </div>
              <button id="btn-cancel-gacha" type="button" class="w-full py-2 rounded-xl bg-[#e6dec8] text-xs font-bold text-[#1f2d24]">취소</button>
            </div>
          `);

          document.getElementById('btn-cancel-gacha')?.addEventListener('click', () => closeModal?.());
          document.getElementById('btn-pull-1x')?.addEventListener('click', () => executeGacha('box_hero', false, false));
          document.getElementById('btn-pull-10x')?.addEventListener('click', () => executeGacha('box_hero', true, false));
          return;
        }

        // 일반 및 고급 전술 상자 즉시 실행 또는 확인
        executeGacha(boxId, false, isFree);
      });
    });

    function executeGacha(boxId, is10x, isFree) {
      const res = rollSupplyBox(boxId, is10x, isFree);
      if (!res.ok) {
        if (res.error === 'not_enough_gold') {
          showInsufficientCurrencyModal('🪙 금화', '골드가 부족합니다. 전투 출격이나 환전소에서 금화를 획득하세요!');
        } else if (res.error === 'not_enough_gems') {
          showInsufficientCurrencyModal('💎 보석', '보석이 부족합니다. 퀘스트 완료 또는 충전소에서 보석을 충전하세요!');
        }
        return;
      }

      audioEngine.playPowerUp?.();
      onResourcesChanged?.();
      renderShopTab();
      showGachaResultModal(res);
    }

    function showGachaResultModal(gachaRes) {
      const RARITY_COLORS = {
        common: 'border-slate-300 bg-slate-50 text-slate-800',
        rare: 'border-emerald-400 bg-emerald-50 text-emerald-800',
        epic: 'border-cyan-400 bg-cyan-50 text-cyan-800',
        legend: 'border-amber-400 bg-amber-50 text-amber-900',
        mythic: 'border-purple-500 bg-purple-50 text-purple-900 shadow-lg',
      };
      const RARITY_LABELS = {
        common: '일반',
        rare: '고급',
        epic: '희귀',
        legend: '전설',
        mythic: '신화',
      };

      const pullCards = gachaRes.pulls.map((p) => {
        const w = p.weapon;
        const colorClass = RARITY_COLORS[w.rarity] || RARITY_COLORS.common;
        const label = RARITY_LABELS[w.rarity] || '일반';
        return `
          <div class="p-2.5 rounded-xl border-2 ${colorClass} flex flex-col justify-between items-center text-center relative">
            ${p.isNew ? '<span class="absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white">NEW!</span>' : '<span class="absolute top-1 right-1 px-1 py-0.5 rounded text-[8px] font-bold bg-slate-400 text-white">중복</span>'}
            <div class="text-3xl my-1 select-none">${w.icon}</div>
            <div class="w-full">
              <span class="text-[8px] font-extrabold uppercase px-1 rounded bg-black/10">${label}</span>
              <div class="text-xs font-black truncate mt-0.5">${w.name}</div>
              <div class="text-[10px] font-bold text-rose-600">공격력 +${w.atkBonus}</div>
            </div>
          </div>
        `;
      }).join('');

      openModal?.(`
        <div class="text-center space-y-3.5 max-h-[80dvh] flex flex-col">
          <div class="text-3xl select-none">${gachaRes.box.icon}</div>
          <h3 class="text-base font-black text-emerald-800">${gachaRes.box.name} 보급 완료!</h3>
          <p class="text-xs text-[#4a584e]">
            보너스 획득: <strong class="text-amber-600">🪙 +${gachaRes.totalBonusGold}</strong> · <strong class="text-amber-700">🦴 +${gachaRes.totalBonusSnacks}</strong>
          </p>
          <div class="grid ${gachaRes.pulls.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 max-w-[200px] mx-auto'} gap-2 overflow-y-auto max-h-[50dvh] p-1">
            ${pullCards}
          </div>
          <button id="btn-close-gacha-res" type="button" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4332] text-white font-black text-xs active:scale-95 transition">
            확인
          </button>
        </div>
      `);

      document.getElementById('btn-close-gacha-res')?.addEventListener('click', () => {
        closeModal?.();
      });
    }

    // --- 2. 🍖 펫 간식 구매 이벤트 ---
    shopPanel.querySelectorAll('.btn-buy-treat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const treatId = btn.dataset.treatId;
        const treat = PET_TREATS.find((t) => t.id === treatId);
        if (!treat) return;

        const save = getSave();
        const curBreedId = save.selectedBreed || 'pomeranian';
        const curBreed = BREEDS.find((b) => b.id === curBreedId) || BREEDS[0];

        if (treat.id === 'treat_steak') {
          // 스테이크는 골드 vs 보석 결제 수단 선택
          openModal?.(`
            <div class="text-center space-y-3.5">
              <div class="text-4xl select-none">${treat.icon}</div>
              <h3 class="text-base font-black text-amber-900">${treat.name} 구매</h3>
              <p class="text-xs text-[#4a584e] leading-relaxed">
                ${curBreed.name}에게 특제 한우 스테이크를 먹여<br/>
                친밀도를 <strong class="text-amber-700 font-black">+${treat.xp} XP</strong> 상승시킵니다!
              </p>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button id="btn-pay-steak-gold" type="button" class="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md active:scale-95 transition">
                  🪙 350골드
                </button>
                <button id="btn-pay-steak-gems" type="button" class="py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-black text-xs shadow-md active:scale-95 transition">
                  💎 25보석
                </button>
              </div>
              <button id="btn-cancel-steak" type="button" class="w-full py-2 rounded-xl bg-[#e6dec8] text-xs font-bold text-[#1f2d24]">취소</button>
            </div>
          `);

          document.getElementById('btn-cancel-steak')?.addEventListener('click', () => closeModal?.());
          document.getElementById('btn-pay-steak-gold')?.addEventListener('click', () => {
            const s = getSave();
            if ((s.gold || 0) < 350) {
              showInsufficientCurrencyModal('🪙 금화', '골드가 부족합니다 (필요: 350🪙).');
              return;
            }
            updateSave((st) => { st.gold = (st.gold || 0) - 350; });
            applyFeedTreat(treat, curBreed);
          });
          document.getElementById('btn-pay-steak-gems')?.addEventListener('click', () => {
            const s = getSave();
            if ((s.gems || 0) < 25) {
              showInsufficientCurrencyModal('💎 보석', '보석이 부족합니다 (필요: 25💎).');
              return;
            }
            updateSave((st) => { st.gems = (st.gems || 0) - 25; });
            applyFeedTreat(treat, curBreed);
          });
          return;
        }

        // 뼈다귀 간식 or 생일 케이크 단일 결제 확인
        if (treat.id === 'treat_bone') {
          if ((save.gold || 0) < treat.costGold) {
            showInsufficientCurrencyModal('🪙 금화', `골드가 부족합니다 (필요: ${treat.costGold}🪙).`);
            return;
          }
          updateSave((st) => { st.gold = (st.gold || 0) - treat.costGold; });
          applyFeedTreat(treat, curBreed);
        } else if (treat.id === 'treat_cake') {
          if ((save.gems || 0) < treat.costGems) {
            showInsufficientCurrencyModal('💎 보석', `보석이 부족합니다 (필요: ${treat.costGems}💎).`);
            return;
          }
          updateSave((st) => { st.gems = (st.gems || 0) - treat.costGems; });
          applyFeedTreat(treat, curBreed);
        }
      });
    });

    function applyFeedTreat(treat, breed) {
      const affRes = addAffection(breed.id, treat.xp);
      recordQuestProgress('petCount', 1);
      audioEngine.playCorrect?.();
      onResourcesChanged?.();
      renderShopTab();

      const affInfo = getAffection(breed.id);
      openModal?.(`
        <div class="text-center space-y-3.5 py-1">
          <div class="text-5xl animate-bounce select-none">❤️ ${treat.icon} ❤️</div>
          <h3 class="text-base font-black text-rose-700">냠냠! 간식 먹방 대성공!</h3>
          <p class="text-xs text-[#4a584e] leading-relaxed">
            <strong>${breed.name}</strong>(이)가 ${treat.name}을(를) 맛있게 먹었습니다!<br/>
            친밀도가 <strong class="text-rose-600 font-black">+${treat.xp} XP</strong> 올랐어요.
          </p>
          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
            <div class="font-extrabold text-[#1f2d24]">현재 친밀도: Lv.${affInfo.level} [${affInfo.title}]</div>
            <div class="text-[11px] text-[#4a584e] mt-1">${affInfo.hearts} ${affInfo.desc}</div>
          </div>
          ${affRes.leveledUp ? '<div class="py-1.5 px-3 rounded-lg bg-emerald-600 text-white font-black text-xs animate-pulse">✨ 친밀도 레벨 업! 합동 필살기 강화! ✨</div>' : ''}
          <button id="btn-treat-confirm-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">
            확인
          </button>
        </div>
      `);

      document.getElementById('btn-treat-confirm-ok')?.addEventListener('click', () => closeModal?.());
    }

    // --- 3. 💎 인앱 패키지 충전 ---
    shopPanel.querySelectorAll('.btn-buy-package').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pkgId = btn.dataset.pkgId;
        const pkg = IN_APP_PACKAGES.find((p) => p.id === pkgId);
        if (!pkg) return;

        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl select-none">${pkg.icon}</div>
            <h3 class="text-base font-black text-emerald-800">${pkg.name} 충전</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              ${pkg.price} 결제를 진행하여<br/>
              <strong class="text-cyan-700 font-black">💎 ${pkg.gems.toLocaleString()}개</strong>를 충전하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-pkg" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">취소</button>
              <button id="btn-confirm-pkg" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">충전 승인</button>
            </div>
          </div>
        `);

        document.getElementById('btn-cancel-pkg')?.addEventListener('click', () => closeModal?.());
        document.getElementById('btn-confirm-pkg')?.addEventListener('click', () => {
          updateSave((s) => {
            s.gems = (s.gems || 0) + pkg.gems;
          });
          audioEngine.playPowerUp?.();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    // --- 4. 💱 재화 교환소 ---
    shopPanel.querySelectorAll('.btn-exchange-currency').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        const item = CURRENCY_EXCHANGE_ITEMS.find((it) => it.id === itemId);
        if (!item) return;

        const save = getSave();
        const curGems = save.gems ?? 0;
        if (curGems < item.costGems) {
          showInsufficientCurrencyModal('💎 보석', `보석이 부족합니다 (필요: ${item.costGems}💎).`);
          return;
        }

        const rewardIcon = item.type === 'gold' ? '🪙' : '🦴';
        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl select-none">${item.icon}</div>
            <h3 class="text-base font-black text-emerald-800">${item.name} 교환</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              보석 <strong class="text-cyan-700">💎 ${item.costGems}개</strong>를 소모하여<br/>
              <strong class="text-emerald-700 font-black">+${item.amount.toLocaleString()} ${rewardIcon}</strong>(을)를 교환하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-exch" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">취소</button>
              <button id="btn-confirm-exch" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">교환</button>
            </div>
          </div>
        `);

        document.getElementById('btn-cancel-exch')?.addEventListener('click', () => closeModal?.());
        document.getElementById('btn-confirm-exch')?.addEventListener('click', () => {
          updateSave((s) => {
            s.gems = Math.max(0, (s.gems || 0) - item.costGems);
            if (item.type === 'gold') s.gold = (s.gold || 0) + item.amount;
            else if (item.type === 'snacks') s.snacks = (s.snacks || 0) + item.amount;
          });
          audioEngine.playCorrect?.();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    // --- 5. 🦸 스킨 구매 & 장착 ---
    shopPanel.querySelectorAll('.btn-buy-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.dataset.skinId;
        const cost = Number(btn.dataset.skinCost);
        const skin = MILK_SKINS.find((s) => s.id === skinId);
        if (!skin) return;

        const save = getSave();
        const curGems = save.gems ?? 0;
        if (curGems < cost) {
          showInsufficientCurrencyModal('💎 보석', `보석이 부족합니다 (필요: ${cost}💎).`);
          return;
        }

        const skinName = getSkinName(skin, save.dogName || '우유');
        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl select-none">${skin.icon}</div>
            <h3 class="text-base font-black text-purple-900">${skinName} 구매</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              보석 <strong class="text-cyan-700 font-black">💎 ${cost}개</strong>를 소모하여<br/>
              <strong>[${skinName}]</strong>을 구매하고 즉시 장착하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-skin" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">취소</button>
              <button id="btn-confirm-skin" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-black text-xs shadow-md active:scale-95 transition">구매 및 장착</button>
            </div>
          </div>
        `);

        document.getElementById('btn-cancel-skin')?.addEventListener('click', () => closeModal?.());
        document.getElementById('btn-confirm-skin')?.addEventListener('click', () => {
          updateSave((s) => {
            s.gems = Math.max(0, (s.gems || 0) - cost);
            if (!s.ownedItems) s.ownedItems = [];
            if (!s.ownedItems.includes(skin.id)) s.ownedItems.push(skin.id);
            s.equippedSkin = skin.id;
          });
          audioEngine.playCorrect?.();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    shopPanel.querySelectorAll('.btn-toggle-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.dataset.skinId;
        const curEquipped = getSave().equippedSkin || '';
        const willEquip = curEquipped !== skinId;

        updateSave((s) => {
          s.equippedSkin = willEquip ? skinId : '';
        });
        audioEngine.playButtonClick?.();
        onResourcesChanged?.();
        renderShopTab();
      });
    });

    // --- 6. ✨ 영구 특성 강화 ---
    shopPanel.querySelectorAll('.btn-upgrade-perm').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.upKey;
        const cost = Number(btn.dataset.upCost);
        const upDef = PERMANENT_UPGRADES.find((u) => u.key === key);
        if (!upDef) return;

        const save = getSave();
        const curGems = save.gems ?? 0;
        if (curGems < cost) {
          showInsufficientCurrencyModal('💎 보석', `보석이 부족합니다 (필요: ${cost}💎).`);
          return;
        }

        updateSave((s) => {
          s.gems = Math.max(0, (s.gems || 0) - cost);
          if (!s.shopUpgrades) s.shopUpgrades = {};
          s.shopUpgrades[key] = (s.shopUpgrades[key] || 0) + 1;
        });
        audioEngine.playCorrect?.();
        onResourcesChanged?.();
        renderShopTab();
      });
    });
  }

  function showInsufficientCurrencyModal(currLabel, msg) {
    openModal?.(`
      <div class="text-center space-y-3">
        <div class="text-3xl select-none">${currLabel.includes('금화') ? '🪙' : '💎'}</div>
        <h3 class="text-sm font-black text-rose-600">${currLabel}가 부족합니다</h3>
        <p class="text-xs text-[#4a584e] leading-relaxed">${msg}</p>
        <button id="btn-alert-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">확인</button>
      </div>
    `);
    document.getElementById('btn-alert-ok')?.addEventListener('click', () => closeModal?.());
  }

  return {
    renderShopTab,
  };
}
