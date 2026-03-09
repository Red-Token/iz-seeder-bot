import {Nip9999SeederTorrentTransformationRequestEvent} from 'iz-nostrlib/seederbot'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'fs'
import {BotConfig} from '../config.js'
import WebTorrent, {Torrent, TorrentOptions} from 'webtorrent'
import {Language, SubtitleConverter} from '../util/SubtitleConverter.js'
import {searchAndDownloadSubtitles} from '../api/opensubtitles/SubtitleDownloader.js'
import fs from 'node:fs'
import {Formats, VideoConverter} from '../util/VideoConverter.js'
import EventEmitter from 'node:events'
import {Dasher} from '../util/Dasher.js'
import {patchMpd} from '../util/BugFixer.js'
import {RequestStateProgressTracker, waitForInfoHash} from '../util/util.js'

export type Subtitle = {
    lang: Language
    file?: string
}

export type TranscodingRequest = {
    file: string
    formats: Formats
    subtitles?: Subtitle[]
    imdbId?: string
}

export class ProgressReporter extends EventEmitter {
    private _progress: number = 0

    set progress(value: number) {
        if (this._progress >= value && 100 > value) return

        if (value === 100) {
            this.done()
            return
        }

        this._progress = value
        this.emit('progress', value)
    }

    get progress(): number {
        return this._progress
    }

    done() {
        if (this._progress === 100) return

        this._progress = 100
        this.emit('done')
    }
}

export class CombinedProgressReporter extends ProgressReporter {
    private _progressReporters: ProgressReporter[] = []

    add(reporter: ProgressReporter) {
        this._progressReporters.push(reporter)
        reporter.on('progress', () => {
            this.progress =
                this._progressReporters.reduce((sum: number, reporter) => sum + reporter.progress, 0) /
                this._progressReporters.length
        })
    }
}

export class SeedingBot {
    protected readonly defaultTorrentOptions: TorrentOptions

    constructor(
        protected botConfig: BotConfig,
        protected wt: WebTorrent.Instance
    ) {
        mkdirSync(this.botConfig.seedingDir, {recursive: true})
        this.defaultTorrentOptions = {
            announce: this.botConfig.trackerAnnounce,
            maxWebConns: 500
        }
    }

    async loadTorrents() {
        console.info('[seeder-bot] loadTorrents scanning', {seedingDir: this.botConfig.seedingDir})

        for (const filename of fs.readdirSync(this.botConfig.seedingDir)) {
            console.info('[seeder-bot] loading existing seeding directory', {filename})

            try {
                const torrentDir = path.join(this.botConfig.seedingDir, filename)
                const hash = await this.loadTorrent(torrentDir)

                console.info('[seeder-bot] existing torrent loaded', {filename, hash})
            } catch (e) {
                console.error('[seeder-bot] failed to load existing torrent', {filename, error: e})
            }
        }
    }

    async loadTorrent(torrentDir: string, options?: TorrentOptions): Promise<string> {
        // Check if the dir is empty
        if (fs.readdirSync(torrentDir).length === 0) {
            throw new Error('Empty torrentdir: ' + torrentDir)
        }

        const t = this.wt.seed(torrentDir, {...this.defaultTorrentOptions, ...options})

        return waitForInfoHash(t)
    }
}

export class TranscodingBot extends SeedingBot {
    rateLimit = 1000
    lastReport = 0
    transcodingTimeoutMs = Number(process.env.BOT_TRANSCODING_TIMEOUT_MS ?? '120000')
    dashingTimeoutMs = Number(process.env.BOT_DASHING_TIMEOUT_MS ?? '120000')

    private async withStageTimeout<T>(stage: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
        return await new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`${stage} timed out after ${timeoutMs}ms`))
            }, timeoutMs)

            fn()
                .then((result) => {
                    clearTimeout(timer)
                    resolve(result)
                })
                .catch((error) => {
                    clearTimeout(timer)
                    reject(error)
                })
        })
    }

    private async moveDirectory(src: string, dest: string): Promise<void> {
        try {
            await fs.promises.rename(src, dest)
            return
        } catch (error) {
            const err = error as NodeJS.ErrnoException
            if (err.code !== 'EXDEV') {
                throw error
            }
        }

        await fs.promises.cp(src, dest, {recursive: true, force: true})
        await fs.promises.rm(src, {recursive: true, force: true})
    }

    async transcode(req: Nip9999SeederTorrentTransformationRequestEvent, rspt: RequestStateProgressTracker) {
        try {
            const reqConfig: TranscodingRequest = req.content
            console.info('[seeder-bot] transcode request start', {
                requestEventId: req.event?.id,
                title: req.title,
                torrentHash: req.x,
                file: reqConfig.file,
                formats: Object.keys(reqConfig.formats)
            })

            rspt.requestState = {
                seq: 0,
                total: 6,
                progress: 100,
                state: 'accepted',
                message: `Processing request ${req.event?.id} for ${req.x}`,
                final: false
            }

            // Create the upload dir
            const uuid = randomUUID()
            const tempAssetPath = path.join(this.botConfig.uploadDir, uuid)
            const torrentPath = path.join(tempAssetPath, 'torrent')
            const transcodingPath = path.join(tempAssetPath, 'transcoding')
            const dashingPath = path.join(tempAssetPath, 'dashing')
            const seedingPath = path.join(this.botConfig.seedingDir, uuid)

            mkdirSync(torrentPath, {recursive: true})
            mkdirSync(dashingPath, {recursive: true})
            mkdirSync(transcodingPath, {recursive: true})

            const options: TorrentOptions = {...this.defaultTorrentOptions, ...{path: torrentPath}}

            rspt.update({state: 'prepared', seq: 1, progress: 100, message: 'Download is prepared'})
            console.info('[seeder-bot] download prepared', {requestEventId: req.event?.id, torrentPath})

            const torrent: Torrent = this.wt.add(req.x, options)

            let lastReport = 0
            let sumBytes: number = 0

            rspt.update({state: 'downloading', seq: 2, progress: 0, message: 'Starting to download'})
            console.info('[seeder-bot] download started', {requestEventId: req.event?.id})

            torrent.on('download', (bytes: number) => {
                const now = new Date().getTime()
                sumBytes += bytes

                if (torrent.done || now - lastReport < this.rateLimit) return

                console.info('[seeder-bot] download progress', {
                    requestEventId: req.event?.id,
                    bytes,
                    accumulated: sumBytes,
                    progressPct: torrent.progress * 100
                })
                rspt.update({
                    progress: torrent.progress * 100,
                    message: `Downloading torrent ${torrent.progress} done`
                })

                lastReport = now
                sumBytes = 0
            })

            await this.waitForDone(torrent)
            console.info('[seeder-bot] download finished', {requestEventId: req.event?.id, infoHash: torrent.infoHash})

            rspt.update({progress: 100, message: 'The torrent has been downloaded'})

            this.wt.remove(torrent.infoHash)

            const videos: string[] = []
            const subtitles: string[] | undefined = []

            // Download subtitles
            if (reqConfig.subtitles) {
                rspt.update({state: 'subtitles', seq: 3, progress: 0, message: 'Processing subtitles'})
                console.info('[seeder-bot] subtitle processing started', {
                    requestEventId: req.event?.id,
                    subtitleCount: reqConfig.subtitles.length
                })

                const fraq = 100 / reqConfig.subtitles.length
                for (const [i, subtitle] of reqConfig.subtitles.entries()) {
                    const file = subtitle.file ?? `subtitles_${subtitle.lang.short}.srt`
                    const subtitleFile = path.join(torrentPath, file)

                    if (!fs.existsSync(subtitleFile) && reqConfig.imdbId) {
                        rspt.update({
                            progress: i * fraq + 1,
                            message: `Downloading subtitle ${subtitle.lang.short}.srt`
                        })

                        await searchAndDownloadSubtitles(req.content.imdbId, subtitle.lang, subtitleFile)
                    }

                    rspt.update({
                        progress: (i + 0.5) * fraq,
                        message: `Processed subtitle ${subtitle.lang.short}.srt`
                    })

                    const sconv = new SubtitleConverter()

                    // Convert the subtitle
                    const outputFile = path.join(transcodingPath, `subtitles_${subtitle.lang.short}.mp4`)
                    subtitles.push(outputFile)
                    await sconv.convert(subtitleFile, outputFile, subtitle.lang)

                    rspt.update({
                        progress: (i + 1) * fraq,
                        message: `Processed subtitle ${subtitle.lang.short}.srt`
                    })
                }
                rspt.update({progress: 100, message: 'Subtitles processed'})
                console.info('[seeder-bot] subtitle processing finished', {requestEventId: req.event?.id})
            }

            // Transcode
            {
                rspt.update({state: 'transcoding', seq: 4, progress: 0, message: 'Transcoding the asset'})
                this.lastReport = 0

                const converter = new VideoConverter()
                const inputFile = path.join(torrentPath, reqConfig.file)
                const cpr = new CombinedProgressReporter()

                console.info('[seeder-bot] transcoding started', {
                    requestEventId: req.event?.id,
                    inputFile,
                    formats: Object.keys(reqConfig.formats),
                    timeoutMs: this.transcodingTimeoutMs
                })

                cpr.on('progress', () => {
                    const now = new Date().getTime()

                    if (now - lastReport < this.rateLimit) return

                    rspt.update({progress: cpr.progress})
                })

                await this.withStageTimeout('transcoding', this.transcodingTimeoutMs, async () => {
                    await Promise.all(
                        Object.entries(reqConfig.formats).map((val) => {
                            const reporter = new ProgressReporter()
                            cpr.add(reporter)
                            const outputFile = path.join(transcodingPath, `video_${val[0]}.mp4`)
                            videos.push(outputFile)
                            return converter.convert(inputFile, outputFile, val[1], reporter)
                        })
                    )
                })

                console.info('[seeder-bot] transcoding finished', {
                    requestEventId: req.event?.id,
                    outputs: videos
                })
            }

            // Dash
            {
                rspt.update({state: 'dashing', seq: 5, progress: 0, message: 'Dashing the asset'})
                console.info('[seeder-bot] dashing started', {
                    requestEventId: req.event?.id,
                    timeoutMs: this.dashingTimeoutMs
                })

                const dasher = new Dasher()
                const mpdFile = path.join(dashingPath, 'manifest.mpd')
                await this.withStageTimeout('dashing', this.dashingTimeoutMs, async () => {
                    await dasher.dash(videos, mpdFile, subtitles)
                })
                patchMpd(mpdFile)

                rspt.update({progress: 100, message: 'Dashing is done'})
                console.info('[seeder-bot] dashing finished', {
                    requestEventId: req.event?.id,
                    mpdFile
                })
            }

            {
                rspt.update({state: 'seeding', seq: 6, progress: 0, message: 'Seeding the asset'})
                console.info('[seeder-bot] seeding started', {
                    requestEventId: req.event?.id,
                    seedingPath
                })

                await this.moveDirectory(dashingPath, seedingPath)
                console.info('[seeder-bot] dashing output moved to seeding path', {
                    requestEventId: req.event?.id,
                    seedingPath
                })

                rspt.update({progress: 10, message: 'Asset moved, waiting for infoHash'})

                const hash = await this.loadTorrent(seedingPath, options)
                console.info('[seeder-bot] seeding hash ready', {
                    requestEventId: req.event?.id,
                    hash
                })

                rspt.update(
                    {
                        progress: 100,
                        final: true,
                        message: `Transcoding has been done, starting to seed at ${hash}`
                    },
                    [['x', hash]]
                )
            }
        } catch (e) {
            console.error('[seeder-bot] transcode failed', {
                requestEventId: req.event?.id,
                error: e
            })
            rspt.update({state: 'error', seq: -1, progress: 100, final: true, message: `Exited error: ${e}`})
        }
    }

    waitForDone(torrent: Torrent): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            torrent.on('done', () => {
                resolve()
            })

            torrent.on('error', (err) => {
                reject(err)
            })
        })
    }
}
