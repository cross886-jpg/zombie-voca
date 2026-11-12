/**
 * js/game/obstacles.js
 * 데이터 주도 필드 장애물 관리 및 공통 원형 물리 충돌 해결(Circle-Circle Resolution)
 */

const OBSTACLE_THEMES = Object.freeze({
  default: [
    { type: 'pole', label: '가로등', radius: 22, color: '#334155', accent: '#38bdf8' },
    { type: 'barricade', label: '바리케이드', radius: 28, color: '#475569', accent: '#f59e0b' },
    { type: 'crate', label: '보급상자', radius: 24, color: '#3f3f46', accent: '#22d3ee' },
    { type: 'hydrant', label: '소화전', radius: 18, color: '#7f1d1d', accent: '#fb7185' },
  ],
});

/**
 * 단일 공통 원형 충돌 밀어내기 (플레이어·좀비 공용)
 * @param {{ x: number, y: number, radius: number }} entity
 * @param {Array<{ x: number, y: number, radius: number }>} colliders
 */
export function resolveCircleCollisions(entity, colliders) {
  if (!colliders || colliders.length === 0) return;
  for (const col of colliders) {
    const dx = entity.x - col.x;
    const dy = entity.y - col.y;
    const minDist = col.radius + entity.radius;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : 1;
      const ny = dist > 0.001 ? dy / dist : 0;
      entity.x = col.x + nx * minDist;
      entity.y = col.y + ny * minDist;
    }
  }
}

export class ObstacleManager {
  constructor() {
    this.obstacles = [];
  }

  resetForBattle(arenaWidth, arenaHeight, playerX, playerY, themeKey = 'default', count = 7) {
    this.obstacles = [];
    const palette = OBSTACLE_THEMES[themeKey] || OBSTACLE_THEMES.default;
    const margin = 120;
    const safePlayerRadius = 180;
    const minBetweenObstacles = 190;

    for (let i = 0; i < count; i++) {
      const spec = palette[i % palette.length];
      let placed = null;

      for (let attempt = 0; attempt < 30; attempt++) {
        const cx = margin + Math.random() * Math.max(40, arenaWidth - margin * 2);
        const cy = margin + Math.random() * Math.max(40, arenaHeight - margin * 2);

        const farFromPlayer = Math.hypot(cx - playerX, cy - playerY) >= safePlayerRadius + spec.radius;
        const farFromOthers = this.obstacles.every(
          (o) => Math.hypot(cx - o.x, cy - o.y) >= minBetweenObstacles
        );

        if (farFromPlayer && farFromOthers) {
          placed = {
            id: `obs_${i}`,
            type: spec.type,
            label: spec.label,
            x: cx,
            y: cy,
            radius: spec.radius,
            color: spec.color,
            accent: spec.accent,
          };
          break;
        }
      }

      if (placed) {
        this.obstacles.push(placed);
      }
    }
  }

  render(ctx) {
    for (const o of this.obstacles) {
      ctx.save();
      ctx.translate(o.x, o.y);

      // 바닥 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, o.radius * 0.65, o.radius * 1.05, o.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (o.type === 'barricade' || o.type === 'crate') {
        const w = o.radius * 1.65;
        const h = o.radius * 1.35;
        ctx.fillStyle = o.color;
        ctx.strokeStyle = o.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2 - 4, w, h, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = o.accent;
        ctx.fillRect(-w / 2 + 5, -2, w - 10, 4);
      } else {
        // 원형 기둥형 오브젝트 (전봇대/가로등/소화전)
        ctx.fillStyle = o.color;
        ctx.strokeStyle = o.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -4, o.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = o.accent;
        ctx.beginPath();
        ctx.arc(0, -4, o.radius * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

