import { MouseEvent, useEffect, useRef, useState } from "react";
import * as localUiSdk from "@ai-western-town/ui-sdk";
import { CommandComposer } from "./components/command-composer";
import { DebugDock } from "./components/debug-dock";
import { LeftPanelSlot } from "./components/left-panel-slot";
import { PlayableLoopPanel } from "./components/playable-loop-panel";
import { SceneFeed } from "./components/scene-feed";
import { buildLiveShellViewModel } from "./view-model/live-shell-view-model";
import {
  createFreeTextCommand,
  createMoveCommand,
  createOpportunityCommand
} from "./view-model/player-command-factory";
import type {
  MovementItem,
  OpportunityItem,
  ShellViewModel
} from "./view-model/shell-view-model";

type LocalSessionRuntimeState = localUiSdk.LocalSessionRuntimeState;

const initialRuntimeState: LocalSessionRuntimeState = {
  connectionState: "idle",
  initialized: false,
  streamEvents: []
};

export function App() {
  const runtimeRef =
    useRef<ReturnType<typeof localUiSdk.createLocalSessionRuntime> | null>(null);
  const [runtimeState, setRuntimeState] =
    useState<LocalSessionRuntimeState>(initialRuntimeState);
  const [draft, setDraft] = useState("");
  const [isDesktopLeftVisible, setIsDesktopLeftVisible] = useState(true);
  const [isDesktopDebugVisible, setIsDesktopDebugVisible] = useState(true);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);

  useEffect(() => {
    const client = localUiSdk.createLocalHostClient({
      baseUrl: import.meta.env.VITE_LOCAL_HOST_URL ?? "http://127.0.0.1:8787"
    });
    const runtime = localUiSdk.createLocalSessionRuntime({
      client
    });
    runtimeRef.current = runtime;

    const unsubscribe = runtime.subscribe((nextState) => {
      setRuntimeState(nextState);
    });

    void runtime.initialize().catch((error) => {
      setRuntimeState((currentState) => ({
        ...currentState,
        connectionState: "connecting",
        initialized: true,
        lastError: error
      }));
    });

    return () => {
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const nextViewModel = buildLiveShellViewModel(runtimeState);
  const viewModel: ShellViewModel = {
    ...nextViewModel,
    composer: {
      ...nextViewModel.composer,
      draft
    }
  };

  async function handlePlayerCommand(
    playerCommand: ReturnType<typeof createMoveCommand>
  ): Promise<void> {
    if (!runtimeRef.current) {
      return;
    }

    setDraft("");

    try {
      await runtimeRef.current.submitCommand(playerCommand);
    } catch (error) {
      setRuntimeState((currentState) => ({
        ...currentState,
        connectionState: "connecting",
        lastError: error
      }));
    }
  }

  function handleCommandSubmit(commandText: string): void {
    void handlePlayerCommand(
      createFreeTextCommand(commandText, runtimeState.session?.worldTick ?? 0, viewModel.scene.sceneId)
    );
  }

  function handleSuggestionSelect(commandText: string): void {
    void handlePlayerCommand(
      createFreeTextCommand(commandText, runtimeState.session?.worldTick ?? 0, viewModel.scene.sceneId)
    );
  }

  function handleMovementSelect(item: MovementItem): void {
    void handlePlayerCommand(
      createMoveCommand(
        item.sceneId,
        runtimeState.session?.worldTick ?? 0,
        item.commandText
      )
    );
  }

  function handleOpportunitySelect(item: OpportunityItem): void {
    void handlePlayerCommand(
      createOpportunityCommand(
        item,
        runtimeState.session?.worldTick ?? 0,
        viewModel.scene.sceneId
      )
    );
  }

  function handleDraftChange(nextDraft: string): void {
    setDraft(nextDraft);
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

            <PlayableLoopPanel
              movement={viewModel.movement.items}
              opportunities={viewModel.opportunities.items}
              onMovementSelect={handleMovementSelect}
              onOpportunitySelect={handleOpportunitySelect}
            />

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
