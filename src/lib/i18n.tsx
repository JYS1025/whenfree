"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "ko" | "en";

export interface Translations {
  // Nav
  newPoll: string;
  llmsTxt: string;
  openapi: string;

  // Home
  platformBadge: string;
  homeTitle: string;
  homeDesc: string;
  meetingTopic: string;
  meetingTopicPlaceholder: string;
  duration: string;
  startDate: string;
  endDate: string;
  earliestTime: string;
  latestTime: string;
  timezone: string;
  createButton: string;
  creatingButton: string;
  demoLink: string;

  // Meet Header
  attendeesCount: (count: number) => string;
  durationMins: (mins: number) => string;
  shareLink: string;
  linkCopied: string;

  // AI Hero Card
  aiHeroBadge: string;
  aiHeroTitle: string;
  aiHeroDesc: string;
  aiPreviewLink: string;
  aiCopyButton: string;
  aiCopiedSuccess: string;

  // Top Recommendation
  optimalTime: string;
  matchScore: (pct: number) => string;
  googleCal: string;
  downloadIcs: string;
  otherOptions: string;

  // Grid - Left (Manual)
  manualTitle: string;
  manualSubtitle: string;
  slotsMarked: (count: number) => string;
  nameLabel: string;
  namePlaceholder: string;
  selectAll: string;
  clearAll: string;
  brushLabel: string;
  brushAvailable: string;
  brushFlexible: string;
  brushClear: string;
  saveButton: string;
  savingButton: string;
  savedSuccess: string;
  timeCol: string;

  // Grid - Right (Group)
  groupTitle: string;
  groupSubtitle: string;
  hoverPrompt: string;
  availableCount: (avail: number, total: number) => string;
  participantsTitle: (count: number) => string;
  resetFilter: string;
  noParticipants: string;

  // Agent Modal
  agentModalTitle: string;
  agentModalDesc: string;
  agentModalCopyBtn: string;
  agentModalCopied: string;
  close: string;
}

const translations: Record<Language, Translations> = {
  ko: {
    // Nav
    newPoll: "+ 새 모임 만들기",
    llmsTxt: "/llms.txt",
    openapi: "OpenAPI",

    // Home
    platformBadge: "AI-Native Scheduling Platform",
    homeTitle: "새로운 모임 일정 잡기",
    homeDesc: "시간표를 일일이 칠하지 마세요. 생성된 링크를 AI 비서(ChatGPT/Claude)에게 넘기면 캘린더를 확인하고 일정을 등록해 줍니다.",
    meetingTopic: "모임 주제 / 제목",
    meetingTopicPlaceholder: "예: 프로젝트 리뷰, 팀 주간 싱크",
    duration: "예상 소요 시간",
    startDate: "시작 날짜",
    endDate: "종료 날짜",
    earliestTime: "일일 시작 시간",
    latestTime: "일일 종료 시간",
    timezone: "기준 타임존",
    createButton: "모임 생성하기",
    creatingButton: "생성 중...",
    demoLink: "또는 미리 입력된 샘플 데모 모임 확인하기 →",

    // Meet Header
    attendeesCount: (c) => `${c}명 참여 중`,
    durationMins: (m) => `${m}분 소요`,
    shareLink: "🔗 링크 공유",
    linkCopied: "✓ 링크 복사됨",

    // AI Hero Card
    aiHeroBadge: "Recommended",
    aiHeroTitle: "🤖 AI 비서에게 내 캘린더 일정 등록 시키기",
    aiHeroDesc: "시간표를 일일이 확인할 필요 없이, 아래 버튼을 눌러 복사된 프롬프트를 ChatGPT나 Claude에 붙여넣으세요. 내 캘린더를 확인하고 이동 버퍼(30분)까지 계산해 자동으로 등록해 줍니다.",
    aiPreviewLink: "프롬프트 미리보기 →",
    aiCopyButton: "📋 AI 프롬프트 복사하기 (클릭 후 ChatGPT / Claude에 붙여넣기)",
    aiCopiedSuccess: "✓ AI 프롬프트가 복사되었습니다! ChatGPT / Claude 채팅창에 붙여넣으세요 (Ctrl+V)",

    // Top Recommendation
    optimalTime: "가장 추천하는 시간",
    matchScore: (pct) => `${pct}% 가능`,
    googleCal: "Google Calendar",
    downloadIcs: ".ics 다운로드",
    otherOptions: "다른 추천 시간:",

    // Grid - Left (Manual)
    manualTitle: "직접 시간 칠하기",
    manualSubtitle: "AI 대신 직접 등록하려면, 이름을 입력하고 마우스로 드래그하세요.",
    slotsMarked: (c) => `${c}칸 선택됨`,
    nameLabel: "이름:",
    namePlaceholder: "이름 입력 (예: 홍길동)",
    selectAll: "전체선택",
    clearAll: "지우기",
    brushLabel: "브러시:",
    brushAvailable: "● 가능",
    brushFlexible: "▲ 조율가능",
    brushClear: "✕ 지우개",
    saveButton: "내 가능 시간 저장하기",
    savingButton: "저장 중...",
    savedSuccess: "✓ 일정이 성공적으로 저장되었습니다!",
    timeCol: "시간",

    // Grid - Right (Group)
    groupTitle: "모두의 현황",
    groupSubtitle: "시간표 위에 마우스를 올리면 가능한 사람이 표시됩니다.",
    hoverPrompt: "마우스를 시간표 칸 위로 올려보세요.",
    availableCount: (avail, total) => `${avail}/${total}명 가능`,
    participantsTitle: (c) => `참여자 목록 (${c}명) - 클릭 시 개별 일정 확인/수정`,
    resetFilter: "전체보기로 복원",
    noParticipants: "아직 제출한 참여자가 없습니다.",

    // Agent Modal
    agentModalTitle: "AI 비서 위임 프롬프트 & 스키마",
    agentModalDesc: "복사하여 ChatGPT, Claude 또는 커스텀 에이전트에 그대로 전달하세요",
    agentModalCopyBtn: "지침 프롬프트 전체 복사",
    agentModalCopied: "클립보드에 복사 완료!",
    close: "닫기",
  },
  en: {
    // Nav
    newPoll: "+ New Poll",
    llmsTxt: "/llms.txt",
    openapi: "OpenAPI",

    // Home
    platformBadge: "AI-Native Scheduling Platform",
    homeTitle: "Create a Scheduling Poll",
    homeDesc: "No need to manually paint time grids. Share the link with your AI assistant (ChatGPT/Claude) to check your calendar and submit availability automatically.",
    meetingTopic: "Meeting Topic / Title",
    meetingTopicPlaceholder: "e.g. Project Review, Sprint Sync",
    duration: "Meeting Duration",
    startDate: "Start Date",
    endDate: "End Date",
    earliestTime: "Daily Start Time",
    latestTime: "Daily End Time",
    timezone: "Timezone",
    createButton: "Create Meeting Poll",
    creatingButton: "Creating...",
    demoLink: "Or view a pre-filled demo poll →",

    // Meet Header
    attendeesCount: (c) => `${c} responded`,
    durationMins: (m) => `${m} mins`,
    shareLink: "🔗 Share Link",
    linkCopied: "✓ Link Copied",

    // AI Hero Card
    aiHeroBadge: "Recommended",
    aiHeroTitle: "🤖 Delegate Calendar Scheduling to AI Assistant",
    aiHeroDesc: "Skip manual grid painting. Click below to copy the prompt, paste it into ChatGPT or Claude, and let AI read your calendar with 30m travel buffers and submit automatically.",
    aiPreviewLink: "Preview Prompt →",
    aiCopyButton: "📋 Copy AI Prompt (Paste into ChatGPT / Claude)",
    aiCopiedSuccess: "✓ Copied! Paste directly into ChatGPT or Claude chat (Ctrl+V)",

    // Top Recommendation
    optimalTime: "Optimal Consensus Time",
    matchScore: (pct) => `${pct}% match`,
    googleCal: "Google Calendar",
    downloadIcs: "Download .ics",
    otherOptions: "Other options:",

    // Grid - Left (Manual)
    manualTitle: "Manual Availability Painting",
    manualSubtitle: "To schedule manually without AI, enter your name and drag on the grid.",
    slotsMarked: (c) => `${c} slots selected`,
    nameLabel: "Name:",
    namePlaceholder: "Enter your name (e.g. Alex)",
    selectAll: "Select All",
    clearAll: "Clear",
    brushLabel: "Brush:",
    brushAvailable: "● Available",
    brushFlexible: "▲ Flexible",
    brushClear: "✕ Clear",
    saveButton: "Save My Availability",
    savingButton: "Saving...",
    savedSuccess: "✓ Availability saved successfully!",
    timeCol: "Time",

    // Grid - Right (Group)
    groupTitle: "Group Availability",
    groupSubtitle: "Hover over the grid to view attendee breakdowns in real time.",
    hoverPrompt: "Hover over any time slot to see attendee availability.",
    availableCount: (avail, total) => `${avail}/${total} available`,
    participantsTitle: (c) => `Participants (${c}) - Click to inspect / edit`,
    resetFilter: "Reset Filter",
    noParticipants: "No responses submitted yet.",

    // Agent Modal
    agentModalTitle: "AI Assistant Handover Prompt & Schema",
    agentModalDesc: "Copy and paste directly into ChatGPT, Claude, or custom agents",
    agentModalCopyBtn: "Copy Instructions Bundle",
    agentModalCopied: "Copied to Clipboard!",
    close: "Close",
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ko",
  setLang: () => {},
  t: translations.ko,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ko");

  useEffect(() => {
    const saved = localStorage.getItem("syncfree_lang") as Language | null;
    if (saved === "ko" || saved === "en") {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("syncfree_lang", newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
