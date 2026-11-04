export type AiProvider = 'openai' | 'claude' | 'gemini' | 'openrouter';
export const aiLabels: Record<AiProvider, string> = { openai: 'OpenAI', claude: 'Claude', gemini: 'Gemini', openrouter: 'OpenRouter gratis' };
export function isAiProvider(value: unknown): value is AiProvider { return typeof value === 'string' && Object.hasOwn(aiLabels, value); }
