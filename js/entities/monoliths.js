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
      const topMargin = 120; // 상단 전광판 높이 감안 안전 마진
      const bottomMargin = 138; // 정면 진입 발판(Y+38, 반경 28) 및 하단 통과 여유 감안 안전 마진
      const clampX = (val) => Math.max(margin, Math.min(arenaWidth - margin, val));
      const clampY = (val) => Math.max(margin + topMargin, Math.min(arenaHeight - bottomMargin, val));

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
        captureProgress: 0, // 0 ~ 1 (1.0초 완충)
        radius: BALANCE.MONOLITH.CAPTURE_RADIUS || 28, // 강철 벙커 해치 본체 물리 충돌 차단 반경 (엄폐물)
        entryOffsetY: BALANCE.MONOLITH.ENTRY_OFFSET_Y || 38, // 정면 진입 발판 Y 오프셋
        entryRadius: BALANCE.MONOLITH.ENTRY_RADIUS || 28, // 정면 진입 발판 판정 반경
        hatchOpen: 0,
        trapWarning: false,
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
        // 해치 본체 중심이 아니라 정면 진입 발판 영역 안으로 플레이어가 들어갔을 때만 판정
        const entryX = m.x;
        const entryY = m.y + (m.entryOffsetY || 38);
        const distToEntry = Math.hypot(player.x - entryX, player.y - entryY);
        const inEntryZone = distToEntry <= (m.entryRadius || 28) + player.radius * 0.35;

        if (inEntryZone) {
          m.captureProgress += dt / (BALANCE.MONOLITH.CAPTURE_TIME_SEC || 1.0);
          captureTicking = true;
          if (m.captureProgress >= 1) {
            resolvedMonolith = m;
            break;
          }
        } else if (m.captureProgress > 0) {
          m.captureProgress = Math.max(0, m.captureProgress - dt * 1.5);
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

      // 풀피(100% 체력) 상태에서는 회복 뼈다귀가 헛되이 소모되지 않도록 자석 흡수 및 획득 방지
      const isFullHp = player.hp >= player.maxHp;
      if (d.type === 'snack' && isFullHp) {
        continue;
      }

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

    // 2. 4개 지하 벙커 해치 & 정면 진입 발판 (Bunker Hatch) 렌더링
    for (const m of this.monoliths) {
      ctx.save();
      const riseOffset = (1 - this.riseProgress) * 36;
      const pulse = Math.sin(time * 4 + m.id) * 2;
      ctx.translate(m.x, m.y + riseOffset);
      ctx.globalAlpha = 0.25 + this.riseProgress * 0.75;

      const isHacking = m.captureProgress > 0;
      const isSuccess = m.highlighted;
      const isTrap = m.trapWarning;

      // ==========================================
      // [A. 정면 진입 발판 (Entry Zone Footpad)]
      // ==========================================
      const footY = m.entryOffsetY || 38;
      const footW = 56;
      const footH = 34;
      const footR = m.entryRadius || 28;

      // 발판 베이스 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, footY + 4, footW / 2 + 2, footH / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // 발판 내부 배경 (금속 격자 미끄럼 방지 플레이트)
      const padGrad = ctx.createLinearGradient(0, footY - footH / 2, 0, footY + footH / 2);
      if (isSuccess) {
        padGrad.addColorStop(0, 'rgba(6, 78, 59, 0.9)');
        padGrad.addColorStop(1, 'rgba(4, 47, 35, 0.95)');
      } else if (isTrap) {
        padGrad.addColorStop(0, 'rgba(127, 29, 29, 0.9)');
        padGrad.addColorStop(1, 'rgba(69, 10, 10, 0.95)');
      } else if (isHacking) {
        padGrad.addColorStop(0, 'rgba(120, 53, 15, 0.9)');
        padGrad.addColorStop(1, 'rgba(69, 26, 3, 0.95)');
      } else {
        padGrad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
        padGrad.addColorStop(1, 'rgba(8, 14, 26, 0.94)');
      }
      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.roundRect(-footW / 2, footY - footH / 2, footW, footH, 10);
      ctx.fill();

      // 미끄럼 방지 사선 그립 텍스처
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-footW / 2, footY - footH / 2, footW, footH, 10);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 2;
      for (let s = -footW; s < footW; s += 8) {
        ctx.beginPath();
        ctx.moveTo(s, footY - footH);
        ctx.lineTo(s + footH, footY + footH);
        ctx.stroke();
      }
      ctx.restore();

      // 노란/민트색 점선 테두리 (Yellow / Mint Dashed Outline)
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -time * 20;
      ctx.strokeStyle = isSuccess
        ? '#34d399'
        : isTrap
          ? '#ef4444'
          : isHacking
            ? '#facc15'
            : 'rgba(52, 211, 153, 0.85)';
      ctx.lineWidth = isHacking || isSuccess || isTrap ? 2.8 : 2.0;
      ctx.shadowColor = isSuccess ? '#10b981' : (isHacking ? '#f59e0b' : 'rgba(52, 211, 153, 0.6)');
      ctx.shadowBlur = isHacking || isSuccess ? 10 : 4;
      ctx.beginPath();
      ctx.roundRect(-footW / 2, footY - footH / 2, footW, footH, 10);
      ctx.stroke();
      ctx.restore();

      // 발판 중앙 전술 진입 셰브론 화살표 (▲ 벙커 방향 유도)
      ctx.fillStyle = isSuccess
        ? '#34d399'
        : isTrap
          ? '#f87171'
          : isHacking
            ? '#facc15'
            : 'rgba(52, 211, 153, 0.9)';
      ctx.font = '900 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲ ENTRY ▲', 0, footY);

      // 발판 잠금 해제 게이지 원형 아크
      if (m.captureProgress > 0) {
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, footY, footR + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.captureProgress));
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================
      // [B. 강철 벙커 해치 본체 (radius: 28px 엄폐물)]
      // ==========================================
      const hatchR = m.radius || 28;

      // 지면 접지 섀도우
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 4, hatchR + 4, hatchR * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // 벙커 외벽 볼트 링 베벨
      const outerGrad = ctx.createRadialGradient(0, -4, 4, 0, 0, hatchR + 3);
      outerGrad.addColorStop(0, '#334155');
      outerGrad.addColorStop(0.7, '#1e293b');
      outerGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = outerGrad;
      ctx.strokeStyle = isSuccess ? '#34d399' : (isTrap ? '#ef4444' : (isHacking ? '#f59e0b' : '#475569'));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, hatchR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 외벽 고정용 산업용 육각 볼트 리벳 (8개 균등 배치)
      ctx.fillStyle = '#64748b';
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const bx = Math.cos(ang) * (hatchR - 4);
        const by = Math.sin(ang) * (hatchR - 4);
        ctx.beginPath();
        ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 내부 회전 개폐 해치 도어 (Inner Blast Hatch)
      const innerR = hatchR - 7;
      const innerGrad = ctx.createLinearGradient(-innerR, -innerR, innerR, innerR);
      innerGrad.addColorStop(0, '#1e293b');
      innerGrad.addColorStop(0.5, '#0f172a');
      innerGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = innerGrad;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3갈래 중장비 개폐 락 크로스바 (Heavy Locking Spokes)
      ctx.save();
      const hatchAngle = (m.hatchOpen || 0) * Math.PI * 0.4;
      ctx.rotate(hatchAngle);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const spokeAng = (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spokeAng) * (innerR - 3), Math.sin(spokeAng) * (innerR - 3));
        ctx.stroke();
      }
      ctx.restore();

      // 중앙 메카닉 허브 & LED 상태 비콘
      const beaconColor = isSuccess
        ? '#10b981'
        : isTrap
          ? '#ef4444'
          : isHacking
            ? '#f59e0b'
            : '#22d3ee';
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = beaconColor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = beaconColor;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ==========================================
      // [C. 상단 고정 단어 뜻 HUD 배너]
      // ==========================================
      const bannerW = 120;
      const bannerH = 32;
      const bannerY = -hatchR - 18 + pulse;

      ctx.save();
      ctx.shadowColor = isSuccess ? '#10b981' : (isTrap ? '#ef4444' : (isHacking ? '#f59e0b' : '#06b6d4'));
      ctx.shadowBlur = isSuccess ? 18 : 12;

      // 홀로그램 플레이트 배경
      ctx.fillStyle = isSuccess ? 'rgba(6, 78, 59, 0.95)' : (isTrap ? 'rgba(127, 29, 29, 0.95)' : 'rgba(10, 25, 47, 0.95)');
      ctx.strokeStyle = isSuccess ? '#34d399' : (isTrap ? '#ef4444' : (isHacking ? '#facc15' : 'rgba(34, 211, 238, 0.85)'));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 전자 자물쇠 홀로그램 아이콘 (좌측)
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lockIcon = isSuccess ? '🔓' : (isTrap ? '🚨' : (isHacking ? '⚡' : '🔒'));
      ctx.fillText(lockIcon, -bannerW / 2 + 15, bannerY);

      // 단어 뜻 텍스트 (우측, 크고 또렷한 굵은 폰트)
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.meaning, 10, bannerY);

      ctx.restore();
    }
  }
}

/**
 * 화면 밖 비석 인디케이터(말풍선) 좌표가 조이스틱 엄지 및 반대쪽 필살기(🔥) 버튼 영역에 가려지지 않도록 안전 구역 보정
 * @param {number} ax 말풍선 화면 X 좌표
 * @param {number} ay 말풍선 화면 Y 좌표
 * @param {number} viewW 뷰포트 너비
 * @param {number} viewH 뷰포트 높이
 * @param {'right'|'left'} dominantHand 주손 설정
 * @param {number} topPadding 상단 전광판 안전선 (기본 136px)
 * @returns {{ x: number, y: number }}
 */
export function clampIndicatorToThumbSafeZone(ax, ay, viewW, viewH, dominantHand = 'right', topPadding = 136) {
  const thumbW = 165;
  const thumbH = 170;
  const ultW = 95;
  const ultH = 95;
  const safeMargin = 8;

  // 상단 네온 전광판 하단 안전선(topPadding 136px) 이하로 내려오지 않도록 보정
  ay = Math.max(topPadding, ay);

  if (dominantHand === 'left') {
    // 왼손잡이: 좌측 하단 조이스틱(165x170) + 우측 하단 필살기 버튼(95x95)
    const inDangerLeft = ax <= thumbW && ay >= viewH - thumbH;
    if (inDangerLeft) {
      const distToTop = ay - (viewH - thumbH - safeMargin);
      const distToRight = thumbW + safeMargin - ax;
      if (distToTop <= distToRight) {
        ay = viewH - thumbH - safeMargin;
      } else {
        ax = thumbW + safeMargin;
      }
    }
    const inDangerRight = ax >= viewW - ultW && ay >= viewH - ultH;
    if (inDangerRight) {
      const distToTop = ay - (viewH - ultH - safeMargin);
      const distToLeft = ax - (viewW - ultW - safeMargin);
      if (distToTop <= distToLeft) {
        ay = viewH - ultH - safeMargin;
      } else {
        ax = viewW - ultW - safeMargin;
      }
    }
  } else {
    // 오른손잡이: 우측 하단 조이스틱(165x170) + 좌측 하단 필살기 버튼(95x95)
    const inDangerRight = ax >= viewW - thumbW && ay >= viewH - thumbH;
    if (inDangerRight) {
      const distToTop = ay - (viewH - thumbH - safeMargin);
      const distToLeft = ax - (viewW - thumbW - safeMargin);
      if (distToTop <= distToLeft) {
        ay = viewH - thumbH - safeMargin;
      } else {
        ax = viewW - thumbW - safeMargin;
      }
    }
    const inDangerLeft = ax <= ultW && ay >= viewH - ultH;
    if (inDangerLeft) {
      const distToTop = ay - (viewH - ultH - safeMargin);
      const distToRight = ultW + safeMargin - ax;
      if (distToTop <= distToRight) {
        ay = viewH - ultH - safeMargin;
      } else {
        ax = ultW + safeMargin;
      }
    }
  }

  return { x: ax, y: ay };
}

