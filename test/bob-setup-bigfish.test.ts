import SimplePeer from 'simple-peer'
import WebTorrent, {Torrent} from 'webtorrent'
// import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {nip19} from 'nostr-tools'
import {BotConfig} from '../src/config.js'
// import {SignerData} from "iz-nostrlib/src/org/nostr/ses/SynchronisedSession";
import {SignerType} from 'iz-nostrlib/ses'
import {Subtitle, TranscodingBot, TranscodingRequest} from '../src/bot/TranscodingBot.js'
import {Language, languages} from '../src/util/SubtitleConverter.js'
import {formats} from '../src/util/VideoConverter.js'
import {Nip9999SeederTorrentTransformationRequestEvent, NostrCommunityServiceBot, NostrCommunityServiceClient} from 'iz-nostrlib/seederbot'
import {DynamicPublisher} from 'iz-nostrlib/ses'
import {DynamicSynchronisedSession} from 'iz-nostrlib/ses'
import {CommunityNostrContext} from 'iz-nostrlib/communities'
import {GlobalNostrContext} from 'iz-nostrlib/communities'
import {Identity} from 'iz-nostrlib/communities'
import {asyncCreateWelshmanSession, Identifier} from 'iz-nostrlib/communities'
import {EventType} from 'iz-nostrlib'
import {normalizeRelayUrl, TrustedEvent} from '@red-token/welshman/util'
import {RequestStateProgressTracker} from '../src/util/util.js'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'
import fs from 'node:fs'
import {Client} from 'ssh2'
import {Nip01UserMetaDataEvent, NostrUserProfileMetaData, UserType} from 'iz-nostrlib/nip01'
import {expect} from 'chai'
import {Nip65RelayListMetadataEvent} from 'iz-nostrlib/nip65'


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
    before(async () => {
        const ssh = new Client()

        await new Promise((resolve) => {
            ssh.on('ready', async () => {
                for (const path of ['relay.lxc', 'relay.bf.lxc'])
                    await new Promise((resolve) => {
                        ssh.exec(`cd /var/tmp/strfry/${path}; ../bin/strfry delete --age 0`, (err, stream) => {
                            if (err) throw err
                            stream
                                .on('close', () => {
                                    console.log('✅ Command Executed')
                                    resolve(true)
                                })
                                .on('data', (data: any) => {
                                    console.log('📄 Output:', data.toString())
                                })
                                .stderr.on('data', (data) => {
                                console.error('❌ Error:', data.toString())
                            })
                        })
                    })

                ssh.end() // Close SSH connection
                resolve(true)
            }).connect({
                host: 'relay.lxc',
                port: 22,
                username: 'root',
                privateKey: fs.readFileSync('test/data/.ssh/id')
            })
        })
        console.log('before')
    })

    it('SetUp BigFish', async () => {
        // const url = 'wss://relay.stream.labs.h3.se';
        // const relays = [normalizeRelayUrl(url)];
        setContext({
            net: getDefaultNetContext(),
            app: getDefaultAppContext()
        });

        const url = 'wss://relay.lxc'
        // const url = 'wss://relay.bf.lxc'
        const relays = [normalizeRelayUrl(url)]

        // Set up Alice
        const aliceNSec = 'nsec18c4t7czha7g7p9cm05ve4gqx9cmp9w2x6c06y6l4m52jrry9xp7sl2su9x'
        const aliceSignerData: SignerData = {type: SignerType.NIP01, nsec: aliceNSec}
        const aliceWSessionData = await asyncCreateWelshmanSession(aliceSignerData)
        const aliceIdentifier = new Identifier(aliceWSessionData)

        const aliceGlobalNostrContext = new GlobalNostrContext(relays)
        const aliceIdentity = new Identity(aliceGlobalNostrContext, aliceIdentifier)
        const aliceGlobalDynamicPublisher = new DynamicPublisher(aliceGlobalNostrContext.profileService, aliceIdentity)

        // Update Alice profile
        const aliceMetaDataEvent = new Nip01UserMetaDataEvent(
            new NostrUserProfileMetaData('Alice', 'The Queen of Tests', 'alice.jpg')
        )
        aliceGlobalDynamicPublisher.publish(aliceMetaDataEvent)

        await wait(2000)
        // // Verify that stuff work
        const readProfile = aliceGlobalNostrContext.profileService.nip01Map.value.get(aliceIdentity.pubkey)
        expect(readProfile).to.not.be.null

        //Publish Alice Relays
        const aliceRelayList = new Nip65RelayListMetadataEvent(
            relays.map((relay) => {
                return [relay]
            })
        )
        aliceGlobalDynamicPublisher.publish(aliceRelayList)
        await wait(2000)
        const rl = aliceGlobalNostrContext.profileService.nip65Map.value.get(aliceIdentity.pubkey)

        // expect(aliceRelayList.relays).to.be.equal(rl?.relays)
        expect(rl).to.not.be.null
        expect(rl?.relays.length).to.be.greaterThanOrEqual(1)

        // let's create big Fish
        const bigFishNSec = 'nsec16lc2cn2gzgf3vcv20lwkqquprqujpkq9pj0wcxmnw8scxh6j0yrqlc9ae0'
        const bigFishSignerData: SignerData = {type: SignerType.NIP01, nsec: bigFishNSec}
        const bigFishGlobalNostrContext = new GlobalNostrContext(relays)
        const bigFishIdentity = new Identity(
            bigFishGlobalNostrContext,
            new Identifier(await asyncCreateWelshmanSession(bigFishSignerData))
        )
        const bigFishGlobalDynamicPublisher = new DynamicPublisher(
            bigFishGlobalNostrContext.profileService,
            bigFishIdentity
        )

        const bigFishMetaDataEvent = new Nip01UserMetaDataEvent(
            new NostrUserProfileMetaData('Big Fish', 'A fishing community in Michigan'),
            UserType.COMMUNITY,
            [['nip29'], ['nip35'], ['nip71']]
        )
        bigFishGlobalDynamicPublisher.publish(bigFishMetaDataEvent)

        await wait(2000)

        const bigFishReadProfileAlice = aliceGlobalNostrContext.profileService.nip01Map.value.get(
            bigFishIdentity.pubkey
        )

        // const bigFishReadProfileBigFish = bigFishGlobalNostrContext.profileService.nip01Map.value.get(
        //     bigFishIdentity.pubkey
        // )

        const bigFishRelays = [normalizeRelayUrl('wss://relay.bf.lxc')]
        const nip65RelayListMetadataEvent = new Nip65RelayListMetadataEvent([bigFishRelays])
        bigFishGlobalDynamicPublisher.publish(nip65RelayListMetadataEvent)

        await wait(2000)

        const aliceViewOfNip01 = aliceGlobalNostrContext.profileService.nip01Map.value.get(bigFishIdentity.pubkey)
        const aliceViewOfNip65 = aliceGlobalNostrContext.profileService.nip65Map.value.get(bigFishIdentity.pubkey)

        expect(aliceViewOfNip65).to.not.be.undefined
        if (aliceViewOfNip65 === undefined) throw Error('')

        // Alice joins Big Fish and publishes a video of her fishing

        // First she updates her appdata

        const aliceBigFishCommunityContext = new CommunityNostrContext(bigFishIdentity.pubkey, aliceGlobalNostrContext)
        const aliceBigFishIdentity = new Identity(aliceBigFishCommunityContext, aliceIdentifier)

        // // Alice creates a profile over at BigFish
        // aliceBigFishIdentity.publisher.publish(new Nip01UserMetaDataEvent(new NostrUserProfileMetaData('Alice the great fisher')))

        await wait(2000)
    })

})
