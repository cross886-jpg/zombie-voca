/**
 * js/game/gameEngine.js
 * 60fps 메인 루프 (dt <= 0.05s 클램프), 5대 게임 상태 통제, 30문제 덱 & 1.5초 비석 리스폰 지휘관
 */

import { BALANCE, getTrainingBonusValue } from '../config/balance.js';
import { SKILLS } from '../data/catalog.js';
import { getChapter } from '../data/chapters.js';
import { t } from '../data/i18n.js';
import { getSave, updateSave, addAffection, recordQuestProgress } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';

import { Player } from '../entities/player.js';
import { CompanionManager } from '../entities/companions.js';
import { EnemyManager } from '../entities/enemies.js';
import { MonolithManager, isMonolithOffscreen } from '../entities/monoliths.js';
import { Camera } from './camera.js?v=2';
import { CombatSystem } from './combatSystem.js';
import { ObstacleManager } from './obstacles.js';
import { TutorialController } from './tutorial.js';
import { WordEventManager } from './wordEventManager.js';
import { StageDirector } from './stageDirector.js';

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
    this.wordEvents = new WordEventManager(this);
    this.stageDirector = new StageDirector(this);

    this.inputVec = { x: 0, y: 0 };
    this.chapter = getChapter(1);
    this.course = BALANCE.COURSES[0];
    this.arenaWidth = this.viewW * BALANCE.ARENA.SCALE_MULTIPLIER;
    this.arenaHeight = this.viewH * BALANCE.ARENA.SCALE_MULTIPLIER;

    this.autoRescueTimer = 0;
    this.rescuedCompanion = null;
    this.tutorialTransitionActive = false;
    this.tutorialClearParticles = [];

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
      onTutorialCompleted: null,
    };
  }

  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  setInputVector(x, y) {
    this.inputVec.x = x;
    this.inputVec.y = y;
  }

  get deck() { return this.wordEvents.deck; }
  set deck(v) { this.wordEvents.deck = v; }
  get questionIndex() { return this.wordEvents.questionIndex; }
  set questionIndex(v) { this.wordEvents.questionIndex = v; }
  get currentWord() { return this.wordEvents.currentWord; }
  set currentWord(v) { this.wordEvents.currentWord = v; }
  get wrongReviewTimer() { return this.wordEvents.wrongReviewTimer; }
  set wrongReviewTimer(v) { this.wordEvents.wrongReviewTimer = v; }
  get wrongReviewWord() { return this.wordEvents.wrongReviewWord; }
  set wrongReviewWord(v) { this.wordEvents.wrongReviewWord = v; }
  get waitingRespawn() { return this.wordEvents.waitingRespawn; }
  set waitingRespawn(v) { this.wordEvents.waitingRespawn = v; }
  get respawnTimer() { return this.wordEvents.respawnTimer; }
  set respawnTimer(v) { this.wordEvents.respawnTimer = v; }

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
  startBattle(options = {}) {
    this.stageDirector.startBattle(options);
  }

  spawnBoss() {
    this.stageDirector.spawnBoss();
  }

  _presentCurrentQuestion() {
    this.wordEvents.presentCurrentQuestion();
  }

  _handleMonolithResolved(monolith) {
    this.wordEvents.handleMonolithResolved(monolith);
  }

  useUltimate() {
    if (this.state !== GAME_STATES.PLAYING) return;
    if (this.player.ultGauge < BALANCE.COMBAT.ULT_MAX_GAUGE) return;
    if (this.runStats.isTutorial && this.tutorial.step !== 6) return;

    this.combat.triggerUltimate(this.player, this.camera);
    this.camera.triggerUltimateCamera(0.62);
    if (this.runStats.isTutorial) {
      this.tutorial.onUltUsed();
      audioEngine.playUlt();
      // 우유 교관 말풍선 즉시 숨김
      document.getElementById('hud-tutorial-coach')?.classList.add('hidden');
      this.combat.shockwaves.push({
        x: this.player.x,
        y: this.player.y,
        radius: 25,
        maxRadius: 420,
        color: '#fbbf24',
        ttl: 0.6,
        maxTtl: 0.6,
      });
      for (const enemy of this.enemies.enemies) {
        enemy.hp = 0;
        this.combat.spawnDamageText(enemy.x, enemy.y - 20, '💥 BOOM!', '#fbbf24', 1.2);
      }
      this.combat.kills += this.enemies.enemies.length;
      this.enemies.enemies = [];
      this.monoliths.drops = [];
      this.tutorialTransitionActive = true;
      this.tutorialClearParticles = [];
      this._emitHudUpdate();
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

    // 현재 장착 중인 동료(companions.active)가 1마리 이상 있을 때만 동료 카드 풀에 포함
    const save = getSave();
    const hasEquippedCompanions = (save.companions?.active?.length || 0) > 0 && (this.companions?.activeCompanions?.length || 0) > 0;
    if (hasEquippedCompanions) {
      for (const comp of this.companions.activeCompanions) {
        pool.push({ kind: 'companion', companion: comp.def, nextLevel: comp.runLv + 1 });
      }
    }

    // 3지선다 랜덤 추출
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    if (shuffled.length === 0) {
      this.player.heal(5);
      this.combat.spawnDamageText(this.player.x, this.player.y - 28, '+5 HP', '#4ade80', 1.0);
      this.resumeFromModal();
      return;
    }

    this._emitHudUpdate();
    this.handlers.onLevelUpChoices?.(shuffled);
  }

  selectLevelUpChoice(choice) {
    let pickedName = '';
    if (choice.kind === 'skill') {
      this.player.addSkillLevel(choice.skill.id);
      pickedName = choice.skill.name;
    } else if (choice.kind === 'companion') {
      this.companions.upgradeInRun(choice.companion.id);
      pickedName = choice.companion.name;
    }
    if (this.runStats.isTutorial) {
      this.tutorial.onSkillPicked(pickedName);
    }
    this.resumeFromModal();
    this._emitHudUpdate();
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
    this.wordEvents.reset();
    this.autoRescueTimer = 0;
    this.rescuedCompanion = null;
    this.tutorialTransitionActive = false;
    this.tutorialClearParticles = [];
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

  acknowledgeTutorialStep2() {
    if (!this.runStats.isTutorial) return;
    if (this.tutorial.acknowledgeStep2()) {
      audioEngine.playCaptureTick?.();
      this._presentCurrentQuestion();
      this._emitHudUpdate();
    }
  }

  completeTutorialToLobby() {
    this.tutorialTransitionActive = false;
    this.tutorialClearParticles = [];
    this.stageDirector.completeTutorialToLobby();
  }

  _finishStage(cleared) {
    this.stageDirector.finishStage(cleared);
  }

  _startLoop() {
    this._stopLoop();
    this.lastTime = performance.now();
    const tick = (now) => {
      if (!this.isRunning) return;
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      let dt = Math.min(BALANCE.ENGINE.MAX_DT, Math.max(0, rawDt));
      const unscaledDt = dt;

      if (this.tutorialTransitionActive) {
        // 필살기 폭발 후 약 0.5~0.6초간 슬로우 모션 (0.35배속)
        dt *= 0.35;
      }

      if (this.state === GAME_STATES.PLAYING) {
        this._update(dt, unscaledDt);
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

  _update(dt, unscaledDt = dt) {
    // 튜토리얼 필살기 발동 후 전환 파티클 업데이트
    if (this.tutorialTransitionActive) {
      if (!this.tutorialClearParticles) this.tutorialClearParticles = [];
      if (this.tutorialClearParticles.length < 35) {
        for (let i = 0; i < 2; i++) {
          this.tutorialClearParticles.push({
            x: this.viewW / 2 + (Math.random() - 0.5) * Math.min(340, this.viewW - 40),
            y: this.viewH / 2 - 10 + (Math.random() - 0.5) * 80,
            vx: (Math.random() - 0.5) * 45,
            vy: -25 - Math.random() * 45,
            size: 2 + Math.random() * 3.5,
            color: Math.random() > 0.3 ? '#fbbf24' : '#fef08a',
            alpha: 1.0,
            ttl: 0.5 + Math.random() * 0.4,
            maxTtl: 0.9,
          });
        }
      }
      for (let i = this.tutorialClearParticles.length - 1; i >= 0; i--) {
        const p = this.tutorialClearParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.ttl -= unscaledDt;
        p.alpha = Math.max(0, p.ttl / p.maxTtl);
        if (p.ttl <= 0) {
          this.tutorialClearParticles.splice(i, 1);
        }
      }
    }

    // 튜토리얼 Step 2 (전광판 설명 및 [알겠어!] 대기 중): 모달 없이 게임 루프(좀비 이동, 사격, 타이머)만 일시정지
    if (this.runStats.isTutorial && this.tutorial.active && this.tutorial.step === 2) {
      this._emitHudUpdate();
      return;
    }

    // 오답 확인 브레이크(1.2초): 좀비 이동·공격·스폰 및 전투 일시 정지
    if (this.wordEvents.updateWrongReview(dt)) {
      this._emitHudUpdate();
      return;
    }

    // 신규 동료 최초 구출 1.8초 자동 슬로우 쇼케이스
    if (this.autoRescueTimer > 0) {
      this.autoRescueTimer = Math.max(0, this.autoRescueTimer - dt);
      if (this.autoRescueTimer <= 0) {
        this.rescuedCompanion = null;
      }
      this._emitHudUpdate();
      return;
    }

    this.elapsedTime += dt;

    // 1.5초 비석 리스폰 대기 처리
    this.wordEvents.updateRespawn(dt);

    const prevX = this.player.x;
    const prevY = this.player.y;
    const forceIdleTrot = Boolean(this.runStats.isTutorial && this.tutorial.step === 1);
    this.player.update(dt, this.inputVec, this.arenaWidth, this.arenaHeight, this.obstacles.obstacles, this.monoliths.monoliths, forceIdleTrot);

    if (this.runStats.isTutorial) {
      this.tutorial.recordMovement(this.player.x - prevX, this.player.y - prevY);
    }

    const prevKills = this.combat.kills;
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
    if (this.runStats.isTutorial) {
      this.player.hp = Math.max(Math.round(this.player.maxHp * 0.5), this.player.hp);
    } else if (this.runStats.isPlacement || this.runStats.isPlacementTest) {
      this.player.hp = Math.max(Math.ceil(this.player.maxHp * 0.2), this.player.hp);
    }
    const compRes = this.companions.update(dt, this.player, this.enemies.enemies, this.enemies.boss, this.combat);
    if (compRes?.cleanedPoop) {
      const curBreed = getSave().selectedBreed || 'pomeranian';
      addAffection(curBreed, 15);
      recordQuestProgress('poopCount', 1);
      this.runStats.earnedEvoXp = (this.runStats.earnedEvoXp || 0) + 100;
      this.combat.spawnDamageText(compRes.poopX, compRes.poopY - 30, '✨ 💩 응가 치움! (+친밀도 & +100점)', '#22c55e', 1.3);
      audioEngine.playCaptureTick?.();
    }
    this.combat.update(dt, this.player);

    const monoRes = this.monoliths.update(dt, this.player);
    if (monoRes.captureTicking) {
      if (Math.random() < 0.25) audioEngine.playCaptureTick();
    }
    if (monoRes.pickedGems > 0) {
      this.runStats.pickedGems = (this.runStats.pickedGems || 0) + monoRes.pickedGems;
      if (this.runStats.isTutorial && this.tutorial.step === 5) {
        const gemCount = Math.max(1, Math.round(monoRes.pickedGemCharge / (BALANCE.COMBAT.GEM_CHARGE_VALUE || 2)));
        this.player.addUltGauge(gemCount * (BALANCE.TUTORIAL.STEP5_GEM_ULT_CHARGE || 34));
      } else if (!this.runStats.isTutorial) {
        const ultChargeBonus = getTrainingBonusValue('ultChargeLv', getSave().training?.ultChargeLv || 0);
        this.player.addUltGauge(Math.round(monoRes.pickedGemCharge * (1 + ultChargeBonus)));
      }
    }
    if (monoRes.pickedSnacks > 0) {
      // 1. 뼈다귀(희소 드롭): 로비 성장·친밀도 재화 획득
      updateSave((s) => {
        s.snacks = (s.snacks || 0) + monoRes.pickedSnacks;
      });
      this.combat.spawnDamageText(this.player.x, this.player.y - 36, `+${monoRes.pickedSnacks} 🦴`, '#fbbf24', 1.1);
    }
    if (monoRes.pickedMedkits > 0) {
      // 2. 구급상자(극희소 드롭): 즉시 체력 회복
      const healPerKit = Math.max(1, Math.round(this.player.maxHp * (BALANCE.COMBAT.MEDKIT_HEAL_RATIO || 0.3)));
      const healAmt = healPerKit * monoRes.pickedMedkits;
      this.player.heal(healAmt);
      this.combat.spawnDamageText(this.player.x, this.player.y - 42, `+${healAmt} HP 💊`, '#ef4444', 1.15);
    }
    if (monoRes.resolvedMonolith) {
      this._handleMonolithResolved(monoRes.resolvedMonolith);
    }

    // 튜토리얼 6단계 진행 제어 (전 구간 8~10마리 수준 좀비 지속 스폰 & 체력 50% 하한 보호)
    if (this.runStats.isTutorial && this.tutorial.active) {
      if (this.tutorial.step === 1) {
        this.player.ultGauge = 0;
        if (this.enemies.enemies.length < 8) {
          const need = 9 - this.enemies.enemies.length;
          for (let i = 0; i < need; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = 165 + Math.random() * 50;
            const zx = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(ang) * dist));
            const zy = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(ang) * dist));
            this.enemies.spawnEnemy('walker', zx, zy, 0.85, 0.65, 0.92);
          }
        }
        if (this.tutorial.checkStep1Advance(this.combat.kills)) {
          if (this.deck[0]?.word) {
            audioEngine.speakWordOnce(this.deck[0].word);
          }
        }
      } else if (this.tutorial.step === 2 || this.tutorial.step === 3 || this.tutorial.step === 4) {
        this.player.ultGauge = 0;
        if (this.enemies.enemies.length < 8) {
          const need = 9 - this.enemies.enemies.length;
          for (let i = 0; i < need; i++) {
            const ang = (Math.PI * 2 * i) / Math.max(1, need) + Math.random() * 0.5;
            const dist = 195 + Math.random() * 55;
            const zx = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(ang) * dist));
            const zy = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(ang) * dist));
            this.enemies.spawnEnemy('walker', zx, zy, 0.65, 0.5, 0.82);
          }
        }
      } else if (this.tutorial.step === 5) {
        const newKills = Math.max(0, this.combat.kills - prevKills);
        if (newKills > 0) {
          this.player.addUltGauge(newKills * (BALANCE.TUTORIAL.STEP5_KILL_ULT_CHARGE || 12));
        }
        if (this.enemies.enemies.length < 8) {
          const need = 10 - this.enemies.enemies.length;
          for (let i = 0; i < need; i++) {
            const ang = (Math.PI * 2 * i) / Math.max(1, need) + Math.random() * 0.4;
            const dist = 170 + Math.random() * 50;
            const zx = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(ang) * dist));
            const zy = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(ang) * dist));
            this.enemies.spawnEnemy('walker', zx, zy, 0.6, 0.5, 0.85);
          }
        }
      } else if (this.tutorial.step === 6 && !this.tutorial.ultTriggered) {
        if (this.enemies.enemies.length < 8) {
          const need = 10 - this.enemies.enemies.length;
          for (let i = 0; i < need; i++) {
            const ang = (Math.PI * 2 * i) / Math.max(1, need) + Math.random() * 0.35;
            const dist = 155 + Math.random() * 45;
            const zx = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(ang) * dist));
            const zy = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(ang) * dist));
            this.enemies.spawnEnemy('walker', zx, zy, 0.6, 0.5, 0.8);
          }
        }
      }

      const tutTick = this.tutorial.update(this.tutorialTransitionActive ? unscaledDt : dt, this.player);
      if (tutTick.transitionedToStep5) {
        this.player.ultGauge = 0;
        this.monoliths.clearMonoliths();
        this.monoliths.drops = [];
        const waveCount = BALANCE.TUTORIAL.STEP5_WAVE_ZOMBIES || 9;
        const need = Math.max(0, waveCount - this.enemies.enemies.length);
        for (let i = 0; i < need; i++) {
          const ang = (Math.PI * 2 * i) / Math.max(1, need);
          const dist = 170 + (i % 2) * 35;
          const zx = Math.max(80, Math.min(this.arenaWidth - 80, this.player.x + Math.cos(ang) * dist));
          const zy = Math.max(80, Math.min(this.arenaHeight - 80, this.player.y + Math.sin(ang) * dist));
          this.enemies.spawnEnemy('walker', zx, zy, 0.6, 0.5, 0.85);
        }
      }
      if (tutTick.completedAll) {
        this.completeTutorialToLobby();
        return;
      }
    }

    // 튜토리얼 및 실력 진단(배치) 테스트 체력 하한선 보호 (어떤 경우에도 사망 불가)
    const isProtected = Boolean(
      this.runStats.isTutorial ||
      this.runStats.isPlacement ||
      this.runStats.isPlacementTest ||
      this.player.isProtectedMode
    );
    if (isProtected) {
      const minRatio = this.runStats.isTutorial ? 0.5 : 0.2;
      const minHp = Math.ceil(this.player.maxHp * minRatio);
      this.player.hp = Math.max(minHp, this.player.hp);
    }

    // 사망 판정 (보호 모드일 때는 사망 모달 실행 원천 차단)
    if (this.player.hp <= 0 && !isProtected) {
      this.state = GAME_STATES.GAMEOVER_MODAL;
      audioEngine.pauseAll();
      this.handlers.onGameOver?.({ canRevive: !this.runStats.revivedOnce });
      return;
    }

    this.camera.update(dt, this.player.x, this.player.y, this.arenaWidth, this.arenaHeight, this.viewW, this.viewH);
    this._emitHudUpdate();
  }

  _emitHudUpdate() {
    // HUD 갱신 콜백: 벙커 해치 중심이 화면 뷰포트 안쪽(0 <= x <= viewW, 0 <= y <= viewH)이면 가장자리 가이드 숨김
    const edgeArrows = this.monoliths.monoliths.map((m) => {
      const scr = this.camera.worldToScreen(m.x, m.y, this.viewW, this.viewH);
      const outOfView = isMonolithOffscreen(scr.x, scr.y, this.viewW, this.viewH);
      return { id: m.id, meaning: m.meaning, isCorrect: Boolean(m.isCorrect), screenX: scr.x, screenY: scr.y, outOfView };
    });

    const milestoneXp = this.runStats.isTutorial ? Math.min(3, this.tutorial.solvedCount) : (this.runStats.correctCount % 3);
    const milestoneTarget = 3;

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
      tutorialCoaching: this.runStats.isTutorial ? this.tutorial.getCoachingState(this.player.ultGauge, this.currentWord || this.deck[0]) : null,
      placement: this.runStats.isPlacement ? {
        isPlacementTest: Boolean(this.runStats.isPlacementTest),
        targetUnitNum: this.runStats.targetUnitNum,
        lives: this.runStats.placementLives,
        questionNumber: Math.min(10, (this.wordEvents?.questionIndex ?? 0) + 1),
      } : null,
    });
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    const highlightMonoliths = Boolean(this.runStats.isTutorial && this.tutorial.step === 3);

    this.camera.beginTransform(ctx, this.viewW, this.viewH);
    this.camera.renderArena(ctx, this.chapter, this.arenaWidth, this.arenaHeight, this.elapsedTime);
    this.obstacles.render(ctx);
    this.enemies.render(ctx);
    this.monoliths.render(ctx, this.elapsedTime, highlightMonoliths, this.camera, this.viewW, this.viewH, Boolean(this.runStats.isTutorial && this.tutorial.active));
    this.companions.render(ctx, this.elapsedTime);
    this.player.render(ctx, this.elapsedTime);
    this.combat.render(ctx);
    this.camera.endTransform(ctx);

    // 필살기 순간 줌인/줌아웃 카메라 무빙 시 화면 테두리 임팩트 플래시
    if (this.camera.ultCamActive) {
      const p = Math.min(1, this.camera.ultCamElapsed / Math.max(0.01, this.camera.ultCamDuration));
      const flashAlpha = Math.max(0, (1 - p) * 0.32);
      ctx.save();
      const grad = ctx.createRadialGradient(
        this.viewW / 2,
        this.viewH * this.camera.centerRatioY,
        this.viewW * 0.18,
        this.viewW / 2,
        this.viewH * this.camera.centerRatioY,
        this.viewH * 0.65
      );
      grad.addColorStop(0, 'rgba(251, 191, 36, 0)');
      grad.addColorStop(1, `rgba(245, 158, 11, ${flashAlpha.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();
    }

    // 신규 동료 1.8초 자동 구출 쇼케이스 카드 렌더링
    if (this.autoRescueTimer > 0 && this.rescuedCompanion) {
      this._renderAutoRescueCard(ctx);
    }

    // 튜토리얼 필살기 발동 후 슬로우모션 전환 배너 및 파티클 렌더링
    if (this.tutorialTransitionActive) {
      this._renderTutorialClearBanner(ctx);
    }
  }

  _renderTutorialClearBanner(ctx) {
    ctx.save();

    // 1. 반짝이는 파티클 렌더링
    if (this.tutorialClearParticles && this.tutorialClearParticles.length > 0) {
      for (const p of this.tutorialClearParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. 화면 중앙 깔끔한 전환 배너 카드
    const cx = this.viewW / 2;
    const cy = this.viewH / 2;
    const bannerW = Math.min(320, this.viewW - 40);
    const bannerH = 100;

    // 배너 배경 & 테두리
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.5)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(cx - bannerW / 2, cy - bannerH / 2, bannerW, bannerH, 16);
    ctx.fill();
    ctx.stroke();

    // 메인 타이틀: ⚡ 실전 훈련 클리어!
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ 실전 훈련 클리어!', cx, cy - 14);

    // 서브 타이틀: 본부로 이동합니다... 🐾
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText('본부로 이동합니다... 🐾', cx, cy + 18);

    ctx.restore();
  }

  _renderAutoRescueCard(ctx) {
    const comp = this.rescuedCompanion;
    const progress = Math.min(1.0, this.autoRescueTimer / 1.8);
    ctx.save();

    // 반투명 어두운 배경
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const cx = this.viewW / 2;
    const cy = this.viewH / 2;
    const cardW = Math.min(300, this.viewW - 40);
    const cardH = 210;

    // 카드 테두리 & 배경
    ctx.fillStyle = '#faf6ee';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    // 상단 태그
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 새 동료 구출 완료!', cx, cy - cardH / 2 + 28);

    // 동료 아이콘
    ctx.font = '46px sans-serif';
    ctx.fillText(comp.icon || '🐾', cx, cy - 16);

    // 동료 이름
    ctx.fillStyle = '#1f2d24';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(comp.name, cx, cy + 30);

    // 특성 & 역할
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('로비 [내 강아지]에서 장착할 수 있습니다', cx, cy + 49);

    // 자동 복귀 타이머 텍스트
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    const sec = Math.max(0.1, this.autoRescueTimer).toFixed(1);
    ctx.fillText(`⏱️ ${sec}초 후 자동으로 전투에 복귀합니다`, cx, cy + cardH / 2 - 22);

    // 타이머 바
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx - cardW / 2 + 20, cy + cardH / 2 - 13, cardW - 40, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - cardW / 2 + 20, cy + cardH / 2 - 13, (cardW - 40) * progress, 4);

    ctx.restore();
  }
}

