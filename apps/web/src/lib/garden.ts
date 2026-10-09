import type {
  Bed,
  BedFields,
  CatalogPlant,
  BedWithPlantingsResponse,
  ListBedsResponse,
  ListPlantsResponse,
  Planting,
  PlantingFields,
  Plant,
  PlantFields,
  PlantOverride,
  PublicationQueueResponse,
} from '@hochbeet/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

export const queryKeys = {
  beds: ['beds'] as const,
  bed: (bedId: string) => ['beds', bedId] as const,
  plants: ['plants'] as const,
  publications: ['publications'] as const,
};

export function useBeds() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.beds,
    queryFn: async () => (await api<ListBedsResponse>('/api/garden/beds')).beds,
  });
}

export function useBedWithPlantings(bedId: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.bed(bedId),
    queryFn: () => api<BedWithPlantingsResponse>(`/api/garden/beds/${bedId}`),
  });
}

/** The user's effective catalogue; changes rarely, so it stays fresh for a few minutes. */
export function usePlants() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.plants,
    queryFn: async () => (await api<ListPlantsResponse>('/api/catalog/plants')).plants,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Personal adjustment of a global plant: null resets it to the global values. Afterwards the
 * catalogue is reloaded, so the editor's rules use the new values at once.
 */
export function useAdjustPlant(plantId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (override: PlantOverride | null) =>
      override
        ? api<CatalogPlant>(`/api/catalog/plants/${plantId}/override`, {
            method: 'PUT',
            body: JSON.stringify(override),
          })
        : api<undefined>(`/api/catalog/plants/${plantId}/override`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plants }),
  });
}

/** Creates (without id) or changes an own plant; resolves with the saved plant. */
export function useSaveOwnPlant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: PlantFields }) =>
      api<CatalogPlant>(id ? `/api/catalog/plants/${id}` : '/api/catalog/plants', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plants }),
  });
}

/** Asks the admins to publish an own plant for everyone. */
export function useRequestPublication(plantId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<CatalogPlant>(`/api/catalog/plants/${plantId}/publication`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plants }),
  });
}

/** Admins: open publication requests, oldest first. */
export function usePublicationQueue() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.publications,
    queryFn: async () =>
      (await api<PublicationQueueResponse>('/api/catalog/admin/publications')).requests,
  });
}

/** Admins: decide a request; afterwards queue and catalogue are reloaded. */
export function useDecidePublication(plantId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      decision:
        { approve: true; corrections: PlantOverride | null } | { approve: false; comment: string },
    ) =>
      decision.approve
        ? api<Plant>(`/api/catalog/admin/publications/${plantId}/approve`, {
            method: 'POST',
            body: JSON.stringify(decision.corrections ? { corrections: decision.corrections } : {}),
          })
        : api<undefined>(`/api/catalog/admin/publications/${plantId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment: decision.comment }),
          }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.publications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.plants }),
      ]);
    },
  });
}

/** Admins: creates (without id) or changes a global plant. */
export function useSaveGlobalPlant() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: PlantFields }) =>
      api<Plant>(id ? `/api/catalog/admin/plants/${id}` : '/api/catalog/admin/plants', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(fields),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plants }),
  });
}

export function useSaveBed() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: BedFields }) =>
      id
        ? api<Bed>(`/api/garden/beds/${id}`, { method: 'PUT', body: JSON.stringify(fields) })
        : api<Bed>('/api/garden/beds', { method: 'POST', body: JSON.stringify(fields) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.beds }),
  });
}

export function useDeleteBed() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<undefined>(`/api/garden/beds/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.beds }),
  });
}

type PlantingChange = { type: 'save'; planting: Planting } | { type: 'delete'; plantingId: string };

/** Applies a change to the cached bed, as the server will after the request. */
function applyChange(data: BedWithPlantingsResponse, change: PlantingChange) {
  const others = data.plantings.filter(
    (p) => p.id !== (change.type === 'save' ? change.planting.id : change.plantingId),
  );
  return { ...data, plantings: change.type === 'save' ? [...others, change.planting] : others };
}

/**
 * Shared optimistic update for planting changes: the editor shows the change at once and
 * rolls back if the request fails. Afterwards the bed is reloaded from the server.
 */
function useOptimisticPlantingChange<TVariables, TResult>(
  bedId: string,
  request: (variables: TVariables) => Promise<TResult>,
  toChange: (variables: TVariables) => PlantingChange,
) {
  const queryClient = useQueryClient();
  const key = queryKeys.bed(bedId);
  return useMutation({
    mutationFn: request,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BedWithPlantingsResponse>(key);
      if (previous) {
        queryClient.setQueryData(key, applyChange(previous, toChange(variables)));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Saves a planting: PUT for an existing id, POST for a new one (the id is then temporary). */
export function useSavePlanting(bedId: string) {
  const api = useApi();
  return useOptimisticPlantingChange(
    bedId,
    ({ planting, isNew }: { planting: Planting; isNew: boolean }) => {
      const fields: PlantingFields = toFields(planting);
      return isNew
        ? api<Planting>(`/api/garden/beds/${bedId}/plantings`, {
            method: 'POST',
            body: JSON.stringify(fields),
          })
        : api<Planting>(`/api/garden/beds/${bedId}/plantings/${planting.id}`, {
            method: 'PUT',
            body: JSON.stringify(fields),
          });
    },
    ({ planting }) => ({ type: 'save', planting }),
  );
}

export function useDeletePlanting(bedId: string) {
  const api = useApi();
  return useOptimisticPlantingChange(
    bedId,
    (plantingId: string) =>
      api<undefined>(`/api/garden/beds/${bedId}/plantings/${plantingId}`, { method: 'DELETE' }),
    (plantingId) => ({ type: 'delete', plantingId }),
  );
}

/** The fields the API takes for a planting (without id and bedId). */
export function toFields(planting: Planting): PlantingFields {
  const { id: _id, bedId: _bedId, ...fields } = planting;
  return fields;
}
