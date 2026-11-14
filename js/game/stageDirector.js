/**
 * js/game/stageDirector.js
 * 스테이지 구성, 챕터/코스 설정, 초기 및 웨이브 스폰 지휘,
 * 보스전 등장 연출 및 스테이지 클리어/패배 정산 모듈
 */

import { BALANCE, calcStageReward } from '../config/balance.js';
import { getChapter, getChapterNumberForUnit } from '../data/chapters.js';
import { getTotalUnits } from '../data/data_en.js?v=2';
import { getSave, updateSave, recordQuestProgress } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { wordEngine } from '../core/wordEngine.js';
import { getCurrentStudyUnitId, getLangUnitWords, calcPlacementTier, WORD_LEVEL_TIERS } from '../core/courseEngine.js';
import { generatePlacementDeck, evaluatePlacementScore } from './placementTest.js';
import { GAME_STATES } from './gameEngine.js';

export class StageDirector {
  constructor(engine) {
    this.engine = engine;
  }

  startBattle({
    chapterNumber,
    courseId,
    unitId,
    isTutorial = false,
    isPromotion = false,
    targetLevel = 'A2',
    isPlacement = false,
    isPlacementTest = false,
    targetUnitNum = 1,
  } = {}) {
    const engine = this.engine;
    engine.resizeCanvas();
    const save = getSave();

    const isAnyPlacement = Boolean(isPlacement || isPlacementTest);
    const chosenCourseId = courseId || save.selectedCourse || 'lv1';
    const chosenUnitId = unitId || save.selectedUnit || 'unit_001';
    const curUnitNum = isAnyPlacement
      ? (targetUnitNum || 1)
      : parseInt((chosenUnitId || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const stageChapterNum = getChapterNumberForUnit(curUnitNum);

    engine.chapter = getChapter(chapterNumber || stageChapterNum || save.selectedChapter || 1);
    engine.course = BALANCE.COURSES.find((c) => c.id === chosenCourseId) || BALANCE.COURSES[0];

    engine.arenaWidth = engine.viewW * engine.chapter.arenaScale;
    engine.arenaHeight = engine.viewH * engine.chapter.arenaScale;

    const startX = engine.arenaWidth / 2;
    const startY = engine.arenaHeight / 2;

    const minHpRatio = isTutorial ? 0.5 : (isAnyPlacement ? 0.2 : 0.1);
    engine.player.resetForBattle(startX, startY, save, {
      isProtected: Boolean(isTutorial || isAnyPlacement),
      minHpRatio,
    });
    if (isPlacementTest || isPlacement) {
      engine.companions.resetForBattle(engine.player, { companions: { active: [] } });
    } else {
      engine.companions.resetForBattle(engine.player, save);
    }
    engine.enemies.resetForBattle();
    engine.monoliths.resetForBattle(Boolean(isTutorial));
    engine.obstacles.resetForBattle(engine.arenaWidth, engine.arenaHeight, startX, startY);
    engine.combat.reset(engine.player, engine.enemies, engine.monoliths);
    engine.camera.reset(startX, startY);

    const resolvedTargetUnitNum = isAnyPlacement
      ? (targetUnitNum || parseInt((chosenUnitId || 'unit_001').replace(/\D/g, ''), 10) || 1)
      : null;

    engine.runStats = {
      unitId: chosenUnitId,
      correctCount: 0,
      wrongCount: 0,
      answeredCount: 0,
      earnedEvoXp: 0,
      earnedGold: 0,
      podGoldEarned: 0,
      earnedSnacks: 0,
      earnedGems: 0,
      pickedGems: 0,
      newlyMasteredCount: 0,
      revivedOnce: false,
      isTutorial,
      isPromotion,
      targetLevel,
      isPlacement: isAnyPlacement,
      isPlacementTest: Boolean(isPlacementTest),
      targetUnitNum: resolvedTargetUnitNum,
      placementLives: isPlacementTest ? null : (isPlacement ? 3 : null),
      placementPassed: false,
    };

    if (isTutorial) {
      engine.tutorial.start();
      const firstUnitWords = getLangUnitWords(save.studyLang || 'en', 0);
      engine.deck = firstUnitWords.length >= BALANCE.TUTORIAL.QUESTION_COUNT
        ? firstUnitWords.slice(0, BALANCE.TUTORIAL.QUESTION_COUNT)
        : wordEngine.buildTutorialDeck();
      engine.enemies.spawnTutorialZombies(startX, startY);
    } else if (isPromotion) {
      engine.tutorial.stop();
      engine.deck = wordEngine.buildPromotionDeck(targetLevel);
      this.spawnInitialWave('promotion', startX, startY);
    } else if (isAnyPlacement) {
      engine.tutorial.stop();
      engine.deck = generatePlacementDeck(save.studyLang || 'en');
      this.spawnInitialWave('placement', startX, startY);
    } else {
      engine.tutorial.stop();
      // 벙커 퀴즈 단어는 전투 스테이지 번호가 아닌 현재 학습 언어/유닛 진도에서 출제
      engine.deck = wordEngine.buildBattleDeck({ courseId: engine.course.id, unitId: getCurrentStudyUnitId() });
      this.spawnInitialWave('normal', startX, startY);
    }

    engine.questionIndex = 0;
    engine.waitingRespawn = false;
    engine.respawnTimer = 0;
    engine.wrongReviewTimer = 0;
    engine.wrongReviewWord = null;
    engine.autoRescueTimer = 0;
    engine.rescuedCompanion = null;
    engine.elapsedTime = 0;
    engine.inputVec = { x: 0, y: 0 };
    engine.isRunning = true;
    engine.state = GAME_STATES.PLAYING;

    audioEngine.unlock();
    audioEngine.startBgm();

    if (!isTutorial) {
      engine._presentCurrentQuestion();
    } else {
      engine.handlers.onQuestionChanged?.({
        word: engine.deck[0] || null,
        questionNumber: 1,
        totalQuestions: BALANCE.TUTORIAL.QUESTION_COUNT,
        streak: 0,
        courseId: engine.course.id,
        chapterNumber: engine.chapter.number,
        tutorialText: engine.tutorial.getBannerText(),
        isTutorial: true,
      });
    }
    engine._startLoop();
  }

  spawnInitialWave(type, startX, startY) {
    const engine = this.engine;
    const count = type === 'placement' ? 8 : 10;
    engine.enemies.spawnInitialWave(
      engine.chapter,
      1.0,
      startX,
      startY,
      engine.arenaWidth,
      engine.arenaHeight,
      count
    );
  }

  spawnBoss() {
    const engine = this.engine;
    engine.enemies.spawnBoss(engine.chapter, 1.0, engine.player.x, engine.player.y);
    engine.camera.triggerZoomSequence(BALANCE.BOSS.ZOOM_SEQUENCE_SEC);
  }

  completeTutorialToLobby() {
    const engine = this.engine;
    if (!engine.runStats?.isTutorial && !engine.tutorial.active) return;
    audioEngine.stopWordLoop();
    audioEngine.pauseAll();
    engine.tutorial.finish();
    engine._stopLoop();
    engine.isRunning = false;
    engine.state = GAME_STATES.CLEAR;
    engine.handlers.onTutorialCompleted?.();
  }

  finishStage(cleared) {
    const engine = this.engine;
    engine.state = GAME_STATES.CLEAR;
    audioEngine.pauseAll();
    engine._stopLoop();

    const isPromo = Boolean(engine.runStats.isPromotion);
    const promoPassed = isPromo && engine.runStats.correctCount >= 17; // 20문제 중 17문제 이상 (85%)
    const isPlacement = Boolean(engine.runStats.isPlacement);
    const placementPassed = isPlacement && cleared && (engine.runStats.placementLives > 0);

    const save = getSave();
    const curUnitNum = parseInt((engine.runStats.unitId || save.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = save.maxUnlockedUnit || 1;

    // 단일 진실 공급원(Single Source of Truth) 함수로 보상 일원화 정산
    const reward = calcStageReward({
      cleared,
      isTutorial: engine.runStats.isTutorial,
      isPlacement,
      isPromotion: isPromo,
      promoPassed,
      stageNumber: curUnitNum,
      maxUnlockedUnit: maxUnlocked,
      chapterNumber: engine.chapter.number,
      correctCount: engine.runStats.correctCount,
      wrongCount: engine.runStats.wrongCount,
      podGoldEarned: engine.runStats.podGoldEarned || 0,
      baseChapterGold: engine.chapter.goldReward,
      courseMult: engine.course.rewardMult,
      hasBoss: Boolean(engine.enemies.boss && engine.enemies.boss.hp <= 0),
      earnedEvoXp: engine.runStats.earnedEvoXp,
      chapterEvoBonus: cleared && !engine.runStats.isTutorial ? engine.chapter.evoXpBonus : 0,
      kills: engine.combat.kills,
    });

    const goldEarned = reward.earnedGold;
    const earnedSnacks = reward.earnedSnacks;
    const totalEvoXp = reward.earnedEvoXp;
    const earnedGems = reward.earnedGems;
    const stageScore = reward.stageScore;

    engine.runStats.earnedGold = goldEarned;
    engine.runStats.earnedSnacks = earnedSnacks;
    engine.runStats.earnedEvoXp = totalEvoXp;
    engine.runStats.earnedGems = earnedGems;
    engine.runStats.score = stageScore;
    engine.runStats.promoPassed = promoPassed;
    engine.runStats.placementPassed = placementPassed;
    engine.runStats.isFirstClear = reward.isFirstClear;
    engine.runStats.isRepeatFarm = reward.isRepeatFarm;

    if (isPlacement || engine.runStats.isPlacementTest) {
      const isPlacementTest = Boolean(engine.runStats.isPlacementTest);
      const correctCount = engine.runStats.correctCount;
      const lives = engine.runStats.placementLives;
      const placementPassed = isPlacementTest ? true : (cleared && lives > 0);

      const assignedTier = isPlacementTest
        ? evaluatePlacementScore(correctCount)
        : (placementPassed ? calcPlacementTier(correctCount, lives) : WORD_LEVEL_TIERS[0]);

      updateSave((s) => {
        s.dailyMissions.progress.battles += 1;
        s.dailyMissions.progress.wordsCorrect += engine.runStats.correctCount;
        s.dailyMissions.progress.kills += engine.combat.kills;
        // 주의: hasSelectedWordLevel은 결과 팝업에서 유저가 확인 버튼을 눌러야 확정되므로 미완료 이탈 시 false를 유지함
        // 게임 전투 스테이지는 항상 CH.1 STAGE 1부터 시작 유지
        s.selectedChapter = 1;
        s.selectedUnit = 'unit_001';
      });

      engine.handlers.onStageResult?.({
        isPlacement: true,
        isPlacementTest,
        placementPassed,
        targetUnitNum: 1,
        assignedTier,
        correctCount: engine.runStats.correctCount,
        lives: engine.runStats.placementLives,
        kills: engine.combat.kills,
      });
      return;
    }

    updateSave((s) => {
      s.gold += goldEarned;
      if (earnedSnacks > 0) {
        s.snacks = (s.snacks || 0) + earnedSnacks;
      }
      s.evoXp += totalEvoXp;
      if (cleared && !engine.runStats.isTutorial && !isPromo) {
        if (engine.chapter.number >= s.unlockedChapter && s.unlockedChapter < 10) {
          s.unlockedChapter = engine.chapter.number + 1;
        }

        // 유닛 순차 해금 로직 (동적 전체 유닛 연동)
        const totalUnits = getTotalUnits();
        const curUnitNum = parseInt((engine.runStats.unitId || s.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
        const maxUnlocked = s.maxUnlockedUnit || 1;
        if (curUnitNum >= maxUnlocked && maxUnlocked < totalUnits) {
          const nextUnitNum = maxUnlocked + 1;
          s.maxUnlockedUnit = nextUnitNum;
          s.selectedUnit = `unit_${String(nextUnitNum).padStart(3, '0')}`;
          const nextCh = getChapterNumberForUnit(nextUnitNum, totalUnits);
          if (nextCh > (s.unlockedChapter || 1)) {
            s.unlockedChapter = nextCh;
          }
          s.selectedChapter = nextCh;
        }
      }
      if (promoPassed && engine.runStats.targetLevel) {
        s.certifiedLevel = engine.runStats.targetLevel;
      }

      // 주간 챌린지 점수 자동 누적
      if (!s.challenge) {
        s.challenge = { leagueTier: 'bronze', weeklyScore: 0, weekKey: '', dailyFreeUsedDate: '' };
      }
      s.challenge.weeklyScore = (s.challenge.weeklyScore || 0) + stageScore;

      // 일일 미션 누적
      s.dailyMissions.progress.battles += 1;
      s.dailyMissions.progress.wordsCorrect += engine.runStats.correctCount;
      s.dailyMissions.progress.kills += engine.combat.kills;
    });

    recordQuestProgress('battles', 1);
    if (engine.runStats.correctCount > 0) recordQuestProgress('wordsCorrect', engine.runStats.correctCount);
    if (engine.combat.kills > 0) recordQuestProgress('kills', engine.combat.kills);
    if (cleared && !engine.runStats.isTutorial) {
      const curNum = parseInt((getSave().selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
      recordQuestProgress('stageReached', curNum);
    }

    engine.handlers.onStageResult?.({
      cleared,
      ...engine.runStats,
      kills: engine.combat.kills,
      chapterNumber: engine.chapter.number,
    });
  }
}

