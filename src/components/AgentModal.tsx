"use client";

import { useState } from "react";
import { EventRecord } from "@/db";
import { useLanguage, Language } from "@/lib/i18n";

interface Props {
  event: EventRecord;
  meetUrl: string;
  submitUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function generateAgentBundle(
  event: EventRecord,
  meetUrl: string,
  submitUrl: string,
  lang: Language = "ko"
): string {
  const sampleStart = `${event.start_date}T${event.start_time}:00`;
  const sampleEnd = `${event.start_date}T${
    String(Number(event.start_time.split(":")[0]) + Math.ceil(event.duration_minutes / 60)).padStart(2, "0")
  }:${event.start_time.split(":")[1]}:00`;

  if (lang === "ko") {
    return `# AI 비서 일정 등록 지침: ${event.title}

내 캘린더 일정을 확인하고 아래 모임에 내 가능한 시간을 등록해주세요.

### 1. 모임 정보
- 제목: ${event.title}
- 모임 URL: ${meetUrl}
- 제출 엔드포인트: ${submitUrl}
- 소요 시간: ${event.duration_minutes}분
- 모임 기간: ${event.start_date} ~ ${event.end_date} (매일 ${event.start_time} - ${event.end_time})
- 기준 타임존: ${event.organizer_timezone}

### 2. 이름 및 사용자 확인 규칙
- **실명 등록 필수**: 반드시 사용자의 실제 실명(예: "김철수", "Sarah Kim")을 사용해야 합니다. 사용자 이름을 모를 경우 **"어떤 이름으로 일정을 등록해 드릴까요?"**라고 사용자에게 물어본 뒤 제출하세요. **절대 'AI Assistant' 같은 임의의 기본값을 사용하지 마세요.**

### 3. 캘린더 추출 및 이동 버퍼 규칙
1. **완전히 빈 시간대**: \`weight: 1.0\` (선호/가능)
2. **이동 및 준비 버퍼 (30분)**:
   - 내 기존 일정의 직전 30분과 직후 30분 구간은 이동 및 전후 준비 시간을 위해 \`weight: 0.5\` (조율 가능/버퍼)로 등록하세요.
   - 유동적인 내부 회의도 \`weight: 0.5\`로 지정하세요.
3. **충돌 시간대 (기존 확정 일정)**: 슬롯에서 제외 (또는 \`weight: 0.0\`)

### 4. 제출 API 호출 (HTTP POST)
아래 형식으로 \`${submitUrl}\`에 POST 요청을 전송하세요:

\`\`\`json
{
  "user_name": "<사용자 실명 입력 (모를 경우 질문할 것)>",
  "timezone": "${event.organizer_timezone}",
  "slots": [
    {
      "start": "${sampleStart}+09:00",
      "end": "${sampleEnd}+09:00",
      "weight": 1.0
    }
  ],
  "notes": "기존 일정 전후 30분 이동 버퍼(0.5) 포함"
}
\`\`\`
*(가중치 안내: 1.0 = 선호/완전가능, 0.5 = 이동버퍼/조율가능, 0.0 = 불가능)*`;
  }

  return `# AI Assistant Instructions: ${event.title}

Please check my calendar and submit my availability for this meeting.

### 1. Meeting Details
- Title: ${event.title}
- Meeting URL: ${meetUrl}
- Submit Endpoint: ${submitUrl}
- Duration: ${event.duration_minutes} minutes
- Date Range: ${event.start_date} ~ ${event.end_date} (Daily: ${event.start_time} - ${event.end_time})
- Timezone: ${event.organizer_timezone}

### 2. Name & Identity Rule
- **User Name Requirement**: You MUST use the user's actual real human name (e.g. "Sarah Kim", "Alex Park"). If you do not know the user's name, **explicitly ask the user: "What name should I register your availability under?"** before submitting. **NEVER use generic placeholders like "AI Assistant" or "User".**

### 3. Calendar Extraction & Buffer Rules
1. **Completely Free Blocks**: Mark with \`weight: 1.0\` (Preferred).
2. **Travel & Prep Buffer (Moderate)**:
   - For 30 minutes immediately **BEFORE** and **AFTER** any existing calendar event, mark with \`weight: 0.5\` (Moderate / Travel buffer) to prevent back-to-back transit rush.
   - Also mark soft or movable meetings with \`weight: 0.5\`.
3. **Hard Conflicts (Busy Events)**: Do not include in slots (or set \`weight: 0.0\`).

### 4. Submission Action
Submit availability via HTTP POST to \`${submitUrl}\`:

\`\`\`json
{
  "user_name": "<User's Real Name - ask user if unknown, do NOT use 'AI Assistant'>",
  "timezone": "${event.organizer_timezone}",
  "slots": [
    {
      "start": "${sampleStart}+09:00",
      "end": "${sampleEnd}+09:00",
      "weight": 1.0
    }
  ],
  "notes": "Includes 30m travel/prep buffer (0.5) around existing meetings"
}
\`\`\`
*(Weight: 1.0 = preferred, 0.5 = moderate/buffer, 0.0 = busy)*`;
}

export default function AgentModal({ event, meetUrl, submitUrl, isOpen, onClose }: Props) {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fullBundle = generateAgentBundle(event, meetUrl, submitUrl, lang);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullBundle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{t.agentModalTitle}</h3>
            <p className="text-[11px] text-zinc-400">{t.agentModalDesc}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
        >
          {copied ? t.agentModalCopied : t.agentModalCopyBtn}
        </button>

        <pre className="flex-1 bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {fullBundle}
        </pre>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-md transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
