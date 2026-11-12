/**
 * js/game/gameEngine.js
 * 60fps 메인 루프 (dt <= 0.05s 클램프), 5대 게임 상태 통제, 30문제 덱 & 1.5초 비석 리스폰 지휘관
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { SKILLS, COMPANIONS } from '../data/catalog.js';
import { getChapter } from '../data/chapters.js';
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
      correctCount: 0,
      wrongCount: 0,
      earnedEvoXp: 0,
      earnedGold: 0,
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
   * 전투 시작 (정규 30문제 스테이지 또는 첫 접속 30초 튜토리얼)
   */
  startBattle({ chapterNumber, courseId, isTutorial = false } = {}) {
    this.resizeCanvas();
    const save = getSave();

    this.chapter = getChapter(chapterNumber || save.selectedChapter || 1);
    const chosenCourseId = courseId || save.selectedCourse || 'lv1';
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

    this.runStats = {
      correctCount: 0,
      wrongCount: 0,
      earnedEvoXp: 0,
      earnedGold: 0,
      newlyMasteredCount: 0,
      revivedOnce: false,
      isTutorial,
    };

    if (isTutorial) {
      this.tutorial.start();
      this.deck = wordEngine.buildTutorialDeck();
      this.enemies.spawnTutorialZombies(startX, startY);
    } else {
      this.tutorial.stop();
      this.deck = wordEngine.buildBattleDeck(this.course.id);
      this.enemies.spawnInitialWave(
        this.chapter,
        this.course.enemyMult,
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

    // 28번 문제(index 27) 진입 시 챕터 보스 등장 + 1.5초 줌아웃→줌인 연출
    if (!this.runStats.isTutorial && this.questionIndex === BALANCE.BOSS.ENTRY_QUESTION_INDEX && !this.enemies.boss) {
      this.enemies.spawnBoss(this.chapter, this.course.enemyMult, this.player.x, this.player.y);
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
      this.combat.triggerCorrectShockwave(this.player, this.camera);
      this.combat.spawnDamageText(this.player.x, this.player.y - 38, t('hud.correctShockwave'), '#22d3ee', 1.1);
      audioEngine.playCorrect();

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
      this.wrongReviewTimer = 1.2;
      this.wrongReviewWord = {
        word: this.currentWord.word,
        phonetic: this.currentWord.phonetic || '',
        meaning: this.currentWord.meaning,
      };
      audioEngine.playWrong();
      audioEngine.speakWord(this.currentWord.word);

      if (this.enemies.boss && this.enemies.boss.hp > 0) {
        this.enemies.enrageBoss();
        this.combat.spawnDamageText(this.enemies.boss.x, this.enemies.boss.y - 54, t('hud.bossEnraged'), '#ef4444', 1.2);
      }
    }

    this.questionIndex += 1;

    // 오답 시 해당 단어를 2~3문제 뒤 큐에 재삽입 (Spaced Repetition)
    if (!this.runStats.isTutorial && !isCorrect && this.currentWord) {
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

    const courseMult = this.course.rewardMult;
    const baseGold = cleared ? this.chapter.goldReward : Math.round(this.chapter.goldReward * 0.25);
    const goldEarned = this.runStats.isTutorial
      ? 100
      : Math.round((baseGold + this.runStats.correctCount * 6) * courseMult);

    const evoBonus = cleared && !this.runStats.isTutorial ? this.chapter.evoXpBonus : 0;
    const totalEvoXp = this.runStats.earnedEvoXp + evoBonus;
    this.runStats.earnedGold = goldEarned;
    this.runStats.earnedEvoXp = totalEvoXp;

    updateSave((s) => {
      s.gold += goldEarned;
      s.evoXp += totalEvoXp;
      if (cleared && !this.runStats.isTutorial && this.chapter.number >= s.unlockedChapter && s.unlockedChapter < 5) {
        s.unlockedChapter = this.chapter.number + 1;
      }
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

    this.player.update(dt, this.inputVec, this.arenaWidth, this.arenaHeight, this.obstacles.obstacles);
    this.enemies.update(
      dt,
      this.player,
      this.chapter,
      this.course.enemyMult,
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
      const ultChargeBonus = getTrainingBonusValue('ultChargeLv', getSave().training?.ultChargeLv || 0);
      const baseGemUlt = Math.max(1, Math.round(monoRes.pickedGems * 0.5));
      this.player.addUltGauge(Math.round(baseGemUlt * (1 + ultChargeBonus)));
      updateSave((s) => {
        s.gold += monoRes.pickedGems;
      });
    }
    if (monoRes.pickedSnacks > 0) {
      const healAmt = 25 * monoRes.pickedSnacks;
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
        scr.y < 16 ||
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

