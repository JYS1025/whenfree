"use client";

import { RecommendedWindow } from "@/lib/consensus";
import { useLanguage } from "@/lib/i18n";

interface Props {
  recommendations: RecommendedWindow[];
  eventTitle: string;
  durationMinutes: number;
  hoveredWindow?: RecommendedWindow | null;
  onHoverWindow?: (win: RecommendedWindow | null) => void;
}

export default function TopRecommendations({
  recommendations,
  eventTitle,
  hoveredWindow,
  onHoverWindow,
}: Props) {
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
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
      {/* Primary Top 1 Recommendation Header */}
      <div
        onMouseEnter={() => onHoverWindow?.(top1)}
        onMouseLeave={() => onHoverWindow?.(null)}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-lg transition-colors hover:bg-zinc-800/40 cursor-default"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1">
              <span>★</span>
              <span>{t.optimalTime}</span>
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-300">
              {top1.available_percentage}% ({top1.fully_available.length + top1.flexible.length}명 가능)
            </span>
          </div>
          <p className="text-base font-bold text-zinc-100">
            {top1.display_start} – {top1.display_end}
          </p>
          {top1.fully_available.length > 0 && (
            <p className="text-[11px] text-zinc-400">
              참석 가능: <span className="text-zinc-200">{top1.fully_available.join(", ")}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={getGoogleCalendarUrl(top1)}
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3 py-2 rounded-md transition-colors shadow-sm"
          >
            {t.googleCal}
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(top1)}
            className="text-xs bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-3 py-2 rounded-md transition-colors"
          >
            {t.downloadIcs}
          </button>
        </div>
      </div>

      {/* Alternative Top Options (Top 2 ~ Top 5) */}
      {recommendations.length > 1 && (
        <div className="pt-2.5 border-t border-zinc-800/70 space-y-1.5">
          <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
            <span>{t.otherOptions} (마우스를 올리면 시간표에서 강조)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {recommendations.slice(1).map((r) => {
              const isHovered = hoveredWindow?.start_time === r.start_time;
              return (
                <div
                  key={r.rank}
                  onMouseEnter={() => onHoverWindow?.(r)}
                  onMouseLeave={() => onHoverWindow?.(null)}
                  className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isHovered
                      ? "bg-zinc-800 border-amber-400/80 ring-1 ring-amber-400/50 text-white"
                      : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-bold text-amber-400">#{r.rank}</span>
                      <span className="font-semibold truncate">{r.display_start}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">
                      {r.available_percentage}% 일치 ({r.fully_available.length + r.flexible.length}명 가능)
                    </p>
                  </div>
                  <a
                    href={getGoogleCalendarUrl(r)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-zinc-200 whitespace-nowrap"
                    title="Google Calendar"
                  >
                    Cal
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
