// Ask AI's public API: a host imports from here and nowhere else in this folder.
// How it behaves, how it is built and how to bring it to another host: SPEC.md.
import frame from 'virtual:askai-frame';
import { type AskAiOptions, askAiPlugin as createAskAiPlugin } from './plugin';

export type { AskAiOptions } from './plugin';

/** The Ask AI plugin, with its frame half as vite.config.ts builds it. */
export const askAiPlugin = (options: AskAiOptions) => createAskAiPlugin(options, frame);
