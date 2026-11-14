/**
 * js/entities/playerEntity.js
 * 인게임 주인공 플레이어 물리/전투 엔티티 클래스
 */

import { BALANCE } from '../config/balance.js';
import { COSTUMES } from '../data/catalog.js';
import { resolveCircleCollisions } from '../game/obstacles.js';
import { getEvolutionStage, computePlayerStats } from './playerStats.js';
import { drawDogCharacter, drawDogSkin } from '../render/dogCharacterDraw.js';

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
    this.isStepping = false;

    this.skills = { bark_sonic: 1 };
    this.evoStage = BALANCE.EVOLUTION_STAGES[0];
    this.equipped = { hat: null, outfit: null, weapon: null, aura: null };
    this._saveRef = null;
    this.isProtectedMode = false;
    this.protectedMinHpRatio = 0.2;
  }

  resetForBattle(centerX, centerY, saveData, { isProtected = false, minHpRatio = 0.2 } = {}) {
    this._saveRef = saveData;
    this.isProtectedMode = Boolean(isProtected);
    this.protectedMinHpRatio = minHpRatio;
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
    this.isStepping = false;

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

  update(dt, inputVec, arenaWidth, arenaHeight, obstacles = [], monoliths = [], forceIdleTrot = false) {
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
      this.isStepping = true;
    } else {
      this.vx = 0;
      this.vy = 0;
      if (forceIdleTrot) {
        this.walkPhase += dt * 12;
        this.isStepping = true;
      } else {
        this.isStepping = false;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    resolveCircleCollisions(this, obstacles);
    resolveCircleCollisions(this, monoliths);

    // 네온 방화벽 경계 클램프 (상단 전광판 높이 감안 topMargin 보정)
    const topMargin = 120;
    const minBoundX = BALANCE.ARENA.FIREWALL_MARGIN + this.radius;
    const minBoundY = BALANCE.ARENA.FIREWALL_MARGIN + this.radius + topMargin;
    const maxBoundX = arenaWidth - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;
    const maxBoundY = arenaHeight - BALANCE.ARENA.FIREWALL_MARGIN - this.radius;

    this.x = Math.max(minBoundX, Math.min(maxBoundX, this.x));
    this.y = Math.max(minBoundY, Math.min(maxBoundY, this.y));

    if (this.isProtectedMode) {
      const minRatio = this.protectedMinHpRatio ?? 0.2;
      const minHp = Math.ceil(this.maxHp * minRatio);
      if (this.hp < minHp) this.hp = minHp;
    }
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return 0;
    const dmg = Math.max(1, Math.round(amount));
    if (this.isProtectedMode) {
      const minRatio = this.protectedMinHpRatio ?? 0.2;
      const minHp = Math.ceil(this.maxHp * minRatio);
      this.hp = Math.max(minHp, this.hp - dmg);
    } else {
      if (this.hp <= 0) return 0;
      this.hp = Math.max(0, this.hp - dmg);
    }
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
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.ultGauge = Math.min(BALANCE.COMBAT.ULT_MAX_GAUGE, Math.round((this.ultGauge + amount) * 10) / 10);
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

    // [레이어 3] 선택된 견종 강아지 본체 + 총총총 발걸음 모션
    const isBipedal = this.evoStage.stage >= 2;
    const bodyY = (isBipedal ? -2 : 2) + bob;
    const lookX = Math.cos(this.facingAngle) * 2.5;
    const legSwing = this.isStepping ? Math.sin(this.walkPhase) : 0;

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2 * s;
    const leftFootY = (14.5 - Math.max(0, legSwing) * 4.2) * s;
    const rightFootY = (14.5 - Math.max(0, -legSwing) * 4.2) * s;
    const leftFootX = (-6.5 + legSwing * 1.8) * s;
    const rightFootX = (6.5 - legSwing * 1.8) * s;
    ctx.beginPath();
    ctx.ellipse(leftFootX, leftFootY, 3.8 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(rightFootX, rightFootY, 3.8 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawDogCharacter(ctx, {
      breedId: this.selectedBreed,
      scale: s,
      bodyY,
      lookX,
      isBipedal,
    });

    // [레이어 4] 장착 무기 파츠 (아이콘/이펙트) 또는 진화 2단계 이상 에너지 블레이드
    const weaponItem = this._getCostumeItem('weapon');
    if (weaponItem) {
      ctx.save();
      ctx.rotate(this.facingAngle);
      ctx.translate(16 * s, 0);
      if (weaponItem.icon) {
        ctx.font = `${Math.round(15 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = weaponItem.color || '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.fillText(weaponItem.icon, 0, 0);
      } else {
        const bladeColor = weaponItem.color || '#22d3ee';
        ctx.fillStyle = bladeColor;
        ctx.shadowColor = bladeColor;
        ctx.shadowBlur = 8;
        ctx.fillRect(-2 * s, -2.5 * s, 16 * s, 5 * s);
      }
      ctx.restore();
    } else if (this.evoStage.stage >= 2) {
      ctx.save();
      ctx.rotate(this.facingAngle);
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
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

    // [레이어 7-B] 캐릭터 발밑 노란색 필살기 충전 게이지 바 (HP Bar 바로 아래)
    const ultBarH = 3.5;
    const ultBarR = 1.8;
    const ultBarY = barY + barH + 2;
    const ultMax = BALANCE.COMBAT.ULT_MAX_GAUGE || 100;
    const ultRatio = Math.max(0, Math.min(1, this.ultGauge / ultMax));
    const ultFillW = Math.max(0, barW * ultRatio);
    const isUltFull = ultRatio >= 1;

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = isUltFull ? 'rgba(250, 204, 21, 0.95)' : 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(barX, ultBarY, barW, ultBarH, ultBarR);
    } else {
      ctx.rect(barX, ultBarY, barW, ultBarH);
    }
    ctx.fill();
    ctx.stroke();

    if (ultFillW > 0) {
      const shimmer = isUltFull ? 0.78 + Math.sin(time * 14) * 0.22 : 1.0;
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = isUltFull ? '#fde047' : '#facc15';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = isUltFull ? 8 : 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(barX, ultBarY, ultFillW, ultBarH, ultBarR);
      } else {
        ctx.rect(barX, ultBarY, ultFillW, ultBarH);
      }
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}
