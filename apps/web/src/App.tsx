import { useEffect, useRef, useState } from "react";
import * as localUiSdk from "@ai-western-town/ui-sdk";
import { GameShellLayout } from "./components/game-shell-layout";
import { buildLiveShellViewModel } from "./view-model/live-shell-view-model";
import {
  createFreeTextCommand,
  createMoveCommand,
  createOpportunityCommand
} from "./view-model/player-command-factory";
import type {
  MapRouteItem,
  OpportunityItem,
  ShellViewModel
} from "./view-model/shell-view-model";

type LocalSessionRuntimeState = localUiSdk.LocalSessionRuntimeState;

const initialRuntimeState: LocalSessionRuntimeState = {
  connectionState: "idle",
  initialized: false,
  streamEvents: []
};

export function App() {
  const runtimeRef =
    useRef<ReturnType<typeof localUiSdk.createLocalSessionRuntime> | null>(null);
  const [runtimeState, setRuntimeState] =
    useState<LocalSessionRuntimeState>(initialRuntimeState);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const client = localUiSdk.createLocalHostClient({
      baseUrl: import.meta.env.VITE_LOCAL_HOST_URL ?? "http://127.0.0.1:8787"
    });
    const runtime = localUiSdk.createLocalSessionRuntime({
      client
    });
    runtimeRef.current = runtime;

    const unsubscribe = runtime.subscribe((nextState) => {
      setRuntimeState(nextState);
    });

    void runtime.initialize().catch((error) => {
      setRuntimeState((currentState) => ({
        ...currentState,
        connectionState: "connecting",
        initialized: true,
        lastError: error
      }));
    });

    return () => {
      unsubscribe();
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const nextViewModel = buildLiveShellViewModel(runtimeState);
  const viewModel: ShellViewModel = {
    ...nextViewModel,
    composer: {
      ...nextViewModel.composer,
      draft
    }
  };

  async function handlePlayerCommand(
    playerCommand: ReturnType<typeof createMoveCommand>
  ): Promise<void> {
    if (!runtimeRef.current) {
      return;
    }

    setDraft("");

    try {
      await runtimeRef.current.submitCommand(playerCommand);
    } catch (error) {
      setRuntimeState((currentState) => ({
        ...currentState,
        connectionState: "connecting",
        lastError: error
      }));
    }
  }

  function handleCommandSubmit(commandText: string): void {
    void handlePlayerCommand(
      createFreeTextCommand(commandText, runtimeState.session?.worldTick ?? 0, viewModel.scene.sceneId)
    );
  }

  function handleMovementSelect(item: MapRouteItem): void {
    void handlePlayerCommand(
      createMoveCommand(
        item.sceneId,
        runtimeState.session?.worldTick ?? 0,
        item.commandText
      )
    );
  }

  function handleOpportunitySelect(item: OpportunityItem): void {
    void handlePlayerCommand(
      createOpportunityCommand(
        item,
        runtimeState.session?.worldTick ?? 0,
        viewModel.scene.sceneId
      )
    );
  }

  function handleDraftChange(nextDraft: string): void {
    setDraft(nextDraft);
  }

  return (
    <GameShellLayout
      viewModel={viewModel}
      onDraftChange={handleDraftChange}
      onMovementSelect={handleMovementSelect}
      onOpportunitySelect={handleOpportunitySelect}
      onSubmit={handleCommandSubmit}
    />
  );
}
