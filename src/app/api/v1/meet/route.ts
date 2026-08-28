import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbOperations } from "@/db";

const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  organizer_name: z.string().optional().nullable(),
  organizer_email: z.string().email().optional().nullable(),
  organizer_timezone: z.string().default("UTC"),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:mm").default("09:00"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:mm").default("21:00"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateEventSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "InvalidPayload",
          message: "Validation failed for event creation.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Check date ordering
    if (new Date(data.end_date) < new Date(data.start_date)) {
      return NextResponse.json(
        {
          error: "InvalidDateRange",
          message: "end_date must be greater than or equal to start_date.",
        },
        { status: 400 }
      );
    }

    // Generate readable event ID
    const titleSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 20)
      .replace(/^-|-$/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const eventId = `${titleSlug || "meet"}-${randomSuffix}`;

    const created = await dbOperations.createEvent({
      id: eventId,
      title: data.title,
      description: data.description || null,
      organizer_name: data.organizer_name || null,
      organizer_email: data.organizer_email || null,
      organizer_timezone: data.organizer_timezone,
      duration_minutes: data.duration_minutes,
      start_date: data.start_date,
      end_date: data.end_date,
      start_time: data.start_time,
      end_time: data.end_time,
    });

    // Background lazy cleanup of events expired > 30 days (non-blocking)
    dbOperations.cleanExpiredEvents(30).catch(() => {});

    const origin = request.nextUrl.origin;

    return NextResponse.json(
      {
        success: true,
        event: created,
        links: {
          web_ui: `${origin}/meet/${eventId}`,
          api: `${origin}/api/v1/meet/${eventId}`,
          submit: `${origin}/api/v1/meet/${eventId}/respond`,
          consensus: `${origin}/api/v1/meet/${eventId}/consensus`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Failed to create event." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const recent = await dbOperations.listEvents(20);
    return NextResponse.json({ events: recent }, { status: 200 });
  } catch (error) {
    console.error("Error fetching recent events:", error);
    return NextResponse.json(
      { error: "InternalServerError", message: "Failed to list events." },
      { status: 500 }
    );
  }
}
