import type { Resources } from '../de';
import { auth } from './auth';
import { beds } from './beds';
import { common } from './common';
import { editor } from './editor';
import { layout } from './layout';
import { profile } from './profile';

/** English (en-GB) texts. */
export const en: Resources = { common, layout, auth, profile, beds, editor };
