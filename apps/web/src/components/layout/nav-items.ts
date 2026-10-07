import { Leaf, ShieldCheck, Sprout, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: '/beete' | '/katalog' | '/profil' | '/admin';
  label: string;
  icon: LucideIcon;
}

export const navItems: readonly NavItem[] = [
  { to: '/beete', label: 'Beete', icon: Sprout },
  { to: '/katalog', label: 'Katalog', icon: Leaf },
  { to: '/profil', label: 'Profil', icon: UserRound },
  { to: '/admin', label: 'Admin', icon: ShieldCheck },
];
