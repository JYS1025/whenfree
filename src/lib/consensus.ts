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
  is_max_available: boolean; // True if this cell has the highest available_count (>0)
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
  max_available_count: number;
  heatmap: HeatmapBucket[];
  top_recommendations: RecommendedWindow[];
  dates: string[];
  time_labels: string[];
}

const BUCKET_MINUTES = 30; // 30-min granularity for crisp UI & agent scheduling

/**
 * Deterministically generates all YYYY-MM-DD date strings in the range [startDateStr, endDateStr]
 * using UTC date math to avoid any local timezone date skew.
 */
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);

  const current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Parses date string (YYYY-MM-DD) and time (HH:mm) with an IANA timezone to exact UTC Date.
 */
function createUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // UTC candidate guess
  const utcCandidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

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

    const parts = formatter.formatToParts(utcCandidate);
    const getVal = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

    const tzYear = getVal("year");
    const tzMonth = getVal("month");
    const tzDay = getVal("day");
    let tzHour = getVal("hour");
    if (tzHour === 24) tzHour = 0;
    const tzMin = getVal("minute");

    const tzDateInUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0);
    const offsetMs = tzDateInUtcMs - utcCandidate.getTime();

    // Adjust candidate by exact timezone offset
    return new Date(utcCandidate.getTime() - offsetMs);
  } catch {
    return utcCandidate;
  }
}

export function calculateConsensus(
  event: EventRecord,
  participants: ParticipantRecord[],
  slots: TimeSlotRecord[]
): ConsensusResult {
  const dates = getDatesInRange(event.start_date, event.end_date);

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

  const rawHeatmap: HeatmapBucket[] = [];
  let maxAvailableCount = 0;

  // Generate all buckets
  for (const dateStr of dates) {
    for (const timeLabel of timeLabels) {
      const bucketStart = createUtcDate(dateStr, timeLabel, event.organizer_timezone);
      const bucketEnd = new Date(bucketStart.getTime() + BUCKET_MINUTES * 60 * 1000);

      const bucketStartMs = bucketStart.getTime();
      const bucketEndMs = bucketEnd.getTime();

      let totalWeight = 0;
      let availableCount = 0;
      const breakdown: HeatmapBucket["participant_breakdown"] = [];

      for (const p of participants) {
        // Find participant's slots overlapping with [bucketStart, bucketEnd]
        const pSlots = slots.filter((s) => {
          if (s.participant_id !== p.id) return false;
          const sStart = new Date(s.start_time).getTime();
          const sEnd = new Date(s.end_time).getTime();
          return sStart < bucketEndMs && sEnd > bucketStartMs;
        });

        let weight = 0;
        if (pSlots.length > 0) {
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

      if (availableCount > maxAvailableCount) {
        maxAvailableCount = availableCount;
      }

      const score = participants.length > 0 ? totalWeight / participants.length : 0;

      rawHeatmap.push({
        start_time: bucketStart.toISOString(),
        end_time: bucketEnd.toISOString(),
        date: dateStr,
        time_label: timeLabel,
        score: Number(score.toFixed(3)),
        total_weight: totalWeight,
        available_count: availableCount,
        total_participants: participants.length,
        is_max_available: false, // Will be set below
        participant_breakdown: breakdown,
      });
    }
  }

  // Mark all cells that have the highest availability (if > 0)
  const heatmap = rawHeatmap.map((b) => ({
    ...b,
    is_max_available: maxAvailableCount > 0 && b.available_count === maxAvailableCount,
  }));

  // If no participants have submitted yet, return empty recommendations
  if (participants.length === 0 || maxAvailableCount === 0) {
    return {
      event_id: event.id,
      total_participants: participants.length,
      max_available_count: 0,
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

      // For each participant, calculate effective bottleneck weight over the window
      const fullyAvailable: string[] = [];
      const flexible: string[] = [];
      const unavailable: string[] = [];
      let windowTotalWeight = 0;

      for (const p of participants) {
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

      // Only consider windows where at least one person has availability
      if (fullyAvailable.length === 0 && flexible.length === 0) continue;

      const score = participants.length > 0 ? windowTotalWeight / participants.length : 0;
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

  // Pick Top 5 diverse recommendations (avoid identical start times)
  const topRecommendations: RecommendedWindow[] = [];
  const selectedStarts = new Set<string>();

  for (const win of candidateWindows) {
    if (topRecommendations.length >= 5) break;
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
    max_available_count: maxAvailableCount,
    heatmap,
    top_recommendations: topRecommendations,
    dates,
    time_labels: timeLabels,
  };
}
