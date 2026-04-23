export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type SaveStatus = "active" | "archived";

export type EventHeatLevel = "ordinary" | "high" | "interrupt";

export type InterruptType =
  | "violence"
  | "intrusion"
  | "public_reveal"
  | "forced_state_change";

export type SimulationRunMode =
  | "free_explore"
  | "focused_dialogue"
  | "interrupted"
  | "settle";

export type SaveRecord = {
  saveId: string;
  name: string;
  status: SaveStatus;
  worldTick: number;
  metadata: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type CreateSaveInput = {
  saveId: string;
  name: string;
  status?: SaveStatus;
  worldTick?: number;
  metadata?: JsonObject;
  createdAt?: string;
  updatedAt?: string;
};

export type EventLogRecord = {
  saveId: string;
  eventId: string;
  eventType: string;
  worldTick: number;
  originSceneId: string;
  actorIds: string[];
  targetIds: string[];
  tags: string[];
  heatLevel: EventHeatLevel;
  interruptType?: InterruptType;
  sourceCommandId?: string;
  summary?: string;
  payload: JsonObject;
  metadata: JsonObject;
  createdAt: string;
};

export type AppendEventLogInput = Omit<EventLogRecord, "saveId" | "createdAt"> & {
  createdAt?: string;
};

export type EventLogQuery = {
  fromTick?: number;
  toTick?: number;
  limit?: number;
};

export type SessionStateRecord = {
  saveId: string;
  worldTick: number;
  currentSceneId: string;
  runMode: SimulationRunMode;
  foregroundNpcIds: string[];
  nearFieldQueue: JsonValue[];
  farFieldBacklog: JsonValue[];
  dialogueThread?: JsonObject;
  interruptState?: JsonObject;
  npcScheduleStates: JsonValue[];
  activeLongActionsByNpc: JsonObject;
  eventWindow: JsonObject;
  playerActionLedger: JsonValue[];
  updatedAt: string;
};

export type UpsertSessionStateInput = Omit<SessionStateRecord, "updatedAt"> & {
  updatedAt?: string;
};
