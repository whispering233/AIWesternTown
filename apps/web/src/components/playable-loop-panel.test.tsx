import assert from "node:assert/strict";
import test from "node:test";

import React, { type ReactNode } from "react";

import type { OpportunityItem } from "../view-model/shell-view-model";
import { PlayableLoopPanel } from "./playable-loop-panel";

type ButtonElement = React.ReactElement<{
  onClick?: () => void;
  children?: ReactNode;
}>;

test("renders generated choice actions and calls submit handlers", async () => {
  const clicked: string[] = [];
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
    opportunities,
    onOpportunitySelect: (item) => clicked.push(`opp:${item.id}`)
  });

  const buttons = findButtons(element);
  assert.equal(buttons.length, 1);

  const [opportunityButton] = buttons;
  assert.ok(opportunityButton?.props.onClick);
  assert.deepEqual(flattenText(opportunityButton.props.children), [
    "01",
    "观察 Eliza Wynn"
  ]);

  opportunityButton.props.onClick();

  assert.deepEqual(clicked, ["opp:opp-observe-doctor"]);
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

function flattenText(node: ReactNode): string[] {
  const text: string[] = [];

  collectText(node, text);

  return text;
}

function collectText(node: ReactNode, text: string[]): void {
  if (typeof node === "string") {
    text.push(node);
    return;
  }

  if (typeof node === "number") {
    text.push(String(node));
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectText(child, text);
    }

    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  collectText((node.props as { children?: ReactNode }).children, text);
}
