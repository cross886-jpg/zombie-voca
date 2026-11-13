/**
 * js/entities/enemies.js
 * 일반 좀비 5종 + 챕터 보스(3단 체력 잠금 100%→66%→33%→0% & 광폭화 패턴)
 */

import { BALANCE } from '../config/balance.js';
import { getWaveForQuestion } from '../data/chapters.js';
import { resolveCircleCollisions } from '../game/obstacles.js';

function getQuestionSpeedMult(questionNumber = 1) {
  const c = BALANCE.ENEMIES.SPEED_CURVE;
  const q = Math.max(1, questionNumber);
  const earlyQ = Math.min(q - 1, c.EARLY_END_Q - 1);
  const midQ = Math.max(0, Math.min(q - c.EARLY_END_Q, c.MID_END_Q - c.EARLY_END_Q));
  const lateQ = Math.max(0, q - c.MID_END_Q);
  const mult = 1 + earlyQ * c.EARLY_STEP + midQ * c.MID_STEP + lateQ * c.LATE_STEP;
  return Math.min(c.MAX_MULT, mult);
}

export class EnemyManager {
  constructor() {
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0;
  }

  resetForBattle() {
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0.6;
  }

  spawnInitialWave(chapter, courseEnemyMult, playerX, playerY, arenaWidth, arenaHeight, count = 10) {
    const wave = getWaveForQuestion(chapter, 1);
    for (let i = 0; i < count; i++) {
      const typeKey = wave.types[Math.floor(Math.random() * wave.types.length)];
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const dist = 270 + Math.random() * 120;
      const sx = Math.max(80, Math.min(arenaWidth - 80, playerX + Math.cos(ang) * dist));
      const sy = Math.max(80, Math.min(arenaHeight - 80, playerY + Math.sin(ang) * dist));
      this.spawnEnemy(
        typeKey,
        sx,
        sy,
        chapter.enemyHpMult,
        chapter.enemyAtkMult,
        chapter.enemySpeedMult
      );
    }
  }

  spawnTutorialZombies(playerX, playerY) {
    this.enemies = [];
    const count = BALANCE.TUTORIAL.INITIAL_ZOMBIES;
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count;
      this.spawnEnemy('walker', playerX + Math.cos(ang) * 210, playerY + Math.sin(ang) * 210, 0.7, 0.7, 0.85);
    }
  }

  spawnEnemy(typeKey, x, y, hpMult = 1, atkMult = 1, speedMult = 1) {
    if (this.enemies.length >= BALANCE.ENEMIES.MAX_ACTIVE) return null;
    const base = BALANCE.ENEMIES.TYPES[typeKey] || BALANCE.ENEMIES.TYPES.walker;

    const enemy = {
      id: Math.random().toString(36).slice(2),
      type: typeKey,
      x,
      y,
      hp: Math.round(base.hp * hpMult),
      maxHp: Math.round(base.hp * hpMult),
      speed: base.speed * speedMult,
      damage: Math.round(base.dmg * atkMult),
      radius: base.radius,
      xp: base.xp,
      color: base.color,
      slowTimer: 0,
      hitFlash: 0,
      knockVx: 0,
      knockVy: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnBoss(chapter, courseEnemyMult, centerX, centerY) {
    const bossDef = chapter.boss;
    const maxHp = Math.round(BALANCE.BOSS.BASE_HP * bossDef.hpMult);
    this.boss = {
      isBoss: true,
      name: bossDef.name,
      color: bossDef.color,
      pattern: bossDef.pattern,
      x: centerX,
      y: centerY - 210,
      hp: maxHp,
      maxHp,
      speed: BALANCE.BOSS.BASE_SPEED * chapter.enemySpeedMult,
      damage: Math.round(BALANCE.BOSS.BASE_DMG * chapter.enemyAtkMult),
      radius: BALANCE.BOSS.RADIUS,
      lockStage: 0, // 0: 66% 잠금, 1: 33% 잠금, 2: 0% 잠금, 3: 완전 격파
      enraged: false,
      hitFlash: 0,
      slowTimer: 0,
      knockVx: 0,
      knockVy: 0,
    };
    return this.boss;
  }

  /**
   * 28·29·30번 정답 비석 점령 시 하늘에서 음파 레이저로 보스 3단계 격파
   * @returns {{ defeated: boolean, stage: number }}
   */
  triggerBossSonicLaser() {
    if (!this.boss) return { defeated: false, stage: 0 };

    this.boss.lockStage = Math.min(3, this.boss.lockStage + 1);
    this.boss.hitFlash = 0.45;
    this.boss.enraged = false;

    const targetRatio = BALANCE.BOSS.HP_LOCK_THRESHOLDS[this.boss.lockStage - 1] ?? 0;
    this.boss.hp = Math.round(this.boss.maxHp * targetRatio);

    if (this.boss.lockStage >= 3 || this.boss.hp <= 0) {
      this.boss.hp = 0;
      return { defeated: true, stage: this.boss.lockStage };
    }
    return { defeated: false, stage: this.boss.lockStage };
  }

  enrageBoss() {
    if (!this.boss) return;
    this.boss.enraged = true;
    this.boss.hitFlash = 0.3;
  }

  applyDamageToTarget(target, rawDmg) {
    if (!target || target.hp <= 0) return { killed: false, actualDmg: 0 };
    const dmg = Math.max(1, Math.round(rawDmg));
    target.hitFlash = 0.12;

    if (target.isBoss) {
      const lockFloorRatio = BALANCE.BOSS.HP_LOCK_THRESHOLDS[target.lockStage] ?? 0;
      const minAllowedHp = Math.ceil(target.maxHp * lockFloorRatio);
      const nextHp = Math.max(minAllowedHp, target.hp - dmg);
      const actualDmg = target.hp - nextHp;
      target.hp = nextHp;
      return { killed: false, actualDmg };
    }

    target.hp = Math.max(0, target.hp - dmg);
    return { killed: target.hp <= 0, actualDmg: dmg };
  }

  update(dt, player, chapter, courseEnemyMult, questionNumber, arenaWidth, arenaHeight, isTutorial = false, monoliths = [], obstacles = []) {
    // 웨이브 자동 스폰 (튜토리얼 제외: 8~15마리 밀도 유지 및 최대 1.8초마다 증원)
    if (!isTutorial) {
      const wave = getWaveForQuestion(chapter, questionNumber);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const interval = Math.min(1.8, wave.spawnInterval);
        this.spawnTimer = this.enemies.length < 8 ? Math.min(0.45, interval) : interval;

        const batchCount = this.enemies.length < 8 ? 2 : 1;
        for (let b = 0; b < batchCount; b++) {
          const typeKey = wave.types[Math.floor(Math.random() * wave.types.length)];
          const angle = Math.random() * Math.PI * 2;
          const spawnDist = 310 + Math.random() * 110;
          const sx = Math.max(80, Math.min(arenaWidth - 80, player.x + Math.cos(angle) * spawnDist));
          const sy = Math.max(80, Math.min(arenaHeight - 80, player.y + Math.sin(angle) * spawnDist));

          this.spawnEnemy(
            typeKey,
            sx,
            sy,
            chapter.enemyHpMult,
            chapter.enemyAtkMult,
            chapter.enemySpeedMult * getQuestionSpeedMult(questionNumber)
          );
        }
      }
    }

    // 일반 좀비 업데이트
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = e.speed * (e.slowTimer > 0 ? 0.55 : 1);

      e.x += ((dx / dist) * spd + e.knockVx) * dt;
      e.y += ((dy / dist) * spd + e.knockVy) * dt;
      e.knockVx *= Math.pow(0.05, dt);
      e.knockVy *= Math.pow(0.05, dt);

      // 비석 및 필드 장애물 공통 원형 충돌 해결
      resolveCircleCollisions(e, monoliths);
      resolveCircleCollisions(e, obstacles);

      // 플레이어 접촉 피해
      if (dist < e.radius + player.radius - 2) {
        player.takeDamage(e.damage);
      }
    }

    // 보스 업데이트
    if (this.boss && this.boss.hp > 0) {
      const b = this.boss;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      if (b.slowTimer > 0) b.slowTimer = Math.max(0, b.slowTimer - dt);

      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = b.speed * (b.enraged ? BALANCE.BOSS.ENRAGE_SPEED_MULT : 1) * (b.slowTimer > 0 ? 0.75 : 1);

      b.x += (dx / dist) * spd * dt;
      b.y += (dy / dist) * spd * dt;

      // 보스 벙커 및 장애물 물리 충돌 밀어내기
      resolveCircleCollisions(b, monoliths);
      resolveCircleCollisions(b, obstacles);

      if (dist < b.radius + player.radius - 4) {
        const dmg = b.enraged ? b.damage * BALANCE.BOSS.ENRAGE_DMG_MULT : b.damage;
        player.takeDamage(dmg);
      }
    }
  }

  render(ctx) {
    const enemyScale = BALANCE.ENEMIES.RENDER_SCALE || 1.05;

    // 일반 좀비 렌더링
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(enemyScale, enemyScale);

      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.78, e.radius * 0.9, e.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 몸체
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.slowTimer > 0 ? '#67e8f9' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // 좀비 눈 (반지름에 비례)
      const eyeR = Math.max(1.8, e.radius * 0.16);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.3, -1.5, eyeR, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.3, -1.5, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // 피격 시 미니 체력바 (축소된 몸체에 밀착)
      if (e.hp < e.maxHp) {
        const w = e.radius * 1.8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-w / 2, -e.radius - 7, w, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-w / 2, -e.radius - 7, w * (e.hp / e.maxHp), 3);
      }

      ctx.restore();
    }

    // 보스 렌더링
    if (this.boss && this.boss.hp > 0) {
      const b = this.boss;
      const bossScale = BALANCE.BOSS.RENDER_SCALE || 1.05;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(bossScale, bossScale);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, b.radius * 0.85, b.radius * 1.05, b.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      if (b.enraged) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧟', 0, 1.5);

      ctx.restore();
    }
  }
}

