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
    cost: 400,
    desc: '셜록의 명추리 모자와 트렌치코트로 단어를 꿰뚫어 봅니다.',
    statText: '공격력 +3 · 최대 체력 +10 (전투력 +35)',
  },
  {
    id: 'skin_astronaut',
    titleSuffix: '우주비행사',
    icon: '🧑‍🚀',
    cost: 750,
    desc: '산소 헬멧과 네온 우주복을 입고 중력을 거슬러 달립니다.',
    statText: '공격력 +5 · 최대 체력 +20 (전투력 +55)',
  },
  {
    id: 'skin_crown',
    titleSuffix: '황금 왕관',
    icon: '👑',
    cost: 1200,
    desc: '영롱하게 빛나는 황실 왕관과 황금빛 후광을 두릅니다.',
    statText: '공격력 +8 · 최대 체력 +30 (전투력 +90)',
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

    // 2. 강아지 전용 스킨 카드 HTML
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
            💎 ${skin.cost.toLocaleString()} 구매
          </button>
        `;
      } else if (isEquipped) {
        actionBtn = `
          <button type="button" data-skin-id="${skin.id}" class="btn-unequip-skin w-full py-2 rounded-xl bg-emerald-700 text-emerald-100 font-extrabold text-xs shadow-sm flex items-center justify-center gap-1 active:scale-95 transition">
            <span>✔ 장착중</span>
            <span class="text-[10px] text-emerald-300">(해제)</span>
          </button>
        `;
      } else {
        actionBtn = `
          <button type="button" data-skin-id="${skin.id}" class="btn-equip-skin w-full py-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245840] text-[#f8f5ec] font-extrabold text-xs shadow-sm active:scale-95 transition">
            장착하기
          </button>
        `;
      }

      return `
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border ${isEquipped ? 'border-emerald-500 ring-2 ring-emerald-400/40' : 'border-[#d2c8b4]'} flex flex-col justify-between space-y-2">
          <div class="flex items-start gap-2.5">
            <div class="w-12 h-12 rounded-xl bg-[#efe9dc] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0 shadow-inner">
              ${skin.icon}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black text-[#1f2d24] truncate">${skinName}</span>
                ${isEquipped ? '<span class="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold">착용</span>' : ''}
              </div>
              <div class="text-[10px] text-[#4a584e] mt-0.5 leading-tight">${skin.desc}</div>
              <div class="text-[10px] font-bold text-emerald-800 mt-1">${skin.statText}</div>
            </div>
          </div>
          ${actionBtn}
        </div>
      `;
    }).join('');

    // 3. 영구 강화 카드 HTML
    const upgradesHtml = PERMANENT_UPGRADES.map((up) => {
      const curLv = upgrades[up.key] || 0;
      const isMax = curLv >= up.maxLevel;
      const nextCost = up.costs[curLv] || 0;
      const canAfford = !isMax && curGems >= nextCost;

      return `
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] flex items-center justify-between gap-3">
          <div class="w-11 h-11 rounded-xl bg-[#efe9dc] border border-[#d2c8b4] flex items-center justify-center text-2xl shrink-0 shadow-inner">
            ${up.icon}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-black text-[#1f2d24]">${up.name}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isMax ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-800'} font-bold">
                ${isMax ? 'MAX' : `Lv.${curLv}/${up.maxLevel}`}
              </span>
            </div>
            <div class="text-[10px] text-[#4a584e] mt-0.5 leading-snug">${up.descPerLv}</div>
          </div>
          <div class="shrink-0">
            ${
              isMax
                ? `<span class="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-800 font-black text-xs border border-amber-500/40">완료</span>`
                : `
                  <button type="button" data-up-key="${up.key}" data-up-cost="${nextCost}" class="btn-upgrade-perm px-3 py-2 rounded-xl ${
                    canAfford
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-sm'
                      : 'bg-[#d2c8b4] text-[#4a584e] opacity-75'
                  } font-extrabold text-xs active:scale-95 transition flex flex-col items-center">
                    <span>강화</span>
                    <span class="text-[9px] text-cyan-200">💎 ${nextCost}</span>
                  </button>
                `
            }
          </div>
        </div>
      `;
    }).join('');

    shopPanel.innerHTML = `
      <!-- 상단 보유 보석 실시간 대시보드 카드 -->
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
        <button id="btn-scroll-to-packages" type="button" class="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-extrabold active:scale-95 transition">
          + 보석 충전
        </button>
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

      <!-- 섹션 2: 강아지 전용 스킨 상점 -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">🐶</span>
            <h3 class="text-xs font-black text-[#1f2d24]">${dogName} 전용 스킨</h3>
          </div>
          <span class="text-[10px] text-emerald-800 font-bold">외형 변경 & 능력치 강화</span>
        </div>
        <div class="space-y-2">
          ${skinsHtml}
        </div>
      </div>

      <!-- 섹션 3: 영구 강화 상점 -->
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">⚡</span>
            <h3 class="text-xs font-black text-[#1f2d24]">영구 능력치 강화</h3>
          </div>
          <span class="text-[10px] text-amber-800 font-bold">전투 시작 시 영구 적용</span>
        </div>
        <div class="space-y-2">
          ${upgradesHtml}
        </div>
      </div>
    `;

    bindShopEvents();
  }

  function bindShopEvents() {
    if (!shopPanel) return;

    // 보석 충전소 이동 버튼
    document.getElementById('btn-scroll-to-packages')?.addEventListener('click', () => {
      document.getElementById('section-gem-packages')?.scrollIntoView({ behavior: 'smooth' });
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

    // 스킨 장착
    shopPanel.querySelectorAll('.btn-equip-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skinId = btn.dataset.skinId;
        updateSave((s) => {
          s.equippedSkin = skinId;
        });
        audioEngine.playButtonClick();
        onResourcesChanged?.();
        renderShopTab();
      });
    });

    // 스킨 해제
    shopPanel.querySelectorAll('.btn-unequip-skin').forEach((btn) => {
      btn.addEventListener('click', () => {
        updateSave((s) => {
          s.equippedSkin = null;
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

