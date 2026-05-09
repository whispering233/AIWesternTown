import type { OpportunityItem } from "../view-model/shell-view-model";

type PlayableLoopPanelProps = {
  opportunities: OpportunityItem[];
  onOpportunitySelect: (item: OpportunityItem) => void;
};

export function PlayableLoopPanel({
  opportunities,
  onOpportunitySelect
}: PlayableLoopPanelProps) {
  return (
    <section className="decision-row" aria-label="选项">
      <div className="choices">
        {opportunities.length === 0 ? (
          <p className="empty-feed">当前没有被系统前置的机会动作。</p>
        ) : (
          opportunities.map((item, index) => (
            <button
              key={item.id}
              className="choice"
              type="button"
              title={item.detail}
              onClick={() => onOpportunitySelect(item)}
            >
              <span className="choice-key">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="choice-label">{item.title}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
