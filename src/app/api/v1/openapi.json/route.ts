import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const openApiSpec = {
    openapi: "3.1.0",
    info: {
      title: "WhenFree API",
      version: "1.0.0",
      description: "Agent-Native Zero-Install Multi-Party Scheduling Platform API",
    },
    servers: [
      {
        url: origin,
        description: "Current Server",
      },
    ],
    paths: {
      "/api/v1/meet": {
        post: {
          summary: "Create a new meeting poll",
          description: "Create an event with a date range, daily time bounds, duration, and organizer details.",
          operationId: "createMeeting",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "start_date", "end_date"],
                  properties: {
                    title: { type: "string", example: "Team Strategy Sync" },
                    description: { type: "string", example: "Quarterly alignment" },
                    organizer_name: { type: "string", example: "Alex" },
                    organizer_email: { type: "string", example: "alex@example.com" },
                    organizer_timezone: { type: "string", example: "Asia/Seoul", default: "UTC" },
                    duration_minutes: { type: "integer", example: 60, default: 60 },
                    start_date: { type: "string", format: "date", example: "2026-09-01" },
                    end_date: { type: "string", format: "date", example: "2026-09-05" },
                    start_time: { type: "string", example: "09:00", default: "09:00" },
                    end_time: { type: "string", example: "21:00", default: "21:00" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Meeting created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      event_id: { type: "string" },
                      meet_url: { type: "string" },
                      submit_endpoint: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/meet/{eventId}": {
        get: {
          summary: "Get meeting parameters (Agent-First endpoint)",
          description: "Retrieve meeting constraints, time bounds, and submission schema. Pass 'Accept: application/json'.",
          operationId: "getMeetingParameters",
          parameters: [
            {
              name: "eventId",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "The unique event ID",
            },
          ],
          responses: {
            "200": {
              description: "Meeting details and action required",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      event_id: { type: "string" },
                      title: { type: "string" },
                      organizer_timezone: { type: "string" },
                      duration_minutes: { type: "integer" },
                      date_range: {
                        type: "object",
                        properties: {
                          start: { type: "string" },
                          end: { type: "string" },
                        },
                      },
                      action_required: { type: "string" },
                      submit_endpoint: { type: "string" },
                      payload_schema: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/meet/{eventId}/respond": {
        post: {
          summary: "Submit or update participant availability",
          description: "Submit availability intervals with scalar weights (0.0 to 1.0) and optional timezone offset.",
          operationId: "submitAvailability",
          parameters: [
            {
              name: "eventId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["user_name", "slots"],
                  properties: {
                    user_name: { type: "string", example: "Alice (Agent)" },
                    user_id: { type: "string", example: "agent_alice_456" },
                    timezone: { type: "string", example: "Asia/Seoul", default: "UTC" },
                    slots: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["start", "end"],
                        properties: {
                          start: { type: "string", format: "date-time", example: "2026-09-01T10:00:00+09:00" },
                          end: { type: "string", format: "date-time", example: "2026-09-01T12:00:00+09:00" },
                          weight: { type: "number", minimum: 0, maximum: 1, default: 1.0, example: 1.0 },
                          constraint_type: { type: "string", enum: ["available", "preferred", "soft_conflict", "travel_buffer"], default: "available" },
                        },
                      },
                    },
                    notes: { type: "string", example: "Afternoon preferred" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Availability recorded and updated consensus returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      participant_id: { type: "string" },
                      recorded_slots_count: { type: "integer" },
                      top_recommendations: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/meet/{eventId}/consensus": {
        get: {
          summary: "Get real-time consensus and heatmap matrix",
          description: "Returns the 30-minute heatmap buckets and top 3 globally optimal recommended time windows.",
          operationId: "getMeetingConsensus",
          parameters: [
            {
              name: "eventId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Consensus matrix and recommendations",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
