import {BotConfig} from '../src/config.js'
import {TranscodingService} from '../src/service/TranscodingService.js'
import {createAlice, createBob, createWonderland, resetRelays} from '../src/test/testhelp.js'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'
import {Actor} from '../src/service/Actor.js'
import {getTorrentHash, wait} from '../src/util/util.js'
import {expect} from 'chai'
import {UserType} from '@nostream/sdk/nip01'
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent,
    NostrCommunityServiceClient
} from '@nostream/sdk/seederbot'
import {CommunityNostrContext} from '@nostream/sdk/communities'
import WebTorrent from 'webtorrent'
import SimplePeer from 'simple-peer'
import {EventType} from '@nostream/sdk'
import {TrustedEvent} from '@red-token/welshman/util'
import {Language, languages} from '../src/util/SubtitleConverter.js'
import {Subtitle, TranscodingRequest} from '../src/bot/TranscodingBot.js'
import {formats} from '../src/util/VideoConverter.js'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
})


describe('Register Bot Test', () => {
    const cfg = new BotConfig(['config.test.json'])

    let alice: Actor
    let bob: Actor
    let wonderland

    before(async () => {
        console.log('before-xxx')
        //reset the relay
        await resetRelays()

        alice = await createAlice()
        bob = await createBob()
        wonderland = await createWonderland()
        // await createTranscodingBot()

    })

    it('Start the bot an register as a Service', async () => {
        const ts: TranscodingService = await TranscodingService.create(cfg)
        await ts.register(cfg.profile, [cfg.comRelay])

        await wait(2000)

        // Check that we have 4 entries registered and that the service is one of them
        expect(alice.globalNostrContext.profileService.nip01Map.value.size).to.equal(4)

        const regEnt = alice.globalNostrContext.profileService.nip01Map.value.get(ts.identity.pubkey)
        expect(regEnt).to.not.be.undefined
        expect(regEnt?.type).to.equal(UserType.SERVICE)

        await ts.bot.loadTorrents()

        // We need a bob client here
        const bobCommunityNosterContext = new CommunityNostrContext(cfg.communityPubkey, bob.globalNostrContext)
        const bobNostrCommunityServiceClient = new NostrCommunityServiceClient(bobCommunityNosterContext, bob.identity)

        // Start the test
        const origFile = '/tmp/tbs01e08.mkv'
        const imdbId = 'tt1755990'

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

        const req = new Nip9999SeederTorrentTransformationRequestEvent(ts.identity.pubkey, 'The Borgias XXXX', hash, tr)
        const {dss, pub} = bobNostrCommunityServiceClient.request(req)

        await new Promise((resolve, reject) => {
            dss.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
                const resp = Nip9999SeederTorrentTransformationResponseEvent.buildFromEvent(event)
                // console.log(resp)

                if (resp.state.final === true)
                    resolve(true)
            })
        })
    })

    after(async () => {
    })
})
