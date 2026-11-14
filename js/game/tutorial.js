/**
 * js/game/tutorial.js
 * 우유 교관 등장형 6단계 행동 유도 전투 튜토리얼 컨트롤러
 * - Step 1: 드래그 이동 & 자동 사격으로 좀비 2마리 처치
 * - Step 2: 상단 전광판(목표 단어) 안내 및 확인 버튼/터치
 * - Step 3: 벙커 해치 이동 & 선택한 학습 언어(save.studyLang) 기초 단어 3문제 해독 (오답 시 다정한 재시도 유도)
 * - Step 4: 레벨업 스킬 3종 선택창 & 선택한 스킬 적용 1줄 설명
 * - Step 5: 새 스킬로 좀비 처치 & 바닥 보석 수집으로 필살기 게이지 100% 충전
 * - Step 6: 더블탭 필살기 발동 & 칭찬 후 로비 전환 (tutorialDone = true)
 */

import { BALANCE } from '../config/balance.js';
import { t } from '../data/i18n.js';
import { updateSave } from '../core/saveStore.js';

export class TutorialController {
  constructor() {
    this.resetState();
  }

  resetState() {
    this.active = false;
    this.step = 0; // 1 ~ 6
    this.movedDist = 0;
    this.hasMoved = false;
    this.step1Kills = 0;
    this.solvedCount = 0;
    this.retryHintActive = false;
    this.selectedSkillName = '';
    this.explainTimer = 0;
    this.pendingStep5Setup = false;
    this.completeTimer = 0;
    this.ultTriggered = false;
  }

  start() {
    this.resetState();
    this.active = true;
    this.step = 1;
  }

  stop() {
    this.resetState();
  }

  recordMovement(dx, dy) {
    if (!this.active || this.step !== 1) return;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      this.movedDist += d;
      if (this.movedDist >= (BALANCE.TUTORIAL.STEP1_MIN_MOVE_DIST || 24)) {
        this.hasMoved = true;
      }
    }
  }

  checkStep1Advance(kills) {
    if (!this.active || this.step !== 1) return false;
    this.step1Kills = Math.min(BALANCE.TUTORIAL.STEP1_TARGET_KILLS, kills);
    if (this.hasMoved && kills >= BALANCE.TUTORIAL.STEP1_TARGET_KILLS) {
      this.step = 2;
      return true;
    }
    return false;
  }

  acknowledgeStep2() {
    if (!this.active || this.step !== 2) return false;
    this.step = 3;
    this.retryHintActive = false;
    return true;
  }

  onMonolithAnswer(isCorrect) {
    if (!this.active || this.step !== 3) return { advanceToStep4: false, isRetry: false };
    if (isCorrect) {
      this.solvedCount += 1;
      this.retryHintActive = false;
      if (this.solvedCount >= BALANCE.TUTORIAL.QUESTION_COUNT) {
        this.step = 4;
        return { advanceToStep4: true, isRetry: false };
      }
      return { advanceToStep4: false, isRetry: false };
    }
    this.retryHintActive = true;
    return { advanceToStep4: false, isRetry: true };
  }

  onSkillPicked(skillName) {
    if (!this.active || this.step !== 4) return;
    this.selectedSkillName = skillName || '음파 멍멍';
    this.explainTimer = 0;
    this.step = 5;
    this.pendingStep5Setup = true;
  }

  update(dt, player) {
    if (!this.active) return { transitionedToStep5: false, transitionedToStep6: false, completedAll: false };

    let transitionedToStep5 = false;
    let transitionedToStep6 = false;
    let completedAll = false;

    if (this.pendingStep5Setup) {
      this.pendingStep5Setup = false;
      transitionedToStep5 = true;
    } else if (this.step === 4 && this.explainTimer > 0) {
      this.explainTimer = Math.max(0, this.explainTimer - dt);
      if (this.explainTimer <= 0) {
        this.step = 5;
        transitionedToStep5 = true;
      }
    } else if (this.step === 5 && player) {
      if (player.ultGauge >= BALANCE.COMBAT.ULT_MAX_GAUGE) {
        player.ultGauge = BALANCE.COMBAT.ULT_MAX_GAUGE;
        this.step = 6;
        transitionedToStep6 = true;
      }
    } else if (this.step === 6 && this.ultTriggered && this.completeTimer > 0) {
      this.completeTimer = Math.max(0, this.completeTimer - dt);
      if (this.completeTimer <= 0) {
        completedAll = true;
      }
    }

    return { transitionedToStep5, transitionedToStep6, completedAll };
  }

  onUltUsed() {
    if (!this.active || this.step !== 6 || this.ultTriggered) return false;
    this.ultTriggered = true;
    this.completeTimer = BALANCE.TUTORIAL.STEP6_COMPLETE_SEC || 1.55;
    return true;
  }

  finish() {
    this.active = false;
    this.step = 0;
    this.ultTriggered = true;
    updateSave((s) => {
      s.tutorialCompleted = true;
      s.tutorialDone = true;
      s.onboardingCompleted = false;
      s.onboardingStep = 0;
      // 튜토리얼 훈련소 1회 강화(15금화) 후 약 20금화 여유가 남도록 초기 금화 35 보장
      if (typeof s.gold !== 'number' || s.gold <= 0) {
        s.gold = 35;
      }
    });
  }

  getCoachingState(ultGauge = 0, currentWord = null) {
    if (!this.active) return null;

    let text = '';
    let countText = '';
    let showAckButton = false;

    if (this.step === 1) {
      text = t('tutorial.step1');
      countText = `${Math.min(BALANCE.TUTORIAL.STEP1_TARGET_KILLS, this.step1Kills)} / ${BALANCE.TUTORIAL.STEP1_TARGET_KILLS}`;
    } else if (this.step === 2) {
      text = t('tutorial.step2');
      showAckButton = true;
    } else if (this.step === 3) {
      const wordStr = currentWord?.word || '';
      const meaningStr = currentWord?.meaning || '';
      text = this.retryHintActive
        ? (t('tutorial.step3Retry', { word: wordStr, meaning: meaningStr }) || "앗, 그건 오답 벙커야! 위 전광판 단어와 맞는 발바닥(🐾) 표시 해치로 들어가 봐!")
        : t('tutorial.step3', { word: wordStr, meaning: meaningStr, current: this.solvedCount, target: BALANCE.TUTORIAL.QUESTION_COUNT });
      countText = `${this.solvedCount} / ${BALANCE.TUTORIAL.QUESTION_COUNT}`;
    } else if (this.step === 4) {
      text = this.selectedSkillName
        ? t('tutorial.step4Applied', { skillName: this.selectedSkillName })
        : t('tutorial.step4');
    } else if (this.step === 5) {
      const pct = Math.min(100, Math.round((ultGauge / BALANCE.COMBAT.ULT_MAX_GAUGE) * 100));
      text = t('tutorial.step5');
      countText = `${pct}%`;
    } else if (this.step === 6) {
      text = this.ultTriggered ? t('tutorial.step6Done') : t('tutorial.step6');
    }

    return {
      active: true,
      step: this.step,
      totalSteps: 6,
      text,
      countText,
      showAckButton,
      showDragGesture: this.step === 1,
      showDoubleTapGesture: this.step === 6 && !this.ultTriggered,
      highlightScoreboard: this.step === 2,
      highlightMonoliths: this.step === 3,
      highlightUltGauge: this.step === 2 || this.step === 5 || (this.step === 6 && !this.ultTriggered),
    };
  }

  getBannerText() {
    const st = this.getCoachingState();
    return st ? st.text : '';
  }
}
