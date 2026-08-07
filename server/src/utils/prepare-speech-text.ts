export function prepareSpeechText(text: string) {
	const trimmedText = text.trim();
	return /[.!?…]$/u.test(trimmedText) ? trimmedText : `${trimmedText}.`;
}
