import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { ElkNode } from 'elkjs/lib/elk-api';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { type LineageGraph, lineageKinds, pathOf } from '../../model/lineage';
import {
  type LineageActions,
  LineageActionsContext,
  type LineageFlowNode,
  LineageNodeCard,
  type NodeTone,
} from './lineage-node';

const nodeTypes = { lineage: LineageNodeCard };

const edgeColor = { normal: '#a78bfa', onPath: '#7c3aed' };

/** Each kind's colour on the minimap. */
const minimapColors: Record<string, string> = {
  block: '#6366f1',
  query: '#10b981',
  metric: '#14b8a6',
  dimension: '#0ea5e9',
  dataset: '#f59e0b',
  model: '#8b5cf6',
  table: '#64748b',
};

/** ELK, loaded with the first canvas: the layout engine is most of this tab's weight. */
let elk: Promise<{ layout(graph: ElkNode): Promise<ElkNode> }> | undefined;
function loadElk() {
  elk ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK());
  return elk;
}

interface Props {
  /** The graph to draw, already filtered and focused. */
  graph: LineageGraph;
  /** The node whose path is pinned. */
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  actions: LineageActions;
  /** The large view's overview of the whole canvas. */
  minimap?: boolean;
}

/**
 * Whether the page is dark: the host sets `.dark` on the root, from the system or the reader's
 * toggle. React Flow's own `colorMode` would follow only the system.
 */
function useDarkPage(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
  );
}

/** The lineage as a canvas: zoom, pan, and a click to pin a node's path. Each one has its own viewport. */
export function LineageCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <LineageActionsContext.Provider value={props.actions}>
        <Canvas {...props} />
      </LineageActionsContext.Provider>
    </ReactFlowProvider>
  );
}

function Canvas({ graph, selected, onSelect, minimap = false }: Props) {
  const { fitView, getInternalNode } = useReactFlow();
  const dark = useDarkPage();
  const initialized = useNodesInitialized();
  const [nodes, setNodes, onNodesChange] = useNodesState<LineageFlowNode>([]);
  // Where ELK put each node, for the graph of this shape: a new shape is laid out again.
  const shape = `${graph.nodes.map((n) => n.id).join()}|${graph.edges.map((e) => e.id).join()}`;
  const [layout, setLayout] = useState<{ shape: string; at: Map<string, { x: number; y: number }> }>();
  const laidOut = layout?.shape === shape ? layout.at : undefined;

  const path = useMemo(
    () => (selected && graph.nodes.some((n) => n.id === selected) ? pathOf(graph, selected) : undefined),
    [graph, selected],
  );

  // The cards, drawn unseen until they are measured and laid out, then where ELK put them.
  useEffect(() => {
    setNodes((previous) => {
      const before = new Map(previous.map((n) => [n.id, n]));
      return graph.nodes.map((node) => {
        const tone: NodeTone = !path
          ? 'normal'
          : node.id === selected
            ? 'selected'
            : path.nodes.has(node.id)
              ? 'on-path'
              : 'dim';
        return {
          id: node.id,
          type: 'lineage',
          position: laidOut?.get(node.id) ?? before.get(node.id)?.position ?? { x: 0, y: 0 },
          data: { node, tone },
          style: laidOut ? undefined : { opacity: 0 },
        };
      });
    });
  }, [graph, path, selected, laidOut, setNodes]);

  // Once every card has its size, lay the graph out top to bottom, a row per kind.
  useEffect(() => {
    if (!initialized || laidOut || graph.nodes.length === 0) return;
    // A card just added isn't measured yet: wait for it, as `initialized` turns again.
    if (graph.nodes.some((node) => !getInternalNode(node.id)?.measured?.height)) return;
    let cancelled = false;
    void loadElk()
      .then((engine) =>
        engine.layout({
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.partitioning.activate': 'true',
            // One set of columns for the whole page: a block whose query reads nothing stays in the block column.
            'elk.separateConnectedComponents': 'false',
            'elk.layered.spacing.nodeNodeBetweenLayers': '80',
            'elk.spacing.nodeNode': '28',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          },
          children: graph.nodes.map((node) => {
            const measured = getInternalNode(node.id)?.measured;
            return {
              id: node.id,
              width: measured?.width ?? 240,
              height: measured?.height ?? 80,
              layoutOptions: { 'elk.partitioning.partition': String(lineageKinds.indexOf(node.kind)) },
            };
          }),
          edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
        }),
      )
      .then((result) => {
        if (cancelled) return;
        const at = new Map((result.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
        setLayout({ shape, at });
      });
    return () => {
      cancelled = true;
    };
  }, [initialized, laidOut, graph, shape, getInternalNode]);

  // A new layout is fitted to the view, but never so small that cards can't be read: the large view
  // shows the rest.
  useEffect(() => {
    if (!laidOut) return;
    const frame = requestAnimationFrame(
      () => void fitView({ padding: 0.12, duration: 200, maxZoom: 1, minZoom: minimap ? 0.2 : 0.6 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [laidOut, fitView, minimap]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const on = path?.edges.has(e.id) ?? false;
        const color = on ? edgeColor.onPath : edgeColor.normal;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color },
          style: { stroke: color, strokeWidth: on ? 2 : 1.25, opacity: path && !on ? 0.15 : 1 },
          zIndex: on ? 1 : 0,
          focusable: false,
        };
      }),
    [graph, path],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onSelect(node.id === selected ? undefined : node.id)}
      onPaneClick={() => onSelect(undefined)}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      minZoom={0.1}
      maxZoom={2}
      colorMode={dark ? 'dark' : 'light'}
      className="bg-muted/30"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <Controls showInteractive={false} position="bottom-left" />
      {minimap && (
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => minimapColors[(n as LineageFlowNode).data.node.kind] ?? '#94a3b8'}
          position="bottom-right"
        />
      )}
    </ReactFlow>
  );
}
