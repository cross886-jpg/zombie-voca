/**
 * js/entities/player.js
 * 주인공 화이트 포메라니안 '우유' — 이동, 방화벽 클램프, 4단계 진화, 코스튬 파츠 레이어링 렌더링
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { COSTUMES, SKILLS, getCostumeCollectionBonus } from '../data/catalog.js';
import { resolveCircleCollisions } from '../game/obstacles.js';

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

  const passiveAtkMult = 1 + (skills.passive_sharp_fangs || 0) * (SKILLS.find((s) => s.id === 'passive_sharp_fangs')?.perLevel || 0.14);
  const passiveHpMult = 1 + (skills.passive_thick_fur || 0) * (SKILLS.find((s) => s.id === 'passive_thick_fur')?.perLevel || 0.15);
  const passiveSpeedMult = 1 + (skills.passive_zoomies || 0) * (SKILLS.find((s) => s.id === 'passive_zoomies')?.perLevel || 0.1);
  const passivePickupMult = 1 + (skills.passive_magnet || 0) * (SKILLS.find((s) => s.id === 'passive_magnet')?.perLevel || 0.25);

  const maxHp = Math.round((BALANCE.PLAYER.BASE_HP + trainHp + collectionBonus.hpBonus + shopHp + skinHp) * evoStage.hpMult * passiveHpMult);
  const atk = Math.round((BALANCE.PLAYER.BASE_ATK + trainAtk + collectionBonus.atkBonus + skinAtk) * evoStage.atkMult * passiveAtkMult);
  const speed = BALANCE.PLAYER.BASE_SPEED * (1 + trainSpeedBonus) * passiveSpeedMult;
  const pickupRadius = (BALANCE.PLAYER.PICKUP_RADIUS + trainMagnetBonus + shopMagnet) * passivePickupMult;
  // 인게임 회피 조작감 및 시야 확장을 위한 히트박스 약 18% 축소 (0.82배율)
  const radius = BALANCE.PLAYER.RADIUS * evoStage.scale * 0.82;
  const combatPower = Math.round(atk * 5 + maxHp * 0.8 + speed * 0.5);

  return { maxHp, atk, speed, pickupRadius, radius, evoStage, combatPower };
}

export class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facingAngle = 0;
    this.radius = BALANCE.PLAYER.RADIUS * 0.82;

    this.hp = BALANCE.PLAYER.BASE_HP;
    this.maxHp = BALANCE.PLAYER.BASE_HP;
    this.atk = BALANCE.PLAYER.BASE_ATK;
    this.speed = BALANCE.PLAYER.BASE_SPEED;
    this.pickupRadius = BALANCE.PLAYER.PICKUP_RADIUS;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = BALANCE.PLAYER.LEVEL_UP_BASE_XP;
    this.ultGauge = 0;

    this.invulnTimer = 0;
    this.slowTimer = 0;
    this.walkPhase = 0;

    this.skills = { bark_sonic: 1 };
    this.evoStage = BALANCE.EVOLUTION_STAGES[0];
    this.equipped = { hat: null, outfit: null, weapon: null, aura: null };
    this._saveRef = null;
  }

  resetForBattle(centerX, centerY, saveData) {
    this._saveRef = saveData;
    this.x = centerX;
    this.y = centerY;
    this.vx = 0;
    this.vy = 0;
    this.facingAngle = -Math.PI / 2;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = BALANCE.PLAYER.LEVEL_UP_BASE_XP;
    this.ultGauge = 0;
    this.invulnTimer = 0;
    this.slowTimer = 0;
    this.walkPhase = 0;

    this.skills = { bark_sonic: 1 };
    if ((saveData?.shopUpgrades?.bonusWeapon || 0) >= 1) {
      this.skills.bark_flame = 1;
    }
    if ((saveData?.shopUpgrades?.bonusWeapon || 0) >= 2) {
      this.skills.passive_sharp_fangs = Math.max(1, saveData.shopUpgrades.bonusWeapon - 1);
    }
    this.equippedSkin = saveData?.equippedSkin || null;
    this.selectedBreed = saveData?.selectedBreed || 'pomeranian';
    this.evoStage = getEvolutionStage(saveData);
    this.equipped = { ...(saveData.costumes?.equipped || {}) };

    this.recalcStats(true);
  }

  recalcStats(resetHpToMax = false) {
    const prevMaxHp = this.maxHp;
    const stats = computePlayerStats(this._saveRef, this.skills);
    this.evoStage = stats.evoStage;
    this.maxHp = stats.maxHp;
    this.atk = stats.atk;
    this.speed = stats.speed;
    this.pickupRadius = stats.pickupRadius;
    this.radius = stats.radius;

    if (resetHpToMax) {
      this.hp = this.maxHp;
    } else if (this.maxHp > prevMaxHp) {
      this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - prevMaxHp));
    }
  }

  addSkillLevel(skillId) {
    const current = this.skills[skillId] || 0;
    this.skills[skillId] = current + 1;
    this.recalcStats(false);
  }

  update(dt, inputVec, arenaWidth, arenaHeight, obstacles = []) {
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
    }

    const slowMult = this.slowTimer > 0 ? BALANCE.MONOLITH.WRONG_SLOW_MULT : 1;
    const effectiveSpeed = this.speed * slowMult;

    const mag = Math.hypot(inputVec.x, inputVec.y);
    if (mag > 0.05) {
      const nx = inputVec.x / mag;
      const ny = inputVec.y / mag;
      const clampedMag = Math.min(1, mag);
      this.vx = nx * effectiveSpeed * clampedMag;
      this.vy = ny * effectiveSpeed * clampedMag;
      this.facingAngle = Math.atan2(ny, nx);
      this.walkPhase += dt * 14 * clampedMag;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    resolveCircleCollisions(this, obstacles);

    // 네온 방화벽 경계 클램프 (상단 전광판 높이 감안 topMargin 보정)
    const topMargin = 120;
    const minBoundX = BALANCE.ARENA.FIREWALL_MARGIN + this.radius;
    const minBoundY = BALANCE.ARENA.FIREWALL_MARGIN + this.radius + topMargin;
    const maxBoundX = arenaWidth - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;
    const maxBoundY = arenaHeight - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;

    this.x = Math.max(minBoundX, Math.min(maxBoundX, this.x));
    this.y = Math.max(minBoundY, Math.min(maxBoundY, this.y));
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0 || this.hp <= 0) return 0;
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnTimer = BALANCE.PLAYER.INVULN_DURATION;
    return dmg;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + Math.round(amount));
  }

  applySlowDebuff() {
    this.slowTimer = BALANCE.MONOLITH.WRONG_SLOW_DURATION;
  }

  addUltGauge(amount) {
    this.ultGauge = Math.min(BALANCE.COMBAT.ULT_MAX_GAUGE, this.ultGauge + amount);
  }

  consumeUltGauge() {
    this.ultGauge = 0;
  }

  addRunXp(amount) {
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = BALANCE.PLAYER.LEVEL_UP_BASE_XP + (this.level - 1) * BALANCE.PLAYER.LEVEL_UP_XP_STEP;
      return true;
    }
    return false;
  }

  _getCostumeItem(slot) {
    const id = this.equipped?.[slot];
    return id ? COSTUMES.find((c) => c.id === id) : null;
  }

  render(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 피격 무적 깜빡임
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 18) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // 인게임 전투 화면 캐릭터 크기 약 18% 축소 (0.82 배율)
    const INGAME_CHAR_SCALE = 0.82;
    const s = this.evoStage.scale * (BALANCE.PLAYER.RENDER_SCALE || 1.05) * INGAME_CHAR_SCALE;
    const bob = Math.sin(this.walkPhase) * 2.5;

    // 2.5D 바닥 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 15 * s, 18 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 오답 둔화 디버프 링
    if (this.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    // [대폭발 100% 충전 황금빛 회전 준비 링]
    if (this.ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE) {
      ctx.save();
      const rot = time * 4;
      ctx.rotate(rot);
      ctx.strokeStyle = '#facc15';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12 * s, 6 * s]);
      ctx.beginPath();
      ctx.arc(0, 0, 28 * s, 0, Math.PI * 2);
      ctx.stroke();

      // 바깥 펄스 링
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.arc(0, 0, (32 + Math.sin(time * 8) * 3) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // [레이어 1] 오라 코스튬 또는 슈퍼 가디언 후광
    const auraItem = this._getCostumeItem('aura');
    if (auraItem || this.evoStage.stage >= 3) {
      const auraColor = auraItem ? auraItem.color : '#facc15';
      ctx.save();
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha *= 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, (24 + Math.sin(time * 5) * 2.5) * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // [레이어 2] 의상 코스튬 망토/조끼 (몸통 뒤)
    const outfitItem = this._getCostumeItem('outfit');
    if (outfitItem || this.evoStage.stage >= 3) {
      ctx.fillStyle = outfitItem ? outfitItem.color : '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, (4 + bob * 0.4) * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // [레이어 3] 선택된 견종 강아지 본체
    const isBipedal = this.evoStage.stage >= 2;
    const bodyY = (isBipedal ? -2 : 2) + bob;
    const lookX = Math.cos(this.facingAngle) * 2.5;

    drawDogCharacter(ctx, {
      breedId: this.selectedBreed,
      scale: s,
      bodyY,
      lookX,
      isBipedal,
    });

    // [레이어 4] 진화 2단계 이상 에너지 블레이드 또는 무기 파츠
    const weaponItem = this._getCostumeItem('weapon');
    if (weaponItem || this.evoStage.stage >= 2) {
      const bladeColor = weaponItem ? weaponItem.color : '#22d3ee';
      ctx.save();
      ctx.rotate(this.facingAngle);
      ctx.fillStyle = bladeColor;
      ctx.shadowColor = bladeColor;
      ctx.shadowBlur = 8;
      ctx.fillRect(12 * s, -2.5 * s, 16 * s, 5 * s);
      ctx.restore();
    }

    // [레이어 5] 모자 코스튬 파츠
    const hatItem = this._getCostumeItem('hat');
    if (hatItem) {
      ctx.save();
      if (hatItem.icon) {
        ctx.font = `${Math.round(15 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hatItem.icon, 0, (bodyY - 21) * s);
      } else {
        ctx.fillStyle = hatItem.color || '#38bdf8';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-9 * s, (bodyY - 23) * s, 18 * s, 7 * s, 3 * s);
        } else {
          ctx.rect(-9 * s, (bodyY - 23) * s, 18 * s, 7 * s);
        }
        ctx.fill();
      }
      ctx.restore();
    }

    // [레이어 6] 상점 프리미엄 우유 스킨 시각 효과 (모든 견종 호환)
    if (this.equippedSkin) {
      drawDogSkin(ctx, this.equippedSkin, s, bodyY);
    }

    // [레이어 7] 탕탕특공대 스타일 캐릭터 발밑 컴팩트 미니 체력바 (HP Bar)
    ctx.save();
    ctx.globalAlpha = 1.0; // 캐릭터 피격 깜빡임과 무관하게 상시 선명
    const barW = 40;
    const barH = 5;
    const barR = 2.5;
    const barX = -barW / 2;
    const barY = 16 * s + 7;

    const hpRatio = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    const fillW = Math.max(0, barW * hpRatio);

    // 어두운 반투명 외곽 프레임
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(barX, barY, barW, barH, barR);
    } else {
      ctx.rect(barX, barY, barW, barH);
    }
    ctx.fill();
    ctx.stroke();

    // 체력 상태별 색상 채움 & 위험 시 은은한 점멸
    if (fillW > 0) {
      let barColor = '#10b981'; // 50% 초과: 선명한 민트/초록색
      if (hpRatio <= 0.25) {
        barColor = '#ef4444'; // 25% 이하: 위험 빨간색
        ctx.globalAlpha = 0.6 + Math.sin(time * 12) * 0.4;
      } else if (hpRatio <= 0.5) {
        barColor = '#f59e0b'; // 25% ~ 50%: 주의 노랑/주황색
      }

      ctx.fillStyle = barColor;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = hpRatio <= 0.25 ? 6 : 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(barX, barY, fillW, barH, barR);
      } else {
        ctx.rect(barX, barY, fillW, barH);
      }
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}

/**
 * 5종 강아지 견종 외형 캔버스 렌더러 (포메라니안, 골든 리트리버, 웰시코기, 시바견, 비글)
 */
export function drawDogCharacter(ctx, { breedId = 'pomeranian', scale = 1, bodyY = 0, lookX = 0, isBipedal = false } = {}) {
  const s = scale;

  switch (breedId) {
    case 'retriever': {
      // 골든 리트리버: 풍성한 꿀빛 골드 털, 늘어진 큰 귀, 긴 꼬리
      // 1. 살랑이는 긴 꼬리
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-12 * s, (bodyY + 6) * s);
      ctx.quadraticCurveTo(-22 * s, (bodyY + 1) * s, -18 * s, (bodyY - 7) * s);
      ctx.quadraticCurveTo(-14 * s, (bodyY + 1) * s, -9 * s, (bodyY + 7) * s);
      ctx.fill();

      // 2. 몸통 & 밝은 가슴 털
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 15 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 크림빛 가슴털
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 7) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (따뜻한 골드)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머즐 (주둥이)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 7 * s, 5.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. 양옆으로 늘어진 큰 귀 (Hound/Retriever Floppy Ears)
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 14) * s);
      ctx.bezierCurveTo(-16 * s, (bodyY - 8) * s, -17 * s, (bodyY + 2) * s, -11 * s, (bodyY + 4) * s);
      ctx.bezierCurveTo(-9 * s, (bodyY + 1) * s, -8 * s, (bodyY - 7) * s, -7 * s, (bodyY - 12) * s);
      ctx.moveTo(9 * s, (bodyY - 14) * s);
      ctx.bezierCurveTo(16 * s, (bodyY - 8) * s, 17 * s, (bodyY + 2) * s, 11 * s, (bodyY + 4) * s);
      ctx.bezierCurveTo(9 * s, (bodyY + 1) * s, 8 * s, (bodyY - 7) * s, 7 * s, (bodyY - 12) * s);
      ctx.fill();
      break;
    }

    case 'corgi': {
      // 웰시코기: 황갈색·흰색 투톤, 거대하고 쫑긋한 귀, 둥근 식빵 엉덩이 디테일
      // 1. 둥근 식빵 엉덩이 & 짧은 꼬리
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 6) * s, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(-14 * s, (bodyY + 6) * s, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 (상단 황갈색 + 하단 흰색 투톤)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 11.5 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 흰색 앞가슴/배 털
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 8) * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (황갈색)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 코기 얼굴 흰색 블레이즈 (눈 사이부터 주둥이까지 이어지는 흰 털)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 6) * s, 5.5 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-2 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((2 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((3.5 + lookX) * s, (bodyY - 9) * s);
      ctx.lineTo((-3.5 + lookX) * s, (bodyY - 9) * s);
      ctx.fill();

      // 4. 크고 쫑긋한 세모 귀 (Large rounded triangle ears)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(-11 * s, (bodyY - 14) * s);
      ctx.lineTo(-9 * s, (bodyY - 27) * s);
      ctx.lineTo(-3 * s, (bodyY - 17) * s);
      ctx.moveTo(11 * s, (bodyY - 14) * s);
      ctx.lineTo(9 * s, (bodyY - 27) * s);
      ctx.lineTo(3 * s, (bodyY - 17) * s);
      ctx.fill();

      // 핑크빛 귀 안쪽
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-9.5 * s, (bodyY - 15) * s);
      ctx.lineTo(-8.5 * s, (bodyY - 24) * s);
      ctx.lineTo(-4.5 * s, (bodyY - 17) * s);
      ctx.moveTo(9.5 * s, (bodyY - 15) * s);
      ctx.lineTo(8.5 * s, (bodyY - 24) * s);
      ctx.lineTo(4.5 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'shiba': {
      // 시바견: 황갈색 털, 하얀 볼터치(우라지로), 하얀 눈썹 점, 돌돌 말린 꼬리
      // 1. 돌돌 말린 도넛 꼬리 (Curled tail)
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 2) * s, 6.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 2) * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 & 흰 가슴 (우라지로)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 7) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (황갈색)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 하얀 볼살 패치 (양 볼의 흰 우라지로)
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.ellipse((-6.5 + lookX * 0.5) * s, (bodyY - 5.5) * s, 5 * s, 4.5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse((6.5 + lookX * 0.5) * s, (bodyY - 5.5) * s, 5 * s, 4.5 * s, 0.2, 0, Math.PI * 2);
      ctx.ellipse(lookX * s, (bodyY - 5.5) * s, 4.5 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. 단단하고 쫑긋한 세모 귀
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 24) * s);
      ctx.lineTo(-2.5 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 24) * s);
      ctx.lineTo(2.5 * s, (bodyY - 17) * s);
      ctx.fill();

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-8.5 * s, (bodyY - 16) * s);
      ctx.lineTo(-7 * s, (bodyY - 22) * s);
      ctx.lineTo(-4 * s, (bodyY - 17) * s);
      ctx.moveTo(8.5 * s, (bodyY - 16) * s);
      ctx.lineTo(7 * s, (bodyY - 22) * s);
      ctx.lineTo(4 * s, (bodyY - 17) * s);
      ctx.fill();

      // 5. 시바견의 상징: 하얀 눈썹 점 2개!
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc((-5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.arc((5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'beagle': {
      // 비글: 흰색 바탕에 갈색·검정 삼색 얼룩(Tri-color), 처진 귀, 흰 끝 꼬리
      // 1. 위로 솟은 흰 끝 사냥개 꼬리
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(-11 * s, (bodyY + 6) * s);
      ctx.lineTo(-19 * s, (bodyY - 4) * s);
      ctx.lineTo(-16 * s, (bodyY - 6) * s);
      ctx.lineTo(-8 * s, (bodyY + 6) * s);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-18 * s, (bodyY - 4) * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 (흰색 바탕 + 검은 안장 패치)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 등 부분 블랙 안장 패치 (Black saddle)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(-2 * s, (bodyY + 3) * s, 8.5 * s, 9 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (갈색 + 흰 블레이즈)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 얼굴 중앙 흰색 주둥이 & 블레이즈
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5.5) * s, 5.5 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-1.8 + lookX) * s, (bodyY - 14) * s);
      ctx.lineTo((1.8 + lookX) * s, (bodyY - 14) * s);
      ctx.lineTo((2.5 + lookX) * s, (bodyY - 8) * s);
      ctx.lineTo((-2.5 + lookX) * s, (bodyY - 8) * s);
      ctx.fill();

      // 4. 길게 처진 비글 귀 (Hound floppy ears)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(-16 * s, (bodyY - 7) * s, -17 * s, (bodyY + 1) * s, -11 * s, (bodyY + 3) * s);
      ctx.bezierCurveTo(-9 * s, (bodyY) * s, -8 * s, (bodyY - 6) * s, -7 * s, (bodyY - 11) * s);
      ctx.moveTo(9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(16 * s, (bodyY - 7) * s, 17 * s, (bodyY + 1) * s, 11 * s, (bodyY + 3) * s);
      ctx.bezierCurveTo(9 * s, (bodyY) * s, 8 * s, (bodyY - 6) * s, 7 * s, (bodyY - 11) * s);
      ctx.fill();
      break;
    }

    case 'border_collie': {
      // 보더콜리: 칠흑 같은 블랙 & 화이트 지능형 목양견, 날렵한 귀
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 화이트 가슴 칼라 & 넥카라
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 6) * s, 8 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (블랙)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 얼굴 중앙 흰색 블레이즈 & 주둥이
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 5.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-1.5 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((1.5 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((2 + lookX) * s, (bodyY - 6) * s);
      ctx.lineTo((-2 + lookX) * s, (bodyY - 6) * s);
      ctx.fill();

      // 반쯤 접힌 총명한 세모 귀
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 14) * s);
      ctx.lineTo(-7 * s, (bodyY - 23) * s);
      ctx.lineTo(-3 * s, (bodyY - 16) * s);
      ctx.moveTo(10 * s, (bodyY - 14) * s);
      ctx.lineTo(7 * s, (bodyY - 23) * s);
      ctx.lineTo(3 * s, (bodyY - 16) * s);
      ctx.fill();
      break;
    }

    case 'husky': {
      // 시베리안 허스키: 은회색 & 화이트 마스크, 늑대형 직립 귀
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 6) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (은회색)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 허스키 고유 화이트 마스크 & 눈가 무늬
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.arc((-5 + lookX) * s, (bodyY - 9) * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc((5 + lookX) * s, (bodyY - 9) * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 늑대형 직립 귀
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 25) * s);
      ctx.lineTo(-2 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 25) * s);
      ctx.lineTo(2 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'dalmatian': {
      // 달마시안: 순백색 털에 검정 스팟 점박이 무늬
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 몸통 블랙 점박이들
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4 * s, (bodyY + 2) * s, 2 * s, 0, Math.PI * 2);
      ctx.arc(5 * s, (bodyY + 6) * s, 2.2 * s, 0, Math.PI * 2);
      ctx.arc(-1 * s, (bodyY + 9) * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머리
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머리 점박이
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc((-6 + lookX) * s, (bodyY - 11) * s, 1.8 * s, 0, Math.PI * 2);
      ctx.arc((6 + lookX) * s, (bodyY - 6) * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 점박이 처진 귀
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(-15 * s, (bodyY - 7) * s, -16 * s, (bodyY + 1) * s, -10 * s, (bodyY + 3) * s);
      ctx.moveTo(9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(15 * s, (bodyY - 7) * s, 16 * s, (bodyY + 1) * s, 10 * s, (bodyY + 3) * s);
      ctx.fill();
      break;
    }

    case 'french_bulldog': {
      // 프렌치 불독: 다부진 체구, 둥근 박쥐 모양 큰 귀
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 13 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 머리 (넓적한 사각 라운드)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 7) * s, 13.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 짧은 주둥이 & 머즐
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 4) * s, 6.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 시그니처: 거대한 박쥐 귀 (Bat ears)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(-9 * s, (bodyY - 18) * s, 5 * s, 9 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(9 * s, (bodyY - 18) * s, 5 * s, 9 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.ellipse(-9 * s, (bodyY - 18) * s, 3 * s, 6.5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(9 * s, (bodyY - 18) * s, 3 * s, 6.5 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'doberman': {
      // 도베르만: 날렵한 블랙 & 탄, 날카로운 직립 귀
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 15 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 황갈색(탄) 가슴 무늬
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(-4 * s, (bodyY + 7) * s, 3.5 * s, 5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(4 * s, (bodyY + 7) * s, 3.5 * s, 5 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (블랙)
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 탄 주둥이 & 눈썹 점 2개
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 4.5) * s, 6 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.arc((-4.5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.arc((4.5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();

      // 날렵하고 뾰족한 직립 귀
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 27) * s);
      ctx.lineTo(-3 * s, (bodyY - 17) * s);
      ctx.moveTo(9 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 27) * s);
      ctx.lineTo(3 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'pomeranian':
    default: {
      // 포메라니안: 뽀얀 크림 화이트 솜사탕 털, 쫑긋한 작은 세모 귀, 말린 꼬리
      // 1. 복슬복슬 둥근 꼬리
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 4) * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. 머리 (솜사탕 털)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. 쫑긋한 작은 세모 귀
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 16) * s);
      ctx.lineTo(-6 * s, (bodyY - 24) * s);
      ctx.lineTo(-2 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 16) * s);
      ctx.lineTo(6 * s, (bodyY - 24) * s);
      ctx.lineTo(2 * s, (bodyY - 17) * s);
      ctx.fill();

      // 핑크빛 안쪽 귀
      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.moveTo(-8.5 * s, (bodyY - 17) * s);
      ctx.lineTo(-6 * s, (bodyY - 22) * s);
      ctx.lineTo(-3.5 * s, (bodyY - 18) * s);
      ctx.moveTo(8.5 * s, (bodyY - 17) * s);
      ctx.lineTo(6 * s, (bodyY - 22) * s);
      ctx.lineTo(3.5 * s, (bodyY - 18) * s);
      ctx.fill();
      break;
    }
  }

  // 공통: 초롱초롱한 눈 & 반짝이는 코
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc((-4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
  ctx.arc((4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
  ctx.fill();

  // 눈 하이라이트 (반짝임)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc((-5.2 + lookX) * s, (bodyY - 9.7) * s, 0.7 * s, 0, Math.PI * 2);
  ctx.arc((3.8 + lookX) * s, (bodyY - 9.7) * s, 0.7 * s, 0, Math.PI * 2);
  ctx.fill();

  // 코
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(lookX * s, (bodyY - 5.5) * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 상점 프리미엄 스킨 (황금 왕관, 탐정 모자, 우주 헬멧) 렌더러
 */
export function drawDogSkin(ctx, skinId, scale = 1, bodyY = 0) {
  const s = scale;
  if (skinId === 'skin_crown') {
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-8 * s, (bodyY - 21) * s);
    ctx.lineTo(-6 * s, (bodyY - 30) * s);
    ctx.lineTo(-2 * s, (bodyY - 24) * s);
    ctx.lineTo(0, (bodyY - 32) * s);
    ctx.lineTo(2 * s, (bodyY - 24) * s);
    ctx.lineTo(6 * s, (bodyY - 30) * s);
    ctx.lineTo(8 * s, (bodyY - 21) * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (skinId === 'skin_detective') {
    ctx.save();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-12 * s, (bodyY - 22) * s, 24 * s, 5 * s, 2 * s);
    ctx.roundRect(-8 * s, (bodyY - 28) * s, 16 * s, 8 * s, 3 * s);
    ctx.fill();
    ctx.restore();
  } else if (skinId === 'skin_astronaut') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, (bodyY - 8) * s, 15 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

