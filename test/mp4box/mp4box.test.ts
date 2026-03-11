import {Dasher} from '../../src/util/Dasher.js'
import path from 'node:path'
import {patchMpd} from '../../src/util/BugFixer.js'
import fs from 'node:fs'

before(async () => {
})

it('Zoool', async () => {

    const map: Map<string, string> = new Map()

    map.set('a', 'cccccccc')
})

it('Dash an asset', async function () {
    this.timeout(100000)

    console.log('Test')

    const videos: string[] = [
        '/tmp/learn/in/video_fhd.mp4',
        '/tmp/learn/in/video_sd.mp4',
        '/tmp/learn/in/video_hd.mp4'
    ]

    const subtitles = ['/tmp/learn/in/subtitles_en.mp4']

    const dashingPath: string = '/tmp/learn/out'

    fs.rmSync(dashingPath, {recursive: true})
    fs.mkdirSync(dashingPath)

    {
        const dasher = new Dasher()
        const mpdFile = path.join(dashingPath, 'manifest.mpd')
        await dasher.dash(videos, mpdFile, subtitles)
        patchMpd(mpdFile)
    }
})
