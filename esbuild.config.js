import * as esbuild from 'esbuild'

// Restore the original banner that defines require, but rename require
// const bannerJs = `
// import { createRequire as __createRequire } from 'module'; const __commonJSRequire = __createRequire(import.meta.url); \

// import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; \
// const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename); \
// Simpler banner, assuming esbuild handles createRequire if needed
const bannerJs = `
const require = (await import('module')).createRequire(import.meta.url); \
import {LocalStorage} from 'node-localstorage'; global.localStorage = new LocalStorage('./localstorage');

`

await esbuild
	.build({
		entryPoints: ['src/index.ts'],
		bundle: true,
		target: 'node23',
		platform: 'node',
		format: 'esm',
		outdir: 'dist',
		// Restore the original banner
		banner: {
			js: bannerJs
		},
		sourcemap: false,
		// Remove webtorrent from external, keep others if necessary (e.g., fluent-ffmpeg?)
		external: [
			'webtorrent',

		],
		minify: true // Keep minification disabled for now
	})
	.then(console.log('index.js built successfully.'))
	.catch((e) => console.log('build index failed: ', e))


// const bannerJs = `
// import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
// import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path';
// const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);
// `;
