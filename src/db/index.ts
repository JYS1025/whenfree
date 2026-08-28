import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  organizer_timezone: string;
  duration_minutes: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  created_at: string;
  updated_at: string;
}

export interface ParticipantRecord {
  id: string;
  event_id: string;
  name: string;
  user_id: string | null;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeSlotRecord {
  id: string;
  event_id: string;
  participant_id: string;
  start_time: string; // ISO 8601 UTC
  end_time: string;   // ISO 8601 UTC
  weight: number;     // 0.0 to 1.0
  constraint_type: string;
}

// ---------------------------------------------------------------------------
// Turso Cloud Driver (HTTP Pipeline - zero external npm dependencies)
// ---------------------------------------------------------------------------
const isTursoEnabled = () => Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

function getTursoEndpoint() {
  const rawUrl = process.env.TURSO_DATABASE_URL || "";
  const httpUrl = rawUrl.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
  return `${httpUrl}/v2/pipeline`;
}

interface TursoValue {
  type: "text" | "integer" | "float" | "null";
  value?: string | number;
}

function toTursoArg(val: any): TursoValue {
  if (val === null || val === undefined) return { type: "null" };
  if (typeof val === "number") {
    return Number.isInteger(val)
      ? { type: "integer", value: String(val) }
      : { type: "float", value: val };
  }
  return { type: "text", value: String(val) };
}

async function executeTursoQueries(
  statements: Array<{ sql: string; args?: any[] }>
): Promise<any[]> {
  const endpoint = getTursoEndpoint();
  const token = process.env.TURSO_AUTH_TOKEN || "";

  const requests = statements.map((s) => ({
    type: "execute",
    stmt: {
      sql: s.sql,
      args: (s.args || []).map(toTursoArg),
    },
  }));
  requests.push({ type: "close" } as any);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Turso Error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const results = [];
  for (const item of json.results) {
    if (item.type === "error") {
      throw new Error(`Turso SQL Error: ${item.error.message}`);
    }
    if (item.type === "ok" && item.response && item.response.type === "execute") {
      const result = item.response.result;
      const cols = (result.cols || []).map((c: any) => c.name);
      const rows = (result.rows || []).map((row: any[]) => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < cols.length; i++) {
          const cell = row[i];
          obj[cols[i]] = cell && cell.value !== undefined ? (cell.type === "integer" || cell.type === "float" ? Number(cell.value) : cell.value) : null;
        }
        return obj;
      });
      results.push(rows);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Local SQLite Driver (node:sqlite fallback)
// ---------------------------------------------------------------------------
let localDbInstance: DatabaseSync | null = null;

export function getLocalDb(): DatabaseSync {
  if (localDbInstance) return localDbInstance;

  const dbDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "syncfree.db");
  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  const schemaPath = path.join(process.cwd(), "src/db/schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schemaSql);
  }

  localDbInstance = db;
  return db;
}

// ---------------------------------------------------------------------------
// Unified Async Database Operations (Turso Cloud || Local SQLite)
// ---------------------------------------------------------------------------
export const dbOperations = {
  async createEvent(event: Omit<EventRecord, "created_at" | "updated_at">): Promise<EventRecord> {
    const now = new Date().toISOString();
    const record: EventRecord = {
      ...event,
      created_at: now,
      updated_at: now,
    };

    if (isTursoEnabled()) {
      await executeTursoQueries([
        {
          sql: `INSERT INTO events (
            id, title, description, organizer_name, organizer_email,
            organizer_timezone, duration_minutes, start_date, end_date,
            start_time, end_time, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            record.id,
            record.title,
            record.description,
            record.organizer_name,
            record.organizer_email,
            record.organizer_timezone,
            record.duration_minutes,
            record.start_date,
            record.end_date,
            record.start_time,
            record.end_time,
            record.created_at,
            record.updated_at,
          ],
        },
      ]);
      return record;
    }

    const db = getLocalDb();
    const stmt = db.prepare(`
      INSERT INTO events (
        id, title, description, organizer_name, organizer_email,
        organizer_timezone, duration_minutes, start_date, end_date,
        start_time, end_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.title,
      record.description,
      record.organizer_name,
      record.organizer_email,
      record.organizer_timezone,
      record.duration_minutes,
      record.start_date,
      record.end_date,
      record.start_time,
      record.end_time,
      record.created_at,
      record.updated_at
    );

    return record;
  },

  async getEvent(id: string): Promise<EventRecord | null> {
    if (isTursoEnabled()) {
      const results = await executeTursoQueries([
        { sql: "SELECT * FROM events WHERE id = ?", args: [id] },
      ]);
      const rows = results[0] as EventRecord[];
      return rows && rows.length > 0 ? rows[0] : null;
    }

    const db = getLocalDb();
    const stmt = db.prepare("SELECT * FROM events WHERE id = ?");
    const row = stmt.get(id) as unknown as EventRecord | undefined;
    return row || null;
  },

  async listEvents(limit = 10): Promise<EventRecord[]> {
    if (isTursoEnabled()) {
      const results = await executeTursoQueries([
        { sql: "SELECT * FROM events ORDER BY created_at DESC LIMIT ?", args: [limit] },
      ]);
      return (results[0] as EventRecord[]) || [];
    }

    const db = getLocalDb();
    const stmt = db.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?");
    return (stmt.all(limit) as unknown as EventRecord[]) || [];
  },

  async getParticipants(eventId: string): Promise<ParticipantRecord[]> {
    if (isTursoEnabled()) {
      const results = await executeTursoQueries([
        { sql: "SELECT * FROM participants WHERE event_id = ? ORDER BY created_at ASC", args: [eventId] },
      ]);
      return (results[0] as ParticipantRecord[]) || [];
    }

    const db = getLocalDb();
    const stmt = db.prepare("SELECT * FROM participants WHERE event_id = ? ORDER BY created_at ASC");
    return (stmt.all(eventId) as unknown as ParticipantRecord[]) || [];
  },

  async getTimeSlots(eventId: string): Promise<TimeSlotRecord[]> {
    if (isTursoEnabled()) {
      const results = await executeTursoQueries([
        { sql: "SELECT * FROM time_slots WHERE event_id = ? ORDER BY start_time ASC", args: [eventId] },
      ]);
      return (results[0] as TimeSlotRecord[]) || [];
    }

    const db = getLocalDb();
    const stmt = db.prepare("SELECT * FROM time_slots WHERE event_id = ? ORDER BY start_time ASC");
    return (stmt.all(eventId) as unknown as TimeSlotRecord[]) || [];
  },

  async getEventFull(eventId: string) {
    const event = await this.getEvent(eventId);
    if (!event) return null;
    const participants = await this.getParticipants(eventId);
    const slots = await this.getTimeSlots(eventId);
    return { event, participants, slots };
  },

  async saveParticipantWithSlots(
    eventId: string,
    participant: {
      id?: string;
      name: string;
      user_id?: string | null;
      timezone: string;
      notes?: string | null;
    },
    slots: Array<{
      start_time: string; // ISO 8601 UTC
      end_time: string;   // ISO 8601 UTC
      weight: number;
      constraint_type?: string;
    }>
  ): Promise<{ participant: ParticipantRecord; slots: TimeSlotRecord[] }> {
    const now = new Date().toISOString();

    if (isTursoEnabled()) {
      // 1. Check existing participant
      let existingQuery = "SELECT * FROM participants WHERE name = ? AND event_id = ?";
      let existingArgs: any[] = [participant.name, eventId];

      if (participant.id) {
        existingQuery = "SELECT * FROM participants WHERE id = ? AND event_id = ?";
        existingArgs = [participant.id, eventId];
      } else if (participant.user_id) {
        existingQuery = "SELECT * FROM participants WHERE user_id = ? AND event_id = ?";
        existingArgs = [participant.user_id, eventId];
      }

      const existingRes = await executeTursoQueries([{ sql: existingQuery, args: existingArgs }]);
      const existing = (existingRes[0] as ParticipantRecord[])[0] || null;

      let pRecord: ParticipantRecord;
      const stmts: Array<{ sql: string; args?: any[] }> = [];

      if (existing) {
        pRecord = {
          ...existing,
          name: participant.name,
          timezone: participant.timezone,
          notes: participant.notes || null,
          updated_at: now,
        };
        stmts.push({
          sql: "UPDATE participants SET name = ?, timezone = ?, notes = ?, updated_at = ? WHERE id = ?",
          args: [participant.name, participant.timezone, participant.notes || null, now, existing.id],
        });
        stmts.push({
          sql: "DELETE FROM time_slots WHERE participant_id = ?",
          args: [existing.id],
        });
      } else {
        const pId = participant.id || `p_${Math.random().toString(36).substring(2, 11)}`;
        pRecord = {
          id: pId,
          event_id: eventId,
          name: participant.name,
          user_id: participant.user_id || null,
          timezone: participant.timezone,
          notes: participant.notes || null,
          created_at: now,
          updated_at: now,
        };
        stmts.push({
          sql: "INSERT INTO participants (id, event_id, name, user_id, timezone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [pId, eventId, participant.name, participant.user_id || null, participant.timezone, participant.notes || null, now, now],
        });
      }

      const insertedSlots: TimeSlotRecord[] = [];
      for (const slot of slots) {
        const slotId = `slot_${Math.random().toString(36).substring(2, 11)}`;
        const constraintType = slot.constraint_type || (slot.weight >= 1.0 ? "preferred" : slot.weight > 0 ? "available" : "unavailable");
        stmts.push({
          sql: "INSERT INTO time_slots (id, event_id, participant_id, start_time, end_time, weight, constraint_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [slotId, eventId, pRecord.id, slot.start_time, slot.end_time, slot.weight, constraintType],
        });
        insertedSlots.push({
          id: slotId,
          event_id: eventId,
          participant_id: pRecord.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          weight: slot.weight,
          constraint_type: constraintType,
        });
      }

      await executeTursoQueries(stmts);
      return { participant: pRecord, slots: insertedSlots };
    }

    // Local SQLite
    const db = getLocalDb();
    let existingParticipant: ParticipantRecord | null = null;
    if (participant.id) {
      const stmt = db.prepare("SELECT * FROM participants WHERE id = ? AND event_id = ?");
      existingParticipant = (stmt.get(participant.id, eventId) as unknown as ParticipantRecord) || null;
    } else if (participant.user_id) {
      const stmt = db.prepare("SELECT * FROM participants WHERE user_id = ? AND event_id = ?");
      existingParticipant = (stmt.get(participant.user_id, eventId) as unknown as ParticipantRecord) || null;
    } else {
      const stmt = db.prepare("SELECT * FROM participants WHERE name = ? AND event_id = ?");
      existingParticipant = (stmt.get(participant.name, eventId) as unknown as ParticipantRecord) || null;
    }

    let pRecord: ParticipantRecord;
    if (existingParticipant) {
      const updateStmt = db.prepare(`
        UPDATE participants
        SET name = ?, timezone = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `);
      updateStmt.run(
        participant.name,
        participant.timezone,
        participant.notes || null,
        now,
        existingParticipant.id
      );
      pRecord = {
        ...existingParticipant,
        name: participant.name,
        timezone: participant.timezone,
        notes: participant.notes || null,
        updated_at: now,
      };

      const delStmt = db.prepare("DELETE FROM time_slots WHERE participant_id = ?");
      delStmt.run(pRecord.id);
    } else {
      const pId = participant.id || `p_${Math.random().toString(36).substring(2, 11)}`;
      const insertStmt = db.prepare(`
        INSERT INTO participants (id, event_id, name, user_id, timezone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        pId,
        eventId,
        participant.name,
        participant.user_id || null,
        participant.timezone,
        participant.notes || null,
        now,
        now
      );
      pRecord = {
        id: pId,
        event_id: eventId,
        name: participant.name,
        user_id: participant.user_id || null,
        timezone: participant.timezone,
        notes: participant.notes || null,
        created_at: now,
        updated_at: now,
      };
    }

    const insertSlotStmt = db.prepare(`
      INSERT INTO time_slots (id, event_id, participant_id, start_time, end_time, weight, constraint_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertedSlots: TimeSlotRecord[] = [];
    for (const slot of slots) {
      const slotId = `slot_${Math.random().toString(36).substring(2, 11)}`;
      const constraintType = slot.constraint_type || (slot.weight >= 1.0 ? "preferred" : slot.weight > 0 ? "available" : "unavailable");
      insertSlotStmt.run(
        slotId,
        eventId,
        pRecord.id,
        slot.start_time,
        slot.end_time,
        slot.weight,
        constraintType
      );
      insertedSlots.push({
        id: slotId,
        event_id: eventId,
        participant_id: pRecord.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        weight: slot.weight,
        constraint_type: constraintType,
      });
    }

    return { participant: pRecord, slots: insertedSlots };
  },

  async cleanExpiredEvents(retentionDays: number = 30): Promise<{ deleted: boolean; cutoff_date: string }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    if (isTursoEnabled()) {
      await executeTursoQueries([
        {
          sql: "DELETE FROM events WHERE end_date < ?",
          args: [cutoffStr],
        },
      ]);
      return { deleted: true, cutoff_date: cutoffStr };
    }

    const db = getLocalDb();
    const stmt = db.prepare("DELETE FROM events WHERE end_date < ?");
    stmt.run(cutoffStr);
    return { deleted: true, cutoff_date: cutoffStr };
  },
};
