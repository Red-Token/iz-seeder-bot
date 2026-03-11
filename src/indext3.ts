import {spawn} from 'node:child_process'
import ffmpeg from 'fluent-ffmpeg'
import {formats, VideoConverter} from './util/VideoConverter.js'
import path from 'node:path'
import {mkdirSync} from 'fs'
import {languages, SubtitleConverter} from './util/SubtitleConverter.js'
import {Dasher} from './util/Dasher.js'
import {patchMpd} from './util/BugFixer.js'
import {searchAndDownloadSubtitles} from './api/opensubtitles/SubtitleDownloader.js'
import {ProgressReporter} from './bot/TranscodingBot.js'


// 2006  ffmpeg -i sub_en.srt sub-en.vtt
// 2008  MP4Box -add sub-en.vtt:lang=en:name="English" -new subs-en.mp4

// ffmpeg -i sub_en.srt sub-en.vtt

const converter = new VideoConverter()

const srcDir = './tmp'
const downloadDir = '/tmp/green-shoe-download'
const targetDir = '/tmp/green-shoe'
const outDir = '/tmp/green-shoe-out'

mkdirSync(downloadDir, {recursive: true})
mkdirSync(targetDir, {recursive: true})
mkdirSync(outDir, {recursive: true})

const videos: string[] = []
const subtitles: string[] = []


const imdbId = 'tt1835736'

// The subs are here
{
    const lang = languages.en
    const downloadFile = path.join(downloadDir, `subtitles_${lang.short}.srt`)
    await searchAndDownloadSubtitles(imdbId, lang, downloadFile)

    const sconv = new SubtitleConverter()

    // Download the subs
    const outputFile = path.join(targetDir, `subtitles_${lang.short}.mp4`)
    subtitles.push(outputFile)
    await sconv.convert(downloadFile, outputFile, lang)
}

console.log('ZXOOOOO')

// Fix the conversion
{
    const inputFile = path.join(srcDir, 'orig_mov.mkv')

    // we execute all of these in parallel
    await Promise.all(Object.entries(formats).filter(val => val[1].width <= 1920).map((val) => {
        const outputFile = path.join(targetDir, `video_${val[0]}.mp4`)
        videos.push(outputFile)
        return converter.convert(inputFile, outputFile, val[1], new ProgressReporter())
    }))

    // for (const [key, format] of Object.entries(formats).filter(val => val[1].width <= 1920)) {
    //     const outputFile = path.join(targetDir, `video_${key}.mp4`)
    //     await converter.convert(inputFile, outputFile, format)
    // }
}

// Lets Dash!
{
    const dasher = new Dasher()
    const mpdFile = path.join(outDir, 'manifest.mpd')
    await dasher.dash(videos, subtitles, mpdFile)
    patchMpd(mpdFile)
}

await new Promise((resolve, reject) => {
    const cmd = ffmpeg('./tmp/sub_en.srt').output('./tmp/out/sub-en.vtt')
    cmd.on('end', () => {
        resolve(true)
    }).run()
})

const ls1 = spawn('MP4Box',
    [
        '-add', 'sub-en.vtt:lang=en:name="English"',
        '-new',
        'subs-en.mp4'
    ],
    {cwd: './tmp'})

ls1.stdout.on('data', (data: Buffer) => {
    console.log('BEEP')
    console.log(data.toString())
    console.log('BEEP')
})

ls1.stderr.on('data', (data: Buffer) => {

    const str = data.toString()

    // if (!str.startsWith('\x1b[37m'))
    //     return

    console.log('BEEP2')
    console.log(str)
    console.log('BEEP2')
})

const code: number = await new Promise<number>((resolve, reject) => {
    ls1.on('close', (code: number) => {
        resolve(code)
    })

    // ls1.on('exit', (code: number) => {
    //     resolve(code)
    // })

    ls1.on('error', (code: number, signal: NodeJS.Signals) => {
        reject(code)
    })
})


const ls = spawn('MP4Box',
    [
        '-dash', '4000',
        '-frag', '4000',
        '-rap',
        '-profile', 'live',
        '-segment-timeline',
        '-bs-switching', 'no',
        '-out', 'out/manifest.mpd',
        'in/video_1080p.mp4', 'in/video_720p.mp4', 'in/subs-en.mp4'
    ],
    {cwd: './tmp'})

ls.stdout.on('data', (data: Buffer) => {
    console.log('BEEP')
    console.log(data.toString())
    console.log('BEEP')
})

ls.stderr.on('data', (data: Buffer) => {

    const str = data.toString()

    if (!str.startsWith('\x1b[37m'))
        return

    console.log('BEEP2')
    console.log(str)
    console.log('BEEP2')
})

ls.on('close', (code: number) => {
    console.log(`child process exited with code ${code}`)
})


