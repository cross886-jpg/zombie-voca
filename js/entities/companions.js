/**
 * js/entities/companions.js
 * 서포트 동료 8종 고유 특기 & 브레멘 동행(등·어깨 탑승) 추종/전투 시스템
 *
 * [핵심 규칙]
 * 1. 전투 화면 최대 3개체 제한: [주인공 강아지] + [주인] + [서포트 동료 1슬롯]
 * 2. settingsStore의 companions.activeGround / activeRider 연동:
 *    - 지상 단독: groundCompanion 1마리 추종
 *    - 탑승 단독: riderCompanion 1마리 추종
 *    - 등 + 어깨 동시 장착 (브레멘 동행 대열):
 *      지상 동료 머리/등 위 (groundX, groundY - 18)에 탑승 동물을 얹어 1개체처럼 이동하며
 *      두 동료의 고유 특기를 모두 동시 발동!
 * 3. 8종 고유 특기:
 *    - sniffer_dog: 원거리 자석 파밍 반경 +120px & 보너스 코인 발굴
 *    - alley_cat: 근접 대시 출혈 및 좀비 30% 슬로우
 *    - herb_rabbit: 8초 주기 광역 약초 힐링 장판 (+5% HP & 주인 기력 회복)
 *    - rescue_shepherd: 전방 방패 넉백 & 아군 방어력 상승
 *    - park_pigeon: 바람 날갯짓 (아군 이동속도 +15%, 회피율 +12%)
 *    - chubby_squirrel: 5초 주기 도토리 폭탄 투척 광역 스턴 (1.2초 기절)
 *    - campus_owl: 퀴즈 출제 시 오답 1개 자동 제거 힌트 (쿨타임 15초)
 *    - lab_parrot: 짖기/음파 스킬 연사속도 +25%, 투사체 크기 +35% 증폭
 */

import { BALANCE } from '../config/balance.js';
import { BREEDS, COMPANIONS } from '../data/catalog.js';
import { getAffection } from '../core/saveStore.js';
import { drawDogCharacter } from './player.js';

const PROJECTILE_STYLES = {
  acorn:      { speed: 340, radius: 7,  aoeRadius: 0,  pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  acorn_bomb: { speed: 280, radius: 10, aoeRadius: 90, pierce: 0, count: 1, spread: 0,    slowDuration: 1.2 },
  dive:       { speed: 380, radius: 12, aoeRadius: 54, pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  thorn:      { speed: 360, radius: 6,  aoeRadius: 0,  pierce: 1, count: 3, spread: 0.24, slowDuration: 0 },
  flame:      { speed: 320, radius: 10, aoeRadius: 48, pierce: 1, count: 1, spread: 0,    slowDuration: 0 },
  sonic:      { speed: 400, radius: 11, aoeRadius: 0,  pierce: 3, count: 1, spread: 0,    slowDuration: 0 },
  amplifier:  { speed: 420, radius: 14, aoeRadius: 0,  pierce: 4, count: 1, spread: 0,    slowDuration: 0 },
  frost:      { speed: 350, radius: 9,  aoeRadius: 42, pierce: 1, count: 1, spread: 0,    slowDuration: 2.0 },
  carrot:     { speed: 380, radius: 8,  aoeRadius: 0,  pierce: 2, count: 1, spread: 0,    slowDuration: 0 },
};

export class CompanionManager {
  constructor() {
    this.groundComp = null;
    this.riderComp = null;
    this.isBremenStack = false;

    // 슬롯 공통 좌표 (강아지 측면 추종)
    this.slotX = 0;
    this.slotY = 0;

    // 특기 주기 타이머
    this.herbTimer = 4.0;
    this.acornBombTimer = 2.5;
    this.owlHintCooldown = 0;

    // 배변 이벤트 (하위 호환)
    this.poopList = [];
    this.poopCooldown = 25.0 + Math.random() * 15;
  }

  resetForBattle(player, saveData) {
    this.groundComp = null;
    this.riderComp = null;
    this.isBremenStack = false;
    this.poopList = [];
    this.poopCooldown = 25.0 + Math.random() * 15;
    this.herbTimer = 4.0;
    this.acornBombTimer = 2.5;
    this.owlHintCooldown = 0;

    const compsData = saveData?.companions || {};
    let gId = compsData.activeGround || null;
    let rId = compsData.activeRider || null;

    // 레거시 active 배열 호환 처리 (activeGround/activeRider 미지정 시)
    if (!gId && !rId && Array.isArray(compsData.active) && compsData.active.length > 0) {
      for (const id of compsData.active) {
        if (!gId && this._isGroundId(id)) {
          gId = id;
        } else if (!rId && this._isRiderId(id)) {
          rId = id;
        }
      }
      if (!gId && !rId && compsData.active[0]) {
        gId = compsData.active[0];
      }
    }

    if (gId) {
      this.groundComp = this._createCompanionInstance(gId, player, saveData);
    }
    if (rId) {
      this.riderComp = this._createCompanionInstance(rId, player, saveData);
    }

    this.isBremenStack = Boolean(this.groundComp && this.riderComp);

    // 슬롯 초기 좌표
    const startX = player ? player.x + 36 : 0;
    const startY = player ? player.y + 12 : 0;
    this.slotX = startX;
    this.slotY = startY;

    if (this.groundComp) {
      this.groundComp.x = startX;
      this.groundComp.y = startY;
    }
    if (this.riderComp) {
      this.riderComp.x = startX;
      this.riderComp.y = this.isBremenStack ? startY - 18 : startY - 10;
    }
  }

  _isGroundId(id) {
    const groundIds = ['sniffer_dog', 'alley_cat', 'herb_rabbit', 'rescue_shepherd', 'rookie', 'rabbit', 'max', 'spike', 'alpaca'];
    if (groundIds.includes(id)) return true;
    return Boolean(BREEDS.find((b) => b.id === id));
  }

  _isRiderId(id) {
    const riderIds = ['park_pigeon', 'chubby_squirrel', 'campus_owl', 'lab_parrot', 'piji', 'nuts', 'buung', 'penguin', 'mir'];
    return riderIds.includes(id);
  }

  _createCompanionInstance(id, player, saveData) {
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

    if (!def) {
      // 비상 폴백
      def = {
        id,
        name: '동행 친구',
        icon: '🐾',
        color: '#fbbf24',
        baseAtk: 16,
        cooldown: 1.0,
        range: 200,
        attackStyle: 'sonic',
      };
    }

    const lobbyLv = saveData?.companions?.levels?.[id] || 1;
    const aff = getAffection ? getAffection(id, saveData) : { level: 1 };

    return {
      id: def.id,
      def,
      isBreed,
      x: player ? player.x + 36 : 0,
      y: player ? player.y + 12 : 0,
      lobbyLv,
      runLv: 1,
      affLevel: aff.level || 1,
      cooldownTimer: Math.random() * 0.5,
      attackFlash: 0,
    };
  }

  upgradeInRun(companionId) {
    let upgraded = false;
    if (this.groundComp && this.groundComp.id === companionId) {
      this.groundComp.runLv += 1;
      upgraded = true;
    }
    if (this.riderComp && this.riderComp.id === companionId) {
      this.riderComp.runLv += 1;
      upgraded = true;
    }
    return upgraded;
  }

  /**
   * 캠퍼스 부엉이 고유 특기: 퀴즈 출제 시 오답 1개 자동 소거 힌트
   * @param {Array} choices
   * @returns {boolean} 소거 성공 여부
   */
  tryEliminateWrongChoice(choices) {
    const hasOwl = (this.riderComp && (this.riderComp.id === 'campus_owl' || this.riderComp.id === 'buung')) ||
                   (this.groundComp && (this.groundComp.id === 'campus_owl' || this.groundComp.id === 'buung'));

    if (!hasOwl || this.owlHintCooldown > 0 || !Array.isArray(choices) || choices.length <= 2) {
      return false;
    }

    // 오답 1개 탐색 및 비활성화
    const wrongIdxList = [];
    choices.forEach((c, i) => {
      if (!c.isCorrect && !c.isEliminated) {
        wrongIdxList.push(i);
      }
    });

    if (wrongIdxList.length > 0) {
      const pickIdx = wrongIdxList[Math.floor(Math.random() * wrongIdxList.length)];
      choices[pickIdx].isEliminated = true;
      this.owlHintCooldown = 15.0; // 15초 쿨타임
      return true;
    }
    return false;
  }

  update(dt, player, enemies, boss, combatSystem) {
    if (!player) return { cleanedPoop: false, poopX: 0, poopY: 0 };

    if (this.owlHintCooldown > 0) {
      this.owlHintCooldown = Math.max(0, this.owlHintCooldown - dt);
    }

    // 1. 추종 목표 위치 산출 (강아지 오른쪽/측면 38px)
    const sideAngle = player.facingAngle + 1.6;
    const targetX = player.x + Math.cos(sideAngle) * 38;
    const targetY = player.y + Math.sin(sideAngle) * 38;

    const dx = targetX - this.slotX;
    const dy = targetY - this.slotY;
    const dist = Math.hypot(dx, dy);

    if (dist > 4) {
      const followSpeed = Math.max(player.speed * 1.15, 180);
      const step = Math.min(dist, followSpeed * dt);
      this.slotX += (dx / dist) * step;
      this.slotY += (dy / dist) * step;
    }

    // 지상 & 탑승 동료 좌표 동기화
    if (this.groundComp) {
      this.groundComp.x = this.slotX;
      this.groundComp.y = this.slotY;
    }
    if (this.riderComp) {
      this.riderComp.x = this.slotX;
      // 브레멘 상하 합체 시 지상 동료의 머리/등 위 (-18px)
      this.riderComp.y = this.isBremenStack ? this.slotY - 18 : this.slotY - 10;
    }

    // 2. 동료 8종 고유 패시브 & 액티브 특기 발동

    // [특기 1: sniffer_dog (공항 탐지견)] 자석 파밍 반경 대폭 증가 (+120px)
    const hasSniffer = (this.groundComp?.id === 'sniffer_dog');
    if (hasSniffer) {
      player.pickupRadius = Math.max(player.pickupRadius, BALANCE.PLAYER.PICKUP_RADIUS + 120);
    }

    // [특기 5: park_pigeon (공원 비둘기)] 이동속도 +15%
    const hasPigeon = (this.riderComp?.id === 'park_pigeon' || this.riderComp?.id === 'piji');
    if (hasPigeon) {
      player.speed = Math.max(player.speed, BALANCE.PLAYER.BASE_SPEED * 1.15);
    }

    // [특기 8: lab_parrot (실험실 앵무새)] 음파 스킬 증폭 플래그
    const hasParrot = (this.riderComp?.id === 'lab_parrot');
    if (hasParrot && combatSystem) {
      combatSystem.parrotAmplified = true;
    } else if (combatSystem) {
      combatSystem.parrotAmplified = false;
    }

    // [특기 3: herb_rabbit (약초 토끼)] 8초 주기 광역 체력 회복 장판
    const hasRabbit = (this.groundComp?.id === 'herb_rabbit' || this.groundComp?.id === 'rabbit');
    if (hasRabbit) {
      this.herbTimer -= dt;
      if (this.herbTimer <= 0) {
        this.herbTimer = 8.0;
        const healAmt = Math.max(1, Math.round(player.maxHp * 0.05));
        player.heal(healAmt);
        if (player.owner) {
          player.owner.stamina = Math.min(100, player.owner.stamina + 35);
        }
        combatSystem?.spawnDamageText?.(player.x, player.y - 25, `+${healAmt} HP 🌿 약초 힐`, '#4ade80', 1.0);
      }
    }

    // [특기 6: chubby_squirrel (뚱뚱한 다람쥐)] 5초 주기 도토리 폭탄 투척 광역 스턴
    const hasSquirrel = (this.riderComp?.id === 'chubby_squirrel' || this.riderComp?.id === 'nuts');
    if (hasSquirrel) {
      this.acornBombTimer -= dt;
      if (this.acornBombTimer <= 0) {
        this.acornBombTimer = 5.0;
        const target = this._findNearestTarget(this.slotX, this.slotY, enemies, boss, 280);
        if (target && combatSystem) {
          const ang = Math.atan2(target.y - this.slotY, target.x - this.slotX);
          combatSystem.spawnProjectile({
            x: this.slotX,
            y: this.slotY - 14,
            vx: Math.cos(ang) * 290,
            vy: Math.sin(ang) * 290,
            damage: 45,
            radius: 12,
            color: '#ea580c',
            shape: 'pellet',
            aoeRadius: 95,
            slowDuration: 1.2, // 1.2초 광역 스턴
            ttl: 0.9,
          });
          combatSystem.spawnDamageText?.(this.slotX, this.slotY - 32, '🐿️ 쾅! 도토리 폭탄!', '#ea580c', 0.8);
        }
      }
    }

    // [특기 4: rescue_shepherd (구조대 셰퍼드)] 전방 방패 넉백 돌진
    const hasShepherd = (this.groundComp?.id === 'rescue_shepherd' || this.groundComp?.id === 'max');
    if (hasShepherd) {
      for (const e of enemies) {
        if (e.hp > 0 && Math.hypot(e.x - this.slotX, e.y - this.slotY) <= 65) {
          const ang = Math.atan2(e.y - this.slotY, e.x - this.slotX);
          e.knockVx += Math.cos(ang) * 160;
          e.knockVy += Math.sin(ang) * 160;
        }
      }
    }

    // 3. 지상 및 탑승 동료 기본 공격 주기
    const compsToUpdate = [this.groundComp, this.riderComp].filter(Boolean);
    for (const comp of compsToUpdate) {
      if (comp.id === 'sniffer_dog') continue; // 탐지견은 비공격형

      comp.cooldownTimer -= dt;
      if (comp.cooldownTimer <= 0) {
        const target = this._findNearestTarget(comp.x, comp.y, enemies, boss, comp.def.range || 220);
        if (target && combatSystem) {
          comp.cooldownTimer = comp.def.cooldown || 1.0;
          comp.attackFlash = 0.16;
          this._performAttack(comp, target, combatSystem);
        } else {
          comp.cooldownTimer = 0.2;
        }
      }
    }

    return { cleanedPoop: false, poopX: 0, poopY: 0 };
  }

  _findNearestTarget(fromX, fromY, enemies, boss, maxRange) {
    let best = null;
    let bestDist = maxRange;

    if (boss && boss.hp > 0) {
      const d = Math.hypot(boss.x - fromX, boss.y - fromY);
      if (d <= bestDist) {
        best = boss;
        bestDist = d;
      }
    }

    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - fromX, e.y - fromY);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  _performAttack(comp, target, combatSystem) {
    const lvMult = 1 + (comp.lobbyLv - 1) * 0.14 + (comp.runLv - 1) * 0.25;
    const dmg = Math.round((comp.def.baseAtk || 18) * lvMult);
    const style = comp.def.attackStyle || 'sonic';
    const projCfg = PROJECTILE_STYLES[style] || PROJECTILE_STYLES.sonic;

    const angle = Math.atan2(target.y - comp.y, target.x - comp.x);

    // [특기 2: alley_cat] 근접 대시 출혈 + 슬로우
    if (comp.id === 'alley_cat' || comp.id === 'rookie') {
      combatSystem.damageEnemy(target, dmg, '#f59e0b', 2.5); // 2.5초 슬로우
      combatSystem.spawnDamageText?.(target.x, target.y - 18, '🩸 출혈', '#ef4444', 0.6);
      return;
    }

    combatSystem.spawnProjectile({
      x: comp.x,
      y: comp.y,
      vx: Math.cos(angle) * projCfg.speed,
      vy: Math.sin(angle) * projCfg.speed,
      damage: dmg,
      radius: projCfg.radius,
      color: comp.def.color || '#38bdf8',
      aoeRadius: projCfg.aoeRadius,
      pierce: projCfg.pierce,
      slowDuration: projCfg.slowDuration,
      ttl: 1.1,
    });
  }

  render(ctx, time) {
    // 동료가 전혀 장착되지 않은 경우 미렌더링
    if (!this.groundComp && !this.riderComp) return;

    ctx.save();
    const bob = Math.sin(time * 7) * 2;

    // 1. 바닥 그림자 (1개체 슬롯 그림자)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(this.slotX, this.slotY + 11, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 브레멘 상하 합체 시 결합 안장 렌더링
    if (this.isBremenStack) {
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(this.slotX - 7, this.slotY - 11, 14, 5, 2)
        : ctx.rect(this.slotX - 7, this.slotY - 11, 14, 5);
      ctx.fill();
    }

    // 3. 지상 동료 렌더링
    if (this.groundComp) {
      ctx.save();
      ctx.translate(this.groundComp.x, this.groundComp.y + bob);

      if (this.groundComp.isBreed) {
        drawDogCharacter(ctx, {
          breedId: this.groundComp.def.id,
          scale: 0.8,
          bodyY: 0,
          lookX: 0,
        });
      } else {
        ctx.fillStyle = this.groundComp.attackFlash > 0 ? '#ffffff' : this.groundComp.def.color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.groundComp.def.icon || '🐾', 0, 1);
      }
      ctx.restore();
    }

    // 4. 탑승 동료 렌더링 (브레멘 합체 시 지상 동료 등 위)
    if (this.riderComp) {
      ctx.save();
      const riderBob = this.isBremenStack ? bob * 1.3 : Math.sin(time * 9) * 4 - 6;
      ctx.translate(this.riderComp.x, this.riderComp.y + riderBob);

      ctx.fillStyle = this.riderComp.attackFlash > 0 ? '#ffffff' : this.riderComp.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.riderComp.def.icon || '🐾', 0, 1);

      // 브레멘 탑승 배지 (합체 시 귀여운 왕관/하트)
      if (this.isBremenStack) {
        ctx.font = '8px sans-serif';
        ctx.fillText('✨', 7, -8);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
