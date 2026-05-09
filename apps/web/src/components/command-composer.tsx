import { FormEvent } from "react";
import type { CommandComposerModel } from "../view-model/shell-view-model";

type CommandComposerProps = {
  composer: CommandComposerModel;
  onDraftChange: (nextDraft: string) => void;
  onSubmit: (commandText: string) => void;
};

export function CommandComposer({
  composer,
  onDraftChange,
  onSubmit
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
    <section className="input-dock" aria-label="自由输入">
      <form className="command-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="command-input">
          输入命令
        </label>
        <input
          id="command-input"
          className="command-field"
          type="text"
          value={composer.draft}
          placeholder={composer.placeholder}
          aria-label={composer.title}
          onChange={(event) => onDraftChange(event.target.value)}
        />

        <button className="send-button" type="submit">
          发送
        </button>
      </form>
    </section>
  );
}
