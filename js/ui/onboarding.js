/**
 * js/ui/onboarding.js
 * Zombie Voca 스토리 기반 온보딩 플로우 모듈
 *
 * [3단계 시퀀스]
 * - Scene 1: 공항 도착 & 바이러스 습격 컷신 (인천공항 입국장, 경보 스트로브, 주인 감염, 보카-큐어/캐리어 낙하)
 *   -> 애니메이션 종료(animationend) 시 자동으로 덜컹거리는 캐리어 연출을 거쳐 Scene 2 진입
 * - Scene 2: 흔들리는 캐리어 — 파트너 반려견 3종(포메라니안, 비글, 프렌치 불독) 선택 & 이름 짓기
 * - Scene 3: 보카-큐어 활성화 — 학습 언어 선택 (영어 🇺🇸 / 스페인어 🇪🇸)
 *   -> settingsStore.switchLanguage(lang) 적용 후 기존 인게임 튜토리얼 핸드오프
 */

import { getSave, updateSave } from '../core/saveStore.js';
import { audioEngine } from '../core/audioEngine.js';
import { renderDogToCanvas } from '../render/dogRenderer.js';
import { settingsStore } from '../settingsStore.js';

// 스타터 반려견 목록 (왼쪽부터: [프렌치 불독] - [포메라니안(가운데, 기본)] - [비글])
export const STARTER_BREEDS = [
  {
    id: 'french_bulldog',
    name: '프렌치 불독',
    defaultName: '불리',
    badge: '🛡️ 방어형',
    badgeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-900',
    desc: '높은 체력으로 좀비 충돌에 강한 탱커',
    hp: 130,
    speed: 165,
  },
  {
    id: 'pomeranian',
    name: '포메라니안',
    defaultName: '우유',
    badge: '⚖️ 균형형',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900',
    desc: '공수 밸런스가 뛰어난 만능 파트너',
    hp: 100,
    speed: 180,
  },
  {
    id: 'beagle',
    name: '비글',
    defaultName: '바우',
    badge: '⚡ 기동형',
    badgeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-900',
    desc: '빠른 기동력으로 해치와 아이템 회수 특화',
    hp: 90,
    speed: 210,
  },
];

/**
 * 스토리 기반 온보딩 시퀀스 시작 함수
 * @param {Object} ctx 모달 컨텍스트 ({ openModal, closeModal, refreshHeader, renderActiveTab })
 * @param {Object} options 부가 옵션 ({ onStartTutorial, onComplete, initialStep })
 */
export function startStoryOnboarding(ctx = {}, options = {}) {
  // 모달 제어 함수 폴백 보정
  let openModal = ctx.openModal;
  let closeModal = ctx.closeModal;
  const refreshHeader = ctx.refreshHeader;
  const renderActiveTab = ctx.renderActiveTab;
  const { onStartTutorial, onComplete, initialStep = 1 } = options;

  if (typeof openModal !== 'function' || typeof closeModal !== 'function') {
    const layer = document.getElementById('modal-layer');
    const card = document.getElementById('modal-card');
    if (layer && card) {
      openModal = (html) => {
        card.innerHTML = html;
        layer.classList.remove('hidden');
      };
      closeModal = () => {
        layer.classList.add('hidden');
        card.innerHTML = '';
      };
    } else {
      console.warn('[onboarding] modal elements not found in DOM.');
      return;
    }
  }

  // 온보딩 세션 상태
  const session = {
    step: Math.max(1, Math.min(3, initialStep)),
    selectedBreed: 'pomeranian',
    petName: '우유',
    studyLang: 'en',
  };

  // 기존 저장 데이터가 있으면 기본값 동기화
  try {
    const curSave = getSave ? getSave() : {};
    if (curSave.selectedBreed && STARTER_BREEDS.some((b) => b.id === curSave.selectedBreed)) {
      session.selectedBreed = curSave.selectedBreed;
    }
    if (curSave.dogName) session.petName = curSave.dogName;
    if (curSave.studyLang) session.studyLang = curSave.studyLang;
  } catch (_) {}

  // ----------------------------------------------------
  // Scene 1: 공항 도착 & 바이러스 습격 컷신
  // ----------------------------------------------------
  function renderScene1() {
    session.step = 1;
    audioEngine.playCaptureTick?.();

    openModal(`
      <style>
        @keyframes carrierRattleIntro {
          0% { transform: translateY(0) scale(1) rotate(0deg); }
          20% { transform: translateY(-4px) scale(1.05) rotate(-4deg); }
          40% { transform: translateY(0) scale(1.08) rotate(4deg); }
          60% { transform: translateY(-6px) scale(1.12) rotate(-5deg); }
          80% { transform: translateY(-2px) scale(1.15) rotate(4deg); }
          100% { transform: translateY(0) scale(1.18) rotate(0deg); }
        }
        @keyframes cutsceneProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      </style>
      <div class="space-y-4 py-1 text-center">
        <!-- Top bar with Skip -->
        <div class="flex items-center justify-between pb-1.5 border-b border-[#e2d9c8]">
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black tracking-wider animate-pulse">
              🚨 PROLOGUE · 1 / 3
            </span>
            <span class="text-xs font-black text-[#5c6e60]">인천국제공항 입국장</span>
          </div>
          <button
            id="btn-skip-opening"
            type="button"
            class="text-[11px] font-black text-[#5c6e60] hover:text-[#1f2d24] bg-[#ede5d4] hover:bg-[#e4dac5] px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>오프닝 건너뛰기</span>
            <span>⏩</span>
          </button>
        </div>

        <!-- Airport Incident Visual Frame -->
        <div class="relative w-full h-44 rounded-2xl bg-gradient-to-b from-[#101b14] via-[#1a291f] to-[#111c14] border-2 border-[#3c5544] shadow-inner overflow-hidden flex flex-col items-center justify-center p-3 select-none">
          <!-- Warning Ambient Strobe -->
          <div class="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-rose-600/35 blur-2xl animate-pulse pointer-events-none"></div>
          <div class="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-cyan-500/25 blur-2xl animate-pulse pointer-events-none"></div>

          <!-- Electronic Arrival Board -->
          <div class="z-10 mb-2 px-3 py-1 rounded-md bg-black/60 border border-amber-400/40 text-amber-300 text-[9.5px] font-mono font-bold tracking-widest flex items-center gap-1.5 shadow">
            <span>🛬 INTL ARRIVALS</span>
            <span class="text-rose-400 animate-ping">●</span>
            <span class="text-rose-400">BIOHAZARD LOCKDOWN</span>
          </div>

          <!-- Illustrated Entities -->
          <div class="z-10 flex items-center justify-center gap-6 mt-1">
            <!-- Rattling pet carrier -->
            <div id="intro-carrier" class="relative flex flex-col items-center" style="animation: carrierRattleIntro 2.4s ease-in-out forwards;">
              <div class="text-4xl">🧳</div>
              <div class="mt-1 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[9px] font-black">
                덜컹덜컹 🐾
              </div>
            </div>

            <!-- Collapsed Owner Silhouette -->
            <div class="relative flex flex-col items-center">
              <div class="text-4xl opacity-80 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                🧎‍♂️
              </div>
              <div class="mt-1 px-1.5 py-0.5 rounded bg-rose-600/40 text-rose-200 text-[9px] font-bold animate-pulse">
                바이러스 감염!
              </div>
            </div>

            <!-- Dropped Voca-Cure device -->
            <div class="relative flex flex-col items-center">
              <div class="relative">
                <div class="text-3xl text-cyan-400 filter drop-shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse">
                  📟
                </div>
                <span class="absolute -top-1 -right-1 text-xs">⚡</span>
              </div>
              <div class="mt-1 px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 text-[9px] font-black">
                〈보카-큐어〉
              </div>
            </div>
          </div>
        </div>

        <!-- Narrative Box -->
        <div class="rounded-xl bg-[#efe9dc] border border-[#d8cfbe] p-3.5 text-left space-y-1.5 shadow-xs">
          <p class="text-xs font-black text-rose-700 flex items-center gap-1">
            <span>🚨</span>
            <span>공항 긴급 바이러스 경보 발령</span>
          </p>
          <p class="text-xs font-extrabold text-[#1f2d24] leading-relaxed break-keep">
            설레는 해외 여행 첫날... 공항에 요란한 경보가 울리며 동행하던 주인이 정체불명의 바이러스에 감염되어 바닥에 쓰러집니다.
          </p>
          <p class="text-xs font-bold text-[#4a584e] leading-relaxed break-keep">
            주인의 떨리는 손에서 최첨단 단어 해독기 <b class="text-cyan-800 font-black">〈보카-큐어(Voca-Cure)〉</b>와 덜컹거리는 반려견 캐리어가 굴러떨어졌습니다!
          </p>
        </div>

        <!-- Auto Transition Progress & Status Indicator -->
        <div class="w-full flex flex-col items-center gap-1.5 pt-1">
          <div class="w-full h-1.5 rounded-full bg-[#d8cfbe] overflow-hidden shadow-inner">
            <div id="scene1-progress-bar" class="h-full bg-emerald-600 rounded-full" style="animation: cutsceneProgress 2.4s linear forwards;"></div>
          </div>
          <div class="text-xs font-black text-emerald-800 animate-pulse flex items-center gap-1">
            <span>🐾</span>
            <span>캐리어 안에서 소리가 들립니다... 확인 중</span>
          </div>
        </div>
      </div>
    `);

    // 오프닝 건너뛰기 버튼
    document.getElementById('btn-skip-opening')?.addEventListener('click', () => {
      audioEngine.playCaptureTick?.();
      renderScene2();
    });

    // 캐리어 덜컹거림 애니메이션 종료 시 자동으로 Scene 2 반려견 선택 화면 진입
    const carrierEl = document.getElementById('intro-carrier');
    carrierEl?.addEventListener('animationend', (e) => {
      if (e.target !== carrierEl) return;
      audioEngine.playCaptureTick?.();
      renderScene2();
    }, { once: true });
  }

  // ----------------------------------------------------
  // Scene 2: 흔들리는 캐리어 — 반려견 선택 & 이름 짓기
  // ----------------------------------------------------
  function renderScene2() {
    session.step = 2;
    audioEngine.playCaptureTick?.();

    const baseSave = getSave ? getSave() : {};
    const cardsHtml = STARTER_BREEDS.map((breed) => {
      const isSelected = breed.id === session.selectedBreed;
      return `
        <button
          type="button"
          data-starter-breed="${breed.id}"
          class="relative p-2.5 rounded-2xl border-2 text-center flex flex-col items-center justify-between transition-all duration-200 transform active:scale-95 cursor-pointer ${
            isSelected
              ? 'scale-105 z-10 bg-emerald-50/95 border-emerald-600 shadow-[0_6px_20px_rgba(16,185,129,0.32)] ring-2 ring-emerald-500/40'
              : 'scale-100 opacity-90 bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0] hover:opacity-100'
          }"
        >
          <div class="w-full flex items-center justify-center">
            <span class="px-1.5 py-0.5 rounded-md border text-[9px] font-black leading-none whitespace-nowrap ${breed.badgeClass}">
              ${breed.badge}
            </span>
          </div>

          <div class="my-1.5 relative flex items-center justify-center">
            <div class="relative w-[76px] h-[64px] flex items-center justify-center">
              ${
                isSelected
                  ? '<div class="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-emerald-400/50 to-teal-400/50 blur-md animate-pulse pointer-events-none"></div>'
                  : ''
              }
              <canvas
                data-starter-canvas="${breed.id}"
                width="74"
                height="62"
                class="relative z-10 w-[74px] h-[62px] rounded-xl ${
                  isSelected
                    ? 'bg-gradient-to-b from-emerald-100/90 to-[#f0ebe0] border-2 border-emerald-500 shadow-sm'
                    : 'bg-[#f0ebe0] border border-[#d2c8b4]'
                } block"
              ></canvas>
              ${
                isSelected
                  ? '<span class="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow">✓</span>'
                  : ''
              }
            </div>
          </div>

          <div class="w-full space-y-0.5">
            <div class="text-xs font-black text-[#1f2d24] leading-tight truncate">${breed.name}</div>
            <p class="text-[9.5px] font-bold text-[#5c6e60] leading-tight truncate">
              ${breed.desc}
            </p>
          </div>
        </button>
      `;
    }).join('');

    openModal(`
      <div class="space-y-3.5 py-1 text-left">
        <!-- Top bar -->
        <div class="flex items-center justify-between pb-1.5 border-b border-[#e2d9c8]">
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-black tracking-wider">
            🐾 PARTNER · 2 / 3
          </span>
          <span class="text-xs font-bold text-[#5c6e60]">스타터 반려견 입양</span>
        </div>

        <!-- Rattling Carrier Banner -->
        <div id="carrier-banner" class="relative p-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-[#f3ede0] border-2 border-amber-300/80 flex items-center gap-3 shadow-xs">
          <div class="w-11 h-11 rounded-xl bg-amber-200/90 border border-amber-400 flex items-center justify-center text-2xl animate-bounce shrink-0">
            🧳
          </div>
          <div class="space-y-0.5">
            <div class="text-xs font-black text-[#1f2d24]">캐리어 안에서 낑낑거리는 소리가 들립니다!</div>
            <p class="text-[10.5px] font-bold text-[#5c6e60] leading-tight">
              함께 여행 온 반려견 파트너를 선택해 주세요.
            </p>
          </div>
        </div>

        <!-- Dog Cards Grid (3 Starters) -->
        <div class="grid grid-cols-3 gap-2">
          ${cardsHtml}
        </div>

        <!-- Pet Name Input -->
        <div class="rounded-xl bg-[#efe9dc] border border-[#d8cfbe] p-2.5 space-y-1">
          <label for="input-onboarding-pet-name" class="block text-xs font-black text-[#1f2d24] flex items-center justify-between">
            <span>🏷️ 파트너 반려견 이름:</span>
            <span class="text-[10px] font-normal text-[#5c6e60]">* 빈칸 시 '우유' 자동 적용</span>
          </label>
          <div class="relative">
            <input
              id="input-onboarding-pet-name"
              type="text"
              maxlength="10"
              value="${session.petName || '우유'}"
              placeholder="우유"
              class="w-full px-3 py-2 rounded-xl bg-white border border-[#c4bba8] text-sm font-black text-[#1f2d24] focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
            />
            <span class="absolute right-3 top-2.5 text-xs text-[#8a998c]">🐾</span>
          </div>
        </div>

        <!-- Confirm Button -->
        <button
          id="btn-confirm-scene2"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2d6a4f] via-[#245840] to-[#1b4332] text-[#f8f5ec] font-black text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🐾 이 파트너와 함께하기!</span>
          <span>▶</span>
        </button>
      </div>
    `);

    // 반려견 캔버스 프리뷰 렌더링
    document.querySelectorAll('[data-starter-canvas]').forEach((cvs) => {
      const bId = cvs.getAttribute('data-starter-canvas');
      try {
        renderDogToCanvas(cvs, {
          save: { ...baseSave, selectedBreed: bId },
          breedId: bId,
          scale: 1.05,
          y: cvs.height / 2 + 5,
          withWeapon: false,
          withEquipment: false,
          isHappy: bId === session.selectedBreed,
          time: Date.now(),
        });
      } catch (err) {
        // 캔버스 렌더링 예외 시 폴백
      }
    });

    // 견종 카드 선택 이벤트
    document.querySelectorAll('[data-starter-breed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-starter-breed');
        if (chosen && chosen !== session.selectedBreed) {
          audioEngine.playCaptureTick?.();
          session.selectedBreed = chosen;
          const opt = STARTER_BREEDS.find((b) => b.id === chosen);
          if (opt && (!session.petName || session.petName === '우유' || session.petName === '바우' || session.petName === '불리')) {
            session.petName = opt.defaultName;
          }
          renderScene2();
        }
      });
    });

    // 이름 입력 동기화
    const inputEl = document.getElementById('input-onboarding-pet-name');
    if (inputEl) {
      inputEl.addEventListener('input', (e) => {
        session.petName = e.target.value.trim();
      });
    }

    // 파트너 확정
    document.getElementById('btn-confirm-scene2')?.addEventListener('click', () => {
      const entered = inputEl ? inputEl.value.trim() : '';
      session.petName = entered || '우유';
      audioEngine.playLevelUp?.();

      // settingsStore 및 saveStore 즉시 저장
      try {
        if (settingsStore) {
          settingsStore.set('petBreed', session.selectedBreed);
          settingsStore.set('petName', session.petName);
          settingsStore.save();
        }
      } catch (_) {}

      try {
        if (typeof updateSave === 'function') {
          updateSave((s) => {
            s.selectedBreed = session.selectedBreed;
            s.dogName = session.petName;
            s.unlockedBreeds = [session.selectedBreed];
          });
        }
      } catch (_) {}

      refreshHeader?.();
      renderActiveTab?.();
      renderScene3();
    });
  }

  // ----------------------------------------------------
  // Scene 3: 보카-큐어 활성화 — 학습 언어 선택 & 튜토리얼 핸드오프
  // ----------------------------------------------------
  function renderScene3() {
    session.step = 3;
    audioEngine.playCaptureTick?.();

    const LANG_OPTIONS = [
      {
        id: 'en',
        flag: '🇺🇸',
        label: '영어',
        sub: 'English',
        desc: '필수 회화 5,000단어 마스터',
      },
      {
        id: 'es',
        flag: '🇪🇸',
        label: '스페인어',
        sub: 'Español',
        desc: '필수 회화 5,000단어 마스터',
      },
    ];

    const cardsHtml = LANG_OPTIONS.map((opt) => {
      const isSelected = opt.id === session.studyLang;
      return `
        <button
          type="button"
          data-study-lang="${opt.id}"
          class="relative aspect-[4/3] w-full p-3.5 rounded-2xl border-2 ${
            isSelected
              ? 'bg-cyan-50 border-cyan-600 shadow-md ring-2 ring-cyan-500/40'
              : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
          } flex flex-col items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
        >
          <div class="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
            isSelected ? 'bg-cyan-600 text-white shadow-xs' : 'border-2 border-[#d2c8b4] text-transparent'
          }">✓</div>
          <span class="text-4xl leading-none select-none">${opt.flag}</span>
          <div class="text-sm font-black text-[#1f2d24] mt-1">${opt.label}</div>
          <div class="text-[11px] font-extrabold ${isSelected ? 'text-cyan-800' : 'text-[#5c6e60]'}">${opt.sub}</div>
          <div class="text-[9.5px] font-bold text-[#718274]">${opt.desc}</div>
        </button>
      `;
    }).join('');

    openModal(`
      <div class="space-y-4 py-1 text-center">
        <!-- Top bar -->
        <div class="flex items-center justify-between pb-1.5 border-b border-[#e2d9c8]">
          <span class="px-2 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 text-[10px] font-black tracking-wider">
            ⚡ VOCA-CURE · 3 / 3
          </span>
          <span class="text-xs font-bold text-[#5c6e60]">해독 주파수 언어 설정</span>
        </div>

        <!-- Puppy Nose-boop Narrative -->
        <div class="relative p-3.5 rounded-2xl bg-gradient-to-b from-[#102027] to-[#1c313a] border-2 border-cyan-500/50 shadow-md text-cyan-100 space-y-1.5">
          <div class="flex items-center justify-center gap-2">
            <span class="text-2xl animate-pulse">📟</span>
            <span class="text-xs font-black text-cyan-300 tracking-wider">VOCA-CURE SYSTEM ONLINE</span>
          </div>
          <p class="text-xs font-extrabold text-[#f0f9ff] leading-relaxed break-keep">
            바닥에 떨어진 보카-큐어로 <b>${session.petName}</b>가 다가와 코로 전원 버튼을 꾹 누릅니다! 🐾
          </p>
          <p class="text-[11px] font-bold text-cyan-200/90 leading-tight">
            "치직... 삐비빅! 해독 주파수를 생성할 학습 언어를 선택해 주세요."
          </p>
        </div>

        <!-- Language Choice Grid -->
        <div class="grid grid-cols-2 gap-3 text-left">
          ${cardsHtml}
        </div>

        <!-- Confirm Button -->
        <button
          id="btn-confirm-scene3"
          type="button"
          class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-700 via-teal-700 to-emerald-800 text-white font-black text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>🚀 보카-큐어 가동 & 튜토리얼 출격!</span>
          <span>▶</span>
        </button>
      </div>
    `);

    // 언어 선택 카드 이벤트
    document.querySelectorAll('[data-study-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-study-lang');
        if (chosen && chosen !== session.studyLang) {
          audioEngine.playCaptureTick?.();
          session.studyLang = chosen;
          renderScene3();
        }
      });
    });

    // 언어 확정 및 인게임 6단계 튜토리얼 핸드오프
    document.getElementById('btn-confirm-scene3')?.addEventListener('click', () => {
      audioEngine.playLevelUp?.();

      // 1. settingsStore 언어 전환 및 상태 저장
      try {
        if (settingsStore && typeof settingsStore.switchLanguage === 'function') {
          settingsStore.switchLanguage(session.studyLang);
        }
        if (settingsStore) {
          settingsStore.set('petBreed', session.selectedBreed);
          settingsStore.set('petName', session.petName);
          settingsStore.set('onboardingCompleted', true);
          settingsStore.save();
        }
      } catch (_) {}

      // 2. saveStore 동기화 (하위 호환)
      try {
        if (typeof updateSave === 'function') {
          updateSave((s) => {
            s.selectedBreed = session.selectedBreed;
            s.dogName = session.petName;
            s.studyLang = session.studyLang;
            s.langSelected = true;
            s.onboardingCompleted = true;
            s.onboardingStep = 5;
            s.unlockedBreeds = [session.selectedBreed];
          });
        }
      } catch (_) {}

      // 3. 모달 닫기 및 로비 UI 갱신
      closeModal();
      refreshHeader?.();
      renderActiveTab?.();

      // 4. 기존 인게임 튜토리얼 시작 콜백으로 핸드오프
      if (typeof onStartTutorial === 'function') {
        onStartTutorial();
      } else if (typeof onComplete === 'function') {
        onComplete();
      }
    });
  }

  // 초기 씬 렌더링
  if (session.step === 2) {
    renderScene2();
  } else if (session.step === 3) {
    renderScene3();
  } else {
    renderScene1();
  }
}

// ----------------------------------------------------
// 기존 외부 호출 호환 함수 및 별칭 내보내기 (100% 호환성)
// ----------------------------------------------------

/**
 * 온보딩 초기화 및 시작 (기본 별칭)
 */
export function initOnboarding(ctx, options = {}) {
  startStoryOnboarding(ctx, options);
}

/**
 * 온보딩 모달 표시 (기본 별칭)
 */
export function showOnboarding(ctx, options = {}) {
  startStoryOnboarding(ctx, options);
}

/**
 * 최초 학습 언어 선택 모달 (기존 호출 호환)
 */
export function openInitialStudyLangModal(ctx, options = {}) {
  startStoryOnboarding(ctx, options);
}

/**
 * 스타터 강아지 입양 모달 (기존 호출 호환)
 */
export function openStarterAdoptionModal(ctx, options = {}) {
  startStoryOnboarding(ctx, { initialStep: 2, ...options });
}

/**
 * 레벨 선택 모달 래퍼 (modals/onboardingModals.js 위임)
 */
export async function openWordLevelSelectModal(ctx, options = {}) {
  const mod = await import('./modals/onboardingModals.js');
  return mod.openWordLevelSelectModal(ctx, options);
}

/**
 * 온보딩 투어 래퍼 (modals/onboardingModals.js 위임)
 */
export async function createLobbyOnboardingTour(ctx) {
  const mod = await import('./modals/onboardingModals.js');
  return mod.createLobbyOnboardingTour(ctx);
}

// 브라우저 전역 객체 바인딩 (인라인/콘솔 호환)
if (typeof window !== 'undefined') {
  window.initOnboarding = initOnboarding;
  window.showOnboarding = showOnboarding;
  window.startStoryOnboarding = startStoryOnboarding;
  window.openInitialStudyLangModal = openInitialStudyLangModal;
  window.openStarterAdoptionModal = openStarterAdoptionModal;
}

export default {
  startStoryOnboarding,
  initOnboarding,
  showOnboarding,
  openInitialStudyLangModal,
  openStarterAdoptionModal,
  openWordLevelSelectModal,
  createLobbyOnboardingTour,
};
