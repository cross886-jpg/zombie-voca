/**
 * js/render/dogRenderer.js
 * UI 전용 강아지 캔버스 렌더러
 * - 로비 중앙 무대, 장비 쇼케이스, 프로필 모달, 훈련소 등의 프리뷰/아바타 렌더링을 통합
 * - 견종별 외형, 진화 단계, 장착 스킨, 무기 이펙트, 행복 리액션(바운스, 반달눈, 볼터치, 꼬리 흔들기) 지원
 * - 주변 서포터 동행 렌더링 지원
 */

import { BREEDS, COMPANIONS, COSTUMES } from '../data/catalog.js';
import { drawDogCharacter, drawDogSkin, getEvolutionStage } from '../entities/player.js';

/**
 * 2D 컨텍스트에 강아지 캐릭터 및 장비/이펙트를 그립니다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 */
export function drawDogPreview(ctx, options = {}) {
  const {
    save = null,
    breedId = save?.selectedBreed || 'pomeranian',
    scale = 1.0,
    ratio = 1,
    x = 0,
    y = 0,
    evolutionStage = save ? getEvolutionStage(save).stage : 1,
    equippedSkin = save?.equippedSkin || null,
    equippedHarness = null,
    withEquipment = true,
    isHappy = false,
    time = Date.now(),
  } = options;

  ctx.save();
  ctx.translate(x, y);
  if (ratio !== 1) {
    ctx.scale(ratio, ratio);
  }

  // 1. 행복 리액션 바운스 & 스쿼시/스트레치
  let bounceY = 0;
  let squashX = 1;
  let squashY = 1;

  if (isHappy) {
    bounceY = Math.abs(Math.sin(time * 0.014)) * 7;
    squashX = 1 + Math.sin(time * 0.014) * 0.08;
    squashY = 1 - Math.sin(time * 0.014) * 0.08;
  }

  if (bounceY !== 0) {
    ctx.translate(0, -bounceY);
  }
  if (squashX !== 1 || squashY !== 1) {
    ctx.scale(squashX, squashY);
  }

  const lookX = isHappy ? Math.sin(time * 0.02) * 1.5 : 0;

  // 2. 기본 강아지 몸체 그리기 (4족 보행 형태)
  drawDogCharacter(ctx, {
    breedId,
    scale,
    bodyY: 0,
    lookX,
  });

  // 3. 행복 표정 오버레이 (반달 눈웃음, 핑크 홍조, 살랑거리는 꼬리)
  if (isHappy) {
    const s = scale;
    const eyeY = -9 * s;

    // 눈동자 부드럽게 감기
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4.5 * s, eyeY, 2.8, 0, Math.PI * 2);
    ctx.arc(4.5 * s, eyeY, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-4.5 * s, eyeY + 1.2, 3.2, Math.PI * 1.15, Math.PI * 1.85, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(4.5 * s, eyeY + 1.2, 3.2, Math.PI * 1.15, Math.PI * 1.85, false);
    ctx.stroke();

    // 양볼 분홍빛 홍조
    ctx.fillStyle = 'rgba(251, 113, 133, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-7.5 * s, eyeY + 5.5, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(7.5 * s, eyeY + 5.5, 3.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 신나게 살랑거리는 꼬리 연출
    const tailSwing = Math.sin(time * 0.038) * 0.55;
    ctx.save();
    ctx.translate(14 * s, eyeY + 14);
    ctx.rotate(tailSwing);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.5, 8, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. 장착 스킨 그리기
  if (withEquipment && equippedSkin) {
    drawDogSkin(ctx, equippedSkin, scale, 0);
  }

  // 4-1. 기본 하네스 (가슴줄 스트랩 & 황금색 D-링) 렌더링
  if (withEquipment) {
    let harnessDef = null;
    if (equippedHarness && typeof equippedHarness === 'object') {
      harnessDef = equippedHarness;
    } else if (typeof equippedHarness === 'string') {
      harnessDef = COSTUMES.find((c) => c.id === equippedHarness);
    } else if (save?.costumes?.equipped?.harness) {
      harnessDef = COSTUMES.find((c) => c.id === save.costumes.equipped.harness);
    } else {
      harnessDef = COSTUMES.find((c) => c.id === 'basic_harness');
    }

    if (harnessDef) {
      const strapColor = harnessDef.color || '#10b981';
      const ringColor = harnessDef.ringColor || '#fbbf24';
      ctx.save();
      // 메인 가슴줄 스트랩 (몸통을 감싸는 타원)
      ctx.strokeStyle = strapColor;
      ctx.lineWidth = Math.max(2, 3.2 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 5 * scale, 11 * scale, 7.5 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 보조 가슴 연결 스트랩
      ctx.strokeStyle = strapColor === '#10b981' ? '#059669' : '#1e293b';
      ctx.lineWidth = Math.max(1.5, 2.5 * scale);
      ctx.beginPath();
      ctx.moveTo(-6 * scale, 5 * scale);
      ctx.lineTo(6 * scale, 5 * scale);
      ctx.stroke();

      // 황금색 D-링 (리드줄 연결 금속 고리)
      ctx.fillStyle = ringColor;
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.beginPath();
      ctx.arc(0, 0.5 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * 활성 동행 서포터 동물들을 주변에 렌더링합니다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<string>} companions - 서포터 ID 배열
 */
export function drawCompanionsAround(ctx, companions = []) {
  if (!companions || companions.length === 0) return;

  const compPositions = [
    { x: 30, y: 56, scale: 0.8 },
    { x: 130, y: 56, scale: 0.8 },
    { x: 42, y: 76, scale: 0.75 },
  ];

  companions.forEach((cid, idx) => {
    const pos = compPositions[idx] || compPositions[0];
    const compDef = COMPANIONS.find((c) => c.id === cid);
    const breedDef = BREEDS.find((b) => b.id === cid);
    ctx.save();
    ctx.translate(pos.x, pos.y);

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (breedDef) {
      drawDogCharacter(ctx, {
        breedId: breedDef.id,
        scale: pos.scale,
        bodyY: 0,
        lookX: 0,
      });
    } else if (compDef) {
      ctx.fillStyle = compDef.color || '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(compDef.icon, 0, 1);
    }
    ctx.restore();
  });
}

/**
 * 캔버스 엘리먼트를 초기화하고 중앙에 강아지(및 옵션에 따라 서포터)를 렌더링합니다.
 * @param {HTMLCanvasElement|string} target - 캔버스 엘리먼트 또는 ID
 * @param {Object} options
 */
export function renderDogToCanvas(target, options = {}) {
  const canvas = typeof target === 'string' ? document.getElementById(target) : target;
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 주변 동행 서포터가 있는 경우 먼저 렌더링
  if (options.companions && options.companions.length > 0) {
    drawCompanionsAround(ctx, options.companions);
  }

  const defaultX = options.x !== undefined ? options.x : canvas.width / 2;
  const defaultY = options.y !== undefined
    ? options.y
    : canvas.height / 2 + (options.offsetY !== undefined ? options.offsetY : canvas.height * 0.06);

  drawDogPreview(ctx, {
    ...options,
    x: defaultX,
    y: defaultY,
  });

  return canvas;
}

