import { GUEST_BACKUP_KEY, GUEST_STORAGE_KEY } from '@/lib/local-api/keys';

/** Set while someone uses the app without an account; survives reloads. */
export const GUEST_MODE_KEY = 'hochbeet-guest-mode';

// Storage can be missing or throw (private mode, blocked site data): guest mode is then off.
function storage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

export function readGuestMode(): boolean {
  try {
    return storage()?.getItem(GUEST_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGuestMode(on: boolean) {
  try {
    if (on) storage()?.setItem(GUEST_MODE_KEY, '1');
    else storage()?.removeItem(GUEST_MODE_KEY);
  } catch {
    // Without storage guest mode only lasts until the next reload.
  }
}

/** Removes the guest's beds, plantings and plants from this browser. */
export function deleteGuestData() {
  try {
    storage()?.removeItem(GUEST_STORAGE_KEY);
    storage()?.removeItem(GUEST_BACKUP_KEY);
  } catch {
    // Nothing stored, nothing to delete.
  }
}
