/**
 * js/game/combatSystem.js
 * 속성 짖기 4종·투사체 물리, 충돌 판정, 데미지 숫자, 필살기 [왕왕 대폭발] & 음파 레이저
 */

import { BALANCE } from '../config/balance.js';
import { COSTUMES, SKILLS } from '../data/catalog.js';
import { audioEngine } from '../core/audioEngine.js';

export class CombatSystem {
  constructor() {
    this.projectiles = [];
    this.shockwaves = [];
    this.lightningArcs = [];
    this.lasers = [];
    this.damageTexts = [];
    this.mines = [];
    this.cooldowns = {};
    this.kills = 0;
    this.shieldAngle = 0;
    this._shieldHitCooldowns = new Map();

    this._enemyManager = null;
    this._monolithManager = null;
    this._player = null;
  }

  reset(player, enemyManager, monolithManager) {
    this.projectiles = [];
    this.shockwaves = [];
    this.lightningArcs = [];
    this.lasers = [];
    this.damageTexts = [];
    this.mines = [];
    this.cooldowns = {};
    this.kills = 0;
    this.shieldAngle = 0;
    this._shieldHitCooldowns = new Map();

    this._player = player;
    this._enemyManager = enemyManager;
    this._monolithManager = monolithManager;
  }

  spawnProjectile(proj) {
    this.projectiles.push({ ...proj });
  }

  spawnDamageText(x, y, text, color = '#ffffff', scale = 1) {
    this.damageTexts.push({
      x,
      y,
      text: String(text),
      color,
      scale,
      ttl: BALANCE.COMBAT.DAMAGE_TEXT_TTL,
      maxTtl: BALANCE.COMBAT.DAMAGE_TEXT_TTL,
    });
  }

  damageEnemy(target, rawDmg, color = '#ffffff', slowDuration = 0) {
    if (!target || target.hp <= 0 || !this._enemyManager) return;
    const { killed, actualDmg } = this._enemyManager.applyDamageToTarget(target, rawDmg);

    if (slowDuration > 0) {
      target.slowTimer = Math.max(target.slowTimer || 0, slowDuration);
    }

    if (actualDmg > 0) {
      this.spawnDamageText(target.x + (Math.random() - 0.5) * 14, target.y - target.radius, actualDmg, color);
    } else if (target.isBoss && Math.random() < 0.22) {
      // 보스는 단어 정답으로만 타격 가능
      this.spawnDamageText(target.x + (Math.random() - 0.5) * 16, target.y - target.radius - 8, '🛡️ 방어', '#94a3b8', 0.9);
    }

    if (killed && !target.isBoss) {
      this.kills += 1;
      this._player.addUltGauge(BALANCE.COMBAT.ULT_CHARGE_PER_KILL);
      this._monolithManager.spawnDrop('gem', target.x, target.y, target.xp || BALANCE.COMBAT.GEM_XP_VALUE);

      const dropRoll = Math.random();
      const medkitChance = BALANCE.COMBAT.MEDKIT_DROP_CHANCE || 0.005;
      const boneChance = BALANCE.COMBAT.BONE_DROP_CHANCE || 0.015;
      if (dropRoll < medkitChance) {
        this._monolithManager.spawnDrop('medkit', target.x + 10, target.y - 6);
      } else if (dropRoll < medkitChance + boneChance) {
        this._monolithManager.spawnDrop('snack', target.x + 10, target.y - 6);
      }
    }
  }

  _findNearestTarget(x, y, maxRange) {
    const enemies = this._enemyManager.enemies;
    const boss = this._enemyManager.boss;
    let best = null;
    let bestDist = maxRange;

    if (boss && boss.hp > 0) {
      const d = Math.hypot(boss.x - x, boss.y - y);
      if (d <= bestDist + boss.radius) {
        best = boss;
        bestDist = d;
      }
    }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  _triggerSkill(skillDef, level, player) {
    const lvMult = 1 + (level - 1) * 0.25;
    const dmg = Math.round(player.atk * skillDef.baseDamageMult * lvMult);
    const target = this._findNearestTarget(player.x, player.y, skillDef.range + 70);
    const isAwakened = level >= 5;

    if (skillDef.id === 'bark_sonic' || skillDef.id === 'bark') {
      player.triggerMouthOpen?.(0.25);
      const weapon =
        (player.equipped?.weapon && COSTUMES.find((c) => c.id === player.equipped?.weapon)) || {
          projectileType: 'bullet',
          projSpeed: 520,
          projRadius: 6,
          projColor: '#fbbf24',
          shape: 'bullet',
          pierce: 0,
          aoeRadius: 0,
          range: 160,
        };
      const wType = weapon.projectileType || weapon.type || 'bullet';
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facingAngle;
      audioEngine.playBark();

      if (isAwakened) {
        // [🔥 Lv.5 각성: 초음파 난사포] 5갈래 고주파 파동탄 부채꼴 난사
        const spreadAngles = [-0.34, -0.17, 0, 0.17, 0.34];
        for (const sa of spreadAngles) {
          const a = ang + sa;
          this.spawnProjectile({
            x: player.x,
            y: player.y,
            vx: Math.cos(a) * 520,
            vy: Math.sin(a) * 520,
            damage: Math.round(dmg * 1.2),
            radius: 12,
            color: '#38bdf8',
            shape: 'wave',
            pierce: 2,
            aoeRadius: 36,
            ttl: 0.8,
          });
        }
      } else if (wType === 'wave') {
        const waveRange = weapon.range || 160;
        this.shockwaves.push({
          x: player.x,
          y: player.y,
          radius: 12,
          maxRadius: waveRange,
          color: weapon.projColor || '#fbbf24',
          ttl: 0.32,
          maxTtl: 0.32,
        });
        const targets = [...this._enemyManager.enemies];
        if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) targets.push(this._enemyManager.boss);
        for (const t of targets) {
          if (Math.hypot(t.x - player.x, t.y - player.y) <= waveRange) {
            this.damageEnemy(t, dmg, weapon.projColor || '#fbbf24');
          }
        }
      } else if (wType === 'spread') {
        // [산탄총류] 부채꼴 3발 산탄 발사
        const spd = weapon.projSpeed || 500;
        const rad = weapon.projRadius || 6;
        const col = weapon.projColor || '#f59e0b';
        const spreadOffsets = [-0.22, 0, 0.22];
        const pelletDmg = Math.max(1, Math.round(dmg * 0.75));

        for (const off of spreadOffsets) {
          const a = ang + off;
          this.spawnProjectile({
            x: player.x,
            y: player.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            damage: pelletDmg,
            radius: rad,
            color: col,
            shape: weapon.shape || 'pellet',
            pierce: weapon.pierce || 0,
            aoeRadius: 0,
            ttl: 0.65,
          });
        }
      } else if (wType === 'explosive') {
        // [수류탄·RPG·로켓·뉴크류] 착탄 시 광역 폭발 + 스플래시 데미지
        const spd = weapon.projSpeed || 420;
        const rad = weapon.projRadius || 10;
        const col = weapon.projColor || '#ef4444';
        const aoe = weapon.aoeRadius || 85;

        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          damage: dmg,
          radius: rad,
          color: col,
          shape: weapon.shape || 'missile',
          pierce: 0,
          aoeRadius: aoe,
          ttl: 0.85,
        });
      } else if (wType === 'pierce') {
        // [저격총·레일건류] 고속 관통 탄환 및 궤적 빔
        const spd = weapon.projSpeed || 750;
        const rad = weapon.projRadius || 7;
        const col = weapon.projColor || '#06b6d4';
        const pierceCount = weapon.pierce || 5;

        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          damage: dmg,
          radius: rad,
          color: col,
          shape: weapon.shape || 'beam',
          pierce: pierceCount,
          aoeRadius: weapon.aoeRadius || 0,
          ttl: 0.8,
        });
      } else if (wType === 'flame') {
        // [화염탄·화염방사기]
        const spd = weapon.projSpeed || 340;
        const rad = weapon.projRadius || 13;
        const col = weapon.projColor || '#ea580c';
        const a = ang + (Math.random() - 0.5) * 0.18;

        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          damage: dmg,
          radius: rad,
          color: col,
          shape: 'flame',
          pierce: weapon.pierce || 1,
          aoeRadius: weapon.aoeRadius || 55,
          ttl: 0.65,
        });
      } else if (wType === 'laser') {
        // [레이저·테슬라·플라즈마류]
        const spd = weapon.projSpeed || 700;
        const rad = weapon.projRadius || 8;
        const col = weapon.projColor || '#a855f7';

        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          damage: dmg,
          radius: rad,
          color: col,
          shape: weapon.shape || 'laser',
          pierce: weapon.pierce || 3,
          aoeRadius: weapon.aoeRadius || 0,
          ttl: 0.8,
        });
      } else {
        // [일반 탄환/기본 부메랑]
        const spd = weapon.projSpeed || 520;
        const rad = weapon.projRadius || 6;
        const col = weapon.projColor || '#fbbf24';
        const shape = weapon.shape || 'bullet';

        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          damage: dmg,
          radius: rad,
          color: col,
          shape,
          pierce: weapon.pierce || 0,
          aoeRadius: 0,
          ttl: 0.75,
        });
      }
    } else if (skillDef.id === 'bark_flame') {
      if (!target) return;
      const ang = Math.atan2(target.y - player.y, target.x - player.x);
      // [🔥 Lv.5 각성: 메테오 파이어볼]
      this.spawnProjectile({
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * (isAwakened ? 380 : 320),
        vy: Math.sin(ang) * (isAwakened ? 380 : 320),
        damage: isAwakened ? Math.round(dmg * 1.5) : dmg,
        radius: isAwakened ? 18 : 12,
        color: isAwakened ? '#ef4444' : skillDef.color,
        aoeRadius: isAwakened ? 150 : (68 + level * 6),
        ttl: 0.9,
      });
    } else if (skillDef.id === 'bark_frost') {
      // [🔥 Lv.5 각성: 절대영도 빙결]
      const fRange = isAwakened ? 280 : skillDef.range;
      const slowDur = isAwakened ? 3.5 : skillDef.slowDuration;
      const finalDmg = isAwakened ? Math.round(dmg * 1.5) : dmg;

      this.shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: fRange,
        color: isAwakened ? '#a5f3fc' : skillDef.color,
        ttl: isAwakened ? 0.45 : 0.3,
        maxTtl: isAwakened ? 0.45 : 0.3,
      });
      const targets = [...this._enemyManager.enemies];
      if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) targets.push(this._enemyManager.boss);
      for (const t of targets) {
        if (Math.hypot(t.x - player.x, t.y - player.y) <= fRange) {
          this.damageEnemy(t, finalDmg, skillDef.color, slowDur);
        }
      }
    } else if (skillDef.id === 'bark_thunder') {
      if (!target) return;
      // [🔥 Lv.5 각성: 천둥의 심판] 2개 목표 동시 타격 & 연쇄 7마리
      const targetCount = isAwakened ? 2 : 1;
      const chainMax = isAwakened ? 7 : (skillDef.chainCount + Math.floor(level / 2));
      const primaryTargets = [target];
      if (targetCount > 1) {
        for (const e of this._enemyManager.enemies) {
          if (e.hp > 0 && e !== target) {
            primaryTargets.push(e);
            break;
          }
        }
      }

      for (const prim of primaryTargets) {
        const hitSet = new Set();
        let prevX = player.x;
        let prevY = player.y;
        let current = prim;

        for (let i = 0; i < chainMax && current; i++) {
          hitSet.add(current);
          this.lightningArcs.push({
            x1: prevX,
            y1: prevY,
            x2: current.x,
            y2: current.y,
            color: isAwakened ? '#fde047' : skillDef.color,
            ttl: 0.22,
          });
          this.damageEnemy(current, isAwakened ? Math.round(dmg * 1.35) : dmg, skillDef.color);
          prevX = current.x;
          prevY = current.y;

          let nextTarget = null;
          let nextDist = 180;
          for (const e of this._enemyManager.enemies) {
            if (e.hp <= 0 || hitSet.has(e)) continue;
            const d = Math.hypot(e.x - prevX, e.y - prevY);
            if (d < nextDist) {
              nextTarget = e;
              nextDist = d;
            }
          }
          current = nextTarget;
        }
      }
    } else if (skillDef.id === 'bark_shield') {
      // [신규 1: 회전 방패 드론 / 🔥 Lv.5 각성: 수호의 결계]
      this.shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 12,
        maxRadius: isAwakened ? 75 : 52,
        color: isAwakened ? '#facc15' : '#34d399',
        ttl: 0.24,
        maxTtl: 0.24,
      });
    } else if (skillDef.id === 'bark_boomerang') {
      // [신규 2: 부메랑 원반 / 🔥 Lv.5 각성: 쌍둥이 폭풍 원반]
      let fTarget = null;
      let maxDist = 0;
      for (const e of this._enemyManager.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d > maxDist && d <= 360) {
          maxDist = d;
          fTarget = e;
        }
      }
      const baseAng = fTarget ? Math.atan2(fTarget.y - player.y, fTarget.x - player.x) : player.facingAngle;
      const bAngles = isAwakened ? [baseAng - 0.22, baseAng + 0.22] : [baseAng];

      for (const ang of bAngles) {
        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * 440,
          vy: Math.sin(ang) * 440,
          damage: isAwakened ? Math.round(dmg * 1.3) : dmg,
          radius: isAwakened ? 16 : 12,
          color: isAwakened ? '#f59e0b' : '#fbbf24',
          shape: 'boomerang',
          isBoomerang: true,
          returning: false,
          flyTimer: 0.44,
          rotAngle: 0,
          pierce: 99,
          ttl: 2.6,
        });
      }
    } else if (skillDef.id === 'bark_mine') {
      // [신규 3: 지뢰 뼈다귀 / 🔥 Lv.5 각성: 클러스터 폭탄]
      this.mines.push({
        x: player.x,
        y: player.y,
        damage: isAwakened ? Math.round(dmg * 1.4) : dmg,
        aoeRadius: isAwakened ? 140 : 100,
        isAwakened,
        ttl: 8.0,
        armedTimer: 0.3,
      });
    } else if (skillDef.id === 'bark_tornado' || skillDef.id === 'tail_whirl') {
      // [회오리 꼬리치기 / 토네이도 + 꼬리 흔들기 모션]
      player.triggerTailWag?.(0.6);
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facingAngle;
      const tAngles = isAwakened ? [ang - 0.24, ang + 0.24] : [ang];

      for (const a of tAngles) {
        this.spawnProjectile({
          x: player.x,
          y: player.y,
          vx: Math.cos(a) * 165,
          vy: Math.sin(a) * 165,
          damage: isAwakened ? Math.round(dmg * 0.7) : Math.round(dmg * 0.5),
          radius: isAwakened ? 44 : 30,
          color: isAwakened ? '#c084fc' : '#a855f7',
          shape: 'tornado',
          isTornado: true,
          hitTimer: 0,
          rotAngle: 0,
          ttl: isAwakened ? 2.8 : 2.2,
        });
      }
    } else if (skillDef.id === 'bite') {
      // [야무지게 물어뜯기: 고속 하얀 이빨 에너지 탄환 + 입 벌림 모션]
      player.triggerMouthOpen?.(0.25);
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facingAngle;
      audioEngine.playHit?.();
      const radScale = this.parrotAmplified ? 1.35 : 1.0;
      this.spawnProjectile({
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 540,
        vy: Math.sin(ang) * 540,
        damage: Math.round(dmg * 1.35),
        radius: Math.round(9 * radScale),
        color: '#f8fafc',
        shape: 'pellet',
        pierce: isAwakened ? 2 : 0,
        aoeRadius: 0,
        ttl: 0.65,
      });
    } else if (skillDef.id === 'paw_swipe') {
      // [앞발 날리기: 분홍 젤리 발바닥 스와이프 근접 공격]
      player.triggerPawSwipe?.(0.25);
      audioEngine.playCaptureTick?.();
      const swipeRange = isAwakened ? 120 : 95;
      const targets = [...this._enemyManager.enemies];
      if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) targets.push(this._enemyManager.boss);
      for (const t of targets) {
        const dx = t.x - player.x;
        const dy = t.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= swipeRange) {
          const ang = Math.atan2(dy, dx);
          const diff = Math.abs(ang - player.facingAngle);
          if (diff < 1.1 || diff > Math.PI * 2 - 1.1) {
            this.damageEnemy(t, dmg, '#f472b6');
            t.knockVx = Math.cos(ang) * 220;
            t.knockVy = Math.sin(ang) * 220;
          }
        }
      }
    } else if (skillDef.id === 'hip_slam') {
      // [엉덩이 쿵!: 360도 동심원 충격파 링 + 범위 넉백]
      player.triggerHipSlam?.(0.35);
      audioEngine.playPowerUp?.();
      const ringRange = isAwakened ? 160 : 125;
      this.shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 15,
        maxRadius: ringRange,
        color: '#fb923c',
        ttl: 0.35,
        maxTtl: 0.35,
      });
      const targets = [...this._enemyManager.enemies];
      if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) targets.push(this._enemyManager.boss);
      for (const t of targets) {
        const dist = Math.hypot(t.x - player.x, t.y - player.y);
        if (dist <= ringRange) {
          this.damageEnemy(t, dmg, '#fb923c');
          const ang = Math.atan2(t.y - player.y, t.x - player.x);
          t.knockVx = Math.cos(ang) * 320;
          t.knockVy = Math.sin(ang) * 320;
        }
      }
    }
  }

  /**
   * 비석 정답 확정 시 주변 좀비 넉백 선명한 단일 충격파 + 스파크
   */
  triggerCorrectShockwave(origin, camera, player = origin) {
    const r = BALANCE.MONOLITH.CORRECT_KNOCKBACK_RADIUS;
    const force = BALANCE.MONOLITH.CORRECT_KNOCKBACK_FORCE;
    this.shockwaves.push({
      x: origin.x,
      y: origin.y,
      radius: 18,
      maxRadius: r,
      color: '#34d399',
      sparks: true,
      ttl: 0.38,
      maxTtl: 0.38,
    });
    camera?.shake(9, 0.22);

    const atk = player?.atk || 20;
    for (const e of this._enemyManager.enemies) {
      const dx = e.x - origin.x;
      const dy = e.y - origin.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= r) {
        e.knockVx = (dx / dist) * force;
        e.knockVy = (dy / dist) * force;
        this.damageEnemy(e, atk * 1.4, '#22d3ee');
      }
    }
  }

  /**
   * [🔥 왕왕 대폭발] 일회용 필살기 발동
   */
  triggerUltimate(player, camera) {
    const r = BALANCE.COMBAT.ULT_RADIUS;
    const dmg = Math.round(player.atk * BALANCE.COMBAT.ULT_DAMAGE_MULT);
    player.consumeUltGauge();
    audioEngine.playUlt();
    camera.shake(16, 0.4);

    this.shockwaves.push({
      x: player.x,
      y: player.y,
      radius: 25,
      maxRadius: r,
      color: '#fb923c',
      ttl: 0.48,
      maxTtl: 0.48,
    });

    const targets = [...this._enemyManager.enemies];
    if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) {
      targets.push(this._enemyManager.boss);
    }

    for (const t of targets) {
      const dx = t.x - player.x;
      const dy = t.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= r) {
        if (!t.isBoss) {
          t.knockVx = (dx / dist) * 520;
          t.knockVy = (dy / dist) * 520;
        }
        this.damageEnemy(t, dmg, '#fb923c');
      }
    }
  }

  /**
   * 28~30번 보스전 정답 시 하늘에서 내리꽂히는 음파 레이저 연출
   */
  triggerSonicLaser(targetX, targetY, camera) {
    audioEngine.playLaser();
    camera.shake(13, 0.32);
    this.lasers.push({
      x: targetX,
      y: targetY,
      ttl: 0.45,
      maxTtl: 0.45,
    });
  }

  update(dt, player) {
    // 0. 전장 추종 인간 주인(Owner) 물리 및 지원 사격 갱신
    if (player.owner) {
      player.owner.update(dt, player, this._enemyManager.enemies, this._enemyManager.boss, this);
    }

    // 1. 보유 속성 짖기 스킬 자동 발동 (패시브 + 실험실 앵무새 증폭 연사 쿨타임 감소 반영)
    const firerateBonus = ((player.skills?.passive_firerate || 0) * 0.06) + (this.parrotAmplified ? 0.25 : 0);
    const firerateMult = Math.max(0.35, 1 - firerateBonus);

    for (const skillDef of SKILLS) {
      if (skillDef.category !== 'bark') continue;
      const lv = player.skills[skillDef.id] || 0;
      if (lv <= 0) continue;

      const weapon = player.equipped?.weapon ? COSTUMES.find((c) => c.id === player.equipped?.weapon) : null;
      const cdMult = (skillDef.id === 'bark_sonic' && weapon?.cooldownMult) ? weapon.cooldownMult : 1.0;

      this.cooldowns[skillDef.id] = (this.cooldowns[skillDef.id] ?? 0) - dt;
      if (this.cooldowns[skillDef.id] <= 0) {
        this.cooldowns[skillDef.id] = skillDef.cooldown * cdMult * firerateMult;
        this._triggerSkill(skillDef, lv, player);
      }
    }

    // 1-B. 회전 방패 드론 (bark_shield) 공전 물리 및 좀비 충돌 판정
    const shieldLv = player.skills?.bark_shield || 0;
    if (shieldLv > 0) {
      const isAwakened = shieldLv >= 5;
      const orbCount = isAwakened ? 3 : (shieldLv >= 3 ? 2 : 1);
      const orbitR = isAwakened ? 60 : 46;
      this.shieldAngle = (this.shieldAngle || 0) + dt * 3.8;
      const sDmg = Math.round(player.atk * (isAwakened ? 1.2 : 0.8) * (1 + (shieldLv - 1) * 0.2));

      for (let i = 0; i < orbCount; i++) {
        const ang = this.shieldAngle + (i * Math.PI * 2) / orbCount;
        const ox = player.x + Math.cos(ang) * orbitR;
        const oy = player.y + Math.sin(ang) * orbitR;
        const hitR = isAwakened ? 16 : 12;

        for (const e of this._enemyManager.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - ox, e.y - oy);
          if (d <= e.radius + hitR) {
            const lastHit = this._shieldHitCooldowns.get(e) || 0;
            const nowTime = performance.now();
            if (nowTime - lastHit >= 300) {
              this._shieldHitCooldowns.set(e, nowTime);
              this.damageEnemy(e, sDmg, isAwakened ? '#facc15' : '#34d399');
              const edx = e.x - player.x;
              const edy = e.y - player.y;
              const edist = Math.hypot(edx, edy) || 1;
              e.knockVx = (edx / edist) * (isAwakened ? 340 : 220);
              e.knockVy = (edy / edist) * (isAwakened ? 340 : 220);
            }
          }
        }
      }
    }

    // 1-C. 지뢰 뼈다귀 (bark_mine) 감지 및 폭발
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.ttl -= dt;
      m.armedTimer = Math.max(0, m.armedTimer - dt);

      let triggered = m.ttl <= 0;
      if (m.armedTimer <= 0 && !triggered) {
        for (const e of this._enemyManager.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) <= e.radius + 18) {
            triggered = true;
            break;
          }
        }
      }

      if (triggered) {
        this.shockwaves.push({
          x: m.x,
          y: m.y,
          radius: 12,
          maxRadius: m.aoeRadius,
          color: m.isAwakened ? '#f59e0b' : '#ef4444',
          ttl: 0.32,
          maxTtl: 0.32,
        });
        audioEngine.playHit?.();
        for (const e of this._enemyManager.enemies) {
          if (Math.hypot(e.x - m.x, e.y - m.y) <= m.aoeRadius) {
            this.damageEnemy(e, m.damage, m.isAwakened ? '#f59e0b' : '#ef4444');
          }
        }
        if (m.isAwakened) {
          // [클러스터 폭탄] 3개 자탄 연쇄 폭발
          for (let c = 0; c < 3; c++) {
            const ca = (c * Math.PI * 2) / 3;
            const cx = m.x + Math.cos(ca) * 38;
            const cy = m.y + Math.sin(ca) * 38;
            this.shockwaves.push({
              x: cx,
              y: cy,
              radius: 8,
              maxRadius: 65,
              color: '#fb923c',
              ttl: 0.28,
              maxTtl: 0.28,
            });
            for (const e of this._enemyManager.enemies) {
              if (Math.hypot(e.x - cx, e.y - cy) <= 65) {
                this.damageEnemy(e, Math.round(m.damage * 0.6), '#fb923c');
              }
            }
          }
        }
        this.mines.splice(i, 1);
      }
    }

    // 2. 투사체 이동 및 충돌
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= dt;

      if (p.isBoomerang) {
        p.rotAngle = (p.rotAngle || 0) + dt * 18;
        if (!p.returning) {
          p.flyTimer -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.flyTimer <= 0) p.returning = true;
        } else {
          const bdx = player.x - p.x;
          const bdy = player.y - p.y;
          const bdist = Math.hypot(bdx, bdy) || 1;
          p.x += (bdx / bdist) * 460 * dt;
          p.y += (bdy / bdist) * 460 * dt;
          if (bdist < 24) {
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      } else if (p.isTornado) {
        p.rotAngle = (p.rotAngle || 0) + dt * 10;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.hitTimer = (p.hitTimer || 0) - dt;
        if (p.hitTimer <= 0) {
          p.hitTimer = 0.25;
          const pullRadius = p.radius * 1.5;
          for (const e of this._enemyManager.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d <= pullRadius) {
              const edx = p.x - e.x;
              const edy = p.y - e.y;
              const edist = Math.hypot(edx, edy) || 1;
              e.knockVx = (edx / edist) * 110;
              e.knockVy = (edy / edist) * 110;
              this.damageEnemy(e, p.damage, p.color);
            }
          }
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      if (p.hitCooldowns && p.hitCooldowns.size > 0) {
        for (const [target, cd] of p.hitCooldowns.entries()) {
          const nextCd = cd - dt;
          if (nextCd <= 0) {
            p.hitCooldowns.delete(target);
          } else {
            p.hitCooldowns.set(target, nextCd);
          }
        }
      }

      if (p.ttl <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let hitTarget = null;
      const boss = this._enemyManager.boss;
      const canHitBoss = (!p.hitSet || !p.hitSet.has(boss)) && (!p.hitCooldowns || !p.hitCooldowns.has(boss));
      if (boss && boss.hp > 0 && canHitBoss && Math.hypot(boss.x - p.x, boss.y - p.y) <= boss.radius + p.radius) {
        hitTarget = boss;
      } else {
        for (const e of this._enemyManager.enemies) {
          const canHitEnemy = (!p.hitSet || !p.hitSet.has(e)) && (!p.hitCooldowns || !p.hitCooldowns.has(e));
          if (e.hp > 0 && canHitEnemy && Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius) {
            hitTarget = e;
            break;
          }
        }
      }

      if (hitTarget) {
        if (p.aoeRadius > 0) {
          this.shockwaves.push({
            x: p.x,
            y: p.y,
            radius: 6,
            maxRadius: p.aoeRadius,
            color: p.color,
            ttl: 0.25,
            maxTtl: 0.25,
          });
          for (const e of this._enemyManager.enemies) {
            if (Math.hypot(e.x - p.x, e.y - p.y) <= p.aoeRadius) {
              this.damageEnemy(e, p.damage, p.color);
            }
          }
          if (boss && boss.hp > 0 && Math.hypot(boss.x - p.x, boss.y - p.y) <= p.aoeRadius + boss.radius) {
            this.damageEnemy(boss, p.damage, p.color);
          }
        } else {
          this.damageEnemy(hitTarget, p.damage, p.color);
        }

        if (p.isBoomerang) {
          // 부메랑은 관통하며 동일 적 0.2초 재피격 쿨다운 (dt 기반 감쇄)
          p.hitCooldowns = p.hitCooldowns || new Map();
          p.hitCooldowns.set(hitTarget, 0.2);
        } else if (p.isTornado) {
          // 토네이도는 관통 유지
        } else if (p.pierce && p.pierce > 0) {
          p.pierce -= 1;
          p.hitSet = p.hitSet || new Set();
          p.hitSet.add(hitTarget);
        } else {
          this.projectiles.splice(i, 1);
        }
      }
    }

    // 3. 시각 이펙트 & 데미지 텍스트 수명 감소
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].ttl -= dt;
      if (this.shockwaves[i].ttl <= 0) this.shockwaves.splice(i, 1);
    }
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].ttl -= dt;
      if (this.lightningArcs[i].ttl <= 0) this.lightningArcs.splice(i, 1);
    }
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].ttl -= dt;
      if (this.lasers[i].ttl <= 0) this.lasers.splice(i, 1);
    }
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dtItem = this.damageTexts[i];
      dtItem.ttl -= dt;
      dtItem.y -= 34 * dt;
      if (dtItem.ttl <= 0) this.damageTexts.splice(i, 1);
    }
  }

  render(ctx) {
    // 충격파 링 & 스파크
    for (const sw of this.shockwaves) {
      const progress = 1 - sw.ttl / sw.maxTtl;
      const currentR = sw.radius + (sw.maxRadius - sw.radius) * progress;
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 4 * (1 - progress) + 1;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, currentR, 0, Math.PI * 2);
      ctx.stroke();

      if (sw.sparks) {
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.lineWidth = Math.max(1, 2.2 * (1 - progress));
        const sparkCount = 8;
        for (let s = 0; s < sparkCount; s++) {
          const ang = (s * Math.PI * 2) / sparkCount + progress * 0.4;
          const innerR = Math.max(0, currentR - 16);
          const outerR = currentR + 10;
          ctx.beginPath();
          ctx.moveTo(sw.x + Math.cos(ang) * innerR, sw.y + Math.sin(ang) * innerR);
          ctx.lineTo(sw.x + Math.cos(ang) * outerR, sw.y + Math.sin(ang) * outerR);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 번개 아크
    for (const arc of this.lightningArcs) {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      ctx.lineTo((arc.x1 + arc.x2) / 2 + (Math.random() - 0.5) * 18, (arc.y1 + arc.y2) / 2 + (Math.random() - 0.5) * 18);
      ctx.lineTo(arc.x2, arc.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 음파 레이저 (보스 격파용)
    for (const l of this.lasers) {
      const alpha = l.ttl / l.maxTtl;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 24;
      ctx.fillRect(l.x - 18, l.y - 600, 36, 610);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(l.x - 6, l.y - 600, 12, 610);
      ctx.restore();
    }

    // 지뢰 뼈다귀
    for (const m of this.mines) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.shadowColor = m.isAwakened ? '#f59e0b' : '#ef4444';
      ctx.shadowBlur = 10;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.isAwakened ? '💥' : '💣', 0, 0);

      const pulse = 1 - (m.ttl % 1);
      ctx.strokeStyle = m.isAwakened ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, (m.isAwakened ? 18 : 14) + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 회전 방패 드론
    if (this._player && (this._player.skills?.bark_shield || 0) > 0) {
      const sLv = this._player.skills.bark_shield;
      const isAwakened = sLv >= 5;
      const orbCount = isAwakened ? 3 : (sLv >= 3 ? 2 : 1);
      const orbitR = isAwakened ? 60 : 46;

      for (let i = 0; i < orbCount; i++) {
        const ang = (this.shieldAngle || 0) + (i * Math.PI * 2) / orbCount;
        const ox = this._player.x + Math.cos(ang) * orbitR;
        const oy = this._player.y + Math.sin(ang) * orbitR;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = isAwakened ? '#facc15' : '#34d399';
        ctx.shadowColor = isAwakened ? '#f59e0b' : '#10b981';
        ctx.shadowBlur = isAwakened ? 16 : 10;
        ctx.font = isAwakened ? '18px sans-serif' : '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, 0);

        ctx.strokeStyle = isAwakened ? 'rgba(250, 204, 21, 0.7)' : 'rgba(52, 211, 153, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, isAwakened ? 16 : 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 투사체
    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.shape === 'boomerang') {
        const rot = p.rotAngle || 0;
        ctx.translate(p.x, p.y);
        ctx.rotate(rot);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.font = `${Math.round(p.radius * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪃', 0, 0);
      } else if (p.shape === 'tornado') {
        const rot = p.rotAngle || 0;
        ctx.translate(p.x, p.y);
        ctx.rotate(rot);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.font = `${Math.round(p.radius * 1.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌪️', 0, 0);
      } else if (p.shape === 'slash') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.6, p.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'beam') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-p.radius * 2.2, -p.radius * 0.5, p.radius * 4.4, p.radius, p.radius * 0.5);
        } else {
          ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.5, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-p.radius * 1.5, -p.radius * 0.25, p.radius * 3, p.radius * 0.5, p.radius * 0.25);
        } else {
          ctx.ellipse(0, 0, p.radius * 1.5, p.radius * 0.25, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (p.shape === 'laser') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-p.radius * 1.8, -p.radius * 0.5, p.radius * 3.6, p.radius, 3);
        } else {
          ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.5, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-p.radius, -p.radius * 0.2, p.radius * 2, p.radius * 0.4);
      } else if (p.shape === 'flame') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (0.8 + Math.random() * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'missile') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-p.radius * 1.3, -p.radius * 0.5, p.radius * 2.6, p.radius, 3);
        } else {
          ctx.ellipse(0, 0, p.radius * 1.3, p.radius * 0.5, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(-p.radius * 1.3, 0, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'bone') {
        const spin = (Date.now() / 90) % (Math.PI * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(spin);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-p.radius, -p.radius * 0.45, p.radius * 2, p.radius * 0.9, 4);
        } else {
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      } else {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.4, p.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 데미지 팝업 숫자
    for (const dtItem of this.damageTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, dtItem.ttl / dtItem.maxTtl);
      ctx.fillStyle = dtItem.color;
      ctx.font = `900 ${Math.round(13 * dtItem.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(dtItem.text, dtItem.x, dtItem.y);
      ctx.restore();
    }
  }
}

