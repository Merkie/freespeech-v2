import { type Component } from 'solid-js';
import api from '@/lib/api';
import {
  currentPage,
  setCurrentPage,
  project,
  projectHomePageId,
  currentPageId,
  setEditingTilePositions,
  setPendingTileEdits,
  tilePositionKey,
} from '@/lib/state';
import type { Tile } from '@/lib/types';

interface AddTileButtonProps {
  x: number;
  y: number;
  page: number;
}

const AddTileButton: Component<AddTileButtonProps> = (props) => {
  const pageId = () => currentPage()?.tilePage?.id || '';
  const isHomePage = () => currentPageId() === projectHomePageId();

  const handleAddTile = async () => {
    const { tile } = await api.tile.create(pageId(), {
      x: props.x,
      y: props.y,
      page: props.page,
    });

    // Update thumbnail if this is the home page
    if (isHomePage()) {
      void api.project.updateThumbnail(project()?.id || '');
    }

    // Add the new tile to the current page state
    const page = currentPage();
    if (page?.tilePage) {
      const currentTiles = (page.tilePage.tiles || []) as Tile[];
      const updatedTiles = [...currentTiles, tile];
      setCurrentPage({
        ...page,
        tilePage: {
          ...page.tilePage,
          tiles: updatedTiles,
        },
      });
    }

    // Select the new tile for editing using position key
    setEditingTilePositions([tilePositionKey(tile)]);
    setPendingTileEdits({
      text: tile.text,
      displayText: tile.displayText,
      image: tile.image,
      backgroundColor: tile.backgroundColor,
      borderColor: tile.borderColor,
      navigation: tile.navigation,
    });
  };

  return (
    <button
      style={{
        'grid-column-start': props.x + 1,
        'grid-row-start': props.y + 1,
      }}
      class="grid h-full w-full cursor-pointer place-items-center rounded-md border border-dashed border-zinc-500 bg-zinc-100 text-3xl font-light text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
      onClick={handleAddTile}
    >
      <p>+</p>
    </button>
  );
};

export default AddTileButton;
