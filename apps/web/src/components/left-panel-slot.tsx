import type { LeftPanelEntry } from "../view-model/shell-view-model";

type LeftPanelSlotProps = {
  panel: {
    title: string;
    description: string;
    placeholderTitle: string;
    placeholderBody: string;
    entries: LeftPanelEntry[];
  };
};

export function LeftPanelSlot({ panel }: LeftPanelSlotProps) {
  return (
    <section className="left-panel">
      <p className="eyebrow">Reserved View</p>
      <h2 className="left-panel-title">{panel.title}</h2>
      <p className="left-panel-copy">{panel.description}</p>

      <section className="left-panel-placeholder">
        <p className="section-label">{panel.placeholderTitle}</p>
        <p className="left-panel-copy">{panel.placeholderBody}</p>
      </section>

      <div className="left-panel-entry-list">
        {panel.entries.map((entry) => (
          <article key={entry.id} className="left-panel-entry">
            <div className="entry-meta">
              <span className="entry-label">{entry.label}</span>
            </div>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
