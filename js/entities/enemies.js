/**
 * js/entities/enemies.js
 * PvZ 스타일 좀비 15종 및 10개 챕터 군단장 보스 관리자
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
    this.explosions = []; // 폭탄 좀비 자폭/폭발 시각 효과
  }

  resetForBattle() {
    this.enemies = [];
    this.boss = null;
    this.spawnTimer = 0.6;
    this.explosions = [];
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
      // PvZ 15종 고유 속성
      raged: false,
      hasVaulted: false,
      isVaulting: false,
      vaultTimer: 0,
      shieldHp: typeKey === 'screendoor' ? Math.round(base.hp * hpMult * 0.6) : 0,
      maxShieldHp: typeKey === 'screendoor' ? Math.round(base.hp * hpMult * 0.6) : 0,
      isIgnited: false,
      fuseTimer: 0,
      summonTimer: typeKey === 'dancer' ? 5.0 + Math.random() * 2 : 0,
      isBurrowed: typeKey === 'miner',
      burrowTimer: typeKey === 'miner' ? 2.0 + Math.random() : 0,
      phaseTimer: typeKey === 'ghost' ? Math.random() * 3.5 : 0,
      isPhased: false,
      hasBalloon: typeKey === 'balloon',
      hasImp: typeKey === 'gargantuar',
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnBoss(chapter, courseEnemyMult, centerX, centerY) {
    const bossDef = chapter.boss;
    const maxHp = Math.round(BALANCE.BOSS.BASE_HP * bossDef.hpMult);
    this.boss = {
      isBoss: true,
      id: bossDef.id,
      name: bossDef.name,
      color: bossDef.color,
      pattern: bossDef.pattern,
      role: bossDef.role || 'guard',
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
      specialTimer: 4.5,
      chargeTimer: 0,
      chargeVx: 0,
      chargeVy: 0,
    };
    return this.boss;
  }

  /**
   * 28·29·30번 정답 비석 점령 시 하늘에서 음파 레이저로 보스 고정 비율(약 33%) 체력 차감 및 최종 격파
   * 철칙: 보스는 오직 이 메서드를 통해서만 체력이 깎이고 격파됨!
   */
  triggerBossSonicLaser() {
    if (!this.boss) return { defeated: false, stage: 0, dealtDmg: 0 };

    this.boss.lockStage = Math.min(3, this.boss.lockStage + 1);
    this.boss.hitFlash = 0.55;
    this.boss.enraged = false;

    const targetRatio = BALANCE.BOSS.HP_LOCK_THRESHOLDS[this.boss.lockStage - 1] ?? 0;
    const oldHp = this.boss.hp;
    this.boss.hp = Math.round(this.boss.maxHp * targetRatio);
    const dealtDmg = Math.max(1, oldHp - this.boss.hp);

    if (this.boss.lockStage >= 3 || this.boss.hp <= 0) {
      this.boss.hp = 0;
      return { defeated: true, stage: this.boss.lockStage, dealtDmg };
    }
    return { defeated: false, stage: this.boss.lockStage, dealtDmg };
  }

  enrageBoss() {
    if (!this.boss) return;
    this.boss.enraged = true;
    this.boss.hitFlash = 0.3;
  }

  applyDamageToTarget(target, rawDmg, player = null) {
    if (!target || target.hp <= 0) return { killed: false, actualDmg: 0 };
    let dmg = Math.max(1, Math.round(rawDmg));
    target.hitFlash = 0.12;

    if (target.isBoss) {
      // 일반 총알/스킬 투사체는 보스 HP를 깎거나 죽이지 못함 (보스는 오직 단어 정답 음파 레이저로만 체력 차감)
      // 피격 경직 및 플래시만 유발
      target.hitFlash = 0.16;
      return { killed: false, actualDmg: 0 };
    }

    // 유령 좀비 위상 회피
    if (target.type === 'ghost' && target.isPhased) {
      if (Math.random() < 0.75) {
        return { killed: false, actualDmg: 0 };
      }
    }

    // 철망 방패 좀비 피해 흡수
    if (target.type === 'screendoor' && target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, Math.round(dmg * 0.65));
      target.shieldHp -= absorbed;
      dmg = Math.max(1, dmg - absorbed);
    }

    // 풍선 좀비 풍선 터짐
    if (target.type === 'balloon' && target.hasBalloon) {
      if (target.hp - dmg <= target.maxHp * 0.6) {
        target.hasBalloon = false;
      }
    }

    target.hp = Math.max(0, target.hp - dmg);

    // 신문지 좀비 분노 광폭화
    if (target.type === 'newspaper' && target.hp <= target.maxHp * 0.5 && !target.raged) {
      target.raged = true;
      target.speed *= 2.2;
      target.hitFlash = 0.3;
    }

    // 가르강튀아 꼬마 좀비(임프) 투척
    if (target.type === 'gargantuar' && target.hp <= target.maxHp * 0.5 && target.hasImp) {
      target.hasImp = false;
      this.spawnEnemy('runner', target.x, target.y, 0.7, 0.85, 1.25);
    }

    // 폭탄 좀비 처치 시 연쇄 폭발
    if (target.type === 'bomber' && target.hp <= 0) {
      this.triggerBomberExplosion(target, player);
    }

    return { killed: target.hp <= 0, actualDmg: dmg };
  }

  triggerBomberExplosion(bomber, player = null) {
    this.explosions.push({
      x: bomber.x,
      y: bomber.y,
      radius: 65,
      life: 0.35,
      maxLife: 0.35,
    });

    // 주변 좀비 피해 (연쇄 폭발)
    for (const other of this.enemies) {
      if (other !== bomber && other.hp > 0) {
        const d = Math.hypot(other.x - bomber.x, other.y - bomber.y);
        if (d <= 65 + other.radius) {
          other.hp = Math.max(0, other.hp - 45);
          other.hitFlash = 0.2;
          const ang = Math.atan2(other.y - bomber.y, other.x - bomber.x);
          other.knockVx = Math.cos(ang) * 160;
          other.knockVy = Math.sin(ang) * 160;
        }
      }
    }

    // 플레이어 근접 피해
    if (player) {
      const pd = Math.hypot(player.x - bomber.x, player.y - bomber.y);
      if (pd <= 65 + player.radius) {
        player.takeDamage(bomber.damage || 20);
      }
    }
  }

  update(dt, player, chapter, courseEnemyMult, questionNumber, arenaWidth, arenaHeight, isTutorial = false, monoliths = [], obstacles = []) {
    // 폭발 이펙트 업데이트
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].life -= dt;
      if (this.explosions[i].life <= 0) {
        this.explosions.splice(i, 1);
      }
    }

    // 웨이브 자동 스폰 (튜토리얼 제외: 8~16마리 밀도 유지 및 최대 1.8초마다 증원)
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

      // 광부 좀비 잠항 로직
      if (e.isBurrowed) {
        e.burrowTimer -= dt;
        if (e.burrowTimer <= 0) {
          e.isBurrowed = false;
          e.hitFlash = 0.25;
        }
      }

      // 유령 좀비 위상 주기 로직
      if (e.type === 'ghost') {
        e.phaseTimer = (e.phaseTimer + dt) % 3.5;
        e.isPhased = e.phaseTimer > 2.2;
      }

      // 댄서 좀비 백댄서 소환 로직
      if (e.type === 'dancer') {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 6.5;
          if (this.enemies.length < BALANCE.ENEMIES.MAX_ACTIVE - 2) {
            this.spawnEnemy('walker', e.x - 30, e.y, chapter.enemyHpMult * 0.8, chapter.enemyAtkMult, chapter.enemySpeedMult);
            this.spawnEnemy('walker', e.x + 30, e.y, chapter.enemyHpMult * 0.8, chapter.enemyAtkMult, chapter.enemySpeedMult);
          }
        }
      }

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      // 장대높이뛰기 좀비 도약 로직
      if (e.type === 'polevaulter' && !e.hasVaulted) {
        if (e.isVaulting) {
          e.vaultTimer -= dt;
          if (e.vaultTimer <= 0) {
            e.isVaulting = false;
            e.hasVaulted = true;
          }
        } else {
          // 장애물이나 벙커에 접근 시 1회 도약
          let nearObstacle = false;
          for (const m of monoliths) {
            if (Math.hypot(m.x - e.x, m.y - e.y) < m.radius + 35) { nearObstacle = true; break; }
          }
          if (!nearObstacle) {
            for (const o of obstacles) {
              if (Math.hypot(o.x - e.x, o.y - e.y) < (o.radius || 30) + 35) { nearObstacle = true; break; }
            }
          }
          if (nearObstacle) {
            e.isVaulting = true;
            e.vaultTimer = 0.38;
          }
        }
      }

      // 폭탄 좀비 근접 자폭 카운트다운
      if (e.type === 'bomber' && !e.isIgnited) {
        if (dist < e.radius + player.radius + 14) {
          e.isIgnited = true;
          e.fuseTimer = 0.45;
        }
      }
      if (e.isIgnited) {
        e.fuseTimer -= dt;
        if (e.fuseTimer <= 0) {
          e.hp = 0;
          this.triggerBomberExplosion(e, player);
          continue;
        }
      }

      let speedFactor = (e.slowTimer > 0 ? 0.55 : 1);
      if (e.isBurrowed) speedFactor *= 1.4;
      if (e.isVaulting) speedFactor *= 2.4;
      if (e.raged) speedFactor *= 1.0;

      const spd = e.speed * speedFactor;
      e.x += ((dx / dist) * spd + e.knockVx) * dt;
      e.y += ((dy / dist) * spd + e.knockVy) * dt;
      e.knockVx *= Math.pow(0.05, dt);
      e.knockVy *= Math.pow(0.05, dt);

      // 도약 중이거나 풍선/잠항 상태가 아닐 때 충돌 해결
      if (!e.isVaulting && !e.hasBalloon && !e.isBurrowed) {
        resolveCircleCollisions(e, monoliths);
        resolveCircleCollisions(e, obstacles);
      }

      // 플레이어 접촉 피해
      if (!e.isBurrowed && dist < e.radius + player.radius - 2) {
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

      // 보스 특수 패턴 쿨다운
      b.specialTimer -= dt;
      if (b.specialTimer <= 0) {
        b.specialTimer = 5.0;

        switch (b.role) {
          case 'guard': // Ch.1 도심 경비대장: 호루라기로 러너 1마리 지원
            this.spawnEnemy('runner', b.x + (Math.random() - 0.5) * 60, b.y + 40, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult * 1.1);
            break;
          case 'bulldozer': // Ch.2 불도저: 일직선 돌진
            b.chargeTimer = 0.9;
            b.chargeVx = (dx / dist) * b.speed * 2.2;
            b.chargeVy = (dy / dist) * b.speed * 2.2;
            break;
          case 'disco': // Ch.5 디스코 킹: 백댄서 소환
            this.spawnEnemy('dancer', b.x - 35, b.y, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            this.spawnEnemy('dancer', b.x + 35, b.y, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            break;
          case 'necro': // Ch.6 강령술사: 유령 1마리 부활
            this.spawnEnemy('ghost', b.x, b.y + 35, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            break;
          case 'airship': // Ch.7 스팀펑크 비행선: 풍선 좀비 투하
            this.spawnEnemy('balloon', b.x, b.y - 20, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            break;
          case 'king': // Ch.10 최종 군주: 복합 소환
            this.spawnEnemy('football', b.x - 40, b.y, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            this.spawnEnemy('ghost', b.x + 40, b.y, chapter.enemyHpMult, chapter.enemyAtkMult, chapter.enemySpeedMult);
            break;
        }
      }

      if (b.chargeTimer > 0) {
        b.chargeTimer -= dt;
        b.x += b.chargeVx * dt;
        b.y += b.chargeVy * dt;
      } else {
        const spd = b.speed * (b.enraged ? BALANCE.BOSS.ENRAGE_SPEED_MULT : 1) * (b.slowTimer > 0 ? 0.75 : 1);
        b.x += (dx / dist) * spd * dt;
        b.y += (dy / dist) * spd * dt;
      }

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

    // 폭발 이펙트 렌더링
    for (const exp of this.explosions) {
      ctx.save();
      const progress = 1 - exp.life / exp.maxLife;
      const r = exp.radius * (0.6 + progress * 0.4);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.45 * (1 - progress)})`;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.75 * (1 - progress)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 일반 좀비 렌더링 (15종 벡터 그래픽)
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(enemyScale, enemyScale);

      // 잠항 중인 광부 좀비: 흙먼지만 표시
      if (e.isBurrowed) {
        ctx.fillStyle = 'rgba(120, 53, 15, 0.6)';
        ctx.beginPath();
        ctx.ellipse(0, 0, e.radius * 0.8, e.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // 유령 좀비 위상 시 반투명
      if (e.type === 'ghost' && e.isPhased) {
        ctx.globalAlpha = 0.35;
      }

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

      // 좀비 눈
      const eyeR = Math.max(1.8, e.radius * 0.16);
      ctx.fillStyle = e.raged ? '#ef4444' : '#0f172a';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.3, -1.5, eyeR, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.3, -1.5, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // 15종 개별 캔버스 장신구 벡터 렌더링
      this.renderZombieAccessories(ctx, e);

      // 피격 시 미니 체력바
      if (e.hp < e.maxHp) {
        const w = e.radius * 1.8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(-w / 2, -e.radius - 7, w, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-w / 2, -e.radius - 7, w * (e.hp / e.maxHp), 3);
      }

      ctx.restore();
    }

    // 보스 렌더링 (10종 군단장 보스)
    if (this.boss && this.boss.hp > 0) {
      const b = this.boss;
      const bossScale = BALANCE.BOSS.RENDER_SCALE || 1.05;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(bossScale, bossScale);

      // 보스 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, b.radius * 0.85, b.radius * 1.05, b.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // 광폭화 링
      if (b.enraged) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 보스 몸체
      ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 보스 10종 고유 비주얼 렌더링
      this.renderBossVisuals(ctx, b);

      ctx.restore();
    }
  }

  /**
   * PvZ 스타일 좀비 15종 고유 장신구 벡터 렌더링
   */
  renderZombieAccessories(ctx, e) {
    const r = e.radius;

    switch (e.type) {
      case 'conehead': {
        // 주황색 교통 고깔콘
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-6, -r * 0.6);
        ctx.lineTo(0, -r - 12);
        ctx.lineTo(6, -r * 0.6);
        ctx.closePath();
        ctx.fill();
        // 반사 띠
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -r - 5, 6, 2.5);
        break;
      }

      case 'runner': {
        // 붉은 육상 헤드밴드
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-r * 0.85, -r * 0.7, r * 1.7, 3);
        break;
      }

      case 'buckethead': {
        // 은색 철제 양동이
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, -r * 0.5);
        ctx.lineTo(-8, -r - 8);
        ctx.lineTo(8, -r - 8);
        ctx.lineTo(7, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'newspaper': {
        // 신문지
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.fillRect(e.raged ? 2 : -7, -2, 12, 10);
        ctx.strokeRect(e.raged ? 2 : -7, -2, 12, 10);
        break;
      }

      case 'spitter': {
        // 입가에 산성 독액 방울
        ctx.fillStyle = '#a3e635';
        ctx.beginPath();
        ctx.arc(0, r * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'polevaulter': {
        // 대나무 장대
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(r * 0.7, -r * 1.2);
        ctx.lineTo(r * 0.7, r * 1.2);
        ctx.stroke();
        break;
      }

      case 'screendoor': {
        // 철망 방패
        if (e.shieldHp > 0) {
          ctx.fillStyle = 'rgba(71, 85, 105, 0.75)';
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-4, -r * 0.8, 12, r * 1.6);
          ctx.strokeRect(-4, -r * 0.8, 12, r * 1.6);
        }
        break;
      }

      case 'bomber': {
        // 등에 멘 둥근 폭탄 & 심지
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-r * 0.7, -r * 0.4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.isIgnited ? '#ef4444' : '#f59e0b';
        ctx.fillRect(-r * 0.7 - 1, -r * 0.4 - 7, 2, 4);
        break;
      }

      case 'football': {
        // 붉은 미식축구 헬멧 & 창살
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.9, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-4, -r * 0.2, 8, 4);
        break;
      }

      case 'dancer': {
        // 마이클 잭슨 스타일 페도라 모자 & 흰 깃
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-r * 0.9, -r * 0.8, r * 1.8, 3.5);
        ctx.fillRect(-r * 0.55, -r - 5, r * 1.1, 5);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-r * 0.55, -r - 1.5, r * 1.1, 2);
        break;
      }

      case 'miner': {
        // 노란 안전모 & 헤드램프
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, -r * 0.4, r * 0.85, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, -r * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'ghost': {
        // 유령 로브 물결
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'balloon': {
        // 머리 위 붉은 헬륨 풍선
        if (e.hasBalloon) {
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(0, -r - 12);
          ctx.stroke();
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(0, -r - 18, 7, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'gargantuar': {
        // 전봇대 & 등에 업힌 꼬마 임프
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 1.3);
        ctx.lineTo(r * 0.6, r * 1.3);
        ctx.stroke();
        // 전봇대 가로대
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r);
        ctx.lineTo(r * 1.0, -r);
        ctx.stroke();

        if (e.hasImp) {
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(-r * 0.6, -r * 0.5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  /**
   * 10개 챕터 군단장 보스 고유 비주얼 렌더링
   */
  renderBossVisuals(ctx, b) {
    const r = b.radius;

    switch (b.role) {
      case 'guard': {
        // Ch.1: 도심 경비대장 좀비 (진청색 캡모자 & 호루라기)
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-r * 0.8, -r * 0.7, r * 1.6, 5);
        ctx.fillRect(-r * 0.5, -r - 6, r, 6);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -r * 0.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bulldozer': {
        // Ch.2: 공사장 불도저 좀비 (노란 안전모 & 안전 빗금)
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(0, -r * 0.4, r * 0.9, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-8, -r * 0.6, 4, 6);
        ctx.fillRect(4, -r * 0.6, 4, 6);
        break;
      }

      case 'toxic': {
        // Ch.3: 독극물 박사 좀비 (방독면 & 녹색 렌즈)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -2, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.3, -2, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'riot': {
        // Ch.4: 방탄 진압대장 좀비 (진압 헬멧 & 대형 방패)
        ctx.fillStyle = '#312e81';
        ctx.fillRect(-r * 0.8, -r - 4, r * 1.6, 8);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fillRect(-r * 0.7, -r * 0.2, r * 1.4, 7);
        break;
      }

      case 'disco': {
        // Ch.5: 디스코 킹 좀비 (황금 아프로 헤어 & 스타 선글라스)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, -r * 0.4, r * 1.15, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-r * 0.6, -4, r * 1.2, 5);
        break;
      }

      case 'necro': {
        // Ch.6: 심연의 강령술사 좀비 (후드 로브 & 영혼 구체)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, -r * 0.3, r * 0.95, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#2dd4bf';
        ctx.beginPath();
        ctx.arc(-r * 0.25, -2, 3, 0, Math.PI * 2);
        ctx.arc(r * 0.25, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'airship': {
        // Ch.7: 스팀펑크 비행선 좀비 (고글 & 황동 날개)
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-r * 0.7, -r * 0.6, r * 1.4, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.4, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.3, -r * 0.4, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'gargantuar': {
        // Ch.8: 거인 군단장 가르강튀아 (전봇대 & 흉터)
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(r * 0.7, -r * 1.4);
        ctx.lineTo(r * 0.7, r * 1.4);
        ctx.stroke();
        break;
      }

      case 'cyborg': {
        // Ch.9: 사이보그 메카 좀비 (바이저 & 사이버 광택)
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-r * 0.8, -4, r * 1.6, 4);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r * 0.8, -4, r * 1.6, 4);
        break;
      }

      case 'king': {
        // Ch.10: 좀비 킹 (최종 군주) (황금 가시 왕관 & 붉은 보석)
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.6);
        ctx.lineTo(-r * 0.7, -r - 10);
        ctx.lineTo(-r * 0.35, -r - 4);
        ctx.lineTo(0, -r - 12);
        ctx.lineTo(r * 0.35, -r - 4);
        ctx.lineTo(r * 0.7, -r - 10);
        ctx.lineTo(r * 0.7, -r * 0.6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -r - 5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}
