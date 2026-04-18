# NPC 认知循环流程图

## 1. 文档目标

本文档以流程图方式展示 `AIWesternTown` 项目当前版本的 NPC 认知循环设计，供设计审阅、实现对齐和后续讨论使用。

本文档不替代 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 的正式规范，只负责把已确定的主链路、长期记忆读取支路和执行后闭环可视化。

## 2. 主认知循环总览

```mermaid
flowchart TD
    T0["Tick Start"] --> P0["Cycle Prefetch<br/>轻量背景激活"]
    P0 --> P["Perceive<br/>感知当前刺激"]
    P --> A["Appraise<br/>评价主观意义"]
    A --> WM["Update Working Memory<br/>更新短时焦点"]
    WM --> G["Goal Arbitration<br/>仲裁主导目标"]
    G --> S["Action Selection<br/>选择当前动作"]
    S --> X["Act<br/>执行并生成权威结果"]
    X --> R["Reflect<br/>解释结果意义"]
    R --> C["Compress<br/>压缩并写入长期记忆"]
    C --> T1["Tick End / Next Tick"]
```

## 3. 长期记忆读取支路

```mermaid
flowchart LR
    LTM["Long-term Memory Store<br/>长期记忆库"] --> RET["Memory Retrieval Engine<br/>统一读取层"]
    IDX["retrievalSummary<br/>读取索引层"] --> RET

    QS0["Cycle Prefetch Query"] --> RET
    QS1["Perceive Query"] --> RET
    QS2["Appraise Query"] --> RET
    QS3["Reflect Query"] --> RET

    RET --> CTX["TickMemoryReadContext<br/>本 tick 读取上下文"]
    CTX --> PF["PrefetchBuffer"]
    CTX --> CACHE["StageRetrievalCache"]
    CTX --> LEDGER["RetrievalLedger"]

    PF --> P["Perceive"]
    PF --> A["Appraise"]
    PF --> R["Reflect"]

    CACHE --> A
    CACHE --> R

    RET --> PM["RetrievedMemorySlice"]
    RET --> AB["RetrievedBeliefSlice"]
    RET --> RM["ReflectionRetrievedMemorySlice"]

    PM --> P
    AB --> A
    RM --> R
```

## 4. 阶段读取权限图

```mermaid
flowchart TD
    LTM["长期记忆读取能力"] --> P["Perceive<br/>允许"]
    LTM --> A["Appraise<br/>允许"]
    LTM --> R["Reflect<br/>允许"]

    LTM -.禁止直接读取.-> WM["Update Working Memory"]
    LTM -.禁止直接读取.-> G["Goal Arbitration"]
    LTM -.禁止直接读取.-> S["Action Selection"]
    LTM -.禁止直接读取.-> X["Act"]

    C["Compress"] -.仅允许相似记忆检索<br/>用于去重/合并/强化.-> LTM
```

## 5. 执行后闭环

```mermaid
flowchart TD
    S["ActionSelectionResult"] --> X["Act"]
    X --> XR["ActionExecutionResult"]
    X --> EV["WorldEventRecord[]"]
    X --> MU["StateMutation[]"]

    XR --> R["Reflect"]
    EV --> R

    R --> RR["ReflectionResult"]
    R --> MC["ReflectionMemoryCandidate[]"]
    R --> WE["ReflectionWorkingMemoryEffect"]

    RR --> C["Compress"]
    MC --> C

    C --> CR["CompressionResult"]
    C --> NEW["新增/合并/强化后的长期记忆"]
    C --> SUM["retrievalSummary"]

    NEW --> LTM["Long-term Memory Store"]
    SUM --> IDX["读取索引层"]

    WE --> NXT["下一轮 Working Memory 更新器"]
    LTM --> NXT2["下一轮 Cycle Prefetch / Stage Retrieval"]
    IDX --> NXT2
```

## 6. 单 Tick 读取顺序

```mermaid
sequenceDiagram
    participant Tick as Tick Start
    participant Prefetch as Cycle Prefetch
    participant Retrieve as Memory Retrieval Engine
    participant Ctx as TickMemoryReadContext
    participant Perceive as Perceive
    participant Appraise as Appraise
    participant Reflect as Reflect

    Tick->>Prefetch: build_prefetch_query()
    Prefetch->>Retrieve: prefetchMemories(query)
    Retrieve-->>Ctx: prefetchedHits

    Perceive->>Ctx: read prefetchedHits
    alt 背景激活不足
        Perceive->>Retrieve: retrieveMemoriesForStage(perceive query)
        Retrieve-->>Ctx: cache perceive result
    end
    Perceive-->>Perceive: 生成 RetrievedMemorySlice

    Appraise->>Ctx: read prefetchedHits + stageCache
    alt 评价上下文不足
        Appraise->>Retrieve: retrieveMemoriesForStage(appraise query)
        Retrieve-->>Ctx: cache appraise result
    end
    Appraise-->>Appraise: 生成 RetrievedBeliefSlice

    Reflect->>Ctx: read prefetchedHits + stageCache
    alt 需要模式回看
        Reflect->>Retrieve: retrieveMemoriesForStage(reflect query)
        Retrieve-->>Ctx: cache reflect result
    end
    Reflect-->>Reflect: 写入 ReflectionBeliefSlice.retrievedMemories
```

## 7. 审阅重点

- 主链路是否清晰体现 `Perceive -> Appraise -> Update Working Memory -> Goal Arbitration -> Action Selection -> Act -> Reflect -> Compress`
- 长期记忆是否只在 `Perceive / Appraise / Reflect` 读取，而不是所有阶段都可读
- `Act -> Reflect -> Compress -> 下一轮检索` 是否形成稳定闭环
- 同一 tick 内的读取是否通过 `TickMemoryReadContext` 统一管理，而不是阶段各自直接查库
