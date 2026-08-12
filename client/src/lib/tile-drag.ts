import { batch, createSignal } from 'solid-js';
import api from './api';
import { blobMoveTiles, blobMoveTilesToPage } from './blob-actions';
import {
	currentPageId,
	editingTilePositions,
	editingTiles,
	findTileByPosition,
	getCurrentPageTiles,
	getPageFromBlob,
	parseTilePositionKey,
	project,
	projectHomePageId,
	setEditingTilePositions,
	tilePositionKey,
} from './state';
import {
	compareTilePositions,
	type DragGridDelta,
	type DropAction,
	dragDeltaBetween,
	dragGroupFits,
	findFirstAvailableSlots,
	resolveDropAction,
	translateDragPosition,
} from './tile-drag-geometry';
import type { Tile, TilePosition, TilePositionKey } from './types';

/**
 * One tile in the lifted ghost. The offsets are measured from the grabbed tile's cell at pickup,
 * so a multi-select keeps its shape on screen instead of collapsing into a single card.
 */
export type DragGhostTile = {
	tile: Tile;
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
};

// Hit-testing contract with the board. Tile and AddTileButton declare `data-drop-cell` with their
// position key; ProjectContent declares `data-board-scroll` on the scroll container. They are
// written literally in that JSX, since an attribute name cannot be interpolated there.
const DROP_CELL_ATTRIBUTE = 'data-drop-cell';
const BOARD_SCROLL_ATTRIBUTE = 'data-board-scroll';

// A mouse drag starts the moment the pointer moves, matching how the SvelteKit board behaved.
// Touch has to hold still first, so a swipe still scrolls the board between subpages.
const LONG_PRESS_MS = 400;
const MOUSE_DRAG_THRESHOLD_PX = 4;
const TOUCH_CANCEL_SLOP_PX = 10;
const EDGE_SCROLL_ZONE_PX = 72;
const EDGE_SCROLL_SPEED_PX = 14;

// --- Reactive drag state ---

// The tiles being dragged. Grabbing a tile inside the multi-select drags the whole selection;
// grabbing one outside it drags only that tile.
const [draggedTiles, setDraggedTiles] = createSignal<Tile[]>([]);
// The tile the pointer grabbed. The rest of the group keeps its offset from this one.
const [dragAnchor, setDragAnchor] = createSignal<Tile | null>(null);
// The cell under the pointer and any directional action it represents.
const [dragOverKey, setDragOverKey] = createSignal<TilePositionKey | null>(null);
const [dropAction, setDropAction] = createSignal<DropAction>(null);
// Every cell the group would land on, so the board can outline the whole footprint rather than
// just the one cell under the pointer.
const [dropPreviewKeys, setDropPreviewKeys] = createSignal<Set<TilePositionKey>>(new Set());
// The lifted tile that follows the pointer. Split from its position so 60fps movement does not
// re-render the face.
const [dragGhost, setDragGhost] = createSignal<{
	// Ordered with the grabbed tile last, so it paints on top of the rest.
	tiles: DragGhostTile[];
	count: number;
	// Where in the grabbed tile the pointer landed. The ghost scales around this point, so
	// shrinking it keeps the spot the user grabbed exactly under the pointer.
	grabOffsetX: number;
	grabOffsetY: number;
} | null>(null);
const [dragGhostPosition, setDragGhostPosition] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

export { draggedTiles, dragOverKey, dropAction, dragGhost, dragGhostPosition, dropPreviewKeys };

export const isDraggingTiles = () => draggedTiles().length > 0;

export function isTileBeingDragged(tile: TilePosition): boolean {
	const key = tilePositionKey(tile);
	return draggedTiles().some((t) => tilePositionKey(t) === key);
}

/** Whether this cell is one the group would land on, and so should be outlined. */
export function isDropPreviewCell(cell: TilePosition): boolean {
	return dropPreviewKeys().has(tilePositionKey(cell));
}

/**
 * The cells the group would occupy if dropped here. Empty for an "Add" drop, whose tiles leave
 * this page entirely—the folder's own overlay communicates that destination instead.
 */
function previewKeys(group: Tile[], anchor: Tile | null, cell: TilePosition, action: DropAction): Set<TilePositionKey> {
	if (!anchor || action === 'add') return new Set();
	const rows = project()?.rows ?? 0;
	const delta = dragDeltaBetween(anchor, cell, rows);
	const columns = project()?.columns ?? 0;
	return new Set(group.map((tile) => tilePositionKey(translateDragPosition(tile, delta, columns, rows))));
}

// --- Pointer session ---

type PointerSession = {
	pointerId: number;
	tile: Tile;
	isTouch: boolean;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	// Where inside the tile the pointer landed, so the lifted tile stays under the same spot.
	grabOffsetX: number;
	grabOffsetY: number;
	width: number;
	height: number;
	longPressTimer: ReturnType<typeof setTimeout> | null;
	activated: boolean;
};

let session: PointerSession | null = null;
// The resolved drop target. Kept outside the signals because the drop reads it once, and the
// occupant is not derivable from the position key alone once tiles start moving.
let dropTargetCell: TilePosition | null = null;
let dropTargetOccupant: Tile | null = null;
// A completed drag ends in a click on the tile that was grabbed; without this it would toggle
// that tile's selection the instant the user lets go.
let swallowNextClick = false;

export function handleTilePointerDown(event: PointerEvent, tile: Tile): void {
	swallowNextClick = false;
	if (!editingTiles() || session || event.button !== 0) return;

	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	const started: PointerSession = {
		pointerId: event.pointerId,
		tile,
		isTouch: event.pointerType !== 'mouse',
		startX: event.clientX,
		startY: event.clientY,
		lastX: event.clientX,
		lastY: event.clientY,
		grabOffsetX: event.clientX - rect.left,
		grabOffsetY: event.clientY - rect.top,
		width: rect.width,
		height: rect.height,
		longPressTimer: null,
		activated: false,
	};
	session = started;

	document.addEventListener('pointermove', onPointerMove, { passive: false });
	document.addEventListener('pointerup', onPointerUp);
	document.addEventListener('pointercancel', onPointerCancel);
	// Pointer events cannot stop the page scrolling under a drag — only a cancelled touchmove can,
	// and only if the listener is non-passive.
	document.addEventListener('touchmove', onTouchMove, { passive: false });

	if (started.isTouch) {
		started.longPressTimer = setTimeout(() => activateDrag(started), LONG_PRESS_MS);
	}
}

/** True once per completed drag, so the trailing click does not also count as a tap. */
export function consumeDragClick(): boolean {
	if (!swallowNextClick) return false;
	swallowNextClick = false;
	return true;
}

function activateDrag(started: PointerSession): void {
	if (session !== started || started.activated) return;
	started.activated = true;
	clearLongPress(started);

	const key = tilePositionKey(started.tile);
	const selection = editingTilePositions();
	// Dragging an unselected tile deliberately leaves the selection alone: re-selecting here would
	// open or resize the edit panel mid-drag and shift the board out from under the pointer.
	const group = selection.includes(key)
		? getCurrentPageTiles().filter((t) => selection.includes(tilePositionKey(t)))
		: [started.tile];

	batch(() => {
		setDragAnchor(started.tile);
		setDraggedTiles(group);
		setDragGhost({
			tiles: buildGhostTiles(group, started),
			count: group.length,
			grabOffsetX: started.grabOffsetX,
			grabOffsetY: started.grabOffsetY,
		});
		setDragGhostPosition({ x: started.lastX - started.grabOffsetX, y: started.lastY - started.grabOffsetY });
	});

	// A short buzz makes a hold that has "taken" obvious without looking at the screen.
	navigator.vibrate?.(10);
	updateDropTarget(started.lastX, started.lastY);
}

/**
 * Measures each dragged tile against the grabbed one, reading the real cells so gaps, tile sizes
 * and subpage offsets all come out right without re-deriving the grid's geometry. The grabbed tile
 * goes last so it paints above the others, and is the card the rest gather onto when stacked.
 */
function buildGhostTiles(group: Tile[], started: PointerSession): DragGhostTile[] {
	const anchorKey = tilePositionKey(started.tile);
	const anchorRect = cellRect(started.tile);

	const measured = group.map((tile) => {
		const rect = cellRect(tile);
		return {
			tile,
			offsetX: rect && anchorRect ? rect.left - anchorRect.left : 0,
			offsetY: rect && anchorRect ? rect.top - anchorRect.top : 0,
			width: rect?.width ?? started.width,
			height: rect?.height ?? started.height,
		};
	});

	const others = measured.filter((item) => tilePositionKey(item.tile) !== anchorKey);
	const anchor = measured.find((item) => tilePositionKey(item.tile) === anchorKey);
	return anchor ? [...others, anchor] : others;
}

function cellRect(position: TilePosition): DOMRect | null {
	const cell = document.querySelector(`[${DROP_CELL_ATTRIBUTE}="${tilePositionKey(position)}"]`);
	return cell?.getBoundingClientRect() ?? null;
}

function onPointerMove(event: PointerEvent): void {
	const active = session;
	if (!active || event.pointerId !== active.pointerId) return;

	active.lastX = event.clientX;
	active.lastY = event.clientY;

	if (!active.activated) {
		const travelled = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
		if (active.isTouch) {
			// Moving before the hold completes means the user is scrolling, not picking a tile up.
			if (travelled > TOUCH_CANCEL_SLOP_PX) endSession();
		} else if (travelled > MOUSE_DRAG_THRESHOLD_PX) {
			activateDrag(active);
		}
		return;
	}

	// Stops the mouse drag from selecting surrounding text as it sweeps.
	event.preventDefault();
	setDragGhostPosition({ x: event.clientX - active.grabOffsetX, y: event.clientY - active.grabOffsetY });
	updateDropTarget(event.clientX, event.clientY);
	updateEdgeScroll(event.clientY);
}

function onPointerUp(event: PointerEvent): void {
	const active = session;
	if (!active || event.pointerId !== active.pointerId) return;

	if (active.activated) {
		swallowNextClick = true;
		commitDrop();
	}
	endSession();
}

function onPointerCancel(event: PointerEvent): void {
	if (!session || event.pointerId !== session.pointerId) return;
	endSession();
}

function onTouchMove(event: TouchEvent): void {
	if (isDraggingTiles()) event.preventDefault();
}

function endSession(): void {
	const active = session;
	session = null;
	if (active) clearLongPress(active);

	document.removeEventListener('pointermove', onPointerMove);
	document.removeEventListener('pointerup', onPointerUp);
	document.removeEventListener('pointercancel', onPointerCancel);
	document.removeEventListener('touchmove', onTouchMove);

	stopEdgeScroll();
	clearDragState();
}

function clearLongPress(active: PointerSession): void {
	if (active.longPressTimer === null) return;
	clearTimeout(active.longPressTimer);
	active.longPressTimer = null;
}

function clearDragState(): void {
	dropTargetCell = null;
	dropTargetOccupant = null;
	batch(() => {
		setDraggedTiles([]);
		setDragAnchor(null);
		setDragOverKey(null);
		setDropAction(null);
		setDropPreviewKeys(new Set<TilePositionKey>());
		setDragGhost(null);
	});
}

// --- Drop targeting ---

/** Resolves the cell under the pointer and works out what dropping there would mean. */
function updateDropTarget(clientX: number, clientY: number): void {
	if (!isDraggingTiles()) return;

	const element = document.elementFromPoint(clientX, clientY)?.closest(`[${DROP_CELL_ATTRIBUTE}]`);
	const key = element instanceof HTMLElement ? element.getAttribute(DROP_CELL_ATTRIBUTE) : null;
	if (!element || !key) {
		clearDropTarget();
		return;
	}

	const cell = parseTilePositionKey(key);
	if (Number.isNaN(cell.x) || Number.isNaN(cell.y) || Number.isNaN(cell.page)) {
		clearDropTarget();
		return;
	}

	const occupant = findTileByPosition(getCurrentPageTiles(), cell) ?? null;
	const group = draggedTiles();
	// A tile in the moving selection is not its own target. Every other folder is one unambiguous
	// Add target across its full surface; Swap is the reverse folder-to-regular-tile gesture.
	const occupantIsDragged = occupant ? isTileBeingDragged(occupant) : false;
	const action = resolveDropAction(group, occupant, occupantIsDragged);

	// "Add" sends the group to another page entirely, so the board grid does not constrain it.
	// Everything else slides the group across this board and has to stay on it.
	if (action !== 'add' && !groupFits(group, dragAnchor(), cell)) {
		clearDropTarget();
		return;
	}

	dropTargetCell = cell;
	dropTargetOccupant = occupant;
	batch(() => {
		setDragOverKey(tilePositionKey(cell));
		setDropAction(action);
		setDropPreviewKeys(previewKeys(group, dragAnchor(), cell, action));
	});
}

function clearDropTarget(): void {
	dropTargetCell = null;
	dropTargetOccupant = null;
	batch(() => {
		setDragOverKey(null);
		setDropAction(null);
		setDropPreviewKeys(new Set<TilePositionKey>());
	});
}

function commitDrop(): void {
	const group = draggedTiles();
	const anchor = dragAnchor();
	const cell = dropTargetCell;
	const occupant = dropTargetOccupant;
	const folderPageId =
		dropAction() === 'add' && occupant?.navigation && !isTileBeingDragged(occupant) ? occupant.navigation : null;

	clearDragState();
	if (!anchor || !cell) return;

	if (folderPageId) {
		moveTilesIntoFolder(group, folderPageId);
	} else {
		moveTilesToCell(group, anchor, cell);
	}
}

// --- Edge scrolling ---

let edgeScrollFrame: number | null = null;
let edgeScrollVelocity = 0;

function boardScroller(): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[${BOARD_SCROLL_ATTRIBUTE}]`);
}

/**
 * A touch drag owns the gesture, so the board can no longer be swiped while a tile is held.
 * Holding near the top or bottom edge scrolls it instead, which is how a tile reaches a subpage
 * that is off screen.
 */
function updateEdgeScroll(clientY: number): void {
	const scroller = boardScroller();
	if (!scroller) return;

	const rect = scroller.getBoundingClientRect();
	if (clientY < rect.top + EDGE_SCROLL_ZONE_PX) {
		edgeScrollVelocity = -EDGE_SCROLL_SPEED_PX;
	} else if (clientY > rect.bottom - EDGE_SCROLL_ZONE_PX) {
		edgeScrollVelocity = EDGE_SCROLL_SPEED_PX;
	} else {
		edgeScrollVelocity = 0;
	}

	if (edgeScrollVelocity !== 0 && edgeScrollFrame === null) {
		edgeScrollFrame = requestAnimationFrame(stepEdgeScroll);
	}
}

function stepEdgeScroll(): void {
	edgeScrollFrame = null;
	const scroller = boardScroller();
	if (!scroller || !session?.activated || edgeScrollVelocity === 0) return;

	scroller.scrollTop += edgeScrollVelocity;
	// The board moved under a stationary pointer, so the cell beneath it has changed.
	updateDropTarget(session.lastX, session.lastY);
	edgeScrollFrame = requestAnimationFrame(stepEdgeScroll);
}

function stopEdgeScroll(): void {
	if (edgeScrollFrame !== null) cancelAnimationFrame(edgeScrollFrame);
	edgeScrollFrame = null;
	edgeScrollVelocity = 0;
}

// --- Move logic ---

/**
 * Slides the whole group by the vector from the grabbed tile to the drop cell. Any tiles it lands
 * on are pushed back along that same vector into the cells the group vacated — for a single tile
 * that is exactly a swap.
 */
function moveTilesToCell(group: Tile[], anchor: Tile, cell: TilePosition): void {
	const pageId = currentPageId();
	if (!pageId || !groupFits(group, anchor, cell)) return;

	const columns = project()?.columns ?? 0;
	const rows = project()?.rows ?? 0;
	const delta = dragDeltaBetween(anchor, cell, rows);
	if (delta.dx === 0 && delta.dRow === 0) return;

	const groupKeys = new Set(group.map(tilePositionKey));
	const moves = group.map((tile) => ({
		from: toPosition(tile),
		to: translateDragPosition(tile, delta, columns, rows),
	}));

	const landingKeys = new Set(moves.map((m) => tilePositionKey(m.to)));

	// Cells the group leaves behind. A group that overlaps its own footprint keeps the cells it is
	// landing on again, so those are not free.
	const vacated = group
		.map(toPosition)
		.filter((p) => !landingKeys.has(tilePositionKey(p)))
		.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
	const freeCells = new Map(vacated.map((p) => [tilePositionKey(p), p]));

	const displaced = getCurrentPageTiles().filter(
		(t) => !groupKeys.has(tilePositionKey(t)) && landingKeys.has(tilePositionKey(t)),
	);

	const inverse: DragGridDelta = { dx: -delta.dx, dRow: -delta.dRow };
	const leftovers: Tile[] = [];
	for (const tile of displaced) {
		// Mirror the group's own move. Wrapping is a rotation of each row, so reversing the delta
		// inverts it exactly — this cell is always one the group is leaving, though not necessarily
		// one it frees up when the group overlaps itself.
		const mirrored = translateDragPosition(tile, inverse, columns, rows);
		if (freeCells.delete(tilePositionKey(mirrored))) {
			moves.push({ from: toPosition(tile), to: mirrored });
		} else {
			leftovers.push(tile);
		}
	}

	// Whatever could not mirror cleanly fills the remaining vacated cells in reading order. There
	// are always enough: the group frees exactly as many cells as it can land on.
	for (const tile of leftovers) {
		const next = freeCells.keys().next();
		if (next.done) break;
		const target = freeCells.get(next.value);
		freeCells.delete(next.value);
		if (target) moves.push({ from: toPosition(tile), to: target });
	}

	batch(() => {
		blobMoveTiles(pageId, moves);
		remapSelection(moves);
	});
	refreshThumbnailIfHome();
}

/** Moves the group onto the page a folder tile links to, filling that page's next free slots. */
function moveTilesIntoFolder(group: Tile[], folderPageId: string): void {
	const pageId = currentPageId();
	const destination = getPageFromBlob(folderPageId);
	if (!pageId || !destination || group.length === 0) return;

	const columns = project()?.columns ?? 1;
	const rows = project()?.rows ?? 1;
	const movingKeys = new Set(group.map(tilePositionKey));

	// A folder can link back to the page it sits on, in which case the cells the tiles are leaving
	// count as free.
	const occupied = new Set(
		destination.tiles.map((t) => tilePositionKey(t)).filter((key) => folderPageId !== pageId || !movingKeys.has(key)),
	);

	// Source order and destination order are both row-major. The dragged footprint is intentionally
	// discarded: a 2x2 selection lands top-left, top-right, bottom-left, bottom-right in the first
	// four free destination cells, even when those openings are scattered.
	const orderedGroup = [...group].sort(compareTilePositions);
	const slots = findFirstAvailableSlots(
		(position) => occupied.has(tilePositionKey(position)),
		group.length,
		columns,
		rows,
	);
	const moves = orderedGroup.map((tile, index) => ({ from: toPosition(tile), to: slots[index] }));

	batch(() => {
		blobMoveTilesToPage(pageId, folderPageId, moves);
		if (folderPageId === pageId) {
			remapSelection(moves);
		} else {
			// The tiles left this page, so there is nothing on screen left to keep selected.
			setEditingTilePositions(editingTilePositions().filter((key) => !movingKeys.has(key)));
		}
	});
	refreshThumbnailIfHome();
}

// --- Helpers ---

function toPosition(tile: TilePosition): TilePosition {
	return { x: tile.x, y: tile.y, page: tile.page };
}

/**
 * Whether translating the group onto `cell` keeps every tile on the board. Subpages form one
 * continuous vertical grid, so crossing a seam is valid; only moving above subpage zero is not.
 */
function groupFits(group: Tile[], anchor: Tile | null, cell: TilePosition): boolean {
	const columns = project()?.columns ?? 0;
	const rows = project()?.rows ?? 0;
	return dragGroupFits(group, anchor, cell, columns, rows);
}

/**
 * Tiles are identified by position, so every move rewrites the keys the editor holds. Skipping
 * this would leave the edit panel pointing at a cell that now holds a different tile.
 */
function remapSelection(moves: { from: TilePosition; to: TilePosition }[]): void {
	const remapped = new Map(moves.map((m) => [tilePositionKey(m.from), tilePositionKey(m.to)]));
	setEditingTilePositions(editingTilePositions().map((key) => remapped.get(key) ?? key));
}

function refreshThumbnailIfHome(): void {
	if (currentPageId() !== projectHomePageId()) return;
	void api.project.updateThumbnail(project()?.id ?? '');
}
