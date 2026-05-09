import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { createMockShellViewModel } from "../view-model/mock-shell-view-model";
import type { ShellViewModel } from "../view-model/shell-view-model";
import { GameShellLayout } from "./game-shell-layout";

test("renders the refactored game shell with status, narrative, and map rails", () => {
  const viewModel = createLayoutViewModel();

  const html = renderToStaticMarkup(
    <GameShellLayout
      viewModel={viewModel}
      onDraftChange={() => undefined}
      onMovementSelect={() => undefined}
      onOpportunitySelect={() => undefined}
      onSubmit={() => undefined}
    />
  );

  assert.match(html, /class="shell-grid"/);
  assert.match(html, /aria-label="状态栏"/);
  assert.match(html, /aria-label="叙事交互"/);
  assert.match(html, /aria-label="地图"/);
  assert.match(html, /总地图/);
  assert.match(html, /当前位置/);
  assert.match(html, /去往地点/);
  assert.doesNotMatch(html, /隐藏/);
  assert.doesNotMatch(html, /System Rail/);
});

function createLayoutViewModel(): ShellViewModel {
  return {
    ...createMockShellViewModel(),
    mapPanel: {
      title: "地图",
      focusLabel: "Rail House Hotel Lobby",
      currentLocationId: "hotel_lobby",
      overviewDescription: "当前已知路线围绕旅馆、酒馆和警长办公室展开。",
      currentDescription: "旅馆大厅光线昏暗，楼梯口有人刻意避开视线。",
      currentFacts: [
        {
          label: "出口",
          value: "酒馆、车站、警长办公室"
        }
      ],
      routes: [
        {
          id: "route-hotel",
          sceneId: "hotel_lobby",
          label: "Rail House Hotel Lobby",
          state: "current",
          commandText: "前往 Rail House Hotel Lobby"
        },
        {
          id: "route-saloon",
          sceneId: "saloon",
          label: "The Gilded Spur Saloon",
          state: "known",
          commandText: "前往 The Gilded Spur Saloon"
        }
      ],
      nodes: [
        {
          id: "node-hotel",
          sceneId: "hotel_lobby",
          label: "旅馆",
          isCurrent: true
        },
        {
          id: "node-saloon",
          sceneId: "saloon",
          label: "酒馆",
          isCurrent: false
        }
      ]
    }
  };
}
