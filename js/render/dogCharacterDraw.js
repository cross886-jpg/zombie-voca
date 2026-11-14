/**
 * js/render/dogCharacterDraw.js
 * 10종 강아지 견종 외형 및 상점 프리미엄 스킨 캔버스 2D 패스 렌더러
 */

/**
 * 10종 강아지 견종 외형 캔버스 렌더러 (포메라니안, 골든 리트리버, 웰시코기, 시바견, 비글, 보더콜리, 허스키, 달마시안, 프렌치 불독, 도베르만, 말티즈, 푸들)
 */
export function drawDogCharacter(ctx, { breedId = 'pomeranian', scale = 1, bodyY = 0, lookX = 0, isBipedal = false } = {}) {
  const s = scale;

  switch (breedId) {
    case 'retriever': {
      // 골든 리트리버: 풍성한 꿀빛 골드 털, 늘어진 큰 귀, 긴 꼬리
      // 1. 살랑이는 긴 꼬리
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-12 * s, (bodyY + 6) * s);
      ctx.quadraticCurveTo(-22 * s, (bodyY + 1) * s, -18 * s, (bodyY - 7) * s);
      ctx.quadraticCurveTo(-14 * s, (bodyY + 1) * s, -9 * s, (bodyY + 7) * s);
      ctx.fill();

      // 2. 몸통 & 밝은 가슴 털
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 15 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 12 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 크림빛 가슴털
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 7) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (따뜻한 골드)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머즐 (주둥이)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 7 * s, 5.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. 양옆으로 늘어진 큰 귀 (Hound/Retriever Floppy Ears)
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 14) * s);
      ctx.bezierCurveTo(-16 * s, (bodyY - 8) * s, -17 * s, (bodyY + 2) * s, -11 * s, (bodyY + 4) * s);
      ctx.bezierCurveTo(-9 * s, (bodyY + 1) * s, -8 * s, (bodyY - 7) * s, -7 * s, (bodyY - 12) * s);
      ctx.moveTo(9 * s, (bodyY - 14) * s);
      ctx.bezierCurveTo(16 * s, (bodyY - 8) * s, 17 * s, (bodyY + 2) * s, 11 * s, (bodyY + 4) * s);
      ctx.bezierCurveTo(9 * s, (bodyY + 1) * s, 8 * s, (bodyY - 7) * s, 7 * s, (bodyY - 12) * s);
      ctx.fill();
      break;
    }

    case 'corgi': {
      // 웰시코기: 황갈색·흰색 투톤, 거대하고 쫑긋한 귀, 둥근 식빵 엉덩이 디테일
      // 1. 둥근 식빵 엉덩이 & 짧은 꼬리
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 6) * s, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(-14 * s, (bodyY + 6) * s, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 (상단 황갈색 + 하단 흰색 투톤)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 11.5 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 흰색 앞가슴/배 털
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 8) * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (황갈색)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 코기 얼굴 흰색 블레이즈 (눈 사이부터 주둥이까지 이어지는 흰 털)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 6) * s, 5.5 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-2 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((2 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((3.5 + lookX) * s, (bodyY - 9) * s);
      ctx.lineTo((-3.5 + lookX) * s, (bodyY - 9) * s);
      ctx.fill();

      // 4. 크고 쫑긋한 세모 귀 (Large rounded triangle ears)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.moveTo(-11 * s, (bodyY - 14) * s);
      ctx.lineTo(-9 * s, (bodyY - 27) * s);
      ctx.lineTo(-3 * s, (bodyY - 17) * s);
      ctx.moveTo(11 * s, (bodyY - 14) * s);
      ctx.lineTo(9 * s, (bodyY - 27) * s);
      ctx.lineTo(3 * s, (bodyY - 17) * s);
      ctx.fill();

      // 핑크빛 귀 안쪽
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-9.5 * s, (bodyY - 15) * s);
      ctx.lineTo(-8.5 * s, (bodyY - 24) * s);
      ctx.lineTo(-4.5 * s, (bodyY - 17) * s);
      ctx.moveTo(9.5 * s, (bodyY - 15) * s);
      ctx.lineTo(8.5 * s, (bodyY - 24) * s);
      ctx.lineTo(4.5 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'shiba': {
      // 시바견: 황갈색 털, 하얀 볼터치(우라지로), 하얀 눈썹 점, 돌돌 말린 꼬리
      // 1. 돌돌 말린 도넛 꼬리 (Curled tail)
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 2) * s, 6.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 2) * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 & 흰 가슴 (우라지로)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 7) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (황갈색)
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 하얀 볼살 패치 (양 볼의 흰 우라지로)
      ctx.fillStyle = '#fafaf9';
      ctx.beginPath();
      ctx.ellipse((-6.5 + lookX * 0.5) * s, (bodyY - 5.5) * s, 5 * s, 4.5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse((6.5 + lookX * 0.5) * s, (bodyY - 5.5) * s, 5 * s, 4.5 * s, 0.2, 0, Math.PI * 2);
      ctx.ellipse(lookX * s, (bodyY - 5.5) * s, 4.5 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 4. 단단하고 쫑긋한 세모 귀
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 24) * s);
      ctx.lineTo(-2.5 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 24) * s);
      ctx.lineTo(2.5 * s, (bodyY - 17) * s);
      ctx.fill();

      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-8.5 * s, (bodyY - 16) * s);
      ctx.lineTo(-7 * s, (bodyY - 22) * s);
      ctx.lineTo(-4 * s, (bodyY - 17) * s);
      ctx.moveTo(8.5 * s, (bodyY - 16) * s);
      ctx.lineTo(7 * s, (bodyY - 22) * s);
      ctx.lineTo(4 * s, (bodyY - 17) * s);
      ctx.fill();

      // 5. 시바견의 상징: 하얀 눈썹 점 2개!
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc((-5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.arc((5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'beagle': {
      // 비글: 흰색 바탕에 갈색·검정 삼색 얼룩(Tri-color), 처진 귀, 흰 끝 꼬리
      // 1. 위로 솟은 흰 끝 사냥개 꼬리
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(-11 * s, (bodyY + 6) * s);
      ctx.lineTo(-19 * s, (bodyY - 4) * s);
      ctx.lineTo(-16 * s, (bodyY - 6) * s);
      ctx.lineTo(-8 * s, (bodyY + 6) * s);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-18 * s, (bodyY - 4) * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 (흰색 바탕 + 검은 안장 패치)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 등 부분 블랙 안장 패치 (Black saddle)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(-2 * s, (bodyY + 3) * s, 8.5 * s, 9 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. 머리 (갈색 + 흰 블레이즈)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 얼굴 중앙 흰색 주둥이 & 블레이즈
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5.5) * s, 5.5 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-1.8 + lookX) * s, (bodyY - 14) * s);
      ctx.lineTo((1.8 + lookX) * s, (bodyY - 14) * s);
      ctx.lineTo((2.5 + lookX) * s, (bodyY - 8) * s);
      ctx.lineTo((-2.5 + lookX) * s, (bodyY - 8) * s);
      ctx.fill();

      // 4. 길게 처진 비글 귀 (Hound floppy ears)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(-16 * s, (bodyY - 7) * s, -17 * s, (bodyY + 1) * s, -11 * s, (bodyY + 3) * s);
      ctx.bezierCurveTo(-9 * s, (bodyY) * s, -8 * s, (bodyY - 6) * s, -7 * s, (bodyY - 11) * s);
      ctx.moveTo(9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(16 * s, (bodyY - 7) * s, 17 * s, (bodyY + 1) * s, 11 * s, (bodyY + 3) * s);
      ctx.bezierCurveTo(9 * s, (bodyY) * s, 8 * s, (bodyY - 6) * s, 7 * s, (bodyY - 11) * s);
      ctx.fill();
      break;
    }

    case 'border_collie': {
      // 보더콜리: 칠흑 같은 블랙 & 화이트 지능형 목양견, 날렵한 귀
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 화이트 가슴 칼라 & 넥카라
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 6) * s, 8 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (블랙)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 얼굴 중앙 흰색 블레이즈 & 주둥이
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 5.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo((-1.5 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((1.5 + lookX) * s, (bodyY - 15) * s);
      ctx.lineTo((2 + lookX) * s, (bodyY - 6) * s);
      ctx.lineTo((-2 + lookX) * s, (bodyY - 6) * s);
      ctx.fill();

      // 반쯤 접힌 총명한 세모 귀
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 14) * s);
      ctx.lineTo(-7 * s, (bodyY - 23) * s);
      ctx.lineTo(-3 * s, (bodyY - 16) * s);
      ctx.moveTo(10 * s, (bodyY - 14) * s);
      ctx.lineTo(7 * s, (bodyY - 23) * s);
      ctx.lineTo(3 * s, (bodyY - 16) * s);
      ctx.fill();
      break;
    }

    case 'husky': {
      // 시베리안 허스키: 은회색 & 화이트 마스크, 늑대형 직립 귀
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, (bodyY + 6) * s, 8 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (은회색)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 허스키 고유 화이트 마스크 & 눈가 무늬
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 5) * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.arc((-5 + lookX) * s, (bodyY - 9) * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc((5 + lookX) * s, (bodyY - 9) * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 늑대형 직립 귀
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 25) * s);
      ctx.lineTo(-2 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 25) * s);
      ctx.lineTo(2 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'dalmatian': {
      // 달마시안: 순백색 털에 검정 스팟 점박이 무늬
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 몸통 블랙 점박이들
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4 * s, (bodyY + 2) * s, 2 * s, 0, Math.PI * 2);
      ctx.arc(5 * s, (bodyY + 6) * s, 2.2 * s, 0, Math.PI * 2);
      ctx.arc(-1 * s, (bodyY + 9) * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머리
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 머리 점박이
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc((-6 + lookX) * s, (bodyY - 11) * s, 1.8 * s, 0, Math.PI * 2);
      ctx.arc((6 + lookX) * s, (bodyY - 6) * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 점박이 처진 귀
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(-15 * s, (bodyY - 7) * s, -16 * s, (bodyY + 1) * s, -10 * s, (bodyY + 3) * s);
      ctx.moveTo(9 * s, (bodyY - 13) * s);
      ctx.bezierCurveTo(15 * s, (bodyY - 7) * s, 16 * s, (bodyY + 1) * s, 10 * s, (bodyY + 3) * s);
      ctx.fill();
      break;
    }

    case 'french_bulldog': {
      // 프렌치 불독: 다부진 체구, 둥근 박쥐 모양 큰 귀
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 14 * s, 13 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 16 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 머리 (넓적한 사각 라운드)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 7) * s, 13.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 짧은 주둥이 & 머즐
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 4) * s, 6.5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 시그니처: 거대한 박쥐 귀 (Bat ears)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(-9 * s, (bodyY - 18) * s, 5 * s, 9 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(9 * s, (bodyY - 18) * s, 5 * s, 9 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.ellipse(-9 * s, (bodyY - 18) * s, 3 * s, 6.5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(9 * s, (bodyY - 18) * s, 3 * s, 6.5 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'doberman': {
      // 도베르만: 날렵한 블랙 & 탄, 날카로운 직립 귀
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 15 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 황갈색(탄) 가슴 무늬
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(-4 * s, (bodyY + 7) * s, 3.5 * s, 5 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(4 * s, (bodyY + 7) * s, 3.5 * s, 5 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 머리 (블랙)
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 탄 주둥이 & 눈썹 점 2개
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(lookX * s, (bodyY - 4.5) * s, 6 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.arc((-4.5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.arc((4.5 + lookX) * s, (bodyY - 13) * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();

      // 날렵하고 뾰족한 직립 귀
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (bodyY - 15) * s);
      ctx.lineTo(-7 * s, (bodyY - 27) * s);
      ctx.lineTo(-3 * s, (bodyY - 17) * s);
      ctx.moveTo(9 * s, (bodyY - 15) * s);
      ctx.lineTo(7 * s, (bodyY - 27) * s);
      ctx.lineTo(3 * s, (bodyY - 17) * s);
      ctx.fill();
      break;
    }

    case 'maltese': {
      // 말티즈: 순백의 부드러운 솜털, 앙증맞은 쳐진 귀 & 머리 위 빨간 리본 핀
      // 1. 살랑이는 깃털 꼬리
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 3) * s, 6.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 12 * s, 13 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 14 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. 머리
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 12.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. 귀여운 쳐진 털 귀
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.ellipse(-10 * s, (bodyY - 7) * s, 4.5 * s, 8 * s, -0.2, 0, Math.PI * 2);
      ctx.ellipse(10 * s, (bodyY - 7) * s, 4.5 * s, 8 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 5. 머리 위 포인트 레드 리본 핀
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-3 * s, (bodyY - 20) * s, 3 * s, 0, Math.PI * 2);
      ctx.arc(3 * s, (bodyY - 20) * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 20) * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'poodle': {
      // 토이푸들: 곱슬곱슬한 초코 브라운 털, 몽글몽글한 폼폼 귀와 폼폼 꼬리
      // 1. 폼폼 꼬리
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(-14 * s, (bodyY + 3) * s, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통 (곱슬 푸들 볼륨)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 12 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. 둥근 폼폼 크라운 머리
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.arc(0, (bodyY - 14) * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. 풍성한 폼폼 귀
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(-11 * s, (bodyY - 6) * s, 6.5 * s, 0, Math.PI * 2);
      ctx.arc(11 * s, (bodyY - 6) * s, 6.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pomeranian':
    default: {
      // 포메라니안: 뽀얀 크림 화이트 솜사탕 털, 쫑긋한 작은 세모 귀, 말린 꼬리
      // 1. 복슬복슬 둥근 꼬리
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-13 * s, (bodyY + 4) * s, 7 * s, 0, Math.PI * 2);
      ctx.fill();

      // 2. 몸통
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (isBipedal) {
        ctx.ellipse(0, (bodyY + 4) * s, 13 * s, 14 * s, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, (bodyY + 5) * s, 15 * s, 11 * s, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. 머리 (솜사탕 털)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, (bodyY - 8) * s, 13 * s, 0, Math.PI * 2);
      ctx.fill();

      // 4. 쫑긋한 작은 세모 귀
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(-10 * s, (bodyY - 16) * s);
      ctx.lineTo(-6 * s, (bodyY - 24) * s);
      ctx.lineTo(-2 * s, (bodyY - 17) * s);
      ctx.moveTo(10 * s, (bodyY - 16) * s);
      ctx.lineTo(6 * s, (bodyY - 24) * s);
      ctx.lineTo(2 * s, (bodyY - 17) * s);
      ctx.fill();

      // 핑크빛 안쪽 귀
      ctx.fillStyle = '#fecdd3';
      ctx.beginPath();
      ctx.moveTo(-8.5 * s, (bodyY - 17) * s);
      ctx.lineTo(-6 * s, (bodyY - 22) * s);
      ctx.lineTo(-3.5 * s, (bodyY - 18) * s);
      ctx.moveTo(8.5 * s, (bodyY - 17) * s);
      ctx.lineTo(6 * s, (bodyY - 22) * s);
      ctx.lineTo(3.5 * s, (bodyY - 18) * s);
      ctx.fill();
      break;
    }
  }

  // 공통: 초롱초롱한 눈 & 반짝이는 코
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc((-4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
  ctx.arc((4.5 + lookX) * s, (bodyY - 9) * s, 1.9 * s, 0, Math.PI * 2);
  ctx.fill();

  // 눈 하이라이트 (반짝임)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc((-5.2 + lookX) * s, (bodyY - 9.7) * s, 0.7 * s, 0, Math.PI * 2);
  ctx.arc((3.8 + lookX) * s, (bodyY - 9.7) * s, 0.7 * s, 0, Math.PI * 2);
  ctx.fill();

  // 코
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(lookX * s, (bodyY - 5.5) * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 상점 프리미엄 스킨 (황금 왕관, 탐정 모자, 우주 헬멧) 렌더러
 */
export function drawDogSkin(ctx, skinId, scale = 1, bodyY = 0) {
  const s = scale;
  if (skinId === 'skin_crown') {
    ctx.save();
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-8 * s, (bodyY - 21) * s);
    ctx.lineTo(-6 * s, (bodyY - 30) * s);
    ctx.lineTo(-2 * s, (bodyY - 24) * s);
    ctx.lineTo(0, (bodyY - 32) * s);
    ctx.lineTo(2 * s, (bodyY - 24) * s);
    ctx.lineTo(6 * s, (bodyY - 30) * s);
    ctx.lineTo(8 * s, (bodyY - 21) * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (skinId === 'skin_detective') {
    ctx.save();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(-12 * s, (bodyY - 22) * s, 24 * s, 5 * s, 2 * s);
    ctx.roundRect(-8 * s, (bodyY - 28) * s, 16 * s, 8 * s, 3 * s);
    ctx.fill();
    ctx.restore();
  } else if (skinId === 'skin_astronaut') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, (bodyY - 8) * s, 15 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}
