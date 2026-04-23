export type ConnectionState = "mock" | "connecting" | "live";

export type LeftPanelEntry = {
  id: string;
  label: string;
  title: string;
  body: string;
};

export type SceneFeedEntry = {
  id: string;
  role: "scene" | "system" | "player";
  label: string;
  timestamp: string;
  body: string;
};

export type CommandSuggestion = {
  id: string;
  label: string;
  hint: string;
  commandText: string;
};

export type CommandComposerModel = {
  title: string;
  description: string;
  placeholder: string;
  draft: string;
  footnote: string;
  lastSubmittedCommand?: string;
};

export type DebugPanelCard = {
  id: string;
  title: string;
  description: string;
  status: "placeholder" | "mock" | "locked";
  statusLabel: string;
};

export type DebugPanelModel = {
  title: string;
  description: string;
  cards: DebugPanelCard[];
};

export type ShellViewModel = {
  header: {
    title: string;
    summary: string;
    sessionLabel: string;
    connectionState: ConnectionState;
    connectionLabel: string;
    connectionHint: string;
  };
  leftPanel: {
    title: string;
    description: string;
    placeholderTitle: string;
    placeholderBody: string;
    entries: LeftPanelEntry[];
  };
  scene: {
    kicker: string;
    title: string;
    description: string;
    timeLabel: string;
    locationLabel: string;
    runModeLabel: string;
  };
  feed: SceneFeedEntry[];
  suggestions: CommandSuggestion[];
  composer: CommandComposerModel;
  debugPanel: DebugPanelModel;
};
