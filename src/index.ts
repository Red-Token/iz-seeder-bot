// src/index.ts
import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {setContext} from "@welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@welshman/app";
import {EventType, SignerData, SignerType} from "iz-nostrlib";
import {
    asyncCreateWelshmanSession,
    Community,
    CommunityIdentity
} from "iz-nostrlib/dist/org/nostr/communities/Community.js";
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent
} from "./test/Nip9999SeederControllEvents.js";
import WebTorrent from "webtorrent";
import SimplePeer from "simple-peer";
import {randomUUID} from "node:crypto";
import {mkdirSync} from "fs";
import ffmpeg from 'fluent-ffmpeg';
import path from "node:path";
import {NostrCommunityServiceBot} from "./test/nostrCommunityServiceBot";


const greet = (name: string): string => {
    return `Hello, ${name}!`;
};


console.log(greet("World"));

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
    announce: ['wss://tracker.webtorrent.dev'],
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

const aliceNSec = 'nsec18c4t7czha7g7p9cm05ve4gqx9cmp9w2x6c06y6l4m52jrry9xp7sl2su9x'
const aliceSignerData: SignerData = {type: SignerType.NIP01, nsec: aliceNSec}

console.log("aliceSignerData", aliceSignerData);

const community = new Community('iz-stream', relays, 'https://img.freepik.com/free-psd/close-up-delicious-apple_23-2151868338.jpg')
const ci = new CommunityIdentity(community, await asyncCreateWelshmanSession(aliceSignerData))

const ncs = new NostrCommunityServiceBot(community, ci)

const uploadDir = '/tmp/iz-seeder-bot/upload'
const seedingDir = '/tmp/iz-seeder-bot/seeding'

ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
        console.log(event)

        if (event.kind === Nip9999SeederTorrentTransformationRequestEvent.KIND) {
            const req = Nip9999SeederTorrentTransformationRequestEvent.build(event)

            const torrentPath = path.join(uploadDir, randomUUID())
            mkdirSync(torrentPath, {recursive: true})

            const torrent = wt.add(req.x, options && {path: torrentPath})

            let oldTime = 0
            torrent.on('download', (bytes) => {
                const now = new Date().getTime();

                if (torrent.done || now - oldTime < 300)
                    return

                oldTime = now

                // console.log(bytes)
                torrent.progress
                const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Downloaded' + torrent.progress}, event.id)
                // const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Downloaded' + torrent.progress}, [['e', event.id, '', 'root']])
                ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e2.createTemplate())
            })

            torrent.on('upload', (bytes) => {
                // console.log(bytes)
            })

            torrent.on('error', (err) => {
                console.log(err)
            })

            torrent.on('done', () => {
                console.log('done')

                const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Download Done'}, event.id)
                // const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Download Done'}, [['e', event.id, '', 'root']])
                ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e2.createTemplate())

                //TODO: Very primitive yes I know
                torrent.files.filter((file) => {
                    return file.name.endsWith('.mp4')
                }).forEach(file => {
                    console.log(file)

                    if (req.event === undefined)
                        throw new Error('')

                    const id = req.event.id
                    const outputDir = path.join(seedingDir, id)

                    transcode(id, path.join(torrent.path, file.path), outputDir).then(() => {
                        const outTorrent = wt.seed(outputDir, {...options, ...{name: req.title}})

                        outTorrent.on('infoHash', () => {
                            const e4 = new Nip9999SeederTorrentTransformationResponseEvent(
                                {msg: 'Start seeding'},
                                id,
                                [['x', outTorrent.infoHash]])
                            // [['x', outTorrent.infoHash], ['e', id, '', 'root']])
                            ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e4.createTemplate())
                        })
                    })
                })
            })
        }

        function transcode(id: string, inputFile: string, outputDir: string) {
            return new Promise(resolve => {
                mkdirSync(outputDir, {recursive: true})

                // const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding started'}, [['e', id, '', 'root']])
                const e2 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding started'}, id)
                ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e2.createTemplate())

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
                        // cmd = cmd.map(`[${key}]`).addOption(`-c:v:${i} ${videoCodec}`).addOption(`-b:v:${i} ${value.bitrate}`)
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

                        // const e3 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding Progress ' + progress.percent}, [['e', id, '', 'root']])
                        const e3 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding Progress ' + progress.percent}, id)
                        const y = ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e3.createTemplate())

                    }).on('end', () => {
                        console.log('Processing finished successfully!');

                        // const e4 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding DONE!'}, [['e', id, '', 'root']])
                        const e4 = new Nip9999SeederTorrentTransformationResponseEvent({msg: 'Transcoding DONE!'}, id)
                        const x = ncs.publisher.publish(Nip9999SeederTorrentTransformationResponseEvent.KIND, e4.createTemplate())

                        resolve(true)
                    }).on('error', (err) => {
                        console.error('Error: ', err.message);
                    }).run()
                })
            })
        }
    }
)
