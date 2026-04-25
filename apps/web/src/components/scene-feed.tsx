import type { SceneFeedEntry } from "../view-model/shell-view-model";

type SceneFeedProps = {
  entries: SceneFeedEntry[];
};

export function SceneFeed({ entries }: SceneFeedProps) {
  return (
    <section className="feed-panel">
      <div className="feed-header">
        <div>
          <p className="eyebrow">Immediate Consequence</p>
          <h3>即时后果</h3>
          <p className="feed-subtitle">
            主栏只保留最近命令的关键反馈，完整事件流归入左侧卷宗。
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="empty-feed">当前没有需要立刻处理的后果。</p>
      ) : (
        <div className="feed-list">
          {entries.map((entry) => (
            <article key={entry.id} className={`feed-entry ${entry.role}`}>
              <div className="feed-entry-header">
                <span className="feed-entry-label">{entry.label}</span>
                <span className="feed-entry-meta">{entry.timestamp}</span>
              </div>
              <p className="feed-entry-body">{entry.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
