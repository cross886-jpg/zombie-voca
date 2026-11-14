/**
 * js/entities/playerStats.js
 * 우유(주인공) 전투 스탯 단일 계산기 & 진화 단계 산출 모듈
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { SKILLS, getCostumeCollectionBonus } from '../data/catalog.js';

export function getEvolutionStage(target) {
  let stageNum = 1;
  if (target && typeof target === 'object') {
    const selNum = parseInt((target.selectedUnit || '1').replace(/\D/g, ''), 10) || 1;
    stageNum = Math.max(target.maxUnlockedUnit || 1, selNum);
  } else if (typeof target === 'number') {
    stageNum = target;
  }

  let current = BALANCE.EVOLUTION_STAGES[0];
  for (const st of BALANCE.EVOLUTION_STAGES) {
    if (stageNum >= (st.minStage || 1)) {
      current = st;
    }
  }
  return current;
}

/**
 * 세이브 데이터 + 인게임 패시브 스킬 기반 우유 전투 스탯 단일 계산기
 */
export function computePlayerStats(saveData, skills = {}) {
  const safeSave = saveData || { training: { atkLevel: 0, hpLevel: 0 }, costumes: { owned: [] } };
  const evoStage = getEvolutionStage(safeSave);
  const collectionBonus = getCostumeCollectionBonus(safeSave.costumes?.owned || [], safeSave.maxUnlockedUnit || 1);

  const trainAtk = getTrainingBonusValue('atkLevel', safeSave.training?.atkLevel || 0);
  const trainHp = getTrainingBonusValue('hpLevel', safeSave.training?.hpLevel || 0);
  const trainSpeedBonus = getTrainingBonusValue('speedLv', safeSave.training?.speedLv || 0);
  const trainMagnetBonus = getTrainingBonusValue('magnetLv', safeSave.training?.magnetLv || 0);

  const shopHp = (safeSave.shopUpgrades?.bonusHp || 0) * 20;
  const shopMagnet = (safeSave.shopUpgrades?.gemMagnet || 0) * 25;
  const skinAtk = safeSave.equippedSkin === 'skin_crown' ? 8 : (safeSave.equippedSkin === 'skin_astronaut' ? 5 : (safeSave.equippedSkin === 'skin_detective' ? 3 : 0));
  const skinHp = safeSave.equippedSkin === 'skin_crown' ? 30 : (safeSave.equippedSkin === 'skin_astronaut' ? 20 : (safeSave.equippedSkin === 'skin_detective' ? 10 : 0));

  const passiveAtkMult = 1 + (skills.passive_sharp_fangs || 0) * (SKILLS.find((s) => s.id === 'passive_sharp_fangs')?.perLevel || 0.08);
  const passiveHpMult = 1 + (skills.passive_thick_fur || 0) * (SKILLS.find((s) => s.id === 'passive_thick_fur')?.perLevel || 0.08);
  const passiveSpeedMult = 1 + (skills.passive_zoomies || 0) * (SKILLS.find((s) => s.id === 'passive_zoomies')?.perLevel || 0.05);
  const passivePickupMult = 1 + (skills.passive_magnet || 0) * (SKILLS.find((s) => s.id === 'passive_magnet')?.perLevel || 0.15);

  const curBreedId = safeSave.selectedBreed || 'pomeranian';
  const breedHpMult = curBreedId === 'french_bulldog' ? 1.3
    : curBreedId === 'retriever' ? 1.25
    : curBreedId === 'corgi' ? 1.15
    : curBreedId === 'pomeranian' ? 1.05
    : curBreedId === 'beagle' ? 0.85
    : 1.0;
  const breedAtkMult = curBreedId === 'doberman' ? 1.2 : curBreedId === 'shiba' ? 1.1 : 1.0;
  const breedSpeedMult = curBreedId === 'husky' ? 1.2
    : curBreedId === 'beagle' ? (138 / 115)
    : curBreedId === 'pomeranian' ? (125 / 115)
    : curBreedId === 'french_bulldog' ? 1.0
    : 1.0;
  const breedPickupMult = curBreedId === 'beagle' ? 1.15 : curBreedId === 'pomeranian' ? 1.1 : 1.0;

  const maxHp = Math.round((BALANCE.PLAYER.BASE_HP + trainHp + collectionBonus.hpBonus + shopHp + skinHp) * evoStage.hpMult * breedHpMult * passiveHpMult);
  const atk = Math.round((BALANCE.PLAYER.BASE_ATK + trainAtk + collectionBonus.atkBonus + skinAtk) * evoStage.atkMult * breedAtkMult * passiveAtkMult);
  const speed = BALANCE.PLAYER.BASE_SPEED * (1 + trainSpeedBonus) * breedSpeedMult * passiveSpeedMult;
  const pickupRadius = (BALANCE.PLAYER.PICKUP_RADIUS + trainMagnetBonus + shopMagnet) * breedPickupMult * passivePickupMult;
  // 인게임 회피 조작감 및 시야 확장을 위한 히트박스 약 18% 축소 (0.82배율)
  const radius = BALANCE.PLAYER.RADIUS * evoStage.scale * 0.82;
  // 초기 기준 전투력 100 (공격력 10 * 5 + 체력 100 * 0.5) 및 추가 스피드 가산
  const combatPower = Math.round(atk * 5 + maxHp * 0.5 + Math.max(0, speed - BALANCE.PLAYER.BASE_SPEED) * 0.5);

  return { maxHp, atk, speed, pickupRadius, radius, evoStage, combatPower };
}
