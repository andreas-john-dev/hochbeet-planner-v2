import { Bean, Leaf, ShieldCheck, Sprout, UserRound, type LucideIcon } from 'lucide-react';
import type { layout } from '@/locales/de/layout';

export interface NavItem {
  to: '/beete' | '/anzucht' | '/katalog' | '/profil' | '/admin';
  /** Text key under `layout:nav`. */
  label: Exclude<keyof typeof layout.nav, 'label'>;
  icon: LucideIcon;
  /** Only shown to members of the Cognito group `admins`. */
  adminOnly?: boolean;
  /** Hidden in guest mode: needs an account. */
  accountOnly?: boolean;
}

export const navItems: readonly NavItem[] = [
  { to: '/beete', label: 'beds', icon: Sprout },
  { to: '/anzucht', label: 'sowings', icon: Bean },
  { to: '/katalog', label: 'catalog', icon: Leaf },
  { to: '/profil', label: 'profile', icon: UserRound, accountOnly: true },
  { to: '/admin', label: 'admin', icon: ShieldCheck, adminOnly: true, accountOnly: true },
];
