import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbOperations } from "@/db";
import { calculateConsensus } from "@/lib/consensus";

const SlotSchema = z.object({
  start: z.string().min(1, "Start time is required"),
  end: z.string().min(1, "End time is required"),
  weight: z.number().min(0).max(1).default(1.0),
  constraint_type: z
    .enum(["available", "preferred", "soft_conflict", "travel_buffer"])
    .optional(),
});

const RespondPayloadSchema = z.object({
  user_name: z.string().min(1, "User name is required"),
  user_id: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
  slots: z.array(SlotSchema).min(1, "At least one availability slot is required"),
  notes: z.string().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const event = await dbOperations.getEvent(eventId);

    if (!event) {
      return NextResponse.json(
        {
          error: "EventNotFound",
          message: `Event with ID '${eventId}' was not found.`,
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parseResult = RespondPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "InvalidPayload",
          message: "Validation failed for availability payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { user_name, user_id, timezone, slots, notes } = parseResult.data;

    // Normalize slots to UTC ISO 8601 strings
    const normalizedSlots: Array<{
      start_time: string;
      end_time: string;
      weight: number;
      constraint_type?: string;
    }> = [];

    for (const slot of slots) {
      const startDate = new Date(slot.start);
      const endDate = new Date(slot.end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            error: "InvalidTimestamp",
            message: `Invalid ISO 8601 timestamp in slot: start='${slot.start}', end='${slot.end}'.`,
          },
          { status: 400 }
        );
      }

      if (endDate <= startDate) {
        return NextResponse.json(
          {
            error: "InvalidInterval",
            message: `End time (${slot.end}) must be strictly after start time (${slot.start}).`,
          },
          { status: 400 }
        );
      }

      normalizedSlots.push({
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        weight: Number(slot.weight.toFixed(2)),
        constraint_type: slot.constraint_type,
      });
    }

    // Save participant and slots atomically
    const { participant, slots: savedSlots } = await dbOperations.saveParticipantWithSlots(
      eventId,
      {
        name: user_name,
        user_id: user_id || null,
        timezone,
        notes: notes || null,
      },
      normalizedSlots
    );

    // Recalculate consensus
    const fullData = (await dbOperations.getEventFull(eventId))!;
    const consensus = calculateConsensus(
      fullData.event,
      fullData.participants,
      fullData.slots
    );

    return NextResponse.json(
      {
        success: true,
        message: `Availability successfully recorded for '${participant.name}'.`,
        participant: {
          id: participant.id,
          name: participant.name,
          user_id: participant.user_id,
          timezone: participant.timezone,
          recorded_slots: savedSlots.length,
        },
        total_participants: fullData.participants.length,
        top_recommendations: consensus.top_recommendations,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error saving participant availability:", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Failed to process availability submission." },
      { status: 500 }
    );
  }
}
