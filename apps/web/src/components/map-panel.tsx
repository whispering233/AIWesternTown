import { useMemo, useState } from "react";
import type {
  MapPanelModel,
  MapRouteItem
} from "../view-model/shell-view-model";

type MapPanelProps = {
  panel: MapPanelModel;
  onRouteSelect: (item: MapRouteItem) => void;
};

type MapTab = "overview" | "current";

export function MapPanel({ panel, onRouteSelect }: MapPanelProps) {
  const [activeTab, setActiveTab] = useState<MapTab>("overview");
  const routeBySceneId = useMemo(
    () => new Map(panel.routes.map((route) => [route.sceneId, route])),
    [panel.routes]
  );

  function selectNode(sceneId: string): void {
    const route = routeBySceneId.get(sceneId);

    if (!route) {
      return;
    }

    onRouteSelect(route);
    setActiveTab("current");
  }

  return (
    <section className="map-panel">
      <div className="panel-head">
        <h2 className="panel-title">{panel.title}</h2>
        <span className="panel-note">{panel.focusLabel}</span>
      </div>

      <div className="map-body">
        <div className="map-top">
          <div className="map-tabs" role="tablist" aria-label="地图标签">
            <button
              className="map-tab-button"
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              aria-controls="map-overview"
              onClick={() => setActiveTab("overview")}
            >
              总地图
            </button>
            <button
              className="map-tab-button"
              type="button"
              role="tab"
              aria-selected={activeTab === "current"}
              aria-controls="map-current"
              onClick={() => setActiveTab("current")}
            >
              当前位置
            </button>
          </div>

          <section
            id="map-overview"
            className={`map-pane ${activeTab === "overview" ? "active" : ""}`.trim()}
            role="tabpanel"
            hidden={activeTab !== "overview"}
          >
            <div className="world-map">
              <p className="map-caption">{panel.overviewDescription}</p>
              <div className="map-grid" aria-label="总地图节点">
                <span className="route-line line-a" />
                <span className="route-line line-b" />
                <span className="route-line line-c" />
                {panel.nodes.map((node, index) => (
                  <button
                    key={node.id}
                    className={`map-node node-${index + 1} ${node.isCurrent ? "active" : ""}`.trim()}
                    type="button"
                    onClick={() => selectNode(node.sceneId)}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
              <p className="map-caption">实线表示已知路线；暖色节点表示当前场景。</p>
            </div>
          </section>

          <section
            id="map-current"
            className={`map-pane ${activeTab === "current" ? "active" : ""}`.trim()}
            role="tabpanel"
            hidden={activeTab !== "current"}
          >
            <div className="scene-description">
              <h3>{panel.focusLabel}</h3>
              <p>{panel.currentDescription}</p>
              <ul className="scene-facts">
                {panel.currentFacts.map((fact) => (
                  <li key={fact.label}>
                    <b>{fact.label}</b>
                    <span>{fact.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="route-switcher">
          <p className="route-title">去往地点</p>
          <div className="route-list">
            {panel.routes.map((route, index) => (
              <button
                key={route.id}
                className="route-button"
                type="button"
                aria-pressed={route.sceneId === panel.currentLocationId}
                onClick={() => onRouteSelect(route)}
              >
                <span className="route-key">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="route-label">{route.label}</span>
                <span className="route-state">{route.state}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
