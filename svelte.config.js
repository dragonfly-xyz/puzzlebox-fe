import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';
import seqPreprocessor from 'svelte-sequential-preprocessor';

const dev = process.argv.includes('dev');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: seqPreprocessor([vitePreprocess()]),

	kit: {
		adapter: adapter({
			fallback: 'index.html',
		}),
		paths: {
			// base: dev ? '' : '/puzzlebox-fe'
		},
	}
};

export default config;
