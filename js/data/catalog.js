/**
 * js/data/catalog.js
 * 스킬 8종, 간식 5종, 동물 친구 4종, 코스튬 파츠 & 도감 보너스 마스터 카탈로그
 */

export const SKILLS = Object.freeze([
  // === 속성 짖기 4종 (Active Bark Skills) ===
  {
    id: 'bark_sonic',
    category: 'bark',
    name: '음파 멍멍',
    icon: '🔊',
    color: '#38bdf8',
    maxLevel: 5,
    baseDamageMult: 1.0,
    cooldown: 0.72,
    range: 190,
    desc: '전방으로 날아가는 푸른 음파탄을 발사합니다.',
  },
  {
    id: 'bark_flame',
    category: 'bark',
    name: '불꽃 왈왈',
    icon: '🔥',
    color: '#fb923c',
    maxLevel: 5,
    baseDamageMult: 1.25,
    cooldown: 1.15,
    range: 165,
    desc: '폭발하는 화염구를 뿜어 범위 내 좀비를 태웁니다.',
  },
  {
    id: 'bark_frost',
    category: 'bark',
    name: '서리 낑낑',
    icon: '❄️',
    color: '#67e8f9',
    maxLevel: 5,
    baseDamageMult: 0.85,
    cooldown: 1.35,
    range: 180,
    slowDuration: 2.0,
    desc: '냉기 파동으로 주변 좀비를 2초간 둔화시킵니다.',
  },
  {
    id: 'bark_thunder',
    category: 'bark',
    name: '번개 크르릉',
    icon: '⚡',
    color: '#facc15',
    maxLevel: 5,
    baseDamageMult: 1.35,
    cooldown: 1.45,
    range: 230,
    chainCount: 3,
    desc: '가장 가까운 좀비에게 연쇄 번개를 내리꽂습니다.',
  },

  // === 강아지 행동 패시브 4종 (Puppy Behavior Passives) ===
  {
    id: 'passive_zoomies',
    category: 'passive',
    name: '우다다 질주',
    icon: '💨',
    color: '#a7f3d0',
    maxLevel: 5,
    stat: 'speedMult',
    perLevel: 0.1,
    desc: '신나게 달립니다! 이동 속도가 레벨당 10% 증가합니다.',
  },
  {
    id: 'passive_thick_fur',
    category: 'passive',
    name: '복슬복슬 털옷',
    icon: '🛡️',
    color: '#f9a8d4',
    maxLevel: 5,
    stat: 'maxHpMult',
    perLevel: 0.15,
    desc: '풍성한 포메라니안 털이 최대 체력을 15% 높여줍니다.',
  },
  {
    id: 'passive_magnet',
    category: 'passive',
    name: '간식 레이더 코',
    icon: '👃',
    color: '#c4b5fd',
    maxLevel: 5,
    stat: 'pickupMult',
    perLevel: 0.25,
    desc: '보카 젬과 간식 흡수 반경이 레벨당 25% 넓어집니다.',
  },
  {
    id: 'passive_sharp_fangs',
    category: 'passive',
    name: '날카로운 송곳니',
    icon: '🦷',
    color: '#fda4af',
    maxLevel: 5,
    stat: 'atkMult',
    perLevel: 0.14,
    desc: '모든 짖기 공격 피해량이 레벨당 14% 증가합니다.',
  },
]);

export const SNACKS = Object.freeze([
  { id: 'snack_jerky', name: '소고기 육포', icon: '🥩', rarity: 'common', healHp: 25, desc: '체력을 25 회복하고 동료 호감도를 올립니다.' },
  { id: 'snack_cheese', name: '고소한 치즈볼', icon: '🧀', rarity: 'common', healHp: 35, desc: '체력을 35 회복하는 달콤짭짤한 간식입니다.' },
  { id: 'snack_bone', name: '영양 뼈다귀', icon: '🦴', rarity: 'rare', healHp: 50, desc: '체력 50 회복 및 필살기 게이지 +10% 충전!' },
  { id: 'snack_salmon', name: '훈제 연어 트릿', icon: '🍣', rarity: 'epic', healHp: 65, desc: '고양이와 강아지 모두가 열광하는 특식입니다.' },
  { id: 'snack_golden', name: '황금 로얄 비스킷', icon: '🍪', rarity: 'legend', healHp: 100, desc: '체력을 100%에 가깝게 회복시키는 전설의 간식!' },
]);

export const COMPANIONS = Object.freeze([
  {
    id: 'rookie',
    name: '길고양이 루키',
    icon: '🐱',
    color: '#fbbf24',
    unlockChapter: 1,
    unlockReq: null,
    unlockSnacks: 50,
    role: '근접 할퀴기 딜러',
    baseAtk: 14,
    cooldown: 0.85,
    range: 95,
    attackStyle: 'slash',
    desc: '민첩한 몸놀림으로 우유 주변 좀비를 연속 할큅니다.',
  },
  {
    id: 'nuts',
    name: '공원 다람쥐 넛츠',
    icon: '🐿️',
    color: '#d97706',
    unlockChapter: 2,
    unlockReq: { prevId: 'rookie', prevLv: 3 },
    unlockSnacks: 150,
    role: '원거리 도토리 연사',
    baseAtk: 11,
    cooldown: 0.65,
    range: 240,
    attackStyle: 'acorn',
    desc: '빠른 속도로 단단한 도토리를 던져 원거리 견제를 합니다.',
  },
  {
    id: 'max',
    name: '은퇴 경찰견 맥스',
    icon: '🐕‍🦺',
    color: '#60a5fa',
    unlockChapter: 3,
    unlockReq: { prevId: 'nuts', prevLv: 5 },
    unlockSnacks: 400,
    role: '전방 돌진 탱커',
    baseAtk: 22,
    cooldown: 1.5,
    range: 130,
    attackStyle: 'charge',
    desc: '묵직한 돌진으로 좀비 무리를 밀어내고 큰 피해를 줍니다.',
  },
  {
    id: 'piji',
    name: '정찰 비둘기 피지',
    icon: '🕊️',
    color: '#e2e8f0',
    unlockChapter: 4,
    unlockReq: { prevId: 'max', prevLv: 7 },
    unlockSnacks: 1000,
    role: '공중 폭격 서포터',
    baseAtk: 18,
    cooldown: 1.35,
    range: 260,
    attackStyle: 'dive',
    desc: '하늘을 날며 목표 지점에 충격 깃털 폭격을 떨어뜨립니다.',
  },
]);

export const COSTUMES = Object.freeze([
  // 모자 파츠 (hat)
  { id: 'hat_cap', slot: 'hat', name: '네온 야구모자', icon: '🧢', rarity: 'common', color: '#38bdf8', atkBonus: 3, hpBonus: 10 },
  { id: 'hat_beret', slot: 'hat', name: '탐정 베레모', icon: '🎓', rarity: 'rare', color: '#a78bfa', atkBonus: 6, hpBonus: 20 },
  { id: 'hat_crown', slot: 'hat', name: '슈퍼 가디언 왕관', icon: '👑', rarity: 'legend', color: '#facc15', atkBonus: 14, hpBonus: 45 },

  // 의상 파츠 (outfit)
  { id: 'outfit_hoodie', slot: 'outfit', name: '여행자 후드티', icon: '🧥', rarity: 'common', color: '#fb7185', atkBonus: 2, hpBonus: 18 },
  { id: 'outfit_vest', slot: 'outfit', name: '방탄 경찰 조끼', icon: '🦺', rarity: 'rare', color: '#3b82f6', atkBonus: 5, hpBonus: 35 },
  { id: 'outfit_cape', slot: 'outfit', name: '스타라이트 망토', icon: '🦸', rarity: 'epic', color: '#f472b6', atkBonus: 10, hpBonus: 50 },

  // 무기/장식 파츠 (weapon)
  { id: 'weapon_collar', slot: 'weapon', name: 'LED 방울 목걸이', icon: '🔔', rarity: 'common', color: '#34d399', atkBonus: 4, hpBonus: 8 },
  { id: 'weapon_blade', slot: 'weapon', name: '플라즈마 뼈검', icon: '🗡️', rarity: 'epic', color: '#22d3ee', atkBonus: 12, hpBonus: 25 },

  // 오라 파츠 (aura)
  { id: 'aura_cyber', slot: 'aura', name: '사이버 네온 링', icon: '💫', rarity: 'rare', color: '#2dd4bf', atkBonus: 7, hpBonus: 25 },
  { id: 'aura_nova', slot: 'aura', name: '슈퍼노바 후광', icon: '🌟', rarity: 'legend', color: '#fbbf24', atkBonus: 16, hpBonus: 60 },
]);

/**
 * 보유 중인 코스튬 전체의 도감 누적 보너스 계산 (착용 여부와 무관하게 보유만 해도 적용)
 * @param {string[]} ownedCostumeIds
 * @returns {{ atkBonus: number, hpBonus: number }}
 */
export function getCostumeCollectionBonus(ownedCostumeIds = []) {
  const ownedSet = new Set(ownedCostumeIds);
  let atkBonus = 0;
  let hpBonus = 0;

  for (const item of COSTUMES) {
    if (ownedSet.has(item.id)) {
      atkBonus += item.atkBonus;
      hpBonus += item.hpBonus;
    }
  }
  return { atkBonus, hpBonus };
}

