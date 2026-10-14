import {
  Activity,
  AppWindowMac,
  ChartBar,
  ChartLine,
  ChartPie,
  CreditCard,
  Database,
  Folder,
  Gauge,
  Globe,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Package,
  Rocket,
  ShoppingCart,
  Star,
  Table,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

/** The icons a repo's `apps/_meta.yaml` can name, by their lucide names in kebab-case. */
const icons: Record<string, LucideIcon> = {
  activity: Activity,
  'app-window': AppWindowMac,
  'chart-bar': ChartBar,
  'chart-line': ChartLine,
  'chart-pie': ChartPie,
  'credit-card': CreditCard,
  database: Database,
  folder: Folder,
  gauge: Gauge,
  globe: Globe,
  'layout-dashboard': LayoutDashboard,
  megaphone: Megaphone,
  package: Package,
  rocket: Rocket,
  'shopping-cart': ShoppingCart,
  star: Star,
  table: Table,
  truck: Truck,
  users: Users,
  wallet: Wallet,
};

/** The icon a name stands for, else the fallback. */
export function iconOf(name: string | undefined, fallback: LucideIcon): LucideIcon {
  return (name && icons[name]) || fallback;
}
