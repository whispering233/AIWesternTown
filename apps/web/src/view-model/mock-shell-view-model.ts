import type { SceneFeedEntry, ShellViewModel } from "./shell-view-model";

export function createMockShellViewModel(): ShellViewModel {
  return {
    header: {
      title: "AI WESTERN TOWN",
      summary: "浏览器壳层只消费 view model。左侧承载状态与卷宗，中间保持叙事交互，右侧承接地图和移动入口。",
      sessionLabel: "session draft_01",
      connectionState: "mock",
      connectionLabel: "connected",
      connectionHint: "SSE 与会话状态会继续停留在这条文档元信息线上。"
    },
    leftPanel: {
      title: "Context",
      description: "玩家状态、日志和人物卡统一收在左栏，不打断主栏叙事。",
      placeholderTitle: "当前状态",
      placeholderBody:
        "当前先保留状态页骨架。等世界日志、事件编年或调查索引接入后，它会沿用同一套编辑式视觉语言。",
      statusItems: [
        {
          id: "status-location",
          title: "当前位置",
          body: "Dust Crossing / Main Street"
        },
        {
          id: "status-items",
          title: "携带物",
          body: "旧车票、半截火柴、一枚没有登记的旅店钥匙。"
        },
        {
          id: "status-risk",
          title: "当前张力",
          body: "中。酒馆门口的沉默正在吸引旁人注意。"
        }
      ],
      logEntries: [
        {
          id: "log-arrival",
          label: "WT 00",
          title: "抵达街口",
          body: "你从马车下来时，酒馆前的争执忽然停住。"
        },
        {
          id: "log-clinic",
          label: "WT 01",
          title: "诊所异动",
          body: "诊所窗帘在黄昏突然落下，里面有人影退开。"
        }
      ],
      characters: [
        {
          id: "mara-holt",
          name: "Mara Holt",
          role: "bartender / watcher",
          initial: "M",
          detail: "她比镇上多数人更早注意到你，也更愿意把秘密藏在闲聊里。"
        },
        {
          id: "jonah-reed",
          name: "Jonah Reed",
          role: "sheriff / evasive",
          initial: "J",
          detail: "警长办公室的锁盒少了一把钥匙，他还没有决定是否承认这件事。"
        },
        {
          id: "eliza-wynn",
          name: "Eliza Wynn",
          role: "doctor / unsettled",
          initial: "E",
          detail: "她盯着楼梯口，像是在等人离开，又像是在怕某人回来。"
        }
      ],
      entries: [
        {
          id: "left-world-log",
          label: "Event Stream",
          title: "世界事件流",
          body: "未来展示时间线式世界事件、远场变化和编年记录。"
        },
        {
          id: "left-index",
          label: "Journal",
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
      description: "当前命令可以直接输入，移动统一放在右侧地图栏。",
      placeholder: "例如：观察吧台边的人，或者跟上刚离开酒馆的医生",
      draft: "",
      footnote: "当前为浏览器壳层演示。"
    },
    mapPanel: {
      title: "地图",
      focusLabel: "Dust Crossing / Main Street",
      currentLocationId: "dust-crossing",
      overviewDescription:
        "当前行动区围绕主街、酒馆、马厩和诊所展开。暖色节点表示当前场景。",
      currentDescription:
        "尘土街口正好夹在酒馆、马厩和诊所之间。这里适合先观察，再决定靠近谁。",
      currentFacts: [
        {
          label: "出口",
          value: "酒馆、马厩、诊所外廊"
        },
        {
          label: "风险",
          value: "中。继续停留会让门口的人重新注意到你。"
        },
        {
          label: "线索",
          value: "窗帘落下、马厩响动、被打断的争执。"
        }
      ],
      routes: [
        {
          id: "route-dust-crossing",
          sceneId: "dust-crossing",
          label: "尘土街口",
          state: "current",
          commandText: "前往尘土街口"
        },
        {
          id: "route-saloon",
          sceneId: "saloon",
          label: "走进酒馆",
          state: "known",
          commandText: "前往酒馆"
        },
        {
          id: "route-stable",
          sceneId: "stable",
          label: "靠近马厩",
          state: "lead",
          commandText: "走近马厩"
        }
      ],
      nodes: [
        {
          id: "node-dust-crossing",
          sceneId: "dust-crossing",
          label: "街口",
          isCurrent: true
        },
        {
          id: "node-saloon",
          sceneId: "saloon",
          label: "酒馆",
          isCurrent: false
        },
        {
          id: "node-stable",
          sceneId: "stable",
          label: "马厩",
          isCurrent: false
        }
      ]
    },
    debugPanel: {
      title: "系统侧栏",
      description: "调试信息保留独立挂点，不再进入主界面右侧地图栏。",
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
