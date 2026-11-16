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

import { OWNER_WEAPONS } from '../config/balance.js';

export class Owner {
  constructor(player) {
    this.player = player;
    this.x = player ? player.x - 30 : 0;
    this.y = player ? player.y + 10 : 0;
    this.facingAngle = 0;
    this.speed = 100;
    this.walkPhase = 0;

    // 기력 (Stamina: 0~100) — 절대 사망 없음
    this.stamina = 100;
    this.maxStamina = 100;
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
    this.speed = player.speed * 0.9;
    this.walkPhase = 0;

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

    this.stamina = 100;
    this.isSitting = false;
    this.restTimer = 0;
    this.wobble = 0;
    this.shootTimer = 1.2 + Math.random() * 0.5;
  }

  /**
   * 벙커 해치 정답 시 호출: 기력 100% 즉시 완충
   */
  restoreFullStamina() {
    this.stamina = 100;
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
        this.stamina = Math.min(100, this.stamina + dt * 18);
        if (this.restTimer <= 0 && this.stamina >= 50) {
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
      if (this.stamina < 100) {
        this.stamina = Math.min(100, this.stamina + dt * 12);
      }
    }

    // 3. 이동 물리 갱신
    if (!this.isSitting && dist > 5) {
      const stepSpeed = player.speed * baseSpeedRatio * staminaDebuff;
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
    const dmg = Math.round(12 * weaponDef.damageMult);

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
    ctx.save();
    ctx.translate(this.x + this.wobble, this.y);

    // 1. 바닥 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 회복 단계별 인간(Owner) 스프라이트 렌더링
    const s = 1.0;
    const legPhase = Math.sin(this.walkPhase);

    if (this.recoveryStage === 1) {
      // [Stage 1: Ch.1 공항 탈출] 바닥에 주저앉거나 절뚝임 (생존 배낭 + 짝짝이 양말)
      const sitOffset = this.isSitting ? 6 : 0;

      // 생존 배낭 (뒤)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-14 * s, (-10 + sitOffset) * s, 10 * s, 16 * s, 3) : ctx.rect(-14 * s, (-10 + sitOffset) * s, 10 * s, 16 * s);
      ctx.fill();

      // 감염된 창백한 몸통 (환자복/티셔츠)
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, (2 + sitOffset) * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 짝짝이 양말 다리
      ctx.fillStyle = '#10b981'; // 녹색 양말
      ctx.fillRect(-6 * s, (12 + sitOffset) * s, 4 * s, 6 * s);
      ctx.fillStyle = '#f59e0b'; // 노란 줄무늬 양말
      ctx.fillRect(2 * s, (12 + sitOffset + (this.isSitting ? 0 : legPhase * 2)) * s, 4 * s, 6 * s);

      // 머리 & 붕대
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, (-10 + sitOffset) * s, 8.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 이마 붕대
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8 * s, (-13 + sitOffset) * s, 16 * s, 3 * s);

      // 머리카락
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, (-12 + sitOffset) * s, 8.5 * s, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (this.recoveryStage === 2) {
      // [Stage 2: Ch.2 하숙집] 허리를 숙인 구부정한 자세 (하숙집 캐주얼 후드티)
      ctx.fillStyle = '#3b82f6'; // 파란 후드티
      ctx.beginPath();
      ctx.ellipse(0, 3 * s, 10 * s, 11 * s, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // 바지 & 다리
      ctx.fillStyle = '#334155';
      ctx.fillRect(-6 * s, 12 * s, 4.5 * s, 8 * s);
      ctx.fillRect(1.5 * s, (12 + legPhase * 3) * s, 4.5 * s, 8 * s);

      // 머리 (약간 앞으로 숙임)
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(3 * s, -8 * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(3 * s, -10 * s, 8 * s, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (this.recoveryStage === 3) {
      // [Stage 3: Ch.3 대학 캠퍼스] 허리를 펴고 안정적으로 걸음 (캠퍼스 점퍼 + 안경)
      ctx.fillStyle = '#065f46'; // 녹색 캠퍼스 점퍼
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-8 * s, -4 * s, 16 * s, 18 * s, 4) : ctx.rect(-8 * s, -4 * s, 16 * s, 18 * s);
      ctx.fill();

      // 청바지 & 스니커즈
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(-6 * s, 14 * s, 5 * s, 8 * s);
      ctx.fillRect(1 * s, (14 + legPhase * 4) * s, 5 * s, 8 * s);

      // 머리 & 안경
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -11 * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();

      // 갈색 댄디컷
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, -13 * s, 8 * s, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();

      // 안경 👓
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-5 * s, -11 * s, 4 * s, 3 * s);
      ctx.strokeRect(1 * s, -11 * s, 4 * s, 3 * s);
    } else if (this.recoveryStage === 4) {
      // [Stage 4: Ch.4 연구소] 꼿꼿이 서서 나란히 달림 (방역 연구원 롱코트)
      ctx.fillStyle = '#f8fafc'; // 흰색 연구원 코트
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-9 * s, -6 * s, 18 * s, 22 * s, 4) : ctx.rect(-9 * s, -6 * s, 18 * s, 22 * s);
      ctx.fill();
      ctx.stroke();

      // 다리 (조깅 모션)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6 * s, 15 * s, 4.5 * s, 9 * s);
      ctx.fillRect(1.5 * s, (15 + legPhase * 5) * s, 4.5 * s, 9 * s);

      // 머리
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -13 * s, 8.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, -15 * s, 8.5 * s, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
    } else {
      // [Stage 5: Ch.5 종결 & 시즌2] 완전 회복된 건강하고 당당한 인간 영웅
      ctx.fillStyle = '#d97706'; // 영웅의 전술 재킷
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-9 * s, -7 * s, 18 * s, 22 * s, 5) : ctx.rect(-9 * s, -7 * s, 18 * s, 22 * s);
      ctx.fill();

      // 스카프 휘날림
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(0, -6 * s);
      ctx.lineTo(-14 * s, (-3 + Math.sin(time * 8) * 3) * s);
      ctx.lineTo(-12 * s, (3 + Math.sin(time * 8) * 3) * s);
      ctx.fill();

      // 다리
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-6 * s, 15 * s, 5 * s, 10 * s);
      ctx.fillRect(1 * s, (15 + legPhase * 5) * s, 5 * s, 10 * s);

      // 머리
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -14 * s, 8.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(0, -16 * s, 8.5 * s, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();
    }

    // 3. 기력 저하 시 땀방울 이펙트 (💦)
    if (this.stamina < 40) {
      ctx.font = '10px sans-serif';
      ctx.fillText('💦', 8 * s, -18 * s);
    }

    // 4. 주저앉았을 때 "기력 부족" 말풍선
    if (this.isSitting) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-24 * s, -28 * s, 48 * s, 14 * s, 4) : ctx.rect(-24 * s, -28 * s, 48 * s, 14 * s);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('휴식 중... 💤', 0, -18 * s);
    }

    // 5. 컴팩트 미니 기력 바 (Stamina Bar)
    const barW = 26;
    const barH = 3;
    const barY = 22 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    const stamRatio = Math.max(0, Math.min(1, this.stamina / 100));
    ctx.fillStyle = this.stamina < 40 ? '#ef4444' : '#38bdf8';
    ctx.fillRect(-barW / 2, barY, barW * stamRatio, barH);

    ctx.restore();
  }
}
