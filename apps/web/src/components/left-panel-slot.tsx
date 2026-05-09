import { useState } from "react";
import type {
  CharacterCardItem,
  LeftPanelEntry,
  LeftPanelStatusItem
} from "../view-model/shell-view-model";

type WorldPanelTab = "status" | "log" | "cast";

type LeftPanelSlotProps = {
  panel: {
    title: string;
    description: string;
    placeholderTitle: string;
    placeholderBody: string;
    statusItems: LeftPanelStatusItem[];
    logEntries: LeftPanelEntry[];
    characters: CharacterCardItem[];
    entries: LeftPanelEntry[];
  };
};

export function LeftPanelSlot({ panel }: LeftPanelSlotProps) {
  const [activeTab, setActiveTab] = useState<WorldPanelTab>("status");

  return (
    <section className="left-panel">
      <div className="panel-head">
        <h2 className="left-panel-title">{panel.title}</h2>
        <p className="left-panel-copy">{panel.description}</p>
      </div>

      <div className="rail-tabs" role="tablist" aria-label="世界侧栏标签">
        <button
          className={`rail-tab ${activeTab === "status" ? "is-active" : ""}`.trim()}
          type="button"
          role="tab"
          aria-selected={activeTab === "status"}
          aria-controls="world-panel-status"
          onClick={() => setActiveTab("status")}
        >
          状态
        </button>
        <button
          className={`rail-tab ${activeTab === "log" ? "is-active" : ""}`.trim()}
          type="button"
          role="tab"
          aria-selected={activeTab === "log"}
          aria-controls="world-panel-log"
          onClick={() => setActiveTab("log")}
        >
          日志
        </button>
        <button
          className={`rail-tab ${activeTab === "cast" ? "is-active" : ""}`.trim()}
          type="button"
          role="tab"
          aria-selected={activeTab === "cast"}
          aria-controls="world-panel-cast"
          onClick={() => setActiveTab("cast")}
        >
          人物
        </button>
      </div>

      <div className="rail-tab-panels">
        <section
          id="world-panel-status"
          role="tabpanel"
          hidden={activeTab !== "status"}
        >
          <StatusList items={panel.statusItems} fallback={panel.placeholderBody} />
        </section>

        <section
          id="world-panel-log"
          role="tabpanel"
          hidden={activeTab !== "log"}
        >
          <PanelEntryList entries={panel.logEntries} />
        </section>

        <section
          id="world-panel-cast"
          role="tabpanel"
          hidden={activeTab !== "cast"}
        >
          <CharacterCardList characters={panel.characters} />
        </section>
      </div>
    </section>
  );
}

function StatusList({
  items,
  fallback
}: {
  items: LeftPanelStatusItem[];
  fallback: string;
}) {
  if (items.length === 0) {
    return (
      <article className="left-panel-placeholder">
        <p className="left-panel-copy">{fallback}</p>
      </article>
    );
  }

  return (
    <ul className="small-list">
      {items.map((item) => (
        <li key={item.id} className="small-item">
          <p className="small-title">{item.title}</p>
          <p className="small-copy">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

function PanelEntryList({ entries }: { entries: LeftPanelEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty-feed">当前还没有可回看的日志。</p>;
  }

  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="timeline-item">
          <span className="timeline-tick">{entry.label}</span>
          <p className="timeline-text">
            <strong>{entry.title}</strong>
            <span>{entry.body}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

function CharacterCardList({
  characters
}: {
  characters: CharacterCardItem[];
}) {
  if (characters.length === 0) {
    return <p className="empty-feed">当前还没有已知人物卡。</p>;
  }

  return (
    <div className="character-list">
      {characters.map((character, index) => (
        <details key={character.id} className="character-card" open={index === 0}>
          <summary>
            <span className="avatar">{character.initial}</span>
            <span className="character-name">
              <strong>{character.name}</strong>
              <span>{character.role}</span>
            </span>
            <span className="expand-mark" aria-hidden="true" />
          </summary>
          <p className="character-detail">{character.detail}</p>
        </details>
      ))}
    </div>
  );
}
