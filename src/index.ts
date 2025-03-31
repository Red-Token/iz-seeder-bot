import {BotConfig} from './config.js'
import {nip19} from 'nostr-tools'
import WebTorrent, {TorrentOptions} from 'webtorrent'
import SimplePeer from 'simple-peer'
import {TranscodingBot} from './bot/TranscodingBot.js'
import {SignerData, SignerType} from 'iz-nostrlib/ses'
import {
    asyncCreateWelshmanSession,
    CommunityNostrContext,
    GlobalNostrContext,
    Identifier,
    Identity
} from 'iz-nostrlib/communities'
import {Nip9999SeederTorrentTransformationRequestEvent, NostrCommunityServiceBot} from 'iz-nostrlib/seederbot'
import {EventType} from 'iz-nostrlib'
import {TrustedEvent} from '@red-token/welshman/util'
import {RequestStateProgressTracker, wait, waitForInfoHash} from './util/util.js'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'
import fs from 'node:fs'
import path from 'node:path'

const botConfig = new BotConfig()
const botSeckey = nip19.decode(botConfig.nsec)

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

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

if (botSeckey.type !== 'nsec')
    throw Error('')

const wt = new WebTorrent({
    tracker: {
        rtcConfig: {
            ...SimplePeer.config,
            ...rtcConfig
        }
    }
})

setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
})

const globalNostrContext = new GlobalNostrContext(botConfig.globalRelay)

// Wait for the global context to load all the profiles
await wait(2000)

const botSignerData: SignerData = {type: SignerType.NIP01, nsec: botConfig.nsec}
const botWs = await asyncCreateWelshmanSession(botSignerData)
const botIdentifier = new Identifier(botWs)
const botIdentity = new Identity(globalNostrContext, botIdentifier)

const botCommunityNosterContext = new CommunityNostrContext(botConfig.communityPubkey, globalNostrContext)
const nostrCommunityServiceBot = new NostrCommunityServiceBot(botCommunityNosterContext, botIdentity)

const options: TorrentOptions = {
    announce: ['wss://tracker.webtorrent.dev', 'wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com'],
    maxWebConns: 500
}

async function loadTorrent(torrentDir: string): Promise<string> {

    // Check if the dir is empty
    if (fs.readdirSync(torrentDir).length === 0) {
        throw new Error('Empty torrentdir: ' + torrentDir)
    }


    const t = wt.seed(torrentDir, options)

    return waitForInfoHash(t)
}

for (const filename of fs.readdirSync(botConfig.seedingDir)) {
    console.log(`Loading: ${filename}`)
    try {
        const torrentDir = path.join(botConfig.seedingDir, filename)
        const hash = await loadTorrent(torrentDir)

        console.log(`Started seeding: ${filename} as ${hash}`)

    } catch (e) {
        console.error(e)
    }
}

const tb = new TranscodingBot(botConfig, wt)

// The event handler
nostrCommunityServiceBot.session.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
    const ne = Nip9999SeederTorrentTransformationRequestEvent.buildFromEvent(event)
    await tb.transcode(ne, new RequestStateProgressTracker(event.id, nostrCommunityServiceBot.publisher))
})
