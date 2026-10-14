import { type PointerEvent, useRef } from 'react';
import { SidebarRail, useSidebar } from '@/components/ui/sidebar';

const KEY = 'sidebar-width';
const MIN = 192;
const MAX = 480;

const clamp = (width: number) => Math.min(MAX, Math.max(MIN, Math.round(width)));

/** The width the reader last dragged the sidebar to, for `--sidebar-width`; else the default. */
export const storedSidebarWidth = (): string | undefined => {
  try {
    const value = Number(localStorage.getItem(KEY));
    return value ? `${clamp(value)}px` : undefined;
  } catch {
    return undefined;
  }
};

/** Whether the sidebar was left open, from the cookie the sidebar writes when it toggles; else open. */
export const storedSidebarOpen = (): boolean => !/(?:^|; )sidebar_state=false(?:;|$)/.test(document.cookie);

/**
 * The sidebar's edge: drag it to resize, click it to collapse. The width is set on the sidebar
 * wrapper as it moves, without a render, and remembered in this browser once the drag ends.
 */
export function SidebarResizer() {
  const { state, toggleSidebar } = useSidebar();
  const dragged = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragged.current = false;
    const wrapper = event.currentTarget.closest<HTMLElement>('[data-slot="sidebar-wrapper"]');
    const sidebar = wrapper?.querySelector<HTMLElement>('[data-slot="sidebar-container"]');
    if (event.button !== 0 || state !== 'expanded' || !wrapper || !sidebar) return;
    event.preventDefault();
    const rail = event.currentTarget;
    // Captured, so the drag keeps going over the Data App's iframe.
    rail.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;
    let width = startWidth;

    const onMove = (move: globalThis.PointerEvent) => {
      if (!dragged.current && Math.abs(move.clientX - startX) < 3) return;
      dragged.current = true;
      // No easing while dragging: the sidebar follows the pointer.
      wrapper.dataset.resizing = '';
      width = clamp(startWidth + move.clientX - startX);
      wrapper.style.setProperty('--sidebar-width', `${width}px`);
    };
    const onUp = () => {
      rail.removeEventListener('pointermove', onMove);
      rail.removeEventListener('pointerup', onUp);
      rail.removeEventListener('pointercancel', onUp);
      delete wrapper.dataset.resizing;
      if (!dragged.current) return;
      try {
        localStorage.setItem(KEY, String(width));
      } catch {
        // Not remembered; it still applies for this page.
      }
    };
    rail.addEventListener('pointermove', onMove);
    rail.addEventListener('pointerup', onUp);
    rail.addEventListener('pointercancel', onUp);
  };

  // A click that ends a drag doesn't also collapse the sidebar.
  const onClick = () => !dragged.current && toggleSidebar();

  const title = state === 'expanded' ? 'Drag to resize, click to collapse' : 'Expand';
  return <SidebarRail onPointerDown={onPointerDown} onClick={onClick} title={title} />;
}
