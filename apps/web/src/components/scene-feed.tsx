import type { SceneFeedEntry } from "../view-model/shell-view-model";

type SceneFeedProps = {
  entries: SceneFeedEntry[];
};

export function SceneFeed({ entries }: SceneFeedProps) {
  return (
    <section className="dialogue-window" aria-label="角色对话">
      <div className="dialogue-thread">
        {entries.length === 0 ? (
          <p className="empty-feed">当前没有需要立刻处理的对话或后果。</p>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`message ${entry.role === "player" ? "player" : "npc"}`}
            >
              {entry.role === "player" ? (
                <>
                  <div className="message-bubble">
                    <span className="message-name">{entry.label}</span>
                    {entry.body}
                  </div>
                  <span className="message-avatar">我</span>
                </>
              ) : (
                <>
                  <span className="message-avatar">
                    {entry.label.slice(0, 1)}
                  </span>
                  <div className="message-bubble">
                    <span className="message-name">{entry.label}</span>
                    {entry.body}
                  </div>
                </>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
