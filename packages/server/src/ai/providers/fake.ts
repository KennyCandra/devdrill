import type { AiProvider, AiRequest } from '../provider.js';

/**
 * A provider for tests: answers with whatever `answer` returns for each request, so tests
 * (and CI) never call a real model. Records every request it got.
 */
export function createFakeProvider(
  answer: (request: AiRequest) => string | Promise<string>,
): AiProvider & { requests: AiRequest[] } {
  const requests: AiRequest[] = [];
  return {
    id: 'fake',
    requests,
    complete(request) {
      requests.push(request);
      return Promise.resolve(answer(request));
    },
  };
}
