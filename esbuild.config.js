import * as esbuild from 'esbuild'

await esbuild
    .build({
        entryPoints: ['src/index.ts'],
        bundle: true, //TODO change to true
        target: 'node22',
        platform: 'node',
        format: 'esm',
        outdir: 'dist',
        sourcemap: false,
        external: ['webtorrent', 'fluent-ffmpeg', 'simple-peer', '@red-token/welshman'],
        minify: false
    })
    .then(console.log('index.js built successfully.'))
    .catch((e) => console.log('build index failed: ', e))
await esbuild
    .build({
        entryPoints: ['src/preload.ts'],
        bundle: true,
        target: 'node22',
        platform: 'node',
        format: 'cjs',
        outfile: 'dist/preload.cjs',
        sourcemap: false,
        minify: true
    })
    .then(console.log('preload.cjs built successfully.'))
    .catch((e) => console.log('build preload failed: ', e))
