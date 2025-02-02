import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {setContext} from "@welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@welshman/app";
import {
    EventType, Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent, NostrCommunityServiceBot, SignerData, SignerType
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
    // announce: ['wss://tracker.webtorrent.dev'],
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

const uploadDir = '/tmp/iz-seeder-bot/upload'
const seedingDir = '/tmp/iz-seeder-bot/seeding'

const torrentPath = path.join(uploadDir, randomUUID())
mkdirSync(torrentPath, {recursive: true})

const torrent = wt.add('7ae6da845667363d2e6c21966b2a4886e72cfb35', options && {path: torrentPath})

torrent.on('infoHash', () => {
    console.log(`download torrent ${torrent.infoHash}`)
})

torrent.on('download', (bytes) => {
    console.log(`download torrent ${bytes} ${torrent.progress}`)
})

torrent.on('upload', (bytes) => {
    console.log(bytes)
})

torrent.on('error', (err) => {
    console.log(err)
})

torrent.on('done', () => {
    console.log('done')
})

torrent.on('wire', () => {
    console.log('wire')
})

