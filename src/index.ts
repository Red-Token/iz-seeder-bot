// src/index.ts
import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {setContext} from "@welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@welshman/app";
import {
    EventType, Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent, NostrCommunityServiceBot, Publisher, SignerData, SignerType
} from "iz-nostrlib";
import {
    asyncCreateWelshmanSession,
    Community,
    CommunityIdentity
} from "iz-nostrlib/dist/org/nostr/communities/Community.js";
import WebTorrent from "webtorrent";
import SimplePeer from "simple-peer";
import {randomUUID} from "node:crypto";
import {mkdirSync} from "fs";
import ffmpeg from 'fluent-ffmpeg';
import path from "node:path";
import fs from "node:fs";

console.log('Bot is rdy!');

const rtcConfig = {
    iceServers: [
        {
            urls: [
                "turn:turn.stream.labs.h3.se",
            ],
            username: "test",
            credential: "testme",
        },
        {
            urls:
                ["stun:stun.stream.labs.h3.se"],
            username: "test",
            credential: "testme",
        }],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 0,
}

const options = {
    announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
    maxWebConns: 500
};

const wt = new WebTorrent({
    tracker: {
        rtcConfig: {
            ...SimplePeer.config,
            ...rtcConfig
        }
    },
});

setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
});

const url = 'wss://relay.stream.labs.h3.se';
const relays = [normalizeRelayUrl(url)];

const botNSec = 'nsec18c4t7czha7g7p9cm05ve4gqx9cmp9w2x6c06y6l4m52jrry9xp7sl2su9x'
const botSignerData: SignerData = {type: SignerType.NIP01, nsec: botNSec}

console.log("botSignerData", botSignerData);

const community = new Community('iz-stream', relays, 'https://img.freepik.com/free-psd/close-up-delicious-apple_23-2151868338.jpg')
const ci = new CommunityIdentity(community, await asyncCreateWelshmanSession(botSignerData))

const ncs = new NostrCommunityServiceBot(community, ci)

const uploadDir = '/tmp/iz-seeder-bot/upload'
const transcodingDir = '/tmp/iz-seeder-bot/transcoding'
const seedingDir = '/tmp/iz-seeder-bot/seeding'

mkdirSync(seedingDir, {recursive: true})

class RequestStateProgressTracker {
    constructor(private readonly id: string, private readonly publisher: Publisher) {
    }

    updateState(state: any, tags: string[][] = []) {
        const e2 = new Nip9999SeederTorrentTransformationResponseEvent(state, this.id, tags)
        this.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e2.createTemplate())
    }
}

ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
    console.log(event)

    const rspt = new RequestStateProgressTracker(event.id, ncs.publisher)

    if (event.kind === Nip9999SeederTorrentTransformationRequestEvent.KIND) {
        const req = Nip9999SeederTorrentTransformationRequestEvent.build(event)

        const state = {state: 'accepted', msg: `Processing request ${event.id} for ${req.x}`}
        rspt.updateState(state)

        const torrentPath = path.join(uploadDir, randomUUID())
        mkdirSync(torrentPath, {recursive: true})

        rspt.updateState({state: 'prepared', msg: `Download is prepared`})

        const torrent = wt.add(req.x, options)

        torrent.on('infoHash', () => {
            console.log('infoHash:' + torrent.infoHash);
            console.log('magnetURI:' + torrent.magnetURI);
        })

        let oldTime = 0
        torrent.on('download', (bytes) => {
            console.log(`download torrent ${bytes} ${torrent.progress * 100}`)
            const now = new Date().getTime();

            if (torrent.done || now - oldTime < 300)
                return

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
            torrent.files.filter((file) => {
                return file.name.endsWith('.mp4')
            }).forEach(file => {
                console.log(file)

                if (req.event === undefined)
                    throw new Error('')

                const id = req.event.id
                const transcodingOutputDir = path.join(transcodingDir, id)

                transcode(id, path.join(torrent.path, file.path), transcodingOutputDir).then(() => {
                    // TODO: This can be done earlier
                    // We are done transcoding, remove the torrent
                    const assetDir = path.join(seedingDir, id)
                    wt.remove(req.x)
                    fs.rename(transcodingOutputDir, assetDir, (err) => {
                        console.log(err)
                    });

                    const outTorrent = wt.seed(assetDir, {...options, ...{name: req.title}})

                    outTorrent.on('infoHash', () => {
                        const state = {
                            state: 'seeding',
                            msg: `Transcoding has been done, starting to seed at ${outTorrent.infoHash}`
                        }
                        rspt.updateState(state, [['x', outTorrent.infoHash]])
                    })
                })
            })
        })
    }

    function transcode(id: string, inputFile: string, outputDir: string) {
        return new Promise(resolve => {
            mkdirSync(outputDir, {recursive: true})

            const state = {
                state: 'transcoding',
                msg: `Transcoding has started`
            }
            rspt.updateState(state)

            ffmpeg.ffprobe(inputFile, async (err, metadata) => {
                let oldTime = 0;

                if (err) {
                    console.error('Error retrieving metadata:', err);
                    return;
                }

                console.log('Metadata:', metadata);

                const videoStream = metadata.streams.find((s) => s.codec_type === 'video')

                if (videoStream === undefined)
                    throw new Error('No video stream');

                const formats = {
                    sd: {
                        width: 720,
                        height: 480,
                        // bitrate: '1500k'
                    },
                    hd: {
                        width: 1280,
                        height: 720,
                        // bitrate: '2500k'
                    },
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

                let cmd = ffmpeg(inputFile).complexFilter(complexFilterCommand);
                let i = 1
                const videoCodec = 'libx264'

                Object.entries(formats).forEach(([key, value]) => {
                    cmd = cmd.map(`[${key}]`).addOption(`-c:v:${i} ${videoCodec}`).addOption("-g", "48").addOption("-keyint_min", "48")
                    i++
                })

                const audioCodec = 'aac'
                const audioBitrate = '128k'
                cmd = cmd.addOption('-map', '0:a').addOption(`-c:a ${audioCodec}`).addOption(`-b:a ${audioBitrate}`)

                const outfile = path.join(outputDir, 'asset.mpd')

                cmd = cmd.format('dash')
                    .addOption("-seg_duration", '10')
                    .addOption("-init_seg_name", "init_$RepresentationID$.mp4")
                    .addOption("-media_seg_name", "segment_$RepresentationID$_$Number$.m4s")
                    .output(outfile)

                cmd.on('start', (commandLine) => {
                    console.log('FFmpeg command: ', commandLine);
                }).on('progress', (progress) => {
                    console.log('FFmpeg progress: ', progress);

                    const now = new Date().getTime();
                    if (now - oldTime < 300)
                        return
                    oldTime = now

                    const state = {
                        state: 'transcoding',
                        msg: `Transcoding ${progress.percent}`,
                        progress: progress.percent
                    }
                    rspt.updateState(state)

                }).on('end', () => {
                    console.log('Processing finished successfully!');

                    const state = {
                        state: 'transcoded',
                        msg: `Transcoding is done`,
                    }
                    rspt.updateState(state)

                    resolve(true)
                }).on('error', (err) => {
                    console.error('Error: ', err.message);
                }).run()
            })
        })
    }
})
