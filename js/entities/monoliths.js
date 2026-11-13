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
      const clampX = (val) => Math.max(margin, Math.min(arenaWidth - margin, val));
      const clampY = (val) => Math.max(margin + topMargin, Math.min(arenaHeight - margin, val));

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

    // 2. 4개 봉인된 긴급 구조 캡슐 (Sealed Rescue Pod) 렌더링
    for (const m of this.monoliths) {
      ctx.save();
      const riseOffset = (1 - this.riseProgress) * 36;
      const pulse = Math.sin(time * 4 + m.id) * 2;
      ctx.translate(m.x, m.y + riseOffset);
      ctx.globalAlpha = 0.25 + this.riseProgress * 0.75;

      const ringRadius = m.radius * 0.84;
      const isHacking = m.captureProgress > 0;
      const isSuccess = m.highlighted;
      const isTrap = m.trapWarning;

      // --- [1. 바닥 원형 해킹 존 & 점선 펄스 링] ---
      const padGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, ringRadius);
      if (isSuccess) {
        padGrad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
        padGrad.addColorStop(1, 'rgba(6, 78, 59, 0.18)');
      } else if (isTrap) {
        padGrad.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        padGrad.addColorStop(1, 'rgba(127, 29, 29, 0.2)');
      } else if (isHacking) {
        padGrad.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
        padGrad.addColorStop(1, 'rgba(120, 53, 15, 0.18)');
      } else {
        padGrad.addColorStop(0, 'rgba(34, 211, 238, 0.22)');
        padGrad.addColorStop(1, 'rgba(15, 23, 42, 0.65)');
      }
      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.fill();

      // 회전 점선 펄스 링
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 30;
      ctx.strokeStyle = isSuccess ? '#34d399' : (isTrap ? '#ef4444' : (isHacking ? '#facc15' : 'rgba(34, 211, 238, 0.75)'));
      ctx.lineWidth = isSuccess || isTrap ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4방향 사이버 크로스헤어 / 브래킷 마커
      ctx.strokeStyle = isSuccess ? '#34d399' : (isTrap ? '#f87171' : (isHacking ? '#fbbf24' : 'rgba(34, 211, 238, 0.8)'));
      ctx.lineWidth = 2;
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(cosA * (ringRadius - 8), sinA * (ringRadius - 8));
        ctx.lineTo(cosA * (ringRadius + 8), sinA * (ringRadius + 8));
        ctx.stroke();
      }

      // 0.4초 잠금 해제 게이지 원형 아크
      if (m.captureProgress > 0) {
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.captureProgress));
        ctx.stroke();
        ctx.restore();
      }

      // --- [2. 봉인된 긴급 구조 캡슐 본체 (불투명 금속·유리 재질 밀폐 캡슐)] ---
      const podY = -24;
      const podW = 54;
      const podH = 68;
      const hatchSlide = (m.hatchOpen || 0) * 26;

      // 접지 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 28, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // 하단 유압 지지 프레임 (Hydraulic Foot Clamps)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-28, -5, 10, 10);
      ctx.fillRect(18, -5, 10, 10);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-26, -3, 6, 6);
      ctx.fillRect(20, -3, 6, 6);

      // 외벽 아머 쉘 (다크 티타늄 메탈릭 그라데이션)
      const bodyGrad = ctx.createLinearGradient(-podW / 2, 0, podW / 2, 0);
      bodyGrad.addColorStop(0, '#0f172a');
      bodyGrad.addColorStop(0.3, '#334155');
      bodyGrad.addColorStop(0.7, '#1e293b');
      bodyGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = isSuccess ? '#34d399' : (isTrap ? '#ef4444' : (isHacking ? '#f59e0b' : '#475569'));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-podW / 2, podY - podH / 2, podW, podH, 16);
      ctx.fill();
      ctx.stroke();

      // 전면 봉인 해치 / 강화 방폭 윈도우 (안이 보이지 않는 불투명 편광 옵시디언 틴팅)
      const glassW = 38;
      const glassH = 46;
      const glassY = podY - 2 - hatchSlide;

      const glassGrad = ctx.createLinearGradient(-glassW / 2, glassY - glassH / 2, glassW / 2, glassY + glassH / 2);
      glassGrad.addColorStop(0, '#091c24');
      glassGrad.addColorStop(0.5, '#0d2830');
      glassGrad.addColorStop(1, '#050f14');

      ctx.fillStyle = glassGrad;
      ctx.strokeStyle = isSuccess ? '#10b981' : (isTrap ? '#ef4444' : (isHacking ? '#d97706' : '#164e63'));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-glassW / 2, glassY - glassH / 2, glassW, glassH, 10);
      ctx.fill();
      ctx.stroke();

      // 방폭 유리 반사광 (사선 글레어 스트라이프: 불투명성을 돋보이게 하는 리얼한 광택)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-glassW / 2, glassY - glassH / 2, glassW, glassH, 10);
      ctx.clip();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-glassW, glassY + glassH);
      ctx.lineTo(glassW, glassY - glassH);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-glassW + 14, glassY + glassH);
      ctx.lineTo(glassW + 14, glassY - glassH);
      ctx.stroke();
      ctx.restore();

      // 캡슐 상단 경고/상태 비콘 라이트
      const beaconColor = isSuccess ? '#10b981' : (isTrap ? '#ef4444' : (isHacking ? '#f59e0b' : '#06b6d4'));
      ctx.save();
      ctx.shadowColor = beaconColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = beaconColor;
      ctx.beginPath();
      ctx.arc(0, podY - podH / 2 - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- [3. 전자 자물쇠 홀로그램 & 단어 뜻 선명 배너] ---
      const bannerW = 120;
      const bannerH = 34;
      const bannerY = podY - podH / 2 - 28 + pulse;

      ctx.save();
      ctx.shadowColor = isSuccess ? '#10b981' : (isTrap ? '#ef4444' : (isHacking ? '#f59e0b' : '#06b6d4'));
      ctx.shadowBlur = isSuccess ? 18 : 12;

      // 홀로그램 플레이트 배경
      ctx.fillStyle = isSuccess ? 'rgba(6, 78, 59, 0.94)' : (isTrap ? 'rgba(127, 29, 29, 0.94)' : 'rgba(10, 25, 47, 0.94)');
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
      ctx.fillText(lockIcon, -bannerW / 2 + 16, bannerY);

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

