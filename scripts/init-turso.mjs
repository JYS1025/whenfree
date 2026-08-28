const tursoUrl = "libsql://whenfree-db-jys1025.aws-ap-northeast-1.turso.io";
const tursoToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc5MDA3NzYsImlkIjoiMDFhMDQ3MmUtZDgwMS03MDJmLWE4NTUtZDAyY2Q3ZWZiMDdhIiwia2lkIjoid1lJODVVaDlyUG4xYkkzcXdXcmpITGRnSDlUQjQxV2hNaWhtQXNQc3FXSSIsInJpZCI6IjhlOTI0NTMwLWE5YWUtNGEwYi1hOTRmLWQ3ZTBlZWFhY2I3YSJ9.Qq4t79oyLzyBMIfE1q2Kk69tELpjXClCDiP4PLKyFN6Hxjz2zjDwirHjU_mbtnQaB22SJEYfi98F_MrOmSJxBA";

const httpUrl = tursoUrl.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";

async function init() {
  console.log("Initializing WhenFree Schema on Turso DB...");
  const queries = [
    "DROP TABLE IF EXISTS test_ping;",
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      organizer_name TEXT,
      organizer_email TEXT,
      organizer_timezone TEXT NOT NULL DEFAULT 'UTC',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '21:00',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      user_id TEXT,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS time_slots (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      constraint_type TEXT NOT NULL DEFAULT 'available'
    );`,
    "CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);",
    "CREATE INDEX IF NOT EXISTS idx_time_slots_event_id ON time_slots(event_id);",
    "CREATE INDEX IF NOT EXISTS idx_time_slots_participant_id ON time_slots(participant_id);",
    "CREATE INDEX IF NOT EXISTS idx_time_slots_start_end ON time_slots(start_time, end_time);",
  ];

  const requests = queries.map((q) => ({ type: "execute", stmt: { sql: q } }));
  requests.push({ type: "close" });

  const res = await fetch(httpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  const json = await res.json();
  console.log("Schema initialized successfully:", json.results.length, "statements executed.");
}

init().catch(console.error);
