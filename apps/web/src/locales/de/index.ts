import { admin } from './admin';
import { auth } from './auth';
import { beds } from './beds';
import { catalog } from './catalog';
import { common } from './common';
import { editor } from './editor';
import { guestImport } from './guestImport';
import { layout } from './layout';
import { profile } from './profile';
import { sowings } from './sowings';

/** German texts, one namespace per area. The source: English must have the same keys. */
export const de = {
  common,
  layout,
  auth,
  profile,
  beds,
  editor,
  sowings,
  catalog,
  admin,
  guestImport,
};

export type Resources = typeof de;
