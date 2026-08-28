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
    const { organizer_email, ...safeEvent } = event;
    const consensus = calculateConsensus(event, participants, slots);

    return NextResponse.json(
      {
        event: safeEvent,
        participants,
        consensus,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error calculating consensus:", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Failed to compute consensus." },
      { status: 500 }
    );
  }
}
