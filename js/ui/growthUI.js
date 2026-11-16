/**
 * js/ui/growthUI.js
 * 하단 탭의 훈련소(우유·동물 친구 공/방 레벨업),
 * 장비·코스튬 착용(도감 수집 보너스 표시 및 동료 최대 2마리 동행 편성),
 * 상점 뽑기(일반 보급 상자 / 프리미엄 여행 가방) UI 제어
 */

import {
  BALANCE,
  getTrainingUpgradeCost,
  getOwnerTrainingUpgradeCost,
  getOwnerTrainingBonusValue,
  OWNER_WEAPONS,
  DOG_WILD_SKILLS,
} from '../config/balance.js';
import {
  BREEDS,
  COMPANIONS,
  COSTUMES,
  DOG_GEAR,
  getCostumeCollectionBonus,
  isBreedUnlocked,
  isCompanionUnlocked,
} from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave, getAffection, addAffection, MAX_SUPPORTERS } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { computePlayerStats } from '../entities/player.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';
import { getChapterInfo } from '../data/chapters.js';
import settingsStore from '../settingsStore.js';

/**
 * 2.5D 인간 파트너 주인 아바타 캔버스 렌더링 헬퍼 (회복 단계 1~5 연동)
 */
function drawOwnerAvatar(canvas, recoveryStage = 1) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2 + 10);
  const s = 1.6;

  // 바닥 타원 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 14 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (recoveryStage === 1) {
    // 1단계: 절뚝임/붕대/배낭 (공항 탈출)
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-12 * s, -6 * s, 8 * s, 13 * s, 3) : ctx.rect(-12 * s, -6 * s, 8 * s, 13 * s);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.fillRect(-5 * s, 11 * s, 3.5 * s, 5 * s);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(1.5 * s, 11 * s, 3.5 * s, 5 * s);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -6 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7 * s, -9 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, -8 * s, 8 * s, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (recoveryStage === 2) {
    // 2단계: 구부정한 자세 / 캐주얼 후드티 (하숙집)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 9 * s, 11 * s, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.fillRect(-5.5 * s, 12 * s, 4 * s, 7 * s);
    ctx.fillRect(1.5 * s, 12 * s, 4 * s, 7 * s);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(1.5 * s, -8 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(1.5 * s, -10 * s, 8 * s, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (recoveryStage === 3) {
    // 3단계: 점퍼 + 안경 (대학 캠퍼스)
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-8 * s, -4 * s, 16 * s, 16 * s, 4) : ctx.rect(-8 * s, -4 * s, 16 * s, 16 * s);
    ctx.fill();
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(-5.5 * s, 12 * s, 4.5 * s, 8 * s);
    ctx.fillRect(1 * s, 12 * s, 4.5 * s, 8 * s);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -10 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(0, -12 * s, 8 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-5 * s, -10 * s, 4 * s, 3 * s);
    ctx.strokeRect(1 * s, -10 * s, 4 * s, 3 * s);
  } else {
    // 4~5단계: 연구원/방역 코트 (연구소 / 중앙 벙커)
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-9 * s, -5 * s, 18 * s, 18 * s, 4) : ctx.rect(-9 * s, -5 * s, 18 * s, 18 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5.5 * s, 13 * s, 4 * s, 8 * s);
    ctx.fillRect(1.5 * s, 13 * s, 4 * s, 8 * s);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -11 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -13 * s, 8 * s, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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

const OWNER_TRAINING_UI_DEFS = [
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

export function createGrowthUI({ onResourcesChanged, openModal, closeModal } = {}) {
  const gearPanel = document.getElementById('tab-panel-gear');
  const trainingPanel = document.getElementById('tab-panel-training');
  let selectedCompId = COMPANIONS[0]?.id || 'rookie';
  let trainingSubTab = 'hero'; // 'hero' | 'owner' | 'companion'
  let statBoostFlash = { key: null, isLevelUp: false, timer: null };
  let teamSubTab = 'dog'; // 'dog' | 'owner' | 'companion'
  let inventoryFilter = 'all'; // 'all' | 'harness' | 'vest' | 'boots' | 'scarf'
  let selectedWildSkillId = 'bark';

  function renderGearTab() {
    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const dogName = profile.dogName || save.dogName || '우유';
    const ownerName = profile.ownerName || save.ownerName || '민우';
    const stats = computePlayerStats(save);
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

    // 상단 3단 서브탭 바 (반려견 vs 주인 vs 동료 합체)
    const subtabsHtml = `
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-2xl text-xs font-black mb-3 select-none">
        <button id="team-subtab-dog" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'dog' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🐕</span>
          <span>반려견</span>
        </button>
        <button id="team-subtab-owner" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'owner' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🧑</span>
          <span>주인</span>
        </button>
        <button id="team-subtab-companion" type="button" class="py-2.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${teamSubTab === 'companion' ? 'bg-[#2d6a4f] text-white shadow-sm ring-1 ring-emerald-500/40' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          <span>🤝</span>
          <span>동료 합체</span>
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

      // 1. 강아지 대칭 중앙 쇼케이스 박스
      const showcaseHtml = `
        <div id="gear-showcase-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🐾</span>
              <span>${dogName} 장비 쇼케이스</span>
            </span>
            <span class="text-[10px] font-bold text-amber-800">4대 부위 장착</span>
          </div>

          <!-- 3열 대칭 그리드: 좌(하네스·조끼) - 중(강아지 캔버스) - 우(부츠·스카프) -->
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <!-- 좌측 2슬롯 (하네스, 조끼) -->
            <div class="flex flex-col gap-2">
              <div class="p-2 rounded-xl bg-[#f0ebe0] border ${curHarness ? 'border-emerald-600/50 bg-emerald-50/50' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[54px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>🦺 하네스</span>
                  ${curHarness ? '<span class="text-[8.5px] text-emerald-800 font-black">착용</span>' : ''}
                </div>
                <div class="text-xs font-black text-[#1f2d24] truncate mt-0.5">${curHarness ? curHarness.name : '미착용'}</div>
                <div class="text-[9px] text-emerald-800 font-bold">${curHarness ? `+${curHarness.atkBonus}A +${curHarness.hpBonus}H` : '-'}</div>
              </div>

              <div class="p-2 rounded-xl bg-[#f0ebe0] border ${curVest ? 'border-emerald-600/50 bg-emerald-50/50' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[54px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>🛡️ 조끼</span>
                  ${curVest ? '<span class="text-[8.5px] text-emerald-800 font-black">착용</span>' : ''}
                </div>
                <div class="text-xs font-black text-[#1f2d24] truncate mt-0.5">${curVest ? curVest.name : '미착용'}</div>
                <div class="text-[9px] text-emerald-800 font-bold">${curVest ? `+${curVest.atkBonus}A +${curVest.hpBonus}H` : '-'}</div>
              </div>
            </div>

            <!-- 중앙 캐릭터 프리뷰 캔버스 -->
            <div class="relative w-24 h-24 rounded-2xl bg-gradient-to-b from-emerald-100/60 to-emerald-50/20 border-2 border-emerald-600/40 shadow-sm flex items-center justify-center shrink-0">
              <canvas id="gear-showcase-hero-canvas" width="128" height="128" class="w-20 h-20 block"></canvas>
            </div>

            <!-- 우측 2슬롯 (부츠, 스카프) -->
            <div class="flex flex-col gap-2">
              <div class="p-2 rounded-xl bg-[#f0ebe0] border ${curBoots ? 'border-emerald-600/50 bg-emerald-50/50' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[54px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>🥾 부츠</span>
                  ${curBoots ? '<span class="text-[8.5px] text-emerald-800 font-black">착용</span>' : ''}
                </div>
                <div class="text-xs font-black text-[#1f2d24] truncate mt-0.5">${curBoots ? curBoots.name : '미착용'}</div>
                <div class="text-[9px] text-emerald-800 font-bold">${curBoots ? `+${curBoots.atkBonus}A +${curBoots.hpBonus}H` : '-'}</div>
              </div>

              <div class="p-2 rounded-xl bg-[#f0ebe0] border ${curScarf ? 'border-emerald-600/50 bg-emerald-50/50' : 'border-[#d2c8b4]'} flex flex-col justify-center min-h-[54px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>🧣 스카프</span>
                  ${curScarf ? '<span class="text-[8.5px] text-emerald-800 font-black">착용</span>' : ''}
                </div>
                <div class="text-xs font-black text-[#1f2d24] truncate mt-0.5">${curScarf ? curScarf.name : '미착용'}</div>
                <div class="text-[9px] text-emerald-800 font-bold">${curScarf ? `+${curScarf.atkBonus}A +${curScarf.hpBonus}H` : '-'}</div>
              </div>
            </div>
          </div>

          <!-- 하단 장비 합산 및 도감 누적 보너스 -->
          <div class="mt-3 pt-2.5 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
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
        const rarityBorder = item.rarity === 'epic' ? 'border-purple-400' : item.rarity === 'rare' ? 'border-sky-400' : 'border-emerald-600/60';

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
            <div class="text-2xl my-0.5">${item.icon}</div>
            <div class="text-[10px] font-black text-[#1f2d24] truncate">${item.name}</div>
            <div class="text-[8.5px] text-emerald-800 font-bold mt-0.5 leading-tight">+${item.atkBonus}A +${item.hpBonus}H</div>
            ${isOwned ? `
              <button type="button" data-costume-equip="${item.id}" class="costume-equip-btn mt-1 py-1 px-1 rounded-lg ${isEquipped ? 'bg-stone-200 text-[#4a584e] hover:bg-stone-300' : 'bg-[#2d6a4f] text-white hover:bg-[#245840]'} text-[9px] font-black active:scale-95 transition cursor-pointer">
                ${isEquipped ? '벗기' : '착용'}
              </button>
            ` : `
              <div class="mt-1 py-0.5 px-0.5 rounded-lg bg-stone-200 text-stone-500 text-[8px] font-bold truncate">🔒 St.${item.unlockStage}</div>
            `}
          </div>
        `;
      }).join('');

      // 3. 5대 야생 스킬 콤팩트 가로 바 & 툴팁 카드
      const curWildSkill = DOG_WILD_SKILLS.find((s) => s.id === selectedWildSkillId) || DOG_WILD_SKILLS[0];
      const wildSkillsBarHtml = `
        <div class="p-3 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] mb-3 space-y-2">
          <div class="text-xs font-black text-[#1f2d24] flex items-center justify-between">
            <span class="flex items-center gap-1"><span>⚡</span><span>강아지 5대 야생 스킬</span></span>
            <span class="text-[10px] text-emerald-800 font-bold">터치하여 상세 확인</span>
          </div>
          <!-- 가로 5분할 아이콘 바 -->
          <div class="grid grid-cols-5 gap-1.5">
            ${DOG_WILD_SKILLS.map((sk) => {
              const isSelected = selectedWildSkillId === sk.id;
              return `
                <button type="button" data-select-wild-skill="${sk.id}" class="wild-skill-btn py-2 px-1 rounded-xl border flex flex-col items-center justify-center text-center transition active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs'
                    : 'bg-[#f0ebe0] border-[#d2c8b4] hover:bg-[#e6dec8]'
                }">
                  <span class="text-xl">${sk.icon}</span>
                  <span class="text-[9.5px] font-black text-[#1f2d24] mt-1 truncate w-full">${sk.name.split(' ')[0]}</span>
                </button>
              `;
            }).join('')}
          </div>
          <!-- 선택된 스킬 상세 툴팁 카드 -->
          <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center gap-2.5">
            <span class="text-2xl shrink-0">${curWildSkill.icon}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
                <span>${curWildSkill.name}</span>
                <span class="text-[9.5px] text-emerald-800 font-extrabold">위력 x${curWildSkill.baseDamageMult} · 쿨 ${curWildSkill.cooldown}s</span>
              </div>
              <div class="text-[10px] text-[#5c6e60] mt-0.5 leading-snug">${curWildSkill.desc}</div>
            </div>
          </div>
        </div>
      `;

      // 4. 대표 수호견 품종 선택
      const breedsHtml = BREEDS.map((b) => {
        const isCurrent = (save.selectedBreed || 'pomeranian') === b.id;
        const isUnlocked = isBreedUnlocked(b.id, save);
        return `
          <button type="button" data-breed-switch="${b.id}" class="breed-switch-btn p-2 rounded-xl border flex flex-col items-center justify-center text-center transition active:scale-95 cursor-pointer ${
            isCurrent
              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs'
              : isUnlocked
              ? 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f0ebe0]'
              : 'bg-stone-100 border-stone-300 opacity-60'
          }">
            <span class="text-2xl">${b.icon || '🐕'}</span>
            <span class="text-xs font-black text-[#1f2d24] mt-1 truncate w-full">${b.name}</span>
            ${
              isCurrent
                ? '<span class="text-[9px] font-black text-emerald-800 mt-0.5">대표견 ✓</span>'
                : isUnlocked
                ? '<span class="text-[9px] text-[#5c6e60] mt-0.5">선택</span>'
                : `<span class="text-[8px] text-stone-500 mt-0.5 leading-tight">🔒 St.${b.unlockStage || 1} 구조</span>`
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
          <div class="grid grid-cols-4 gap-1.5">
            ${gearItemsHtml}
          </div>
        </div>

        <!-- 3. 5대 야생 스킬 콤팩트 바 -->
        ${wildSkillsBarHtml}

        <!-- 4. 대표 견종 교체 -->
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

      // 1. 주인 중앙 쇼케이스 카드
      const ownerShowcaseHtml = `
        <div id="gear-showcase-owner-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🧑</span>
              <span>${ownerName} 상태 쇼케이스</span>
            </span>
            <span class="text-[10px] font-bold text-emerald-800">📍 거점: ${chInfo.base}</span>
          </div>

          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <!-- 좌측: 회복 단계 및 백신 치료도 -->
            <div class="flex flex-col gap-2">
              <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col justify-center min-h-[64px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>회복 단계</span>
                  <span class="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black">
                    Lv.${ownerState.recoveryStage || 1} / 5
                  </span>
                </div>
                <div class="mt-1.5 space-y-1">
                  <div class="flex justify-between text-[9px] font-bold text-[#4a584e]">
                    <span>백신 치료도</span>
                    <span class="text-emerald-800 font-black">${ownerState.cureProgress || 0}%</span>
                  </div>
                  <div class="w-full h-2 bg-stone-200 rounded-full overflow-hidden border border-[#d2c8b4]">
                    <div class="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-500" style="width: ${ownerState.cureProgress || 0}%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 중앙: 주인 캔버스 프리뷰 -->
            <div class="relative w-24 h-24 rounded-2xl bg-gradient-to-b from-emerald-100/60 to-emerald-50/20 border-2 border-emerald-600/40 shadow-sm flex items-center justify-center shrink-0">
              <canvas id="gear-showcase-owner-canvas" width="128" height="128" class="w-20 h-20 block"></canvas>
            </div>

            <!-- 우측: 장착 지원무기 및 스탯 -->
            <div class="flex flex-col gap-2">
              <div class="p-2.5 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex flex-col justify-center min-h-[64px]">
                <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                  <span>지원 사격</span>
                  <span class="text-[9px] text-emerald-800 font-black">x${equippedWeaponDef.damageMult}</span>
                </div>
                <div class="text-xs font-black text-[#1f2d24] truncate mt-0.5">${equippedWeaponDef.icon} ${equippedWeaponDef.name}</div>
                <div class="text-[9px] text-emerald-800 font-bold mt-0.5">❤️ ${ownerHp} HP · ⚡ 100%</div>
              </div>
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
            <span class="text-[#4a584e]">지원 사격 쿨다운: <b class="text-emerald-800">${equippedWeaponDef.cooldown}초</b></span>
            <span class="text-amber-800">사거리: ${equippedWeaponDef.range}px</span>
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
      // [서브탭 3: 동료 합체 — 브레멘 3단 중앙 쇼케이스 & 구출 동료 목록]
      // ==========================================
      const unlockedCompanionsList = COMPANIONS.filter((c) => (compData.unlocked || []).includes(c.id));

      // 1. 브레멘 합체 중앙 쇼케이스 카드
      const bremenShowcaseHtml = `
        <div id="gear-showcase-bremen-card" class="p-3.5 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
          <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-[#e6dec8] text-xs">
            <span class="font-extrabold text-[#1f2d24] flex items-center gap-1">
              <span>🤝</span>
              <span>브레멘 동물 합체 쇼케이스</span>
            </span>
            <span class="text-[10px] font-bold text-amber-800">동시 2마리 탑승</span>
          </div>

          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <!-- 좌측: 지상 탑승 슬롯 -->
            <div class="p-2.5 rounded-xl ${groundComp ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-[#f0ebe0] border-dashed border-[#d2c8b4]'} border flex flex-col justify-center min-h-[72px]">
              <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                <span>🐎 지상 탑승</span>
                ${groundComp ? `<button type="button" data-comp-ground="clear" class="text-[9px] text-rose-600 font-bold hover:underline cursor-pointer">해제</button>` : ''}
              </div>
              ${groundComp ? `
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-xl">${groundComp.icon}</span>
                  <div class="min-w-0">
                    <div class="text-xs font-black text-[#1f2d24] truncate">${groundComp.name}</div>
                    <div class="text-[8.5px] text-emerald-800 font-bold truncate">${groundComp.buffText || ''}</div>
                  </div>
                </div>
              ` : `
                <div class="text-center py-1">
                  <span class="text-lg opacity-40">🐾</span>
                  <div class="text-[9px] text-[#5c6e60]">미편성 (대형견/말)</div>
                </div>
              `}
            </div>

            <!-- 중앙: 브레멘 합체 진형 프리뷰 박스 -->
            <div class="relative w-24 h-24 rounded-2xl bg-gradient-to-b from-amber-100/60 to-emerald-50/20 border-2 border-emerald-600/40 shadow-sm flex flex-col items-center justify-center p-1 shrink-0">
              <div class="text-[8px] font-black text-amber-800 mb-0.5">3단 합체</div>
              <div class="flex flex-col items-center justify-center -space-y-1">
                <span class="text-base animate-bounce leading-none drop-shadow-xs">${riderComp ? riderComp.icon : '🪶'}</span>
                <span class="text-2xl leading-none drop-shadow-sm">${dogBreedDef?.icon || '🐶'}</span>
                <span class="text-base leading-none drop-shadow-xs">${groundComp ? groundComp.icon : '🐎'}</span>
              </div>
            </div>

            <!-- 우측: 공중/어깨 탑승 슬롯 -->
            <div class="p-2.5 rounded-xl ${riderComp ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-[#f0ebe0] border-dashed border-[#d2c8b4]'} border flex flex-col justify-center min-h-[72px]">
              <div class="flex items-center justify-between text-[10px] font-bold text-[#5c6e60]">
                <span>🦜 공중/어깨</span>
                ${riderComp ? `<button type="button" data-comp-rider="clear" class="text-[9px] text-rose-600 font-bold hover:underline cursor-pointer">해제</button>` : ''}
              </div>
              ${riderComp ? `
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-xl">${riderComp.icon}</span>
                  <div class="min-w-0">
                    <div class="text-xs font-black text-[#1f2d24] truncate">${riderComp.name}</div>
                    <div class="text-[8.5px] text-emerald-800 font-bold truncate">${riderComp.buffText || ''}</div>
                  </div>
                </div>
              ` : `
                <div class="text-center py-1">
                  <span class="text-lg opacity-40">🪶</span>
                  <div class="text-[9px] text-[#5c6e60]">미편성 (소형견/조류)</div>
                </div>
              `}
            </div>
          </div>

          <div class="mt-3 pt-2.5 border-t border-[#e6dec8] flex items-center justify-between text-[10px] font-black">
            <span class="text-[#4a584e] truncate">시너지: <b class="text-emerald-800">${groundComp ? groundComp.buffText : '지상 미편성'} · ${riderComp ? riderComp.buffText : '공중/어깨 미편성'}</b></span>
          </div>
        </div>
      `;

      const companionsGridHtml = unlockedCompanionsList.length > 0 ? unlockedCompanionsList.map((c) => {
        const isGround = activeGroundId === c.id;
        const isRider = activeRiderId === c.id;
        return `
          <div class="p-2 rounded-xl bg-[#f0ebe0] border border-[#d2c8b4] flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${c.icon}</span>
              <div>
                <div class="text-xs font-black text-[#1f2d24]">${c.name}</div>
                <div class="text-[9.5px] text-emerald-800 font-bold">${c.buffText || c.role || ''}</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" data-comp-ground="${c.id}" class="py-1 px-2 rounded-lg ${isGround ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-[#1f2d24]'} text-[10px] font-black active:scale-95 transition cursor-pointer">
                ${isGround ? '지상 해제' : '지상 탑승'}
              </button>
              <button type="button" data-comp-rider="${c.id}" class="py-1 px-2 rounded-lg ${isRider ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-[#1f2d24]'} text-[10px] font-black active:scale-95 transition cursor-pointer">
                ${isRider ? '어깨 해제' : '어깨 탑승'}
              </button>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="p-4 rounded-xl bg-[#f0ebe0] border border-dashed border-[#d2c8b4] text-center text-xs text-[#5c6e60]">
          아직 영입한 브레멘 동료가 없습니다. 스테이지를 돌파하여 동료를 구출하세요!
        </div>
      `;

      gearPanel.innerHTML = `
        ${subtabsHtml}
        ${bremenShowcaseHtml}

        <!-- 2. 구출 동료 목록 -->
        <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] space-y-2">
          <div class="flex items-center justify-between text-xs font-black text-[#1f2d24]">
            <span class="flex items-center gap-1"><span>🐾</span><span>구출한 브레멘 동료 목록</span></span>
            <span class="text-[10px] text-emerald-800 font-bold">전투 동반</span>
          </div>
          <div class="space-y-1.5 pt-1">
            ${companionsGridHtml}
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
      // 캔버스 렌더링
      const heroCanvas = document.getElementById('gear-showcase-hero-canvas');
      if (heroCanvas) {
        renderDogToCanvas(heroCanvas, {
          save,
          breedId: save.selectedBreed || 'pomeranian',
          scale: 1.5,
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

      // 5대 야생 스킬 선택
      gearPanel.querySelectorAll('[data-select-wild-skill]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedWildSkillId = btn.getAttribute('data-select-wild-skill') || 'bark';
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

      // 품종 선택
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
    } else if (teamSubTab === 'owner') {
      // 주인 캔버스 렌더링
      const ownerCanvas = document.getElementById('gear-showcase-owner-canvas');
      if (ownerCanvas) {
        drawOwnerAvatar(ownerCanvas, ownerState.recoveryStage || 1);
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
      // 브레멘 지상 탑승
      gearPanel.querySelectorAll('[data-comp-ground]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-comp-ground');
          compData.activeGround = (cid === 'clear' || compData.activeGround === cid) ? null : cid;
          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [] };
            s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
          });
          settingsStore?.save?.();
          audioEngine.playCorrect?.();
          onResourcesChanged?.();
          renderGearTab();
        });
      });

      // 브레멘 어깨/공중 탑승
      gearPanel.querySelectorAll('[data-comp-rider]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-comp-rider');
          compData.activeRider = (cid === 'clear' || compData.activeRider === cid) ? null : cid;
          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [] };
            s.companions.active = [compData.activeGround, compData.activeRider].filter(Boolean);
          });
          settingsStore?.save?.();
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

    // 주인 생존 훈련 요약 박스
    const ownerStatSummaryHtml = `
      <div id="training-owner-summary-card" class="p-3 rounded-2xl bg-[#faf6ee] shadow-sm border border-[#d2c8b4] mb-3">
        <div class="flex flex-wrap items-center justify-center gap-2 pb-2 mb-2.5 border-b border-[#e6dec8] text-center">
          <span class="text-xs font-black text-[#1f2d24]">주인(${ownerName}) 생존 스탯 요약</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-600/30 text-[10px] font-black">생존 훈련 Lv.${totalOwnerTrainLv}</span>
          <span class="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 border border-teal-600/35 text-[10px] font-black">회복 Lv.${ownerState.recoveryStage || 1}</span>
        </div>

        <div class="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2">
          <!-- 좌측 열: 체력, 이동속도 -->
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

          <!-- 중앙 열: 주인 캔버스 -->
          <div class="relative flex flex-col items-center justify-center px-1">
            <div class="w-20 h-20 rounded-full flex items-center justify-center">
              <canvas id="training-owner-canvas" width="76" height="76" class="w-18 h-18 rounded-full bg-[#faf6ee] border border-emerald-600/40 shadow-sm block"></canvas>
            </div>
          </div>

          <!-- 우측 열: 해독효율, 지원공격력 -->
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

    // 훈련소 3단 서브탭 바
    const subTabHtml = `
      <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#e6dec8] rounded-xl mb-3 text-xs font-bold">
        <button type="button" data-train-subtab="hero" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'hero' ? 'bg-[#faf6ee] text-[#1f2d24] font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          💪 반려견 기초
        </button>
        <button type="button" data-train-subtab="owner" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'owner' ? 'bg-[#faf6ee] text-emerald-900 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🧑 주인 생존 훈련
        </button>
        <button type="button" data-train-subtab="companion" class="py-2 rounded-lg text-center transition-all ${
          trainingSubTab === 'companion' ? 'bg-[#faf6ee] text-amber-800 font-black shadow-sm' : 'text-[#4a584e] hover:text-[#1f2d24]'
        }">
          🐾 동료 강화
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

    // 주인 4대 생존 훈련 카드 (2열 정사각형 그리드)
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

    // 동료 강화 리스트
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
      ${trainingSubTab === 'hero' ? heroStatSummaryHtml : trainingSubTab === 'owner' ? ownerStatSummaryHtml : ''}
      ${subTabHtml}
      ${
        trainingSubTab === 'hero'
          ? `<div class="grid grid-cols-3 gap-2.5">${heroTrainCardsHtml}</div>`
          : trainingSubTab === 'owner'
          ? `<div class="grid grid-cols-2 gap-2.5">${ownerTrainCardsHtml}</div>`
          : `<div class="space-y-2">${compTrainHtml}</div>`
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
        drawOwnerAvatar(ownerCanvas, ownerState.recoveryStage || 1);
      }
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

    // 2. 주인 생존 훈련 레벨업
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
    renderGearTab,
    renderTrainingTab,
  };
}

