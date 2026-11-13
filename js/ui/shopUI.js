/**
 * js/ui/shopUI.js
 * 💎 보석 상점 탭 (보석 충전소 인앱 패키지 3종, 우유 스킨 3종, 영구 강화 3종)
 */

import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';

const IN_APP_PACKAGES = [
  {
    id: 'pkg_starter',
    name: '스타터 주머니',
    icon: '👛',
    gems: 500,
    price: '₩1,500',
    badge: '실속',
    badgeColor: 'bg-emerald-600',
    desc: '처음 시작하는 모험가를 위한 알뜰 보석 주머니',
  },
  {
    id: 'pkg_popular',
    name: '인기 보석 상자',
    icon: '📦',
    gems: 2500,
    price: '₩5,900',
    badge: 'BEST',
    badgeColor: 'bg-amber-500',
    desc: '가장 많은 모험가가 선택한 가성비 패키지 (+25% 보너스)',
  },
  {
    id: 'pkg_royal',
    name: '왕실 보물함',
    icon: '👑',
    gems: 6500,
    price: '₩12,900',
    badge: '최고 혜택',
    badgeColor: 'bg-purple-600',
    desc: '모든 스킨과 영구 강화를 한 번에 해금하는 대용량 (+40% 보너스)',
  },
];

const MILK_SKINS = [
  {
    id: 'skin_detective',
    titleSuffix: '탐정',
    icon: '🕵️',
    cost: 150,
    desc: '셜록의 명추리 모자와 트렌치코트로 단어를 꿰뚫어 봅니다.',
    statText: '공격력 +3 · 체력 +10',
  },
  {
    id: 'skin_astronaut',
    titleSuffix: '우주비행사',
    icon: '🧑‍🚀',
    cost: 300,
    desc: '산소 헬멧과 네온 우주복을 입고 중력을 거슬러 달립니다.',
    statText: '공격력 +5 · 체력 +20',
  },
  {
    id: 'skin_crown',
    titleSuffix: '황금 왕관',
    icon: '👑',
    cost: 500,
    desc: '영롱하게 빛나는 황실 왕관과 황금빛 후광을 두릅니다.',
    statText: '공격력 +8 · 체력 +30',
  },
];

function getSkinName(skin, dogName = '우유') {
  return `${skin.titleSuffix} ${dogName}`;
}

const PERMANENT_UPGRADES = [
  {
    key: 'gemMagnet',
    name: '보석 자석 범위 확장',
    icon: '🧲',
    maxLevel: 5,
    costs: [150, 250, 350, 450, 550],
    descPerLv: '자석 흡수 반경 +25px (전투 시 드롭 아이템 원거리 흡수)',
  },
  {
    key: 'bonusHp',
    name: '시작 최대 체력 +20',
    icon: '💖',
    maxLevel: 5,
    costs: [200, 320, 440, 560, 680],
    descPerLv: '전투 시작 시 기본 최대 체력 +20 HP 영구 추가',
  },
  {
    key: 'bonusWeapon',
    name: '시작 보너스 무기',
    icon: '⚔️',
    maxLevel: 3,
    costs: [350, 600, 850],
    descPerLv: 'Lv.1: 시작 시 불꽃 왈왈 무기 장착, Lv.2+: 기본 공격력 추가 증가',
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
    desc: '훈련소 스탯 강화에 유용한 기본 금화 주머니',
  },
  {
    id: 'exch_gold_large',
    name: '금화 상자',
    icon: '💰',
    type: 'gold',
    amount: 600,
    costGems: 100,
    badge: '+20% 보너스',
    desc: '대량의 훈련과 스탯 급성장을 위한 금화 궤짝',
  },
  {
    id: 'exch_snacks_small',
    name: '뼈다귀 번들',
    icon: '🦴',
    type: 'snacks',
    amount: 2,
    costGems: 40,
    badge: '인기',
    desc: '승급전 추가 도전 및 동료 간식용 뼈다귀',
  },
  {
    id: 'exch_snacks_large',
    name: '특대 뼈다귀 바구니',
    icon: '🍖',
    type: 'snacks',
    amount: 8,
    costGems: 150,
    badge: '대용량',
    desc: '동료 동물 모집과 성장에 넉넉한 대용량 바구니',
  },
];

export function createShopUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const shopPanel = document.getElementById('tab-panel-shop');

  function renderShopTab() {
    if (!shopPanel) return;
    const save = getSave();
    const curGems = save.gems ?? 300;
    const dogName = save.dogName || '우유';
    const ownedItems = new Set(save.ownedItems || []);
    const equippedSkin = save.equippedSkin || null;
    const upgrades = save.shopUpgrades || { gemMagnet: 0, bonusHp: 0, bonusWeapon: 0 };

    // 1. 충전소 패키지 카드 HTML
    const packagesHtml = IN_APP_PACKAGES.map((pkg) => `
      <div class="relative p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col justify-between hover:border-cyan-500/60 transition group">
        <span class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black text-white ${pkg.badgeColor} shadow-xs">${pkg.badge}</span>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-2xl">${pkg.icon}</span>
            <div>
              <div class="text-xs font-black text-[#1f2d24]">${pkg.name}</div>
              <div class="text-sm font-extrabold text-cyan-700 flex items-center gap-1">💎 +${pkg.gems.toLocaleString()}</div>
            </div>
          </div>
          <div class="text-[10px] text-[#4a584e] mt-1.5 leading-snug">${pkg.desc}</div>
        </div>
        <button type="button" data-pkg-id="${pkg.id}" class="btn-charge-pkg mt-2.5 w-full py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-xs active:scale-95 transition">
          ${pkg.price}
        </button>
      </div>
    `).join('');

    // 2. 강아지 전용 스킨 카드 HTML (컴팩트 2열 그리드)
    const skinsHtml = MILK_SKINS.map((skin) => {
      const isOwned = ownedItems.has(skin.id);
      const isEquipped = equippedSkin === skin.id;
      const skinName = getSkinName(skin, dogName);

      let actionBtn = '';
      if (!isOwned) {
        const canAfford = curGems >= skin.cost;
        actionBtn = `
          <button type="button" data-skin-id="${skin.id}" data-skin-cost="${skin.cost}" class="btn-buy-skin w-full py-2 rounded-xl ${
            canAfford
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-sm'
              : 'bg-[#d2c8b4] text-[#4a584e] opacity-75'
          } font-extrabold text-xs active:scale-95 transition">
            💎 ${skin.cost.toLocaleString()}
          </button>
        `;
      } else if (isEquipped) {
        actionBtn = `
          <button type="button" data-skin-id="${skin.id}" class="btn-toggle-skin w-full py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-1 active:scale-95 transition border border-emerald-400/50">
            <span>✔ 장착 중 · 해제</span>
          </button>
        `;
      } else {
        actionBtn = `
          <button type="button" data-skin-id="${skin.id}" class="btn-toggle-skin w-full py-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-extrabold text-xs shadow-sm active:scale-95 transition">
            장착하기
          </button>
        `;
      }

      return `
        <div class="relative p-3 rounded-2xl bg-[#faf6ee] shadow-sm border ${
          isEquipped ? 'border-emerald-500 ring-2 ring-emerald-400/40' : 'border-[#d2c8b4]'
        } flex flex-col justify-between text-center space-y-2">
          ${isEquipped ? '<span class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-600 text-white shadow-xs">착용 중</span>' : ''}
          <div class="flex flex-col items-center">
            <div class="w-12 h-12 rounded-2xl bg-[#efe9dc] border border-[#d2c8b4] flex items-center justify-center text-2xl shadow-inner mt-1">
              ${skin.icon}
            </div>
            <div class="text-xs font-black text-[#1f2d24] mt-2 truncate max-w-full">${skinName}</div>
            <div class="text-[10px] font-bold text-emerald-800 mt-0.5">${skin.statText}</div>
          </div>
          ${actionBtn}
        </div>
      `;
    }).join('');

    // 3. 영구 강화 카드 HTML (3열 컴팩트 정사각형 카드 그리드)
    const upgradesHtml = PERMANENT_UPGRADES.map((up) => {
      const curLv = upgrades[up.key] || 0;
      const isMax = curLv >= up.maxLevel;
      const nextCost = up.costs[curLv] || 0;
      const canAfford = !isMax && curGems >= nextCost;

      return `
        <div class="aspect-square rounded-xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] p-2 flex flex-col items-center justify-between text-center relative select-none">
          <div class="text-2xl mt-0.5 leading-none">${up.icon}</div>
          <div class="w-full min-w-0 px-0.5">
            <div class="text-[11px] font-black text-[#1f2d24] truncate" title="${up.name}">${up.name}</div>
            <div class="mt-0.5">
              <span class="text-[9px] px-1.5 py-0.2 rounded-full ${isMax ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-800'} font-bold">
                ${isMax ? 'MAX' : `Lv.${curLv}/${up.maxLevel}`}
              </span>
            </div>
          </div>
          <div class="w-full">
            ${
              isMax
                ? `<span class="block w-full py-1 rounded-lg bg-amber-500/20 text-amber-800 font-black text-[10px] border border-amber-500/40 text-center">완료</span>`
                : `
                  <button type="button" data-up-key="${up.key}" data-up-cost="${nextCost}" class="btn-upgrade-perm w-full py-1 rounded-lg ${
                    canAfford
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-xs'
                      : 'bg-[#d2c8b4] text-[#4a584e] opacity-75'
                  } font-extrabold text-[10px] active:scale-95 transition flex items-center justify-center gap-1">
                    <span>강화</span>
                    <span class="text-[9px] text-cyan-200">💎${nextCost}</span>
                  </button>
                `
            }
          </div>
        </div>
      `;
    }).join('');

    // 4. 보석 재화 교환소 카드 HTML
    const exchangeHtml = CURRENCY_EXCHANGE_ITEMS.map((item) => {
      const rewardText = item.type === 'gold'
        ? `🪙 +${item.amount.toLocaleString()}`
        : `🦴 +${item.amount.toLocaleString()}`;
      const rewardColor = item.type === 'gold' ? 'text-amber-700' : 'text-amber-900';

      return `
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex flex-col justify-between space-y-2 hover:border-emerald-500/60 transition">
          <div>
            <div class="flex items-start justify-between gap-1.5">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${item.icon}</span>
                <div>
                  <div class="text-xs font-black text-[#1f2d24]">${item.name}</div>
                  <div class="text-sm font-black ${rewardColor}">${rewardText}</div>
                </div>
              </div>
              <span class="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-[#efe9dc] text-[#4a584e] border border-[#d2c8b4] shrink-0">${item.badge}</span>
            </div>
            <div class="text-[10px] text-[#4a584e] mt-2 leading-snug">${item.desc}</div>
          </div>
          <button type="button" data-exch-id="${item.id}" class="btn-exchange-currency w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1">
            <span>💎 ${item.costGems} 교환</span>
          </button>
        </div>
      `;
    }).join('');

    shopPanel.innerHTML = `
      <!-- 상단 보유 보석 실시간 대시보드 카드 (단일화) -->
      <div class="p-4 rounded-2xl bg-gradient-to-r from-[#142c20] via-[#1b3b2b] to-[#12281d] text-white shadow-[0_4px_16px_rgba(20,44,32,0.4)] border border-emerald-600/40 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(34,211,238,0.35)]">
            💎
          </div>
          <div>
            <div class="text-[11px] font-bold text-emerald-300">내 보유 보석</div>
            <div class="text-2xl font-black text-cyan-300 tracking-tight drop-shadow-md">
              <span id="shop-current-gems">${curGems.toLocaleString()}</span> <span class="text-xs font-bold text-cyan-200">GEMS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 섹션 1: 보석 충전소 (인앱 결제 패키지) -->
      <div id="section-gem-packages" class="space-y-2 pt-1">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">💎</span>
            <h3 class="text-xs font-black text-[#1f2d24]">보석 충전소</h3>
          </div>
          <span class="text-[10px] text-[#4a584e] font-semibold">클릭 시 즉시 충전 (테스트)</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          ${packagesHtml}
        </div>
      </div>

      <!-- 섹션 2: 보석 재화 교환소 -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">🔄</span>
            <h3 class="text-xs font-black text-[#1f2d24]">보석 재화 교환소</h3>
          </div>
          <span class="text-[10px] text-emerald-800 font-bold">금화 🪙 & 뼈다귀 🦴 교환</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${exchangeHtml}
        </div>
      </div>

      <!-- 섹션 3: 강아지 전용 스킨 상점 (2열 컴팩트 카드) -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">🐶</span>
            <h3 class="text-xs font-black text-[#1f2d24]">${dogName} 전용 스킨</h3>
          </div>
          <span class="text-[10px] text-emerald-800 font-bold">외형 변경 & 능력치 강화</span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          ${skinsHtml}
        </div>
      </div>

      <!-- 섹션 4: 영구 강화 상점 -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">⚡</span>
            <h3 class="text-xs font-black text-[#1f2d24]">영구 능력치 강화</h3>
          </div>
          <span class="text-[10px] text-amber-800 font-bold">전투 시작 시 영구 적용</span>
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

    // 보석 재화 교환소 (금화 🪙 & 뼈다귀 🦴)
    shopPanel.querySelectorAll('.btn-exchange-currency').forEach((btn) => {
      btn.addEventListener('click', () => {
        const exchId = btn.dataset.exchId;
        const item = CURRENCY_EXCHANGE_ITEMS.find((i) => i.id === exchId);
        if (!item) return;

        const save = getSave();
        const curGems = save.gems ?? 300;
        if (curGems < item.costGems) {
          openModal?.(`
            <div class="text-center space-y-3">
              <div class="text-3xl">💎</div>
              <h3 class="text-sm font-black text-rose-600">보석이 부족합니다</h3>
              <p class="text-xs text-[#4a584e]">보석 ${item.costGems - curGems}개가 더 필요해요.<br/>보석 충전소에서 충전 후 다시 시도해 주세요.</p>
              <button id="btn-alert-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">확인</button>
            </div>
          `);
          document.getElementById('btn-alert-ok')?.addEventListener('click', () => closeModal?.());
          return;
        }

        const rewardDesc = item.type === 'gold' ? `🪙 금화 +${item.amount.toLocaleString()}개` : `🦴 뼈다귀 +${item.amount.toLocaleString()}개`;
        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl">${item.icon}</div>
            <h3 class="text-base font-black text-emerald-800">${item.name} 교환</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              보석 <strong class="text-cyan-700">💎 ${item.costGems}개</strong>를 사용하여<br/>
              <strong>${rewardDesc}</strong>(으)로 교환하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-exch" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">취소</button>
              <button id="btn-confirm-exch" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">교환하기</button>
            </div>
          </div>
        `);

        document.getElementById('btn-cancel-exch')?.addEventListener('click', () => closeModal?.());
        document.getElementById('btn-confirm-exch')?.addEventListener('click', () => {
          updateSave((s) => {
            s.gems = Math.max(0, (s.gems || 0) - item.costGems);
            if (item.type === 'gold') {
              s.gold = (s.gold || 0) + item.amount;
            } else if (item.type === 'snacks') {
              s.snacks = (s.snacks || 0) + item.amount;
            }
          });
          audioEngine.playCorrect();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    // 충전 패키지 구매
    shopPanel.querySelectorAll('.btn-charge-pkg').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pkgId = btn.dataset.pkgId;
        const pkg = IN_APP_PACKAGES.find((p) => p.id === pkgId);
        if (!pkg) return;

        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl">${pkg.icon}</div>
            <h3 class="text-base font-black text-emerald-800">${pkg.name} 충전</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              <strong>${pkg.price}</strong> 결제를 진행하여<br/>
              <strong class="text-cyan-700">💎 보석 ${pkg.gems.toLocaleString()}개</strong>를 충전하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-pkg" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">
                취소
              </button>
              <button id="btn-confirm-pkg" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-700 text-white font-black text-xs shadow-md active:scale-95 transition">
                충전하기
              </button>
            </div>
          </div>
        `);

        document.getElementById('btn-cancel-pkg')?.addEventListener('click', () => closeModal?.());
        document.getElementById('btn-confirm-pkg')?.addEventListener('click', () => {
          updateSave((s) => {
            s.gems = (s.gems || 0) + pkg.gems;
          });
          audioEngine.playCorrect();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    // 스킨 구매
    shopPanel.querySelectorAll('.btn-buy-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.dataset.skinId;
        const cost = Number(btn.dataset.skinCost);
        const skin = MILK_SKINS.find((s) => s.id === skinId);
        if (!skin) return;

        const save = getSave();
        const curGems = save.gems ?? 300;
        if (curGems < cost) {
          openModal?.(`
            <div class="text-center space-y-3">
              <div class="text-3xl">💎</div>
              <h3 class="text-sm font-black text-rose-600">보석이 부족합니다</h3>
              <p class="text-xs text-[#4a584e]">보석 ${cost - curGems}개가 더 필요해요.<br/>보석 충전소에서 충전 후 다시 시도해 주세요.</p>
              <button id="btn-alert-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">확인</button>
            </div>
          `);
          document.getElementById('btn-alert-ok')?.addEventListener('click', () => closeModal?.());
          return;
        }

        const skinName = getSkinName(skin, save.dogName || '우유');
        openModal?.(`
          <div class="text-center space-y-3.5">
            <div class="text-4xl">${skin.icon}</div>
            <h3 class="text-base font-black text-emerald-800">${skinName} 구매</h3>
            <p class="text-xs text-[#4a584e] leading-relaxed">
              보석 <strong class="text-cyan-700">💎 ${cost.toLocaleString()}개</strong>를 소모하여<br/>
              <strong>[${skinName}]</strong>을 구매하고 즉시 장착하시겠습니까?
            </p>
            <div class="flex gap-2 pt-1">
              <button id="btn-cancel-skin" type="button" class="flex-1 py-2.5 rounded-xl bg-[#e6dec8] hover:bg-[#dcd3bd] text-[#1f2d24] font-bold text-xs active:scale-95 transition">취소</button>
              <button id="btn-confirm-skin" type="button" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black text-xs shadow-md active:scale-95 transition">구매 및 장착</button>
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
          audioEngine.playCorrect();
          closeModal?.();
          onResourcesChanged?.();
          renderShopTab();
        });
      });
    });

    // 보유 스킨 장착/해제 단일 토글
    shopPanel.querySelectorAll('.btn-toggle-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.dataset.skinId;
        const curEquipped = getSave().equippedSkin || '';
        const willEquip = curEquipped !== skinId;

        updateSave((s) => {
          s.equippedSkin = willEquip ? skinId : '';
        });
        audioEngine.playButtonClick();
        onResourcesChanged?.();
        renderShopTab();
      });
    });

    // 영구 능력치 강화
    shopPanel.querySelectorAll('.btn-upgrade-perm').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.upKey;
        const cost = Number(btn.dataset.upCost);
        const upDef = PERMANENT_UPGRADES.find((u) => u.key === key);
        if (!upDef) return;

        const save = getSave();
        const curGems = save.gems ?? 300;
        if (curGems < cost) {
          openModal?.(`
            <div class="text-center space-y-3">
              <div class="text-3xl">💎</div>
              <h3 class="text-sm font-black text-rose-600">보석이 부족합니다</h3>
              <p class="text-xs text-[#4a584e]">보석 ${cost - curGems}개가 더 필요해요.<br/>보석 충전소에서 충전 후 강화해 주세요.</p>
              <button id="btn-alert-ok" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-bold text-xs active:scale-95 transition">확인</button>
            </div>
          `);
          document.getElementById('btn-alert-ok')?.addEventListener('click', () => closeModal?.());
          return;
        }

        updateSave((s) => {
          s.gems = Math.max(0, (s.gems || 0) - cost);
          if (!s.shopUpgrades) s.shopUpgrades = {};
          s.shopUpgrades[key] = (s.shopUpgrades[key] || 0) + 1;
        });
        audioEngine.playCorrect();
        onResourcesChanged?.();
        renderShopTab();
      });
    });
  }

  return {
    renderShopTab,
  };
}

