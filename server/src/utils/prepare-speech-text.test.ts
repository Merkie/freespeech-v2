import { describe, expect, test } from 'bun:test';
import { prepareSpeechText } from './prepare-speech-text';

describe('prepareSpeechText', () => {
	test('adds a natural ending to a bare word', () => {
		expect(prepareSpeechText('Yes')).toBe('Yes.');
	});

	test('trims whitespace before adding punctuation', () => {
		expect(prepareSpeechText('  I want more  ')).toBe('I want more.');
	});

	test.each(['Stop.', 'Stop!', 'Stop?', 'Stop…'])('preserves terminal punctuation in %s', (text) => {
		expect(prepareSpeechText(text)).toBe(text);
	});
});
