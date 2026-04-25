import type { LocalHostStreamEvent } from "@ai-western-town/contracts";
import type { LocalSessionRuntimeState } from "@ai-western-town/ui-sdk";

import type {
  DebugPanelCard,
  MovementItem,
  OpportunityItem,
  SceneFeedEntry,
  ShellViewModel
} from "./shell-view-model";

type SceneDefinition = {
  sceneId: string;
  displayName: string;
  summary: string;
  kicker: string;
  connections: string[];
  movementHint: string;
  opportunities: OpportunityItem[];
};

const sceneDefinitions: Record<string, SceneDefinition> = {
  saloon: {
    sceneId: "saloon",
    displayName: "The Gilded Spur Saloon",
    summary:
      "A busy saloon where gossip, deals, and grudges mix under lamp smoke.",
    kicker: "Starter Town",
    connections: ["hotel_lobby", "sheriff_office"],
    movementHint: "本地移动，先换场再决定观察对象。",
    opportunities: [
      {
        id: "opp-saloon-observe-room",
        kind: "observe",
        title: "观察酒馆气氛",
        detail: "先确认是谁在刻意压住争执。",
        commandText: "观察酒馆里忽然安静下来的那一桌"
      },
      {
        id: "opp-saloon-approach-bartender",
        kind: "approach",
        title: "接近 Mara Holt",
        detail: "酒保往往最早看见不该发生的事。",
        commandText: "走近酒保，看看她刚才在留意谁"
      }
    ]
  },
  sheriff_office: {
    sceneId: "sheriff_office",
    displayName: "Sheriff's Office",
    summary:
      "A cramped civic office with a desk, a lockbox, and too many unanswered questions.",
    kicker: "Starter Town",
    connections: ["saloon", "train_station"],
    movementHint: "转去别处前，先确认这里有没有更明确的痕迹。",
    opportunities: [
      {
        id: "opp-office-inspect-desk",
        kind: "inspect",
        title: "检查桌面",
        detail: "文件、钥匙和空位本身就是线索。",
        commandText: "检查警长办公室桌面上被人动过的东西"
      },
      {
        id: "opp-office-observe-sheriff",
        kind: "observe",
        title: "观察 Jonah Reed",
        detail: "先看他在回避哪个问题。",
        commandText: "观察警长对提到尸体时的反应"
      }
    ]
  },
  hotel_lobby: {
    sceneId: "hotel_lobby",
    displayName: "Rail House Hotel Lobby",
    summary:
      "A worn lobby where travelers rest and local business changes hands quietly.",
    kicker: "Starter Town",
    connections: ["saloon", "train_station"],
    movementHint: "这是适合先观察再决定是否追上的地点。",
    opportunities: [
      {
        id: "opp-hotel-observe-doctor",
        kind: "observe",
        title: "观察 Eliza Wynn",
        detail: "看她是在等人，还是在躲谁。",
        commandText: "观察医生的反应"
      },
      {
        id: "opp-hotel-follow-stairs",
        kind: "follow",
        title: "盯住楼梯口",
        detail: "如果有人突然离场，这里最先露出破绽。",
        commandText: "盯住楼梯口，看看是谁在回避大厅"
      }
    ]
  },
  train_station: {
    sceneId: "train_station",
    displayName: "Dry Creek Station",
    summary:
      "A small platform and ticket room where arrivals can shift the whole town's mood.",
    kicker: "Starter Town",
    connections: ["hotel_lobby", "sheriff_office"],
    movementHint: "适合先确认到站与离站的异常，再决定追人还是回镇上。",
    opportunities: [
      {
        id: "opp-station-eavesdrop-platform",
        kind: "eavesdrop",
        title: "旁听站台低语",
        detail: "看看是谁提起昨晚的到站名单。",
        commandText: "旁听站台上那两个人压低声音说了什么"
      },
      {
        id: "opp-station-inspect-ticket-room",
        kind: "inspect",
        title: "检查票务窗口",
        detail: "窗口边的记录和停顿都可能说明问题。",
        commandText: "检查售票窗口附近刚被翻过的记录"
      }
    ]
  }
};

const defaultLeftPanel = {
  title: "世界侧栏",
  description: "当前状态、事件流和卷宗日志统一收在这里，避免主交互栏被历史信息撑开。",
  placeholderTitle: "当前状态",
  placeholderBody:
    "这里保留当前地点、世界 tick、运行模式和风险提示。后续可接入更完整的状态卡。",
  entries: [
    {
      id: "left-world-log",
      label: "Event Stream",
      title: "世界事件流",
      body: "后续接入远场事件、宿主回执和关键人物反应，作为可回看的短摘要。"
    },
    {
      id: "left-case-index",
      label: "Journal",
      title: "卷宗索引",
      body: "后续可放人物、地点和调查条目索引。"
    }
  ]
} as const;

export function buildLiveShellViewModel(
  runtimeState: LocalSessionRuntimeState
): ShellViewModel {
  const currentSceneId = inferCurrentSceneId(runtimeState);
  const scene = sceneDefinitions[currentSceneId] ?? sceneDefinitions.hotel_lobby;
  const traceSummary = runtimeState.lastTrace ?? findLatestTrace(runtimeState.streamEvents);

  return {
    header: {
      title: "Dead Mesa Main Shell",
      summary:
        "浏览器通过 ui-sdk 连接本地宿主，主栏只服务当前回合，世界信息与系统信息分列两侧。",
      sessionLabel: runtimeState.session
        ? `Session / ${runtimeState.session.sessionId}`
        : "Session / Connecting",
      connectionState:
        runtimeState.connectionState === "live" ? "live" : "connecting",
      connectionLabel:
        runtimeState.connectionState === "live"
          ? "Local Host Attached"
          : "Connecting To Local Host",
      connectionHint: runtimeState.lastError
        ? "最近一次 SSE 或请求失败，页面保留最近可见状态。"
        : "页面状态通过 session.snapshot / world.event / tick.trace 同步。"
    },
    leftPanel: {
      ...defaultLeftPanel,
      entries: [...defaultLeftPanel.entries]
    },
    scene: {
      sceneId: scene.sceneId,
      kicker: scene.kicker,
      title: scene.displayName,
      description: scene.summary,
      timeLabel: `World Tick ${runtimeState.session?.worldTick ?? 0}`,
      locationLabel: scene.displayName,
      runModeLabel: traceSummary?.runModeAfter ?? "free_explore"
    },
    movement: {
      title: "可去地点",
      description: scene.movementHint,
      items: buildMovementItems(scene)
    },
    opportunities: {
      title: "现在可做的事",
      description: "把当前最像下一步的观察和介入动作前置。",
      items: [...scene.opportunities]
    },
    feed: buildFeedEntries(runtimeState),
    suggestions: scene.opportunities.slice(0, 3).map((opportunity) => ({
      id: `suggestion-${opportunity.id}`,
      label: opportunity.title,
      hint: opportunity.detail,
      commandText: opportunity.commandText
    })),
    composer: {
      title: "输入你想做的事",
      description: "你可以直接输入，也可以先用上面的移动与机会动作进入主循环。",
      placeholder: "例如：观察医生的反应，或者前往酒馆",
      draft: "",
      footnote: getMetadataCommandText(runtimeState.lastSubmittedCommand)
        ? `最近提交：${getMetadataCommandText(runtimeState.lastSubmittedCommand)}`
        : "当前等待你的下一步动作。",
      lastSubmittedCommand: getMetadataCommandText(
        runtimeState.lastSubmittedCommand
      )
    },
    debugPanel: {
      title: "系统侧栏",
      description: "右侧只承接 transport、trace 和后续页面入口，不混入主叙事流。",
      cards: buildDebugCards(runtimeState)
    }
  };
}

function inferCurrentSceneId(runtimeState: LocalSessionRuntimeState): string {
  for (const event of [...runtimeState.streamEvents].reverse()) {
    if (event.type === "world.event") {
      return event.event.originSceneId;
    }

    if (
      event.type === "command.accepted" &&
      event.playerCommand.parsedAction.targetLocationId
    ) {
      return event.playerCommand.parsedAction.targetLocationId;
    }
  }

  return (
    runtimeState.lastSubmittedCommand?.parsedAction.targetLocationId ??
    "hotel_lobby"
  );
}

function buildMovementItems(scene: SceneDefinition): MovementItem[] {
  return scene.connections
    .map((sceneId) => sceneDefinitions[sceneId])
    .filter((entry): entry is SceneDefinition => entry !== undefined)
    .map((entry) => ({
      id: `move-${scene.sceneId}-${entry.sceneId}`,
      sceneId: entry.sceneId,
      label: entry.displayName,
      hint: "本地移动 lead",
      commandText: `前往 ${entry.displayName}`
    }));
}

function buildFeedEntries(
  runtimeState: LocalSessionRuntimeState
): SceneFeedEntry[] {
  const entries: SceneFeedEntry[] = [];
  const lastSubmittedText = getMetadataCommandText(runtimeState.lastSubmittedCommand);
  const lastSubmittedCommandId = runtimeState.lastSubmittedCommand?.commandId;

  if (runtimeState.lastSubmittedCommand && lastSubmittedText) {
    entries.push({
      id: `player-${runtimeState.lastSubmittedCommand.commandId}`,
      role: "player",
      label: "你",
      timestamp: "刚刚",
      body: lastSubmittedText
    });
  }

  for (const event of runtimeState.streamEvents) {
    if (event.type === "command.accepted") {
      if (
        lastSubmittedCommandId &&
        event.playerCommand.commandId !== lastSubmittedCommandId
      ) {
        continue;
      }

      entries.push({
        id: `accepted-${event.eventId}`,
        role: "system",
        label: "宿主已接收",
        timestamp: `Seq ${event.sequence}`,
        body: `命令已进入本地宿主：${getCommandText(event.playerCommand)}`
      });
    }

    if (event.type === "world.event") {
      if (
        lastSubmittedCommandId &&
        event.event.sourceCommandId !== lastSubmittedCommandId
      ) {
        continue;
      }

      entries.push({
        id: `event-${event.event.eventId}`,
        role: "scene",
        label: "世界后果",
        timestamp: `Tick ${event.event.worldTick}`,
        body:
          event.event.summary ??
          `${event.event.eventType} @ ${event.event.originSceneId}`
      });
    }
  }

  if (entries.length > 0) {
    return entries.slice(-3);
  }

  return [
    {
      id: "boot-scene",
      role: "scene",
      label: "场景",
      timestamp: "等待连接",
      body: "Local host 接通后，这里会按“玩家命令 -> 宿主接收 -> 世界后果”持续刷新。"
    }
  ];
}

function buildDebugCards(
  runtimeState: LocalSessionRuntimeState
): DebugPanelCard[] {
  const latestTrace =
    runtimeState.lastTrace ?? findLatestTrace(runtimeState.streamEvents);

  return [
    {
      id: "debug-transport",
      title: "Transport State",
      description: `connection=${runtimeState.connectionState}; session=${runtimeState.session?.sessionId ?? "pending"}; tick=${runtimeState.session?.worldTick ?? 0}`,
      status: runtimeState.connectionState === "live" ? "mock" : "placeholder",
      statusLabel: runtimeState.connectionState === "live" ? "Live" : "Connecting"
    },
    {
      id: "debug-trace",
      title: "Latest Trace",
      description: latestTrace
        ? `trace=${latestTrace.traceId}; runMode=${latestTrace.runModeAfter}; appended=${latestTrace.appendedEventIds.length}`
        : "尚未收到 tick.trace。",
      status: latestTrace ? "mock" : "placeholder",
      statusLabel: latestTrace ? "Trace" : "Waiting"
    },
    {
      id: "debug-errors",
      title: "Runtime Guard",
      description: runtimeState.lastError
        ? `lastError=${String(runtimeState.lastError)}`
        : "当前没有记录到 transport 错误。",
      status: runtimeState.lastError ? "locked" : "placeholder",
      statusLabel: runtimeState.lastError ? "Check" : "Clear"
    }
  ];
}

function findLatestTrace(streamEvents: LocalHostStreamEvent[]) {
  for (const event of [...streamEvents].reverse()) {
    if (event.type === "tick.trace") {
      return event.trace;
    }
  }

  return undefined;
}

function getCommandText(command: {
  metadata?: {
    commandText?: unknown;
  };
  commandType: string;
}): string {
  return getMetadataCommandText(command) ?? command.commandType;
}

function getMetadataCommandText(command?: {
  metadata?: {
    commandText?: unknown;
  };
}): string | undefined {
  return typeof command?.metadata?.commandText === "string"
    ? command.metadata.commandText
    : undefined;
}
