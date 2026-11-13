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
    this.cooldowns = {};
    this.kills = 0;

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
    this.cooldowns = {};
    this.kills = 0;

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
    }

    if (killed && !target.isBoss) {
      this.kills += 1;
      this._player.addUltGauge(BALANCE.COMBAT.ULT_CHARGE_PER_KILL);
      this._monolithManager.spawnDrop('gem', target.x, target.y, target.xp || BALANCE.COMBAT.GEM_XP_VALUE);
      if (Math.random() < BALANCE.COMBAT.SNACK_DROP_CHANCE) {
        this._monolithManager.spawnDrop('snack', target.x + 12, target.y - 6, 1);
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

    if (skillDef.id === 'bark_sonic') {
      const weapon =
        COSTUMES.find((c) => c.id === player.equipped?.weapon) ||
        COSTUMES.find((c) => c.id === 'weapon_boomerang');
      const wType = weapon?.projectileType || weapon?.type || 'bullet';
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x) : player.facingAngle;
      audioEngine.playBark();

      if (wType === 'wave') {
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
      this.spawnProjectile({
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * 320,
        vy: Math.sin(ang) * 320,
        damage: dmg,
        radius: 12,
        color: skillDef.color,
        aoeRadius: 68 + level * 6,
        ttl: 0.85,
      });
    } else if (skillDef.id === 'bark_frost') {
      this.shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: skillDef.range,
        color: skillDef.color,
        ttl: 0.3,
        maxTtl: 0.3,
      });
      const targets = [...this._enemyManager.enemies];
      if (this._enemyManager.boss && this._enemyManager.boss.hp > 0) targets.push(this._enemyManager.boss);
      for (const t of targets) {
        if (Math.hypot(t.x - player.x, t.y - player.y) <= skillDef.range) {
          this.damageEnemy(t, dmg, skillDef.color, skillDef.slowDuration);
        }
      }
    } else if (skillDef.id === 'bark_thunder') {
      if (!target) return;
      const chainMax = skillDef.chainCount + Math.floor(level / 2);
      const hitSet = new Set();
      let prevX = player.x;
      let prevY = player.y;
      let current = target;

      for (let i = 0; i < chainMax && current; i++) {
        hitSet.add(current);
        this.lightningArcs.push({
          x1: prevX,
          y1: prevY,
          x2: current.x,
          y2: current.y,
          color: skillDef.color,
          ttl: 0.18,
        });
        this.damageEnemy(current, dmg, skillDef.color);
        prevX = current.x;
        prevY = current.y;

        // 다음 연쇄 대상 탐색
        let nextTarget = null;
        let nextDist = 170;
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
  }

  /**
   * 비석 정답 확정 시 주변 좀비 넉백 충격파
   */
  triggerCorrectShockwave(origin, camera, player = origin) {
    const r = BALANCE.MONOLITH.CORRECT_KNOCKBACK_RADIUS;
    const force = BALANCE.MONOLITH.CORRECT_KNOCKBACK_FORCE;
    this.shockwaves.push({
      x: origin.x,
      y: origin.y,
      radius: 20,
      maxRadius: r,
      color: '#22d3ee',
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
    // 1. 보유 속성 짖기 스킬 자동 발동
    for (const skillDef of SKILLS) {
      if (skillDef.category !== 'bark') continue;
      const lv = player.skills[skillDef.id] || 0;
      if (lv <= 0) continue;

      const weapon = COSTUMES.find((c) => c.id === player.equipped?.weapon);
      const cdMult = (skillDef.id === 'bark_sonic' && weapon?.cooldownMult) ? weapon.cooldownMult : 1.0;

      this.cooldowns[skillDef.id] = (this.cooldowns[skillDef.id] ?? 0) - dt;
      if (this.cooldowns[skillDef.id] <= 0) {
        this.cooldowns[skillDef.id] = skillDef.cooldown * cdMult;
        this._triggerSkill(skillDef, lv, player);
      }
    }

    // 2. 투사체 이동 및 충돌
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.ttl <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let hitTarget = null;
      const boss = this._enemyManager.boss;
      if (boss && boss.hp > 0 && (!p.hitSet || !p.hitSet.has(boss)) && Math.hypot(boss.x - p.x, boss.y - p.y) <= boss.radius + p.radius) {
        hitTarget = boss;
      } else {
        for (const e of this._enemyManager.enemies) {
          if (e.hp > 0 && (!p.hitSet || !p.hitSet.has(e)) && Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius) {
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

        if (p.pierce && p.pierce > 0) {
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
    // 충격파 링
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

    // 투사체
    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.shape === 'slash') {
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

