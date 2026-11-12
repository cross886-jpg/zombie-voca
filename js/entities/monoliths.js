/**
 * js/entities/monoliths.js
 * 4개 입체 홀로그램 비석(4사분면 스폰, 220px 최소 거리, 0.4초 점령 게이지·즉시 소멸) + 보카 젬·간식 드롭
 */

import { BALANCE, rollGemTier } from '../config/balance.js';

export class MonolithManager {
  constructor() {
    this.monoliths = [];
    this.drops = [];
    this.riseProgress = 0;
    this.revealOnly = false;
  }

  resetForBattle() {
    this.monoliths = [];
    this.drops = [];
    this.riseProgress = 0;
    this.revealOnly = false;
  }

  /**
   * 플레이어 주변 4사분면에 가로 364~588px, 세로 448~728px 범위로 4개 비석 스폰
   * @param {Array<{ wordId: number, meaning: string, isCorrect: boolean }>} choices
   * @param {number} arenaWidth
   * @param {number} arenaHeight
   * @param {number} playerX
   * @param {number} playerY
   */
  spawnMonoliths(choices, arenaWidth, arenaHeight, playerX, playerY, obstacles = []) {
    this.monoliths = [];
    this.riseProgress = 0;
    this.revealOnly = false;

    const margin = 88;
    const quadrantDirs = [
      { sx: -1, sy: -1 },
      { sx: 1, sy: -1 },
      { sx: -1, sy: 1 },
      { sx: 1, sy: 1 },
    ];

    const placed = [];

    choices.forEach((choice, idx) => {
      const dir = quadrantDirs[idx % 4];
      const clampX = (val) => Math.max(margin, Math.min(arenaWidth - margin, val));
      const clampY = (val) => Math.max(margin, Math.min(arenaHeight - margin, val));

      // 사분면별 기본 오프셋(기존 대비 1.4배 확대): 가로 반경 182~294px, 세로 반경 224~364px
      let px = clampX(playerX + dir.sx * 230);
      let py = clampY(playerY + dir.sy * 285);

      for (let attempt = 0; attempt < 25; attempt++) {
        const offsetX = 182 + Math.random() * 112;
        const offsetY = 224 + Math.random() * 140;
        const cx = clampX(playerX + dir.sx * offsetX);
        const cy = clampY(playerY + dir.sy * offsetY);

        const farFromPlayer = Math.hypot(cx - playerX, cy - playerY) >= 190;
        const farFromOthers = placed.every(
          (p) => Math.hypot(cx - p.x, cy - p.y) >= 252
        );
        const farFromObstacles = obstacles.every(
          (o) => Math.hypot(cx - o.x, cy - o.y) >= o.radius + 95
        );

        if (farFromPlayer && farFromOthers && farFromObstacles) {
          px = cx;
          py = cy;
          break;
        }
      }

      const monolith = {
        id: idx,
        x: px,
        y: py,
        meaning: choice.meaning,
        isCorrect: choice.isCorrect,
        wordId: choice.wordId,
        captureProgress: 0, // 0 ~ 1 (0.4초 완충)
        radius: BALANCE.MONOLITH.CAPTURE_RADIUS,
      };
      placed.push(monolith);
      this.monoliths.push(monolith);
    });
  }

  clearMonoliths() {
    this.monoliths = [];
  }

  spawnDrop(type, x, y, value = BALANCE.COMBAT.GEM_XP_VALUE) {
    const tier = type === 'gem' ? rollGemTier() : null;
    this.drops.push({
      type, // 'gem' | 'snack'
      x,
      y,
      value,
      tier,
      radius: tier ? Math.round(10 * tier.scale) : 10,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  /**
   * 비석 점령 판정 및 드롭 아이템 자석 흡수
   * @returns {{ resolvedMonolith: object | null, pickedGems: number, pickedSnacks: number, captureTicking: boolean }}
   */
  update(dt, player) {
    if (this.riseProgress < 1) {
      this.riseProgress = Math.min(1, this.riseProgress + dt * 3.5);
    }

    let resolvedMonolith = null;
    let captureTicking = false;

    if (!this.revealOnly) {
      for (const m of this.monoliths) {
        const dist = Math.hypot(player.x - m.x, player.y - m.y);
        if (dist <= m.radius + player.radius * 0.4) {
          m.captureProgress += dt / BALANCE.MONOLITH.CAPTURE_TIME_SEC;
          captureTicking = true;
          if (m.captureProgress >= 1) {
            resolvedMonolith = m;
            break;
          }
        } else if (m.captureProgress > 0) {
          m.captureProgress = Math.max(0, m.captureProgress - dt * 1.8);
        }
      }

      if (resolvedMonolith) {
        if (resolvedMonolith.isCorrect) {
          this.clearMonoliths();
        } else {
          // 오답 시 실제 정답 비석만 남겨 1.5초간 초록색 발광 테두리로 강조
          this.revealOnly = true;
          this.monoliths = this.monoliths
            .filter((m) => m.isCorrect)
            .map((m) => ({ ...m, captureProgress: 0, highlighted: true }));
        }
      }
    }

    // 보카 젬 & 간식 자석 흡수
    let pickedGems = 0;
    let pickedGemCharge = 0;
    const pickedHighTiers = [];
    let pickedSnacks = 0;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.bobPhase += dt * 5;
      const dx = player.x - d.x;
      const dy = player.y - d.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= player.pickupRadius) {
        const pullSpeed = 420;
        const step = Math.min(dist, pullSpeed * dt);
        if (dist > 0.01) {
          d.x += (dx / dist) * step;
          d.y += (dy / dist) * step;
        }
      }

      if (dist <= player.radius + d.radius + 6) {
        if (d.type === 'gem') {
          const tier = d.tier || BALANCE.GEM_TIERS[0];
          pickedGems += d.value;
          pickedGemCharge += tier.charge;
          if (tier.id === 'purple' || tier.id === 'gold') {
            pickedHighTiers.push(tier);
          }
        } else if (d.type === 'snack') {
          pickedSnacks += 1;
        }
        this.drops.splice(i, 1);
      }
    }

    return { resolvedMonolith, pickedGems, pickedGemCharge, pickedHighTiers, pickedSnacks, captureTicking };
  }

  render(ctx, time) {
    // 1. 보카 젬 & 간식 드롭 렌더링
    for (const d of this.drops) {
      ctx.save();
      const bobY = Math.sin(d.bobPhase) * 3;
      ctx.translate(d.x, d.y + bobY);

      if (d.type === 'gem') {
        const tier = d.tier || BALANCE.GEM_TIERS[0];
        const s = tier.scale;
        ctx.fillStyle = tier.color;
        ctx.shadowColor = tier.glow;
        ctx.shadowBlur = tier.blur;
        ctx.beginPath();
        ctx.moveTo(0, -8 * s);
        ctx.lineTo(7 * s, 0);
        ctx.lineTo(0, 8 * s);
        ctx.lineTo(-7 * s, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦴', 0, 0);
      }
      ctx.restore();
    }

    // 2. 4개 입체 홀로그램 비석 렌더링
    for (const m of this.monoliths) {
      ctx.save();
      const riseOffset = (1 - this.riseProgress) * 32;
      const pulse = Math.sin(time * 4 + m.id) * 2.5;
      ctx.translate(m.x, m.y + riseOffset);
      ctx.globalAlpha = 0.25 + this.riseProgress * 0.75;

      // 바닥 점령 원형 패드
      ctx.fillStyle = m.highlighted ? 'rgba(6, 78, 59, 0.82)' : 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = m.highlighted
        ? '#34d399'
        : m.captureProgress > 0
          ? '#facc15'
          : 'rgba(34, 211, 238, 0.75)';
      ctx.lineWidth = m.highlighted ? 4 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 0.4초 점령 진행 게이지 링
      if (m.captureProgress > 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, m.radius * 0.88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.captureProgress));
        ctx.stroke();
      }

      // 2.5D 입체 홀로그램 기둥 (확대 시인성 개선)
      const pillarW = 104;
      const pillarH = 56;
      const floatY = -38 + pulse;

      ctx.fillStyle = m.highlighted ? 'rgba(6, 78, 59, 0.94)' : 'rgba(8, 47, 73, 0.92)';
      ctx.strokeStyle = m.highlighted ? '#34d399' : '#22d3ee';
      ctx.lineWidth = m.highlighted ? 3.5 : 2.5;
      ctx.shadowColor = m.highlighted ? '#10b981' : '#06b6d4';
      ctx.shadowBlur = m.highlighted ? 24 : 16;
      ctx.beginPath();
      ctx.roundRect(-pillarW / 2, floatY - pillarH / 2, pillarW, pillarH, 12);
      ctx.fill();
      ctx.stroke();

      // 기둥 하단 홀로그램 빛줄기
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
      ctx.beginPath();
      ctx.moveTo(-26, floatY + pillarH / 2);
      ctx.lineTo(26, floatY + pillarH / 2);
      ctx.lineTo(14, 0);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();

      // 정제된 한국어 뜻 (최대 8글자, 크고 선명한 폰트)
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 18px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.meaning, 0, floatY);

      ctx.restore();
    }
  }
}

