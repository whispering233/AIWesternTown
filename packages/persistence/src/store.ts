import { EventLogRepository } from "./event-log-repository.js";
import { DebugLogRepository } from "./debug-log-repository.js";
import { SaveRepository } from "./save-repository.js";
import { PersistenceDatabase, type PersistenceDatabaseOptions } from "./sqlite.js";
import { SessionStateRepository } from "./session-state-repository.js";

export class PersistenceStore {
  public readonly saves: SaveRepository;
  public readonly eventLogs: EventLogRepository;
  public readonly debugLogs: DebugLogRepository;
  public readonly sessionStates: SessionStateRepository;

  private constructor(public readonly database: PersistenceDatabase) {
    this.saves = new SaveRepository(database);
    this.eventLogs = new EventLogRepository(database);
    this.debugLogs = new DebugLogRepository(database);
    this.sessionStates = new SessionStateRepository(database);
  }

  public static open(
    options: PersistenceDatabaseOptions
  ): PersistenceStore {
    return new PersistenceStore(new PersistenceDatabase(options));
  }

  public transaction<T>(callback: (store: PersistenceStore) => T): T {
    return this.database.transaction(() => callback(this));
  }

  public close(): void {
    this.database.close();
  }
}

export function openPersistenceStore(
  options: PersistenceDatabaseOptions
): PersistenceStore {
  return PersistenceStore.open(options);
}
