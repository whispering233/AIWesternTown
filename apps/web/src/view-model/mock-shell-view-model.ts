import type { SceneFeedEntry, ShellViewModel } from "./shell-view-model";

export function createMockShellViewModel(): ShellViewModel {
  return {
    header: {
      title: "Dead Mesa Web Shell",
      summary: "浏览器壳层只消费 view model。左侧为未来内容位，中间保持当前主叙事区，右侧调试区可独立隐藏。",
      sessionLabel: "Session / Draft 01",
      connectionState: "mock",
      connectionLabel: "Mock Session Attached",
      connectionHint: "SSE 与会话状态会继续停留在这条文档元信息线上。"
    },
    leftPanel: {
      title: "左侧预留区",
      description: "这块内容位不参与当前主场景切换，后续可单独承载世界日志流或其他文档式页面。",
      placeholderTitle: "世界日志流 / Reserved",
      placeholderBody:
        "当前先保留为空白内容页骨架。等世界日志、事件编年或调查索引接入后，它会沿用同一套编辑式视觉语言。",
      entries: [
        {
          id: "left-world-log",
          label: "Reserved",
          title: "世界日志流",
          body: "未来展示时间线式世界事件、远场变化和编年记录。"
        },
        {
          id: "left-index",
          label: "Later",
          title: "卷宗索引",
          body: "也可以在这里承接人物索引、地点索引或调查条目。"
        }
      ]
    },
    scene: {
      sceneId: "dust-crossing",
      kicker: "Starter Town",
      title: "尘土街口，黄昏压到窗棂边",
      description:
        "你刚从马车上下来，酒馆门前的争执像被谁强行掐断。马厩里有受惊的响动，诊所窗帘却在这个时辰突然落下。",
      timeLabel: "Day 1 · Dusk",
      locationLabel: "Dust Crossing / Main Street",
      runModeLabel: "free_explore"
    },
    movement: {
      title: "可去地点",
      description: "把移动放到主循环顶部，方便先走位再决定观察方向。",
      items: [
        {
          id: "move-saloon",
          sceneId: "saloon",
          label: "走进酒馆",
          hint: "本地移动，不推进世界",
          commandText: "前往酒馆"
        },
        {
          id: "move-stable",
          sceneId: "stable",
          label: "靠近马厩",
          hint: "先缩短距离，再看动静来源",
          commandText: "走近马厩"
        }
      ]
    },
    opportunities: {
      title: "现在可做的事",
      description: "把最像第一步的观察和接近动作前置，不让它们埋在结果流里。",
      items: [
        {
          id: "opp-observe-saloon-door",
          kind: "observe",
          title: "观察酒馆门口",
          detail: "先看那两个人是谁在刻意沉默。",
          commandText: "观察酒馆门口那两个人的反应"
        },
        {
          id: "opp-inspect-clinic",
          kind: "inspect",
          title: "检查诊所窗帘",
          detail: "确认窗帘后有没有人影或异动。",
          commandText: "抬头看诊所的窗帘后面有没有人影"
        }
      ]
    },
    feed: [
      {
        id: "scene-1",
        role: "scene",
        label: "场景",
        timestamp: "刚进入",
        body:
          "你看到酒馆门口站着两个人，一个捏着帽檐不说话，另一个像是刚把一场争执咽了回去。"
      },
      {
        id: "scene-2",
        role: "system",
        label: "机会",
        timestamp: "可行动",
        body:
          "可疑目标正在浮出：酒馆门口的沉默、诊所突然拉下的窗帘、马厩里被惊动的动静。"
      }
    ],
    suggestions: [
      {
        id: "suggestion-1",
        label: "观察酒馆门口",
        hint: "机会动作会同步出现在主循环面板",
        commandText: "观察酒馆门口那两个人的反应"
      },
      {
        id: "suggestion-2",
        label: "走近马厩",
        hint: "移动 leads 会优先出现在场景头部",
        commandText: "走近马厩，看看刚才是什么动静"
      },
      {
        id: "suggestion-3",
        label: "检查诊所",
        hint: "保留自由输入作为补充入口",
        commandText: "抬头看诊所的窗帘后面有没有人影"
      }
    ],
    composer: {
      title: "输入你想做的事",
      description: "当前命令既可以直接输入，也可以从上面的移动与机会动作进入。",
      placeholder: "例如：观察吧台边的人，或者跟上刚离开酒馆的医生",
      draft: "",
      footnote: "当前为浏览器壳层演示。"
    },
    debugPanel: {
      title: "调试侧栏",
      description: "调试信息仍然保留独立挂点，但视觉上会与主文档语言保持一致，而不是形成深色工具岛。",
      cards: [
        {
          id: "debug-transport",
          title: "Transport State",
          description: "预留 SSE 连接状态、最近一次事件 ID 和会话标识。",
          status: "placeholder",
          statusLabel: "占位"
        },
        {
          id: "debug-trace",
          title: "Trace Preview",
          description: "预留最近命令、回执摘要和调试详情入口。",
          status: "mock",
          statusLabel: "Mock"
        },
        {
          id: "debug-route",
          title: "Debug Route Handoff",
          description: "未来可以从这里跳转到更完整的调试页或子页面。",
          status: "locked",
          statusLabel: "Later"
        }
      ]
    }
  };
}

export function buildMockCommandEcho(commandText: string): SceneFeedEntry {
  return {
    id: `echo-${Date.now()}`,
    role: "system",
    label: "壳层回执",
    timestamp: "本地模拟",
    body: `已接收命令：“${commandText}”。当前仍是前端假数据模式，后续这里会替换为真实的会话回执和事件流。`
  };
}
