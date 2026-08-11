export type NavigationStepBack = {
	path: string[];
	target: string | null;
};

/** Add the page being exited to the route used to reach the next page. */
export function extendNavigationPath(path: string[], from: string, to: string, maxLength = 50): string[] {
	if (!from || from === to) return path;
	return [...path, from].slice(-maxLength);
}

/** Home is a new root, so there is no earlier folder step to expose. */
export function resetNavigationPath(): string[] {
	return [];
}

/** Pop the route, ignoring its current page and pages that no longer exist. */
export function stepBackInNavigationPath(
	path: string[],
	currentPageId: string,
	pageExists: (pageId: string) => boolean,
): NavigationStepBack {
	const remaining = [...path];
	while (remaining.length > 0) {
		const target = remaining.pop();
		if (target && target !== currentPageId && pageExists(target)) {
			return { path: remaining, target };
		}
	}

	return { path: remaining, target: null };
}
