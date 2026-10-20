import type { DatasetDescriptor, InspectedApp } from '@holistics/anfra-sdk/common';
import { ArrowDown, ArrowUp, Crosshair, PencilLine, Plus, Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type AqlCheck, editEnabled, validateAql } from '@/data-app';
import type { InspectorSource } from '@/inspector';
import { dedent } from '@/inspector/model/declaration-code';
import { queryInputs } from '@/inspector/model/inputs';
import { CodeBlock } from '@/inspector/ui/shared/code-block';
import { cn } from '@/lib/utils';
import { type ExploreParts, parseExplore, writeExplore } from '../model/aql';
import { nodeTitle, type QueryRef, queriesOfNode } from '../model/block';
import {
  addField,
  addFilter,
  aliasesOf,
  conditionText,
  type FilterOperator,
  isBareRef,
  keepAliases,
  OPERATORS,
  removeAlias,
  removeAt,
  removeField,
  setSorts,
  sortsOf,
  swapMeasure,
  uses,
} from '../model/draft';
import { type FieldGroup, type FieldOption, fieldGroups } from '../model/fields';
import { type EditRecord, hashOf, saveEdit } from '../model/history';
import { isUnsaved, type PreviewEdit } from '../model/preview';
import { loadSources, type SourceFile, type TierResult, tierOf } from '../model/tier';
import { draftWarnings } from '../model/warnings';

interface Props {
  source: InspectorSource;
  /** The open Data App's path under `apps/`. */
  path: string;
  datasets: Record<string, DatasetDescriptor>;
  /** The picked node's structure key, or none yet. */
  node: string | undefined;
  picking: boolean;
  /** The drafts the frame runs now, swapped in before it mounted. */
  previews: PreviewEdit[];
  onPreview: (edit: PreviewEdit) => void;
  /** Back to the query as the file has it. */
  onDiscard: (query: string) => void;
  /** Just before a save writes the app's file: the page holds off live reload. */
  onWriting: () => void;
  /** A preview saved into the app's file. */
  onSaved: (record: EditRecord) => void;
  /** Changes when the app's files were written, so the panel reads them again. */
  filesVersion: number;
  onTogglePicking: () => void;
  onClose: () => void;
}

const tierTone: Record<TierResult['tier'], string> = {
  1: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  2: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  3: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  4: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
};

/**
 * The Edit panel: what the picked block queries, and a draft of each query to preview (SPEC.md).
 * Mounted once per app, not per frame, so drafts survive a reload.
 */
export function EditPanel(props: Props) {
  const { source, path, datasets, node, picking, previews, onTogglePicking, onClose } = props;
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);
  const [sources, setSources] = useState<SourceFile[]>();
  const [sourceError, setSourceError] = useState<string>();
  const [enabled, setEnabled] = useState<boolean>();
  // Each query's draft, by name, kept while the panel is open on this app.
  const [drafts, setDrafts] = useState<Record<string, ExploreParts>>({});

  // Read again after the panel writes the files, to save the next edit over what is there now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filesVersion says the files changed
  useEffect(() => {
    let cancelled = false;
    setSourceError(undefined);
    loadSources(path).then(
      (read) => !cancelled && setSources(read),
      (err: Error) => !cancelled && setSourceError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [path, props.filesVersion]);
  useEffect(() => {
    editEnabled().then(setEnabled, () => setEnabled(false));
  }, []);

  const refs = node ? queriesOfNode(snapshot?.structure, node) : [];
  const title = node ? nodeTitle(snapshot?.structure, node) : undefined;

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <PencilLine className="ml-1 size-4 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate pl-1 text-sm font-medium">
          {title ? `Edit · ${title}` : 'Edit'}
        </h2>
        {enabled === false && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">Read-only</Badge>
            </TooltipTrigger>
            <TooltipContent>Start the host with EDIT=1 to edit.</TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7', picking && 'bg-accent text-accent-foreground')}
          aria-pressed={picking}
          onClick={onTogglePicking}
        >
          <Crosshair />
          Pick
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close the edit panel"
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {sourceError && <Note tone="error">{sourceError}</Note>}
        {!node ? (
          <Note>
            {picking ? 'Click a block on the page to edit it.' : 'Pick a block on the page to edit it.'}
          </Note>
        ) : !snapshot ? (
          <Note>Waiting for the Data App to report its structure…</Note>
        ) : refs.length === 0 ? (
          <Note>This element shows no query. Pick a chart, a table or a KPI.</Note>
        ) : (
          refs.map((ref) => (
            <QuerySection
              key={`${ref.app}/${ref.name}`}
              queryRef={ref}
              app={snapshot.apps[ref.app]}
              datasets={datasets}
              sources={sources}
              enabled={!!enabled}
              preview={previews.find((p) => p.query === ref.name)}
              draft={drafts[ref.name]}
              setDraft={(parts) =>
                setDrafts((all) => {
                  const next = { ...all };
                  if (parts) next[ref.name] = parts;
                  else delete next[ref.name];
                  return next;
                })
              }
              onPreview={props.onPreview}
              onDiscard={props.onDiscard}
              onSaved={props.onSaved}
              onWriting={props.onWriting}
              path={path}
            />
          ))
        )}
      </div>
    </div>
  );
}

function QuerySection({
  queryRef,
  app,
  datasets,
  sources,
  enabled,
  preview,
  draft: kept,
  setDraft,
  onPreview,
  onDiscard,
  onSaved,
  onWriting,
  path,
}: {
  queryRef: QueryRef;
  app: InspectedApp | undefined;
  datasets: Record<string, DatasetDescriptor>;
  sources: SourceFile[] | undefined;
  enabled: boolean;
  preview: PreviewEdit | undefined;
  draft: ExploreParts | undefined;
  setDraft: (parts: ExploreParts | undefined) => void;
  onPreview: (edit: PreviewEdit) => void;
  onDiscard: (query: string) => void;
  onSaved: (record: EditRecord) => void;
  onWriting: () => void;
  path: string;
}) {
  const name = queryRef.name;
  const declaration = app?.declaration.queries[name];
  const dataset = declaration ? datasets[declaration.dataset] : undefined;
  // What the frame declared; the AQL as the file has it now (after a save, not what the frame
  // declared); and what the frame runs, with a preview on.
  const declared = declaration?.aql ?? '';
  const base = preview?.base ?? declared;
  const running = preview?.to ?? declared;
  const unsaved = !!preview && isUnsaved(preview);
  const baseParts = useMemo(() => parseExplore(base), [base]);
  const runningParts = useMemo(() => parseExplore(running), [running]);
  const draft = kept ?? runningParts;
  const draftAql = draft ? writeExplore(base, draft) : running;
  const dirty = draftAql !== running;
  const groups = useMemo(() => fieldGroups(dataset), [dataset]);
  const tier = useMemo(() => {
    if (!sources || !app) return undefined;
    const declared = Object.fromEntries(Object.entries(app.declaration.queries).map(([n, q]) => [n, q.aql]));
    if (preview) declared[name] = base;
    return tierOf(name, base, sources, declared);
  }, [sources, app, name, base, preview]);
  const editable = enabled && !!draft && !!tier?.file && (tier.tier === 1 || tier.tier === 2);
  const inputs = app ? queryInputs(app, name) : [];
  const warnings = baseParts && draft ? draftWarnings(app, name, baseParts, draft) : [];
  const [codeTab, setCodeTab] = useState<'draft' | 'file'>('draft');
  const [check, setCheck] = useState<
    { state: 'checking' } | { state: 'failed'; error: string } | ({ state: 'done' } & AqlCheck)
  >();
  const [saving, setSaving] = useState<{ state: 'saving' } | { state: 'failed'; error: string }>();
  // What runs changed (applied, saved over, reverted): a draft kept from before would read as a change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of what runs only
  useEffect(() => setDraft(undefined), [running]);

  if (!declaration) return <Note tone="error">No query named {name} in the app.</Note>;

  const change = (next: ExploreParts) => {
    setCheck(undefined);
    setDraft(baseParts ? keepAliases(baseParts, next) : next);
  };
  const apply = async () => {
    if (!tier?.file || !draft) return;
    setCheck({ state: 'checking' });
    try {
      const result = await validateAql(declaration.dataset, draftAql);
      setCheck({ state: 'done', ...result });
      if (result.valid) onPreview({ query: name, file: tier.file, from: declared, to: draftAql, base });
    } catch (err) {
      setCheck({ state: 'failed', error: (err as Error).message });
    }
  };
  const discard = () => {
    setCheck(undefined);
    setSaving(undefined);
    setDraft(undefined);
    if (preview && !dirty) onDiscard(name);
  };
  const save = async () => {
    const file = preview && sources?.find((f) => f.file === preview.file);
    if (!preview || !file) return;
    setSaving({ state: 'saving' });
    onWriting();
    try {
      const record = await saveEdit(path, {
        query: name,
        file: preview.file,
        before: preview.base,
        after: preview.to,
        hash: await hashOf(file.text),
      });
      setSaving(undefined);
      onSaved(record);
    } catch (err) {
      setSaving({ state: 'failed', error: (err as Error).message });
    }
  };

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{declaration.dataset}</span>
          {preview && unsaved && <Badge variant="secondary">Previewing</Badge>}
          {preview && !unsaved && <Badge variant="secondary">Saved</Badge>}
          <span className="flex-1" />
          {tier ? (
            <Badge variant="outline" className={tierTone[tier.tier]}>
              Tier {tier.tier}
            </Badge>
          ) : (
            <Badge variant="outline">Reading source…</Badge>
          )}
        </div>
        {tier && <p className="text-xs text-muted-foreground">{tier.reason}</p>}
        {tier && !editable && (
          <p className="text-xs text-muted-foreground">
            {!enabled
              ? 'Read-only: start the host with EDIT=1 to edit.'
              : tier.tier >= 3
                ? 'Not editable here yet: Copy prompt for this kind of query comes in phase 4.'
                : 'Not an explore the panel can read.'}
          </p>
        )}
      </header>

      {draft && (
        <InQuery
          draft={draft}
          groups={groups}
          editable={editable}
          onRemove={(alias) => change(removeAlias(draft, alias))}
          onSwap={(alias, ref) => change(swapMeasure(draft, alias, ref))}
        />
      )}

      <Fields
        groups={groups}
        isTicked={(option) => !!draft && uses(draft, option)}
        editable={editable}
        onToggle={(option, on) =>
          draft && change(on ? addField(draft, option) : removeField(draft, option.ref))
        }
      />

      <Group
        title="Filters in the query"
        count={draft?.filters.length ?? 0}
        empty={editable ? undefined : 'None.'}
      >
        {draft?.filters.map((entry, index) => (
          <Row
            // A filter is its text; two the same would be one condition written twice.
            key={entry.expression}
            label={entry.expression}
            onRemove={editable ? () => change(removeAt(draft, 'filters', index)) : undefined}
          />
        ))}
        {editable && draft && <AddFilter groups={groups} onAdd={(text) => change(addFilter(draft, text))} />}
      </Group>

      <Group
        title="Dashboard filters"
        count={inputs.length}
        hint="Set by the reader, sent beside the AQL. Editing the query never changes them, and a preview keeps them."
        empty="None mapped to this query."
      >
        {inputs.map((input) => (
          <Row
            key={`${input.kind}:${input.source}:${input.field}`}
            // A cross-filter has no field until something is selected: say what it is instead of a dash.
            label={
              input.kind === 'crossFilter'
                ? `${input.source} · cross-filter${input.field === '—' ? '' : ` on ${input.field}`}`
                : `${input.source} · ${input.field}`
            }
            detail={input.value}
          />
        ))}
      </Group>

      {draft && <Sorts draft={draft} editable={editable} onChange={change} />}

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((warning) => (
            <li
              key={warning.message}
              className={cn(
                'rounded border px-2 py-1 text-xs',
                warning.level === 'warn'
                  ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground',
              )}
            >
              {warning.message}
            </li>
          ))}
        </ul>
      )}

      <CodeBlock
        tab={codeTab}
        onTab={setCodeTab}
        sources={{
          draft: {
            label: dirty ? 'Draft AQL' : 'AQL',
            code: dedent(draftAql),
            lang: 'aql',
            empty: 'No AQL.',
          },
          file: {
            label: 'In the file',
            code: base !== draftAql ? dedent(base) : undefined,
            lang: 'aql',
            empty: 'Same as the draft.',
          },
        }}
      />

      {check?.state === 'failed' && <Note tone="error">{check.error}</Note>}
      {check?.state === 'done' && !check.valid && (
        <ul className="space-y-1 text-xs text-destructive">
          {check.diagnostics.map((d) => (
            <li key={`${d.line}:${d.column}:${d.message}`}>
              {d.line ? `Line ${d.line}${d.column ? `, column ${d.column}` : ''}: ` : ''}
              {d.message}
            </li>
          ))}
        </ul>
      )}

      {saving?.state === 'failed' && <Note tone="error">{saving.error}</Note>}

      {editable && dirty && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={apply} disabled={check?.state === 'checking'}>
            {check?.state === 'checking' ? 'Checking…' : 'Apply'}
          </Button>
          <Button size="sm" variant="outline" onClick={discard}>
            Discard
          </Button>
          <span className="text-xs text-muted-foreground">Checks the AQL, then previews it.</span>
        </div>
      )}
      {editable && !dirty && unsaved && preview && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving?.state === 'saving'}>
            {saving?.state === 'saving' ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={discard}>
            Back to the file's version
          </Button>
          <span className="text-xs text-muted-foreground">
            Previewing. Save writes it into {preview.file}.
          </span>
        </div>
      )}
      {!dirty && preview && !unsaved && (
        <p className="text-xs text-muted-foreground">
          Saved into {preview.file}, uncommitted. Revert it from Versions.
        </p>
      )}
    </section>
  );
}

/** The query's dimensions and measures by alias: remove one, or swap a measure keeping its alias. */
function InQuery({
  draft,
  groups,
  editable,
  onRemove,
  onSwap,
}: {
  draft: ExploreParts;
  groups: FieldGroup[];
  editable: boolean;
  onRemove: (alias: string) => void;
  onSwap: (alias: string, ref: string) => void;
}) {
  const metrics = groups.flatMap((g) => g.options).filter((o) => o.kind === 'metric');
  const entries = [
    ...draft.dimensions.map((entry) => ({ ...entry, kind: 'dimension' as const })),
    ...draft.measures.map((entry) => ({ ...entry, kind: 'measure' as const })),
  ];
  return (
    <Group
      title="In this query"
      count={entries.length}
      hint={editable ? 'Swapping a measure keeps its name, so the chart still draws it.' : undefined}
    >
      {entries.map((entry) => (
        <div
          key={`${entry.kind}:${entry.alias ?? entry.expression}`}
          className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1 text-xs"
        >
          <span className="w-16 shrink-0 text-muted-foreground">{entry.kind}</span>
          <span className="min-w-0 truncate font-mono">{entry.alias ?? '—'}</span>
          {editable && entry.kind === 'measure' && entry.alias && isBareRef(entry.expression) ? (
            <select
              className="ml-auto min-w-0 rounded border bg-background px-1 py-0.5 font-mono text-xs"
              value={entry.expression}
              onChange={(event) => entry.alias && onSwap(entry.alias, event.target.value)}
              aria-label={`Swap ${entry.alias} for another metric`}
            >
              {!metrics.some((m) => m.ref === entry.expression) && (
                <option value={entry.expression}>{entry.expression}</option>
              )}
              {metrics.map((metric) => (
                <option key={metric.ref} value={metric.ref}>
                  {metric.ref}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="ml-auto min-w-0 truncate font-mono text-muted-foreground"
              title={entry.expression}
            >
              {entry.expression}
            </span>
          )}
          {editable && entry.alias && (
            <RemoveButton
              label={`Remove ${entry.alias}`}
              onClick={() => entry.alias && onRemove(entry.alias)}
            />
          )}
        </div>
      ))}
    </Group>
  );
}

/** The dataset's metrics and fields, searchable, those the query uses ticked and first. */
function Fields({
  groups,
  isTicked,
  editable,
  onToggle,
}: {
  groups: FieldGroup[];
  isTicked: (option: FieldOption) => boolean;
  editable: boolean;
  onToggle: (option: FieldOption, on: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      options: group.options
        .filter((o) => !term || o.ref.toLowerCase().includes(term) || o.label.toLowerCase().includes(term))
        .sort((a, b) => Number(isTicked(b)) - Number(isTicked(a))),
    }))
    .filter((group) => group.options.length);
  const count = groups.flatMap((g) => g.options).filter(isTicked).length;
  return (
    <Group
      title="Fields"
      count={count}
      hint={editable ? 'Tick to add to the query, untick to take out.' : 'Ticked: used by this query.'}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search metrics and fields"
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {shown.map((group) => (
          <div key={group.name}>
            <div className="px-1 pb-0.5 text-[11px] font-medium text-muted-foreground uppercase">
              {group.label}
            </div>
            {group.options.map((option) => {
              const ticked = isTicked(option);
              return (
                <label
                  key={option.ref}
                  className={cn(
                    'flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50',
                    editable && 'cursor-pointer',
                  )}
                  title={option.ref}
                >
                  <input
                    type="checkbox"
                    checked={ticked}
                    disabled={!editable}
                    onChange={(event) => onToggle(option, event.target.checked)}
                    className="accent-primary"
                  />
                  <span className={cn('min-w-0 truncate', ticked && 'font-medium')}>{option.label}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {option.ref}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
        {shown.length === 0 && <p className="px-1 text-xs text-muted-foreground">Nothing matches.</p>}
      </div>
    </Group>
  );
}

/** A field, an operator and a value, added as one condition. */
function AddFilter({ groups, onAdd }: { groups: FieldGroup[]; onAdd: (text: string) => void }) {
  const fields = groups.flatMap((g) => g.options).filter((o) => o.kind === 'dimension');
  const [field, setField] = useState('');
  const [operator, setOperator] = useState<FilterOperator>('==');
  const [value, setValue] = useState('');
  const option = fields.find((f) => f.ref === field);
  const add = () => {
    if (!option || !value.trim()) return;
    onAdd(conditionText(option.ref, option.type, operator, value));
    setValue('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        className="h-7 min-w-0 flex-1 rounded border bg-background px-1 text-xs"
        value={field}
        onChange={(event) => setField(event.target.value)}
        aria-label="Field to filter on"
      >
        <option value="">Field…</option>
        {fields.map((f) => (
          <option key={f.ref} value={f.ref}>
            {f.ref}
          </option>
        ))}
      </select>
      <select
        className="h-7 rounded border bg-background px-1 text-xs"
        value={operator}
        onChange={(event) => setOperator(event.target.value as FilterOperator)}
        aria-label="Operator"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder={option?.type ? `Value (${option.type})` : 'Value'}
        className="h-7 w-28 text-xs"
      />
      <Button size="sm" variant="outline" className="h-7" onClick={add} disabled={!option || !value.trim()}>
        <Plus />
        Add
      </Button>
    </div>
  );
}

/** The query's sorts: flip a direction, remove one, or add one on any of its columns. */
function Sorts({
  draft,
  editable,
  onChange,
}: {
  draft: ExploreParts;
  editable: boolean;
  onChange: (parts: ExploreParts) => void;
}) {
  const sorts = sortsOf(draft);
  const free = aliasesOf(draft).filter((alias) => !sorts.some((s) => s.alias === alias));
  return (
    <Group title="Sorts" count={sorts.length} empty={editable ? undefined : 'None in the query.'}>
      {sorts.map((sort, index) => (
        <div
          key={sort.alias}
          className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1 text-xs"
        >
          <span className="min-w-0 truncate font-mono">{sort.alias}</span>
          <span className="flex-1" />
          {editable ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={() =>
                onChange(
                  setSorts(
                    draft,
                    sorts.map((s, i) =>
                      i === index ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s,
                    ),
                  ),
                )
              }
            >
              {sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />}
              {sort.direction}
            </Button>
          ) : (
            <span className="text-muted-foreground">{sort.direction}</span>
          )}
          {editable && (
            <RemoveButton
              label={`Remove the sort on ${sort.alias}`}
              onClick={() => onChange(removeAt(draft, 'sorts', index))}
            />
          )}
        </div>
      ))}
      {editable && free.length > 0 && (
        <select
          className="h-7 w-full rounded border bg-background px-1 text-xs"
          value=""
          onChange={(event) =>
            event.target.value &&
            onChange(setSorts(draft, [...sorts, { alias: event.target.value, direction: 'desc' }]))
          }
          aria-label="Add a sort"
        >
          <option value="">Add a sort on…</option>
          {free.map((alias) => (
            <option key={alias} value={alias}>
              {alias}
            </option>
          ))}
        </select>
      )}
    </Group>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <X className="size-3" />
    </button>
  );
}

function Group({
  title,
  count,
  hint,
  empty,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-xs font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {count === 0 && empty ? <p className="text-xs text-muted-foreground">{empty}</p> : children}
    </div>
  );
}

function Row({ label, detail, onRemove }: { label: string; detail?: string; onRemove?: () => void }) {
  return (
    <div
      className="flex items-start gap-2 rounded border bg-muted/20 px-2 py-1 text-xs"
      title={detail ? `${label}\n${detail}` : label}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-mono break-all">{label}</div>
        {detail && <div className="break-words text-muted-foreground">{detail}</div>}
      </div>
      {onRemove && <RemoveButton label={`Remove ${label}`} onClick={onRemove} />}
    </div>
  );
}

function Note({ tone, children }: { tone?: 'error'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-lg border border-dashed p-3 text-xs text-muted-foreground',
        tone === 'error' && 'border-destructive/40 text-destructive',
      )}
    >
      {children}
    </p>
  );
}
