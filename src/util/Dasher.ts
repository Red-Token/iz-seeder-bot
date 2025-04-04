import {mp4box} from '../gpac/MP4Box.js'

export class Dasher {
    async dash(videos: string[], mpdFile: string, subtitles?: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = mp4box()
                .addOption('-dash', '4000')
                .addOption('-frag', '4000')
                .addOption('-rap')
                .addOption('-profile', 'live')
                .addOption('-segment-timeline')
                .addOption('-bs-switching', 'no')
                .addOption('-out', mpdFile)
                .addInputFiles(...videos)

            if (subtitles?.length) {
                process.addInputFiles(...subtitles)
            }

            process
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run()
        })
    }
}
