import type {
  AssistantForgetResponse,
  AssistantMemoriesResponse,
  AssistantMemoryRequest,
} from '@hochbeet/contracts';
import { ASSISTANT_SESSION_HEADER } from '@hochbeet/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiFetch } from './api';
import { useApi } from './api-context';
import { ASSISTANT_PATH, newSessionId } from './assistant';

const memoriesKey = ['assistant', 'memories'] as const;

/**
 * A request about the assistant's memory; it goes to the runtime like a question, but in a
 * session of its own and without counting against the daily quota.
 */
function memoryRequest<T>(api: ApiFetch, body: AssistantMemoryRequest) {
  return api<T>(ASSISTANT_PATH, {
    method: 'POST',
    headers: { [ASSISTANT_SESSION_HEADER]: newSessionId() },
    body: JSON.stringify(body),
  });
}

/** The preferences the assistant remembers about the signed-in user, newest first. */
export function useAssistantMemories(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: memoriesKey,
    queryFn: async () =>
      (await memoryRequest<AssistantMemoriesResponse>(api, { memory: 'list' })).memories,
    enabled,
  });
}

/** Deletes everything the assistant remembers: preferences and stored conversations. */
export function useForgetAssistantMemories() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => memoryRequest<AssistantForgetResponse>(api, { memory: 'forget' }),
    onSuccess: () => {
      queryClient.setQueryData(memoriesKey, []);
    },
  });
}
