import {mp4box} from '../gpac/MP4Box.js'

export class Dasher {
    async dash(videos: string[], subtitles: string[], mpdFile: string): Promise<void> {
        return new Promise((resolve, reject) => {
            mp4box()
                .addOption('-dash', '4000')
                .addOption('-frag', '4000')
                .addOption('-rap')
                .addOption('-profile', 'live')
                .addOption('-segment-timeline')
                .addOption('-profile', 'live')
                .addOption('-bs-switching', 'no')
                .addOption('-out', mpdFile)
                .addInputFiles(...videos)
                .addInputFiles(...subtitles)
                .on('end', () => resolve())
                .on('error', err => reject(err))
                .run()
        })
    }
}
