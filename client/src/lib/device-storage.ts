/** Preferences must never prevent communication when browser storage is unavailable. */
export const deviceStorage = {
	getItem(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* Keep the in-memory preference. */
		}
	},
	removeItem(key: string): void {
		try {
			localStorage.removeItem(key);
		} catch {
			/* Keep using the board. */
		}
	},
};
