import { createContext, useContext } from 'react';
import type { ApiFetch, ApiStream } from './api';

export const ApiContext = createContext<ApiFetch | null>(null);

/** The API client of the signed-in user (sends the ID token). */
export function useApi(): ApiFetch {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}

export const ApiStreamContext = createContext<ApiStream | null>(null);

/** Like `useApi()`, for responses read as a stream (the assistant's answers). */
export function useApiStream(): ApiStream {
  const stream = useContext(ApiStreamContext);
  if (!stream) throw new Error('useApiStream must be used inside ApiProvider');
  return stream;
}
