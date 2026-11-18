import {
  DEFAULT_GARDEN_SETTINGS,
  type GardenSettings,
  type GardenView,
  type SaveGardenSettingsRequest,
} from '@hochbeet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';
import { queryKeys, useGardenSettings } from './garden';

/**
 * The user's view (T-73), from the garden settings: for accounts on all devices, for guests in
 * this browser. `view` is undefined while the settings load. Switching is optimistic: the
 * cached settings change at once and go back if saving fails.
 */
export function useView() {
  const api = useApi();
  const queryClient = useQueryClient();
  const settings = useGardenSettings();
  const save = useMutation({
    mutationFn: (view: GardenView) => {
      const current = queryClient.getQueryData<GardenSettings>(queryKeys.settings);
      const body: SaveGardenSettingsRequest = {
        lastFrost: current?.lastFrost ?? DEFAULT_GARDEN_SETTINGS.lastFrost,
        view,
      };
      return api<GardenSettings>('/api/garden/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onMutate: async (view) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<GardenSettings>(queryKeys.settings);
      queryClient.setQueryData<GardenSettings>(queryKeys.settings, {
        ...(previous ?? DEFAULT_GARDEN_SETTINGS),
        view,
      });
      return { previous };
    },
    onError: (_error, _view, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.settings, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.settings, saved);
    },
  });
  return {
    view: settings.data?.view,
    /** Settings are loading: the switch waits, so it never saves the default last frost. */
    loading: settings.isPending,
    loadError: settings.isError ? settings.error : null,
    setView: (view: GardenView) => {
      save.mutate(view);
    },
    saveError: save.error,
  };
}
