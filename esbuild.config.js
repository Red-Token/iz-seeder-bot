import * as esbuild from 'esbuild'

await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    target: 'node22',
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    sourcemap: false,
    external: ['webtorrent', 'fluent-ffmpeg', 'simple-peer', 'iz-nostrlib'],
    minify: true
})
