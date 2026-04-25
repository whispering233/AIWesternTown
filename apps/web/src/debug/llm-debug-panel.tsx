import type { ReactNode } from "react";

export type LLMDebugPanelModel = {
  title: string;
  description: string;
  emptyMessage: string;
  calls: LLMDebugCallSummary[];
  selectedCall?: LLMDebugCallDetail;
};

export type LLMDebugCallSummary = {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: string;
  stageName: string;
  providerLabel: string;
  statusLabel: string;
  startedAtLabel: string;
  durationLabel: string;
  worldTickLabel: string;
  npcLabel: string;
  isSelected: boolean;
};

export type LLMDebugCallDetail = {
  recordId: string;
  traceId: string;
  requestId: string;
  title: string;
  subtitle: string;
  prompt: {
    messageCountLabel: string;
    budgetLabel: string;
    messages: {
      role: string;
      contentLengthLabel: string;
      contentPreview: string;
    }[];
  };
  rawOutput: {
    finishReasonLabel: string;
    providerLabel: string;
    tokenUsageLabel: string;
    rawTextLengthLabel: string;
    rawTextPreview: string;
    errorLabel?: string;
  };
  parsedFallback: {
    invocationDecision: string;
    parseResult: string;
    fallbackReason: string;
    trimmedBlocksLabel: string;
    persistedLabel: string;
  };
};

export type LLMDebugPanelProps = {
  model: LLMDebugPanelModel;
  onSelectCall?: (recordId: string) => void;
};

export function createEmptyLLMDebugPanelModel(): LLMDebugPanelModel {
  return {
    title: "LLM Calls",
    description: "Recorder buffer / prompt / raw output / parsed fallback.",
    emptyMessage: "No LLM calls recorded yet.",
    calls: []
  };
}

export function LLMDebugPanel({
  model,
  onSelectCall
}: LLMDebugPanelProps) {
  return (
    <section className="debug-panel llm-debug-panel" aria-label={model.title}>
      <div className="panel-head">
        <p className="eyebrow">LLM Inspector</p>
        <h3>{model.title}</h3>
        <p className="debug-copy">{model.description}</p>
      </div>

      {model.calls.length === 0 ? (
        <p className="empty-feed">{model.emptyMessage}</p>
      ) : (
        <div className="llm-debug-layout">
          <CallList calls={model.calls} onSelectCall={onSelectCall} />
          {model.selectedCall ? (
            <CallDetail call={model.selectedCall} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function CallList({
  calls,
  onSelectCall
}: {
  calls: LLMDebugCallSummary[];
  onSelectCall?: (recordId: string) => void;
}) {
  return (
    <div className="debug-card-list llm-call-list" aria-label="LLM Calls list">
      {calls.map((call) => (
        <button
          key={call.recordId}
          type="button"
          className={`debug-card llm-call-button ${call.isSelected ? "is-active" : ""}`.trim()}
          aria-pressed={call.isSelected}
          onClick={() => onSelectCall?.(call.recordId)}
        >
          <span className="debug-card-header">
            <strong>{call.taskKind}</strong>
            <span className={`debug-badge ${statusClassName(call.statusLabel)}`}>
              {call.statusLabel}
            </span>
          </span>
          <span className="llm-call-meta">
            {call.stageName} · {call.providerLabel}
          </span>
          <span className="llm-call-meta">
            {call.worldTickLabel} · {call.npcLabel} · {call.durationLabel}
          </span>
          <span className="llm-call-id">{call.requestId}</span>
        </button>
      ))}
    </div>
  );
}

function CallDetail({ call }: { call: LLMDebugCallDetail }) {
  return (
    <div className="llm-detail-stack">
      <section className="debug-card">
        <div className="debug-card-header">
          <strong>{call.title}</strong>
          <span className="debug-badge mock">{call.requestId}</span>
        </div>
        <p>{call.subtitle}</p>
        <p className="llm-call-id">{call.traceId}</p>
      </section>

      <DetailSection
        title="Prompt"
        meta={`${call.prompt.messageCountLabel}; ${call.prompt.budgetLabel}`}
      >
        <div className="llm-message-list">
          {call.prompt.messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className="llm-message-entry"
            >
              <div className="entry-meta">
                <span className="entry-label">{message.role}</span>
                <span className="feed-entry-meta">
                  {message.contentLengthLabel}
                </span>
              </div>
              <pre>{message.contentPreview}</pre>
            </article>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="Raw Output"
        meta={`${call.rawOutput.finishReasonLabel}; ${call.rawOutput.rawTextLengthLabel}; ${call.rawOutput.tokenUsageLabel}`}
      >
        {call.rawOutput.errorLabel ? (
          <p className="llm-error-line">{call.rawOutput.errorLabel}</p>
        ) : null}
        <pre>{call.rawOutput.rawTextPreview}</pre>
      </DetailSection>

      <DetailSection title="Parsed / Fallback">
        <dl className="llm-debug-kv">
          <KeyValue label="Decision" value={call.parsedFallback.invocationDecision} />
          <KeyValue label="Parse" value={call.parsedFallback.parseResult} />
          <KeyValue label="Fallback" value={call.parsedFallback.fallbackReason} />
          <KeyValue label="Trimmed" value={call.parsedFallback.trimmedBlocksLabel} />
          <KeyValue label="Storage" value={call.parsedFallback.persistedLabel} />
        </dl>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  meta,
  children
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="debug-card llm-detail-section">
      <div className="debug-card-header">
        <strong>{title}</strong>
        {meta ? <span className="feed-entry-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function statusClassName(statusLabel: string): string {
  if (statusLabel === "success") {
    return "mock";
  }

  if (
    statusLabel === "fallback" ||
    statusLabel === "parse" ||
    statusLabel === "error" ||
    statusLabel === "timeout"
  ) {
    return "locked";
  }

  return "placeholder";
}
