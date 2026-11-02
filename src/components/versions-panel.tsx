import { GitCompare, History, Minus, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAgo } from '@/lib/format';
import { type MockChangeKind, type MockVersion, mockVersionsFor } from '@/lib/mock-versions';
import { cn } from '@/lib/utils';

const changeStyle: Record<MockChangeKind, { icon: ReactNode; className: string }> = {
  added: { icon: <Plus className="size-3" />, className: 'icon-success-default' },
  changed: { icon: <Pencil className="size-3" />, className: 'icon-warning-default' },
  removed: { icon: <Minus className="size-3" />, className: 'icon-danger-default' },
};

interface Props {
  onClose: () => void;
}

/**
 * A preview of the open Data App's version history, drawn from mock data because apps have no
 * history yet. Every part that stands in for the real thing says so: the banner, the "Sample" tag on
 * each version and the disabled actions.
 */
export function VersionsPanel({ onClose }: Props) {
  const versions = mockVersionsFor();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-default px-2">
        <h2 className="min-w-0 flex-1 truncate pl-1 text-heading">Versions</h2>
        <Badge variant="outline">Demo data</Badge>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={onClose}
          aria-label="Close the versions panel"
        >
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <MockBanner />
        <ol className="overflow-hidden rounded-xl border border-default bg-card" aria-label="Versions">
          {versions.map((version) => (
            <li key={version.id} className="border-t border-weak first:border-t-0">
              <VersionRow version={version} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Says, before anything else, that what follows is not real. */
function MockBanner() {
  return (
    <div
      role="note"
      className="grid grid-cols-[auto_1fr] gap-x-2 rounded-xl border border-default bg-info-secondary-default px-2.5 py-2 text-body text-default"
    >
      <History className="mt-0.5 size-4 shrink-0 icon-info-default" />
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">Demo data</Badge>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="text-pretty">
          Version history isn't available yet. The versions below are made up, to show how it will look once
          it is ready.
        </p>
      </div>
    </div>
  );
}

function VersionRow({ version }: { version: MockVersion }) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-label text-default">{version.id}</span>
        {version.current && (
          <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-pill bg-highlight-secondary-default px-2 text-caption font-medium whitespace-nowrap text-highlight-default before:size-1.5 before:shrink-0 before:rounded-full before:bg-current">
            Current
          </span>
        )}
        <span className="ml-auto font-mono text-caption tracking-[0.025em] text-placeholder uppercase dark:font-[550]">
          Sample
        </span>
      </div>
      <p className="text-body text-pretty text-default">{version.summary}</p>
      <ul className="space-y-1">
        {version.changes.map((change) => (
          <li
            key={`${change.kind}:${change.text}`}
            className={cn('flex items-center gap-1.5 text-caption', changeStyle[change.kind].className)}
          >
            {changeStyle[change.kind].icon}
            <span className="text-weak">{change.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-caption text-placeholder tabular-nums">
          {version.author} · <VersionTime at={version.createdAt} />
        </p>
        <SoonButton icon={<GitCompare />}>Compare</SoonButton>
        {!version.current && <SoonButton icon={<RotateCcw />}>Restore</SoonButton>}
      </div>
    </div>
  );
}

/** How long ago a version was made; the full date on hover. */
function VersionTime({ at }: { at: Date }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatAgo(at)}</span>
      </TooltipTrigger>
      <TooltipContent>{at.toLocaleString()}</TooltipContent>
    </Tooltip>
  );
}

/** An action that isn't built yet: shown so the design reads whole, disabled, and says why on hover. */
function SoonButton({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button swallows pointer events, so the span carries the tooltip. */}
        <span>
          <Button variant="outline" disabled>
            {icon}
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Coming soon</TooltipContent>
    </Tooltip>
  );
}
