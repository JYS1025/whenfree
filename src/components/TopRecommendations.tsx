"use client";

import { RecommendedWindow } from "@/lib/consensus";
import { useLanguage } from "@/lib/i18n";

interface Props {
  recommendations: RecommendedWindow[];
  eventTitle: string;
  durationMinutes: number;
}

export default function TopRecommendations({ recommendations, eventTitle }: Props) {
  const { t } = useLanguage();
  if (!recommendations || recommendations.length === 0 || !recommendations[0] || recommendations[0].score <= 0) {
    return null;
  }

  const top1 = recommendations[0];

  const getGoogleCalendarUrl = (win: RecommendedWindow) => {
    const startStr = new Date(win.start_time).toISOString().replace(/-|:|\.\d+/g, "");
    const endStr = new Date(win.end_time).toISOString().replace(/-|:|\.\d+/g, "");
    const title = encodeURIComponent(eventTitle);
    const details = encodeURIComponent(
      `Scheduled via WhenFree (${win.available_percentage}% available)\nAttendees: ${win.fully_available.join(", ")}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
  };

  const downloadIcs = (win: RecommendedWindow) => {
    const startStr = new Date(win.start_time).toISOString().replace(/-|:|\.\d+/g, "");
    const endStr = new Date(win.end_time).toISOString().replace(/-|:|\.\d+/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WhenFree//EN",
      "BEGIN:VEVENT",
      `SUMMARY:${eventTitle}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-emerald-400">
              {t.optimalTime}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              ({t.matchScore(top1.available_percentage)})
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-100">
            {top1.display_start} – {top1.display_end}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getGoogleCalendarUrl(top1)}
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-zinc-100 hover:bg-white text-zinc-950 font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            {t.googleCal}
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(top1)}
            className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-md transition-colors"
          >
            {t.downloadIcs}
          </button>
        </div>
      </div>

      {recommendations.length > 1 && (
        <div className="pt-2 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
          <span className="text-[11px] text-zinc-500">{t.otherOptions}</span>
          {recommendations.slice(1).map((r) => (
            <span key={r.rank} className="text-zinc-300 font-mono text-[11px]">
              #{r.rank} {r.display_start} ({r.available_percentage}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
