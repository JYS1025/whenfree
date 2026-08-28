"use client";

import { useState, useEffect } from "react";
import { HeatmapBucket, ConsensusResult } from "@/lib/consensus";
import { EventRecord, ParticipantRecord } from "@/db";
import { useLanguage } from "@/lib/i18n";

interface Props {
  event: EventRecord;
  participants: ParticipantRecord[];
  consensus: ConsensusResult;
  onAvailabilitySubmitted: () => void;
}

type BrushMode = "available" | "flexible" | "unavailable";

const BRUSH_WEIGHTS: Record<BrushMode, number> = {
  available: 1.0,
  flexible: 0.5,
  unavailable: 0.0,
};

interface GridPos {
  dateIdx: number;
  timeIdx: number;
}

export default function HeatmapGrid({
  event,
  participants,
  consensus,
  onAvailabilitySubmitted,
}: Props) {
  const { t, lang } = useLanguage();

  // Paint state (Left side)
  const [userName, setUserName] = useState("");
  const [brush, setBrush] = useState<BrushMode>("available");
  const [paintedSlots, setPaintedSlots] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 2D Drag Selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<GridPos | null>(null);
  const [dragCurrent, setDragCurrent] = useState<GridPos | null>(null);

  // Group Heatmap Hover state (Right side)
  const [hoveredBucket, setHoveredBucket] = useState<HeatmapBucket | null>(null);
  const [filteredParticipantId, setFilteredParticipantId] = useState<string | null>(null);

  const { dates, time_labels, heatmap, top_recommendations } = consensus;

  const bestWindow = top_recommendations && top_recommendations.length > 0 ? top_recommendations[0] : null;

  const bucketMap = new Map<string, HeatmapBucket>();
  for (const b of heatmap) {
    bucketMap.set(`${b.date}_${b.time_label}`, b);
  }

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    const locale = lang === "ko" ? "ko-KR" : "en-US";
    const weekday = d.toLocaleDateString(locale, { weekday: "short" });
    const monthDay = d.toLocaleDateString(locale, { month: "numeric", day: "numeric" });
    return { weekday, monthDay };
  };

  const isInBestWindow = (bucket: HeatmapBucket | undefined) => {
    if (participants.length === 0 || !bestWindow || bestWindow.score <= 0 || !bucket) return false;
    const bStart = new Date(bucket.start_time).getTime();
    const bEnd = new Date(bucket.end_time).getTime();
    const wStart = new Date(bestWindow.start_time).getTime();
    const wEnd = new Date(bestWindow.end_time).getTime();
    return bStart >= wStart && bEnd <= wEnd;
  };

  const isInActiveSelection = (dIdx: number, tIdx: number) => {
    if (!isDragging || !dragStart || !dragCurrent) return false;
    const minD = Math.min(dragStart.dateIdx, dragCurrent.dateIdx);
    const maxD = Math.max(dragStart.dateIdx, dragCurrent.dateIdx);
    const minT = Math.min(dragStart.timeIdx, dragCurrent.timeIdx);
    const maxT = Math.max(dragStart.timeIdx, dragCurrent.timeIdx);
    return dIdx >= minD && dIdx <= maxD && tIdx >= minT && tIdx <= maxT;
  };

  const handleCellMouseDown = (dateIdx: number, timeIdx: number) => {
    setIsDragging(true);
    setDragStart({ dateIdx, timeIdx });
    setDragCurrent({ dateIdx, timeIdx });
  };

  const handleCellMouseEnter = (dateIdx: number, timeIdx: number) => {
    if (isDragging) {
      setDragCurrent({ dateIdx, timeIdx });
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && dragStart && dragCurrent) {
        const minD = Math.min(dragStart.dateIdx, dragCurrent.dateIdx);
        const maxD = Math.max(dragStart.dateIdx, dragCurrent.dateIdx);
        const minT = Math.min(dragStart.timeIdx, dragCurrent.timeIdx);
        const maxT = Math.max(dragStart.timeIdx, dragCurrent.timeIdx);

        const weight = BRUSH_WEIGHTS[brush];

        setPaintedSlots((prev) => {
          const next = { ...prev };
          for (let d = minD; d <= maxD; d++) {
            for (let t = minT; t <= maxT; t++) {
              const cellKey = `${dates[d]}_${time_labels[t]}`;
              if (weight === 0) {
                delete next[cellKey];
              } else {
                next[cellKey] = weight;
              }
            }
          }
          return next;
        });
      }
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, dragStart, dragCurrent, brush, dates, time_labels]);

  const loadParticipantSlots = async (participantName: string) => {
    setUserName(participantName);
    const p = participants.find((x) => x.name.toLowerCase() === participantName.toLowerCase());
    if (p) {
      const pSlots: Record<string, number> = {};
      for (const b of heatmap) {
        const entry = b.participant_breakdown.find((x) => x.participant_id === p.id);
        if (entry && entry.weight > 0) {
          pSlots[`${b.date}_${b.time_label}`] = entry.weight;
        }
      }
      setPaintedSlots(pSlots);
    }
  };

  const handleSelectAll = () => {
    const all: Record<string, number> = {};
    for (const d of dates) {
      for (const t of time_labels) {
        all[`${d}_${t}`] = BRUSH_WEIGHTS[brush] > 0 ? BRUSH_WEIGHTS[brush] : 1.0;
      }
    }
    setPaintedSlots(all);
  };

  const handleClearAll = () => {
    setPaintedSlots({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMsg(lang === "ko" ? "이름을 입력해주세요." : "Please enter your name.");
      return;
    }

    const slotKeys = Object.keys(paintedSlots);
    if (slotKeys.length === 0) {
      setErrorMsg(
        lang === "ko"
          ? "시간표를 드래그하여 최소 1개 이상의 가능 시간을 선택해주세요."
          : "Please drag on the grid to select at least one available slot."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const formattedSlots: Array<{ start: string; end: string; weight: number }> = [];
      for (const key of slotKeys) {
        const bucket = bucketMap.get(key);
        if (bucket) {
          formattedSlots.push({
            start: bucket.start_time,
            end: bucket.end_time,
            weight: paintedSlots[key],
          });
        }
      }

      const res = await fetch(`/api/v1/meet/${event.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: userName.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || event.organizer_timezone,
          slots: formattedSlots,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save.");
      }

      setSubmitSuccess(true);
      onAvailabilitySubmitted();
      setTimeout(() => setSubmitSuccess(false), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGroupCellColor = (bucket: HeatmapBucket | undefined) => {
    if (!bucket) return "bg-zinc-950/80 border-zinc-900";

    if (filteredParticipantId) {
      const pData = bucket.participant_breakdown.find((p) => p.participant_id === filteredParticipantId);
      if (!pData || pData.weight === 0) return "bg-zinc-950/80 border-zinc-900";
      if (pData.weight >= 0.9) return "bg-emerald-500 text-zinc-950 font-bold border-emerald-400";
      return "bg-amber-500 text-zinc-950 font-bold border-amber-400";
    }

    if (bucket.total_participants === 0 || bucket.score === 0) {
      return "bg-zinc-950/80 border-zinc-900 hover:border-zinc-700";
    }

    const score = bucket.score;
    if (score >= 0.9) return "bg-emerald-500 text-zinc-950 font-bold border-emerald-400";
    if (score >= 0.6) return "bg-emerald-600 text-white font-medium border-emerald-500";
    if (score >= 0.3) return "bg-emerald-900 text-emerald-200 border-emerald-800";
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  };

  const getPaintCellColor = (cellKey: string, dateIdx: number, timeIdx: number) => {
    const isSelectedInDrag = isInActiveSelection(dateIdx, timeIdx);
    if (isSelectedInDrag) {
      if (brush === "available") return "bg-emerald-500 border-emerald-400 opacity-90";
      if (brush === "flexible") return "bg-amber-500 border-amber-400 opacity-90";
      return "bg-zinc-800 border-zinc-700 opacity-70";
    }

    const weight = paintedSlots[cellKey];
    if (weight === undefined || weight === 0) {
      return "bg-zinc-950/80 border-zinc-900 hover:bg-zinc-900";
    }
    if (weight >= 0.9) return "bg-emerald-500 border-emerald-400";
    return "bg-amber-500 border-amber-400";
  };

  return (
    <div className="space-y-6 select-none">
      {/* 2-Column When2meet Side-by-Side Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: 내 가능한 시간 칠하기 (Your Availability) */}
        {/* ========================================================================= */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header */}
            <div className="border-b border-zinc-800 pb-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>{t.manualTitle}</span>
                  <span className="text-[11px] font-normal text-zinc-400">(Manual)</span>
                </h2>
                <span className="text-[11px] font-mono text-zinc-400">
                  {t.slotsMarked(Object.keys(paintedSlots).length)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t.manualSubtitle}
              </p>
            </div>

            {/* Input Form & Brush Bar */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              {/* Row 1: Name Input & Action Presets */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder={t.namePlaceholder}
                    value={userName}
                    onChange={(e) => {
                      setUserName(e.target.value);
                      setErrorMsg("");
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-400 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded-md whitespace-nowrap transition-colors"
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded-md whitespace-nowrap transition-colors"
                >
                  {t.clearAll}
                </button>
              </div>

              {/* Row 2: Brush Selector */}
              <div className="flex items-center justify-between bg-zinc-950/80 p-1.5 rounded-lg border border-zinc-800/80 text-[11px]">
                <span className="text-zinc-400 text-xs px-1">{t.brushLabel}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBrush("available")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      brush === "available"
                        ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.brushAvailable}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrush("flexible")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      brush === "flexible"
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.brushFlexible}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrush("unavailable")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      brush === "unavailable"
                        ? "bg-zinc-700 text-zinc-100 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.brushClear}
                  </button>
                </div>
              </div>

              {/* Paint Grid */}
              <div className="overflow-x-auto select-none pt-1">
                <div className="min-w-[280px]">
                  {/* Date Headers */}
                  <div className="flex border-b border-zinc-800 pb-1 mb-1">
                    <div className="w-11 flex-shrink-0 text-right pr-2 text-[10px] font-mono text-zinc-500">
                      {t.timeCol}
                    </div>
                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                      {dates.map((dateStr) => {
                        const { weekday, monthDay } = formatDateHeader(dateStr);
                        return (
                          <div key={dateStr} className="text-center px-0.5">
                            <div className="text-[11px] font-medium text-zinc-200">{weekday}</div>
                            <div className="text-[9px] font-mono text-zinc-500">{monthDay}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Rows */}
                  <div className="space-y-0.5">
                    {time_labels.map((timeLabel, timeIdx) => (
                      <div key={timeLabel} className="flex items-center">
                        <div className="w-11 flex-shrink-0 text-right pr-2 text-[10px] font-mono text-zinc-500">
                          {timeLabel}
                        </div>
                        <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                          {dates.map((dateStr, dateIdx) => {
                            const cellKey = `${dateStr}_${timeLabel}`;
                            const paintColor = getPaintCellColor(cellKey, dateIdx, timeIdx);
                            return (
                              <div
                                key={cellKey}
                                onMouseDown={() => handleCellMouseDown(dateIdx, timeIdx)}
                                onMouseEnter={() => handleCellMouseEnter(dateIdx, timeIdx)}
                                className={`h-5 rounded-[2px] border text-[9px] cursor-crosshair transition-colors ${paintColor}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/50 px-2.5 py-1.5 rounded-md">
                  {errorMsg}
                </div>
              )}

              {/* Big Save Button */}
              <button
                type="submit"
                disabled={isSubmitting || submitSuccess}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                  submitSuccess
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 hover:bg-white text-zinc-950"
                }`}
              >
                {isSubmitting ? t.savingButton : submitSuccess ? t.savedSuccess : t.saveButton}
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: 모두의 현황 히트맵 (Group Availability) */}
        {/* ========================================================================= */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header */}
            <div className="border-b border-zinc-800 pb-2.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>{t.groupTitle}</span>
                  <span className="text-[11px] font-normal text-zinc-400">(Group)</span>
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {t.groupSubtitle}
                </p>
              </div>

              {/* Mini Legend */}
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                <span className="w-2.5 h-2.5 rounded bg-zinc-950 border border-zinc-800 inline-block" />
                <span>0</span>
                <span className="w-2.5 h-2.5 rounded bg-emerald-900 inline-block" />
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span>{participants.length}</span>
              </div>
            </div>

            {/* Live Hover Info Strip */}
            <div className="min-h-[36px] flex items-center justify-between bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800/80 text-xs">
              {hoveredBucket ? (
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-zinc-300 font-medium">
                    {hoveredBucket.date} {hoveredBucket.time_label}:
                  </span>
                  <span className="font-bold text-emerald-400">
                    {t.availableCount(hoveredBucket.available_count, hoveredBucket.total_participants)}
                  </span>
                  {hoveredBucket.participant_breakdown.filter((p) => p.weight > 0).length > 0 && (
                    <span className="text-zinc-400 truncate max-w-xs">
                      ({hoveredBucket.participant_breakdown
                        .filter((p) => p.weight > 0)
                        .map((p) => `${p.name}${p.weight < 1 ? (lang === "ko" ? "(조율)" : "(flex)") : ""}`)
                        .join(", ")})
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-zinc-500 text-[11px]">
                  {t.hoverPrompt}
                </span>
              )}
            </div>

            {/* Group Grid */}
            <div className="overflow-x-auto select-none pt-1">
              <div className="min-w-[280px]">
                {/* Date Headers */}
                <div className="flex border-b border-zinc-800 pb-1 mb-1">
                  <div className="w-11 flex-shrink-0 text-right pr-2 text-[10px] font-mono text-zinc-500">
                    {t.timeCol}
                  </div>
                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                    {dates.map((dateStr) => {
                      const { weekday, monthDay } = formatDateHeader(dateStr);
                      return (
                        <div key={dateStr} className="text-center px-0.5">
                          <div className="text-[11px] font-medium text-zinc-200">{weekday}</div>
                          <div className="text-[9px] font-mono text-zinc-500">{monthDay}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Time Rows */}
                <div className="space-y-0.5">
                  {time_labels.map((timeLabel) => (
                    <div key={timeLabel} className="flex items-center">
                      <div className="w-11 flex-shrink-0 text-right pr-2 text-[10px] font-mono text-zinc-500">
                        {timeLabel}
                      </div>
                      <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                        {dates.map((dateStr) => {
                          const cellKey = `${dateStr}_${timeLabel}`;
                          const bucket = bucketMap.get(cellKey);
                          const colorClass = getGroupCellColor(bucket);
                          const isBest = isInBestWindow(bucket);

                          return (
                            <div
                              key={cellKey}
                              onMouseEnter={() => setHoveredBucket(bucket || null)}
                              onMouseLeave={() => setHoveredBucket(null)}
                              className={`h-5 rounded-[2px] border text-[9px] font-mono flex items-center justify-center cursor-default transition-colors relative ${colorClass} ${
                                isBest ? "ring-1 ring-amber-400/80 ring-offset-1 ring-offset-zinc-950" : ""
                              }`}
                            >
                              {bucket && bucket.available_count > 0 ? bucket.available_count : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Participants Filter List */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>{t.participantsTitle(participants.length)}</span>
                {filteredParticipantId && (
                  <button
                    onClick={() => setFilteredParticipantId(null)}
                    className="text-zinc-300 hover:text-white underline text-[10px]"
                  >
                    {t.resetFilter}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-1.5 flex-wrap">
                {participants.length === 0 ? (
                  <span className="text-[11px] text-zinc-500">{t.noParticipants}</span>
                ) : (
                  participants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (filteredParticipantId === p.id) {
                          setFilteredParticipantId(null);
                        } else {
                          setFilteredParticipantId(p.id);
                          loadParticipantSlots(p.name);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] transition-colors border ${
                        filteredParticipantId === p.id
                          ? "bg-zinc-100 text-zinc-950 border-white font-semibold"
                          : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                      }`}
                      title={lang === "ko" ? "클릭하여 일정 확인 / 수정" : "Click to inspect / edit"}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
