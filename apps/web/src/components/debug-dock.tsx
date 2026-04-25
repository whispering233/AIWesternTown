import type { DebugPanelModel } from "../view-model/shell-view-model";

type DebugDockProps = {
  debugPanel: DebugPanelModel;
};

export function DebugDock({ debugPanel }: DebugDockProps) {
  return (
    <section className="debug-panel">
      <div className="panel-head">
        <p className="eyebrow">System Rail</p>
        <h3>{debugPanel.title}</h3>
        <p className="debug-copy">{debugPanel.description}</p>
      </div>

      <div className="debug-card-list">
        {debugPanel.cards.map((card) => (
          <article key={card.id} className="debug-card">
            <div className="debug-card-header">
              <strong>{card.title}</strong>
              <span className={`debug-badge ${card.status}`}>
                {card.statusLabel}
              </span>
            </div>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
