/**
 * js/entities/ownerEntity.js
 * 전장에서 강아지를 추종하는 주인(Owner) 엔티티
 *
 * [주요 특징]
 * 1. 외형 및 자세: ownerState.recoveryStage (1~5)와 연동되어
 *    주저앉음/절뚝임 -> 구부정한 자세 -> 당당한 보행/조깅으로 진화
 * 2. 지원 사격: 주인의 좌표에서 돌멩이/새총/총기류 지원 공격 발사
 * 3. 피격 판정: 절대 사망/게임오버 없음!
 *    - Stage 1~2: 좀비가 동족(감염자)으로 인식해 미공격, 내부 기력(stamina) 자연 소모로 주저앉음
 *    - Stage 3~5: 좀비 접촉 시 기력 감소 -> 땀방울/비틀거림 및 일시적 둔화
 *    - 벙커 해치 퀴즈 정답 시 기력 즉시 100% 회복
 */

import { OWNER_WEAPONS, getOwnerTrainingBonusValue } from '../config/balance.js';
import { renderOwnerInBattle } from '../render/ownerRenderer.js';

export class Owner {
  constructor(player) {
    this.player = player;
    this.x = player ? player.x - 30 : 0;
    this.y = player ? player.y + 10 : 0;
    this.facingAngle = 0;
    this.speed = 100;
    this.walkPhase = 0;

    // 기력 (Stamina: 0~100 + 기초 체력 단련 보너스) — 절대 사망 없음
    this.stamina = 100;
    this.maxStamina = 100;
    this.bonusHp = 0;
    this.speedBonusMult = 1.0;
    this.cureEfficiencyMult = 1.0;
    this.supportAtkBonus = 0;
    this.recoveryStage = 1; // 1~5 회복 단계
    this.cureProgress = 0;

    // 지원 사격 타이머 및 무기
    this.shootTimer = 1.0;
    this.equippedWeapon = 'stone'; // 'stone' | 'slingshot' | 'firearm'

    // 상태 플래그
    this.isSitting = false;
    this.restTimer = 0;
    this.wobble = 0;
    this.sweatTimer = 0;
  }

  resetForBattle(player, saveData) {
    this.player = player;
    this.x = player.x - 36;
    this.y = player.y + 12;
    this.facingAngle = player.facingAngle;
    this.walkPhase = 0;

    // 주인 생존 훈련 4종 보너스 반영
    const ownerTraining = saveData?.ownerTraining || {};
    this.bonusHp = getOwnerTrainingBonusValue('hpLv', ownerTraining.hpLv || 0);
    this.speedBonusMult = 1 + getOwnerTrainingBonusValue('speedLv', ownerTraining.speedLv || 0);
    this.cureEfficiencyMult = 1 + getOwnerTrainingBonusValue('cureEfficiencyLv', ownerTraining.cureEfficiencyLv || 0);
    this.supportAtkBonus = getOwnerTrainingBonusValue('supportAtkLv', ownerTraining.supportAtkLv || 0);

    this.maxStamina = 100 + this.bonusHp;
    this.speed = player.speed * 0.9 * this.speedBonusMult;

    // 세이브 데이터로부터 회복 단계 및 진행도 동기화
    const ownerState = saveData?.ownerState || {};
    this.recoveryStage = Math.max(1, Math.min(5, ownerState.recoveryStage || 1));
    this.cureProgress = Math.max(0, Math.min(100, ownerState.cureProgress || 0));

    // 무기 자동 선정 (세이브 장착 무기 우선, 없을 시 회복 단계 연동)
    if (saveData?.equippedOwnerWeapon && OWNER_WEAPONS[saveData.equippedOwnerWeapon]) {
      this.equippedWeapon = saveData.equippedOwnerWeapon;
    } else if (this.recoveryStage >= 5) {
      this.equippedWeapon = 'plasma_rifle';
    } else if (this.recoveryStage === 4) {
      this.equippedWeapon = 'rifle';
    } else if (this.recoveryStage === 3) {
      this.equippedWeapon = 'smg';
    } else if (this.recoveryStage === 2) {
      this.equippedWeapon = 'slingshot';
    } else {
      this.equippedWeapon = 'stone';
    }

    this.stamina = this.maxStamina;
    this.isSitting = false;
    this.restTimer = 0;
    this.wobble = 0;
    this.shootTimer = 1.2 + Math.random() * 0.5;
  }

  /**
   * 벙커 해치 정답 시 호출: 기력 100% 즉시 완충
   */
  restoreFullStamina() {
    this.stamina = this.maxStamina || 100;
    this.isSitting = false;
    this.restTimer = 0;
  }

  update(dt, player, enemies, boss, combatSystem) {
    if (!player) return;

    // 회복 단계별 추종 거리 및 자세 설정
    let followDist = 48;
    let baseSpeedRatio = 0.92;

    if (this.recoveryStage === 1) {
      followDist = 56;
      baseSpeedRatio = 0.65; // Ch.1: 절뚝거리며 느리게 추종
    } else if (this.recoveryStage === 2) {
      followDist = 50;
      baseSpeedRatio = 0.8;
    } else if (this.recoveryStage === 3) {
      followDist = 44;
      baseSpeedRatio = 0.95;
    } else {
      followDist = 38;
      baseSpeedRatio = 1.05; // Ch.4~5: 나란히 조깅
    }

    // 기력 저하에 따른 둔화율 계산
    let staminaDebuff = 1.0;
    if (this.stamina < 40) {
      staminaDebuff = 0.5; // 이동속도 & 지원 사격 50% 둔화
      this.sweatTimer += dt * 5;
      this.wobble = Math.sin(this.sweatTimer * 3) * 2;
    } else {
      this.wobble = 0;
    }

    // 1. 강아지 뒤쪽 목표 위치 산출
    const behindAngle = player.facingAngle + Math.PI;
    const targetX = player.x + Math.cos(behindAngle) * followDist;
    const targetY = player.y + Math.sin(behindAngle) * followDist;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    // 2. 기력 및 휴식/주저앉음 처리
    if (this.recoveryStage <= 2) {
      // Stage 1~2: 좀비 미공격 (감염자로 인식), 대신 기력 자연 소모
      if (!this.isSitting) {
        if (dist > 8) {
          this.stamina = Math.max(0, this.stamina - dt * 2.2);
        }
        if (this.stamina <= 0) {
          this.isSitting = true;
          this.restTimer = 2.5; // 2.5초간 주저앉아 휴식
        }
      }

      if (this.isSitting) {
        this.restTimer -= dt;
        this.stamina = Math.min(this.maxStamina, this.stamina + dt * 18 * (this.cureEfficiencyMult || 1));
        if (this.restTimer <= 0 && this.stamina >= this.maxStamina * 0.5) {
          this.isSitting = false;
        }
      }
    } else {
      // Stage 3~5: 좀비가 인간으로 인식해 접촉 시 기력 감소
      this.isSitting = false;
      for (const e of enemies) {
        if (e.hp > 0 && Math.hypot(e.x - this.x, e.y - this.y) <= e.radius + 14) {
          this.stamina = Math.max(0, this.stamina - dt * 25);
          // 넉백 반사
          const ang = Math.atan2(e.y - this.y, e.x - this.x);
          e.knockVx += Math.cos(ang) * 45;
          e.knockVy += Math.sin(ang) * 45;
        }
      }
      // 안전할 때 자연 기력 회복
      if (this.stamina < this.maxStamina) {
        this.stamina = Math.min(this.maxStamina, this.stamina + dt * 12 * (this.cureEfficiencyMult || 1));
      }
    }

    // 3. 이동 물리 갱신
    if (!this.isSitting && dist > 5) {
      const stepSpeed = player.speed * baseSpeedRatio * (this.speedBonusMult || 1) * staminaDebuff;
      const step = Math.min(dist, stepSpeed * dt);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      this.facingAngle = Math.atan2(dy, dx);
      this.walkPhase += dt * (stepSpeed / 14);
    }

    // 4. 지원 사격 로직 (주인의 위치에서 발사)
    if (!this.isSitting) {
      this.shootTimer -= dt * staminaDebuff;
      if (this.shootTimer <= 0) {
        const weaponDef = OWNER_WEAPONS[this.equippedWeapon] || OWNER_WEAPONS.stone;
        this.shootTimer = weaponDef.cooldown;

        const target = this._findNearestEnemy(enemies, boss, weaponDef.range);
        if (target && combatSystem) {
          this._fireSupportAttack(target, weaponDef, combatSystem);
        }
      }
    }
  }

  _findNearestEnemy(enemies, boss, maxRange) {
    let best = null;
    let bestDist = maxRange;

    if (boss && boss.hp > 0) {
      const d = Math.hypot(boss.x - this.x, boss.y - this.y);
      if (d <= bestDist) {
        best = boss;
        bestDist = d;
      }
    }

    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  _fireSupportAttack(target, weaponDef, combatSystem) {
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    const dmg = Math.round((12 + (this.supportAtkBonus || 0)) * weaponDef.damageMult);

    if (weaponDef.id === 'stone') {
      // 포물선 돌멩이 투척
      combatSystem.spawnProjectile({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * weaponDef.speed,
        vy: Math.sin(angle) * weaponDef.speed,
        damage: dmg,
        radius: weaponDef.radius,
        color: weaponDef.color,
        shape: 'pellet',
        pierce: 0,
        aoeRadius: 28,
        ttl: 0.85,
      });
      combatSystem.spawnDamageText?.(this.x, this.y - 20, '🪨 돌멩이 투척!', '#a8a29e', 0.6);
    } else if (weaponDef.id === 'slingshot') {
      // 새총 고속 구슬
      combatSystem.spawnProjectile({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * weaponDef.speed,
        vy: Math.sin(angle) * weaponDef.speed,
        damage: dmg,
        radius: weaponDef.radius,
        color: weaponDef.color,
        shape: 'pellet',
        pierce: 1,
        aoeRadius: 0,
        ttl: 0.6,
      });
    } else {
      // 총기류 지원 사격
      combatSystem.spawnProjectile({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * weaponDef.speed,
        vy: Math.sin(angle) * weaponDef.speed,
        damage: dmg,
        radius: weaponDef.radius,
        color: weaponDef.color,
        shape: 'bullet',
        pierce: 1,
        aoeRadius: 0,
        ttl: 0.7,
      });
    }
  }

  render(ctx, time) {
    renderOwnerInBattle(ctx, this, time);
  }
}
