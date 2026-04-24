import type {
  GameCoreParsedPlayerAction,
  KnownItemResolutionMode,
  PlayerActionExecutionPolicy,
  PlayerStepContext,
  WorldTickReason
} from "./types.js";

const REPOSITION_TICK_TAGS = new Set([
  "observe_intent",
  "exposure_risk",
  "risky_reposition"
]);

const SOCIAL_ITEM_MODES = new Set<KnownItemResolutionMode>(["social_request"]);

function asActionClass(action: GameCoreParsedPlayerAction): string {
  if (action.actionClass) {
    return action.actionClass;
  }

  if (action.itemActionType) {
    return "item";
  }

  return "free_explore";
}

function resolveItemWorldTickReason(
  mode?: string
): Exclude<WorldTickReason, "no_tick" | "investigation_cost" | "social_intervention" | "windowed_travel" | "reposition_cost"> | "no_tick" {
  switch (mode) {
    case "direct":
      return "item_direct_transfer";
    case "social_request":
      return "item_social_request";
    case "covert":
      return "item_covert_operation";
    case "effect":
      return "item_effect_trigger";
    default:
      return "no_tick";
  }
}

export function getTargetSceneId(
  action: GameCoreParsedPlayerAction
): string | undefined {
  return action.targetSceneId ?? action.targetLocationId;
}

export function getTargetNpcId(
  action: GameCoreParsedPlayerAction
): string | undefined {
  return action.targetNpcId ?? action.targetActorId;
}

export function resolvePlayerActionPolicy(
  action: GameCoreParsedPlayerAction,
  _sceneContext?: PlayerStepContext
): PlayerActionExecutionPolicy {
  const actionClass = asActionClass(action);

  switch (actionClass) {
    case "investigate":
      return {
        consumesTick: true,
        worldTickReason: "investigation_cost",
        resultingRunMode: "free_explore"
      };

    case "intervene":
      return {
        consumesTick: true,
        worldTickReason: "social_intervention",
        resultingRunMode: "focused_dialogue"
      };

    case "travel":
      return action.urgencyTag === "windowed" || action.urgencyTag === "critical"
        ? {
            consumesTick: true,
            worldTickReason: "windowed_travel",
            resultingRunMode: "free_explore"
          }
        : {
            consumesTick: false,
            worldTickReason: "no_tick",
            resultingRunMode: "free_explore"
          };

    case "reposition": {
      const tags = new Set(action.tags ?? []);
      const consumesTick = [...REPOSITION_TICK_TAGS].some((tag) => tags.has(tag));

      return {
        consumesTick,
        worldTickReason: consumesTick ? "reposition_cost" : "no_tick",
        resultingRunMode: "free_explore"
      };
    }

    case "item": {
      const worldTickReason = resolveItemWorldTickReason(
        action.itemResolutionMode
      );
      const consumesTick = worldTickReason !== "no_tick";

      return {
        consumesTick,
        worldTickReason,
        resultingRunMode:
          action.itemResolutionMode &&
          SOCIAL_ITEM_MODES.has(action.itemResolutionMode)
            ? "focused_dialogue"
            : "free_explore"
      };
    }

    case "free_explore":
    default:
      return {
        consumesTick: false,
        worldTickReason: "no_tick",
        resultingRunMode: "free_explore"
      };
  }
}
