"use client";

import { useEffect, useState, use } from "react";
import { EventRecord, ParticipantRecord } from "@/db";
import { ConsensusResult } from "@/lib/consensus";
import TopRecommendations from "@/components/TopRecommendations";
import HeatmapGrid from "@/components/HeatmapGrid";
import AgentModal, { generateAgentBundle } from "@/components/AgentModal";
import { useLanguage } from "@/lib/i18n";

export default function MeetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<{
    event: EventRecord;
    participants: ParticipantRecord[];
    consensus: ConsensusResult;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAgentBundle, setCopiedAgentBundle] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [hoveredWindow, setHoveredWindow] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/meet/${eventId}/consensus`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(`Meeting '${eventId}' was not found.`);
        } else {
          setError("Failed to load meeting details.");
        }
        return;
      }
      const data = await res.json();
      setEventData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyAgentBundleDirect = () => {
    if (!eventData) return;
    const currentUrl = window.location.href;
    const submitEndpoint = `${window.location.origin}/api/v1/meet/${eventData.event.id}/respond`;
    const bundle = generateAgentBundle(eventData.event, currentUrl, submitEndpoint, lang);
    navigator.clipboard.writeText(bundle);
    setCopiedAgentBundle(true);
    setTimeout(() => setCopiedAgentBundle(false), 3000);
  };

  if (loading && !eventData) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <p className="text-xs text-zinc-500 font-mono">Loading poll...</p>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-3">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl text-zinc-300">
          <p className="text-sm font-semibold">{error || "Poll not found."}</p>
        </div>
        <a
          href="/"
          className="inline-block text-xs text-zinc-400 hover:text-zinc-200 underline"
        >
          {t.newPoll} →
        </a>
      </div>
    );
  }

  const { event, participants, consensus } = eventData;
  const currentUrl = typeof window !== "undefined" ? window.location.href : `http://localhost:3000/meet/${event.id}`;
  const submitEndpoint = typeof window !== "undefined" ? `${window.location.origin}/api/v1/meet/${event.id}/respond` : `/api/v1/meet/${event.id}/respond`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScheduleAction",
    name: event.title,
    startTime: `${event.start_date}T${event.start_time}:00`,
    endTime: `${event.end_date}T${event.end_time}:00`,
    target: {
      "@type": "EntryPoint",
      urlTemplate: submitEndpoint,
      httpMethod: "POST",
      contentType: "application/json",
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Embedded JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {event.title}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {t.attendeesCount(participants.length)}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            {t.durationMins(event.duration_minutes)} • {event.start_date} ~ {event.end_date} ({event.start_time} - {event.end_time}) • {event.organizer_timezone}
          </p>
        </div>

        {/* Share Link */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={copyMeetingLink}
            className="w-28 text-center text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 py-1.5 rounded-md transition-colors"
          >
            {copiedLink ? t.linkCopied : t.shareLink}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ★ HERO PRIMARY ACTION: AI 비서에게 캘린더 등록 시키기 (DEFAULT 강조) ★ */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-900/60 border border-zinc-700/80 rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                {t.aiHeroBadge}
              </span>
              <h2 className="text-base font-bold text-zinc-100">
                {t.aiHeroTitle}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed pt-0.5">
              {t.aiHeroDesc}
            </p>
          </div>

          <button
            onClick={() => setIsAgentModalOpen(true)}
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 underline whitespace-nowrap pt-1"
          >
            {t.aiPreviewLink}
          </button>
        </div>

        {/* Big 1-Click AI Copy Button */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={copyAgentBundleDirect}
            className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
              copiedAgentBundle
                ? "bg-emerald-600 text-white shadow-emerald-600/20"
                : "bg-zinc-100 hover:bg-white text-zinc-950 hover:scale-[1.005]"
            }`}
          >
            {copiedAgentBundle ? t.aiCopiedSuccess : t.aiCopyButton}
          </button>
        </div>
      </div>

      {/* Top 1 Consensus Recommendation Banner */}
      <TopRecommendations
        recommendations={consensus.top_recommendations}
        eventTitle={event.title}
        durationMinutes={event.duration_minutes}
        hoveredWindow={hoveredWindow}
        onHoverWindow={setHoveredWindow}
      />

      {/* When2meet 2-Column Side-by-Side Grid Workspace */}
      <HeatmapGrid
        event={event}
        participants={participants}
        consensus={consensus}
        onAvailabilitySubmitted={loadData}
        hoveredWindow={hoveredWindow}
      />

      {/* Modal */}
      <AgentModal
        event={event}
        meetUrl={currentUrl}
        submitUrl={submitEndpoint}
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
      />
    </div>
  );
}
