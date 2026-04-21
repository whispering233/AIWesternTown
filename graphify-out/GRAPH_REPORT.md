# Graph Report - .  (2026-04-21)

## Corpus Check
- Corpus is ~34,803 words - fits in a single context window. You may not need a graph.

## Summary
- 995 nodes · 1109 edges · 34 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Npc  Tick|Npc / Tick]]
- [[_COMMUNITY_Perceive  Appraise  Reflect|Perceive / Appraise / Reflect]]
- [[_COMMUNITY_Npc  Reflect  Compress|Npc / Reflect / Compress]]
- [[_COMMUNITY_Builder  Prompt  Llm|Builder / Prompt / Llm]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Llm  Npc  Reflect|Llm / Npc / Reflect]]
- [[_COMMUNITY_Npc  Llm|Npc / Llm]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Worldtick|Worldtick]]
- [[_COMMUNITY_Npc  Western  Town|Npc / Western / Town]]
- [[_COMMUNITY_Llm  Prompt  Builder|Llm / Prompt / Builder]]
- [[_COMMUNITY_Stage  Action  Llm|Stage / Action / Llm]]
- [[_COMMUNITY_Document  Overview  Npc|Document / Overview / Npc]]
- [[_COMMUNITY_Npc  Cognition  Item|Npc / Cognition / Item]]
- [[_COMMUNITY_Working  Memory  Update|Working / Memory / Update]]
- [[_COMMUNITY_Narrative  Runtime  State|Narrative / Runtime / State]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Worldtick  Npc|Worldtick / Npc]]
- [[_COMMUNITY_Perceive  Llm|Perceive / Llm]]
- [[_COMMUNITY_Goal  Arbitration  Llm|Goal / Arbitration / Llm]]
- [[_COMMUNITY_Act  Llm|Act / Llm]]
- [[_COMMUNITY_Production  Rules  Open|Production / Rules / Open]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Llm|Llm]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Promptspec|Promptspec]]
- [[_COMMUNITY_Dto|Dto]]
- [[_COMMUNITY_Solution  Overview|Solution / Overview]]
- [[_COMMUNITY_Agents  Graphify|Agents / Graphify]]

## God Nodes (most connected - your core abstractions)
1. `长期记忆检索与回忆机制设计` - 21 edges
2. `5. Update Working Memory 阶段` - 16 edges
3. `6. 与玩家循环、NPC 认知和世界调度的接入` - 16 edges
4. `6. Prompt Builder 体系` - 16 edges
5. `AI Western Town 总设计稿` - 15 edges
6. `6. Goal Arbitration 阶段` - 15 edges
7. `7. Action Selection 阶段` - 15 edges
8. `3. Single API Design` - 15 edges
9. `世界推进与状态仿真设计` - 15 edges
10. `4. 内容配置模型` - 14 edges

## Surprising Connections (you probably didn't know these)
- `6. Goal Arbitration 阶段` --semantically_similar_to--> `3.5 `goal_arbitration_stage``  [INFERRED] [semantically similar]
  doc/30-npc-cognition-framework.md → doc/38-npc-cognition-api-spec.md
- `8.4 Provider 与 Prompt Builder` --semantically_similar_to--> `LLM 集成与 Prompt Builder 设计方案`  [INFERRED] [semantically similar]
  doc/00-master-design.md → doc/50-llm-integration.md
- `7. Action Selection 阶段` --semantically_similar_to--> `3.6 `action_selection_stage``  [INFERRED] [semantically similar]
  doc/30-npc-cognition-framework.md → doc/38-npc-cognition-api-spec.md
- `3.7 `npc_cognition_event_log`` --semantically_similar_to--> `NPC Cognition Internal API Design Specification`  [INFERRED] [semantically similar]
  doc/37-npc-cognition-db-design.md → doc/38-npc-cognition-api-spec.md
- `LLM 集成与 Prompt Builder 设计方案` --semantically_similar_to--> `Prompt Builder 与 Role-Aware Compiler 支撑契约`  [INFERRED] [semantically similar]
  doc/50-llm-integration.md → doc/51-prompt-builder-contract.md

## Hyperedges (group relationships)
- **Master Design Sections** — doc_doc_00_master_design_md_section_1_ai_western_town, doc_doc_00_master_design_md_section_3_1, doc_doc_00_master_design_md_section_23_2, doc_doc_00_master_design_md_section_25_2_1, doc_doc_00_master_design_md_section_31_2_2, doc_doc_00_master_design_md_section_41_2_3, doc_doc_00_master_design_md_section_54_3, doc_doc_00_master_design_md_section_56_3_1 [EXTRACTED 1.00]
- **World And Narrative Sections** — doc_doc_10_world_and_narrative_md_section_1, doc_doc_10_world_and_narrative_md_section_3_1_document_overview, doc_doc_10_world_and_narrative_md_section_14_2_solution_overview, doc_doc_10_world_and_narrative_md_section_25_3, doc_doc_10_world_and_narrative_md_section_27_3_1, doc_doc_10_world_and_narrative_md_section_31_3_2, doc_doc_10_world_and_narrative_md_section_39_3_3, doc_doc_10_world_and_narrative_md_section_61_3_4 [EXTRACTED 1.00]
- **Core Game Loop Sections** — doc_doc_20_core_game_loop_md_section_1, doc_doc_20_core_game_loop_md_section_3_1_document_overview, doc_doc_20_core_game_loop_md_section_14_2_solution_overview, doc_doc_20_core_game_loop_md_section_25_3, doc_doc_20_core_game_loop_md_section_27_3_1, doc_doc_20_core_game_loop_md_section_31_3_2, doc_doc_20_core_game_loop_md_section_39_3_3, doc_doc_20_core_game_loop_md_section_47_3_4 [EXTRACTED 1.00]
- **Scene Partition And Visibility Sections** — doc_doc_25_scene_partition_and_visibility_md_section_1, doc_doc_25_scene_partition_and_visibility_md_section_3_1_document_overview, doc_doc_25_scene_partition_and_visibility_md_section_14_2_solution_overview, doc_doc_25_scene_partition_and_visibility_md_section_25_3, doc_doc_25_scene_partition_and_visibility_md_section_27_3_1, doc_doc_25_scene_partition_and_visibility_md_section_31_3_2, doc_doc_25_scene_partition_and_visibility_md_section_39_3_3, doc_doc_25_scene_partition_and_visibility_md_section_69_3_4 [EXTRACTED 1.00]
- **Npc Cognition Framework Sections** — doc_doc_30_npc_cognition_framework_md_section_1_npc, doc_doc_30_npc_cognition_framework_md_section_3_1, doc_doc_30_npc_cognition_framework_md_section_24_2, doc_doc_30_npc_cognition_framework_md_section_26_2_1, doc_doc_30_npc_cognition_framework_md_section_38_2_2, doc_doc_30_npc_cognition_framework_md_section_53_2_3, doc_doc_30_npc_cognition_framework_md_section_66_2_4, doc_doc_30_npc_cognition_framework_md_section_73_2_5 [EXTRACTED 1.00]
- **Memory Retrieval And Recall Sections** — doc_doc_35_memory_retrieval_and_recall_md_section_1, doc_doc_35_memory_retrieval_and_recall_md_section_3_1, doc_doc_35_memory_retrieval_and_recall_md_section_14_2, doc_doc_35_memory_retrieval_and_recall_md_section_16_2_1, doc_doc_35_memory_retrieval_and_recall_md_section_27_2_2, doc_doc_35_memory_retrieval_and_recall_md_section_38_3, doc_doc_35_memory_retrieval_and_recall_md_section_49_4, doc_doc_35_memory_retrieval_and_recall_md_section_59_5 [EXTRACTED 1.00]
- **Npc Cognition Flowcharts Sections** — doc_doc_36_npc_cognition_flowcharts_md_section_1_npc, doc_doc_36_npc_cognition_flowcharts_md_section_3_1, doc_doc_36_npc_cognition_flowcharts_md_section_9_2, doc_doc_36_npc_cognition_flowcharts_md_section_25_3, doc_doc_36_npc_cognition_flowcharts_md_section_58_4, doc_doc_36_npc_cognition_flowcharts_md_section_74_5, doc_doc_36_npc_cognition_flowcharts_md_section_105_6_tick, doc_doc_36_npc_cognition_flowcharts_md_section_143_7 [EXTRACTED 1.00]
- **Npc Cognition Db Design Sections** — doc_doc_37_npc_cognition_db_design_md_section_1_npc_cognition_data_model_database_design, doc_doc_37_npc_cognition_db_design_md_section_3_1_document_overview, doc_doc_37_npc_cognition_db_design_md_section_20_2_table_inventory, doc_doc_37_npc_cognition_db_design_md_section_33_2_1_runtime_snapshot_contracts, doc_doc_37_npc_cognition_db_design_md_section_40_3_single_table_design, doc_doc_37_npc_cognition_db_design_md_section_42_3_1_npc_identity_profile, doc_doc_37_npc_cognition_db_design_md_section_102_3_2_npc_goal_definition, doc_doc_37_npc_cognition_db_design_md_section_163_3_3_npc_social_belief_edge [EXTRACTED 1.00]
- **Npc Cognition Api Spec Sections** — doc_doc_38_npc_cognition_api_spec_md_section_1_npc_cognition_internal_api_design_specification, doc_doc_38_npc_cognition_api_spec_md_section_3_1_document_overview, doc_doc_38_npc_cognition_api_spec_md_section_13_2_api_inventory, doc_doc_38_npc_cognition_api_spec_md_section_32_3_single_api_design, doc_doc_38_npc_cognition_api_spec_md_section_34_3_1_memory_prefetch, doc_doc_38_npc_cognition_api_spec_md_section_124_3_2_perceive_stage, doc_doc_38_npc_cognition_api_spec_md_section_215_3_3_appraise_stage, doc_doc_38_npc_cognition_api_spec_md_section_300_3_4_working_memory_update_stage [EXTRACTED 1.00]
- **Simulation And State Sections** — doc_doc_40_simulation_and_state_md_section_1, doc_doc_40_simulation_and_state_md_section_3_1, doc_doc_40_simulation_and_state_md_section_31_2, doc_doc_40_simulation_and_state_md_section_33_2_1, doc_doc_40_simulation_and_state_md_section_37_2_2, doc_doc_40_simulation_and_state_md_section_41_2_3, doc_doc_40_simulation_and_state_md_section_49_2_4, doc_doc_40_simulation_and_state_md_section_53_2_5 [EXTRACTED 1.00]
- **Sleep And Epiphany Long Actions Sections** — doc_doc_41_sleep_and_epiphany_long_actions_md_section_1, doc_doc_41_sleep_and_epiphany_long_actions_md_section_3_1, doc_doc_41_sleep_and_epiphany_long_actions_md_section_27_2, doc_doc_41_sleep_and_epiphany_long_actions_md_section_29_2_1_npc, doc_doc_41_sleep_and_epiphany_long_actions_md_section_33_2_2, doc_doc_41_sleep_and_epiphany_long_actions_md_section_37_2_3, doc_doc_41_sleep_and_epiphany_long_actions_md_section_41_2_4, doc_doc_41_sleep_and_epiphany_long_actions_md_section_45_2_5 [EXTRACTED 1.00]
- **Item System And Interaction Sections** — doc_doc_42_item_system_and_interaction_md_section_1, doc_doc_42_item_system_and_interaction_md_section_3_1_document_overview, doc_doc_42_item_system_and_interaction_md_section_14_2_solution_overview, doc_doc_42_item_system_and_interaction_md_section_25_3, doc_doc_42_item_system_and_interaction_md_section_27_3_1, doc_doc_42_item_system_and_interaction_md_section_36_3_2, doc_doc_42_item_system_and_interaction_md_section_44_3_3, doc_doc_42_item_system_and_interaction_md_section_63_3_4 [EXTRACTED 1.00]

## Communities

### Community 0 - "Npc / Tick"
Cohesion: 0.03
Nodes (80): 世界推进与状态仿真设计, 14. 版本记录, 3.3 场景泡泡分层, 3.4 调度优先级来源, 4. 输入结构, 4.1 世界调度主输入, 4.2 玩家动作输入, 4.3 玩家上下文输入 (+72 more)

### Community 1 - "Perceive / Appraise / Reflect"
Cohesion: 0.03
Nodes (76): 长期记忆检索与回忆机制设计, 5.4 统一读取层, 6. 读取时机设计, 6.1 `Cycle Prefetch`, 6.2 `Perceive` 读取, 2. 设计范围, 6.3 `Appraise` 读取, 2.1 本文档覆盖内容 (+68 more)

### Community 2 - "Npc / Reflect / Compress"
Cohesion: 0.03
Nodes (69): 睡眠与顿悟长动作设计, 3.3 睡眠与顿悟的共同点和区别, 3.4 有限身份演化层的定位, 4. 输入结构, 4.1 长动作状态输入, 4.2 深处理触发输入, 4.3 深处理上下文输入, 4.4 基础身份切片输入 (+61 more)

### Community 3 - "Builder / Prompt / Llm"
Cohesion: 0.03
Nodes (61): 8. LLM 职责边界, 8.1 总体原则, 8.2 规则层负责, 8.3 LLM 层负责, 8.4 Provider 与 Prompt Builder, 6. Prompt Builder 体系, 6.1 设计目标, 6.2 设计原则 (+53 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (55): 核心玩法循环设计方案, 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题, 4. 玩家动作与时间推进 (+47 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (54): 物品数据模型与内容配置设计, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题, 4. 权威占有与运行时投影 schema, 4.1 设计目标 (+46 more)

### Community 6 - "Llm / Npc / Reflect"
Cohesion: 0.04
Nodes (53): 2.6 横向支撑文档, 2.7 长动作深处理回流约定, NPC 认知框架设计, 2. 认知循环总览, 9. Reflect 阶段, 9.1 设计目标, 9.2 设计原则, 9.3 设计思路 (+45 more)

### Community 7 - "Npc / Llm"
Cohesion: 0.05
Nodes (44): 物品系统与交互设计, 3.6 处理流程, 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题 (+36 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (43): 场景分区与可见性设计方案, 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题, 4. 分区拓扑内容模型 (+35 more)

### Community 9 - "Worldtick"
Cohesion: 0.05
Nodes (42): 世界与剧情线设计方案, 3.6 处理流程, 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题 (+34 more)

### Community 10 - "Npc / Western / Town"
Cohesion: 0.05
Nodes (41): 4.3 会话形态, 4.4 物品与容器层, 5. 核心玩法循环, 5.1 玩家主循环, 5.2 输入与影响方式, 5.3 单局收束, 6. NPC 核心设计, 6.1 设计原则 (+33 more)

### Community 11 - "Llm / Prompt / Builder"
Cohesion: 0.05
Nodes (41): 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题, LLM 集成与 Prompt Builder 设计方案, 3. Provider 抽象与调用模式 (+33 more)

### Community 12 - "Stage / Action / Llm"
Cohesion: 0.05
Nodes (38): 7. Action Selection 阶段, 7.1 设计目标, 7.2 设计原则, 7.3 设计思路, 7.4 输入结构, 7.5 输出结构, 7.6 处理流程, 7.7 设计规格和约束 (+30 more)

### Community 13 - "Document / Overview / Npc"
Cohesion: 0.11
Nodes (34): 1. Document Overview, 1. Document Overview, 1. Document Overview, 7. 读取侧组件设计, 7.1 `Memory Retrieval Engine`, 7.2 `Stage Query Builder`, 7.3 `Stage Result Adapter`, 3.2 `npc_goal_definition` (+26 more)

### Community 14 - "Npc / Cognition / Item"
Cohesion: 0.28
Nodes (23): Master Design, World And Narrative, Core Game Loop, Scene Partition And Visibility, Npc Cognition Framework, Memory Retrieval And Recall, Npc Cognition Flowcharts, 6. 单 Tick 读取顺序 (+15 more)

### Community 15 - "Working / Memory / Update"
Cohesion: 0.13
Nodes (16): 5.6 处理流程, 5.7 设计规格和约束, 5.8 与 LLM 的交互边界, 5.9 与上下游认知阶段的交互边界, 5.10 透出的接口设计, 5.11 调试要求, 5.12 示例, 5.13 待处理的问题 (+8 more)

### Community 16 - "Narrative / Runtime / State"
Cohesion: 0.14
Nodes (14): 5. 开局装配与运行态, 5.1 设计目标, 5.2 设计原则, 5.3 设计思路, 5.4 输入结构, 5.5 输出结构, 5.6 处理流程, 5.7 设计规格和约束 (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (14): 7. 收束、调试与扩展边界, 7.1 设计目标, 7.2 设计原则, 7.3 设计思路, 7.4 输入结构, 7.5 输出结构, 7.6 处理流程, 7.7 设计规格和约束 (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (14): 5. 机会生成与社交卷入, 5.1 设计目标, 5.2 设计原则, 5.3 设计思路, 5.4 输入结构, 5.5 输出结构, 5.6 处理流程, 5.7 设计规格和约束 (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (14): 5. 玩家空间投影与交互接入, 5.1 设计目标, 5.2 设计原则, 5.3 设计思路, 5.4 输入结构, 5.5 输出结构, 5.6 处理流程, 5.7 设计规格和约束 (+6 more)

### Community 20 - "Worldtick / Npc"
Cohesion: 0.14
Nodes (14): 6. worldTick 与 NPC 感知接入, 6.1 设计目标, 6.2 设计原则, 6.3 设计思路, 6.4 输入结构, 6.5 输出结构, 6.6 处理流程, 6.7 设计规格和约束 (+6 more)

### Community 21 - "Perceive / Llm"
Cohesion: 0.14
Nodes (14): 3. Perceive 阶段, 3.1 设计目标, 3.2 设计原则, 3.3 设计思路, 3.4 输入结构, 3.5 输出结构, 3.6 处理流程, 3.7 设计规格和约束 (+6 more)

### Community 22 - "Goal / Arbitration / Llm"
Cohesion: 0.14
Nodes (14): 6. Goal Arbitration 阶段, 6.1 设计目标, 6.2 设计原则, 6.3 设计思路, 6.4 输入结构, 6.5 输出结构, 6.6 处理流程, 6.7 设计规格和约束 (+6 more)

### Community 23 - "Act / Llm"
Cohesion: 0.14
Nodes (14): 8. Act 阶段, 8.1 设计目标, 8.2 设计原则, 8.3 设计思路, 8.4 输入结构, 8.5 输出结构, 8.6 处理流程, 8.7 设计规格和约束 (+6 more)

### Community 24 - "Production / Rules / Open"
Cohesion: 0.14
Nodes (14): Readme, 设计文档索引, 推荐阅读顺序, 文档目录, 后续规划中的文档, `60-content-production-rules.md`, `90-open-questions.md`, 代理使用约定 (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (13): 5. 隐蔽行为、发现与后果, 5.1 设计目标, 5.2 设计原则, 5.3 设计思路, 5.4 输入结构, 5.5 输出结构, 5.6 处理流程, 5.7 设计规格和约束 (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (13): 4. 调用编排与阶段授权, 4.1 设计目标, 4.2 设计原则, 4.3 设计思路, 4.4 输入结构, 4.5 输出结构, 4.6 处理流程, 4.7 设计规格和约束 (+5 more)

### Community 27 - "Llm"
Cohesion: 0.15
Nodes (13): 5. 阶段级 LLM 调用地图, 5.1 设计目标, 5.2 设计原则, 5.3 设计思路, 5.4 输入结构, 5.5 输出结构, 5.6 处理流程, 5.7 设计规格和约束 (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (13): 8. 输出解析与安全回收, 8.1 设计目标, 8.2 设计原则, 8.3 设计思路, 8.4 输入结构, 8.5 输出结构, 8.6 处理流程, 8.7 设计规格和约束 (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (13): 9. 调试、日志与回放, 9.1 设计目标, 9.2 设计原则, 9.3 设计思路, 9.4 输入结构, 9.5 输出结构, 9.6 处理流程, 9.7 设计规格和约束 (+5 more)

### Community 30 - "Promptspec"
Cohesion: 0.15
Nodes (13): 3.6 处理流程, 3.7 设计规格和约束, 3.8 与上下游的交互边界, 3.9 透出的接口设计, 3.10 调试要求, 3.11 示例, 3.12 待处理的问题, 3. PromptSpec 资源模型 (+5 more)

### Community 31 - "Dto"
Cohesion: 0.15
Nodes (13): 4. 阶段输入 DTO 契约, 4.1 设计目标, 4.2 设计原则, 4.3 设计思路, 4.4 输入结构, 4.5 输出结构, 4.6 处理流程, 4.7 设计规格和约束 (+5 more)

### Community 32 - "Solution / Overview"
Cohesion: 1.0
Nodes (6): 2. Solution Overview, 2. Solution Overview, 2. Solution Overview, 2. Solution Overview, 2. Solution Overview, 2. Solution Overview

### Community 33 - "Agents / Graphify"
Cohesion: 1.0
Nodes (2): Agents, graphify

## Knowledge Gaps
- **840 isolated node(s):** `Agents`, `graphify`, `1. 文档定位`, `2.1 一句话定义`, `2.2 第一版目标` (+835 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Agents / Graphify`** (2 nodes): `Agents`, `graphify`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NPC 认知框架设计` connect `Llm / Npc / Reflect` to `Stage / Action / Llm`, `Npc / Cognition / Item`, `Working / Memory / Update`, `Perceive / Llm`, `Goal / Arbitration / Llm`, `Act / Llm`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Why does `Npc Cognition Framework` connect `Npc / Cognition / Item` to `Llm / Npc / Reflect`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `LLM 集成与 Prompt Builder 设计方案` connect `Llm / Prompt / Builder` to `Solution / Overview`, `Builder / Prompt / Llm`, `Document / Overview / Npc`, `Npc / Cognition / Item`, `Community 26`, `Llm`, `Community 28`, `Community 29`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `5. Update Working Memory 阶段` (e.g. with `3.4 `npc_working_memory_item`` and `3.4 `working_memory_update_stage``) actually correct?**
  _`5. Update Working Memory 阶段` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `6. Prompt Builder 体系` (e.g. with `8.4 Provider 与 Prompt Builder` and `Prompt Builder 与 Role-Aware Compiler 支撑契约`) actually correct?**
  _`6. Prompt Builder 体系` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Agents`, `graphify`, `1. 文档定位` to the rest of the system?**
  _840 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Npc / Tick` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._