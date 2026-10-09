import { Leaf, ShieldCheck, Sprout, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: '/beete' | '/katalog' | '/profil' | '/admin';
  label: string;
  icon: LucideIcon;
  /** Only shown to members of the Cognito group `admins`. */
  adminOnly?: boolean;
  /** Hidden in guest mode: needs an account. */
  accountOnly?: boolean;
}

export const navItems: readonly NavItem[] = [
  { to: '/beete', label: 'Beete', icon: Sprout },
  { to: '/katalog', label: 'Katalog', icon: Leaf },
  { to: '/profil', label: 'Profil', icon: UserRound, accountOnly: true },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true, accountOnly: true },
];
