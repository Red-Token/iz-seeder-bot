import {mp4box} from '../gpac/MP4Box.js'

export class ProgressReport {
    static regex = /AS#(\d+\.\d+)\((\w)\) seg #(\d+) ([\d.]+)s \(([\d.]+) %\)|MPD ([\d.]+)s (\d+) %/g

    public media
    public mpd

    constructor(message: string) {
        this.media = []
        this.mpd = {}

        let match

        while ((match = ProgressReport.regex.exec(message)) !== null) {
            if (match[1]) {
                this.media.push({
                    id: match[1],
                    type: match[2],
                    segment: match[3],
                    duration: match[4],
                    percent: match[5]
                })
            } else {
                this.mpd = {
                    mpdTime: match[6],
                    mpdPercent: match[7]
                }
            }
        }
    }
}

export class Dasher {
    private buildDashInputs(videos: string[], subtitles?: string[]): string[] {
        if (videos.length === 0) {
            return subtitles ?? []
        }

        const [firstVideo, ...otherVideos] = videos
        const inputs: string[] = []

        // Force separate audio/video representations for DASH-AVC compatibility.
        inputs.push(`${firstVideo}#audio:id=audio`)
        inputs.push(`${firstVideo}#video:id=v0`)

        otherVideos.forEach((video, index) => {
            inputs.push(`${video}#video:id=v${index + 1}`)
        })

        if (subtitles?.length) {
            inputs.push(...subtitles)
        }

        return inputs
    }

    async dash(videos: string[], mpdFile: string, subtitles?: string[]): Promise<void> {

        const dash = 4000
        const frag = 4000
        const profile = 'dashavc264:live'
        const dashInputs = this.buildDashInputs(videos, subtitles)

        return new Promise((resolve, reject) => {
            const startedAt = Date.now()
            const process = mp4box()
                .addOption('-dash', `${dash}`)
                .addOption('-frag', `${frag}`)
                .addOption('-rap')
                .addOption('-profile', profile)
                .addOption('-segment-timeline')
                .addOption('-bs-switching', 'no')
                .addOption('-segment-name', '$RepresentationID$_$Number%05d$')
                .addOption('-out', mpdFile)
                .addInputFiles(...dashInputs)

            process
                .on('start', (data: {command: string; args: string[]}) => {
                    console.info('[seeder-bot] gpac started', {
                        command: data.command,
                        args: data.args,
                        dashInputs
                    })
                })
                .on('progress', (data) => {
                    const pr = new ProgressReport(data)
                    console.log(pr)
                })
                .on('info', (_data) => {
                    // no-op
                })
                .on('warning', (data) => {
                    console.warn(data)
                })
                .on('close', (data: {code: number | null; signal: NodeJS.Signals | null}) => {
                    console.info('[seeder-bot] gpac close', {
                        code: data.code,
                        signal: data.signal,
                        elapsedMs: Date.now() - startedAt
                    })
                })
                .on('end', () => {
                    console.info('[seeder-bot] gpac finished', {mpdFile, elapsedMs: Date.now() - startedAt})
                    resolve()
                })
                .on('error', (err) => {
                    console.error('[seeder-bot] gpac failed', {
                        mpdFile,
                        elapsedMs: Date.now() - startedAt,
                        error: err?.message ?? String(err),
                        dashInputs
                    })
                    reject(err)
                })
                .run()
        })
    }
}
