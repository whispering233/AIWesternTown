import type { OpportunityItem } from "./shell-view-model";

import type { PlayerCommandEnvelope } from "@ai-western-town/contracts";

export function createMoveCommand(
  targetSceneId: string,
  issuedAtTick: number,
  commandText = `前往 ${targetSceneId}`
): PlayerCommandEnvelope {
  return {
    commandId: crypto.randomUUID(),
    commandType: "move",
    parsedAction: {
      actionClass: "travel",
      actionType: "travel",
      targetSceneId,
      targetLocationId: targetSceneId,
      tags: ["travel"]
    },
    issuedAtTick,
    consumesTick: false,
    metadata: {
      commandText
    }
  };
}

export function createObserveCommand(
  actionType: string,
  targetActorId: string | undefined,
  commandText: string,
  issuedAtTick: number,
  targetLocationId?: string
): PlayerCommandEnvelope {
  const parsedAction: PlayerCommandEnvelope["parsedAction"] = {
    actionClass: "investigate",
    actionType,
    tags: ["observe"]
  };

  if (targetActorId !== undefined) {
    parsedAction.targetActorId = targetActorId;
    parsedAction.targetNpcId = targetActorId;
  }

  if (targetLocationId !== undefined) {
    parsedAction.targetLocationId = targetLocationId;
    parsedAction.targetSceneId = targetLocationId;
  }

  return {
    commandId: crypto.randomUUID(),
    commandType: "observe",
    parsedAction,
    issuedAtTick,
    consumesTick: true,
    metadata: {
      commandText
    }
  };
}

export function createOpportunityCommand(
  opportunity: OpportunityItem,
  issuedAtTick: number,
  targetLocationId?: string
): PlayerCommandEnvelope {
  const isSocialOpportunity =
    opportunity.kind === "approach" || opportunity.kind === "interrupt";
  const commandType = isSocialOpportunity ? "social" : "observe";
  const parsedAction: PlayerCommandEnvelope["parsedAction"] = {
    actionClass: isSocialOpportunity ? "intervene" : "investigate",
    actionType: opportunity.kind,
    tags: [opportunity.kind]
  };

  if (targetLocationId !== undefined) {
    parsedAction.targetLocationId = targetLocationId;
    parsedAction.targetSceneId = targetLocationId;
  }

  return {
    commandId: crypto.randomUUID(),
    commandType,
    parsedAction,
    issuedAtTick,
    consumesTick: true,
    metadata: {
      commandText: opportunity.commandText
    }
  };
}

export function createFreeTextCommand(
  commandText: string,
  issuedAtTick: number,
  targetLocationId?: string
): PlayerCommandEnvelope {
  const parsedAction: PlayerCommandEnvelope["parsedAction"] = {
    actionClass: "investigate",
    actionType: "free_text",
    tags: ["free_text"]
  };

  if (targetLocationId !== undefined) {
    parsedAction.targetLocationId = targetLocationId;
    parsedAction.targetSceneId = targetLocationId;
  }

  return {
    commandId: crypto.randomUUID(),
    commandType: "observe",
    parsedAction,
    issuedAtTick,
    consumesTick: true,
    metadata: {
      commandText
    }
  };
}
