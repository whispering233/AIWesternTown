import { useState } from "react";
import type { LeftPanelEntry } from "../view-model/shell-view-model";

type WorldPanelTab = "status" | "events" | "journal";

type LeftPanelSlotProps = {
  panel: {
    title: string;
    description: string;
    placeholderTitle: string;
    placeholderBody: string;
    entries: LeftPanelEntry[];
  };
};

const journalPlaceholders: LeftPanelEntry[] = [
  {
    id: "journal-characters",
    label: "Reserved",
    title: "角色索引",
    body: "预留 Character Sheet 入口，后续承载身份、已知事实、关系和最近动态。"
  },
  {
    id: "journal-locations",
    label: "Reserved",
    title: "地点与据点",
    body: "预留 Scene Detail 与 Settlement Overview 入口，后续承载场景分区和区域风险。"
  },
  {
    id: "journal-clues",
    label: "Reserved",
    title: "线索与假设",
    body: "预留 Investigation Board 入口，后续承载线索组、未解问题和当前假设。"
  }
];

export function LeftPanelSlot({ panel }: LeftPanelSlotProps) {
  const [activeTab, setActiveTab] = useState<WorldPanelTab>("status");

  return (
    <section className="left-panel">
      <div className="panel-head">
        <p className="eyebrow">World Rail</p>
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
          className={`rail-tab ${activeTab === "events" ? "is-active" : ""}`.trim()}
          type="button"
          role="tab"
          aria-selected={activeTab === "events"}
          aria-controls="world-panel-events"
          onClick={() => setActiveTab("events")}
        >
          事件流
        </button>
        <button
          className={`rail-tab ${activeTab === "journal" ? "is-active" : ""}`.trim()}
          type="button"
          role="tab"
          aria-selected={activeTab === "journal"}
          aria-controls="world-panel-journal"
          onClick={() => setActiveTab("journal")}
        >
          日志
        </button>
      </div>

      <div className="rail-tab-panels">
        <section
          id="world-panel-status"
          role="tabpanel"
          hidden={activeTab !== "status"}
        >
          <article className="left-panel-placeholder">
            <p className="section-label">{panel.placeholderTitle}</p>
            <p className="left-panel-copy">{panel.placeholderBody}</p>
          </article>
        </section>

        <section
          id="world-panel-events"
          role="tabpanel"
          hidden={activeTab !== "events"}
        >
          <PanelEntryList entries={panel.entries} />
        </section>

        <section
          id="world-panel-journal"
          role="tabpanel"
          hidden={activeTab !== "journal"}
        >
          <PanelEntryList entries={journalPlaceholders} />
        </section>
      </div>
    </section>
  );
}

function PanelEntryList({ entries }: { entries: LeftPanelEntry[] }) {
  return (
    <div className="left-panel-entry-list">
      {entries.map((entry) => (
        <article key={entry.id} className="left-panel-entry">
          <div className="entry-meta">
            <span className="entry-label">{entry.label}</span>
          </div>
          <h3>{entry.title}</h3>
          <p>{entry.body}</p>
        </article>
      ))}
    </div>
  );
}
