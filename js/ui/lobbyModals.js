/**
 * js/ui/lobbyModals.js
 * 로비 전용 팝업 모달 통합 허브 (Facade)
 * 기존 외부 import와의 100% 하위 호환성을 보장하며 성격별 분리 모듈을 re-export합니다.
 *
 * 분리 모듈 구조:
 * - modals/onboardingModals.js : 최초 언어 선택, 강아지 입양, 레벨 선택, 온보딩 투어
 * - modals/profileModals.js    : 프로필, 이름 수정, CEFR 등급 심사, 환경 설정, 코스 설정
 * - modals/rewardModals.js     : 퀘스트, 일일 보급품, 30일 출석부, 공지사항
 */

export {
  openInitialStudyLangModal,
  openStarterAdoptionModal,
  openWordLevelSelectModal,
  createLobbyOnboardingTour,
} from './modals/onboardingModals.js';

export {
  openProfileModal,
  openEditDogNameModal,
  openSettingsModal,
  openCefrModal,
} from './modals/profileModals.js';

export {
  openQuestsModal,
  openAirDropSupplyModal,
  openAttendance30Modal,
  openNoticeModal,
} from './modals/rewardModals.js';

import {
  openInitialStudyLangModal,
  openStarterAdoptionModal,
  openWordLevelSelectModal,
  createLobbyOnboardingTour,
} from './modals/onboardingModals.js';

import {
  openProfileModal,
  openEditDogNameModal,
  openSettingsModal,
  openCefrModal,
} from './modals/profileModals.js';

import {
  openQuestsModal,
  openAirDropSupplyModal,
  openAttendance30Modal,
  openNoticeModal,
} from './modals/rewardModals.js';

export function createLobbyModals(ctx) {
  return {
    openEditDogNameModal: (options) => openEditDogNameModal(ctx, options),
    openQuestsModal: (activeSubtab) => openQuestsModal(ctx, activeSubtab),
    openAirDropSupplyModal: () => openAirDropSupplyModal(ctx),
    openCefrModal: () => openCefrModal(ctx),
    openAttendance30Modal: () => openAttendance30Modal(ctx),
    openNoticeModal: () => openNoticeModal(ctx),
    openProfileModal: () => openProfileModal(ctx),
    openSettingsModal: () => openSettingsModal(ctx),
    openInitialStudyLangModal: (options) => openInitialStudyLangModal(ctx, options),
    openStarterAdoptionModal: (options) => openStarterAdoptionModal(ctx, options),
    openWordLevelSelectModal: (options) => openWordLevelSelectModal(ctx, options),
    createLobbyOnboardingTour: (tourCtx) => createLobbyOnboardingTour({ ...ctx, ...tourCtx }),
  };
}
