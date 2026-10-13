import { useEffect, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { wiringChecks } from '../model/checks';
import { countProblems, entityKey } from '../model/format';
import { queryCounts } from '../model/issues';
import { buildReport } from '../model/report';
import type { InspectorTab, RevealTarget } from '../model/types';
import type { InspectorSource } from '../source';
import { DataTab } from './data/data-tab';
import { InspectorHeader } from './header';
import { OverviewTab } from './overview/overview-tab';
import { Note } from './shared/fields';
import { StructureTree } from './structure/structure-tree';

interface Props {
  /** The mounted frame to inspect. */
  source: InspectorSource;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  /** The node picked on the page, to select and reveal in the tree. The host owns pick mode. */
  picked: string | undefined;
  onClose: () => void;
}

/**
 * A devtool over the running Data App: its health at a glance, the page's parts as its markup
 * declares them, and every app's queries, controls and selection. See SPEC.md.
 */
export function Inspector({ source, tab, onTab, picked, onClose }: Props) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);
  const apps = snapshot?.apps;
  const structure = snapshot?.structure;
  const problems = structure ? countProblems(structure.nodes) : 0;
  const counts = apps && queryCounts(apps);

  // An entity to open in Data, or a node to select in Structure; the nonce repeats a request.
  const [focus, setFocus] = useState<{ key: string; nonce: number }>();
  const [node, setNode] = useState<string>();
  useEffect(() => setNode(picked), [picked]);

  const reveal = (target: RevealTarget) => {
    if ('tab' in target) {
      onTab(target.tab);
    } else if ('entity' in target) {
      setFocus({ key: entityKey(target.entity, target.app, target.name), nonce: Date.now() });
      onTab('data');
    } else if ('check' in target) {
      const app = apps?.[target.app];
      const check = app && wiringChecks(app)[target.check];
      if (check) reveal({ entity: check.about.entity, app: target.app, name: check.about.name });
    } else {
      setNode(target.node);
      onTab('structure');
    }
  };

  const title =
    !apps || apps.length === 0
      ? (source.env.path ?? 'Inspect')
      : apps.length === 1
        ? apps[0]?.title || source.env.path || 'Untitled'
        : `${apps.length} apps`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tabs
        value={tab}
        onValueChange={(value) => onTab(value as InspectorTab)}
        className="h-full gap-0 border-l"
      >
        <InspectorHeader
          title={title}
          counts={counts}
          onShowQueries={() => onTab('data')}
          report={() => JSON.stringify(buildReport(snapshot, source.env), null, 2)}
          onClose={onClose}
        />
        <div className="shrink-0 overflow-x-auto border-b px-2 py-1.5">
          <TabsList className="h-8">
            <TabsTrigger value="overview" className="px-2.5 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="structure" className="px-2.5 text-xs">
              Structure
              <Count n={problems} />
            </TabsTrigger>
            <TabsTrigger value="data" className="px-2.5 text-xs">
              Data
              <Count n={counts?.error ?? 0} />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="min-h-0">
          <div className="h-full overflow-y-auto">
            <OverviewTab snapshot={snapshot} env={source.env} onReveal={reveal} />
          </div>
        </TabsContent>

        <TabsContent value="structure" className="min-h-0">
          <div className="h-full overflow-y-auto">
            <div className="p-2">
              {!structure && <Note>Waiting for the Data App…</Note>}
              {structure?.nodes.length === 0 && (
                <Note>
                  Nothing is marked yet. Add <code>data-anfra-container</code>, <code>data-anfra-block</code>,{' '}
                  <code>data-anfra-query</code> and <code>data-anfra-control</code> to the page's elements and
                  they show up here.
                </Note>
              )}
              {structure && structure.nodes.length > 0 && (
                <StructureTree
                  structure={structure}
                  picked={node}
                  onHighlight={source.highlight}
                  onLocate={(key) => source.locate({ node: key })}
                  onShowInData={(n) => {
                    if (n.kind === 'query' || n.kind === 'control') {
                      reveal({ entity: n.kind, app: n.app ?? 0, name: n.name ?? '' });
                    }
                  }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="min-h-0">
          <div className="h-full overflow-y-auto">
            <DataTab apps={apps} structure={structure} focus={focus} onLocate={source.locate} />
          </div>
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}

/** An issue count on a tab; nothing when there are none. */
function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
      {n}
    </Badge>
  );
}
