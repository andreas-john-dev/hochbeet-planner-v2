import { Bean, Leaf, ShieldCheck, Sprout, UserRound, type LucideIcon } from 'lucide-react';
import type { GardenView } from '@hochbeet/contracts';
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
  /**
   * Hidden in the simple view (T-73); the route stays reachable for existing links. Shown
   * while the view is not known yet.
   */
  expertOnly?: boolean;
}

export const navItems: readonly NavItem[] = [
  { to: '/beete', label: 'beds', icon: Sprout },
  { to: '/anzucht', label: 'sowings', icon: Bean, expertOnly: true },
  { to: '/katalog', label: 'catalog', icon: Leaf },
  { to: '/profil', label: 'profile', icon: UserRound, accountOnly: true },
  { to: '/admin', label: 'admin', icon: ShieldCheck, adminOnly: true, accountOnly: true },
];

/** The items for this user: admins, guests and the view decide. */
export const visibleNavItems = ({
  admin,
  guest,
  view,
}: {
  admin: boolean;
  guest: boolean;
  view: GardenView | undefined;
}) =>
  navItems.filter(
    (item) =>
      (!item.adminOnly || admin) &&
      (!item.accountOnly || !guest) &&
      (!item.expertOnly || view !== 'SIMPLE'),
  );
