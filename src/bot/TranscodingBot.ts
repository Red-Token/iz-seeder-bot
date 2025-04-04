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

const defaultTorrentOptions: TorrentOptions = {
    announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
    maxWebConns: 500
}

export class SeedingBot {
    constructor(
        protected botConfig: BotConfig,
        protected wt: WebTorrent.Instance
    ) {
        mkdirSync(this.botConfig.seedingDir, {recursive: true})
    }

    async loadTorrents() {
        for (const filename of fs.readdirSync(this.botConfig.seedingDir)) {
            console.log(`Loading: ${filename}`)

            try {
                const torrentDir = path.join(this.botConfig.seedingDir, filename)
                const hash = await this.loadTorrent(torrentDir)

                console.log(`Started seeding: ${filename} as ${hash}`)
            } catch (e) {
                console.error(e)
            }
        }
    }

    async loadTorrent(torrentDir: string, options?: TorrentOptions): Promise<string> {
        // Check if the dir is empty
        if (fs.readdirSync(torrentDir).length === 0) {
            throw new Error('Empty torrentdir: ' + torrentDir)
        }

        const t = this.wt.seed(torrentDir, {...defaultTorrentOptions, ...options})

        return waitForInfoHash(t)
    }
}

export class TranscodingBot extends SeedingBot {
    rateLimit = 1000
    lastReport = 0

    async transcode(req: Nip9999SeederTorrentTransformationRequestEvent, rspt: RequestStateProgressTracker) {
        try {
            const reqConfig: TranscodingRequest = req.content
            console.warn(JSON.stringify(reqConfig))

            // type RequestState = {
            //     state: string, msg: string, progress?: number, final?: boolean
            // }

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

            const options: TorrentOptions = {
                announce: [
                    'wss://tracker.webtorrent.dev',
                    'wss://tracker.btorrent.xyz',
                    'wss://tracker.openwebtorrent.com'
                ],
                maxWebConns: 500,
                path: torrentPath
            }

            rspt.update({state: 'prepared', seq: 1, progress: 100, message: `Download is prepared`})

            const torrent: Torrent = this.wt.add(req.x, options)

            let lastReport = 0
            let sumBytes: number = 0

            rspt.update({state: 'downloading', seq: 2, progress: 0, message: `Starting to download`})

            torrent.on('download', (bytes: number) => {
                const now = new Date().getTime()
                sumBytes += bytes

                if (torrent.done || now - lastReport < this.rateLimit) return

                console.log(`download torrent ${bytes} ${torrent.progress * 100}`)
                rspt.update({
                    progress: torrent.progress * 100,
                    message: `Downloading torrent ${torrent.progress} done`
                })

                lastReport = now
                sumBytes = 0
            })

            await this.waitForDone(torrent)

            rspt.update({progress: 100, message: `The torrent has been downloaded`})

            this.wt.remove(torrent.infoHash)

            const videos: string[] = []
            const subtitles: string[] | undefined = []

            // Download subtitles
            if (reqConfig.subtitles) {
                rspt.update({state: 'subtitles', seq: 3, progress: 0, message: `Processing subtitles`})

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
                    // TODO convert this
                    await sconv.convert(subtitleFile, outputFile, subtitle.lang)

                    rspt.update({
                        progress: (i + 1) * fraq,
                        message: `Processed subtitle ${subtitle.lang.short}.srt`
                    })
                }
                rspt.update({progress: 100, message: 'Subtitles processed'})
            }

            // Transcode
            {
                rspt.update({state: 'transcoding', seq: 4, progress: 0, message: `Transcoding the asset`})
                this.lastReport = 0

                const converter = new VideoConverter()
                const inputFile = path.join(torrentPath, reqConfig.file)
                const cpr = new CombinedProgressReporter()

                cpr.on('progress', () => {
                    const now = new Date().getTime()

                    if (now - lastReport < this.rateLimit) return

                    rspt.update({progress: cpr.progress})
                })

                // we execute all of these in parallel
                await Promise.all(
                    Object.entries(reqConfig.formats).map((val) => {
                        const reporter = new ProgressReporter()
                        cpr.add(reporter)
                        const outputFile = path.join(transcodingPath, `video_${val[0]}.mp4`)
                        videos.push(outputFile)
                        return converter.convert(inputFile, outputFile, val[1], reporter)
                    })
                )
            }

            // Dash
            {
                rspt.update({state: 'dashing', seq: 5, progress: 0, message: `Dashing the asset`})

                const dasher = new Dasher()
                const mpdFile = path.join(dashingPath, 'manifest.mpd')
                await dasher.dash(videos, mpdFile, subtitles)
                patchMpd(mpdFile)

                rspt.update({progress: 100, message: `Dashing is done`})
            }

            {
                rspt.update({state: 'seeding', seq: 6, progress: 0, message: `Seeding the asset`})

                fs.rename(dashingPath, seedingPath, (err) => {
                    if (err === undefined || err === null) return

                    console.error(err)
                })

                mkdirSync(seedingPath, {recursive: true})
                // const outTorrent = wt.seed(assetDir, {...options, ...{name: req.title}})
                const files = fs.readdirSync(seedingPath).map((fileName) => path.join(seedingPath, fileName))
                const outTorrent = this.wt.seed(files, options)

                rspt.update({progress: 10, message: `Asset moved, waiting for infoHash`})

                const hash = await waitForInfoHash(outTorrent)

                rspt.update(
                    {
                        progress: 100,
                        final: true,
                        message: `Transcoding has been done, starting to seed at ${hash}`
                    },
                    [['x', outTorrent.infoHash]]
                )

                outTorrent.on('error', (error) => {
                    console.error(error)
                })

                outTorrent.on('warning', (warning) => {
                    console.warn(warning)
                })
            }
        } catch (e) {
            console.error(e)
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
