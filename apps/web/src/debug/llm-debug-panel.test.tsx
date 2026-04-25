import assert from "node:assert/strict";
import test from "node:test";

import React, { type ReactNode } from "react";

import {
  createEmptyLLMDebugPanelModel,
  LLMDebugPanel,
  type LLMDebugPanelModel
} from "./llm-debug-panel";

type ButtonElement = React.ReactElement<{
  onClick?: () => void;
  children?: ReactNode;
}>;

test("renders llm call list, prompt, raw output, and parsed fallback sections", () => {
  const selectedRecordIds: string[] = [];
  const element = LLMDebugPanel({
    model: createPanelModel(),
    onSelectCall: (recordId) => selectedRecordIds.push(recordId)
  });

  const text = collectText(element).join(" ");

  assert.match(text, /LLM Calls/);
  assert.match(text, /visible_outcome_render/);
  assert.match(text, /Prompt/);
  assert.match(text, /Raw Output/);
  assert.match(text, /Parsed \/ Fallback/);
  assert.match(text, /Return JSON only/);
  assert.match(text, /guard_rejected_forbidden_field/);

  const buttons = findButtons(element);
  assert.equal(buttons.length, 2);

  buttons[1]?.props.onClick?.();

  assert.deepEqual(selectedRecordIds, ["llm-record-older"]);
});

test("renders a stable empty state when no llm calls are available", () => {
  const element = LLMDebugPanel({
    model: createEmptyLLMDebugPanelModel()
  });

  const text = collectText(element).join(" ");

  assert.match(text, /No LLM calls recorded yet/);
});

function createPanelModel(): LLMDebugPanelModel {
  return {
    title: "LLM Calls",
    description: "最近模型调用",
    emptyMessage: "No LLM calls recorded yet.",
    calls: [
      {
        recordId: "llm-record-selected",
        traceId: "llm-trace-selected",
        requestId: "req-selected",
        taskKind: "visible_outcome_render",
        stageName: "act",
        providerLabel: "local / local-model",
        statusLabel: "fallback",
        startedAtLabel: "2026-04-25T10:00:00.000Z",
        durationLabel: "125ms",
        worldTickLabel: "Tick 185",
        npcLabel: "npc-doctor",
        isSelected: true
      },
      {
        recordId: "llm-record-older",
        traceId: "llm-trace-older",
        requestId: "req-older",
        taskKind: "visible_outcome_render",
        stageName: "act",
        providerLabel: "mock / local-model",
        statusLabel: "success",
        startedAtLabel: "2026-04-25T09:59:00.000Z",
        durationLabel: "18ms",
        worldTickLabel: "Tick 184",
        npcLabel: "npc-bartender",
        isSelected: false
      }
    ],
    selectedCall: {
      recordId: "llm-record-selected",
      traceId: "llm-trace-selected",
      requestId: "req-selected",
      title: "visible_outcome_render / act",
      subtitle: "local / local-model",
      prompt: {
        messageCountLabel: "2 messages",
        budgetLabel: "700 in / 160 out",
        messages: [
          {
            role: "system",
            contentLengthLabel: "17 chars",
            contentPreview: "Return JSON only."
          },
          {
            role: "user",
            contentLengthLabel: "42 chars",
            contentPreview: "Render the resolved visible outcome."
          }
        ]
      },
      rawOutput: {
        finishReasonLabel: "stop",
        providerLabel: "local / local-model",
        tokenUsageLabel: "31 in / 9 out",
        rawTextLengthLabel: "29 chars",
        rawTextPreview: "{\"actionType\":\"leave_scene\"}"
      },
      parsedFallback: {
        invocationDecision: "authorized_and_needed",
        parseResult: "schema_violation",
        fallbackReason: "guard_rejected_forbidden_field",
        trimmedBlocksLabel: "history_2",
        persistedLabel: "memory only"
      }
    }
  };
}

function collectText(node: ReactNode): string[] {
  const values: string[] = [];

  visitText(node, values);

  return values;
}

function visitText(node: ReactNode, values: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      visitText(child, values);
    }

    return;
  }

  if (typeof node === "string" || typeof node === "number") {
    values.push(String(node));
    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  const renderedComponent = renderFunctionComponent(node);

  if (renderedComponent !== undefined) {
    visitText(renderedComponent, values);
    return;
  }

  visitText((node.props as { children?: ReactNode }).children, values);
}

function findButtons(node: ReactNode): ButtonElement[] {
  const buttons: ButtonElement[] = [];

  visitButtons(node, buttons);

  return buttons;
}

function visitButtons(node: ReactNode, buttons: ButtonElement[]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      visitButtons(child, buttons);
    }

    return;
  }

  if (!React.isValidElement(node)) {
    return;
  }

  const renderedComponent = renderFunctionComponent(node);

  if (renderedComponent !== undefined) {
    visitButtons(renderedComponent, buttons);
    return;
  }

  if (node.type === "button") {
    buttons.push(node as ButtonElement);
  }

  visitButtons((node.props as { children?: ReactNode }).children, buttons);
}

function renderFunctionComponent(
  node: React.ReactElement
): ReactNode | undefined {
  if (typeof node.type !== "function") {
    return undefined;
  }

  const componentType = node.type as {
    (props: Record<string, unknown>): ReactNode;
    prototype?: {
      isReactComponent?: unknown;
    };
  };

  if (componentType.prototype?.isReactComponent) {
    return undefined;
  }

  return componentType(node.props as Record<string, unknown>);
}
