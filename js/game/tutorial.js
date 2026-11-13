/**
 * js/game/tutorial.js
 * 첫 접속 30초 프롤로그 미니 전투(1번 이동·짖기 → 2번 비석 0.4초 점령 → 3번 필살기 터치) 전담
 */

import { BALANCE } from '../config/balance.js';
import { t } from '../data/i18n.js';
import { updateSave } from '../core/saveStore.js';

export class TutorialController {
  constructor() {
    this.active = false;
    this.step = 0; // 1, 2, 3
    this.ultTriggered = false;
  }

  start() {
    this.active = true;
    this.step = 1;
    this.ultTriggered = false;
  }

  stop() {
    this.active = false;
    this.step = 0;
  }

  /**
   * 현재 튜토리얼 단계에 맞는 상단 안내 문구 반환
   * @returns {string}
   */
  getBannerText() {
    if (!this.active) return '';
    if (this.step === 1) return t('tutorial.step1');
    if (this.step === 2) return t('tutorial.step2');
    if (this.step === 3) return t('tutorial.step3');
    return '';
  }

  /**
   * 문제 진행(questionIndex: 0, 1, 2)에 맞춰 튜토리얼 단계 전환 및 3단계 필살기 100% 충전
   */
  onQuestionStarted(questionIndex, player) {
    if (!this.active) return;
    this.step = Math.min(3, questionIndex + 1);
    if (this.step === 3 && player) {
      player.ultGauge = BALANCE.COMBAT.ULT_MAX_GAUGE;
    }
  }

  onUltUsed() {
    if (!this.active) return;
    this.ultTriggered = true;
  }

  finish() {
    this.active = false;
    updateSave((s) => {
      s.tutorialCompleted = true;
      s.tutorialDone = true;
    });
  }
}

