import { MouseEvent, startTransition, useState } from "react";
import { CommandComposer } from "./components/command-composer";
import { DebugDock } from "./components/debug-dock";
import { LeftPanelSlot } from "./components/left-panel-slot";
import { SceneFeed } from "./components/scene-feed";
import {
  buildMockCommandEcho,
  createMockShellViewModel
} from "./view-model/mock-shell-view-model";
import type { SceneFeedEntry } from "./view-model/shell-view-model";

export function App() {
  const initialViewModel = createMockShellViewModel();
  const [viewModel, setViewModel] = useState(initialViewModel);
  const [isDesktopLeftVisible, setIsDesktopLeftVisible] = useState(true);
  const [isDesktopDebugVisible, setIsDesktopDebugVisible] = useState(true);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);

  function handleCommandSubmit(commandText: string): void {
    startTransition(() => {
      setViewModel((currentViewModel) => ({
        ...currentViewModel,
        feed: [
          ...currentViewModel.feed,
          {
            id: `player-${Date.now()}`,
            role: "player",
            label: "你",
            timestamp: "刚刚",
            body: commandText
          },
          buildMockCommandEcho(commandText)
        ] satisfies SceneFeedEntry[],
        composer: {
          ...currentViewModel.composer,
          draft: "",
          lastSubmittedCommand: commandText
        }
      }));
    });
  }

  function handleSuggestionSelect(commandText: string): void {
    handleCommandSubmit(commandText);
  }

  function handleDraftChange(nextDraft: string): void {
    setViewModel((currentViewModel) => ({
      ...currentViewModel,
      composer: {
        ...currentViewModel.composer,
        draft: nextDraft
      }
    }));
  }

  function toggleDebugDrawer(): void {
    setIsLeftDrawerOpen(false);
    setIsDebugDrawerOpen((currentValue) => !currentValue);
  }

  function toggleLeftDrawer(): void {
    setIsDebugDrawerOpen(false);
    setIsLeftDrawerOpen((currentValue) => !currentValue);
  }

  function toggleDesktopLeft(): void {
    setIsDesktopLeftVisible((currentValue) => !currentValue);
  }

  function toggleDesktopDebug(): void {
    setIsDesktopDebugVisible((currentValue) => !currentValue);
  }

  function closeLeftDrawer(): void {
    setIsLeftDrawerOpen(false);
  }

  function closeDebugDrawer(): void {
    setIsDebugDrawerOpen(false);
  }

  function preventDrawerDismiss(event: MouseEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  return (
    <div className="shell-page">
      <div className="shell-app">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">{viewModel.header.sessionLabel}</p>
            <p className="eyebrow">Web Shell Prototype</p>
            <h1>{viewModel.header.title}</h1>
            <p className="topbar-copy">{viewModel.header.summary}</p>
          </div>

          <div className="topbar-meta">
            <div className="status-block">
              <p className="section-label">Session Status</p>
              <span
                className={`status-dot status-${viewModel.header.connectionState}`}
              />
              <div>
                <strong>{viewModel.header.connectionLabel}</strong>
                <p>{viewModel.header.connectionHint}</p>
              </div>
            </div>

            <div className="toolbar-actions desktop-only">
              <button
                className="toolbar-button"
                type="button"
                onClick={toggleDesktopLeft}
                aria-pressed={isDesktopLeftVisible}
              >
                {isDesktopLeftVisible ? "隐藏状态栏" : "显示状态栏"}
              </button>

              <button
                className="toolbar-button"
                type="button"
                onClick={toggleDesktopDebug}
                aria-pressed={isDesktopDebugVisible}
              >
                {isDesktopDebugVisible ? "隐藏调试栏" : "显示调试栏"}
              </button>
            </div>

            <button
              className="toolbar-button mobile-only"
              type="button"
              onClick={toggleLeftDrawer}
              aria-expanded={isLeftDrawerOpen}
              aria-controls="left-drawer"
            >
              状态栏
            </button>

            <button
              className="toolbar-button mobile-only"
              type="button"
              onClick={toggleDebugDrawer}
              aria-expanded={isDebugDrawerOpen}
              aria-controls="debug-drawer"
            >
              {isDebugDrawerOpen ? "隐藏调试栏" : "显示调试栏"}
            </button>
          </div>
        </header>

        <main
          className={[
            "shell-grid",
            isDesktopLeftVisible ? "" : "left-hidden",
            isDesktopDebugVisible ? "" : "debug-hidden"
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <aside
            className={`left-column ${isDesktopLeftVisible ? "" : "is-hidden"}`.trim()}
            data-testid="left-panel-slot"
            aria-hidden={!isDesktopLeftVisible}
          >
            <LeftPanelSlot panel={viewModel.leftPanel} />
          </aside>

          <section className="main-column">
            <section className="scene-hero">
              <div className="scene-hero-copy">
                <p className="eyebrow">{viewModel.scene.kicker}</p>
                <h2>{viewModel.scene.title}</h2>
                <p>{viewModel.scene.description}</p>
              </div>

              <dl className="scene-stats">
                <div>
                  <dt>时间</dt>
                  <dd>{viewModel.scene.timeLabel}</dd>
                </div>
                <div>
                  <dt>地点</dt>
                  <dd>{viewModel.scene.locationLabel}</dd>
                </div>
                <div>
                  <dt>模式</dt>
                  <dd>{viewModel.scene.runModeLabel}</dd>
                </div>
              </dl>
            </section>

            <SceneFeed entries={viewModel.feed} />

            <CommandComposer
              composer={viewModel.composer}
              suggestions={viewModel.suggestions}
              onDraftChange={handleDraftChange}
              onSubmit={handleCommandSubmit}
              onSuggestionSelect={handleSuggestionSelect}
            />
          </section>

          <aside
            className={`debug-column ${isDesktopDebugVisible ? "" : "is-hidden"}`.trim()}
            data-testid="debug-panel-slot"
            aria-hidden={!isDesktopDebugVisible}
          >
            <DebugDock debugPanel={viewModel.debugPanel} />
          </aside>
        </main>
      </div>

      <div
        className={`panel-drawer-overlay ${isLeftDrawerOpen ? "is-open" : ""}`}
        onClick={closeLeftDrawer}
      >
        <aside
          id="left-drawer"
          className={`panel-drawer left-drawer ${isLeftDrawerOpen ? "is-open" : ""}`.trim()}
          onClick={preventDrawerDismiss}
        >
          <LeftPanelSlot panel={viewModel.leftPanel} />
        </aside>
      </div>

      <div
        className={`panel-drawer-overlay ${isDebugDrawerOpen ? "is-open" : ""}`}
        onClick={closeDebugDrawer}
      >
        <aside
          id="debug-drawer"
          className={`panel-drawer debug-drawer ${isDebugDrawerOpen ? "is-open" : ""}`.trim()}
          onClick={preventDrawerDismiss}
        >
          <DebugDock debugPanel={viewModel.debugPanel} />
        </aside>
      </div>
    </div>
  );
}
