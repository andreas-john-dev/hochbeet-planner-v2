/** localStorage keys of the guest's data; kept apart so the app can clear them without loading the local API. */
export const GUEST_STORAGE_KEY = 'hochbeet-guest';
/** Unreadable data is moved here instead of being lost silently. */
export const GUEST_BACKUP_KEY = 'hochbeet-guest-backup';
/** Id of the import of the guest's data into an account, kept until it succeeded (idempotency). */
export const GUEST_IMPORT_ID_KEY = 'hochbeet-guest-import-id';
