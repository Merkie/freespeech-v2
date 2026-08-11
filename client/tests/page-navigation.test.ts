import { describe, expect, test } from 'bun:test';
import { extendNavigationPath, resetNavigationPath, stepBackInNavigationPath } from '../src/lib/navigation-path';

const pages = new Set(['home', 'movies', 'school', 'sesame-street', 'elmo']);
const pageExists = (pageId: string) => pages.has(pageId);

describe('project navigation path', () => {
	test('backs out through the route used to enter nested pages', () => {
		let current = 'home';
		let path: string[] = [];
		const go = (target: string) => {
			path = extendNavigationPath(path, current, target);
			current = target;
		};
		const back = () => {
			const step = stepBackInNavigationPath(path, current, pageExists);
			path = step.path;
			if (step.target) current = step.target;
			return step.target;
		};

		go('movies');
		go('sesame-street');
		go('elmo');

		expect(path).toEqual(['home', 'movies', 'sesame-street']);
		expect(back()).toBe('sesame-street');
		expect(back()).toBe('movies');
		expect(back()).toBe('home');
		expect(back()).toBeNull();
	});

	test('Home clears the path instead of adding the page being exited', () => {
		let path = extendNavigationPath([], 'home', 'movies');
		path = extendNavigationPath(path, 'movies', 'sesame-street');

		path = resetNavigationPath();

		expect(path).toEqual([]);
		expect(stepBackInNavigationPath(path, 'home', pageExists).target).toBeNull();
	});

	test('remembers which route reached a page linked from more than one folder', () => {
		const fromMovies = extendNavigationPath(extendNavigationPath([], 'home', 'movies'), 'movies', 'elmo');
		const fromSchool = extendNavigationPath(extendNavigationPath([], 'home', 'school'), 'school', 'elmo');

		expect(stepBackInNavigationPath(fromMovies, 'elmo', pageExists).target).toBe('movies');
		expect(stepBackInNavigationPath(fromSchool, 'elmo', pageExists).target).toBe('school');
	});

	test('skips duplicate and deleted entries while backing out', () => {
		const step = stepBackInNavigationPath(['home', 'deleted', 'elmo'], 'elmo', pageExists);

		expect(step).toEqual({ path: [], target: 'home' });
	});
});
