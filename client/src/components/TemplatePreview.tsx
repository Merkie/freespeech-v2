import { For } from 'solid-js';
import type { Template, Tile } from '@/lib/types';

type Props = {
  template: Template;
  size?: 'small' | 'medium';
};

export default function TemplatePreview(props: Props) {
  const cellSize = () => (props.size === 'medium' ? 16 : 10);
  const gap = () => (props.size === 'medium' ? 2 : 1);

  // Get dimensions from the template's associated project
  const columns = () => props.template.project?.columns ?? 4;
  const rows = () => props.template.project?.rows ?? 4;

  const width = () =>
    columns() * cellSize() +
    (columns() - 1) * gap();
  const height = () =>
    rows() * cellSize() + (rows() - 1) * gap();

  // Create a grid of cells, filled where tiles exist
  const tiles = () => props.template.tiles || [];

  const getTileAt = (x: number, y: number): Tile | undefined => {
    return tiles().find((tile) => tile.x === x && tile.y === y);
  };

  return (
    <div
      class="inline-grid rounded border border-zinc-300 bg-zinc-100 p-1"
      style={{
        width: `${width() + 8}px`,
        height: `${height() + 8}px`,
        'grid-template-columns': `repeat(${columns()}, ${cellSize()}px)`,
        'grid-template-rows': `repeat(${rows()}, ${cellSize()}px)`,
        gap: `${gap()}px`,
      }}
    >
      <For each={Array.from({ length: rows() })}>
        {(_, y) => (
          <For each={Array.from({ length: columns() })}>
            {(_, x) => {
              const tile = getTileAt(x(), y());
              return (
                <div
                  class="rounded-sm"
                  style={{
                    'background-color': tile
                      ? tile.backgroundColor
                      : 'transparent',
                    border: tile ? `1px solid ${tile.borderColor}` : 'none',
                  }}
                />
              );
            }}
          </For>
        )}
      </For>
    </div>
  );
}
