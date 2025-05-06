import * as esbuild from 'esbuild'

const bannerJs = `
const require = (await import('module')).createRequire(import.meta.url); \
import {LocalStorage} from 'node-localstorage'; global.localStorage = new LocalStorage('./localstorage'); \
import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; \
const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename); \
`

await esbuild
	.build({
		entryPoints: ['src/index.ts'],
		bundle: true,
		target: 'node23',
		platform: 'node',
		format: 'esm',
		outdir: 'dist',
		banner: {
			js: bannerJs
		},
		sourcemap: true,
		external: [
			'webtorrent'
		],
		minify: false // Keep minification disabled for now
	})
	.then(console.log('index.js built successfully.'))
	.catch((e) => console.log('build index failed: ', e))

