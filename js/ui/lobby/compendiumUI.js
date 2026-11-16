/**
 * js/ui/lobby/compendiumUI.js
 * 하단 5번째 탭 [📖 도감] (단어장 / 장비·아이템 / 스킬 / 수호견·동료·좀비 4개 서브탭) 전담 UI 모듈
 */

import { BREEDS, COMPANIONS, DOG_GEAR, SNACKS, SKILLS } from '../../data/catalog.js';
import { getSave } from '../../core/saveStore.js';
import { audioEngine } from '../../core/audioEngine.js';
import { t } from '../../data/i18n.js';
import settingsStore from '../../settingsStore.js';

export const ZOMBIE_COMPENDIUM_DATA = Object.freeze([
  // 15종 일반 및 특수 변이체 좀비
  { id: 'walker', name: '일반 보행 좀비', icon: '🧟', desc: '평범하지만 떼지어 몰려오는 기본 감염자', danger: '★☆☆☆☆', chapter: 1 },
  { id: 'conehead', name: '고깔 좀비', icon: '🪖', desc: '도로용 안전 고깔을 머리에 써 방어력 2배 상승', danger: '★★☆☆☆', chapter: 1 },
  { id: 'runner', name: '질주 좀비', icon: '🏃', desc: '소리에 민첩하게 반응해 빠른 속도로 달려듦', danger: '★★★☆☆', chapter: 2 },
  { id: 'newspaper', name: '신문 좀비', icon: '📰', desc: '신문이 찢어지면 분노하여 폭주 질주하는 좀비', danger: '★★★☆☆', chapter: 2 },
  { id: 'buckethead', name: '양철통 좀비', icon: '🪣', desc: '단단한 양철통으로 머리를 감싼 고방어 돌격병', danger: '★★★☆☆', chapter: 3 },
  { id: 'spitter', name: '산성 침 좀비', icon: '🧪', desc: '원거리에서 위험한 산성 침을 뱉어내는 변종', danger: '★★★☆☆', chapter: 3 },
  { id: 'polevaulter', name: '장대높이뛰기 좀비', icon: '🦯', desc: '긴 장대로 첫 번째 방어선을 뛰어넘는 날렵한 좀비', danger: '★★★☆☆', chapter: 3 },
  { id: 'screendoor', name: '철망 문짝 좀비', icon: '🚪', desc: '방충망 문짝을 방패 삼아 전방 공격을 방어', danger: '★★★★☆', chapter: 4 },
  { id: 'bomber', name: '자폭 폭탄 좀비', icon: '💣', desc: '접근 후 카운트다운과 함께 폭발해 큰 피해를 줌', danger: '★★★★☆', chapter: 4 },
  { id: 'football', name: '미식축구 좀비', icon: '🏈', desc: '엄청난 체력과 빠른 돌진으로 방어선을 파괴', danger: '★★★★☆', chapter: 5 },
  { id: 'dancer', name: '댄서 좀비', icon: '🕺', desc: '리듬에 맞춰 춤추며 백댄서 좀비들을 소환', danger: '★★★★☆', chapter: 5 },
  { id: 'miner', name: '광부 좀비', icon: '⛏️', desc: '땅을 파고 들어가 등 뒤에서 기습 출현', danger: '★★★★☆', chapter: 6 },
  { id: 'ghost', name: '유령 좀비', icon: '👻', desc: '일정 시간 투명화되어 투사체 공격을 회피', danger: '★★★★☆', chapter: 6 },
  { id: 'balloon', name: '풍선 좀비', icon: '🎈', desc: '공중에 떠서 지상 장애물을 넘어 날아옴', danger: '★★★★☆', chapter: 7 },
  { id: 'gargantuar', name: '거대 가르강튀아', icon: '👹', desc: '전봇대를 휘두르고 꼬마 좀비를 던지는 거인', danger: '★★★★★', chapter: 8 },

  // 10개 챕터 보스 군단장
  { id: 'boss_ch1', name: '도심 경비대장 좀비', icon: '👮', desc: '호각을 불며 부하들을 집결시키는 첫 번째 수문장', danger: '★★★★★', chapter: 1, isBoss: true },
  { id: 'boss_ch2', name: '공사장 불도저 좀비', icon: '🚜', desc: '무서운 속도로 돌진하여 모든 것을 밀어붙이는 파괴자', danger: '★★★★★', chapter: 2, isBoss: true },
  { id: 'boss_ch3', name: '독극물 박사 좀비', icon: '👨‍🔬', desc: '바닥에 치명적인 독극물 장판을 깔아 이동을 제한', danger: '★★★★★', chapter: 3, isBoss: true },
  { id: 'boss_ch4', name: '방탄 진압대장 좀비', icon: '🛡️', desc: '거대한 방패로 정면의 모든 공격을 튕겨내는 군단장', danger: '★★★★★', chapter: 4, isBoss: true },
  { id: 'boss_ch5', name: '디스코 킹 좀비', icon: '🪩', desc: '화려한 조명과 함께 폭탄 백댄서를 대규모 소환', danger: '★★★★★', chapter: 5, isBoss: true },
  { id: 'boss_ch6', name: '심연의 강령술사 좀비', icon: '🧙', desc: '죽은 좀비들을 끊임없이 부활시키는 암흑의 술사', danger: '★★★★★', chapter: 6, isBoss: true },
  { id: 'boss_ch7', name: '스팀펑크 비행선 좀비', icon: '🛸', desc: '공중에서 지상으로 폭탄을 비처럼 쏟아붓는 공중 모함', danger: '★★★★★', chapter: 7, isBoss: true },
  { id: 'boss_ch8', name: '거인 군단장 가르강튀아', icon: '🦍', desc: '압도적인 맷집과 파괴력으로 전장을 짓밟는 파괴신', danger: '★★★★★', chapter: 8, isBoss: true },
  { id: 'boss_ch9', name: '사이보그 메카 좀비', icon: '🤖', desc: '기계화된 레이저와 로켓으로 무장한 최첨단 병기', danger: '★★★★★', chapter: 9, isBoss: true },
  { id: 'boss_ch10', name: '좀비 킹 (최종 군주)', icon: '👑', desc: '전 세계의 감염자를 호령하는 바이러스의 근원체', danger: '★★★★★★', chapter: 10, isBoss: true },
]);

export function createCompendiumUI({
  compendiumPanel,
  openModal,
  closeModal,
  onStartBattle,
} = {}) {
  let compendiumSubTab = 'words'; // 'words' | 'gear' | 'skills' | 'characters'
  let hideMeaningMode = false;
  let wordsFilter = 'all'; // 'all' | 'wrong'
  let wordsLevelFilter = 'all'; // 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  let gearSubFilter = 'equipment'; // 'equipment' | 'snacks'
  let selectedGearId = 'basic_harness';
  let selectedSnackId = 'snack_jerky';
  let selectedSkillId = 'bark_sonic';
  let charSubTab = 'breeds'; // 'breeds' | 'companions' | 'zombies'

  function renderCompendiumTab() {
    const compPanel = compendiumPanel || document.getElementById('tab-panel-compendium');
    if (!compPanel) return;

    const save = getSave();
    const profile = (typeof settingsStore !== 'undefined' && settingsStore.getCurrentProfile)
      ? settingsStore.getCurrentProfile()
      : save;
    const lang = (typeof settingsStore !== 'undefined' && settingsStore.get ? settingsStore.get('activeLanguage') : null) || save.studyLang || 'es';
    const maxUnlocked = save.maxUnlockedUnit || 1;

    const care = profile.careSystem || save.careSystem || {};
    const rawLearned = Array.isArray(care.recentLearnedWords) ? care.recentLearnedWords : [];
    const rawWrong = Array.isArray(care.wrongAnswerQueue) ? care.wrongAnswerQueue : [];

    const resolveEntry = (item) => {
      if (!item) return null;
      if (typeof item === 'object' && item.word && item.meaning) return item;
      const wid = typeof item === 'object' ? item.id : item;
      if (typeof window !== 'undefined' && window.CareSentenceBuilder?.findWordEntry) {
        const f = window.CareSentenceBuilder.findWordEntry(wid, lang);
        if (f) return f;
      }
      return { id: wid, word: String(wid), meaning: '해독된 암호', phonetic: '', level: 'A1' };
    };

    let learnedWords = rawLearned.map(resolveEntry).filter(Boolean);
    const allDbWords = (typeof window !== 'undefined' && window.CareSentenceBuilder?.getWordList)
      ? window.CareSentenceBuilder.getWordList(lang)
      : [];

    if (learnedWords.length === 0 && allDbWords.length > 0) {
      learnedWords = allDbWords.slice(0, 20);
    }
    const wrongWords = rawWrong.map(resolveEntry).filter(Boolean);

    // 단어장 난이도/단계 필터 적용
    let currentWords = wordsFilter === 'all' ? learnedWords : wrongWords;
    if (wordsLevelFilter !== 'all') {
      const filtered = currentWords.filter((w) => (w.level || 'A1').toUpperCase() === wordsLevelFilter.toUpperCase());
      if (filtered.length > 0) {
        currentWords = filtered;
      } else if (wordsFilter === 'all' && allDbWords.length > 0) {
        currentWords = allDbWords.filter((w) => (w.level || 'A1').toUpperCase() === wordsLevelFilter.toUpperCase()).slice(0, 30);
      } else {
        currentWords = [];
      }
    }

    const levelFilterOptions = [
      { id: 'all', label: '전체' },
      { id: 'A1', label: '왕초보 (A1)' },
      { id: 'A2', label: '초급 (A2)' },
      { id: 'B1', label: '초중급 (B1)' },
      { id: 'B2', label: '중급 (B2)' },
      { id: 'C1', label: '중고급 (C1)' },
      { id: 'C2', label: '고급 (C2)' },
    ];

    // 선택된 장비/간식/스킬 정보
    const selectedGear = DOG_GEAR.find((g) => g.id === selectedGearId) || DOG_GEAR[0];
    const selectedGearOwned = (save.costumes?.owned || []).includes(selectedGear.id) || maxUnlocked >= (selectedGear.unlockStage || 1);
    const selectedSnack = SNACKS.find((s) => s.id === selectedSnackId) || SNACKS[0];
    const selectedSkill = SKILLS.find((s) => s.id === selectedSkillId) || SKILLS[0];

    compPanel.className = 'p-3 max-w-md mx-auto space-y-3 select-none text-left';
    compPanel.innerHTML = `
      <!-- 상단 헤더 -->
      <div class="rounded-2xl bg-[#faf6ee] border-2 border-emerald-600/30 p-3 shadow-sm flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl leading-none">📖</span>
          <div>
            <h2 class="text-sm font-black text-[#1f2d24]">보카-큐어 서바이벌 대도감</h2>
            <p class="text-[10px] text-[#5c6e60] font-bold">생존 단어·장비·스킬·도감 마스터</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
          해독 ${learnedWords.length}단어
        </span>
      </div>

      <!-- 4개 서브탭 내비게이션 바 -->
      <div class="grid grid-cols-4 gap-1 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-center text-[10.5px] font-black">
        <button id="subtab-comp-words" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'words' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          ${t('compendium.subtabWords') || '🔤 단어장'}
        </button>
        <button id="subtab-comp-gear" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'gear' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          ${t('compendium.subtabGear') || '🦺 장비'}
        </button>
        <button id="subtab-comp-skills" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'skills' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          ${t('compendium.subtabSkills') || '⚡ 스킬'}
        </button>
        <button id="subtab-comp-chars" type="button" class="py-2 px-1 rounded-lg transition active:scale-95 cursor-pointer ${compendiumSubTab === 'characters' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
          ${t('compendium.subtabChars') || '🐾 도감'}
        </button>
      </div>

      <!-- 서브탭 1: 단어장 -->
      ${compendiumSubTab === 'words' ? `
        <div class="space-y-2.5">
          <!-- 난이도/단계 필터 pill (전체 | 왕초보 | 초급 | 초중급 | 중급 | 중고급 | 고급) -->
          <div class="flex items-center gap-1 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-[10.5px] font-black overflow-x-auto no-scrollbar">
            ${levelFilterOptions.map((f) => `
              <button type="button" data-words-level="${f.id}" class="py-1 px-2.5 rounded-lg transition active:scale-95 cursor-pointer whitespace-nowrap text-center ${wordsLevelFilter === f.id ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
                ${f.label}
              </button>
            `).join('')}
          </div>

          <!-- 상태 필터 & 뜻 가리기 버튼 -->
          <div class="flex items-center justify-between gap-1.5 flex-wrap">
            <div class="flex items-center gap-1">
              <button id="btn-words-filter-all" type="button" class="py-1 px-2.5 rounded-full text-xs font-black transition cursor-pointer ${wordsFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-white border border-[#d2c8b4] text-[#4a584e]'}">
                해독 단어 (${learnedWords.length})
              </button>
              <button id="btn-words-filter-wrong" type="button" class="py-1 px-2.5 rounded-full text-xs font-black transition cursor-pointer ${wordsFilter === 'wrong' ? 'bg-rose-600 text-white' : 'bg-white border border-[#d2c8b4] text-[#4a584e]'}">
                ⚠️ 오답 큐 (${wrongWords.length})
              </button>
            </div>
            <button id="btn-toggle-hide-meaning" type="button" class="py-1 px-2.5 rounded-full text-[11px] font-black border transition cursor-pointer flex items-center gap-1 ${hideMeaningMode ? 'bg-amber-600 border-amber-700 text-white shadow-xs' : 'bg-white border-[#d2c8b4] text-[#4a584e] hover:bg-amber-50'}">
              <span>${hideMeaningMode ? '🙈' : '👀'}</span>
              <span>${hideMeaningMode ? (t('compendium.hideMeaningOn') || '뜻 가리기 ON') : (t('compendium.hideMeaningOff') || '뜻 가리기 OFF')}</span>
            </button>
          </div>

          <!-- 오답 복습 모드 배너 -->
          <div class="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-600/15 border border-amber-400/40 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-black text-[#1f2d24] flex items-center gap-1">
                <span>⚔️</span>
                <span>${t('compendium.wrongReviewMode') || '오답 집중 복습 모드'}</span>
              </div>
              <div class="text-[10px] text-[#5c6e60] font-bold mt-0.5">${t('compendium.wrongReviewDesc') || '틀린 단어만 집중 출제하여 정화합니다'}</div>
            </div>
            <button id="btn-start-wrong-review-battle" type="button" class="shrink-0 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-black shadow-md active:scale-95 transition cursor-pointer whitespace-nowrap">
              ${t('compendium.wrongReviewBattle') || '⚔️ 오답 복습 출격'}
            </button>
          </div>

          <!-- 단어 리스트 (좌: 단어(발음)+🔊 우: 한국어 뜻 큼직하게) -->
          <div class="space-y-1.5 max-h-[46vh] overflow-y-auto pr-0.5">
            ${currentWords.length === 0 ? `
              <div class="p-6 text-center text-xs font-bold text-[#5c6e60] bg-[#faf6ee] rounded-2xl border border-[#d2c8b4]">
                ${wordsFilter === 'all' ? '해당 단계의 해독된 단어가 아직 없습니다.' : '🎉 선택한 단계의 오답이 없습니다! 완벽하게 마스터했어요!'}
              </div>
            ` : currentWords.map((w, idx) => {
              const wordLen = (w.word || '').length;
              const wordFontCls = wordLen >= 18
                ? 'text-xs'
                : wordLen >= 12
                  ? 'text-sm'
                  : 'text-sm sm:text-base';

              const meaningLen = (w.meaning || '').length;
              const meaningFontCls = meaningLen >= 18
                ? 'text-[11px]'
                : meaningLen >= 12
                  ? 'text-xs'
                  : 'text-xs sm:text-sm';

              return `
              <div class="p-2.5 rounded-xl bg-[#faf6ee] border border-[#d2c8b4] shadow-2xs flex items-center justify-between gap-2.5 transition hover:border-emerald-300">
                <!-- 좌측: [단어 (발음)] + 바로 옆 작은 스피커 아이콘(🔊) + 레벨 뱃지 -->
                <div class="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  <span class="${wordFontCls} font-black text-[#1f2d24] leading-tight break-keep">${w.word}</span>
                  ${w.phonetic ? `<span class="text-[10px] text-[#5c6e60] font-mono shrink-0">${w.phonetic}</span>` : ''}
                  <button type="button" data-tts-word="${w.word}" class="btn-play-tts shrink-0 w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 flex items-center justify-center text-xs active:scale-90 transition cursor-pointer" title="원어민 발음 듣기">
                    🔊
                  </button>
                  ${w.level ? `<span class="px-1.5 py-0.2 rounded-md bg-[#e6dec8] text-[8.5px] font-black text-[#4a584e] shrink-0">${w.level}</span>` : ''}
                </div>

                <!-- 우측: 한국어 뜻 큼직하고 선명하게 (긴 뜻 줄바꿈 및 글자 잘림 방지) -->
                <div class="shrink-0 max-w-[55%] text-right">
                  ${hideMeaningMode ? `
                    <span data-masked-meaning="${idx}" class="inline-block text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-100 px-2.5 py-0.5 rounded-lg cursor-pointer select-none transition" title="터치하여 뜻 보기">
                      ${t('compendium.showMeaning') || '🙈 뜻 보기'}
                    </span>
                    <span data-revealed-meaning="${idx}" class="hidden ${meaningFontCls} font-black text-emerald-800 leading-tight break-keep">
                      ${w.meaning}
                    </span>
                  ` : `
                    <div class="${meaningFontCls} font-black text-emerald-800 leading-tight break-keep">${w.meaning}</div>
                  `}
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- 서브탭 2: 장비·아이템 (수호견 장비 vs 간식 분리 & 4열 그리드) -->
      ${compendiumSubTab === 'gear' ? `
        <div class="space-y-3">
          <!-- 상단 서브 필터 -->
          <div class="grid grid-cols-2 gap-1.5 p-1 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-center text-xs font-black">
            <button id="btn-gear-filter-equipment" type="button" class="py-2 rounded-lg transition active:scale-95 cursor-pointer ${gearSubFilter === 'equipment' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🦺 수호견 장비
            </button>
            <button id="btn-gear-filter-snacks" type="button" class="py-2 rounded-lg transition active:scale-95 cursor-pointer ${gearSubFilter === 'snacks' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🍖 간식·돌봄 아이템
            </button>
          </div>

          ${gearSubFilter === 'equipment' ? `
            <!-- 수호견 장비 4열 정사각형 아이콘 타일 -->
            <div class="grid grid-cols-4 gap-2">
              ${(DOG_GEAR || []).map((g) => {
                const isOwned = (save.costumes?.owned || []).includes(g.id) || maxUnlocked >= (g.unlockStage || 1);
                const isSelected = selectedGearId === g.id;
                const rarityBorder = g.rarity === 'epic' ? 'border-purple-400' : g.rarity === 'rare' ? 'border-sky-400' : 'border-emerald-600/60';
                return `
                  <button
                    type="button"
                    data-gear-select="${g.id}"
                    class="aspect-square p-1.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition active:scale-95 cursor-pointer relative ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs'
                        : isOwned
                        ? 'bg-[#faf6ee] ' + rarityBorder + ' hover:bg-[#f3ede0]'
                        : 'bg-stone-100 border-stone-300 opacity-55'
                    }"
                    title="${isOwned ? g.name : `STAGE ${g.unlockStage || 1} 해금`}"
                  >
                    <span class="text-2xl my-0.5 ${isOwned ? '' : 'filter brightness-0 opacity-20 select-none'}">${isOwned ? g.icon : '🔒'}</span>
                    <span class="text-[9.5px] font-black ${isOwned ? 'text-[#1f2d24]' : 'text-stone-400'} truncate w-full">${isOwned ? g.name : '???'}</span>
                    ${isSelected ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600"></span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- 하단 장비 상세 정보 카드 -->
            <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-3xl ${selectedGearOwned ? '' : 'filter brightness-0 opacity-20 select-none'}">${selectedGearOwned ? selectedGear.icon : '🔒'}</span>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-black text-[#1f2d24]">${selectedGearOwned ? selectedGear.name : '??? (미해금 장비)'}</span>
                      <span class="px-1.5 py-0.2 rounded bg-[#e6dec8] text-[#4a584e] font-black text-[9px] uppercase">${selectedGear.slot}</span>
                      ${selectedGear.rarity ? `<span class="px-1.5 py-0.2 rounded text-white font-black text-[8.5px] ${selectedGear.rarity === 'epic' ? 'bg-purple-600' : selectedGear.rarity === 'rare' ? 'bg-sky-600' : 'bg-emerald-700'}">${selectedGear.rarity}</span>` : ''}
                    </div>
                    <div class="text-[10px] font-bold text-emerald-800 mt-0.5">
                      ${selectedGearOwned ? `⚔️ 공격력 +${selectedGear.atkBonus} · ❤️ 체력 +${selectedGear.hpBonus}` : '🔒 능력치 잠김'}
                    </div>
                  </div>
                </div>
                <div class="text-[10px] font-black ${selectedGearOwned ? 'text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full' : 'text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full'}">
                  ${selectedGearOwned ? '해금 완료' : `St.${selectedGear.unlockStage || 1} 해금`}
                </div>
              </div>
              <p class="text-xs text-[#5c6e60] font-medium leading-relaxed pt-1 border-t border-[#e6dec8]">
                ${selectedGearOwned ? selectedGear.desc : `STAGE ${selectedGear.unlockStage || 1} 스테이지를 클리어하면 자동으로 도감에 해금됩니다.`}
              </p>
            </div>
          ` : `
            <!-- 간식·돌봄 아이템 4열 정사각형 그리드 -->
            <div class="grid grid-cols-4 gap-2">
              ${(SNACKS || []).map((snk) => {
                const isSelected = selectedSnackId === snk.id;
                return `
                  <button
                    type="button"
                    data-snack-select="${snk.id}"
                    class="aspect-square p-1.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition active:scale-95 cursor-pointer relative ${
                      isSelected
                        ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/40 shadow-xs'
                        : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
                    }"
                  >
                    <span class="text-2xl my-0.5">${snk.icon}</span>
                    <span class="text-[9.5px] font-black text-[#1f2d24] truncate w-full">${snk.name}</span>
                    ${isSelected ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-600"></span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- 하단 간식 상세 정보 카드 -->
            <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-3xl">${selectedSnack.icon}</span>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-black text-[#1f2d24]">${selectedSnack.name}</span>
                      <span class="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px]">회복 간식</span>
                    </div>
                    <div class="text-[10px] font-bold text-emerald-800 mt-0.5">
                      ❤️ 체력 회복 +${selectedSnack.healHp}
                    </div>
                  </div>
                </div>
                <span class="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">상시 사용</span>
              </div>
              <p class="text-xs text-[#5c6e60] font-medium leading-relaxed pt-1 border-t border-[#e6dec8]">
                ${selectedSnack.desc}
              </p>
            </div>
          `}
        </div>
      ` : ''}

      <!-- 서브탭 3: 스킬 (4열 아이콘 백과사전 & 상세 스펙 카드) -->
      ${compendiumSubTab === 'skills' ? `
        <div class="space-y-3">
          <div class="text-xs font-black text-[#1f2d24] px-1 flex items-center justify-between">
            <span class="flex items-center gap-1"><span>🗣️</span><span>수호견 야생 스킬 & 각성 백과</span></span>
            <span class="text-[10px] text-[#5c6e60]">아이콘 터치하여 상세 스펙 확인</span>
          </div>

          <!-- 4열 아이콘 타일 그리드 -->
          <div class="grid grid-cols-4 gap-2">
            ${(SKILLS || []).map((sk) => {
              const isSelected = selectedSkillId === sk.id;
              return `
                <button
                  type="button"
                  data-skill-select="${sk.id}"
                  class="aspect-square p-1.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition active:scale-95 cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 shadow-xs'
                      : 'bg-[#faf6ee] border-[#d2c8b4] hover:bg-[#f3ede0]'
                  }"
                >
                  <span class="text-2xl my-0.5">${sk.icon}</span>
                  <span class="text-[9.5px] font-black text-[#1f2d24] truncate w-full">${sk.name}</span>
                  ${sk.awakenedName ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-amber-600 animate-pulse" title="각성 진화 가능"></span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <!-- 선택된 스킬 상세 스펙 카드 -->
          <div class="p-3.5 rounded-2xl bg-[#faf6ee] border border-[#d2c8b4] shadow-sm space-y-2">
            <div class="flex items-start justify-between gap-2 border-b border-[#e6dec8] pb-2">
              <div class="flex items-center gap-2">
                <span class="text-3xl">${selectedSkill.icon}</span>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm font-black text-[#1f2d24]">${selectedSkill.name}</span>
                    ${selectedSkill.awakenedName ? `<span class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-extrabold">각성: ${selectedSkill.awakenedName}</span>` : ''}
                  </div>
                  <div class="text-[9.5px] text-[#5c6e60] font-bold mt-0.5">기본 야생 스킬 (최대 Lv.${selectedSkill.maxLevel || 5})</div>
                </div>
              </div>
              <div class="text-right text-[10px] font-extrabold text-emerald-800 shrink-0">
                <div>⏱️ 쿨 ${selectedSkill.cooldown || 1}s</div>
                <div>⚔️ 위력 x${selectedSkill.baseDamageMult || 1.0}</div>
              </div>
            </div>

            <div class="text-xs text-[#4a584e] font-medium leading-relaxed">
              ${selectedSkill.desc}
            </div>

            ${selectedSkill.awakenedDesc ? `
              <div class="p-2.5 rounded-xl bg-gradient-to-r from-amber-100/70 via-amber-50 to-emerald-50 border border-amber-300 space-y-1">
                <div class="text-[11px] font-black text-amber-900 flex items-center justify-between">
                  <span class="flex items-center gap-1"><span>✨</span><span>각성 진화: ${selectedSkill.awakenedName}</span></span>
                  <span class="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-200/80 font-black">Lv.5 초월</span>
                </div>
                <p class="text-[10px] text-amber-950 font-medium leading-snug">${selectedSkill.awakenedDesc}</p>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- 서브탭 4: 수호견·동료·좀비 (통합 3~4열 그리드 백과) -->
      ${compendiumSubTab === 'characters' ? `
        <div class="space-y-2.5">
          <div class="grid grid-cols-3 gap-1 p-0.5 bg-[#f0ebe0] border border-[#d2c8b4] rounded-xl text-center text-[10.5px] font-black">
            <button id="btn-char-subtab-breeds" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'breeds' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🐶 수호견 (12종)
            </button>
            <button id="btn-char-subtab-companions" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'companions' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🎺 브레멘 동료 (12종)
            </button>
            <button id="btn-char-subtab-zombies" type="button" class="py-1.5 rounded-lg transition active:scale-95 cursor-pointer ${charSubTab === 'zombies' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#4a584e] hover:bg-[#e4ddcc]'}">
              🧟 좀비 & 보스
            </button>
          </div>

          ${charSubTab === 'breeds' ? `
            <!-- 3~4열 수호견 카드 그리드 -->
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto pr-0.5">
              ${(BREEDS || []).map((b) => {
                const isUnlocked = (save.unlockedBreeds || []).includes(b.id) || (b.id === (save.selectedBreed || 'pomeranian'));
                return `
                  <div class="p-2 rounded-2xl border flex flex-col items-center justify-between text-center select-none ${
                    isUnlocked ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'
                  }">
                    <span class="text-3xl my-1 ${isUnlocked ? '' : 'filter brightness-0 opacity-20 select-none'}">${isUnlocked ? (b.icon || '🐕') : '🐕'}</span>
                    <div class="w-full">
                      <div class="text-xs font-black ${isUnlocked ? 'text-[#1f2d24]' : 'text-stone-400'} truncate">${isUnlocked ? b.name : '???'}</div>
                      <div class="text-[9px] text-[#5c6e60] font-bold mt-0.5 truncate">${isUnlocked ? (b.subName || '') : '미해금'}</div>
                    </div>
                    <div class="text-[8.5px] font-black ${isUnlocked ? 'text-emerald-800' : 'text-stone-500'} mt-1 truncate w-full">
                      ${isUnlocked ? b.trait : `🔒 St.${b.unlockStage || 1} 구조`}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          ${charSubTab === 'companions' ? `
            <!-- 3~4열 브레멘 동료 그리드 (지상/공중 통합) -->
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto pr-0.5">
              ${(COMPANIONS || []).map((c) => {
                const isUnlocked = (save.companions?.unlocked || []).includes(c.id) || maxUnlocked >= (c.unlockStage || 1);
                const isGround = c.mountType === 'ground' || (!c.mountType && c.role && !c.role.includes('음파'));
                return `
                  <div class="p-2 rounded-2xl border flex flex-col items-center justify-between text-center select-none ${
                    isUnlocked ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-xs' : 'bg-stone-100 border-stone-200 opacity-60'
                  }">
                    <span class="text-3xl my-1 ${isUnlocked ? '' : 'filter brightness-0 opacity-20 select-none'}">${isUnlocked ? c.icon : '🐾'}</span>
                    <div class="w-full">
                      <div class="text-xs font-black ${isUnlocked ? 'text-[#1f2d24]' : 'text-stone-400'} truncate">${isUnlocked ? c.name : '???'}</div>
                      <div class="text-[9px] ${isGround ? 'text-amber-800' : 'text-emerald-800'} font-bold mt-0.5 truncate">${isGround ? '등 탑승' : '어깨/공중'}</div>
                    </div>
                    <div class="text-[8.5px] font-black ${isUnlocked ? 'text-emerald-800' : 'text-stone-500'} mt-1 truncate w-full">
                      ${isUnlocked ? (c.buffText || c.role || '') : `🔒 St.${c.unlockStage || 1} 영입`}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          ${charSubTab === 'zombies' ? `
            <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-0.5">
              ${ZOMBIE_COMPENDIUM_DATA.map((zb) => {
                const encounteredList = Array.isArray(save.encounteredEnemies) ? save.encounteredEnemies : [];
                const isEncountered = encounteredList.includes(zb.id);
                return `
                  <div class="p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isEncountered
                      ? 'bg-[#faf6ee] border-[#d2c8b4] shadow-2xs'
                      : 'bg-stone-100/70 border-stone-200 opacity-60'
                  }">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-9 h-9 rounded-lg ${isEncountered ? 'bg-[#efe9dc]' : 'bg-stone-200'} flex items-center justify-center shrink-0 shadow-inner">
                        <span class="text-2xl ${isEncountered ? '' : 'filter brightness-0 opacity-25 select-none'}">${isEncountered ? zb.icon : '🧟'}</span>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-xs font-black ${isEncountered ? 'text-[#1f2d24]' : 'text-stone-500'} truncate">
                            ${isEncountered ? zb.name : `??? (CH.${zb.chapter} 미확인 ${zb.isBoss ? '보스' : '변이체'})`}
                          </span>
                          ${zb.isBoss ? `<span class="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[8px] font-black shrink-0">BOSS</span>` : ''}
                        </div>
                        <div class="text-[10px] ${isEncountered ? 'text-[#5c6e60]' : 'text-stone-400 italic'} font-medium truncate mt-0.5">
                          ${isEncountered ? zb.desc : '전투에서 조우하여 생체 데이터를 수집하세요.'}
                        </div>
                      </div>
                    </div>
                    <div class="flex flex-col items-end shrink-0">
                      <span class="text-[10px] font-bold ${isEncountered ? 'text-rose-700' : 'text-stone-400'} whitespace-nowrap">
                        ${isEncountered ? zb.danger : '🔒 ???'}
                      </span>
                      <span class="text-[8.5px] font-bold ${isEncountered ? 'text-[#8a998d]' : 'text-stone-400'}">CH.${zb.chapter}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    // ----------------------------------------------------
    // 이벤트 바인딩
    // ----------------------------------------------------
    document.getElementById('subtab-comp-words')?.addEventListener('click', () => {
      compendiumSubTab = 'words';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-gear')?.addEventListener('click', () => {
      compendiumSubTab = 'gear';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-skills')?.addEventListener('click', () => {
      compendiumSubTab = 'skills';
      renderCompendiumTab();
    });
    document.getElementById('subtab-comp-chars')?.addEventListener('click', () => {
      compendiumSubTab = 'characters';
      renderCompendiumTab();
    });

    // 단어장 단계 필터
    compPanel.querySelectorAll('[data-words-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        wordsLevelFilter = btn.getAttribute('data-words-level') || 'all';
        renderCompendiumTab();
      });
    });

    document.getElementById('btn-words-filter-all')?.addEventListener('click', () => {
      wordsFilter = 'all';
      renderCompendiumTab();
    });
    document.getElementById('btn-words-filter-wrong')?.addEventListener('click', () => {
      wordsFilter = 'wrong';
      renderCompendiumTab();
    });

    document.getElementById('btn-toggle-hide-meaning')?.addEventListener('click', () => {
      hideMeaningMode = !hideMeaningMode;
      renderCompendiumTab();
    });

    // 장비 탭 서브 필터 및 타일 선택
    document.getElementById('btn-gear-filter-equipment')?.addEventListener('click', () => {
      gearSubFilter = 'equipment';
      renderCompendiumTab();
    });
    document.getElementById('btn-gear-filter-snacks')?.addEventListener('click', () => {
      gearSubFilter = 'snacks';
      renderCompendiumTab();
    });

    compPanel.querySelectorAll('[data-gear-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedGearId = btn.getAttribute('data-gear-select') || selectedGearId;
        audioEngine.playCaptureTick?.();
        renderCompendiumTab();
      });
    });

    compPanel.querySelectorAll('[data-snack-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSnackId = btn.getAttribute('data-snack-select') || selectedSnackId;
        audioEngine.playCaptureTick?.();
        renderCompendiumTab();
      });
    });

    // 스킬 탭 타일 선택
    compPanel.querySelectorAll('[data-skill-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSkillId = btn.getAttribute('data-skill-select') || selectedSkillId;
        audioEngine.playCaptureTick?.();
        renderCompendiumTab();
      });
    });

    // 캐릭터 서브탭
    document.getElementById('btn-char-subtab-breeds')?.addEventListener('click', () => {
      charSubTab = 'breeds';
      renderCompendiumTab();
    });
    document.getElementById('btn-char-subtab-companions')?.addEventListener('click', () => {
      charSubTab = 'companions';
      renderCompendiumTab();
    });
    document.getElementById('btn-char-subtab-zombies')?.addEventListener('click', () => {
      charSubTab = 'zombies';
      renderCompendiumTab();
    });

    document.getElementById('btn-start-wrong-review-battle')?.addEventListener('click', () => {
      if (wrongWords.length === 0) {
        audioEngine.playCaptureTick?.();
        openModal(`
          <div class="text-center py-4 space-y-3">
            <div class="text-3xl">🎉</div>
            <h3 class="text-base font-black text-[#1f2d24]">오답 큐가 비어있습니다!</h3>
            <p class="text-xs text-[#5c6e60] font-bold leading-relaxed">
              모든 단어를 완벽하게 마스터하셨습니다. 일반 출격에서 새로운 단어에 도전해 보세요!
            </p>
            <div class="pt-2">
              <button id="btn-close-review-empty" type="button" class="w-full py-2.5 rounded-xl bg-[#2d6a4f] text-white font-black text-xs cursor-pointer">
                확인
              </button>
            </div>
          </div>
        `);
        document.getElementById('btn-close-review-empty')?.addEventListener('click', closeModal);
        return;
      }

      closeModal();
      onStartBattle?.({
        chapterNumber: 1,
        courseId: save.selectedCourse || 'lv1',
        unitId: save.selectedUnit || 'unit_001',
        isReview: true,
        targetUnitNum: 1,
      });
    });

    compPanel.querySelectorAll('[data-masked-meaning]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = el.getAttribute('data-masked-meaning');
        el.classList.add('hidden');
        const rev = compPanel.querySelector(`[data-revealed-meaning="${idx}"]`);
        if (rev) rev.classList.remove('hidden');
      });
    });

    compPanel.querySelectorAll('.btn-play-tts').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wordText = btn.getAttribute('data-tts-word');
        if (wordText && typeof audioEngine.speakWordOnce === 'function') {
          audioEngine.speakWordOnce(wordText, null, lang);
        }
      });
    });
  }

  return {
    renderCompendiumTab,
  };
}
