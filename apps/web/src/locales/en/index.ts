import type { Resources } from '../de';
import { auth } from './auth';
import { common } from './common';
import { layout } from './layout';
import { profile } from './profile';

/** English (en-GB) texts. */
export const en: Resources = { common, layout, auth, profile };
