// src/index.ts
import {hasValidSignature, normalizeRelayUrl, TrustedEvent} from '@red-token/welshman/util'
import {EventType} from 'iz-nostrlib'
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent,
    NostrCommunityServiceBot
} from 'iz-nostrlib/seederbot'
import {
    GlobalNostrContext,
    CommunityNostrContext,
    asyncCreateWelshmanSession,
    Identifier,
    Identity
} from 'iz-nostrlib/communities'
import {SignerData, SignerType, DynamicPublisher} from 'iz-nostrlib/ses'

import WebTorrent from 'webtorrent'
import SimplePeer from 'simple-peer'
import {randomUUID} from 'node:crypto'
import {mkdirSync} from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import path from 'node:path'
import fs from 'node:fs'
import {BotConfig} from './config.js'
import {setContext, ctx} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext, repository, tracker} from '@red-token/welshman/app'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

console.log('Bot is rdy!')

const botConfig = new BotConfig()

// const urlRelay = 'wss://relay.pre-alfa.iz-stream.com'

const rtcConfig = {
    iceServers: [
        {
            urls: ['turn:turn.stream.labs.h3.se'],
            username: 'test',
            credential: 'testme'
        },
        {
            urls: ['stun:stun.stream.labs.h3.se'],
            username: 'test',
            credential: 'testme'
        }
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 0
}

const options = {
    announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
    maxWebConns: 500
}

const wt = new WebTorrent({
    tracker: {
        rtcConfig: {
            ...SimplePeer.config,
            ...rtcConfig
        }
    }
})

setContext({
    app: getDefaultAppContext({
        requestDelay: 100,
        authTimeout: 500,
        requestTimeout: 5000,
        dufflepudUrl: 'https://api.example.com',
        indexerRelays: botConfig.globalRelay,
    }),
    net: getDefaultNetContext({


        // Track deleted events
        isDeleted: (url, event) => repository.isDeleted(event),

        // Custom event handling
        onEvent: (url, event) => {
            // Save to local repository
            repository.publish(event)

            // Track which relay it came from
            tracker.track(event.id, url)
        }
    })
})

// NSec nsec1gdraq2julszrgygm5zf7e02rng6jguxmr5uuxy7wnyex9yszkwesrfnu3m
// NPub npub1kecwpcs0k6m7j6crfyfecqc4p45j5aqrexrqnxs64h6x0k4x0yysrx2y6f
// PublicKey b670e0e20fb6b7e96b0349139c03150d692a7403c986099a1aadf467daa67909

// const url = 'wss://relay.stream.labs.h3.se';
// const relays = [normalizeRelayUrl(url)];

export async function wait(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}



// GlobalNostrContext.startUrls = botConfig.comRelay
const gnc = new GlobalNostrContext(botConfig.globalRelay)

await wait(2000)

const botSignerData: SignerData = {type: SignerType.NIP01, nsec: botConfig.nsec}
const botIdentifier = new Identifier(await asyncCreateWelshmanSession(botSignerData))

// const bgi = new Identity(gnc, botIdentifier)
const cnc = new CommunityNostrContext(botConfig.communityPubkey, gnc)

const bci = new Identity(cnc, botIdentifier)

console.log('Bot Pubkey', bci.pubkey)

const ncs = new NostrCommunityServiceBot(cnc, bci)

// const uploadDir = './tmp/iz-seeder-bot/upload'
// const transcodingDir = './tmp/iz-seeder-bot/transcoding'
// const seedingDir = './var/tmp/iz-seeder-bot/seeding'

mkdirSync(botConfig.seedingDir, {recursive: true})

fs.readdirSync(botConfig.seedingDir).forEach((filename) => {
    console.log(`Starting seeding: ${filename}`)
    const t = wt.seed(path.join(botConfig.seedingDir, filename), options)
    console.log(`Started seeding: ${filename}`)

    t.on("infoHash", () => {
        console.log(`Seeding hash: ${t.infoHash}`);
    })

    t.on("metadata", () => {
        console.log(`Seeding hash: ${t.infoHash}`);
    })

    console.log(`Started seeding: ${filename} + ${t.infoHash}`);

})

class RequestStateProgressTracker {
    constructor(
        private readonly id: string,
        private readonly publisher: DynamicPublisher
    ) {
    }

    updateState(state: any, tags: string[][] = []) {
        const e2 = new Nip9999SeederTorrentTransformationResponseEvent(state, this.id, tags)
        this.publisher.publish(e2)
    }
}

ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
    console.log(event)

    const rspt = new RequestStateProgressTracker(event.id, ncs.publisher)

    if (event.kind === Nip9999SeederTorrentTransformationRequestEvent.KIND) {
        const req = Nip9999SeederTorrentTransformationRequestEvent.buildFromEvent(event)

        const state = {state: 'accepted', msg: `Processing request ${event.id} for ${req.x}`}
        rspt.updateState(state)

        const torrentPath = path.join(botConfig.uploadDir, randomUUID())
        mkdirSync(torrentPath, {recursive: true})

        rspt.updateState({state: 'prepared', msg: `Download is prepared`})

        const torrent = wt.add(req.x, options)

        torrent.on('infoHash', () => {
            console.log('infoHash:' + torrent.infoHash)
            console.log('magnetURI:' + torrent.magnetURI)
        })

        let oldTime = 0
        torrent.on('download', (bytes) => {
            console.log(`download torrent ${bytes} ${torrent.progress * 100}`)
            const now = new Date().getTime()

            if (torrent.done || now - oldTime < 300) return

            oldTime = now

            const state = {
                state: 'downloading',
                msg: `Downloading torrent ${torrent.progress} done`,
                progress: torrent.progress,
                downloaded: torrent.downloaded
            }
            rspt.updateState(state)
        })

        torrent.on('upload', (bytes) => {
            console.log(bytes)
        })

        torrent.on('error', (err) => {
            console.log(err)
        })

        torrent.on('done', () => {
            console.log('done')

            const state = {state: 'downloaded', msg: `The torrent has been downloaded`}
            rspt.updateState(state)

            //TODO: Very primitive yes I know
            torrent.files
                .filter((file) => {
                    return file.name.endsWith('.mp4')
                })
                .forEach((file) => {
                    console.log(file)

                    if (req.event === undefined) throw new Error('')

                    const id = req.event.id
                    const transcodingOutputDir = path.join(botConfig.transcodingDir, id)

                    transcode(id, path.join(torrent.path, file.path), transcodingOutputDir).then(() => {
                        // TODO: This can be done earlier
                        // We are done transcoding, remove the torrent
                        const assetDir = path.join(botConfig.seedingDir, id)
                        wt.remove(req.x)
                        fs.rename(transcodingOutputDir, assetDir, (err) => {
                            if (err === undefined || err === null) return

                            console.log(err)
                        })

                        // const outTorrent = wt.seed(assetDir, {...options, ...{name: req.title}})
                        const outTorrent = wt.seed(assetDir, options)

                        outTorrent.on('infoHash', () => {
                            const state = {
                                state: 'seeding',
                                msg: `Transcoding has been done, starting to seed at ${outTorrent.infoHash}`,
                                final: true
                            }
                            rspt.updateState(state, [['x', outTorrent.infoHash]])
                        })

                        outTorrent.on('error', (error) => {
                            console.log(error)
                        })

                        outTorrent.on('warning', (warning) => {
                            console.log(warning)
                        })
                    })
                })
        })
    }

    function transcode(id: string, inputFile: string, outputDir: string) {
        return new Promise((resolve) => {
            mkdirSync(outputDir, {recursive: true})

            const state = {
                state: 'transcoding',
                msg: `Transcoding has started`
            }
            rspt.updateState(state)

            ffmpeg.ffprobe(inputFile, async (err, metadata) => {
                let oldTime = 0

                if (err) {
                    console.error('Error retrieving metadata:', err)
                    return
                }

                console.log('Metadata:', metadata)

                const videoStream = metadata.streams.find((s) => s.codec_type === 'video')

                if (videoStream === undefined) throw new Error('No video stream')

                const formats = {
                    sd: {
                        width: 720,
                        height: 480
                        // bitrate: '1500k'
                    },
                    hd: {
                        width: 1280,
                        height: 720
                        // bitrate: '2500k'
                    }
                    // fhd: {
                    //     width: 1920,
                    //     height: 1080,
                    //     // bitrate: '5000k'
                    // },
                    // uhd: {
                    //     width: 3840,
                    //     height: 2160,
                    //     // bitrate: '8000k'
                    // }
                }

                let complexFilterCommand = ''
                Object.entries(formats).forEach(([key, value]) => {
                    complexFilterCommand += `[0:v]scale=${value.width}x${value.height}[${key}];`
                })

                let cmd = ffmpeg(inputFile).complexFilter(complexFilterCommand)
                let i = 1
                const videoCodec = 'libx264'

                Object.entries(formats).forEach(([key, value]) => {
                    cmd = cmd
                        .map(`[${key}]`)
                        .addOption(`-c:v:${i} ${videoCodec}`)
                        .addOption('-g', '48')
                        .addOption('-keyint_min', '48')
                    i++
                })

                const audioCodec = 'aac'
                const audioBitrate = '128k'
                cmd = cmd.addOption('-map', '0:a').addOption(`-c:a ${audioCodec}`).addOption(`-b:a ${audioBitrate}`)

                const outfile = path.join(outputDir, 'asset.mpd')

                cmd = cmd
                    .format('dash')
                    .addOption('-seg_duration', '10')
                    .addOption('-init_seg_name', 'init_$RepresentationID$.mp4')
                    .addOption('-media_seg_name', 'segment_$RepresentationID$_$Number$.m4s')
                    .output(outfile)

                cmd.on('start', (commandLine) => {
                    console.log('FFmpeg command: ', commandLine)
                })
                    .on('progress', (progress) => {
                        console.log('FFmpeg progress: ', progress)

                        const now = new Date().getTime()
                        if (now - oldTime < 300) return
                        oldTime = now

                        const state = {
                            state: 'transcoding',
                            msg: `Transcoding ${progress.percent}`,
                            progress: progress.percent
                        }
                        rspt.updateState(state)
                    })
                    .on('end', () => {
                        console.log('Processing finished successfully!')

                        const state = {
                            state: 'transcoded',
                            msg: `Transcoding is done`
                        }
                        rspt.updateState(state)

                        resolve(true)
                    })
                    .on('error', (err) => {
                        console.error('Error: ', err.message)
                    })
                    .run()
            })
        })
    }
})

console.log('BOT STARTED DONE')
