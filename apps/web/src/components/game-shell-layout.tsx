import { CommandComposer } from "./command-composer";
import { LeftPanelSlot } from "./left-panel-slot";
import { MapPanel } from "./map-panel";
import { PlayableLoopPanel } from "./playable-loop-panel";
import { SceneFeed } from "./scene-feed";
import type {
  MapRouteItem,
  OpportunityItem,
  ShellViewModel
} from "../view-model/shell-view-model";

type GameShellLayoutProps = {
  viewModel: ShellViewModel;
  onDraftChange: (nextDraft: string) => void;
  onMovementSelect: (item: MapRouteItem) => void;
  onOpportunitySelect: (item: OpportunityItem) => void;
  onSubmit: (commandText: string) => void;
};

export function GameShellLayout({
  viewModel,
  onDraftChange,
  onMovementSelect,
  onOpportunitySelect,
  onSubmit
}: GameShellLayoutProps) {
  return (
    <div className="shell-page">
      <div className="shell-app">
        <header className="topbar">
          <div className="brand-mark">{viewModel.header.title}</div>
          <div className="top-meta" aria-label="运行状态">
            <span className={`signal status-${viewModel.header.connectionState}`}>
              {viewModel.header.connectionLabel}
            </span>
            <span>{viewModel.header.sessionLabel}</span>
          </div>
        </header>

        <main className="shell-grid">
          <aside
            className="left-column panel"
            data-testid="left-panel-slot"
            aria-label="状态栏"
          >
            <LeftPanelSlot panel={viewModel.leftPanel} />
          </aside>

          <section
            className="main-column panel main-panel"
            aria-label="叙事交互"
          >
            <div className="scene">
              <div className="scene-inner">
                <div className="scene-meta">
                  <span className="meta-chip">
                    地点: {viewModel.scene.locationLabel}
                  </span>
                  <span className="meta-chip">{viewModel.scene.timeLabel}</span>
                  <span className="meta-chip">
                    模式: {viewModel.scene.runModeLabel}
                  </span>
                  <span className="meta-chip">{viewModel.scene.kicker}</span>
                </div>

                <div className="story-block">
                  <p>{viewModel.scene.description}</p>
                </div>

                <SceneFeed entries={viewModel.feed} />
              </div>
            </div>

            <PlayableLoopPanel
              opportunities={viewModel.opportunities.items}
              onOpportunitySelect={onOpportunitySelect}
            />

            <CommandComposer
              composer={viewModel.composer}
              onDraftChange={onDraftChange}
              onSubmit={onSubmit}
            />
          </section>

          <aside
            className="right-column panel"
            data-testid="map-panel-slot"
            aria-label="地图"
          >
            <MapPanel
              panel={viewModel.mapPanel}
              onRouteSelect={onMovementSelect}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}
