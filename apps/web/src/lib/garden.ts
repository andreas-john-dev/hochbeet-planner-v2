import type {
  Bed,
  BedFields,
  BedWithPlantingsResponse,
  ListBedsResponse,
  ListPlantsResponse,
} from '@hochbeet/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

export const queryKeys = {
  beds: ['beds'] as const,
  bed: (bedId: string) => ['beds', bedId] as const,
  plants: ['plants'] as const,
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
