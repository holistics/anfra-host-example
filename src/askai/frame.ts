// The Ask AI plugin's frame half: an "Ask AI" item in the menu on a block, Ask AI mode (pick a
// marked element to comment on), and the card, drawn as the kernel's popover beside the node. It
// imports types only, beside ./model, since everything it needs comes through the kernel.
// Built by vite.config.ts (buildFrameHalf); the host half is ./plugin.ts. See SPEC.md.
import type { FrameKernel, Opened } from '@holistics/anfra-sdk/app';
import type { NodeTarget, StructureNode } from '@holistics/anfra-sdk/common';
import { attributeFor, type CommentRequest, nameOf, type SendTarget } from './model';

const MARKED = '[data-anfra-container],[data-anfra-block],[data-anfra-query],[data-anfra-control]';

/** The comment cursor: an arrow, its tip the hotspot, with a speech bubble at its lower right. */
const cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M3 2v18.5l4.6-4.4 3.2 7.2 3-1.3-3.2-7.1h6.2z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><g transform="translate(13.5 12.5) scale(0.78)"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="#4f46e5" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
const cursor = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") 3 2,crosshair`;

export default function setup(kernel: FrameKernel): void {
  const win = kernel.window;
  const doc = win.document;
  let stopPicking: (() => void) | undefined;
  let card: Opened | undefined;
  // Bumped per card, so a card that closes late doesn't clear the next one's state.
  let cards = 0;

  // The host's command is pressed while Ask AI mode is on or a card is open.
  const report = () => kernel.emit('state', { active: !!stopPicking || !!card });

  kernel.menuItem({
    id: 'ask',
    label: 'Ask AI',
    target: 'node',
    run: (target) => {
      if (target.kind === 'node') void open(target);
    },
  });

  // The host's Ask AI command: start Ask AI mode, or cancel it, or close the card.
  kernel.handle('pick', () => {
    if (stopPicking) stopPicking();
    else if (card) card.close();
    else startPicking();
  });

  /** The node a marked element stands for, as the frame's menu makes it. */
  function targetOf(element: Element): NodeTarget | undefined {
    const structure = kernel.structure();
    const key = structure.keysOf.get(element)?.[0];
    const path = key === undefined ? undefined : pathTo(structure.nodes, key);
    const node = path?.at(-1);
    if (!path || !node) return undefined;
    const { x, y, width, height } = element.getBoundingClientRect();
    return {
      kind: 'node',
      node: { ...node, children: node.children.map((child) => ({ ...child, children: [] })) },
      ancestors: path.slice(0, -1).map((above) => ({ ...above, children: [] })),
      rect: { x, y, width, height },
    };
  }

  const outline = (element: Element, node: StructureNode) =>
    kernel.overlay.show([element], { kind: node.kind, name: nameOf(node) });

  /**
   * Ask AI mode: a clear sheet over the page with the comment cursor, so clicks reach no app.
   * Pointing outlines the marked element underneath, a click opens the card on it, Escape cancels.
   */
  function startPicking() {
    card?.close();
    const sheet = doc.createElement('div');
    sheet.setAttribute('style', `position:fixed;inset:0;z-index:2147483646;cursor:${cursor};`);
    kernel.layer().append(sheet);
    let hovered: Element | null = null;
    const under = (event: MouseEvent) => {
      sheet.style.pointerEvents = 'none';
      const element = doc.elementFromPoint(event.clientX, event.clientY)?.closest(MARKED) ?? null;
      sheet.style.pointerEvents = '';
      return element;
    };
    const onMove = (event: MouseEvent) => {
      const element = under(event);
      if (element === hovered) return;
      hovered = element;
      const target = element && targetOf(element);
      if (element && target) outline(element, target.node);
      else kernel.overlay.hide();
    };
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      const element = under(event);
      const target = element && targetOf(element);
      if (!target) return;
      stop();
      void open(target);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      stop();
    };
    const stop = () => {
      sheet.remove();
      win.removeEventListener('keydown', onKey, true);
      kernel.overlay.hide();
      stopPicking = undefined;
      report();
    };
    sheet.addEventListener('mousemove', onMove);
    sheet.addEventListener('click', onClick);
    win.addEventListener('keydown', onKey, true);
    stopPicking = stop;
    report();
  }

  /** The card beside a node, the node outlined until it closes. */
  async function open(target: NodeTarget) {
    stopPicking?.();
    card?.close();
    const id = ++cards;
    const element = kernel.structure().elements.get(target.node.key);
    if (element) outline(element, target.node);
    const targets = await kernel.call<SendTarget[]>('askai.targets').catch((): SendTarget[] => []);
    let closeCard = () => {};
    const opened = await kernel.popover({
      anchor: target,
      // The card draws its own ×, inside its padding.
      closeButton: false,
      mount: (root) => drawCard(root, target, targets, () => closeCard()),
      onClose: () => {
        if (id !== cards) return;
        card = undefined;
        kernel.overlay.hide();
        report();
      },
    });
    if (id !== cards) return opened.close();
    card = opened;
    closeCard = () => opened.close();
    report();
  }

  /** The card's content: the node, the comment, Copy and Send (SPEC §4.2). */
  function drawCard(root: ShadowRoot, target: NodeTarget, targets: SendTarget[], close: () => void) {
    const { node, ancestors } = target;
    const h = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      props: Record<string, string> = {},
      text = '',
    ) => {
      const element = doc.createElement(tag);
      for (const [name, value] of Object.entries(props)) element.setAttribute(name, value);
      if (text) element.textContent = text;
      return element;
    };
    const style = h('style');
    style.textContent = CARD_CSS;
    const box = h('div', { class: 'card', role: 'dialog', 'aria-label': `Comment on ${nameOf(node)}` });
    const header = h('div', { class: 'header' });
    const closeButton = h('button', { type: 'button', class: 'close', 'aria-label': 'Close' }, '×');
    closeButton.addEventListener('click', close);
    header.append(
      h('span', { class: `pill ${node.kind}` }, node.kind),
      h('span', { class: 'name' }, nameOf(node)),
      closeButton,
    );
    const attribute = attributeFor(node);
    box.append(header, h('div', { class: 'handle', title: attribute }, attribute));
    if (node.problems.length) {
      const count = node.problems.length;
      box.append(
        h(
          'div',
          { class: 'problems', title: node.problems.join('\n') },
          `⚠ ${count} markup problem${count === 1 ? '' : 's'}`,
        ),
      );
    }
    const textarea = h('textarea', { placeholder: 'What do you want to ask or change?', rows: '3' });
    const actions = h('div', { class: 'actions' });
    const copy = h('button', { type: 'button', class: 'primary' }, 'Copy');
    const first = targets[0];
    const send = h('div', { class: 'split' });
    const sendMain = h('button', { type: 'button' }, `Send to ${first?.label ?? 'an agent'}`);
    const sendMore = h('button', { type: 'button', 'aria-label': 'Send to…', 'aria-haspopup': 'menu' }, '▾');
    const list = h('div', { class: 'list', role: 'menu', hidden: '' });
    for (const option of targets) {
      const item = h('button', { type: 'button', role: 'menuitem' });
      item.append(h('span', {}, option.label));
      if (option.disabled) {
        item.setAttribute('aria-disabled', 'true');
        item.append(h('span', { class: 'reason' }, option.disabled));
      }
      list.append(item);
    }
    if (!first || first.disabled) sendMain.setAttribute('aria-disabled', 'true');
    sendMain.title = first?.disabled ?? '';
    send.append(sendMain, sendMore, list);
    actions.append(copy, send);
    box.append(textarea, actions);
    root.append(style, box);

    const empty = () => !textarea.value.trim();
    const sync = () => {
      copy.toggleAttribute('aria-disabled', empty());
      copy.title = empty() ? 'Write a comment first' : 'Copy the prompt';
    };
    sync();
    textarea.addEventListener('input', sync);
    sendMore.addEventListener('click', () => list.toggleAttribute('hidden'));

    let copying = false;
    const doCopy = async () => {
      if (empty() || copying) return;
      copying = true;
      const request: CommentRequest = { node, ancestors, comment: textarea.value };
      try {
        const answer = await kernel.call<{ prompt: string; copied: boolean }>('askai.copy', request);
        if (answer.copied || copyHere(root, answer.prompt)) {
          copy.textContent = 'Copied';
          setTimeout(close, 900);
          return;
        }
        console.log(answer.prompt);
        copy.textContent = "Couldn't copy: logged to the console";
      } catch (err) {
        copy.textContent = `Couldn't copy: ${(err as Error).message}`;
      }
      setTimeout(() => {
        copy.textContent = 'Copy';
        copying = false;
      }, 2400);
    };
    copy.addEventListener('click', () => void doCopy());
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void doCopy();
      }
    });
    textarea.focus();
  }

  /** The frame's own copy, for when the host's clipboard refused (the host page wasn't focused). */
  function copyHere(root: ShadowRoot, text: string): boolean {
    const scratch = doc.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('style', 'position:fixed;opacity:0;');
    root.append(scratch);
    scratch.select();
    try {
      return doc.execCommand('copy');
    } catch {
      return false;
    } finally {
      scratch.remove();
    }
  }
}

/** The node with this key, and the nodes it sits in, outermost first. */
function pathTo(
  nodes: StructureNode[],
  key: string,
  above: StructureNode[] = [],
): StructureNode[] | undefined {
  for (const node of nodes) {
    if (node.key === key) return [...above, node];
    const inner = pathTo(node.children, key, [...above, node]);
    if (inner) return inner;
  }
  return undefined;
}

// On the host's tokens, which the popover's root inherits.
const CARD_CSS = `
.card { box-sizing: border-box; width: min(320px, calc(100vw - 32px)); padding: 12px; display: grid; gap: 8px; font: 13px/1.4 var(--anfra-font); color: var(--anfra-color-fg); }
.header { display: flex; align-items: center; gap: 6px; min-width: 0; }
.close { margin-left: auto; flex: none; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; color: var(--anfra-color-muted); font-size: 16px; line-height: 1; }
.close:hover { color: var(--anfra-color-fg); background: color-mix(in srgb, var(--anfra-color-fg) 7%, transparent); }
.name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { font-size: 11px; padding: 1px 6px; border-radius: 4px; flex: none; }
.pill.container { color: #7c3aed; background: color-mix(in srgb, #7c3aed 14%, transparent); }
.pill.block { color: #2563eb; background: color-mix(in srgb, #2563eb 14%, transparent); }
.pill.query { color: #059669; background: color-mix(in srgb, #059669 14%, transparent); }
.pill.control { color: #ea580c; background: color-mix(in srgb, #ea580c 14%, transparent); }
.handle { font: 12px var(--anfra-font-mono); color: var(--anfra-color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.problems { font-size: 12px; color: var(--anfra-color-danger); }
textarea { font: inherit; color: inherit; background: transparent; border: 1px solid var(--anfra-color-border); border-radius: var(--anfra-radius); padding: 6px 8px; resize: none; field-sizing: content; min-height: 3lh; max-height: 8lh; }
textarea:focus { outline: 2px solid var(--anfra-color-accent); outline-offset: -1px; }
.actions { display: flex; justify-content: flex-end; gap: 6px; }
button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--anfra-color-border); border-radius: var(--anfra-radius); padding: 4px 10px; cursor: pointer; }
button.primary { background: var(--anfra-color-fg); color: var(--anfra-color-bg); border-color: transparent; }
button[aria-disabled] { opacity: 0.5; cursor: not-allowed; }
.split { position: relative; display: flex; }
.split > button:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.split > button:nth-child(2) { border-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; padding: 4px 6px; }
.list { position: absolute; right: 0; bottom: calc(100% + 4px); display: grid; min-width: 220px; padding: 4px; background: var(--anfra-color-bg); border: 1px solid var(--anfra-color-border); border-radius: var(--anfra-radius); }
.list[hidden] { display: none; }
.list button { border: 0; display: flex; justify-content: space-between; gap: 12px; text-align: left; }
.list button[aria-disabled] { opacity: 1; color: var(--anfra-color-muted); }
.reason { font-size: 12px; }
`;
