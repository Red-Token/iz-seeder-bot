import {formats, VideoConverter} from '../src/util/VideoConverter.js'

describe('Crypt Test', () => {
    before(function() {
    })

    it('Convert a movie', async () => {

        const inputFile = 'test/data/crypt/orig/bbb_sunflower_2160p_60fps_normal.mp4'
        const vc = new VideoConverter()

        const f = Object.fromEntries(
            Object.entries(formats)
                .filter(([key, data]) => data.width <= 1920))

        for(const [key, format] of Object.entries(f)) {
            const outputFile = `test/data/crypt/split/bbb_sunflower_${key}_60fps_normal.mp4`
            await vc.convertVideo(inputFile,outputFile,format)
        }

        const outputFile = `test/data/crypt/split/bbb_sunflower_audio_en_60fps_normal.mp4`
        await vc.convertAudio(inputFile,outputFile)
    })

    it('Encrypt a movie', async () => {
    })
})
