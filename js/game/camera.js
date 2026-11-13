/**
 * js/game/camera.js
 * 네온 방화벽 대형 광장 렌더링, 우유 추적 카메라, 화면 진동, 보스전 1.5초 줌아웃→줌인 연출
 */

import { BALANCE } from '../config/balance.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.centerRatioY = 0.56; // 상단 전광판 높이(약 110px)를 감안한 카메라 Y 중심 오프셋 (위쪽 시야 확보)

    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    this.zoomSeqActive = false;
    this.zoomSeqElapsed = 0;
    this.zoomSeqDuration = BALANCE.BOSS.ZOOM_SEQUENCE_SEC;
    this.zoomSeqMin = 0.62;

    this.ultCamActive = false;
    this.ultCamElapsed = 0;
    this.ultCamDuration = 0.62;
  }

  reset(targetX, targetY) {
    this.x = targetX;
    this.y = targetY;
    this.zoom = 1.0;
    this.shakeTimer = 0;
    this.zoomSeqActive = false;
    this.zoomSeqElapsed = 0;
    this.ultCamActive = false;
    this.ultCamElapsed = 0;
  }

  shake(intensity = 8, duration = 0.22) {
    let effectiveIntensity = intensity;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('zombie_voca_save_v1') : null;
      if (raw && JSON.parse(raw).lowFx) {
        effectiveIntensity = intensity * 0.4;
      }
    } catch (_) {}
    this.shakeIntensity = Math.max(this.shakeIntensity, effectiveIntensity);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /**
   * 28번 보스 등장 시 1.5초 부드러운 줌아웃 → 줌인 시퀀스 시작
   */
  triggerZoomSequence(duration = BALANCE.BOSS.ZOOM_SEQUENCE_SEC, minZoom = 0.62) {
    this.zoomSeqActive = true;
    this.zoomSeqElapsed = 0;
    this.zoomSeqDuration = duration;
    this.zoomSeqMin = minZoom;
  }

  /**
   * 필살기 발동 시 순간 줌인(1.24x) → 광역 폭발 줌아웃(0.86x) → 정상 복귀(1.0x) + 강렬한 진동 연출
   */
  triggerUltimateCamera(duration = 0.62) {
    this.ultCamActive = true;
    this.ultCamElapsed = 0;
    this.ultCamDuration = duration;
    this.shake(24, duration);
  }

  update(dt, targetX, targetY, arenaWidth, arenaHeight, viewW, viewH) {
    // 부드러운 타겟 추적
    const lerp = 1 - Math.pow(0.001, dt);
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;

    // 필살기 순간 줌인 → 줌아웃 카메라 무빙 시퀀스
    if (this.ultCamActive) {
      this.ultCamElapsed += dt;
      const p = Math.min(1, this.ultCamElapsed / this.ultCamDuration);
      if (p < 0.26) {
        const k = Math.sin((p / 0.26) * (Math.PI / 2));
        this.zoom = 1.0 + 0.24 * k;
      } else if (p < 0.72) {
        const k = (p - 0.26) / 0.46;
        this.zoom = 1.24 - (1.24 - 0.86) * Math.sin(k * (Math.PI / 2));
      } else {
        const k = (p - 0.72) / 0.28;
        this.zoom = 0.86 + (1.0 - 0.86) * k;
      }
      if (p >= 1) {
        this.zoom = 1.0;
        this.ultCamActive = false;
      }
    } else if (this.zoomSeqActive) {
      // 보스 등장 줌아웃 → 줌인 시퀀스
      this.zoomSeqElapsed += dt;
      const t = Math.min(1, this.zoomSeqElapsed / this.zoomSeqDuration);
      // sin(pi * t): 0 -> 1 -> 0 곡선으로 부드럽게 줌아웃 후 복귀
      const ease = Math.sin(Math.PI * t);
      this.zoom = 1.0 - (1.0 - this.zoomSeqMin) * ease;
      if (t >= 1) {
        this.zoom = 1.0;
        this.zoomSeqActive = false;
      }
    }

    // 카메라 경계 클램프
    const halfViewW = (viewW / 2) / this.zoom;
    const topViewH = (viewH * this.centerRatioY) / this.zoom;
    const bottomViewH = (viewH * (1 - this.centerRatioY)) / this.zoom;
    if (arenaWidth > halfViewW * 2) {
      this.x = Math.max(halfViewW, Math.min(arenaWidth - halfViewW, this.x));
    } else {
      this.x = arenaWidth / 2;
    }
    if (arenaHeight > topViewH + bottomViewH) {
      this.y = Math.max(topViewH, Math.min(arenaHeight - bottomViewH, this.y));
    } else {
      this.y = arenaHeight / 2;
    }

    // 화면 진동
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const decay = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
      const mag = this.shakeIntensity * decay;
      this.shakeOffsetX = (Math.random() * 2 - 1) * mag;
      this.shakeOffsetY = (Math.random() * 2 - 1) * mag;
      if (this.shakeTimer === 0) {
        this.shakeIntensity = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  beginTransform(ctx, viewW, viewH) {
    ctx.save();
    ctx.translate(viewW / 2 + this.shakeOffsetX, viewH * this.centerRatioY + this.shakeOffsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  endTransform(ctx) {
    ctx.restore();
  }

  worldToScreen(wx, wy, viewW, viewH) {
    return {
      x: (wx - this.x) * this.zoom + viewW / 2,
      y: (wy - this.y) * this.zoom + viewH * this.centerRatioY,
    };
  }

  /**
   * 네온 방화벽 대형 광장 아레나 바닥 및 경계 렌더링
   */
  renderArena(ctx, chapter, arenaWidth, arenaHeight, time) {
    const theme = chapter.theme;

    // 광장 바닥 배경
    ctx.fillStyle = theme.groundBg;
    ctx.fillRect(0, 0, arenaWidth, arenaHeight);

    // 2.5D 네온 그리드
    const gridSize = 80;
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= arenaWidth; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, arenaHeight);
    }
    for (let y = 0; y <= arenaHeight; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(arenaWidth, y);
    }
    ctx.stroke();

    // 10개 챕터별 고유 전장 디테일 렌더링
    this.renderThemeDetails(ctx, chapter, arenaWidth, arenaHeight, time);

    // 중앙 광장 엠블럼 링
    ctx.save();
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(arenaWidth / 2, arenaHeight / 2, 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 외곽 푸른/테마 네온 방화벽 경계선 (상단 전광판 안전선 topMargin 120px 반영)
    const m = BALANCE.ARENA.FIREWALL_MARGIN;
    const topMargin = 120;
    const pulse = 0.75 + Math.sin(time * 4) * 0.25;
    ctx.save();
    ctx.strokeStyle = theme.firewallColor;
    ctx.lineWidth = 5;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = theme.firewallColor;
    ctx.shadowBlur = 18;
    ctx.strokeRect(m, m + topMargin, arenaWidth - m * 2, arenaHeight - (m * 2 + topMargin));
    ctx.restore();
  }

  /**
   * 10개 챕터별 전장 테마 디테일 렌더링
   */
  renderThemeDetails(ctx, chapter, arenaWidth, arenaHeight, time) {
    const detail = chapter?.theme?.detailType || 'asphalt';
    const cx = arenaWidth / 2;
    const cy = arenaHeight / 2;

    ctx.save();

    switch (detail) {
      case 'asphalt': {
        // Ch.1: 도심 외곽 아스팔트 거리 (차선 점선 & 맨홀 뚜껑)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 3;
        ctx.setLineDash([24, 20]);
        ctx.beginPath();
        ctx.moveTo(cx - 140, 140);
        ctx.lineTo(cx - 140, arenaHeight - 60);
        ctx.moveTo(cx + 140, 140);
        ctx.lineTo(cx + 140, arenaHeight - 60);
        ctx.stroke();
        ctx.setLineDash([]);

        // 맨홀
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx - 260, cy - 180, 28, 0, Math.PI * 2);
        ctx.arc(cx + 260, cy + 180, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'subway': {
        // Ch.2: 폐쇄된 지하철 & 공사 현장 (철도 레일 & 공사 안전 빗금)
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 160, 120);
        ctx.lineTo(cx - 160, arenaHeight - 40);
        ctx.moveTo(cx - 100, 120);
        ctx.lineTo(cx - 100, arenaHeight - 40);
        ctx.moveTo(cx + 100, 120);
        ctx.lineTo(cx + 100, arenaHeight - 40);
        ctx.moveTo(cx + 160, 120);
        ctx.lineTo(cx + 160, arenaHeight - 40);
        ctx.stroke();

        // 침목
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let y = 140; y < arenaHeight - 40; y += 40) {
          ctx.moveTo(cx - 175, y);
          ctx.lineTo(cx - 85, y);
          ctx.moveTo(cx + 85, y);
          ctx.lineTo(cx + 175, y);
        }
        ctx.stroke();
        break;
      }

      case 'sewer': {
        // Ch.3: 오염된 하수 처리장 & 폐연구소 (녹색 독성 슬러지 웅덩이 & 배수구)
        const pulse = 0.12 + Math.sin(time * 2) * 0.04;
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
        ctx.beginPath();
        ctx.ellipse(cx - 240, cy + 140, 90, 50, 0.3, 0, Math.PI * 2);
        ctx.ellipse(cx + 260, cy - 140, 110, 60, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // 연구소 배수구
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 40, cy - 40, 80, 80);
        for (let i = -30; i <= 30; i += 15) {
          ctx.beginPath();
          ctx.moveTo(cx + i, cy - 40);
          ctx.lineTo(cx + i, cy + 40);
          ctx.stroke();
        }
        break;
      }

      case 'police': {
        // Ch.4: 봉쇄된 경찰서 & 바리케이드 광장 (경광등 잔광 & 바리케이드 빗금)
        const policeBlue = Math.sin(time * 5) * 0.5 + 0.5;
        const policeRed = 1 - policeBlue;

        ctx.fillStyle = `rgba(59, 130, 246, ${0.06 * policeBlue})`;
        ctx.fillRect(0, 0, arenaWidth / 2, arenaHeight);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.06 * policeRed})`;
        ctx.fillRect(arenaWidth / 2, 0, arenaWidth / 2, arenaHeight);

        // 폴리스 라인 빗금 표시
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.16)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 80; x < arenaWidth - 80; x += 120) {
          ctx.moveTo(x, 150);
          ctx.lineTo(x + 50, 190);
          ctx.moveTo(x, arenaHeight - 80);
          ctx.lineTo(x + 50, arenaHeight - 40);
        }
        ctx.stroke();
        break;
      }

      case 'club': {
        // Ch.5: 네온 번화가 & 클럽 스트리트 (댄스 플로어 체커보드 & 음파 링)
        const beat = (Math.sin(time * 6) + 1) * 0.5;
        ctx.fillStyle = `rgba(236, 72, 153, ${0.06 + beat * 0.05})`;
        const tile = 80;
        for (let x = 0; x < arenaWidth; x += tile * 2) {
          for (let y = 0; y < arenaHeight; y += tile * 2) {
            ctx.fillRect(x, y, tile, tile);
            ctx.fillRect(x + tile, y + tile, tile, tile);
          }
        }
        // 이퀄라이저 링
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.25 + beat * 0.25})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 90 + beat * 30, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'graveyard': {
        // Ch.6: 폐광산 & 어두운 공동묘지 (묘비 실루엣 & 으스스한 안개 흔적)
        ctx.fillStyle = 'rgba(167, 243, 208, 0.07)';
        ctx.beginPath();
        ctx.arc(cx - 300, cy - 200, 70, 0, Math.PI * 2);
        ctx.arc(cx + 320, cy + 180, 85, 0, Math.PI * 2);
        ctx.arc(cx, cy + 240, 95, 0, Math.PI * 2);
        ctx.fill();

        // 묘비 십자가
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.18)';
        ctx.lineWidth = 3;
        const graves = [[cx - 280, cy - 120], [cx + 280, cy - 140], [cx - 220, cy + 200], [cx + 240, cy + 190]];
        for (const [gx, gy] of graves) {
          ctx.beginPath();
          ctx.moveTo(gx, gy - 20);
          ctx.lineTo(gx, gy + 20);
          ctx.moveTo(gx - 12, gy - 6);
          ctx.lineTo(gx + 12, gy - 6);
          ctx.stroke();
        }
        break;
      }

      case 'steampunk': {
        // Ch.7: 태엽 시계탑 & 비행선 격납고 (회전 톱니바퀴 & 황동 리벳)
        const rot = time * 0.35;
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.22)';
        ctx.lineWidth = 2;

        const drawGear = (x, y, r, teeth, spin) => {
          ctx.beginPath();
          for (let i = 0; i < teeth; i++) {
            const a = spin + (i * Math.PI * 2) / teeth;
            const ra = r + (i % 2 === 0 ? 10 : 0);
            const gx = x + Math.cos(a) * ra;
            const gy = y + Math.sin(a) * ra;
            if (i === 0) ctx.moveTo(gx, gy);
            else ctx.lineTo(gx, gy);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        };

        drawGear(cx - 220, cy - 160, 65, 12, rot);
        drawGear(cx + 230, cy + 170, 80, 16, -rot * 0.75);
        break;
      }

      case 'highway': {
        // Ch.8: 무너진 고속도로 & 대교 위 (고속도로 노란 중앙선 & 균열)
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.24)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 6, 120);
        ctx.lineTo(cx - 6, arenaHeight - 40);
        ctx.moveTo(cx + 6, 120);
        ctx.lineTo(cx + 6, arenaHeight - 40);
        ctx.stroke();

        // 아스팔트 대형 균열 지그재그
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 280, cy);
        ctx.lineTo(cx - 210, cy - 40);
        ctx.lineTo(cx - 150, cy + 20);
        ctx.lineTo(cx - 80, cy - 25);
        ctx.moveTo(cx + 80, cy + 30);
        ctx.lineTo(cx + 170, cy - 20);
        ctx.lineTo(cx + 240, cy + 50);
        ctx.lineTo(cx + 310, cy);
        ctx.stroke();
        break;
      }

      case 'cyber': {
        // Ch.9: 최첨단 로봇 공학 벙커 기지 (육각 테크 타일 & 회로 노드)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
        ctx.lineWidth = 1.5;

        const drawHex = (x, y, r) => {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const hx = x + Math.cos(a) * r;
            const hy = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        };

        for (let x = cx - 280; x <= cx + 280; x += 140) {
          drawHex(x, cy - 180, 40);
          drawHex(x, cy + 180, 40);
        }

        // 빛나는 회로 노드
        const blink = Math.sin(time * 4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(34, 211, 238, ${0.3 + blink * 0.4})`;
        for (let x = cx - 210; x <= cx + 210; x += 140) {
          ctx.beginPath();
          ctx.arc(x, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'bloodmoon': {
        // Ch.10: 붉은 달의 좀비 왕국 성채 (핏빛 오컬트 마법진 & 붉은 달 인장)
        const darkPulse = (Math.sin(time * 3) + 1) * 0.5;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.25 + darkPulse * 0.2})`;
        ctx.lineWidth = 2.5;

        // 중앙 붉은 달 거대 오컬트 원
        ctx.beginPath();
        ctx.arc(cx, cy, 220, 0, Math.PI * 2);
        ctx.stroke();

        // 내부 역오각성/룬 문양
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = ((i + 2) * Math.PI * 2) / 5 - Math.PI / 2;
          ctx.moveTo(cx + Math.cos(a1) * 220, cy + Math.sin(a1) * 220);
          ctx.lineTo(cx + Math.cos(a2) * 220, cy + Math.sin(a2) * 220);
        }
        ctx.stroke();

        // 붉은 달 중심핵
        ctx.fillStyle = `rgba(239, 68, 68, ${0.08 + darkPulse * 0.08})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}

