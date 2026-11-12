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
  }

  reset(targetX, targetY) {
    this.x = targetX;
    this.y = targetY;
    this.zoom = 1.0;
    this.shakeTimer = 0;
    this.zoomSeqActive = false;
    this.zoomSeqElapsed = 0;
  }

  shake(intensity = 8, duration = 0.22) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
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

  update(dt, targetX, targetY, arenaWidth, arenaHeight, viewW, viewH) {
    // 부드러운 타겟 추적
    const lerp = 1 - Math.pow(0.001, dt);
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;

    // 줌아웃 → 줌인 시퀀스
    if (this.zoomSeqActive) {
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
}

