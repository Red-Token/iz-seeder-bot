import {expect} from 'chai'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync, spawnSync} from 'node:child_process'
import {VideoConverter} from '../src/util/VideoConverter.js'
import {Dasher} from '../src/util/Dasher.js'

function resolveInputFile(): string | null {
    const candidates = [
        process.env.TRANSCODE_TEST_INPUT,
        '/home/rene/git/iz-stream-system-test/.assets/media/sintel/v1/Sintel.smoke.5s.mp4',
        '/home/rene/git/iz-stream-system-test/.assets/media/sintel/v1/Sintel.2010.1080p.mkv',
        '/home/rene/git/iz-seeder-bot/test/data/sintel/orig/Sintel.2010.1080p.mkv'
    ].filter(Boolean) as string[]

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function hasCommand(command: string): boolean {
    const result = spawnSync('sh', ['-lc', `command -v ${command}`], {stdio: 'ignore'})
    return result.status === 0
}

function makePersistentOutputRoot(): string {
    const baseDir = path.resolve(process.cwd(), '.artifacts', 'transcode')
    fs.mkdirSync(baseDir, {recursive: true})
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const out = path.join(baseDir, stamp)
    fs.mkdirSync(out, {recursive: true})
    return out
}

function ffprobeJson(filePath: string, extraArgs: string[] = []): Record<string, unknown> {
    const output = execFileSync('ffprobe', [
        '-v', 'error',
        ...extraArgs,
        '-show_entries', 'stream=codec_name,profile,pix_fmt,channels,channel_layout,sample_rate',
        '-of', 'json',
        filePath
    ], {encoding: 'utf8'})

    return JSON.parse(output) as Record<string, unknown>
}

describe('Transcode asset pipeline only', () => {
    it('should transcode + dash a local file without running full bot', async function () {
        this.timeout(180_000)

        const inputFile = resolveInputFile()
        if (!inputFile) {
            this.skip()
        }
        if (!hasCommand('MP4Box')) {
            this.skip()
        }
        if (!hasCommand('ffprobe')) {
            this.skip()
        }
        const keepOutput = process.env.KEEP_TRANSCODE_OUTPUT === '1'

        const tmpRoot = keepOutput
            ? makePersistentOutputRoot()
            : fs.mkdtempSync(path.join(os.tmpdir(), 'iz-seeder-bot-transcode-'))
        const transcodingDir = path.join(tmpRoot, 'transcoding')
        const dashingDir = path.join(tmpRoot, 'dashing')
        fs.mkdirSync(transcodingDir, {recursive: true})
        fs.mkdirSync(dashingDir, {recursive: true})

        const transcodedFile = path.join(transcodingDir, 'video_tiny.mp4')
        const mpdFile = path.join(dashingDir, 'manifest.mpd')

        try {
            const converter = new VideoConverter()
            await converter.convert(inputFile, transcodedFile, {width: 426, height: 240})
            expect(fs.existsSync(transcodedFile)).to.equal(true)

            const dasher = new Dasher()
            await dasher.dash([transcodedFile], mpdFile)
            expect(fs.existsSync(mpdFile)).to.equal(true)

            const generated = fs.readdirSync(dashingDir)
            expect(generated.some((name) => name.endsWith('.mp4'))).to.equal(true)
            expect(generated.some((name) => name.endsWith('.m4s'))).to.equal(true)

            const mpdText = fs.readFileSync(mpdFile, 'utf8')
            expect(mpdText).to.contain('<MPD')
            expect(mpdText).to.contain('Representation id="audio"')
            expect(mpdText).to.contain('Representation id="v0"')
            expect(mpdText).to.contain('SegmentTemplate')

            // Validate browser-compatibility critical points in encoded input.
            const audioProbe = ffprobeJson(transcodedFile, ['-select_streams', 'a:0']) as {streams?: Array<{channels?: number}>}
            const videoProbe = ffprobeJson(transcodedFile, ['-select_streams', 'v:0']) as {streams?: Array<{pix_fmt?: string}>}
            const audioChannels = audioProbe.streams?.[0]?.channels
            const pixelFormat = videoProbe.streams?.[0]?.pix_fmt

            expect(audioChannels).to.equal(2)
            expect(pixelFormat).to.equal('yuv420p')
            if (keepOutput) {
                // Helpful for manual inspection from host after dockerized runs.
                console.info(`[transcode-assets] kept output at ${tmpRoot}`)
            }
        } finally {
            if (!keepOutput) {
                fs.rmSync(tmpRoot, {recursive: true, force: true})
            }
        }
    })
})
