import assert from "node:assert/strict";
import test from "node:test";

import React, { type ReactNode } from "react";

import type {
  MovementItem,
  OpportunityItem
} from "../view-model/shell-view-model";
import { PlayableLoopPanel } from "./playable-loop-panel";

type ButtonElement = React.ReactElement<{
  onClick?: () => void;
  children?: ReactNode;
}>;

test("renders movement and opportunity actions and calls submit handlers", async () => {
  const clicked: string[] = [];
  const movement: MovementItem[] = [
    {
      id: "move-saloon",
      sceneId: "saloon",
      label: "The Gilded Spur Saloon",
      hint: "本地移动 lead",
      commandText: "前往 The Gilded Spur Saloon"
    }
  ];
  const opportunities: OpportunityItem[] = [
    {
      id: "opp-observe-doctor",
      kind: "observe",
      title: "观察 Eliza Wynn",
      detail: "看她是在等人，还是在躲谁。",
      commandText: "观察医生的反应"
    }
  ];

  const element = PlayableLoopPanel({
    movement,
    opportunities,
    onMovementSelect: (item) => clicked.push(`move:${item.sceneId}`),
    onOpportunitySelect: (item) => clicked.push(`opp:${item.id}`)
  });

  const buttons = findButtons(element);
  assert.equal(buttons.length, 2);

  const [movementButton, opportunityButton] = buttons;
  assert.ok(movementButton?.props.onClick);
  assert.ok(opportunityButton?.props.onClick);

  movementButton.props.onClick();
  opportunityButton.props.onClick();

  assert.deepEqual(clicked, ["move:saloon", "opp:opp-observe-doctor"]);
});

function findButtons(node: ReactNode): ButtonElement[] {
  const buttons: ButtonElement[] = [];

  visit(node, buttons);

  return buttons;
}

function visit(node: ReactNode, buttons: ButtonElement[]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      visit(child, buttons);
    }

    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  if (node.type === "button") {
    buttons.push(node as ButtonElement);
  }

  visit((node.props as { children?: ReactNode }).children, buttons);
}
