import SimplePeer from 'simple-peer'
import WebTorrent, {Torrent} from 'webtorrent'
// import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {getPublicKey, nip19} from 'nostr-tools'
import {BotConfig} from '../src/config.js'
// import {SignerData} from "iz-nostrlib/src/org/nostr/ses/SynchronisedSession";
import {SignerType} from 'iz-nostrlib/ses'
import {Subtitle, TranscodingBot, TranscodingRequest} from '../src/bot/TranscodingBot.js'
import {Language, languages} from '../src/util/SubtitleConverter.js'
import {formats} from '../src/util/VideoConverter.js'
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent,
    NostrCommunityServiceBot,
    NostrCommunityServiceClient
} from 'iz-nostrlib/seederbot'
import {DynamicPublisher} from 'iz-nostrlib/ses'
import {DynamicSynchronisedSession, DynamicSubscription} from 'iz-nostrlib/ses'
import {CommunityNostrContext} from 'iz-nostrlib/communities'
import {GlobalNostrContext} from 'iz-nostrlib/communities'
import {Identity} from 'iz-nostrlib/communities'
import {asyncCreateWelshmanSession, Identifier} from 'iz-nostrlib/communities'
import {EventType} from 'iz-nostrlib'
import {TrustedEvent} from '@red-token/welshman/util'
import {RequestStateProgressTracker} from '../src/util/util.js'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'


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

export async function wait(time: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

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

    it('DASH a movie remote', async () => {
        // const url = 'wss://relay.stream.labs.h3.se';
        // const relays = [normalizeRelayUrl(url)];
        setContext({
            net: getDefaultNetContext(),
            app: getDefaultAppContext()
        })

        const botConfig = new BotConfig()

        const globalNostrContext = new GlobalNostrContext(botConfig.globalRelay)

        // Wait for the global context to load all the profiles
        await wait(2000)

        // Bobs credentials
        const bobNSec = 'nsec1zsp48upz3vd64lwhx7me8utrxyfxuzdwvxhfld2q0ehs0ya9mlxs47v64q'
        const bobSignerData: SignerData = {type: SignerType.NIP01, nsec: bobNSec}
        const bobWs = await asyncCreateWelshmanSession(bobSignerData)
        const bobIdentifier = new Identifier(bobWs)
        const bobIdentity = new Identity(globalNostrContext, bobIdentifier)

        const bobCommunityNosterContext = new CommunityNostrContext(botConfig.communityPubkey, globalNostrContext)
        const bobNostrCommunityServiceClient = new NostrCommunityServiceClient(bobCommunityNosterContext, bobIdentity)

        // Start the test
        const origFile = 'test/data/sintel/orig/Sintel.2010.1080p.mkv'
        const imdbId = 'tt1727587'

        // const t = wt2.seed('./tmp/orig_mov.mkv')
        const torrent = wt.seed(origFile)

        const hash = await getTorrentHash(torrent)

        const subs = Object.entries(languages).map<Subtitle>(([key, lang]: [string, Language]) => {
            return {lang: lang}
        })

        const f = Object.fromEntries(
            Object.entries(formats)
                .filter(([key, data]) => data.width <= 1920))

        const tr: TranscodingRequest = {
            // imdbId: 'tt1835736',
            imdbId,
            file: torrent.files[0].name,
            subtitles: subs,
            formats: f
        }

        const decodeResult = nip19.decode(botConfig.nsec).data as Uint8Array
        const pubkey = getPublicKey(decodeResult)

        const event = new Nip9999SeederTorrentTransformationRequestEvent(pubkey, 'Sintel', hash, tr)
        const {dss, pub} = bobNostrCommunityServiceClient.request(event)

        dss.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
            const resp = Nip9999SeederTorrentTransformationResponseEvent.buildFromEvent(event)
            console.log(resp)
        })
    })
})
