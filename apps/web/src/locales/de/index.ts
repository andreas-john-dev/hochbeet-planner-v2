import { auth } from './auth';
import { beds } from './beds';
import { common } from './common';
import { editor } from './editor';
import { layout } from './layout';
import { profile } from './profile';

/** German texts, one namespace per area. The source: English must have the same keys. */
export const de = { common, layout, auth, profile, beds, editor };

export type Resources = typeof de;
