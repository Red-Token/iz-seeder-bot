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
import {RequestStateProgressTracker} from '../util/util.js'

export type Subtitle = {
    lang: Language,
    file?: string
}

export type TranscodingRequest = {
    file: string,
    formats: Formats,
    subtitles: Subtitle[],
    imdbId?: string,
}

export class ProgressReporter extends EventEmitter {
    private _progress: number = 0

    set progress(value: number) {
        if (this._progress >= value && 100 > value)
            return

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
        if (this._progress === 100)
            return

        this._progress = 100
        this.emit('done')
    }
}

export class CombinedProgressReporter extends ProgressReporter {
    private _progressReporters: ProgressReporter[] = []

    add(reporter: ProgressReporter) {
        this._progressReporters.push(reporter)
        reporter.on('progress', () => {
            this.progress = this._progressReporters
                .reduce((sum: number, reporter) => sum + reporter.progress, 0) / this._progressReporters.length
        })
    }
}

export class TranscodingBot {

    constructor(private botConfig: BotConfig, private wt: WebTorrent.Instance) {
    }

    async transcode(req: Nip9999SeederTorrentTransformationRequestEvent, rspt: RequestStateProgressTracker) {

        const reqConfig: TranscodingRequest = req.content

        let state = {state: 'accepted', msg: `Processing request ${req.event?.id} for ${req.x}`, progress: 0}
        rspt.updateState(state)

        // Create the upload dir
        const uuid = randomUUID()
        const tempAssetPath = path.join(this.botConfig.uploadDir, uuid)
        const torrentPath = path.join(tempAssetPath, 'torrent')
        const transcodingPath = path.join(tempAssetPath, 'transcoding')
        const seedingPath = path.join(this.botConfig.seedingDir, uuid)

        mkdirSync(torrentPath, {recursive: true})
        mkdirSync(seedingPath, {recursive: true})

        const options: TorrentOptions = {
            announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
            maxWebConns: 500,
            path: torrentPath
        }

        rspt.updateState({state: 'prepared', msg: `Download is prepared`})

        const torrent: Torrent = this.wt.add(req.x, options)

        let lastReport = 0
        let sumBytes: number = 0

        torrent.on('download', (bytes: number) => {
            const now = new Date().getTime()
            sumBytes += bytes

            if (torrent.done || now - lastReport < 3000)
                return

            console.log(`download torrent ${bytes} ${torrent.progress * 100}`)

            rspt.updateState({
                state: 'downloading',
                msg: `Downloading torrent ${torrent.progress} done`,
                progress: torrent.progress,
                downloaded: torrent.downloaded,
                sumBytes
            })

            lastReport = now
            sumBytes = 0
        })

        await this.waitForDone(torrent)

        rspt.updateState({state: 'downloaded', msg: `The torrent has been downloaded`})

        this.wt.remove(torrent.infoHash)

        const videos: string[] = []
        const subtitles: string[] = []

        // Download subtitles
        for (const subtitle of reqConfig.subtitles) {
            const file = subtitle.file ?? `subtitles_${subtitle.lang.short}.srt`
            const subtitleFile = path.join(torrentPath, file)

            if (!fs.existsSync(subtitleFile) && reqConfig.imdbId) {
                rspt.updateState({state: 'downloading subtitle', msg: `Downloading subtitle ${subtitle.lang.short}.srt`})

                await searchAndDownloadSubtitles(req.content.imdbId, subtitle.lang, subtitleFile)
            }

            const sconv = new SubtitleConverter()

            // Convert the subtitle
            const outputFile = path.join(transcodingPath, `subtitles_${subtitle.lang.short}.mp4`)
            subtitles.push(outputFile)
            // TODO convert this
            await sconv.convert(subtitleFile, outputFile, subtitle.lang)
        }

        rspt.updateState({state: 'subtitles done', msg: `The subtitles are ready`})


        // Transcode
        {
            state = {state: 'Transcoding', msg: `The subtitles are ready`, progress: 0}
            rspt.updateState(state)

            const converter = new VideoConverter()
            const inputFile = path.join(torrentPath, reqConfig.file)
            const cpr = new CombinedProgressReporter()

            cpr.on('progress', () => {
                state.progress = cpr.progress
                rspt.updateState(state)
            })

            // we execute all of these in parallel
            await Promise.all(Object.entries(reqConfig.formats).map((val) => {
                const reporter = new ProgressReporter()
                cpr.add(reporter)
                const outputFile = path.join(transcodingPath, `video_${val[0]}.mp4`)
                videos.push(outputFile)
                return converter.convert(inputFile, outputFile, val[1], reporter)
            }))
        }

        // Dash
        {
            state = {state: 'Dashing', msg: `Dashing`, progress: 0}
            rspt.updateState(state)

            const dasher = new Dasher()
            const mpdFile = path.join(seedingPath, 'manifest.mpd')
            await dasher.dash(videos, subtitles, mpdFile)
            patchMpd(mpdFile)
        }
    }

    waitForDone(torrent: Torrent): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            torrent.on('done', () => {
                resolve()
            })

            torrent.on('error', err => {
                reject(err)
            })
        })
    }
}
