import { FormEvent } from "react";
import type {
  CommandComposerModel,
  CommandSuggestion
} from "../view-model/shell-view-model";

type CommandComposerProps = {
  composer: CommandComposerModel;
  suggestions: CommandSuggestion[];
  onDraftChange: (nextDraft: string) => void;
  onSubmit: (commandText: string) => void;
  onSuggestionSelect: (commandText: string) => void;
};

export function CommandComposer({
  composer,
  suggestions,
  onDraftChange,
  onSubmit,
  onSuggestionSelect
}: CommandComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedCommand = composer.draft.trim();

    if (normalizedCommand.length === 0) {
      return;
    }

    onSubmit(normalizedCommand);
  }

  return (
    <section className="composer-panel">
      <p className="eyebrow">Command Input</p>
      <h3>{composer.title}</h3>
      <p className="composer-copy">{composer.description}</p>

      <form className="composer-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="command-input">
          输入命令
        </label>
        <div className="composer-input-row">
          <input
            id="command-input"
            className="composer-input"
            type="text"
            value={composer.draft}
            placeholder={composer.placeholder}
            onChange={(event) => onDraftChange(event.target.value)}
          />

          <button className="submit-button" type="submit">
            发送命令
          </button>
        </div>

        <div className="suggestion-list" aria-label="建议命令">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="suggestion-chip"
              type="button"
              onClick={() => onSuggestionSelect(suggestion.commandText)}
            >
              <span className="suggestion-label">{suggestion.label}</span>
              <span className="suggestion-hint">{suggestion.hint}</span>
            </button>
          ))}
        </div>

        <p className="composer-footnote">
          {composer.footnote}
          {composer.lastSubmittedCommand === undefined
            ? ""
            : ` 上一次命令：${composer.lastSubmittedCommand}`}
        </p>
      </form>
    </section>
  );
}
