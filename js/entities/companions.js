/**
 * js/entities/companions.js
 * 동물 친구 4종(루키·넛츠·맥스·피지) 추종 AI 및 자동 전투 공격
 */

import { BALANCE } from '../config/balance.js';
import { COMPANIONS } from '../data/catalog.js';

const PROJECTILE_STYLES = {
  acorn:     { speed: 340, radius: 7,  aoeRadius: 0,  pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  dive:      { speed: 380, radius: 12, aoeRadius: 54, pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  thorn:     { speed: 360, radius: 6,  aoeRadius: 0,  pierce: 1, count: 3, spread: 0.24, slowDuration: 0 },
  flame:     { speed: 320, radius: 10, aoeRadius: 48, pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  sonic:     { speed: 400, radius: 11, aoeRadius: 0,  pierce: 3, count: 1, spread: 0,    slowDuration: 0 },
  lightning: { speed: 460, radius: 12, aoeRadius: 62, pierce: 1, count: 1, spread: 0,    slowDuration: 0.9 },
  frost:     { speed: 350, radius: 9,  aoeRadius: 42, pierce: 1, count: 1, spread: 0,    slowDuration: 2.0 },
  carrot:    { speed: 380, radius: 8,  aoeRadius: 0,  pierce: 2, count: 1, spread: 0,    slowDuration: 0 },
};

export class CompanionManager {
  constructor() {
    this.activeCompanions = [];
  }

  resetForBattle(player, saveData) {
    this.activeCompanions = [];
    const activeIds = (saveData.companions?.active || []).slice(0, BALANCE.COMPANIONS.MAX_ACTIVE);

    activeIds.forEach((id, idx) => {
      const def = COMPANIONS.find((c) => c.id === id);
      if (!def) return;
      const lobbyLv = saveData.companions?.levels?.[id] || 1;
      const angle = (idx / Math.max(1, activeIds.length)) * Math.PI * 2 - Math.PI * 0.5;

      this.activeCompanions.push({
        id: def.id,
        def,
        x: player.x + Math.cos(angle) * 44,
        y: player.y + Math.sin(angle) * 44,
        orbitAngle: angle,
        lobbyLv,
        runLv: 1, // 인게임 3지선다 동료 강화 카드로 추가 상승 가능
        cooldownTimer: Math.random() * 0.4,
        attackFlash: 0,
      });
    });
  }

  upgradeInRun(companionId) {
    const comp = this.activeCompanions.find((c) => c.id === companionId);
    if (comp) {
      comp.runLv += 1;
      return true;
    }
    return false;
  }

  addTemporaryCompanion(companionDef, player, duration = 16) {
    if (!companionDef) return null;
    const existing = this.activeCompanions.find((c) => c.id === companionDef.id);
    if (existing) {
      existing.runLv += 1;
      existing.tempTimer = Math.max(existing.tempTimer || 0, duration);
      return existing;
    }
    const idx = this.activeCompanions.length;
    const sideAngle = (player?.facingAngle || 0) + (idx % 2 === 0 ? 1 : -1) * 1.8;
    const comp = {
      id: companionDef.id,
      def: companionDef,
      x: (player?.x || 0) + Math.cos(sideAngle) * 44,
      y: (player?.y || 0) + Math.sin(sideAngle) * 44,
      orbitAngle: sideAngle,
      lobbyLv: 1,
      runLv: 2,
      cooldownTimer: 0.1,
      attackFlash: 0,
      isTemporary: true,
      tempTimer: duration,
    };
    this.activeCompanions.push(comp);
    return comp;
  }

  update(dt, player, enemies, boss, combatSystem) {
    for (let i = this.activeCompanions.length - 1; i >= 0; i--) {
      const comp = this.activeCompanions[i];
      if (comp.isTemporary) {
        comp.tempTimer -= dt;
        if (comp.tempTimer <= 0) {
          this.activeCompanions.splice(i, 1);
          continue;
        }
      }
      if (comp.attackFlash > 0) comp.attackFlash = Math.max(0, comp.attackFlash - dt);

      // 우유 주변 좌/우 추종 목표 위치 계산 (동행 인원 확장 대응)
      const sideSign = i % 2 === 0 ? 1 : -1;
      const tierOffset = Math.floor(i / 2) * 0.65;
      const sideAngle = player.facingAngle + sideSign * (2.2 - tierOffset);
      const targetX = player.x + Math.cos(sideAngle) * 46;
      const targetY = player.y + Math.sin(sideAngle) * 46;

      const dx = targetX - comp.x;
      const dy = targetY - comp.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const followSpeed = Math.max(player.speed * 1.15, 220);
        const step = Math.min(dist, followSpeed * dt);
        comp.x += (dx / dist) * step;
        comp.y += (dy / dist) * step;
      }

      // 자동 공격 타이머
      comp.cooldownTimer -= dt;
      if (comp.cooldownTimer <= 0) {
        const target = this._findNearestTarget(comp, enemies, boss, comp.def.range);
        if (target) {
          comp.cooldownTimer = comp.def.cooldown;
          comp.attackFlash = 0.18;
          this._performAttack(comp, target, combatSystem);
        } else {
          comp.cooldownTimer = 0.15;
        }
      }
    }
  }

  _findNearestTarget(comp, enemies, boss, maxRange) {
    let best = null;
    let bestDist = maxRange;

    if (boss && boss.hp > 0) {
      const d = Math.hypot(boss.x - comp.x, boss.y - comp.y);
      if (d <= bestDist + boss.radius) {
        best = boss;
        bestDist = d;
      }
    }

    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - comp.x, e.y - comp.y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  _performAttack(comp, target, combatSystem) {
    const lvMult = 1 + (comp.lobbyLv - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL + (comp.runLv - 1) * 0.25;
    const dmg = Math.round(comp.def.baseAtk * lvMult);
    const style = comp.def.attackStyle;
    const projCfg = PROJECTILE_STYLES[style];

    if (projCfg) {
      const baseAngle = Math.atan2(target.y - comp.y, target.x - comp.x);
      const half = (projCfg.count - 1) / 2;
      for (let i = 0; i < projCfg.count; i++) {
        const angle = baseAngle + (i - half) * projCfg.spread;
        combatSystem.spawnProjectile({
          x: comp.x,
          y: comp.y,
          vx: Math.cos(angle) * projCfg.speed,
          vy: Math.sin(angle) * projCfg.speed,
          damage: dmg,
          radius: projCfg.radius,
          color: comp.def.color,
          aoeRadius: projCfg.aoeRadius,
          pierce: projCfg.pierce,
          slowDuration: projCfg.slowDuration,
          ttl: 1.15,
        });
      }
    } else {
      // 근접 할퀴기(루키) 또는 돌진(맥스)
      combatSystem.damageEnemy(target, dmg, comp.def.color);
      if (style === 'charge') {
        const ang = Math.atan2(target.y - comp.y, target.x - comp.x);
        target.x += Math.cos(ang) * 26;
        target.y += Math.sin(ang) * 26;
      }
    }
  }

  render(ctx, time) {
    for (const comp of this.activeCompanions) {
      ctx.save();
      const hover = comp.id === 'piji' ? Math.sin(time * 8) * 5 - 10 : Math.sin(time * 6) * 2;
      ctx.translate(comp.x, comp.y + hover);

      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 12 - hover, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 동료 본체 원형 배지 + 이모지
      ctx.fillStyle = comp.attackFlash > 0 ? '#ffffff' : comp.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(comp.def.icon, 0, 1);

      ctx.restore();
    }
  }
}

