import type { Resources } from '../de';
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

/** English (en-GB) texts. */
export const en: Resources = {
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
