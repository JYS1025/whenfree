"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const defaultTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"
      : "Asia/Seoul";

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextDays = new Date(today);
  nextDays.setDate(today.getDate() + 4);

  const formatDateInput = (d: Date) => d.toISOString().split("T")[0];

  const [title, setTitle] = useState("");
  const [organizerTimezone, setOrganizerTimezone] = useState(defaultTz);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startDate, setStartDate] = useState(formatDateInput(tomorrow));
  const [endDate, setEndDate] = useState(formatDateInput(nextDays));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.meetingTopicPlaceholder);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/meet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          organizer_timezone: organizerTimezone,
          duration_minutes: durationMinutes,
          start_date: startDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create meeting.");
      router.push(`/meet/${data.event.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  const handleCreateDemo = async () => {
    setIsSubmitting(true);
    try {
      const createRes = await fetch("/api/v1/meet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sprint Planning Sync",
          organizer_name: "Sarah",
          organizer_timezone: defaultTz,
          duration_minutes: 60,
          start_date: startDate,
          end_date: endDate,
          start_time: "09:00",
          end_time: "18:00",
        }),
      });
      const data = await createRes.json();
      const eventId = data.event.id;

      // Seed participants
      await fetch(`/api/v1/meet/${eventId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: "Claude (Agent)",
          user_id: "agent_claude",
          timezone: defaultTz,
          slots: [
            { start: `${startDate}T10:00:00+09:00`, end: `${startDate}T12:00:00+09:00`, weight: 1.0 },
            { start: `${startDate}T14:00:00+09:00`, end: `${startDate}T16:00:00+09:00`, weight: 0.5 },
          ],
        }),
      });

      await fetch(`/api/v1/meet/${eventId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: "Sarah (Human)",
          timezone: defaultTz,
          slots: [
            { start: `${startDate}T09:00:00+09:00`, end: `${startDate}T12:00:00+09:00`, weight: 1.0 },
          ],
        }),
      });

      router.push(`/meet/${eventId}`);
    } catch (err: any) {
      setError(err.message || "Failed to create demo.");
      setIsSubmitting(false);
    }
  };

  const durations = [15, 30, 45, 60, 90];

  return (
    <div className="max-w-lg mx-auto px-4 py-16 space-y-8">
      {/* Title */}
      <div className="space-y-1.5 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/60 font-mono">
          <span>{t.platformBadge}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
          {t.homeTitle}
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t.homeDesc}
        </p>
      </div>

      {/* Clean Form */}
      <form onSubmit={handleCreate} className="space-y-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 sm:p-6 shadow-sm">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">{t.meetingTopic}</label>
          <input
            type="text"
            required
            placeholder={t.meetingTopicPlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">{t.duration}</label>
          <div className="grid grid-cols-5 gap-1">
            {durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMinutes(d)}
                className={`py-1.5 rounded-md text-xs font-medium transition-all ${
                  durationMinutes === d
                    ? "bg-zinc-100 text-zinc-950 font-semibold"
                    : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80"
                }`}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">{t.startDate}</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">{t.endDate}</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-500"
            />
          </div>
        </div>

        {/* Daily Time Range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">{t.earliestTime}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:border-zinc-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">{t.latestTime}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:border-zinc-500"
            />
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">{t.timezone}</label>
          <input
            type="text"
            value={organizerTimezone}
            onChange={(e) => setOrganizerTimezone(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:border-zinc-500"
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm transition-all"
        >
          {isSubmitting ? t.creatingButton : t.createButton}
        </button>
      </form>

      {/* Demo Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleCreateDemo}
          disabled={isSubmitting}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {t.demoLink}
        </button>
      </div>
    </div>
  );
}
