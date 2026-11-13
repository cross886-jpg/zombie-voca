/**
 * js/entities/companions.js
 * 동물 친구 & 서포트 수호견 추종 AI, 다마고치 친밀도 5단계 행동 진화 및 돌발 배변 이벤트
 */

import { BALANCE } from '../config/balance.js';
import { BREEDS, COMPANIONS } from '../data/catalog.js';
import { getAffection } from '../core/saveStore.js';
import { drawDogCharacter } from './player.js';

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
    this.poopList = [];
    this.poopCooldown = 22.0 + Math.random() * 15;
  }

  resetForBattle(player, saveData) {
    this.activeCompanions = [];
    this.poopList = [];
    this.poopCooldown = 22.0 + Math.random() * 15;
    const activeIds = (saveData.companions?.active || []).slice(0, BALANCE.COMPANIONS.MAX_ACTIVE || 3);

    activeIds.forEach((id, idx) => {
      let def = COMPANIONS.find((c) => c.id === id);
      let isBreed = false;
      if (!def) {
        const breedDef = BREEDS.find((b) => b.id === id);
        if (breedDef) {
          isBreed = true;
          def = {
            id: breedDef.id,
            name: breedDef.name,
            icon: breedDef.icon,
            color: breedDef.color,
            baseAtk: 18,
            cooldown: 0.9,
            range: 230,
            attackStyle: 'sonic',
            isBreed: true,
          };
        }
      }
      if (!def) return;

      const lobbyLv = saveData.companions?.levels?.[id] || 1;
      const aff = getAffection(id, saveData);
      const angle = (idx / Math.max(1, activeIds.length)) * Math.PI * 2 - Math.PI * 0.5;

      this.activeCompanions.push({
        id: def.id,
        def,
        isBreed,
        x: player.x + Math.cos(angle) * 44,
        y: player.y + Math.sin(angle) * 44,
        orbitAngle: angle,
        lobbyLv,
        runLv: 1,
        affLevel: aff.level || 1, // 1~5 친밀도 단계
        cooldownTimer: Math.random() * 0.4,
        attackFlash: 0,
        jointSkillTimer: 7.0, // 5단계 합동 필살기 타이머
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
      isBreed: false,
      x: (player?.x || 0) + Math.cos(sideAngle) * 44,
      y: (player?.y || 0) + Math.sin(sideAngle) * 44,
      orbitAngle: sideAngle,
      lobbyLv: 1,
      runLv: 2,
      affLevel: 3,
      cooldownTimer: 0.1,
      attackFlash: 0,
      isTemporary: true,
      tempTimer: duration,
      jointSkillTimer: 7.0,
    };
    this.activeCompanions.push(comp);
    return comp;
  }

  update(dt, player, enemies, boss, combatSystem) {
    let result = { cleanedPoop: false, poopX: 0, poopY: 0 };

    // 1. 돌발 배변 이벤트 스폰 (친밀도가 1~2단계이거나 랜덤 쿨다운 종료 시)
    this.poopCooldown -= dt;
    if (this.poopCooldown <= 0 && this.activeCompanions.length > 0) {
      // 1~2단계 우선 또는 랜덤 동료 선택
      const lowAff = this.activeCompanions.find((c) => c.affLevel <= 2);
      const poopComp = lowAff || this.activeCompanions[Math.floor(Math.random() * this.activeCompanions.length)];
      if (poopComp) {
        this.poopList.push({
          id: Math.random().toString(36).slice(2),
          x: poopComp.x,
          y: poopComp.y,
          cleanProgress: 0,
          timer: 45,
        });
        combatSystem.spawnDamageText(poopComp.x, poopComp.y - 18, '앗! 💩 응가!', '#f59e0b', 1.15);
      }
      this.poopCooldown = 32.0 + Math.random() * 25;
    }

    // 2. 바닥 응가 및 치우기 상호작용 업데이트
    for (let pIdx = this.poopList.length - 1; pIdx >= 0; pIdx--) {
      const p = this.poopList[pIdx];
      p.timer -= dt;
      if (p.timer <= 0) {
        this.poopList.splice(pIdx, 1);
        continue;
      }

      // 주변 좀비 어그로 유인 (반경 85px)
      for (const e of enemies) {
        if (e.hp > 0) {
          const ed = Math.hypot(e.x - p.x, e.y - p.y);
          if (ed < 85) {
            e.x += ((p.x - e.x) / (ed || 1)) * 12 * dt;
            e.y += ((p.y - e.y) / (ed || 1)) * 12 * dt;
          }
        }
      }

      // 플레이어가 근접(28px 이내)하여 0.8초간 치워주면 완료!
      const pDist = Math.hypot(player.x - p.x, player.y - p.y);
      if (pDist < player.radius + 20) {
        p.cleanProgress += dt;
        if (p.cleanProgress >= 0.8) {
          result.cleanedPoop = true;
          result.poopX = p.x;
          result.poopY = p.y;
          this.poopList.splice(pIdx, 1);
          continue;
        }
      } else {
        p.cleanProgress = Math.max(0, p.cleanProgress - dt * 0.6);
      }
    }

    // 3. 동료 추종 AI 및 친밀도 5단계 행동 진화
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

      const aff = comp.affLevel || 1;
      let followDist = 44;
      let sideSpread = 2.1;
      let cooldownMult = 1.0;
      let dmgBonusMult = 1.0;

      // === 친밀도 5단계 AI 파라미터 분기 ===
      if (aff === 1) {
        // 1단계: 겁먹고 뒤로 멀찍이 도망 (65px 후방), 느린 공격 빈도
        followDist = 65;
        sideSpread = 2.8;
        cooldownMult = 1.45;
        dmgBonusMult = 0.85;
      } else if (aff === 2) {
        // 2단계: 주변에서 장난치며 통통 튐
        followDist = 48 + Math.sin(dt * 8 + i) * 6;
        sideSpread = 2.4;
        cooldownMult = 1.15;
      } else if (aff === 3) {
        // 3단계: 단짝 친구, 플레이어 옆 밀착 추격 공격 (+15% 피해)
        followDist = 40;
        sideSpread = 1.9;
        cooldownMult = 1.0;
        dmgBonusMult = 1.15;
      } else if (aff === 4) {
        // 4단계: 든든한 수호자 (+30% 피해, 쿨다운 -15%, 플레이어 근접 적 요격)
        followDist = 38;
        sideSpread = 1.6;
        cooldownMult = 0.85;
        dmgBonusMult = 1.3;

        // 플레이어에게 60px 이내로 접근하는 적 우선 넉백 방어
        for (const e of enemies) {
          if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) < 60) {
            const ang = Math.atan2(e.y - comp.y, e.x - comp.x);
            e.knockVx += Math.cos(ang) * 90;
            e.knockVy += Math.sin(ang) * 90;
            break;
          }
        }
      } else if (aff >= 5) {
        // 5단계: 소울메이트 (쿨다운 -30%, 피해 +50%, 주기적 합동 필살기 발동)
        followDist = 36;
        sideSpread = 1.5;
        cooldownMult = 0.7;
        dmgBonusMult = 1.5;

        comp.jointSkillTimer -= dt;
        if (comp.jointSkillTimer <= 0) {
          comp.jointSkillTimer = 7.5;
          // 관통 합동 음파 폭풍 발사
          combatSystem.spawnProjectile({
            x: comp.x,
            y: comp.y,
            vx: Math.cos(player.facingAngle) * 450,
            vy: Math.sin(player.facingAngle) * 450,
            damage: Math.round(comp.def.baseAtk * 3.5),
            radius: 18,
            color: '#ec4899',
            aoeRadius: 40,
            pierce: 5,
            slowDuration: 1.2,
            ttl: 1.5,
          });
          combatSystem.spawnDamageText(comp.x, comp.y - 25, '💖✨ 합동 필살기!', '#ec4899', 1.3);
        }
      }

      // 우유 주변 목표 위치 계산
      const sideSign = i % 2 === 0 ? 1 : -1;
      const tierOffset = Math.floor(i / 2) * 0.6;
      const sideAngle = player.facingAngle + sideSign * (sideSpread - tierOffset);
      const targetX = player.x + Math.cos(sideAngle) * followDist;
      const targetY = player.y + Math.sin(sideAngle) * followDist;

      const dx = targetX - comp.x;
      const dy = targetY - comp.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        const followSpeed = Math.max(player.speed * 1.2, 230);
        const step = Math.min(dist, followSpeed * dt);
        comp.x += (dx / dist) * step;
        comp.y += (dy / dist) * step;
      }

      // 자동 공격 타이머
      comp.cooldownTimer -= dt;
      if (comp.cooldownTimer <= 0) {
        const target = this._findNearestTarget(comp, enemies, boss, comp.def.range);
        if (target) {
          comp.cooldownTimer = comp.def.cooldown * cooldownMult;
          comp.attackFlash = 0.18;
          this._performAttack(comp, target, combatSystem, dmgBonusMult);
        } else {
          comp.cooldownTimer = 0.15;
        }
      }
    }

    return result;
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

  _performAttack(comp, target, combatSystem, dmgBonusMult = 1.0) {
    const lvMult = (1 + (comp.lobbyLv - 1) * BALANCE.COMPANIONS.ATK_PER_LEVEL + (comp.runLv - 1) * 0.25) * dmgBonusMult;
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
      combatSystem.damageEnemy(target, dmg, comp.def.color);
      if (style === 'charge') {
        const ang = Math.atan2(target.y - comp.y, target.x - comp.x);
        target.x += Math.cos(ang) * 26;
        target.y += Math.sin(ang) * 26;
      }
    }
  }

  render(ctx, time) {
    // 1. 바닥 응가 렌더링
    for (const p of this.poopList) {
      ctx.save();
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 응가 이모지
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💩', p.x, p.y);

      // 치우는 중일 때 0.8초 원형 게이지
      if (p.cleanProgress > 0) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const ratio = Math.min(1.0, p.cleanProgress / 0.8);
        ctx.arc(p.x, p.y, 16, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('치우는 중!', p.x, p.y - 18);
      }
      ctx.restore();
    }

    // 2. 동료 렌더링 (동물 친구 또는 서포트 강아지)
    for (const comp of this.activeCompanions) {
      ctx.save();
      const hover = comp.id === 'piji' ? Math.sin(time * 8) * 5 - 10 : Math.sin(time * 6) * 2;
      ctx.translate(comp.x, comp.y + hover);

      // 1단계 겁먹음 떨림 효과
      if (comp.affLevel === 1) {
        ctx.translate(Math.sin(time * 18) * 1.5, 0);
      }

      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 12 - hover, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (comp.isBreed) {
        // 서포트 강아지 렌더링
        drawDogCharacter(ctx, {
          breedId: comp.def.id,
          scale: 0.85,
          bodyY: 0,
          lookX: 0,
          isBipedal: false,
        });
      } else {
        // 동물 친구 본체 원형 배지 + 이모지
        ctx.fillStyle = comp.attackFlash > 0 ? '#ffffff' : comp.def.color;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.def.icon, 0, 1);
      }

      // 친밀도 하트 표시 (Lv.3 이상)
      if (comp.affLevel >= 3) {
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.affLevel >= 5 ? '💖' : '💕', 8, -10);
      }

      ctx.restore();
    }
  }
}
