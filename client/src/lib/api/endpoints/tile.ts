import { fetchFromAPI } from '../util';
import type { Tile, TilePosition } from '@/lib/types';

// Batch operation types
type BatchCreateOperation = {
  type: 'create';
  position: TilePosition;
  data?: Partial<Omit<Tile, 'x' | 'y' | 'page'>>;
};

type BatchUpdateOperation = {
  type: 'update';
  position: TilePosition;
  data: Partial<Omit<Tile, 'x' | 'y' | 'page'>>;
};

type BatchDeleteOperation = {
  type: 'delete';
  position: TilePosition;
};

type BatchOperation = BatchCreateOperation | BatchUpdateOperation | BatchDeleteOperation;

const tile = {
  // Create a tile at a specific position
  create: async (pageId: string, body: TilePosition & Partial<Omit<Tile, 'x' | 'y' | 'page'>>) => {
    const response = (await fetchFromAPI({
      path: `/page/${pageId}/tile/create`,
      method: 'POST',
      body,
    })) as {
      tile: Tile;
    };
    return response;
  },

  // Update a tile by position
  update: async (pageId: string, position: TilePosition, updates: Partial<Omit<Tile, 'x' | 'y' | 'page'>>) => {
    const response = (await fetchFromAPI({
      path: `/page/${pageId}/tile/update`,
      method: 'POST',
      body: { ...position, ...updates },
    })) as {
      success: boolean;
      tile: Tile;
    };
    return response;
  },

  // Delete a tile by position
  delete: async (pageId: string, position: TilePosition) => {
    const response = (await fetchFromAPI({
      path: `/page/${pageId}/tile/delete`,
      method: 'POST',
      body: position,
    })) as {
      success: boolean;
    };
    return response;
  },

  // Batch operations for bulk updates
  batch: async (pageId: string, operations: BatchOperation[]) => {
    const response = (await fetchFromAPI({
      path: `/page/${pageId}/tile/batch`,
      method: 'POST',
      body: { operations },
    })) as {
      success: boolean;
      processed: number;
      succeeded: number;
      failed: number;
      results: { success: boolean; operation: BatchOperation; error?: string }[];
      tiles: Tile[];
    };
    return response;
  },
};

export default tile;
