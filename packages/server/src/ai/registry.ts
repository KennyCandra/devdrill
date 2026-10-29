import type { AiProviderId, AiProviderInfo } from '@devdrill/shared';
import type { AiProvider, ProviderConfig } from './provider.js';
import { createClaudeProvider } from './providers/claude.js';
import { createOllamaProvider } from './providers/ollama.js';
import { createOpenAiCompatibleProvider } from './providers/openai.js';
import { createOpenCodeProvider } from './providers/opencode.js';

/**
 * Every AI provider DevDrill knows. To add one: write `providers/<name>.ts` exporting a
 * factory that returns an `AiProvider`, add its id to `AiProviderId` (packages/shared),
 * and add an entry here. Nothing else changes.
 */
export const PROVIDERS: Record<
  AiProviderId,
  { info: AiProviderInfo; create: (config: ProviderConfig) => AiProvider }
> = {
  claude: {
    info: {
      id: 'claude',
      label: 'Claude',
      description: 'Anthropic. Needs an API key from console.anthropic.com.',
      needsKey: true,
      needsBaseUrl: false,
      defaultModel: 'claude-opus-5-5',
      defaultBaseUrl: null,
    },
    create: createClaudeProvider,
  },
  openai: {
    info: {
      id: 'openai',
      label: 'OpenAI',
      description: 'GPT models. Needs an API key from platform.openai.com.',
      needsKey: true,
      needsBaseUrl: false,
      defaultModel: 'gpt-5.5',
      defaultBaseUrl: null,
    },
    create: (config) => createOpenAiCompatibleProvider(config, 'openai'),
  },
  ollama: {
    info: {
      id: 'ollama',
      label: 'Ollama (local)',
      description: 'Models on your own machine, free and offline. Run `ollama serve`.',
      needsKey: false,
      needsBaseUrl: true,
      defaultModel: 'qwen3-coder',
      defaultBaseUrl: 'http://localhost:11434',
    },
    create: createOllamaProvider,
  },
  opencode: {
    info: {
      id: 'opencode',
      label: 'OpenCode',
      description:
        'Your OpenCode server (`opencode serve`) and the providers connected to it. Model: provider/model, or "default".',
      needsKey: false,
      needsBaseUrl: true,
      defaultModel: 'default',
      defaultBaseUrl: 'http://127.0.0.1:4096',
    },
    create: createOpenCodeProvider,
  },
  custom: {
    info: {
      id: 'custom',
      label: 'Custom (OpenAI-compatible)',
      description: 'Any OpenAI-compatible API: DeepSeek, OpenRouter, LM Studio, vLLM…',
      needsKey: false,
      needsBaseUrl: true,
      defaultModel: 'deepseek-chat',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
    },
    create: (config) => createOpenAiCompatibleProvider(config, 'custom'),
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as AiProviderId[];
