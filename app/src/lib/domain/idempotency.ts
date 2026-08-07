const responses = new Map<string, unknown>();

export function getIdempotentResponse<T>(key: string) {
  return responses.get(key) as T | undefined;
}

export function rememberIdempotentResponse<T>(key: string, response: T) {
  responses.set(key, response);
  return response;
}

export function clearIdempotencyMemory() {
  responses.clear();
}
