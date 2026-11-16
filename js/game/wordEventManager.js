/**
 * js/game/wordEventManager.js
 * 벙커 해치 단어 퀴즈 출제, 선택지 생성, 정답/오답 판정 및 보상/디버프,
 * 오답 복습 큐(Spaced Repetition) 및 오답 일시정지 브레이크 관리 모듈
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { COMPANIONS } from '../data/catalog.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave, recordQuestProgress } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { wordEngine } from '../core/wordEngine.js';
import { recordStudyMastery, formatCourseBadge } from '../core/courseEngine.js';
import settingsStore from '../settingsStore.js';

export class WordEventManager {
  constructor(engine) {
    this.engine = engine;

    this.deck = [];
    this.questionIndex = 0;
    this.currentWord = null;
    this.respawnTimer = 0;
    this.waitingRespawn = false;
    this.wrongReviewTimer = 0;
    this.wrongReviewWord = null;
    this.usedWordIds = new Set();
  }

  reset() {
    this.deck = [];
    this.questionIndex = 0;
    this.currentWord = null;
    this.respawnTimer = 0;
    this.waitingRespawn = false;
    this.wrongReviewTimer = 0;
    this.wrongReviewWord = null;
    this.usedWordIds = new Set();
  }

  presentCurrentQuestion() {
    const engine = this.engine;

    if (engine.runStats.isPlacementTest) {
      this.usedWordIds = this.usedWordIds || new Set();
      while (this.questionIndex < this.deck.length && this.usedWordIds.has(this.deck[this.questionIndex]?.id)) {
        this.questionIndex++;
      }
      if (this.questionIndex >= 10 || (engine.runStats.answeredCount || 0) >= 10 || this.questionIndex >= this.deck.length) {
        engine.monoliths.clearMonoliths();
        this.waitingRespawn = false;
        engine._finishStage(true);
        return;
      }
    }

    if (this.questionIndex >= this.deck.length) {
      if (engine.runStats.isPlacement) {
        engine._finishStage(true);
        return;
      }
      // 보스 미격파 상태에서 30번까지 다 소진한 경우 연장 문제 추가
      if (!engine.runStats.isTutorial && engine.enemies.boss && engine.enemies.boss.hp > 0) {
        const extraPool = wordEngine.getCourseWords(engine.course.id);
        const extraWord = extraPool[Math.floor(Math.random() * extraPool.length)];
        if (extraWord) {
          this.deck.push(extraWord);
        }
      } else {
        engine._finishStage(true);
        return;
      }
    }

    // 28번 문제(index 27) 진입 시 챕터 보스 등장 + 1.5초 줌아웃→줌인 연출 (월반 및 튜토리얼 제외)
    if (!engine.runStats.isTutorial && !engine.runStats.isPlacement && !engine.runStats.isPlacementTest && this.questionIndex === BALANCE.BOSS.ENTRY_QUESTION_INDEX && !engine.enemies.boss) {
      engine.stageDirector.spawnBoss();
    }

    // 실력 진단 테스트: 5번째 문제 완료 직후(6번째 문제 진입 시점: questionIndex >= 5) 스테이지 군단장 보스 출현
    if (engine.runStats.isPlacementTest && this.questionIndex >= 5 && !engine.enemies.boss) {
      engine.stageDirector.spawnBoss();
    }

    // 챕터 보스 스테이지 (30, 60, 90, 120, 150): 5번째 문제(questionIndex >= 4) 진입 시 보스 출현
    if (engine.runStats.isChapterBossStage && this.questionIndex >= 4 && !engine.enemies.boss) {
      engine.stageDirector.spawnBoss();
    }

    this.currentWord = this.deck[this.questionIndex];
    if (engine.runStats.isPlacementTest && this.currentWord) {
      this.usedWordIds = this.usedWordIds || new Set();
      this.usedWordIds.add(this.currentWord.id);
    }

    let choices;
    if (engine.runStats.isPlacementTest && Array.isArray(this.currentWord?.choices) && this.currentWord.choices.length > 0) {
      const targetMeaning = (this.currentWord._correctMeaning || this.currentWord.meaning || '').trim().toLowerCase();
      choices = this.currentWord.choices.map((c) => {
        const meaningStr = (typeof c === 'string' ? c : (c.meaning || '')).trim();
        return {
          wordId: this.currentWord.id,
          meaning: meaningStr,
          isCorrect: meaningStr.toLowerCase() === targetMeaning,
        };
      });
      if (!choices.some((c) => c.isCorrect) && choices.length > 0) {
        choices[0].isCorrect = true;
      }
    } else {
      choices = wordEngine.createQuestionChoices(this.currentWord);
    }

    // 캠퍼스 부엉이 고유 특기: 퀴즈 출제 시 오답 보기 1개 자동 제거 힌트
    if (engine.companions?.tryEliminateWrongChoice?.(choices)) {
      engine.combat?.spawnDamageText?.(engine.player.x, engine.player.y - 35, '🦉 부엉이 힌트! 오답 1개 제거', '#818cf8', 1.2);
      const elimIdx = choices.findIndex((c) => c.isEliminated);
      if (elimIdx !== -1) {
        choices.splice(elimIdx, 1);
      }
    }

    engine.monoliths.spawnMonoliths(
      choices,
      engine.arenaWidth,
      engine.arenaHeight,
      engine.player.x,
      engine.player.y,
      engine.obstacles.obstacles
    );

    audioEngine.startWordLoop(this.currentWord.word);

    engine.handlers.onQuestionChanged?.({
      word: this.currentWord,
      questionNumber: this.questionIndex + 1,
      totalQuestions: engine.runStats.isTutorial ? BALANCE.TUTORIAL.QUESTION_COUNT : this.deck.length,
      streak: wordEngine.getWordStreak(this.currentWord.id),
      courseId: engine.course.id,
      chapterNumber: engine.chapter.number,
      tutorialText: engine.tutorial.getBannerText(),
      isTutorial: engine.runStats.isTutorial,
    });
  }

  handleMonolithResolved(monolith) {
    const engine = this.engine;
    audioEngine.stopWordLoop();

    const isCorrect = monolith.isCorrect;
    const wordRes = engine.runStats.isPlacementTest
      ? { newlyMastered: false, streak: 0 }
      : wordEngine.submitAnswer(this.currentWord.id, isCorrect);

    if (isCorrect) {
      engine.runStats.correctCount += 1;
      engine.runStats.earnedEvoXp += BALANCE.MONOLITH.CORRECT_XP;
      if (wordRes.newlyMastered && !engine.runStats.isPlacementTest) {
        engine.runStats.newlyMasteredCount += 1;
        // 현재 학습 유닛 단어를 모두 마스터하면 다음 유닛 및 티어/등급 게이지 자동 상승
        if (recordStudyMastery(this.currentWord.id)) {
          engine.handlers.onBanner?.(`🎉 학습 유닛 마스터! 현재 코스 ${formatCourseBadge()}`);
        }
      }

      if (!engine.runStats.isTutorial) {
        engine.player.addUltGauge(BALANCE.COMBAT.ULT_CHARGE_PER_CORRECT);
      }

      // 단어 정답 시 체력 회복량: 최대 체력의 4% 수준으로 대폭 축소 (과잉 회복 방지)
      const correctHeal = Math.max(1, Math.round(engine.player.maxHp * (BALANCE.MONOLITH.CORRECT_HEAL_RATIO || 0.04)));
      engine.player.heal(correctHeal);
      engine.combat.spawnDamageText(engine.player.x, engine.player.y - 28, `+${correctHeal} HP`, '#4ade80', 1.0);

      // 벙커 해치 정답 시 주인(Owner) 기력 100% 즉시 완충
      if (engine.player?.owner?.restoreFullStamina) {
        engine.player.owner.restoreFullStamina();
        engine.combat?.spawnDamageText?.(engine.player.owner.x, engine.player.owner.y - 20, '⚡ 기력 100% 완충!', '#38bdf8', 0.9);
      }

      // 전술 구조 캡슐 개방 굵직한 기본 금화 보상 (+25 🪙, 실력 진단 테스트 제외)
      const podGold = engine.runStats.isPlacementTest ? 0 : 25;
      if (podGold > 0) {
        engine.runStats.podGoldEarned = (engine.runStats.podGoldEarned || 0) + podGold;
        engine.combat.spawnDamageText(monolith.x + 24, monolith.y - 18, `+${podGold} 🪙`, '#fbbf24', 1.15);
      }

      // 캡슐 해치 개방 및 넉백 선명한 단일 충격파 + 스파크
      engine.combat.triggerCorrectShockwave(monolith, engine.camera, engine.player);
      audioEngine.playCorrect();

      // settingsStore 단어 정답 결과 기록 (최근 배운 단어 갱신 및 오답 큐 졸업)
      if (this.currentWord?.id !== undefined && this.currentWord?.id !== null) {
        settingsStore.recordWordResult(this.currentWord.id, true);
      }

      // [실력 진단 테스트 전용]: 8번째 정답(correctCount === 8) 시 랜덤 서포트 1마리 구출 & 배치 방법 튜토리얼 안내
      if (engine.runStats.isPlacementTest && engine.runStats.correctCount === 8 && !engine.runStats.placementCompanionRescued) {
        engine.runStats.placementCompanionRescued = true;
        const curSave = getSave();
        const unlocked = curSave.companions?.unlocked || [];
        const unrescued = COMPANIONS.filter((c) => !unlocked.includes(c.id));
        const candidateList = unrescued.length > 0 ? unrescued : COMPANIONS;
        const rescuedDef = candidateList[Math.floor(Math.random() * candidateList.length)];

        updateSave((s) => {
          if (!s.companions) s.companions = { unlocked: [], active: [], levels: {} };
          if (!s.companions.unlocked) s.companions.unlocked = [];
          if (!s.companions.unlocked.includes(rescuedDef.id)) {
            s.companions.unlocked.push(rescuedDef.id);
          }
          s.unlockedCompanions = s.companions.unlocked;
        });

        audioEngine.playPowerUp?.();
        engine.combat.spawnDamageText(monolith.x, monolith.y - 42, `🎉 ${rescuedDef.name} 구출 성공!`, '#34d399', 1.5);

        // 게임 일시정지 후 안내 팝업 표출
        engine.pause();
        engine.handlers.onCompanionRescueTutorial?.({
          companion: rescuedDef,
          onConfirm: () => {
            engine.resume();
          },
        });
      }

      // [정답 캡슐 개방 서프라이즈]: 아기 동물 구출 지원 vs 특수 전술 보급품 (튜토리얼, 월반, 실력 진단 테스트 제외)
      if (!engine.runStats.isTutorial && !engine.runStats.isPlacementTest && !engine.runStats.isPlacement) {
        // 스테이지당 동료 구출은 최대 1회(1마리)로 제한
        const canRescue = (engine.runStats.rescuedCompanionCount || 0) < 1;
        const curSave = getSave();
        const unrescuedCompanions = COMPANIONS.filter((c) => !curSave.companions?.unlocked?.includes(c.id));
        const hasUnrescued = unrescuedCompanions.length > 0;
        const surpriseRoll = Math.random();

        if (canRescue && hasUnrescued && surpriseRoll < 0.5) {
          // 1. 깜짝 아기 동물 구출 (스테이지당 최대 1마리 제한, 즉시 전장 합류 제거 → 로비 장착형)
          engine.runStats.rescuedCompanionCount = (engine.runStats.rescuedCompanionCount || 0) + 1;
          const rescuedDef = unrescuedCompanions[Math.floor(Math.random() * unrescuedCompanions.length)];

          updateSave((s) => {
            if (!s.companions) s.companions = { unlocked: [], active: [], levels: {} };
            if (!s.companions.unlocked) s.companions.unlocked = [];
            if (!s.companions.unlocked.includes(rescuedDef.id)) {
              s.companions.unlocked.push(rescuedDef.id);
            }
            s.unlockedCompanions = s.companions.unlocked;
          });

          // 1.8초 자동 슬로우 쇼케이스 카드 표출 (전투 즉시 합류 없이 해금만 진행)
          engine.autoRescueTimer = 1.8;
          engine.rescuedCompanion = rescuedDef;
          const bannerMsg = `🎉 새 동료 [${rescuedDef.name}] 구출 완료! 로비 [내 강아지]에서 장착할 수 있습니다`;
          engine.handlers.onBanner?.(bannerMsg);
          engine.combat.spawnDamageText(monolith.x, monolith.y - 42, `🎉 ${rescuedDef.name} 구출 성공!`, '#34d399', 1.5);
          audioEngine.playPowerUp?.();
        } else {
          // 2. 특수 전술 보급품 (경험치 보석 다발, 희귀 구급상자, 폭탄 충격파 폭발)
          engine.combat.spawnDamageText(monolith.x, monolith.y - 42, '📦 특수 전술 보급품 캡슐 해금!', '#22d3ee', 1.3);
          for (let g = 0; g < 5; g++) {
            const ga = (Math.PI * 2 * g) / 5;
            const gx = monolith.x + Math.cos(ga) * (24 + Math.random() * 22);
            const gy = monolith.y + Math.sin(ga) * (24 + Math.random() * 22);
            engine.monoliths.spawnDrop('gem', gx, gy, BALANCE.COMBAT.GEM_XP_VALUE * 1.2);
          }
          if (Math.random() < 0.35) {
            engine.monoliths.spawnDrop('medkit', monolith.x + 10, monolith.y - 8);
          }

          // 캡슐 보급 폭발: 주변 좀비 광역 처치 데미지
          for (const e of engine.enemies.enemies) {
            const d = Math.hypot(e.x - monolith.x, e.y - monolith.y);
            if (d <= 140) {
              engine.combat.damageEnemy(e, engine.player.atk * 1.8, '#f59e0b');
            }
          }
        }
      }

      // 보스전 중 정답 시 하늘에서 음파 레이저로 보스 고정 비율(약 33%) 체력 차감 및 최종 격파
      if (engine.enemies.boss && engine.enemies.boss.hp > 0) {
        engine.combat.triggerSonicLaser(engine.enemies.boss.x, engine.enemies.boss.y, engine.camera);
        const bossRes = engine.enemies.triggerBossSonicLaser();
        const laserLabel = bossRes.dealtDmg ? `${t('hud.sonicLaser')} -${bossRes.dealtDmg}` : t('hud.sonicLaser');
        engine.combat.spawnDamageText(engine.enemies.boss.x, engine.enemies.boss.y - 54, laserLabel, '#38bdf8', 1.25);

        if (bossRes.defeated) {
          recordQuestProgress('bossKills', 1);
          engine.runStats.bossDefeated = true;
          engine.combat.spawnDamageText(engine.enemies.boss.x, engine.enemies.boss.y - 70, '💥 보스 격파 성공!', '#fbbf24', 2.0);
          if (!engine.runStats.isPlacementTest) {
            engine._finishStage(true);
            return;
          }
        }
      }
    } else {
      if (engine.runStats.isTutorial) {
        // 튜토리얼 Step 3 오답 시: 다정하게 재시도 유도, 같은 단어 즉시 재도전
        audioEngine.playWrong();
        engine.combat.spawnDamageText(monolith.x, monolith.y - 36, '❌ 오답 벙커!', '#ef4444', 1.25);
        engine.camera?.shake(6, 0.2);
        engine.tutorial.onMonolithAnswer(false);
        engine.handlers.onWrongFeedback?.();
        this.waitingRespawn = true;
        this.respawnTimer = 1.0;
        return;
      }

      const shieldReduction = getTrainingBonusValue('shieldLv', getSave().training?.shieldLv || 0);
      const xpPenalty = Math.round(BALANCE.MONOLITH.WRONG_XP_PENALTY * (1 - shieldReduction));
      engine.runStats.wrongCount += 1;
      engine.runStats.earnedEvoXp = Math.max(0, engine.runStats.earnedEvoXp + xpPenalty);
      engine.player.applySlowDebuff();

      // [오답(함정) 캡슐 개방 매복 트랩 연출]: 붉은 경고등과 함께 숨어있던 좀비 무리(2~3마리) 기습 돌출
      engine.combat.spawnDamageText(monolith.x, monolith.y - 42, '🚨 좀비 기습 매복 트랩!', '#ef4444', 1.3);
      engine.camera?.shake(10, 0.28);
      audioEngine.playWrong();

      // settingsStore 단어 오답 결과 기록 (오답 큐에 누적)
      if (this.currentWord?.id !== undefined && this.currentWord?.id !== null) {
        settingsStore.recordWordResult(this.currentWord.id, false);
      }

      const ambushCount = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < ambushCount; i++) {
        const ang = (Math.PI * 2 * i) / ambushCount + (Math.random() - 0.5) * 0.4;
        const burstDist = 32 + Math.random() * 24;
        const zx = Math.max(80, Math.min(engine.arenaWidth - 80, monolith.x + Math.cos(ang) * burstDist));
        const zy = Math.max(80, Math.min(engine.arenaHeight - 80, monolith.y + Math.sin(ang) * burstDist));
        const z = engine.enemies.spawnEnemy('walker', zx, zy, 0.85, 1.0, 1.15);
        if (z) {
          z.knockVx = Math.cos(ang) * 200;
          z.knockVy = Math.sin(ang) * 200;
        }
      }

      // 월반 도전 시 오답 1회당 하트(남은 기회) 1개 차감, 3회 소진 시 즉시 실패 종료 (실력 진단 테스트는 10문제 끝까지 완주 보장)
      if (engine.runStats.isPlacement && !engine.runStats.isPlacementTest) {
        engine.runStats.placementLives = Math.max(0, (engine.runStats.placementLives ?? 3) - 1);
        if (engine.runStats.placementLives <= 0) {
          engine._finishStage(false);
          return;
        }
      }

      if (engine.runStats.isPlacementTest) {
        this.wrongReviewTimer = 0.6;
        this.wrongReviewWord = {
          word: '❌ 오답입니다!',
          phonetic: '',
          meaning: '',
          isPlacementTest: true,
        };
      } else {
        this.wrongReviewTimer = 1.2;
        this.wrongReviewWord = {
          word: this.currentWord.word,
          phonetic: this.currentWord.phonetic || '',
          meaning: this.currentWord.meaning,
        };
        audioEngine.speakWord(this.currentWord.word);
      }

      if (engine.enemies.boss && engine.enemies.boss.hp > 0) {
        engine.enemies.enrageBoss();
        engine.combat.spawnDamageText(engine.enemies.boss.x, engine.enemies.boss.y - 54, t('hud.bossEnraged'), '#ef4444', 1.2);
      }
    }

    this.questionIndex += 1;

    if (engine.runStats.isPlacementTest) {
      engine.runStats.answeredCount = (engine.runStats.answeredCount || 0) + 1;
      if (engine.runStats.answeredCount >= 10 || this.questionIndex >= 10 || this.questionIndex >= this.deck.length) {
        engine.monoliths.clearMonoliths();
        this.waitingRespawn = false;
        const cleared = engine.runStats.correctCount >= 7 && Boolean(engine.runStats.bossDefeated);
        engine._finishStage(cleared);
        return;
      }
    }

    // 오답 시 해당 단어를 2~3문제 뒤 큐에 재삽입 (Spaced Repetition, 월반, 실력 진단 테스트 및 튜토리얼 제외)
    if (!engine.runStats.isTutorial && !engine.runStats.isPlacement && !engine.runStats.isPlacementTest && !isCorrect && this.currentWord) {
      const offset = Math.random() < 0.5 ? 2 : 3;
      let insertIdx = Math.min(this.deck.length, this.questionIndex + offset);
      const prevSame = this.deck[insertIdx - 1]?.id === this.currentWord.id;
      const nextSame = this.deck[insertIdx]?.id === this.currentWord.id;
      if ((prevSame || nextSame) && insertIdx < this.deck.length) {
        insertIdx = Math.min(this.deck.length, insertIdx + 1);
      }
      this.deck.splice(insertIdx, 0, this.currentWord);
    }

    // 튜토리얼 Step 3: 3문제 정답 시 Step 4(레벨업 스킬 선택)로 진행
    if (engine.runStats.isTutorial) {
      const tutRes = engine.tutorial.onMonolithAnswer(true);
      if (tutRes.advanceToStep4) {
        engine.monoliths.clearMonoliths();
        this.waitingRespawn = false;
        engine.openSkillSelect();
        return;
      }
      this.waitingRespawn = true;
      this.respawnTimer = 0.9;
      return;
    }

    if (!engine.runStats.isTutorial && this.questionIndex >= this.deck.length && (!engine.enemies.boss || engine.enemies.boss.hp <= 0)) {
      engine._finishStage(true);
      return;
    }

    // 1.5초 뒤 다음 문제 4개 비석 새 위치 스폰 대기
    this.waitingRespawn = true;
    this.respawnTimer = BALANCE.MONOLITH.RESPAWN_DELAY_SEC;

    // 본게임에서 단어 3문제 정답마다 정확히 1회 스킬 선택 모달 오픈 (튜토리얼 및 실력 진단 테스트 제외)
    const solvedCount = engine.runStats.correctCount;
    if (!engine.runStats.isTutorial && !engine.runStats.isPlacementTest && isCorrect && solvedCount > 0 && solvedCount % 3 === 0) {
      engine.openSkillSelect();
    }
  }

  updateWrongReview(dt) {
    if (this.wrongReviewTimer > 0) {
      this.wrongReviewTimer = Math.max(0, this.wrongReviewTimer - dt);
      if (this.wrongReviewTimer <= 0) {
        this.wrongReviewWord = null;
      }
      return true;
    }
    return false;
  }

  updateRespawn(dt) {
    if (this.waitingRespawn) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.waitingRespawn = false;
        this.presentCurrentQuestion();
      }
    }
  }
}

