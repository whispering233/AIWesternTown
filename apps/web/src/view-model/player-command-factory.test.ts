import assert from "node:assert/strict";
import test from "node:test";

import {
  createMoveCommand,
  createObserveCommand,
  createOpportunityCommand,
  createFreeTextCommand
} from "./player-command-factory";

test("createMoveCommand builds a non-ticking travel envelope", () => {
  const command = createMoveCommand("hotel_lobby", 3);

  assert.equal(command.commandType, "move");
  assert.equal(command.parsedAction.actionClass, "travel");
  assert.equal(command.parsedAction.actionType, "travel");
  assert.equal(command.parsedAction.targetSceneId, "hotel_lobby");
  assert.equal(command.parsedAction.targetLocationId, "hotel_lobby");
  assert.equal(command.issuedAtTick, 3);
  assert.equal(command.consumesTick, false);
});

test("createObserveCommand builds a ticking observe envelope", () => {
  const command = createObserveCommand(
    "observe-doctor",
    "doctor",
    "观察医生的反应",
    5
  );

  assert.equal(command.commandType, "observe");
  assert.equal(command.parsedAction.actionClass, "investigate");
  assert.equal(command.parsedAction.actionType, "observe-doctor");
  assert.equal(command.parsedAction.targetNpcId, "doctor");
  assert.equal(command.parsedAction.targetActorId, "doctor");
  assert.equal(command.metadata?.commandText, "观察医生的反应");
  assert.equal(command.issuedAtTick, 5);
  assert.equal(command.consumesTick, true);
});

test("createOpportunityCommand maps approach actions to social commands", () => {
  const command = createOpportunityCommand(
    {
      id: "opp-approach-bartender",
      kind: "approach",
      title: "接近 Mara Holt",
      detail: "酒保比任何人都更快察觉异样。",
      commandText: "接近酒保，看看她刚才在留意谁"
    },
    7,
    "saloon"
  );

  assert.equal(command.commandType, "social");
  assert.equal(command.parsedAction.actionClass, "intervene");
  assert.equal(command.parsedAction.targetSceneId, "saloon");
  assert.equal(command.parsedAction.targetLocationId, "saloon");
  assert.equal(command.metadata?.commandText, "接近酒保，看看她刚才在留意谁");
});

test("createFreeTextCommand keeps arbitrary input submit-able", () => {
  const command = createFreeTextCommand(
    "跟上刚离开大厅的医生",
    9,
    "hotel_lobby"
  );

  assert.equal(command.commandType, "observe");
  assert.equal(command.parsedAction.actionClass, "investigate");
  assert.equal(command.parsedAction.actionType, "free_text");
  assert.equal(command.parsedAction.targetSceneId, "hotel_lobby");
  assert.equal(command.parsedAction.targetLocationId, "hotel_lobby");
  assert.equal(command.metadata?.commandText, "跟上刚离开大厅的医生");
});
