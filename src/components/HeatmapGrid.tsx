"use client";

import { useState, useEffect } from "react";
import { EventRecord, ParticipantRecord } from "@/db";
import { ConsensusResult, HeatmapBucket, RecommendedWindow } from "@/lib/consensus";
import { useLanguage } from "@/lib/i18n";

interface Props {
  event: EventRecord;
  participants: ParticipantRecord[];
  consensus: ConsensusResult;
  onAvailabilitySubmitted: () => void;
  hoveredWindow?: RecommendedWindow | null;
}

type BrushMode = "available" | "flexible" | "unavailable";

const BRUSH_WEIGHTS: Record<BrushMode, number> = {
  available: 1.0,
  flexible: 0.5,
  unavailable: 0.0,
};

export default function HeatmapGrid({
  event,
  participants,
  consensus,
  onAvailabilitySubmitted,
  hoveredWindow,
}: Props) {
  const { t, lang } = useLanguage();

  // Manual Painter state (Left Column)
  const [userName, setUserName] = useState("");
  const [brush, setBrush] = useState<BrushMode>("available");
  const [paintedSlots, setPaintedSlots] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Mouse Drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ dateIdx: number; timeIdx: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dateIdx: number; timeIdx: number } | null>(null);

  // Group Heatmap Hover & Filter state (Right Column)
  const [hoveredBucket, setHoveredBucket] = useState<HeatmapBucket | null>(null);
  const [filteredParticipantId, setFilteredParticipantId] = useState<string | null>(null);

  const { dates, time_labels, heatmap, top_recommendations, max_available_count } = consensus;

  const bucketMap = new Map<string, HeatmapBucket>();
  for (const b of heatmap) {
    bucketMap.set(`${b.date}_${b.time_label}`, b);
  }

  const formatDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const locale = lang === "ko" ? "ko-KR" : "en-US";
    const weekday = dateObj.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
    const monthDay = dateObj.toLocaleDateString(locale, { month: "numeric", day: "numeric", timeZone: "UTC" });
    return { weekday, monthDay };
  };

  // Check if bucket belongs to the currently hovered window from TopRecommendations
  const isInHoveredWindow = (bucket: HeatmapBucket | undefined) => {
    if (!hoveredWindow || !bucket) return false;
    const bStart = new Date(bucket.start_time).getTime();
    const bEnd = new Date(bucket.end_time).getTime();
    const wStart = new Date(hoveredWindow.start_time).getTime();
    const wEnd = new Date(hoveredWindow.end_time).getTime();
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

  const loadParticipantSlots = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = participants.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
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

  // Distinct Color Scaler: Gold/Amber for Max Possible, Green for Partial
  const getGroupCellColor = (bucket: HeatmapBucket | undefined) => {
    if (!bucket) return "bg-zinc-950/80 border-zinc-900";

    if (filteredParticipantId) {
      const pData = bucket.participant_breakdown.find((p) => p.participant_id === filteredParticipantId);
      if (!pData || pData.weight === 0) return "bg-zinc-950/80 border-zinc-900";
      if (pData.weight >= 0.9) return "bg-amber-400 text-zinc-950 font-bold border-amber-300";
      return "bg-amber-600/80 text-zinc-100 font-semibold border-amber-500";
    }

    if (bucket.total_participants === 0 || bucket.available_count === 0) {
      return "bg-zinc-950/80 border-zinc-900 hover:border-zinc-700";
    }

    // ★ ALL MAX AVAILABLE SLOTS GET A COMPLETELY DISTINCT GOLD/AMBER COLOR ★
    if (bucket.is_max_available) {
      return "bg-amber-400 text-zinc-950 font-bold border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.35)]";
    }

    const availableRatio = bucket.total_participants > 0 ? bucket.available_count / bucket.total_participants : 0;

    // Partial availability (Green scale)
    if (availableRatio >= 0.7) {
      return "bg-emerald-600 text-white font-bold border-emerald-500";
    }
    if (availableRatio >= 0.4) {
      return "bg-emerald-700 text-emerald-100 font-semibold border-emerald-600";
    }
    return "bg-emerald-900/90 text-emerald-200 font-medium border-emerald-800";
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
                    onBlur={(e) => loadParticipantSlots(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-400 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors"
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors"
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
                        ? "bg-zinc-800 text-zinc-200 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t.brushClear}
                  </button>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2 rounded-md">
                {errorMsg}
              </p>
            )}

            {/* Interactive Paint Grid */}
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
                  {time_labels.map((timeLabel, tIdx) => (
                    <div key={timeLabel} className="flex items-center">
                      <div className="w-11 flex-shrink-0 text-right pr-2 text-[10px] font-mono text-zinc-500">
                        {timeLabel}
                      </div>
                      <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
                        {dates.map((dateStr, dIdx) => {
                          const cellKey = `${dateStr}_${timeLabel}`;
                          const colorClass = getPaintCellColor(cellKey, dIdx, tIdx);

                          return (
                            <div
                              key={cellKey}
                              onMouseDown={() => handleCellMouseDown(dIdx, tIdx)}
                              onMouseEnter={() => handleCellMouseEnter(dIdx, tIdx)}
                              className={`h-5 rounded-[2px] border cursor-pointer transition-colors ${colorClass}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-500">
              {Object.keys(paintedSlots).length > 0 ? "드래그 완료 후 저장하세요" : "표에서 드래그하여 시간 선택"}
            </span>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all shadow-sm ${
                submitSuccess
                  ? "bg-emerald-600 text-white"
                  : isSubmitting
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-100 hover:bg-white text-zinc-950"
              }`}
            >
              {submitSuccess ? t.savedSuccess : isSubmitting ? t.savingButton : t.saveButton}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: 모두의 현황 & 최적 시간대 (Group Availability & Consensus) */}
        {/* ========================================================================= */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Header with Legend */}
            <div className="border-b border-zinc-800 pb-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>{t.groupTitle}</span>
                  <span className="text-[11px] font-normal text-zinc-400">({participants.length}명 참여)</span>
                </h2>
                {max_available_count > 0 && (
                  <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-700/80">
                    최다 {max_available_count}/{participants.length}명 가능
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <p className="text-[11px] text-zinc-400">
                  {t.groupSubtitle}
                </p>
                {/* Color Legend */}
                {participants.length > 0 && (
                  <div className="flex items-center gap-2.5 text-[10px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-amber-400 border border-amber-300" />
                      <span className="text-amber-300 font-semibold">최다 가능</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600 border border-emerald-500" />
                      <span>일부 가능</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-[2px] bg-zinc-950 border border-zinc-800" />
                      <span>불가</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hover Breakdown Status Banner */}
            <div className="h-12 bg-zinc-950/90 rounded-lg border border-zinc-800 p-2 text-xs flex items-center justify-between transition-all">
              {hoveredBucket ? (
                <div className="flex items-center justify-between w-full">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-zinc-200">
                        {hoveredBucket.date} {hoveredBucket.time_label}
                      </span>
                      {hoveredBucket.is_max_available && (
                        <span className="text-[10px] text-amber-300 bg-amber-950 px-1.5 py-0.2 rounded border border-amber-700 font-bold">
                          최다 가능 시간
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {hoveredBucket.available_count > 0 ? (
                        <span>
                          가능:{" "}
                          <span className={hoveredBucket.is_max_available ? "text-amber-300 font-semibold" : "text-emerald-300 font-semibold"}>
                            {hoveredBucket.participant_breakdown
                              .filter((p) => p.weight > 0)
                              .map((p) => p.name)
                              .join(", ")}
                          </span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">가능한 참석자 없음</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-base font-mono font-bold ${hoveredBucket.is_max_available ? "text-amber-300" : "text-emerald-400"}`}>
                      {hoveredBucket.available_count}
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      /{hoveredBucket.total_participants}명
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-zinc-500 text-[11px] flex items-center gap-1.5">
                  <span>💡</span>
                  <span>시간표 셀에 마우스를 올리면 누가 가능한지 확인할 수 있습니다.</span>
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

                          const isHoveredWin = isInHoveredWindow(bucket);
                          const isMax = bucket?.is_max_available;

                          let ringClass = "";
                          if (isHoveredWin) {
                            ringClass = "ring-2 ring-white z-10 scale-[1.04] shadow-[0_0_10px_rgba(255,255,255,0.7)]";
                          } else if (isMax) {
                            ringClass = "ring-1 ring-amber-300/90";
                          }

                          return (
                            <div
                              key={cellKey}
                              onMouseEnter={() => setHoveredBucket(bucket || null)}
                              onMouseLeave={() => setHoveredBucket(null)}
                              className={`h-5 rounded-[2px] border text-[10px] font-mono flex items-center justify-center cursor-default transition-all relative ${colorClass} ${ringClass}`}
                            >
                              {bucket && bucket.available_count > 0 ? (
                                <span className="font-bold">
                                  {bucket.available_count}
                                </span>
                              ) : null}
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
            <div className="pt-2.5 border-t border-zinc-800/60 space-y-1.5">
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
                      className={`px-2.5 py-1 rounded text-[11px] transition-colors border ${
                        filteredParticipantId === p.id
                          ? "bg-zinc-100 text-zinc-950 border-white font-bold"
                          : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                      }`}
                      title={lang === "ko" ? "클릭하여 해당 참여자 일정만 보기" : "Click to view this participant only"}
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
