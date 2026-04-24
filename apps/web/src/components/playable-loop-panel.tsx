import type {
  MovementItem,
  OpportunityItem
} from "../view-model/shell-view-model";

type PlayableLoopPanelProps = {
  movement: MovementItem[];
  opportunities: OpportunityItem[];
  onMovementSelect: (item: MovementItem) => void;
  onOpportunitySelect: (item: OpportunityItem) => void;
};

export function PlayableLoopPanel({
  movement,
  opportunities,
  onMovementSelect,
  onOpportunitySelect
}: PlayableLoopPanelProps) {
  return (
    <section className="playable-loop-panel">
      <div className="feed-header">
        <div>
          <p className="eyebrow">Playable Loop</p>
          <h3>移动与机会</h3>
          <p className="feed-subtitle">
            先决定站位，再决定观察、接近或继续深挖。
          </p>
        </div>
      </div>

      <div className="loop-section">
        <div className="loop-section-header">
          <p className="section-label">Movement Leads</p>
          <p className="feed-subtitle">先把可去地点直接摆出来。</p>
        </div>

        <div className="loop-chip-grid">
          {movement.map((item) => (
            <button
              key={item.id}
              className="loop-chip"
              type="button"
              onClick={() => onMovementSelect(item)}
            >
              <span className="loop-chip-label">{item.label}</span>
              <span className="loop-chip-detail">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="loop-section">
        <div className="loop-section-header">
          <p className="section-label">Surfaced Opportunities</p>
          <p className="feed-subtitle">当前最像下一步的动作会在这里前置。</p>
        </div>

        <div className="opportunity-list">
          {opportunities.map((item) => (
            <article key={item.id} className="opportunity-card">
              <div className="opportunity-card-header">
                <div>
                  <strong>{item.title}</strong>
                  <p className="feed-subtitle">{item.detail}</p>
                </div>
                <span className="debug-badge">{item.kind}</span>
              </div>

              <button
                className="toolbar-button opportunity-button"
                type="button"
                onClick={() => onOpportunitySelect(item)}
              >
                执行这一步
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
