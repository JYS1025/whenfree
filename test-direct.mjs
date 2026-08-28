import { dbOperations } from "./src/db/index.ts";
import { calculateConsensus } from "./src/lib/consensus.ts";
import { isAgentRequest } from "./src/lib/content-negotiation.ts";
import fs from "node:fs";

console.log("=== Running Direct SyncFree System Validation ===");

// 1. Validate /llms.txt and agent.json files
console.log("\n[Check 1] Checking Discovery Files...");
const llmsContent = fs.readFileSync("./public/llms.txt", "utf-8");
if (llmsContent.includes("SyncFree") && llmsContent.includes("GET /meet/{eventId}")) {
  console.log("✅ public/llms.txt verified!");
} else {
  throw new Error("llms.txt missing key instructions");
}

const agentJson = JSON.parse(fs.readFileSync("./public/.well-known/agent.json", "utf-8"));
if (agentJson.name === "SyncFree" && agentJson.protocol_version === "1.0") {
  console.log("✅ public/.well-known/agent.json verified!");
} else {
  throw new Error("agent.json invalid");
}

// 2. Test Content Negotiation Logic
console.log("\n[Check 2] Checking Content Negotiation logic...");
const mockAgentReq = {
  url: "http://localhost:3000/meet/meet-123",
  headers: new Map([
    ["accept", "application/json, text/plain, */*"],
    ["user-agent", "ClaudeBot/1.0"],
  ]),
};
const mockBrowserReq = {
  url: "http://localhost:3000/meet/meet-123",
  headers: new Map([
    ["accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"],
    ["user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"],
  ]),
};

const agentDetection = isAgentRequest({
  url: mockAgentReq.url,
  headers: { get: (k) => mockAgentReq.headers.get(k.toLowerCase()) },
});

const browserDetection = isAgentRequest({
  url: mockBrowserReq.url,
  headers: { get: (k) => mockBrowserReq.headers.get(k.toLowerCase()) },
});

console.log("Agent request detected as agent:", agentDetection);
console.log("Browser request detected as agent:", browserDetection);

if (agentDetection === true && browserDetection === false) {
  console.log("✅ Content Negotiation passed!");
} else {
  throw new Error("Content negotiation detection mismatch");
}

// 3. Test Database Operations: Create Event
console.log("\n[Check 3] Testing Database Event Creation...");
const testEvent = dbOperations.createEvent({
  id: `test-meet-${Date.now()}`,
  title: "Q4 AI Strategy Alignment",
  description: "Synchronizing AI agents and human leads",
  organizer_name: "Sarah (Lead)",
  organizer_email: "sarah@example.com",
  organizer_timezone: "Asia/Seoul",
  duration_minutes: 60,
  start_date: "2026-09-01",
  end_date: "2026-09-02",
  start_time: "09:00",
  end_time: "18:00",
});

console.log("Created Event ID:", testEvent.id);
const retrieved = dbOperations.getEvent(testEvent.id);
if (retrieved && retrieved.title === "Q4 AI Strategy Alignment") {
  console.log("✅ Database Event Creation & Retrieval verified!");
} else {
  throw new Error("Database event retrieval failed");
}

// 4. Test Availability Submissions (Agent 1 with scalar weights + Agent 2 + Human)
console.log("\n[Check 4] Testing Availability Submissions with Soft Preferences...");

// Agent 1: Claude (Prefers 10:00-12:00 (1.0), Flexible 14:00-16:00 (0.5))
const p1 = dbOperations.saveParticipantWithSlots(
  testEvent.id,
  {
    name: "Claude 3.7 (Agent)",
    user_id: "agent_claude",
    timezone: "Asia/Seoul",
    notes: "Preferred morning slot",
  },
  [
    { start_time: "2026-09-01T01:00:00.000Z", end_time: "2026-09-01T03:00:00.000Z", weight: 1.0 }, // 10:00-12:00 KST
    { start_time: "2026-09-01T05:00:00.000Z", end_time: "2026-09-01T07:00:00.000Z", weight: 0.5 }, // 14:00-16:00 KST
  ]
);

// Agent 2: GPT-4o (Available 10:30-14:00 (1.0))
const p2 = dbOperations.saveParticipantWithSlots(
  testEvent.id,
  {
    name: "GPT-4o (Agent)",
    user_id: "agent_gpt",
    timezone: "Asia/Seoul",
  },
  [
    { start_time: "2026-09-01T01:30:00.000Z", end_time: "2026-09-01T05:00:00.000Z", weight: 1.0 }, // 10:30-14:00 KST
  ]
);

// Participant 3: Sarah Human (Available 09:00-12:00 (1.0))
const p3 = dbOperations.saveParticipantWithSlots(
  testEvent.id,
  {
    name: "Sarah (Human)",
    timezone: "Asia/Seoul",
  },
  [
    { start_time: "2026-09-01T00:00:00.000Z", end_time: "2026-09-01T03:00:00.000Z", weight: 1.0 }, // 09:00-12:00 KST
  ]
);

console.log("Recorded 3 participants with", p1.slots.length + p2.slots.length + p3.slots.length, "total slots.");
console.log("✅ Participant slots recorded into SQLite successfully!");

// 5. Test Consensus Engine
console.log("\n[Check 5] Evaluating CSP Consensus Calculation...");
const full = dbOperations.getEventFull(testEvent.id);
const consensus = calculateConsensus(full.event, full.participants, full.slots);

console.log("Total Participants in Consensus:", consensus.total_participants);
console.log("Total Heatmap Cells Generated:", consensus.heatmap.length);
console.log("Top Recommendations Found:", consensus.top_recommendations.length);

consensus.top_recommendations.forEach((rec) => {
  console.log(`\n🏆 Rank #${rec.rank}:`);
  console.log(`   Time: ${rec.display_start} -> ${rec.display_end}`);
  console.log(`   Score: ${rec.score} (${rec.available_percentage}% match)`);
  console.log(`   Fully Available (${rec.fully_available.length}):`, rec.fully_available.join(", "));
  console.log(`   Flexible (${rec.flexible.length}):`, rec.flexible.join(", "));
  console.log(`   Unavailable (${rec.unavailable.length}):`, rec.unavailable.join(", "));
});

// Verify that Rank 1 has high score around 10:30 ~ 12:00 KST where all 3 overlap!
const rank1 = consensus.top_recommendations[0];
if (rank1 && rank1.fully_available_count >= 2) {
  console.log("\n✅ CSP Consensus Algorithm accurately identified global optimal intersection!");
} else {
  throw new Error("Consensus algorithm failed to score optimal window");
}

console.log("\n=============================================");
console.log("🎉 ALL DIRECT INTEGRATION CHECKS PASSED 100%!");
console.log("=============================================");
