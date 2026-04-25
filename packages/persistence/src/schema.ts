import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text
} from "drizzle-orm/sqlite-core";

export const savesTable = sqliteTable("saves", {
  saveId: text("save_id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  worldTick: integer("world_tick").notNull(),
  metadataJson: text("metadata_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const eventLogsTable = sqliteTable(
  "event_logs",
  {
    saveId: text("save_id")
      .notNull()
      .references(() => savesTable.saveId, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    worldTick: integer("world_tick").notNull(),
    eventType: text("event_type").notNull(),
    originSceneId: text("origin_scene_id").notNull(),
    actorIdsJson: text("actor_ids_json").notNull(),
    targetIdsJson: text("target_ids_json").notNull(),
    tagsJson: text("tags_json").notNull(),
    heatLevel: text("heat_level").notNull(),
    interruptType: text("interrupt_type"),
    sourceCommandId: text("source_command_id"),
    summary: text("summary"),
    payloadJson: text("payload_json").notNull(),
    metadataJson: text("metadata_json").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.saveId, table.eventId] }),
    index("idx_event_logs_save_tick").on(
      table.saveId,
      table.worldTick,
      table.createdAt
    ),
    index("idx_event_logs_save_heat").on(
      table.saveId,
      table.heatLevel,
      table.worldTick
    )
  ]
);

export const sessionStatesTable = sqliteTable("session_states", {
  saveId: text("save_id")
    .primaryKey()
    .references(() => savesTable.saveId, { onDelete: "cascade" }),
  worldTick: integer("world_tick").notNull(),
  currentSceneId: text("current_scene_id").notNull(),
  runMode: text("run_mode").notNull(),
  foregroundNpcIdsJson: text("foreground_npc_ids_json").notNull(),
  nearFieldQueueJson: text("near_field_queue_json").notNull(),
  farFieldBacklogJson: text("far_field_backlog_json").notNull(),
  dialogueThreadJson: text("dialogue_thread_json"),
  interruptStateJson: text("interrupt_state_json"),
  npcScheduleStatesJson: text("npc_schedule_states_json").notNull(),
  activeLongActionsJson: text("active_long_actions_json").notNull(),
  eventWindowJson: text("event_window_json").notNull(),
  playerActionLedgerJson: text("player_action_ledger_json").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const debugLogsTable = sqliteTable(
  "debug_logs",
  {
    saveId: text("save_id")
      .notNull()
      .references(() => savesTable.saveId, { onDelete: "cascade" }),
    recordId: text("record_id").notNull(),
    kind: text("kind").notNull(),
    worldTick: integer("world_tick").notNull(),
    traceId: text("trace_id"),
    requestId: text("request_id"),
    npcId: text("npc_id"),
    tagsJson: text("tags_json").notNull(),
    payloadJson: text("payload_json").notNull(),
    metadataJson: text("metadata_json").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.saveId, table.recordId] }),
    index("idx_debug_logs_save_kind_tick").on(
      table.saveId,
      table.kind,
      table.worldTick,
      table.createdAt
    ),
    index("idx_debug_logs_save_trace").on(table.saveId, table.traceId),
    index("idx_debug_logs_save_request").on(table.saveId, table.requestId)
  ]
);

export const migrationConfig = {
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./local/persistence.sqlite"
  },
  breakpoints: true
} as const;

export const saveSelection = {
  saveId: savesTable.saveId,
  name: savesTable.name,
  status: savesTable.status,
  worldTick: savesTable.worldTick,
  metadataJson: savesTable.metadataJson,
  createdAt: savesTable.createdAt,
  updatedAt: savesTable.updatedAt
};

export const eventLogSelection = {
  saveId: eventLogsTable.saveId,
  eventId: eventLogsTable.eventId,
  eventType: eventLogsTable.eventType,
  worldTick: eventLogsTable.worldTick,
  originSceneId: eventLogsTable.originSceneId,
  actorIdsJson: eventLogsTable.actorIdsJson,
  targetIdsJson: eventLogsTable.targetIdsJson,
  tagsJson: eventLogsTable.tagsJson,
  heatLevel: eventLogsTable.heatLevel,
  interruptType: eventLogsTable.interruptType,
  sourceCommandId: eventLogsTable.sourceCommandId,
  summary: eventLogsTable.summary,
  payloadJson: eventLogsTable.payloadJson,
  metadataJson: eventLogsTable.metadataJson,
  createdAt: eventLogsTable.createdAt
};

export const sessionStateSelection = {
  saveId: sessionStatesTable.saveId,
  worldTick: sessionStatesTable.worldTick,
  currentSceneId: sessionStatesTable.currentSceneId,
  runMode: sessionStatesTable.runMode,
  foregroundNpcIdsJson: sessionStatesTable.foregroundNpcIdsJson,
  nearFieldQueueJson: sessionStatesTable.nearFieldQueueJson,
  farFieldBacklogJson: sessionStatesTable.farFieldBacklogJson,
  dialogueThreadJson: sessionStatesTable.dialogueThreadJson,
  interruptStateJson: sessionStatesTable.interruptStateJson,
  npcScheduleStatesJson: sessionStatesTable.npcScheduleStatesJson,
  activeLongActionsJson: sessionStatesTable.activeLongActionsJson,
  eventWindowJson: sessionStatesTable.eventWindowJson,
  playerActionLedgerJson: sessionStatesTable.playerActionLedgerJson,
  updatedAt: sessionStatesTable.updatedAt
};

export const debugLogSelection = {
  saveId: debugLogsTable.saveId,
  recordId: debugLogsTable.recordId,
  kind: debugLogsTable.kind,
  worldTick: debugLogsTable.worldTick,
  traceId: debugLogsTable.traceId,
  requestId: debugLogsTable.requestId,
  npcId: debugLogsTable.npcId,
  tagsJson: debugLogsTable.tagsJson,
  payloadJson: debugLogsTable.payloadJson,
  metadataJson: debugLogsTable.metadataJson,
  createdAt: debugLogsTable.createdAt
};

export const nowIsoSql = sql`CURRENT_TIMESTAMP`;
