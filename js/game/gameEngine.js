/**
 * js/game/gameEngine.js
 * 60fps 메인 루프 (dt <= 0.05s 클램프), 5대 게임 상태 통제, 30문제 덱 & 1.5초 비석 리스폰 지휘관
 */

import { BALANCE, getTrainingBonusValue, calcStageReward } from '../config/balance.js';
import { SKILLS, COMPANIONS } from '../data/catalog.js';
import { getChapter, getChapterNumberForUnit } from '../data/chapters.js';
import { getTotalUnits } from '../data/data_en.js?v=2';
import { t } from '../data/i18n.js';
import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { wordEngine } from '../core/wordEngine.js';

import { Player } from '../entities/player.js';
import { CompanionManager } from '../entities/companions.js';
import { EnemyManager } from '../entities/enemies.js';
import { MonolithManager } from '../entities/monoliths.js';
import { Camera } from './camera.js';
import { CombatSystem } from './combatSystem.js';
import { ObstacleManager } from './obstacles.js';
import { TutorialController } from './tutorial.js';

export const GAME_STATES = Object.freeze({
  IDLE: 'IDLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVELUP_MODAL: 'LEVELUP_MODAL',
  GAMEOVER_MODAL: 'GAMEOVER_MODAL',
  CLEAR: 'CLEAR',
});

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewW = BALANCE.ENGINE.LOGICAL_WIDTH;
    this.viewH = BALANCE.ENGINE.LOGICAL_HEIGHT;

    this.state = GAME_STATES.IDLE;
    this.isRunning = false;
    this.rafId = null;
    this.lastTime = 0;
    this.elapsedTime = 0;

    this.player = new Player();
    this.companions = new CompanionManager();
    this.enemies = new EnemyManager();
    this.monoliths = new MonolithManager();
    this.camera = new Camera();
    this.combat = new CombatSystem();
    this.obstacles = new ObstacleManager();
    this.tutorial = new TutorialController();

    this.inputVec = { x: 0, y: 0 };
    this.chapter = getChapter(1);
    this.course = BALANCE.COURSES[0];
    this.arenaWidth = this.viewW * BALANCE.ARENA.SCALE_MULTIPLIER;
    this.arenaHeight = this.viewH * BALANCE.ARENA.SCALE_MULTIPLIER;

    this.deck = [];
    this.questionIndex = 0;
    this.currentWord = null;
    this.respawnTimer = 0;
    this.waitingRespawn = false;
    this.wrongReviewTimer = 0;
    this.wrongReviewWord = null;

    this.runStats = {
      unitId: 'unit_001',
      correctCount: 0,
      wrongCount: 0,
      earnedEvoXp: 0,
      earnedGold: 0,
      podGoldEarned: 0,
      newlyMasteredCount: 0,
      revivedOnce: false,
      isTutorial: false,
    };

    this.handlers = {
      onHudUpdate: null,
      onQuestionChanged: null,
      onWrongFeedback: null,
      onLevelUpChoices: null,
      onPauseChanged: null,
      onGameOver: null,
      onStageResult: null,
    };
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  setInputVector(x, y) {
    this.inputVec.x = x;
    this.inputVec.y = y;
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = Math.max(320, Math.round(parent.clientWidth));
    this.viewH = Math.max(360, Math.round(parent.clientHeight));
    this.canvas.width = this.viewW * dpr;
    this.canvas.height = this.viewH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * 전투 시작 (정규 30문제 스테이지 또는 첫 접속 30초 튜토리얼 / 승급전 / 월반 도전)
   */
  startBattle({ chapterNumber, courseId, unitId, isTutorial = false, isPromotion = false, targetLevel = 'A2', isPlacement = false, targetUnitNum = 1 } = {}) {
    this.resizeCanvas();
    const save = getSave();

    this.chapter = getChapter(chapterNumber || save.selectedChapter || 1);
    const chosenCourseId = courseId || save.selectedCourse || 'lv1';
    const chosenUnitId = unitId || save.selectedUnit || 'unit_001';
    this.course = BALANCE.COURSES.find((c) => c.id === chosenCourseId) || BALANCE.COURSES[0];

    this.arenaWidth = this.viewW * this.chapter.arenaScale;
    this.arenaHeight = this.viewH * this.chapter.arenaScale;

    const startX = this.arenaWidth / 2;
    const startY = this.arenaHeight / 2;

    this.player.resetForBattle(startX, startY, save);
    this.companions.resetForBattle(this.player, save);
    this.enemies.resetForBattle();
    this.monoliths.resetForBattle();
    this.obstacles.resetForBattle(this.arenaWidth, this.arenaHeight, startX, startY);
    this.combat.reset(this.player, this.enemies, this.monoliths);
    this.camera.reset(startX, startY);

    const resolvedTargetUnitNum = isPlacement
      ? (targetUnitNum || parseInt((chosenUnitId || 'unit_001').replace(/\D/g, ''), 10) || 1)
      : null;

    this.runStats = {
      unitId: chosenUnitId,
      correctCount: 0,
      wrongCount: 0,
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
      isPlacement,
      targetUnitNum: resolvedTargetUnitNum,
      placementLives: isPlacement ? 3 : null,
      placementPassed: false,
    };

    if (isTutorial) {
      this.tutorial.start();
      this.deck = wordEngine.buildTutorialDeck();
      this.enemies.spawnTutorialZombies(startX, startY);
    } else if (isPromotion) {
      this.tutorial.stop();
      this.deck = wordEngine.buildPromotionDeck(targetLevel);
      this.enemies.spawnInitialWave(
        this.chapter,
        1.0,
        startX,
        startY,
        this.arenaWidth,
        this.arenaHeight,
        10
      );
    } else if (isPlacement) {
      this.tutorial.stop();
      this.deck = wordEngine.buildPlacementDeck(resolvedTargetUnitNum);
      this.enemies.spawnInitialWave(
        this.chapter,
        1.0,
        startX,
        startY,
        this.arenaWidth,
        this.arenaHeight,
        8
      );
    } else {
      this.tutorial.stop();
      this.deck = wordEngine.buildBattleDeck({ courseId: this.course.id, unitId: chosenUnitId });
      this.enemies.spawnInitialWave(
        this.chapter,
        1.0,
        startX,
        startY,
        this.arenaWidth,
        this.arenaHeight,
        10
      );
    }

    this.questionIndex = 0;
    this.waitingRespawn = false;
    this.respawnTimer = 0;
    this.wrongReviewTimer = 0;
    this.wrongReviewWord = null;
    this.elapsedTime = 0;
    this.inputVec = { x: 0, y: 0 };
    this.isRunning = true;
    this.state = GAME_STATES.PLAYING;

    audioEngine.unlock();
    audioEngine.startBgm();

    this._presentCurrentQuestion();
    this._startLoop();
  }

  _presentCurrentQuestion() {
    if (this.questionIndex >= this.deck.length) {
      if (this.runStats.isPlacement) {
        this._finishStage(true);
        return;
      }
      // 보스 미격파 상태에서 30번까지 다 소진한 경우 연장 문제 추가
      if (!this.runStats.isTutorial && this.enemies.boss && this.enemies.boss.hp > 0) {
        const extraPool = wordEngine.getCourseWords(this.course.id);
        const extraWord = extraPool[Math.floor(Math.random() * extraPool.length)];
        if (extraWord) {
          this.deck.push(extraWord);
        }
      } else {
        this._finishStage(true);
        return;
      }
    }

    // 28번 문제(index 27) 진입 시 챕터 보스 등장 + 1.5초 줌아웃→줌인 연출 (월반 및 튜토리얼 제외)
    if (!this.runStats.isTutorial && !this.runStats.isPlacement && this.questionIndex === BALANCE.BOSS.ENTRY_QUESTION_INDEX && !this.enemies.boss) {
      this.enemies.spawnBoss(this.chapter, 1.0, this.player.x, this.player.y);
      this.camera.triggerZoomSequence(BALANCE.BOSS.ZOOM_SEQUENCE_SEC);
    }

    this.currentWord = this.deck[this.questionIndex];
    const choices = wordEngine.createQuestionChoices(this.currentWord);

    this.monoliths.spawnMonoliths(
      choices,
      this.arenaWidth,
      this.arenaHeight,
      this.player.x,
      this.player.y,
      this.obstacles.obstacles
    );

    if (this.runStats.isTutorial) {
      this.tutorial.onQuestionStarted(this.questionIndex, this.player);
    }

    audioEngine.startWordLoop(this.currentWord.word);

    this.handlers.onQuestionChanged?.({
      word: this.currentWord,
      questionNumber: this.questionIndex + 1,
      totalQuestions: this.runStats.isTutorial ? BALANCE.TUTORIAL.QUESTION_COUNT : this.deck.length,
      streak: wordEngine.getWordStreak(this.currentWord.id),
      courseId: this.course.id,
      chapterNumber: this.chapter.number,
      tutorialText: this.tutorial.getBannerText(),
      isTutorial: this.runStats.isTutorial,
    });
  }

  _handleMonolithResolved(monolith) {
    audioEngine.stopWordLoop();

    const isCorrect = monolith.isCorrect;
    const wordRes = wordEngine.submitAnswer(this.currentWord.id, isCorrect);

    if (isCorrect) {
      this.runStats.correctCount += 1;
      this.runStats.earnedEvoXp += BALANCE.MONOLITH.CORRECT_XP;
      if (wordRes.newlyMastered) this.runStats.newlyMasteredCount += 1;

      this.player.addUltGauge(BALANCE.COMBAT.ULT_CHARGE_PER_CORRECT);

      // 전술 구조 캡슐 개방 굵직한 기본 금화 보상 (+25 🪙)
      const podGold = 25;
      this.runStats.podGoldEarned = (this.runStats.podGoldEarned || 0) + podGold;
      this.combat.spawnDamageText(monolith.x + 24, monolith.y - 18, `+${podGold} 🪙`, '#fbbf24', 1.15);

      // 캡슐 해치 개방 및 넉백 충격파 (플레이어 + 캡슐 주변)
      this.combat.triggerCorrectShockwave(monolith, this.camera, this.player);
      this.combat.triggerCorrectShockwave(this.player, this.camera, this.player);
      audioEngine.playCorrect();

      // [정답 캡슐 개방 서프라이즈]: 아기 동물 구출 지원 vs 특수 전술 보급품
      const surpriseRoll = Math.random();
      if (surpriseRoll < 0.5) {
        // 1. 깜짝 아기 동물 구출 지원 (Surprise Animal Rescue)
        const compPool = COMPANIONS;
        const rescuedDef = compPool[Math.floor(Math.random() * compPool.length)];
        if (Math.random() < 0.6) {
          // 일정 시간(16초) 함께 싸워주는 임시 지원 사격 동료 합류
          this.companions.addTemporaryCompanion(rescuedDef, this.player, 16);
          this.combat.spawnDamageText(monolith.x, monolith.y - 42, `🐾 ${rescuedDef.name} 구출! 지원 사격!`, '#34d399', 1.3);
          audioEngine.playPowerUp?.();
        } else {
          // 대량 보석 & 간식 & 추가 금화 보은 선물
          const giftGold = 35;
          this.runStats.podGoldEarned = (this.runStats.podGoldEarned || 0) + giftGold;
          this.combat.spawnDamageText(monolith.x, monolith.y - 42, `🎁 ${rescuedDef.name}의 보은! 대량 보석 & +${giftGold}🪙!`, '#fbbf24', 1.3);
          for (let g = 0; g < 6; g++) {
            const ga = (Math.PI * 2 * g) / 6;
            const gx = monolith.x + Math.cos(ga) * (26 + Math.random() * 20);
            const gy = monolith.y + Math.sin(ga) * (26 + Math.random() * 20);
            this.monoliths.spawnDrop('gem', gx, gy, BALANCE.COMBAT.GEM_XP_VALUE * 1.5);
          }
          this.monoliths.spawnDrop('snack', monolith.x, monolith.y);
        }
      } else {
        // 2. 특수 전술 보급품 (경험치 보석 다발, 회복 간식, 폭탄 충격파 폭발)
        this.combat.spawnDamageText(monolith.x, monolith.y - 42, '📦 특수 전술 보급품 캡슐 해금!', '#22d3ee', 1.3);
        for (let g = 0; g < 5; g++) {
          const ga = (Math.PI * 2 * g) / 5;
          const gx = monolith.x + Math.cos(ga) * (24 + Math.random() * 22);
          const gy = monolith.y + Math.sin(ga) * (24 + Math.random() * 22);
          this.monoliths.spawnDrop('gem', gx, gy, BALANCE.COMBAT.GEM_XP_VALUE * 1.2);
        }
        this.monoliths.spawnDrop('snack', monolith.x + 10, monolith.y - 8);

        // 캡슐 보급 폭발: 주변 좀비 광역 처치 데미지
        for (const e of this.enemies.enemies) {
          const d = Math.hypot(e.x - monolith.x, e.y - monolith.y);
          if (d <= 140) {
            this.combat.damageEnemy(e, this.player.atk * 1.8, '#f59e0b');
          }
        }
      }

      // 보스전 중 정답 시 하늘에서 음파 레이저로 보스 3단계 격파
      if (this.enemies.boss && this.enemies.boss.hp > 0) {
        this.combat.triggerSonicLaser(this.enemies.boss.x, this.enemies.boss.y, this.camera);
        const bossRes = this.enemies.triggerBossSonicLaser();
        this.combat.spawnDamageText(this.enemies.boss.x, this.enemies.boss.y - 54, t('hud.sonicLaser'), '#38bdf8', 1.2);

        if (bossRes.defeated) {
          this._finishStage(true);
          return;
        }
      }
    } else {
      const shieldReduction = getTrainingBonusValue('shieldLv', getSave().training?.shieldLv || 0);
      const xpPenalty = Math.round(BALANCE.MONOLITH.WRONG_XP_PENALTY * (1 - shieldReduction));
      this.runStats.wrongCount += 1;
      this.runStats.earnedEvoXp = Math.max(0, this.runStats.earnedEvoXp + xpPenalty);
      this.player.applySlowDebuff();

      // [오답(함정) 캡슐 개방 매복 트랩 연출]: 붉은 경고등과 함께 숨어있던 좀비 무리(2~3마리) 기습 돌출
      this.combat.spawnDamageText(monolith.x, monolith.y - 42, '🚨 좀비 기습 매복 트랩!', '#ef4444', 1.3);
      this.camera?.shake(10, 0.28);
      audioEngine.playWrong();

      const ambushCount = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < ambushCount; i++) {
        const ang = (Math.PI * 2 * i) / ambushCount + (Math.random() - 0.5) * 0.4;
        const burstDist = 32 + Math.random() * 24;
        const zx = Math.max(80, Math.min(this.arenaWidth - 80, monolith.x + Math.cos(ang) * burstDist));
        const zy = Math.max(80, Math.min(this.arenaHeight - 80, monolith.y + Math.sin(ang) * burstDist));
        const z = this.enemies.spawnEnemy('walker', zx, zy, 0.85, 1.0, 1.15);
        if (z) {
          z.knockVx = Math.cos(ang) * 200;
          z.knockVy = Math.sin(ang) * 200;
        }
      }

      // 월반 도전 시 오답 1회당 하트(남은 기회) 1개 차감, 3회 소진 시 즉시 실패 종료
      if (this.runStats.isPlacement) {
        this.runStats.placementLives = Math.max(0, (this.runStats.placementLives ?? 3) - 1);
        if (this.runStats.placementLives <= 0) {
          this._finishStage(false);
          return;
        }
      }

      this.wrongReviewTimer = 1.2;
      this.wrongReviewWord = {
        word: this.currentWord.word,
        phonetic: this.currentWord.phonetic || '',
        meaning: this.currentWord.meaning,
      };
      audioEngine.speakWord(this.currentWord.word);

      if (this.enemies.boss && this.enemies.boss.hp > 0) {
        this.enemies.enrageBoss();
        this.combat.spawnDamageText(this.enemies.boss.x, this.enemies.boss.y - 54, t('hud.bossEnraged'), '#ef4444', 1.2);
      }
    }

    this.questionIndex += 1;

    // 오답 시 해당 단어를 2~3문제 뒤 큐에 재삽입 (Spaced Repetition, 월반 및 튜토리얼 제외)
    if (!this.runStats.isTutorial && !this.runStats.isPlacement && !isCorrect && this.currentWord) {
      const offset = Math.random() < 0.5 ? 2 : 3;
      let insertIdx = Math.min(this.deck.length, this.questionIndex + offset);
      const prevSame = this.deck[insertIdx - 1]?.id === this.currentWord.id;
      const nextSame = this.deck[insertIdx]?.id === this.currentWord.id;
      if ((prevSame || nextSame) && insertIdx < this.deck.length) {
        insertIdx = Math.min(this.deck.length, insertIdx + 1);
      }
      this.deck.splice(insertIdx, 0, this.currentWord);
    }

    // 튜토리얼 완료 또는 덱 전체 소진 시 클리어 확인
    if (this.runStats.isTutorial && this.questionIndex >= BALANCE.TUTORIAL.QUESTION_COUNT) {
      if (!this.tutorial.ultTriggered) {
        // 튜토리얼 3단계: 대폭발 더블 탭이 발동될 때까지 완료를 유보
        return;
      }
      this.tutorial.finish();
      this._finishStage(true);
      return;
    }

    if (!this.runStats.isTutorial && this.questionIndex >= this.deck.length && (!this.enemies.boss || this.enemies.boss.hp <= 0)) {
      this._finishStage(true);
      return;
    }

    // 1.5초 뒤 다음 문제 4개 비석 새 위치 스폰 대기
    this.waitingRespawn = true;
    this.respawnTimer = BALANCE.MONOLITH.RESPAWN_DELAY_SEC;

    // 본게임에서 단어 3문제 정답마다 정확히 1회 스킬 선택 모달 오픈
    const solvedCount = this.runStats.correctCount;
    if (!this.runStats.isTutorial && isCorrect && solvedCount > 0 && solvedCount % 3 === 0) {
      this.openSkillSelect();
    }
  }

  useUltimate() {
    if (this.state !== GAME_STATES.PLAYING) return;
    if (this.player.ultGauge < BALANCE.COMBAT.ULT_MAX_GAUGE) return;

    this.combat.triggerUltimate(this.player, this.camera);
    if (this.runStats.isTutorial) {
      this.tutorial.onUltUsed();
      setTimeout(() => {
        if (this.runStats?.isTutorial && this.state === GAME_STATES.PLAYING) {
          this.tutorial.finish();
          this._finishStage(true);
        }
      }, 1200);
    }
  }

  openSkillSelect() {
    this.state = GAME_STATES.LEVELUP_MODAL;
    audioEngine.stopWordLoop();
    audioEngine.playLevelUp();

    const pool = [];
    for (const sk of SKILLS) {
      const lv = this.player.skills[sk.id] || 0;
      if (lv < sk.maxLevel) {
        pool.push({ kind: 'skill', skill: sk, nextLevel: lv + 1 });
      }
    }
    for (const comp of this.companions.activeCompanions) {
      pool.push({ kind: 'companion', companion: comp.def, nextLevel: comp.runLv + 1 });
    }

    // 3지선다 랜덤 추출
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    if (shuffled.length === 0) {
      this.player.heal(25);
      this.resumeFromModal();
      return;
    }

    this.handlers.onLevelUpChoices?.(shuffled);
  }

  selectLevelUpChoice(choice) {
    if (choice.kind === 'skill') {
      this.player.addSkillLevel(choice.skill.id);
    } else if (choice.kind === 'companion') {
      this.companions.upgradeInRun(choice.companion.id);
    }
    this.resumeFromModal();
  }

  resumeFromModal() {
    if (this.state === GAME_STATES.IDLE || this.state === GAME_STATES.CLEAR) return;
    this.state = GAME_STATES.PLAYING;
    this.lastTime = performance.now();
    audioEngine.resumeAll();
    if (this.currentWord && !this.waitingRespawn) {
      audioEngine.startWordLoop(this.currentWord.word);
    }
  }

  pause() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.PAUSED;
    audioEngine.pauseAll();
    this.handlers.onPauseChanged?.(true);
  }

  resume() {
    if (this.state !== GAME_STATES.PAUSED) return;
    this.state = GAME_STATES.PLAYING;
    this.lastTime = performance.now();
    audioEngine.resumeAll();
    if (this.currentWord && !this.waitingRespawn) {
      audioEngine.startWordLoop(this.currentWord.word);
    }
    this.handlers.onPauseChanged?.(false);
  }

  reviveWithAd() {
    if (this.state !== GAME_STATES.GAMEOVER_MODAL || this.runStats.revivedOnce) return;
    this.runStats.revivedOnce = true;
    this.player.hp = Math.round(this.player.maxHp * BALANCE.SHOP.REVIVE_HP_RATIO);
    this.player.invulnTimer = 2.0;

    // 주변 좀비 밀어내기
    for (const e of this.enemies.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 240) {
        e.knockVx = (dx / d) * 450;
        e.knockVy = (dy / d) * 450;
      }
    }

    this.resumeFromModal();
  }

  abortToLobby() {
    this._stopLoop();
    this.isRunning = false;
    this.state = GAME_STATES.IDLE;
    this.waitingRespawn = false;
    this.respawnTimer = 0;
    this.wrongReviewTimer = 0;
    this.wrongReviewWord = null;
    this.currentWord = null;
    this.deck = [];
    this.questionIndex = 0;
    this.inputVec = { x: 0, y: 0 };
    this.tutorial.stop();
    this.monoliths.resetForBattle();
    this.enemies.resetForBattle();
    audioEngine.stopWordLoop();
    audioEngine.pauseAll();
  }

  quitToLobby() {
    this.abortToLobby();
  }

  skipTutorial() {
    if (this.runStats.isTutorial) {
      this.tutorial.finish();
    }
    this.abortToLobby();
  }

  _finishStage(cleared) {
    this.state = GAME_STATES.CLEAR;
    audioEngine.pauseAll();
    this._stopLoop();

    const isPromo = Boolean(this.runStats.isPromotion);
    const promoPassed = isPromo && this.runStats.correctCount >= 17; // 20문제 중 17문제 이상 (85%)
    const isPlacement = Boolean(this.runStats.isPlacement);
    const placementPassed = isPlacement && cleared && (this.runStats.placementLives > 0);

    const save = getSave();
    const curUnitNum = parseInt((this.runStats.unitId || save.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
    const maxUnlocked = save.maxUnlockedUnit || 1;

    // 단일 진실 공급원(Single Source of Truth) 함수로 보상 일원화 정산
    const reward = calcStageReward({
      cleared,
      isTutorial: this.runStats.isTutorial,
      isPlacement,
      isPromotion: isPromo,
      promoPassed,
      stageNumber: curUnitNum,
      maxUnlockedUnit: maxUnlocked,
      chapterNumber: this.chapter.number,
      correctCount: this.runStats.correctCount,
      wrongCount: this.runStats.wrongCount,
      podGoldEarned: this.runStats.podGoldEarned || 0,
      baseChapterGold: this.chapter.goldReward,
      courseMult: this.course.rewardMult,
      hasBoss: Boolean(this.enemies.boss && this.enemies.boss.hp <= 0),
      earnedEvoXp: this.runStats.earnedEvoXp,
      chapterEvoBonus: cleared && !this.runStats.isTutorial ? this.chapter.evoXpBonus : 0,
      kills: this.combat.kills,
    });

    const goldEarned = reward.earnedGold;
    const earnedSnacks = reward.earnedSnacks;
    const totalEvoXp = reward.earnedEvoXp;
    const earnedGems = reward.earnedGems;
    const stageScore = reward.stageScore;

    this.runStats.earnedGold = goldEarned;
    this.runStats.earnedSnacks = earnedSnacks;
    this.runStats.earnedEvoXp = totalEvoXp;
    this.runStats.earnedGems = earnedGems;
    this.runStats.score = stageScore;
    this.runStats.promoPassed = promoPassed;
    this.runStats.placementPassed = placementPassed;
    this.runStats.isFirstClear = reward.isFirstClear;
    this.runStats.isRepeatFarm = reward.isRepeatFarm;

    if (isPlacement) {
      const targetUnitNum = this.runStats.targetUnitNum;
      const totalUnits = getTotalUnits();
      const safeTarget = Math.min(Math.max(1, targetUnitNum), totalUnits);

      updateSave((s) => {
        s.dailyMissions.progress.battles += 1;
        s.dailyMissions.progress.wordsCorrect += this.runStats.correctCount;
        s.dailyMissions.progress.kills += this.combat.kills;

        if (placementPassed) {
          s.maxUnlockedUnit = Math.max(s.maxUnlockedUnit || 1, safeTarget);
          s.selectedUnit = `unit_${String(safeTarget).padStart(3, '0')}`;
          const nextCh = getChapterNumberForUnit(safeTarget, totalUnits);
          if (nextCh > (s.unlockedChapter || 1)) {
            s.unlockedChapter = nextCh;
          }
          s.selectedChapter = nextCh;
        }
      });

      this.handlers.onStageResult?.({
        isPlacement: true,
        placementPassed,
        targetUnitNum: safeTarget,
        correctCount: this.runStats.correctCount,
        lives: this.runStats.placementLives,
        kills: this.combat.kills,
      });
      return;
    }

    updateSave((s) => {
      s.gold += goldEarned;
      if (earnedSnacks > 0) {
        s.snacks = (s.snacks || 0) + earnedSnacks;
      }
      s.evoXp += totalEvoXp;
      if (cleared && !this.runStats.isTutorial && !isPromo) {
        if (this.chapter.number >= s.unlockedChapter && s.unlockedChapter < 5) {
          s.unlockedChapter = this.chapter.number + 1;
        }

        // 유닛 순차 해금 로직 (동적 전체 유닛 연동)
        const totalUnits = getTotalUnits();
        const curUnitNum = parseInt((this.runStats.unitId || s.selectedUnit || 'unit_001').replace(/\D/g, ''), 10) || 1;
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
      if (promoPassed && this.runStats.targetLevel) {
        s.certifiedLevel = this.runStats.targetLevel;
      }

      // 주간 챌린지 점수 자동 누적
      if (!s.challenge) {
        s.challenge = { leagueTier: 'bronze', weeklyScore: 0, weekKey: '', dailyFreeUsedDate: '' };
      }
      s.challenge.weeklyScore = (s.challenge.weeklyScore || 0) + stageScore;

      // 일일 미션 누적
      s.dailyMissions.progress.battles += 1;
      s.dailyMissions.progress.wordsCorrect += this.runStats.correctCount;
      s.dailyMissions.progress.kills += this.combat.kills;
    });

    this.handlers.onStageResult?.({
      cleared,
      ...this.runStats,
      kills: this.combat.kills,
      chapterNumber: this.chapter.number,
    });
  }

  _startLoop() {
    this._stopLoop();
    this.lastTime = performance.now();
    const tick = (now) => {
      if (!this.isRunning) return;
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(BALANCE.ENGINE.MAX_DT, Math.max(0, rawDt));

      if (this.state === GAME_STATES.PLAYING) {
        this._update(dt);
      }
      this._render();
      if (this.isRunning) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _update(dt) {
    // 오답 확인 브레이크(1.2초): 좀비 이동·공격·스폰 및 전투 일시 정지
    if (this.wrongReviewTimer > 0) {
      this.wrongReviewTimer = Math.max(0, this.wrongReviewTimer - dt);
      if (this.wrongReviewTimer <= 0) {
        this.wrongReviewWord = null;
      }
      this._emitHudUpdate();
      return;
    }

    this.elapsedTime += dt;

    // 1.5초 비석 리스폰 대기 처리
    if (this.waitingRespawn) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.waitingRespawn = false;
        this._presentCurrentQuestion();
      }
    }

    this.player.update(dt, this.inputVec, this.arenaWidth, this.arenaHeight, this.obstacles.obstacles, this.monoliths.monoliths);
    this.enemies.update(
      dt,
      this.player,
      this.chapter,
      1.0,
      this.questionIndex + 1,
      this.arenaWidth,
      this.arenaHeight,
      this.runStats.isTutorial,
      this.monoliths.monoliths,
      this.obstacles.obstacles
    );
    this.companions.update(dt, this.player, this.enemies.enemies, this.enemies.boss, this.combat);
    this.combat.update(dt, this.player);

    const monoRes = this.monoliths.update(dt, this.player);
    if (monoRes.captureTicking) {
      if (Math.random() < 0.25) audioEngine.playCaptureTick();
    }
    if (monoRes.pickedGems > 0) {
      this.runStats.pickedGems = (this.runStats.pickedGems || 0) + monoRes.pickedGems;
      const ultChargeBonus = getTrainingBonusValue('ultChargeLv', getSave().training?.ultChargeLv || 0);
      this.player.addUltGauge(Math.round(monoRes.pickedGemCharge * (1 + ultChargeBonus)));
      for (const tier of monoRes.pickedHighTiers) {
        const label = tier.id === 'gold' ? '⚡ MAX!' : `+${tier.charge}%`;
        const scale = tier.id === 'gold' ? 1.35 : 1.15;
        this.combat.spawnDamageText(this.player.x, this.player.y - 42, label, tier.color, scale);
      }
    }
    if (monoRes.pickedSnacks > 0) {
      const healPerSnack = Math.max(1, Math.round(this.player.maxHp * (BALANCE.COMBAT.SNACK_HEAL_RATIO || 0.28)));
      const healAmt = healPerSnack * monoRes.pickedSnacks;
      this.player.heal(healAmt);
      this.combat.spawnDamageText(this.player.x, this.player.y - 36, `+${healAmt} HP`, '#4ade80', 1.05);
      updateSave((s) => {
        s.snacks += monoRes.pickedSnacks;
      });
    }
    if (monoRes.resolvedMonolith) {
      this._handleMonolithResolved(monoRes.resolvedMonolith);
    }

    // 사망 판정
    if (this.player.hp <= 0) {
      if (this.runStats.isPlacement) {
        this._finishStage(false);
        return;
      }
      this.state = GAME_STATES.GAMEOVER_MODAL;
      audioEngine.pauseAll();
      this.handlers.onGameOver?.({ canRevive: !this.runStats.revivedOnce });
      return;
    }

    this.camera.update(dt, this.player.x, this.player.y, this.arenaWidth, this.arenaHeight, this.viewW, this.viewH);
    this._emitHudUpdate();
  }

  _emitHudUpdate() {
    // HUD 갱신 콜백 (순수 캔버스 뷰포트 기준)
    const edgeArrows = this.monoliths.monoliths.map((m) => {
      const scr = this.camera.worldToScreen(m.x, m.y, this.viewW, this.viewH);
      const outOfView =
        scr.x < 16 ||
        scr.x > this.viewW - 16 ||
        scr.y < 136 || // 상단 네온 전광판 하단 안전선 (136px 여유 간격)
        scr.y > this.viewH - 72;
      return { id: m.id, meaning: m.meaning, screenX: scr.x, screenY: scr.y, outOfView };
    });

    const milestoneXp = this.runStats.isTutorial ? this.player.xp : (this.runStats.correctCount % 3);
    const milestoneTarget = this.runStats.isTutorial ? this.player.xpToNext : 3;

    this.handlers.onHudUpdate?.({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      xp: milestoneXp,
      xpToNext: milestoneTarget,
      ultGauge: this.player.ultGauge,
      evoXp: (getSave().evoXp || 0) + this.runStats.earnedEvoXp,
      boss: this.enemies.boss,
      edgeArrows,
      viewW: this.viewW,
      viewH: this.viewH,
      wrongReview: this.wrongReviewTimer > 0 ? this.wrongReviewWord : null,
      placement: this.runStats.isPlacement ? {
        targetUnitNum: this.runStats.targetUnitNum,
        lives: this.runStats.placementLives,
      } : null,
    });
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    this.camera.beginTransform(ctx, this.viewW, this.viewH);
    this.camera.renderArena(ctx, this.chapter, this.arenaWidth, this.arenaHeight, this.elapsedTime);
    this.obstacles.render(ctx);
    this.enemies.render(ctx);
    this.monoliths.render(ctx, this.elapsedTime);
    this.companions.render(ctx, this.elapsedTime);
    this.player.render(ctx, this.elapsedTime);
    this.combat.render(ctx);
    this.camera.endTransform(ctx);
  }
}

