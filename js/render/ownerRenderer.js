/**
 * js/render/ownerRenderer.js
 * 2.5D 인간 파트너 주인(Owner) 통합 캔버스 렌더러
 * - drawOwnerCharacter: 로비 2.5D 거점, 우리 팀 쇼케이스, 훈련소 아바타 공용 렌더러
 * - renderOwnerInBattle: 인게임 전투 엔티티(Owner) 전용 렌더러 (보행 모션, 기력바, 상태 말풍선 포함)
 */

function resolveContext(ctxOrCanvas) {
  if (!ctxOrCanvas) return { ctx: null, canvas: null };
  if (typeof ctxOrCanvas === 'string') {
    const el = document.getElementById(ctxOrCanvas);
    return { ctx: el ? el.getContext('2d') : null, canvas: el };
  }
  if (typeof HTMLCanvasElement !== 'undefined' && ctxOrCanvas instanceof HTMLCanvasElement) {
    return { ctx: ctxOrCanvas.getContext('2d'), canvas: ctxOrCanvas };
  }
  if (typeof ctxOrCanvas.getContext === 'function') {
    return { ctx: ctxOrCanvas.getContext('2d'), canvas: ctxOrCanvas };
  }
  return { ctx: ctxOrCanvas, canvas: ctxOrCanvas.canvas || null };
}

/**
 * 주인 캐릭터 본체 스프라이트 드로잉 (원점 (0,0) 기준, 회복 단계 Lv.1~5 연동)
 */
function drawOwnerSpriteAtOrigin(ctx, {
  scale = 1.0,
  recoveryStage = 1,
  breathe = 0,
  legPhase = 0,
  isSitting = false,
  time = 0,
} = {}) {
  const s = scale;

  // 1. 바닥 타원 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 14 * s, 12.5 * s, 5.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. 회복 단계(Lv.1~5)별 자세 및 의상
  if (recoveryStage === 1) {
    // [Stage 1: Ch.1 공항 탈출] 다리를 다쳐 붕대를 감고 회복 중 (생존 배낭 + 짝짝이 양말 + 이마 붕대)
    const sitOffset = isSitting ? 5.5 : 0;

    // 생존 배낭 (뒤)
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-13 * s, (-9.5 + sitOffset + breathe * 0.4) * s, 9 * s, 14.5 * s, 3);
    } else {
      ctx.rect(-13 * s, (-9.5 + sitOffset) * s, 9 * s, 14.5 * s);
    }
    ctx.fill();

    // 환자복 티셔츠 몸통
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(0, (2.5 + sitOffset + breathe * 0.6) * s, 8.5 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 짝짝이 양말 다리
    ctx.fillStyle = '#10b981'; // 녹색 양말
    ctx.fillRect(-5.8 * s, (11 + sitOffset) * s, 3.8 * s, 5.5 * s);
    ctx.fillStyle = '#f59e0b'; // 노란 양말
    ctx.fillRect(2 * s, (11 + sitOffset + (isSitting ? 0 : legPhase * 2)) * s, 3.8 * s, 5.5 * s);

    // 머리 & 얼굴
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, (-9.5 + sitOffset + breathe * 0.8) * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    // 이마 붕대
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7.5 * s, (-12.5 + sitOffset + breathe * 0.8) * s, 15 * s, 2.8 * s);

    // 갈색 머리카락
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, (-11 + sitOffset + breathe * 0.8) * s, 8 * s, Math.PI, Math.PI * 2);
    ctx.fill();

    // 눈웃음
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = Math.max(1, 0.9 * s);
    ctx.beginPath();
    ctx.arc(-2.5 * s, (-8.2 + sitOffset + breathe * 0.8) * s, 1.2 * s, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2.5 * s, (-8.2 + sitOffset + breathe * 0.8) * s, 1.2 * s, 0, Math.PI);
    ctx.stroke();
  } else if (recoveryStage === 2) {
    // [Stage 2: Ch.2 하숙집] 구부정한 자세에서 회복 중 (파란 캐주얼 후드티)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.ellipse(0, (2.5 + breathe * 0.6) * s, 9.5 * s, 11 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.fillRect(-5.8 * s, 11.5 * s, 4.2 * s, 7.2 * s);
    ctx.fillRect(1.5 * s, (11.5 + legPhase * 3) * s, 4.2 * s, 7.2 * s);

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(2.2 * s, (-8 + breathe * 0.8) * s, 7.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(2.2 * s, (-9.8 + breathe * 0.8) * s, 7.8 * s, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (recoveryStage === 3) {
    // [Stage 3: Ch.3 대학 캠퍼스] 허리를 펴고 안정적으로 보행 (녹색 캠퍼스 점퍼 + 안경)
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-8 * s, (-4 + breathe * 0.4) * s, 16 * s, 17 * s, 4);
    } else {
      ctx.rect(-8 * s, -4 * s, 16 * s, 17 * s);
    }
    ctx.fill();

    ctx.fillStyle = '#1e40af';
    ctx.fillRect(-5.8 * s, 12.5 * s, 4.6 * s, 7.8 * s);
    ctx.fillRect(1.2 * s, (12.5 + legPhase * 4) * s, 4.6 * s, 7.8 * s);

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, (-10.5 + breathe * 0.8) * s, 7.8 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(0, (-12.5 + breathe * 0.8) * s, 7.8 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // 안경
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = Math.max(1, 1.1 * s);
    ctx.strokeRect(-5 * s, (-10.5 + breathe * 0.8) * s, 4 * s, 3 * s);
    ctx.strokeRect(1 * s, (-10.5 + breathe * 0.8) * s, 4 * s, 3 * s);
  } else if (recoveryStage === 4) {
    // [Stage 4: Ch.4 연구소] 방역 연구원 화이트 롱코트
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-9 * s, (-5.5 + breathe * 0.4) * s, 18 * s, 20 * s, 4);
    } else {
      ctx.rect(-9 * s, -5.5 * s, 18 * s, 20 * s);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5.8 * s, 14 * s, 4.3 * s, 8.5 * s);
    ctx.fillRect(1.5 * s, (14 + legPhase * 5) * s, 4.3 * s, 8.5 * s);

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, (-12 + breathe * 0.8) * s, 8.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, (-14 + breathe * 0.8) * s, 8.2 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  } else {
    // [Stage 5: Ch.5 중앙 벙커 완치] 완전 회복된 전술 재킷 + 붉은 스카프
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-9 * s, (-6.5 + breathe * 0.4) * s, 18 * s, 20.5 * s, 5);
    } else {
      ctx.rect(-9 * s, -6.5 * s, 18 * s, 20.5 * s);
    }
    ctx.fill();

    // 스카프 휘날림
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    const wave = Math.sin((time || 0) * 8) * 2.5;
    ctx.moveTo(0, -5.5 * s);
    ctx.lineTo(-13.5 * s, (-2.5 + wave) * s);
    ctx.lineTo(-11.5 * s, (3 + wave) * s);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-5.8 * s, 14 * s, 4.8 * s, 9 * s);
    ctx.fillRect(1.2 * s, (14 + legPhase * 5) * s, 4.8 * s, 9 * s);

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, (-13 + breathe * 0.8) * s, 8.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(0, (-15 + breathe * 0.8) * s, 8.2 * s, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
  }
}

/**
 * 로비 2.5D 거점, 우리 팀 쇼케이스, 훈련소 아바타 공용 주인 렌더러
 */
export function drawOwnerCharacter(ctxOrCanvas, {
  x,
  y,
  scale = 1.6,
  recoveryStage = 1,
  time = 0,
  isSitting = false,
  showLabel = false,
  clearCanvas = false,
} = {}) {
  const { ctx, canvas } = resolveContext(ctxOrCanvas);
  if (!ctx) return;

  if (clearCanvas && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const drawX = typeof x === 'number' ? x : (canvas ? canvas.width / 2 : 64);
  const drawY = typeof y === 'number' ? y : (canvas ? canvas.height / 2 + 10 : 74);
  const breathe = time ? Math.sin(time / 450) * 1.5 : 0;

  ctx.save();
  ctx.translate(drawX, drawY);

  drawOwnerSpriteAtOrigin(ctx, {
    scale,
    recoveryStage,
    breathe,
    legPhase: 0,
    isSitting,
    time: time ? time / 1000 : 0,
  });

  if (showLabel) {
    const s = scale;
    ctx.fillStyle = 'rgba(27, 59, 43, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-24 * s, -22 * s, 48 * s, 9 * s, 3);
    } else {
      ctx.rect(-24 * s, -22 * s, 48 * s, 9 * s);
    }
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = `bold ${Math.round(6 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(recoveryStage <= 2 ? '주인 (치료 중)' : '주인 (회복)', 0, -15.5 * s);
  }

  ctx.restore();
}

/**
 * 인게임 전투용 주인 엔티티 렌더러 (보행 애니메이션, 땀방울, 휴식 말풍선, 기력 게이지 포함)
 */
export function renderOwnerInBattle(ctx, owner, time = 0) {
  if (!ctx || !owner) return;

  ctx.save();
  ctx.translate(owner.x + (owner.wobble || 0), owner.y);

  const s = 1.0;
  const legPhase = Math.sin(owner.walkPhase || 0);

  drawOwnerSpriteAtOrigin(ctx, {
    scale: s,
    recoveryStage: owner.recoveryStage || 1,
    breathe: 0,
    legPhase,
    isSitting: Boolean(owner.isSitting),
    time,
  });

  // 기력 저하 시 땀방울 이펙트 (💦)
  if (owner.stamina < 40) {
    ctx.font = '10px sans-serif';
    ctx.fillText('💦', 8 * s, -18 * s);
  }

  // 주저앉았을 때 휴식 말풍선
  if (owner.isSitting) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-24 * s, -28 * s, 48 * s, 14 * s, 4);
    } else {
      ctx.rect(-24 * s, -28 * s, 48 * s, 14 * s);
    }
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('휴식 중... 💤', 0, -18 * s);
  }

  // 컴팩트 미니 기력 바 (Stamina Bar)
  const barW = 26;
  const barH = 3;
  const barY = 22 * s;
  const maxStam = Math.max(1, owner.maxStamina || 100);
  const stamRatio = Math.max(0, Math.min(1, owner.stamina / maxStam));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-barW / 2, barY, barW, barH);
  ctx.fillStyle = owner.stamina < 40 ? '#ef4444' : '#38bdf8';
  ctx.fillRect(-barW / 2, barY, barW * stamRatio, barH);

  ctx.restore();
}
