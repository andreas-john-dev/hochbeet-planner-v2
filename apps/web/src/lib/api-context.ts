import { createContext, useContext } from 'react';
import type { ApiFetch } from './api';

export const ApiContext = createContext<ApiFetch | null>(null);

/** The API client of the signed-in user (sends the ID token). */
export function useApi(): ApiFetch {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}
