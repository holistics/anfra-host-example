import {
  AppWindow,
  Download,
  History,
  type LucideIcon,
  MessageCircle,
  ScanSearch,
  ScrollText,
} from 'lucide-react';
import type { Command, Mounted } from '@/data-app';
import { hiddenCommands } from '@/lib/shell';

/** The icon this host draws for each icon name a command gives; a command naming another gets a plain one. */
export const commandIcons: Record<string, LucideIcon> = {
  inspect: ScanSearch,
  download: Download,
  comment: MessageCircle,
  prompt: ScrollText,
  history: History,
};
export const commandIcon = (command: Command): LucideIcon =>
  (command.icon && commandIcons[command.icon]) || AppWindow;

/** The commands this page draws in its chrome: not the menu's on the page (`target`), nor its own hidden ones. */
export const chromeCommands = (mounted: Mounted | undefined): Command[] =>
  mounted?.host.commands.filter((command) => !command.target && !hiddenCommands.has(command.id)) ?? [];
