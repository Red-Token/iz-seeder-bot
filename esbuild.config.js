import * as esbuild from 'esbuild'

// await esbuild
// 	.build({
// 		entryPoints: ['src/preload.ts'],
// 		bundle: true,
// 		target: 'node23',
// 		platform: 'node',
// 		format: 'cjs',
// 		outfile: 'dist/preload.cjs',
// 		sourcemap: false,
// 		minify: true
// 	})
// 	.then(console.log('preload.cjs built successfully.'))
// 	.catch((e) => console.log('build preload failed: ', e))

await esbuild
	.build({
		entryPoints: ['src/index.ts'],
		bundle: true,
		target: 'node23',
		platform: 'node',
		format: 'esm',
		outdir: 'dist',
		banner: {
			js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url); \
				import {LocalStorage} from 'node-localstorage'; global.localStorage = new LocalStorage('./localstorage')"
		},
		sourcemap: false,
		external: ['webtorrent', 'fluent-ffmpeg'],
		minify: true
	})
	.then(console.log('index.js built successfully.'))
	.catch((e) => console.log('build index failed: ', e))
