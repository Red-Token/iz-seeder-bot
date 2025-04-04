import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import {ProgressReporter} from '../bot/TranscodingBot.js'

export type Format = {
    width: number
    height: number
    video_bitrate?: string
}

export type Formats = {
    [key: string]: Format
}

export const formats: Formats = {
    sd: {
        width: 720,
        height: 480
        // video_bitrate: '1500k'
    },
    hd: {
        width: 1280,
        height: 720
        // video_bitrate: '2500k'
    },
    fhd: {
        width: 1920,
        height: 1080
        // video_bitrate: '5000k'
    },
    uhd: {
        width: 3840,
        height: 2160
        // video_bitrate: '8000k'
    }
}

export class VideoConverter {
    videoCodec = 'libx264'
    audioCodec = 'aac'
    audioBitrate = '128k'

    constructor(private preset = 'ultrafast') {}

    async convert(input: string, output: string, format: Format, reporter?: ProgressReporter) {
        await new Promise<void>((resolve, reject) => {
            const scale = `${format.width}:${format.height}`
            const gop = 60

            ffmpeg(input)
                // Video
                .addOption('-c:v', `${this.videoCodec}`)

                // CRF (Constant Rate Factor) this removed the set bitrate ie -b:v
                .addOption('-crf', '23')
                .addOption('-preset', this.preset)

                // GOP (Group of Pictures) size
                .addOption('-g', `${gop}`)
                .addOption('-keyint_min', `${gop}`)

                // Scene Change Threshold (disabled)
                .addOption('-sc_threshold', '0')

                .addOption(`-vf`, `scale=${scale}`)

                // Audio
                .addOption('-c:a', `${this.audioCodec}`)
                .addOption('-b:a', `${this.audioBitrate}`)

                // Options for creating the file
                .addOption('-movflags', '+faststart')

                .addOption('-y')
                .output(output)
                .on('start', (commandLine) => {
                    console.log('FFmpeg command: ', commandLine)
                })
                .on('progress', (progress) => {
                    console.log('progress: ', progress)
                    if (reporter !== undefined) reporter.progress = progress.percent ?? 0
                })
                .on('error', (err) => reject(err))
                .on('end', () => {
                    if (reporter !== undefined) reporter.done()
                    resolve()
                })
                .run()
        })
    }
}
