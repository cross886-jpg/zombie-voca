/**
 * js/entities/monoliths.js
 * 4개 입체 홀로그램 비석(4사분면 스폰, 220px 최소 거리, 0.4초 점령 게이지·즉시 소멸) + 보카 젬·간식 드롭
 */

import { BALANCE } from '../config/balance.js';

export class MonolithManager {
  constructor() {
    this.monoliths = [];
    this.drops = [];
    this.riseProgress = 0;
    this.revealOnly = false;
    this.isTutorial = false;
  }

  resetForBattle(isTutorial = false) {
    this.monoliths = [];
    this.drops = [];
    this.riseProgress = 0;
    this.revealOnly = false;
    this.isTutorial = isTutorial;
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
      const topMargin = 170; // 상단 전광판 높이 감안 안전 마진 (120 -> 170 상향하여 배너 최상단 178px 보장)
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
        captureProgress: 0, // 0 ~ 1 (0.7초 완충)
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
    this.drops.push({
      type, // 'gem' | 'snack' (뼈다귀) | 'medkit' (구급상자)
      x,
      y,
      value,
      ttl: type === 'gem' ? (BALANCE.COMBAT.GEM_TTL || 14) : null,
      radius: type === 'medkit' ? 12 : (type === 'snack' ? 11 : 9),
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  /**
   * 비석 점령 판정 및 드롭 아이템(보석/뼈다귀/구급상자) 자석 흡수
   * @returns {{ resolvedMonolith: object | null, pickedGems: number, pickedGemCharge: number, pickedSnacks: number, pickedMedkits: number, captureTicking: boolean }}
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
        const distToCenter = Math.hypot(player.x - m.x, player.y - m.y);
        m.playerApproachDist = Math.min(distToEntry, distToCenter);
        const inEntryZone = distToEntry <= (m.entryRadius || 28) + player.radius * 0.35;

        if (inEntryZone) {
          m.captureProgress += dt / (BALANCE.MONOLITH.CAPTURE_TIME_SEC || 0.7);
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

    // 전장 드롭 3종(보카 젬, 뼈다귀, 구급상자) 자석 흡수 및 시간 경과 처리
    let pickedGems = 0;
    let pickedGemCharge = 0;
    let pickedSnacks = 0;
    let pickedMedkits = 0;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.bobPhase += dt * 5;

      // 1. 보석(gem) 소멸 타이머 (일정 시간 경과 시 소멸되어 자석 스탯 가치 유지)
      if (d.type === 'gem' && d.ttl !== null) {
        d.ttl -= dt;
        if (d.ttl <= 0) {
          this.drops.splice(i, 1);
          continue;
        }
      }

      // 2. 구급상자는 풀피(100% 체력) 상태에서는 헛되이 낭비되지 않도록 자석 흡수 방지
      const isFullHp = player.hp >= player.maxHp;
      if (d.type === 'medkit' && isFullHp) {
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
          pickedGems += d.value;
          pickedGemCharge += (BALANCE.COMBAT.GEM_CHARGE_VALUE || 2);
        } else if (d.type === 'snack') {
          pickedSnacks += 1;
        } else if (d.type === 'medkit') {
          pickedMedkits += 1;
        }
        this.drops.splice(i, 1);
      }
    }

    return { resolvedMonolith, pickedGems, pickedGemCharge, pickedSnacks, pickedMedkits, captureTicking };
  }

  render(ctx, time, highlightRing = false, camera = null, viewW = 0, viewH = 0, isTutorial = false) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);

    // 1. 전장 드롭 3종 렌더링 (단일 통일 💎 보석, 🦴 뼈다귀, 💊 구급상자)
    for (const d of this.drops) {
      ctx.save();
      const bobY = Math.sin(d.bobPhase) * 3;
      ctx.translate(d.x, d.y + bobY);

      if (d.type === 'gem') {
        // 단일 통일 디자인: 네온 시안 다이아몬드 (소멸 3초 전 점멸)
        if (d.ttl !== null && d.ttl < 3 && Math.floor(d.ttl * 8) % 2 === 0) {
          ctx.globalAlpha = 0.35;
        }
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.fill();

        // 내부 반사 하이라이트
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-3.5, 0);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === 'snack') {
        ctx.shadowColor = 'rgba(251, 191, 36, 0.7)';
        ctx.shadowBlur = 8;
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦴', 0, 0);
      } else if (d.type === 'medkit') {
        ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
        ctx.shadowBlur = 12;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💊', 0, 0);
      }
      ctx.restore();
    }

    // 2. 4개 지하 벙커 해치 & 정면 진입 발판 (Bunker Hatch) 렌더링
    for (const m of this.monoliths) {
      ctx.save();
      const riseOffset = (1 - this.riseProgress) * 36;
      const isHacking = m.captureProgress > 0;
      const isSuccess = m.highlighted;
      const isTrap = m.trapWarning;

      // 해독 진행 중 캡슐 미세 진동 피드백 (Hacking Vibration Feedback)
      const vibX = isHacking ? (Math.random() - 0.5) * 2.6 * Math.min(1, m.captureProgress * 1.5) : 0;
      const vibY = isHacking ? (Math.random() - 0.5) * 2.6 * Math.min(1, m.captureProgress * 1.5) : 0;
      ctx.translate(m.x + vibX, m.y + riseOffset + vibY);
      ctx.globalAlpha = 0.25 + this.riseProgress * 0.75;

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

      // 튜토리얼 Step 3(정답 해치 강조) 또는 플레이어가 반경 140px 이내로 접근 시 진입 원 강조 펄스 링
      const isPlayerNear = !this.revealOnly && m.playerApproachDist !== undefined && m.playerApproachDist <= 140;
      const isTutorialTarget = Boolean(highlightRing && m.isCorrect);
      if (isTutorialTarget || isPlayerNear || highlightRing) {
        ctx.save();
        const ringExpand = (performance.now() * 0.0018) % 1;
        const ringR = footR + 6 + ringExpand * 22;
        ctx.strokeStyle = isTutorialTarget
          ? `rgba(251, 191, 36, ${(1 - ringExpand) * 0.95})`
          : `rgba(52, 211, 153, ${(1 - ringExpand) * 0.85})`;
        ctx.lineWidth = isTutorialTarget ? 4.0 : 3.0;
        ctx.beginPath();
        ctx.arc(0, footY, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = isTutorialTarget ? 'rgba(250, 204, 21, 0.95)' : 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth = isTutorialTarget ? 3.0 : 2.5;
        ctx.beginPath();
        ctx.arc(0, footY, footR + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

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

      // 발판 해독 액션 원형 진행 게이지 링 (굵고 선명한 Progress Arc + 헤드 스파크)
      if (m.captureProgress > 0) {
        ctx.save();
        const progress = Math.min(1, m.captureProgress);
        const arcR = footR + 4;
        const startAng = -Math.PI / 2;
        const endAng = startAng + Math.PI * 2 * progress;

        // 1) 배경 트랙 링
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 5.5;
        ctx.arc(0, footY, arcR, 0, Math.PI * 2);
        ctx.stroke();

        // 2) 채워지는 굵고 선명한 원형 아크
        ctx.beginPath();
        ctx.strokeStyle = isTrap ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 6.0;
        ctx.lineCap = 'round';
        ctx.shadowColor = isTrap ? '#f87171' : '#f59e0b';
        ctx.shadowBlur = 14;
        ctx.arc(0, footY, arcR, startAng, endAng);
        ctx.stroke();

        // 3) 아크 전두부 헤드 글로우 도트
        const headX = Math.cos(endAng) * arcR;
        const headY = footY + Math.sin(endAng) * arcR;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(headX, headY, 3.2, 0, Math.PI * 2);
        ctx.fill();
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
      // 화면 뷰포트 안쪽에 해치 중심이 들어와 있을 때만 해치 자체 단어 라벨을 렌더링 (오프스크린 시 가장자리 말풍선과 이중 겹침 방지)
      // ==========================================
      const scrPos = camera && viewW > 0 && viewH > 0 ? camera.worldToScreen(m.x, m.y, viewW, viewH) : null;
      const isOffscreen = scrPos ? isMonolithOffscreen(scrPos.x, scrPos.y, viewW, viewH) : false;

      if (!isOffscreen) {
        const mText = m.meaning || '';
        const mLen = mText.length;
        const bannerW = Math.max(120, Math.min(220, mLen * 11 + 36));
        const bannerH = mLen >= 18 ? 36 : 32;
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

        // 단어 뜻 텍스트 (우측, 글자 수에 맞춘 반응형 폰트 크기)
        const fontSize = mLen >= 18 ? 10.5 : mLen >= 12 ? 12.5 : 14.5;
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mText, 10, bannerY);

        // [D. 튜토리얼 Step 3 정답 해치 전용: 통통 튀는 큰 강아지 발바닥(🐾) 포인터]
        if (isTutorialTarget) {
          const bounceY = Math.sin(performance.now() * 0.0085) * 6;
          const pawY = bannerY - 40 + bounceY;
          ctx.save();
          ctx.shadowColor = 'rgba(251, 191, 36, 0.95)';
          ctx.shadowBlur = 14;
          ctx.font = '32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐾', 0, pawY);

          ctx.font = '900 11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.fillText('▼', 0, pawY + 20);
          ctx.restore();
        }

        // [E. 해치 접근 시(반경 140px 이내) 입구 체류 안내 배지 (튜토리얼 진행 중에만 표시)]
        const showStayGuide = Boolean(isTutorial || this.isTutorial);
        if (isPlayerNear && showStayGuide) {
          const guideY = footY + footH / 2 + 22;
          const guideW = 214;
          const guideH = 24;
          ctx.save();
          ctx.shadowColor = isHacking ? 'rgba(251, 191, 36, 0.85)' : 'rgba(16, 185, 129, 0.75)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = 'rgba(10, 24, 17, 0.94)';
          ctx.strokeStyle = isHacking ? '#facc15' : '#34d399';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(-guideW / 2, guideY - guideH / 2, guideW, guideH, 12);
          ctx.fill();
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = isHacking ? '#fde047' : '#a7f3d0';
          ctx.font = '800 11.5px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐾 해치 입구 원 안에 잠시 머무르세요!', 0, guideY + 0.5);
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }
}

/**
 * 벙커 해치 중심 좌표가 화면 뷰포트 바깥(오프스크린)에 있는지 엄격 판정
 * - 해치 중심이 뷰포트 안쪽(0 <= screenX <= viewW && 0 <= screenY <= viewH)이면 false (가장자리 가이드 숨김)
 * - 해치 중심이 뷰포트 바깥이면 true (가장자리 가이드 표시)
 */
export function isMonolithOffscreen(screenX, screenY, viewW, viewH) {
  return screenX < 0 || screenX > viewW || screenY < 0 || screenY > viewH;
}

/**
 * 화면 밖 비석 인디케이터(말풍선) 좌표가 조이스틱 엄지 및 반대쪽 필살기(🔥) 버튼 영역에 가려지지 않도록 안전 구역 보정
 * @param {number} ax 말풍선 화면 X 좌표
 * @param {number} ay 말풍선 화면 Y 좌표
 * @param {number} viewW 뷰포트 너비
 * @param {number} viewH 뷰포트 높이
 * @param {'right'|'left'} dominantHand 주손 설정
 * @param {number} topPadding 상단 전광판 안전선 (기본 160px)
 * @returns {{ x: number, y: number }}
 */
export function clampIndicatorToThumbSafeZone(ax, ay, viewW, viewH, dominantHand = 'right', topPadding = 160) {
  const thumbW = 165;
  const thumbH = 170;
  const ultW = 95;
  const ultH = 95;
  const safeMargin = 8;

  // 상단 네온 전광판 하단 안전선(topPadding 160px) 이하로 내려오지 않도록 보정
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

