# Ask AI

Point at a part of a running Data App, say what is wrong with it, and hand that to an agent as a
prompt it can act on. This spec comes before the code. When the two disagree, fix one of them on
purpose.

Status: **built**, as an SDK plugin (`askai`).

---

## 1. Principles

- **Read-only.** Commenting never executes a query, sets a control or changes a selection. The only
  things it does to the page are outline and draw its card, which change no state.
- **Marked nodes only.** What can be commented on is what the inspect panel's Structure shows: the
  elements the markup marks with `data-anfra-container`, `data-anfra-block`, `data-anfra-query` or
  `data-anfra-control`. Their handles are what an agent searches the definition for.
- **Content UI in the frame, host UI in the host.** The card is about a node of the app, so the
  plugin's frame half draws it beside the node, with the kernel's popover. The command that starts
  comment mode is the host's, drawn in its toolbar and palette (ADR "content UI in the frame, host UI
  in host slots").
- **Rules on the host.** Building the prompt, copying it and refusing Send ("Disabled by admin") are
  the host half's calls. The frame half only draws, since it shares a realm with the definition.
- **One comment, one prompt.** A comment is written, copied (or sent), and gone. Nothing is kept.
- **Says why.** A disabled thing always says why ("Disabled by admin", "Write a comment first").

## 2. Glossary

| Term | Meaning |
| --- | --- |
| **Comment mode** | The frame half's own pick: pointing outlines a marked element, a click opens the card on it. |
| **Node** | One marked element of the structure (`StructureNode`), addressed by its `key` (`0.2.1`). |
| **Handle** | A node's identity for an agent: `[Label](data-anfra-block="id")`, or the attribute alone. |
| **Card** | The comment box: the kernel's popover, beside the commented node. |
| **Prompt** | The Markdown text the card copies or sends: the app, the node, where it sits, and the comment (§4.4). |
| **Target** | Where Send hands the prompt: Claude, ChatGPT or Cursor. All disabled in this demo. |

## 3. Entry points

- **Command** `askai.comment`, "Comment on an element" (`comment` icon, primary): the toolbar shows
  it as **Ask AI**, and the palette lists it. **Alt+Shift+C**, on the page or in the frame (the SDK
  forwards a command's shortcut). It is pressed while comment mode is on or a card is open, and
  pressing it then cancels either.
- **Menu**: "Ask AI" in the menu on a marked block (right-click), which opens the card at once.

Comment mode doesn't need the inspect panel, and doesn't open it. It is not the panel's pick mode:
the panel's pick selects a node for the tabs; comment mode opens a card.

**Reset.** A reload, a path change or a live reload loads a new document: no card, no comment mode.

## 4. Behavior

### 4.1 Flow

1. **Activate** (button, shortcut or palette). A clear sheet covers the page with the comment
   cursor, an arrow with a speech bubble, so clicks reach no app and the mode can't be mistaken for
   the panel's pick. Pointing outlines the marked element underneath with the SDK's overlay.
2. **Pick.** A click on a marked element ends comment mode and opens the card beside it. The node
   stays outlined while the card is open.
3. **Write.** The textarea has focus. The card follows the node as the page scrolls or resizes (the
   popover's own).
4. **Copy** (or Cmd/Ctrl+Enter). The host builds the prompt (§4.4) and copies it. If the host page's
   clipboard refuses (it isn't focused while the reader types in the frame), the frame copies the
   prompt itself. The button says "Copied" and the card closes a moment later; if neither copy
   works, it says "Couldn't copy: logged to the console", and the prompt is logged.
5. **Close.** Closing the card clears the outline.

**Cancelling**
- Escape while in comment mode leaves it; nothing opens.
- The command, while in comment mode, cancels it; while a card is open, closes it.
- Escape in the card, or its ×, discards the card.
- Clicking outside the card does **not** close it, so a half-written comment isn't lost to a stray
  click.

### 4.2 Card

The kernel's popover, on the host's `--anfra-*` tokens, anchored to the node, right of it unless
there's no room. 320px wide, or less in a narrow frame.

```
┌ [block] Revenue by month                 × ┐
│ data-anfra-block="revenue"           (mono) │
│ ┌────────────────────────────────────────┐ │
│ │ What do you want to ask or change?     │ │   textarea, autofocus, grows to ~8 lines
│ └────────────────────────────────────────┘ │
│                   [Copy]  [Send to Claude│▾] │
└─────────────────────────────────────────────┘
```

- **Header**: the kind pill, the node's label (or its id or name when it has none), and the
  popover's ×.
- **Handle line**: the attribute as written, in mono, truncated with the full text in a tooltip.
- **Problems**: when the node has markup problems, "⚠ N markup problems"; the tooltip lists them.
- **Copy**: disabled while the comment is empty or only spaces (tooltip "Write a comment first").
  Disabled buttons use `aria-disabled`, not `disabled`, so they stay focusable and keep their
  tooltips.
- **Send** is a split button, from the targets the host answers (`askai.targets`), each with the
  reason it is off. The main half is disabled, tooltip "Disabled by admin"; ▾ lists Claude, ChatGPT
  and Cursor, each disabled with "Disabled by admin" on its right.

### 4.3 What the card is anchored to

The node's element, as the kernel's popover follows it. The menu's "Ask AI" anchors to the block
right-clicked; comment mode to the element clicked.

### 4.4 Prompt

Markdown, short enough to paste anywhere:

```md
Comment on the Data App "Sales Overview" (apps/sales/overview.html).

Element: block [Revenue by month](data-anfra-block="revenue")
Inside: container [KPIs](data-anfra-container="kpis") › container [Top](data-anfra-container="top")

Markup problems:
- Block "revenue" has no label.

Comment:
The y axis should start at zero.
```

- The title is the app's label; the file is `apps/<path>`, as anfra serves it. Both are the host's,
  never the frame's.
- **Element** is the node's kind and handle.
- **Inside** lists the node's ancestors, outermost first. It is left out for a top-level node.
- **Markup problems** is left out when there are none.
- The comment is trimmed, otherwise as typed.

### 4.5 Keyboard and accessibility

- The toolbar button has `aria-pressed`, an `aria-label` and a tooltip with its shortcut.
- The card is a dialog, labelled by the node; focus moves to the textarea on open.
- Cmd/Ctrl+Enter copies. Escape closes.

## 5. Structure

### 5.1 Folder

```
src/askai/
  SPEC.md          this file
  index.ts         the plugin, with its frame half built: the only file a host imports
  plugin.ts        the host half: calls, the event, the command
  frame.ts         the frame half: the menu item, comment mode, the card
  model.ts         pure: handles, the prompt, the frame's request checked; SDK types only
  frame-half.d.ts  the type of `virtual:askai-frame`
```

`vite.config.ts` builds `frame.ts` with the SDK's `buildFrameHalf` (esbuild) into
`virtual:askai-frame`, which `index.ts` gives the plugin.

### 5.2 Calls and events

| Name | Who calls | Does |
| --- | --- | --- |
| `askai.copy` | frame | Checks `{ node, ancestors, comment }`, builds the prompt with the mount's app, copies it on the host page. Answers `{ prompt, copied }`. |
| `askai.targets` | frame | The send targets, each with why it is off. |
| `askai.send` | frame | Refused: `PermissionError("Disabled by admin")`. |
| `askai.comment` | the command | Calls `askai.pick` in the frame. |
| `askai.pick` | host, into the frame | Starts comment mode, or cancels it, or closes the card. |
| `askai.state` | frame event | `{ active }`: comment mode on or a card open. The command's `pressed` follows it. |

The host gives the plugin `appOf(mount)` (the app's label and file) and `copy(text)`.

## 6. Out of scope

- Commenting on unmarked elements (a title, an axis, a button inside a block).
- Several comments at once, numbered pins, or a comment list.
- Keeping comments across reloads, or sharing them with other readers.
- Actually sending to a target. Send is disabled in this demo (§8).
- Screenshots of the node in the prompt.

## 7. Porting to another host

1. Copy `src/askai/`, and build `frame.ts` with `buildFrameHalf` (as `vite.config.ts` does).
2. Install the plugin: `askAiPlugin({ appOf, copy })`.
3. Draw its command like any other: the SDK gives it with the host's commands, with its shortcut
   and state. Nothing else: the menu item and the card are drawn in the frame.

## 8. Decisions

- **Marked nodes only**, so a comment's handle is always findable in the definition.
- **Floating card**, not a docked panel, so the comment sits beside what it is about.
- **Its own pick**, not the panel's: commenting doesn't open the panel or change its selection, and
  has its own cursor.
- **One comment per prompt.**
- **Send is disabled** ("Disabled by admin") in this demo, and the host half refuses it. The targets
  are listed so the design can be seen. Copy is the working path.

## 9. Open questions

1. **How each target receives a prompt**, once enabled: `claude.ai/new?q=` and `chatgpt.com/?q=`
   open a new chat; Cursor has a `cursor://…/prompt?text=` deeplink; Claude Code has no reliable
   way into a running session (copy and paste, or an MCP channel through this host's server).
   URL length limits apply to all of them.
2. **Remember the last target** for the split button's main half?
