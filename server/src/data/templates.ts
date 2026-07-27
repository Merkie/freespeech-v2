export type TemplateSource = {
	slug: string;
	name: string;
	description: string;
	creatorName: string;
	sourceObjectKey: string;
	sourceThumbnailUrl: string;
};

export const MEDIA_HOST = 'https://media.freespeechaac.com';

export const TEMPLATES: TemplateSource[] = [
	{
		slug: 'communikate-20',
		name: 'CommuniKate 20',
		description:
			'CommuniKate 20 is a functional communication board with 20 buttons per board created by Kate McCallum for the adult population of communicators that she serves.',
		creatorName: 'Kate McCallum',
		sourceObjectKey: 'template-projects/communikate-20.obz',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/communikate-20.png',
	},
	{
		slug: 'communikate-12',
		name: 'CommuniKate 12',
		description:
			'CommuniKate 12 is a smaller version of CommuniKate 20, it has only 12 buttons per board but offers the same style of layout and functional style of communication.',
		creatorName: 'Kate McCallum',
		sourceObjectKey: 'template-projects/ck12.obz',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/communikate-12.png',
	},
	{
		slug: 'project-core',
		name: 'Project Core',
		description:
			'Project Core is a research-based initiative to ensure all communicators have at least one option for beginning core-based communication.',
		creatorName: 'UNC Chapel Hill',
		sourceObjectKey: 'template-projects/project-core.obf',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/project-core.png',
	},
	{
		slug: 'quick-core-24',
		name: 'Quick Core 24',
		description:
			'Quick Core 24 is a core, motor-planning based vocabulary set with up to 24 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/quick-core-24.obz',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/quick-core-24.png',
	},
	{
		slug: 'quick-core-40',
		name: 'Quick Core 40',
		description:
			'Quick Core 40 is a core, motor-planning based vocabulary set with up to 40 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/quick-core-40.obz',
		sourceThumbnailUrl: 'https://s3.amazonaws.com/opensymbols/libraries/extras/quick-core-40.svg',
	},
	{
		slug: 'quick-core-60',
		name: 'Quick Core 60',
		description:
			'Quick Core 60 is a core, motor-planning based vocabulary set with up to 60 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/quick-core-60.obz',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/quick-core-60.png',
	},
	{
		slug: 'quick-core-84',
		name: 'Quick Core 84',
		description:
			'Quick Core 84 is a core, motor-planning based vocabulary set with up to 84 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/quick-core-84.obz',
		sourceThumbnailUrl: 'https://s3.amazonaws.com/opensymbols/libraries/extras/quick-core-84.svg',
	},
	{
		slug: 'quick-core-112',
		name: 'Quick Core 112',
		description:
			'Quick Core 112 is a core, motor-planning based vocabulary set with up to 112 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/quick-core-112.obz',
		sourceThumbnailUrl: 'https://www.openboardformat.org/previews/quick-core-112.png',
	},
	{
		slug: 'vocal-flair-24',
		name: 'Vocal Flair 24',
		description:
			'Vocal Flair 24 is a core, flat-but-dynamic-styled vocabulary set with up to 24 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-24.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-24.svg',
	},
	{
		slug: 'vocal-flair-40',
		name: 'Vocal Flair 40',
		description:
			'Vocal Flair 40 is a core, flat-but-dynamic-styled vocabulary set with up to 40 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-40.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-40.svg',
	},
	{
		slug: 'vocal-flair-60',
		name: 'Vocal Flair 60',
		description:
			'Vocal Flair 60 is a core, flat-but-dynamic-styled vocabulary set with up to 60 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-60.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-60.svg',
	},
	{
		slug: 'vocal-flair-84',
		name: 'Vocal Flair 84',
		description:
			'Vocal Flair 84 is a core, flat-but-dynamic-styled vocabulary set with up to 84 buttons per board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-84.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-84.svg',
	},
	{
		slug: 'vocal-flair-84-with-keyboard',
		name: 'Vocal Flair 84 – With Keyboard',
		description:
			'Vocal Flair 84 is a core, flat-but-dynamic-styled vocabulary set with up to 84 buttons per board, including a keyboard on the main board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-84-with-keyboard.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-84.svg',
	},
	{
		slug: 'vocal-flair-112',
		name: 'Vocal Flair 112',
		description:
			'Vocal Flair 112 is a core, flat-but-dynamic-styled vocabulary set with up to 112 buttons per board, including a keyboard on the main board. It has built-in progression to gradually expand the vocabulary over time.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/vocal-flair-112.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/vocal-flair-112.svg',
	},
	{
		slug: 'sequoia-15',
		name: 'Sequoia 15',
		description:
			'Sequoia 15 is a branching vocabulary set, built in an effort to support communication organized by pragmatic function but with the goal of encouraging expansion into generalized and core-oriented vocabulary.',
		creatorName: 'OpenAAC',
		sourceObjectKey: 'template-projects/sequoia-15.obz',
		sourceThumbnailUrl: 'https://opensymbols.s3.amazonaws.com/libraries/extras/sequoia-15.svg',
	},
];

export function templateBlobKey(slug: string): string {
	return `template-blobs/${slug}.json`;
}

export function templateThumbnailKey(slug: string, ext: 'webp' | 'svg'): string {
	return `template-thumbnails/${slug}.${ext}`;
}

export function templateAssetKey(hash: string, ext: 'webp' | 'svg' | 'gif'): string {
	return `template-assets/${hash}.${ext}`;
}

export function templateAssetUrl(hash: string, ext: 'webp' | 'svg' | 'gif'): string {
	return `${MEDIA_HOST}/${templateAssetKey(hash, ext)}`;
}

export function templateThumbnailUrl(slug: string, ext: 'webp' | 'svg'): string {
	return `${MEDIA_HOST}/${templateThumbnailKey(slug, ext)}`;
}

export function templateBlobUrl(slug: string): string {
	return `${MEDIA_HOST}/${templateBlobKey(slug)}`;
}
