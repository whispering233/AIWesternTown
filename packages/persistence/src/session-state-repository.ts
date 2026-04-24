import { eq, type InferSelectModel } from "drizzle-orm";

import {
  jsonParseArray,
  jsonParseObject,
  jsonParseStringArray,
  jsonStringify
} from "./json.js";
import { SaveRepository } from "./save-repository.js";
import { sessionStateSelection, sessionStatesTable } from "./schema.js";
import { PersistenceDatabase } from "./sqlite.js";
import type {
  SessionStateRecord,
  SimulationRunMode,
  UpsertSessionStateInput
} from "./types.js";

export class SessionStateRepository {
  public constructor(private readonly database: PersistenceDatabase) {}

  public upsert(input: UpsertSessionStateInput): SessionStateRecord {
    const record: SessionStateRecord = {
      ...input,
      foregroundNpcIds: input.foregroundNpcIds,
      nearFieldQueue: input.nearFieldQueue,
      farFieldBacklog: input.farFieldBacklog,
      npcScheduleStates: input.npcScheduleStates,
      activeLongActionsByNpc: input.activeLongActionsByNpc,
      eventWindow: input.eventWindow,
      playerActionLedger: input.playerActionLedger,
      updatedAt: input.updatedAt ?? new Date().toISOString()
    };

    this.database.connection
      .insert(sessionStatesTable)
      .values({
        saveId: record.saveId,
        worldTick: record.worldTick,
        currentSceneId: record.currentSceneId,
        runMode: record.runMode,
        foregroundNpcIdsJson: jsonStringify(record.foregroundNpcIds),
        nearFieldQueueJson: jsonStringify(record.nearFieldQueue),
        farFieldBacklogJson: jsonStringify(record.farFieldBacklog),
        dialogueThreadJson: record.dialogueThread
          ? jsonStringify(record.dialogueThread)
          : null,
        interruptStateJson: record.interruptState
          ? jsonStringify(record.interruptState)
          : null,
        npcScheduleStatesJson: jsonStringify(record.npcScheduleStates),
        activeLongActionsJson: jsonStringify(record.activeLongActionsByNpc),
        eventWindowJson: jsonStringify(record.eventWindow),
        playerActionLedgerJson: jsonStringify(record.playerActionLedger),
        updatedAt: record.updatedAt
      })
      .onConflictDoUpdate({
        target: sessionStatesTable.saveId,
        set: {
          worldTick: record.worldTick,
          currentSceneId: record.currentSceneId,
          runMode: record.runMode,
          foregroundNpcIdsJson: jsonStringify(record.foregroundNpcIds),
          nearFieldQueueJson: jsonStringify(record.nearFieldQueue),
          farFieldBacklogJson: jsonStringify(record.farFieldBacklog),
          dialogueThreadJson: record.dialogueThread
            ? jsonStringify(record.dialogueThread)
            : null,
          interruptStateJson: record.interruptState
            ? jsonStringify(record.interruptState)
            : null,
          npcScheduleStatesJson: jsonStringify(record.npcScheduleStates),
          activeLongActionsJson: jsonStringify(record.activeLongActionsByNpc),
          eventWindowJson: jsonStringify(record.eventWindow),
          playerActionLedgerJson: jsonStringify(record.playerActionLedger),
          updatedAt: record.updatedAt
        }
      })
      .run();
    new SaveRepository(this.database).syncSnapshot(record.saveId, {
      worldTick: record.worldTick,
      updatedAt: record.updatedAt
    });

    return record;
  }

  public getBySaveId(saveId: string): SessionStateRecord | undefined {
    const row = this.database.connection
      .select(sessionStateSelection)
      .from(sessionStatesTable)
      .where(eq(sessionStatesTable.saveId, saveId))
      .get();

    return row ? this.toRecord(row) : undefined;
  }

  private toRecord(
    row: InferSelectModel<typeof sessionStatesTable>
  ): SessionStateRecord {
    return {
      saveId: row.saveId,
      worldTick: row.worldTick,
      currentSceneId: row.currentSceneId,
      runMode: row.runMode as SimulationRunMode,
      foregroundNpcIds: jsonParseStringArray(
        row.foregroundNpcIdsJson,
        "foreground_npc_ids_json"
      ),
      nearFieldQueue: jsonParseArray(
        row.nearFieldQueueJson,
        "near_field_queue_json"
      ),
      farFieldBacklog: jsonParseArray(
        row.farFieldBacklogJson,
        "far_field_backlog_json"
      ),
      dialogueThread: row.dialogueThreadJson
        ? jsonParseObject(row.dialogueThreadJson, "dialogue_thread_json")
        : undefined,
      interruptState: row.interruptStateJson
        ? jsonParseObject(row.interruptStateJson, "interrupt_state_json")
        : undefined,
      npcScheduleStates: jsonParseArray(
        row.npcScheduleStatesJson,
        "npc_schedule_states_json"
      ),
      activeLongActionsByNpc: jsonParseObject(
        row.activeLongActionsJson,
        "active_long_actions_json"
      ),
      eventWindow: jsonParseObject(row.eventWindowJson, "event_window_json"),
      playerActionLedger: jsonParseArray(
        row.playerActionLedgerJson,
        "player_action_ledger_json"
      ),
      updatedAt: row.updatedAt
    };
  }
}
