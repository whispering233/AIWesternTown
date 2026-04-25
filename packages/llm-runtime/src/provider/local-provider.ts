import {
  OpenAICompatibleProvider,
  type OpenAICompatibleProviderOptions
} from "./openai-compatible-provider.js";
import type { LLMProvider } from "./types.js";

export type LocalProviderOptions = Omit<
  OpenAICompatibleProviderOptions,
  "name"
> & {
  name?: string;
};

export function createLocalProvider(options: LocalProviderOptions): LLMProvider {
  return new OpenAICompatibleProvider({
    ...options,
    name: options.name ?? "local"
  });
}
