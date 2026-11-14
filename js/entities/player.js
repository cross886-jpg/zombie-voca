/**
 * js/entities/player.js
 * 플레이어 모듈 통합 허브 (Facade)
 * 기존 외부 import와의 100% 하위 호환성을 보장하며 하위 분리 모듈을 re-export합니다.
 *
 * 분리 모듈 구조:
 * - entities/playerStats.js   : computePlayerStats, getEvolutionStage
 * - entities/playerEntity.js  : class Player
 * - render/dogCharacterDraw.js: drawDogCharacter, drawDogSkin
 */

export { getEvolutionStage, computePlayerStats } from './playerStats.js';
export { Player } from './playerEntity.js';
export { drawDogCharacter, drawDogSkin } from '../render/dogCharacterDraw.js';
