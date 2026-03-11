import SimplePeer from 'simple-peer'
import WebTorrent, {Torrent} from 'webtorrent'
// import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
// import {SignerData} from "iz-nostrlib/src/org/nostr/ses/SynchronisedSession";
import {SignerType} from 'iz-nostrlib/ses'
import {languages} from '../src/util/SubtitleConverter.js'
import {searchAndDownloadSubtitles} from '../src/api/opensubtitles/SubtitleDownloader.js'


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// TODO FIX THIS
export type SignerData = {
    type: SignerType,
    nsec?: string,
    pubkey?: string,
    relays?: string[],
    rpubkey?: string,
    secret?: string,
}

const url = 'wss://relay.lxc'

// TODO FIX THIS
// export class BotConfig {
//     comRelay = [url]
//     nsec: string = 'nsec1p5p9ax0uftre04ewgxntkca4jurj2zlhjed46nwr22xs652vgtss84jeep'
//     communityPubkey = '76e75c0c50ce7ef714b76eaf06d6a06a29d296d5bb86270818675a669938dbe2'
//     uploadDir = '/tmp/iz-seeder-bot/upload'
//     transcodingDir = '/tmp/iz-seeder-bot/transcoding'
//     seedingDir = '/var/tmp/iz-seeder-bot/seeding'
// }

const rtcConfig = {
    iceServers: [
        {
            urls: [
                'turn:turn.stream.labs.h3.se'
            ],
            username: 'test',
            credential: 'testme'
        },
        {
            urls:
                ['stun:stun.stream.labs.h3.se'],
            username: 'test',
            credential: 'testme'
        }],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 0
}

const options = {
    announce: ['wss://tracker.webtorrent.dev'],
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

async function getTorrentHash(torrent: Torrent): Promise<string> {
    return new Promise(resolve => {
        if (torrent.infoHash !== undefined) resolve(torrent.infoHash)

        torrent.on('infoHash', () => {
            resolve(torrent.infoHash)
        })
    })
}

describe('MyTest', () => {
    before(function() {
    })

    it('DASH a movie', async () => {
        await searchAndDownloadSubtitles('tt1727587', languages.en , 'test.srt')
    })
})
