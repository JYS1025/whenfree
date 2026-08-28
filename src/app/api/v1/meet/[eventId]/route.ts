import { NextRequest, NextResponse } from "next/server";
import { dbOperations } from "@/db";
import { calculateConsensus } from "@/lib/consensus";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const fullData = await dbOperations.getEventFull(eventId);

    if (!fullData || !fullData.event) {
      return NextResponse.json(
        {
          error: "EventNotFound",
          message: `Event with ID '${eventId}' was not found.`,
        },
        { status: 404 }
      );
    }

    const { event, participants, slots } = fullData;
    const origin = request.nextUrl.origin;

    // Calculate current consensus
    const consensus = calculateConsensus(event, participants, slots);

    // Format start and end date range ISO strings in organizer timezone
    // e.g. "2026-09-01T09:00:00+09:00"
    const startRangeStr = `${event.start_date}T${event.start_time}:00`;
    const endRangeStr = `${event.end_date}T${event.end_time}:00`;

    // Response conforming strictly to Agent-Native Scheduling Specification
    const agentResponse = {
      event_id: event.id,
      title: event.title,
      description: event.description || undefined,
      organizer_timezone: event.organizer_timezone,
      duration_minutes: event.duration_minutes,
      date_range: {
        start: startRangeStr,
        end: endRangeStr,
      },
      action_required: "POST available time intervals to submit_endpoint with user identifier.",
      submit_endpoint: `${origin}/api/v1/meet/${event.id}/respond`,
      payload_schema: {
        user_name: "string (required - actual human attendee name, e.g. 'Sarah Kim'. Ask user if unknown, do NOT use generic 'AI Assistant')",
        user_id: "string (optional/agent-assigned)",
        timezone: "string (IANA)",
        slots: [
          {
            start: "ISO8601 string (e.g. 2026-09-01T10:00:00+09:00 or 2026-09-01T01:00:00Z)",
            end: "ISO8601 string (e.g. 2026-09-01T12:00:00+09:00 or 2026-09-01T03:00:00Z)",
            weight: "float (0.0=unavailable, 0.5=okay, 1.0=preferred)",
          },
        ],
        notes: "string (optional)",
      },
      current_status: {
        total_participants: participants.length,
        participant_names: participants.map((p) => p.name),
        top_recommendations: consensus.top_recommendations,
      },
    };

    return NextResponse.json(agentResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Agent-Protocol": "SyncFree-1.0",
      },
    });
  } catch (error) {
    console.error("Error retrieving event for agent:", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Failed to load event data." },
      { status: 500 }
    );
  }
}
