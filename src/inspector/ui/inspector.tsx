import type { StructureNode } from '@holistics/anfra-sdk/common';
import { X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { countProblems, entityKey } from '../model/format';
import type { InspectorSource } from '../source';
import { DataTab } from './data/data-tab';
import { Note } from './shared/fields';
import { StructureTree } from './structure/structure-tree';

export type InspectorTab = 'structure' | 'data';

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
 * A devtool over the running Data App. Structure shows the page's parts as its markup declares
 * them; Data shows every app's queries, controls and selection. See SPEC.md.
 */
export function Inspector({ source, tab, onTab, picked, onClose }: Props) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);
  const structure = snapshot?.structure;
  const problems = structure ? countProblems(structure.nodes) : 0;
  // A query or control asked for from the Structure tab: Data opens on it.
  const [focus, setFocus] = useState<{ key: string; nonce: number }>();
  const showInData = (node: StructureNode) => {
    if (node.kind !== 'query' && node.kind !== 'control') return;
    setFocus({ key: entityKey(node.kind, node.app ?? 0, node.name ?? ''), nonce: Date.now() });
    onTab('data');
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTab(value as InspectorTab)}
      className="h-full gap-0 border-l"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-2">
        <TabsList className="h-8">
          <TabsTrigger value="structure" className="px-2.5 text-xs">
            Structure
            {problems > 0 && (
              <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                {problems}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="data" className="px-2.5 text-xs">
            Data
          </TabsTrigger>
        </TabsList>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close the inspect panel"
        >
          <X />
        </Button>
      </div>

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
                picked={picked}
                onHighlight={source.highlight}
                onLocate={(node) => source.locate({ node })}
                onShowInData={showInData}
              />
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="data" className="min-h-0">
        <div className="h-full overflow-y-auto">
          <DataTab apps={snapshot?.apps} structure={structure} focus={focus} onLocate={source.locate} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
