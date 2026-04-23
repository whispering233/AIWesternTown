import type { SceneFeedEntry } from "../view-model/shell-view-model";

type SceneFeedProps = {
  entries: SceneFeedEntry[];
};

export function SceneFeed({ entries }: SceneFeedProps) {
  return (
    <section className="feed-panel">
      <div className="feed-header">
        <div>
          <p className="eyebrow">Scene Feed</p>
          <h3>场景反馈</h3>
          <p className="feed-subtitle">
            当前只展示 mock view model，后续可替换为 SSE 驱动的会话流。
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="empty-feed">当前没有可见反馈。</p>
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
