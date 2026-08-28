-- SyncFree Database Schema (SQLite)
-- Supports zero-install AI agents and human participant availability with soft preferences

CREATE TABLE IF NOT EXISTS events (
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
);

CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    user_id TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL, -- ISO 8601 UTC (e.g. 2026-09-01T00:00:00.000Z)
    end_time TEXT NOT NULL,   -- ISO 8601 UTC (e.g. 2026-09-01T01:00:00.000Z)
    weight REAL NOT NULL DEFAULT 1.0, -- 0.0=unavailable, 0.5=flexible/soft conflict, 1.0=preferred
    constraint_type TEXT NOT NULL DEFAULT 'available' -- available, preferred, soft_conflict, travel_buffer
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_event_id ON time_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_participant_id ON time_slots(participant_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_start_end ON time_slots(start_time, end_time);
