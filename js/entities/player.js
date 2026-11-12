/**
 * js/entities/player.js
 * 주인공 화이트 포메라니안 '우유' — 이동, 방화벽 클램프, 4단계 진화, 코스튬 파츠 레이어링 렌더링
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { COSTUMES, SKILLS, getCostumeCollectionBonus } from '../data/catalog.js';
import { resolveCircleCollisions } from '../game/obstacles.js';

export function getEvolutionStage(evoXp) {
  let current = BALANCE.EVOLUTION_STAGES[0];
  for (const st of BALANCE.EVOLUTION_STAGES) {
    if (evoXp >= st.minXp) {
      current = st;
    }
  }
  return current;
}

export class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facingAngle = 0;
    this.radius = BALANCE.PLAYER.RADIUS;

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
    this.evoStage = getEvolutionStage(saveData.evoXp || 0);
    this.equipped = { ...(saveData.costumes?.equipped || {}) };

    this.recalcStats(true);
  }

  recalcStats(resetHpToMax = false) {
    const saveData = this._saveRef || { training: { atkLevel: 0, hpLevel: 0 }, costumes: { owned: [] } };
    const collectionBonus = getCostumeCollectionBonus(saveData.costumes?.owned || []);

    const trainAtk = getTrainingBonusValue('atkLevel', saveData.training?.atkLevel || 0);
    const trainHp = getTrainingBonusValue('hpLevel', saveData.training?.hpLevel || 0);
    const trainSpeedBonus = getTrainingBonusValue('speedLv', saveData.training?.speedLv || 0);
    const trainMagnetBonus = getTrainingBonusValue('magnetLv', saveData.training?.magnetLv || 0);

    const passiveAtkMult = 1 + (this.skills.passive_sharp_fangs || 0) * (SKILLS.find((s) => s.id === 'passive_sharp_fangs')?.perLevel || 0.14);
    const passiveHpMult = 1 + (this.skills.passive_thick_fur || 0) * (SKILLS.find((s) => s.id === 'passive_thick_fur')?.perLevel || 0.15);
    const passiveSpeedMult = 1 + (this.skills.passive_zoomies || 0) * (SKILLS.find((s) => s.id === 'passive_zoomies')?.perLevel || 0.1);
    const passivePickupMult = 1 + (this.skills.passive_magnet || 0) * (SKILLS.find((s) => s.id === 'passive_magnet')?.perLevel || 0.25);

    const prevMaxHp = this.maxHp;
    this.maxHp = Math.round((BALANCE.PLAYER.BASE_HP + trainHp + collectionBonus.hpBonus) * this.evoStage.hpMult * passiveHpMult);
    this.atk = Math.round((BALANCE.PLAYER.BASE_ATK + trainAtk + collectionBonus.atkBonus) * this.evoStage.atkMult * passiveAtkMult);
    this.speed = BALANCE.PLAYER.BASE_SPEED * (1 + trainSpeedBonus) * passiveSpeedMult;
    this.pickupRadius = (BALANCE.PLAYER.PICKUP_RADIUS + trainMagnetBonus) * passivePickupMult;
    this.radius = BALANCE.PLAYER.RADIUS * this.evoStage.scale;

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

    // 네온 방화벽 경계 클램프
    const minBound = BALANCE.ARENA.FIREWALL_MARGIN + this.radius;
    const maxBoundX = arenaWidth - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;
    const maxBoundY = arenaHeight - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;

    this.x = Math.max(minBound, Math.min(maxBoundX, this.x));
    this.y = Math.max(minBound, Math.min(maxBoundY, this.y));
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

    const s = this.evoStage.scale * 1.4;
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

    // [레이어 3] 화이트 포메라니안 '우유' 본체 (진화 단계별 실루엣)
    const isBipedal = this.evoStage.stage >= 1;
    const bodyY = (isBipedal ? -2 : 2) + bob;

    // 복슬복슬 꼬리
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(-13 * s, (bodyY + 4) * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();

    // 몸통 (4족 -> 2족 직립)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (isBipedal) {
      ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // 머리 (포메라니안 둥근 털)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
    ctx.fill();

    // 뾰족한 귀 2개
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-10 * s, (bodyY - 16) * s);
    ctx.lineTo(-6 * s, (bodyY - 24) * s);
    ctx.lineTo(-2 * s, (bodyY - 17) * s);
    ctx.moveTo(10 * s, (bodyY - 16) * s);
    ctx.lineTo(6 * s, (bodyY - 24) * s);
    ctx.lineTo(2 * s, (bodyY - 17) * s);
    ctx.fill();

    // 눈 & 코
    const lookX = Math.cos(this.facingAngle) * 2.5;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc((-4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
    ctx.arc((4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(lookX * s, (bodyY - 5.5) * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();

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
      ctx.fillStyle = hatItem.color;
      ctx.beginPath();
      ctx.roundRect(-9 * s, (bodyY - 23) * s, 18 * s, 7 * s, 3 * s);
      ctx.fill();
    }

    ctx.restore();
  }
}

