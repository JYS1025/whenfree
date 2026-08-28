import type { EventRecord, ParticipantRecord, TimeSlotRecord } from "../db";

export interface HeatmapBucket {
  start_time: string; // ISO 8601 UTC
  end_time: string;   // ISO 8601 UTC
  date: string;       // YYYY-MM-DD
  time_label: string; // e.g. "09:00"
  score: number;      // 0.0 to 1.0 (average weight across all participants)
  total_weight: number;
  available_count: number;
  total_participants: number;
  participant_breakdown: Array<{
    participant_id: string;
    name: string;
    weight: number;
    status: "preferred" | "available" | "soft_conflict" | "unavailable";
  }>;
}

export interface RecommendedWindow {
  rank: number;
  start_time: string;       // ISO 8601 UTC
  end_time: string;         // ISO 8601 UTC
  display_start: string;    // Human readable in organizer timezone
  display_end: string;
  score: number;            // 0.0 to 1.0
  available_percentage: number;
  fully_available_count: number;
  flexible_count: number;
  unavailable_count: number;
  fully_available: string[];
  flexible: string[];
  unavailable: string[];
}

export interface ConsensusResult {
  event_id: string;
  total_participants: number;
  heatmap: HeatmapBucket[];
  top_recommendations: RecommendedWindow[];
  dates: string[];
  time_labels: string[];
}

const BUCKET_MINUTES = 30; // 30-min granularity for crisp UI & agent scheduling

/**
 * Parses date string (YYYY-MM-DD) and time (HH:mm) with an IANA timezone offset
 */
function createUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  // Approximate local to UTC using standard Date parsing or Intl
  // For standard compatibility, construct ISO-like datetime
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Create a UTC date as base
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  // Determine timezone offset in minutes at this date
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

    const tzYear = getPart("year");
    const tzMonth = getPart("month");
    const tzDay = getPart("day");
    let tzHour = getPart("hour");
    if (tzHour === 24) tzHour = 0;
    const tzMin = getPart("minute");

    const targetTzDateInUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0);
    const diffMs = targetTzDateInUtc - utcDate.getTime();

    // Invert difference to get exact UTC representation for the given local time
    return new Date(utcDate.getTime() - diffMs);
  } catch {
    // Fallback if timezone not recognized
    return utcDate;
  }
}

export function calculateConsensus(
  event: EventRecord,
  participants: ParticipantRecord[],
  slots: TimeSlotRecord[]
): ConsensusResult {
  const dates: string[] = [];
  const curr = new Date(event.start_date);
  const end = new Date(event.end_date);

  while (curr <= end) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() + 1);
  }

  // Generate daily time intervals
  const [startH, startM] = event.start_time.split(":").map(Number);
  const [endH, endM] = event.end_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const timeLabels: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += BUCKET_MINUTES) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    timeLabels.push(`${hh}:${mm}`);
  }

  const heatmap: HeatmapBucket[] = [];

  // Generate all buckets
  for (const dateStr of dates) {
    for (const timeLabel of timeLabels) {
      const bucketStart = createUtcDate(dateStr, timeLabel, event.organizer_timezone);
      const bucketEnd = new Date(bucketStart.getTime() + BUCKET_MINUTES * 60 * 1000);

      const bucketStartIso = bucketStart.toISOString();
      const bucketEndIso = bucketEnd.toISOString();

      let totalWeight = 0;
      let availableCount = 0;
      const breakdown: HeatmapBucket["participant_breakdown"] = [];

      for (const p of participants) {
        // Find participant's slots overlapping with [bucketStart, bucketEnd]
        const pSlots = slots.filter(
          (s) =>
            s.participant_id === p.id &&
            new Date(s.start_time) < bucketEnd &&
            new Date(s.end_time) > bucketStart
        );

        let weight = 0;
        if (pSlots.length > 0) {
          // Take highest weight if multiple slots touch this bucket
          weight = Math.max(...pSlots.map((s) => s.weight));
        }

        totalWeight += weight;
        if (weight > 0) availableCount++;

        let status: "preferred" | "available" | "soft_conflict" | "unavailable" = "unavailable";
        if (weight >= 0.9) status = "preferred";
        else if (weight >= 0.6) status = "available";
        else if (weight > 0) status = "soft_conflict";

        breakdown.push({
          participant_id: p.id,
          name: p.name,
          weight,
          status,
        });
      }

      const score = participants.length > 0 ? totalWeight / participants.length : 0;

      heatmap.push({
        start_time: bucketStartIso,
        end_time: bucketEndIso,
        date: dateStr,
        time_label: timeLabel,
        score: Number(score.toFixed(3)),
        total_weight: totalWeight,
        available_count: availableCount,
        total_participants: participants.length,
        participant_breakdown: breakdown,
      });
    }
  }

  // If no participants have submitted yet, return empty recommendations
  if (participants.length === 0) {
    return {
      event_id: event.id,
      total_participants: 0,
      heatmap,
      top_recommendations: [],
      dates,
      time_labels: timeLabels,
    };
  }

  // Calculate Candidate Windows for duration_minutes
  const bucketsPerWindow = Math.max(1, Math.round(event.duration_minutes / BUCKET_MINUTES));
  const candidateWindows: Array<{
    start_time: string;
    end_time: string;
    display_start: string;
    display_end: string;
    score: number;
    available_percentage: number;
    fully_available_count: number;
    flexible_count: number;
    unavailable_count: number;
    fully_available: string[];
    flexible: string[];
    unavailable: string[];
  }> = [];

  // Group heatmap buckets by date
  const bucketsByDate = new Map<string, HeatmapBucket[]>();
  for (const b of heatmap) {
    if (!bucketsByDate.has(b.date)) {
      bucketsByDate.set(b.date, []);
    }
    bucketsByDate.get(b.date)!.push(b);
  }

  const formatDisplay = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: event.organizer_timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  for (const [, dateBuckets] of bucketsByDate.entries()) {
    if (dateBuckets.length < bucketsPerWindow) continue;

    for (let i = 0; i <= dateBuckets.length - bucketsPerWindow; i++) {
      const windowBuckets = dateBuckets.slice(i, i + bucketsPerWindow);
      const startBucket = windowBuckets[0];
      const endBucket = windowBuckets[windowBuckets.length - 1];

      // For each participant, calculate effective weight over the whole window (bottleneck min weight)
      const fullyAvailable: string[] = [];
      const flexible: string[] = [];
      const unavailable: string[] = [];
      let windowTotalWeight = 0;

      for (const p of participants) {
        // Find min weight across window buckets
        const weights = windowBuckets.map((b) => {
          const pb = b.participant_breakdown.find((x) => x.participant_id === p.id);
          return pb ? pb.weight : 0;
        });
        const minWeight = Math.min(...weights);
        windowTotalWeight += minWeight;

        if (minWeight >= 0.9) {
          fullyAvailable.push(p.name);
        } else if (minWeight > 0.1) {
          flexible.push(p.name);
        } else {
          unavailable.push(p.name);
        }
      }

      const score = participants.length > 0 ? windowTotalWeight / participants.length : 1.0;
      const pct = Math.round(score * 100);

      candidateWindows.push({
        start_time: startBucket.start_time,
        end_time: endBucket.end_time,
        display_start: formatDisplay(startBucket.start_time),
        display_end: formatDisplay(endBucket.end_time),
        score: Number(score.toFixed(3)),
        available_percentage: pct,
        fully_available_count: fullyAvailable.length,
        flexible_count: flexible.length,
        unavailable_count: unavailable.length,
        fully_available: fullyAvailable,
        flexible: flexible,
        unavailable: unavailable,
      });
    }
  }

  // Sort candidate windows: highest score, highest fully available count, earliest start
  candidateWindows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.fully_available_count !== a.fully_available_count) {
      return b.fully_available_count - a.fully_available_count;
    }
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  // Pick Top 3 diverse recommendations (avoid identical start times)
  const topRecommendations: RecommendedWindow[] = [];
  const selectedStarts = new Set<string>();

  for (const win of candidateWindows) {
    if (topRecommendations.length >= 3) break;
    // Basic deduplication
    if (!selectedStarts.has(win.start_time)) {
      selectedStarts.add(win.start_time);
      topRecommendations.push({
        rank: topRecommendations.length + 1,
        ...win,
      });
    }
  }

  return {
    event_id: event.id,
    total_participants: participants.length,
    heatmap,
    top_recommendations: topRecommendations,
    dates,
    time_labels: timeLabels,
  };
}
