/**
 * js/entities/companions.js
 * 동물 친구 4종(루키·넛츠·맥스·피지) 추종 AI 및 자동 전투 공격
 */

import { BALANCE } from '../config/balance.js';
import { COMPANIONS } from '../data/catalog.js';

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
      const angle = idx === 0 ? -Math.PI * 0.75 : -Math.PI * 0.25;

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

  update(dt, player, enemies, boss, combatSystem) {
    for (let i = 0; i < this.activeCompanions.length; i++) {
      const comp = this.activeCompanions[i];
      if (comp.attackFlash > 0) comp.attackFlash = Math.max(0, comp.attackFlash - dt);

      // 우유 주변 좌/우 추종 목표 위치 계산
      const sideAngle = player.facingAngle + (i === 0 ? 2.2 : -2.2);
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

    if (style === 'acorn' || style === 'dive') {
      const angle = Math.atan2(target.y - comp.y, target.x - comp.x);
      combatSystem.spawnProjectile({
        x: comp.x,
        y: comp.y,
        vx: Math.cos(angle) * (style === 'dive' ? 380 : 340),
        vy: Math.sin(angle) * (style === 'dive' ? 380 : 340),
        damage: dmg,
        radius: style === 'dive' ? 12 : 7,
        color: comp.def.color,
        aoeRadius: style === 'dive' ? 54 : 0,
        ttl: 1.1,
      });
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

