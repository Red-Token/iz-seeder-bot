// import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
// import {SignerData} from "iz-nostrlib/src/org/nostr/ses/SynchronisedSession";
import {DynamicPublisher, SignerType} from 'iz-nostrlib/ses'
import {asyncCreateWelshmanSession, GlobalNostrContext, Identifier, Identity} from 'iz-nostrlib/communities'
import {normalizeRelayUrl, TrustedEvent} from '@red-token/welshman/util'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'
import fs from 'node:fs'
import {Client} from 'ssh2'
import {Nip01UserMetaDataEvent, NostrUserProfileMetaData, UserType} from 'iz-nostrlib/nip01'
import {expect} from 'chai'
import {Nip65RelayListMetadataEvent} from 'iz-nostrlib/nip65'
import {TranscodingService} from '../src/service/TranscodingService.js'
import {BotConfig} from '../src/config.js'
import {Actor} from '../src/service/Actor.js'
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent,
    NostrCommunityServiceClient
} from 'iz-nostrlib/seederbot'
import {Language, languages} from '../src/util/SubtitleConverter.js'
import {Subtitle, TranscodingRequest} from '../src/bot/TranscodingBot.js'
import {formats} from '../src/util/VideoConverter.js'
import {getPublicKey, nip19} from 'nostr-tools'
import {EventType} from 'iz-nostrlib'
import {wt} from '../src/wt/IZWebTorrent.js'
import {Torrent} from 'webtorrent'


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

// TODO FIX THIS
// export class BotConfig {
//     comRelay = [url]
//     nsec: string = 'nsec1p5p9ax0uftre04ewgxntkca4jurj2zlhjed46nwr22xs652vgtss84jeep'
//     communityPubkey = '76e75c0c50ce7ef714b76eaf06d6a06a29d296d5bb86270818675a669938dbe2'
//     uploadDir = '/tmp/iz-seeder-bot/upload'
//     transcodingDir = '/tmp/iz-seeder-bot/transcoding'
//     seedingDir = '/var/tmp/iz-seeder-bot/seeding'
// }

export async function wait(time: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
})

const url = 'wss://relay.lxc'
const globalRelays = [normalizeRelayUrl(url)]

async function createIndividual(nsec: string, metadata: NostrUserProfileMetaData) {
    const actor: Actor = await Actor.asyncCreate(nsec, globalRelays)

    // Update Alice profile
    actor.updateProfile(metadata)

    // const metaDataEvent = new Nip01UserMetaDataEvent(metadata)
    // gdp.publish(metaDataEvent)

    await wait(2000)
    // Verify that stuff work
    const readProfile = actor.globalNostrContext.profileService.nip01Map.value.get(actor.identity.pubkey)
    expect(readProfile).to.not.be.null

    //Publish Relays
    const relayList = globalRelays.map((relay) => [relay])
    actor.updateRelayList(relayList)

    await wait(2000)
    const rl = actor.globalNostrContext.profileService.nip65Map.value.get(actor.identity.pubkey)

    // expect(aliceRelayList.relays).to.be.equal(rl?.relays)
    expect(rl).to.not.be.null
    expect(rl?.relays.length).to.be.greaterThanOrEqual(1)

    return actor
}

async function createCommunity(nsec: string, metadata: NostrUserProfileMetaData, relays: string[], nips: string[][] = [['nip29'], ['nip35'], ['nip71']]) {
    const signerData: SignerData = {type: SignerType.NIP01, nsec: nsec}
    const gnc = new GlobalNostrContext(globalRelays)
    const identity = new Identity(gnc, new Identifier(await asyncCreateWelshmanSession(signerData)))
    const gp = new DynamicPublisher(gnc.profileService, identity)

    // Set up the NIP01
    const metaDataEvent = new Nip01UserMetaDataEvent(
        metadata,
        UserType.COMMUNITY,
        nips
    )

    gp.publish(metaDataEvent)

    await wait(2000)

    const testNip01 = gnc.profileService.nip01Map.value.get(identity.pubkey)
    expect(testNip01).to.not.be.undefined

    // const relays = [normalizeRelayUrl('wss://relay.wl.lxc')]
    const nip65RelayListMetadataEvent = new Nip65RelayListMetadataEvent([relays])
    gp.publish(nip65RelayListMetadataEvent)

    await wait(2000)

    const testNip65 = gnc.profileService.nip65Map.value.get(identity.pubkey)
    expect(testNip65).to.not.be.undefined
}

async function createService(nsec: string, metaData: NostrUserProfileMetaData) {
    const botConfig = new BotConfig()

    const ts = await TranscodingService.create(botConfig)
    await ts.register(botConfig.profile, [botConfig.comRelay])
}

export async function createAlice() {
    const nsec = 'nsec19a88crzrxu2hz5qcl76vwdz3c0ygmamfvdc8y5cnyffuvyuzs9fskjkgxl'
    const metaData = new NostrUserProfileMetaData('Alice', 'The Queen of Tests', 'alice.jpg')
    return await createIndividual(nsec, metaData)
}

export async function createBob() {
    const nsec = 'nsec1pumghgtac5vt0y9z0wpw0uccjeaz3gdpasew389p7uqff9nkzlusqpv9ef'
    const metaData = new NostrUserProfileMetaData('Bob', 'The King of Tests', 'bob.jpg')
    await createIndividual(nsec, metaData)
}

export async function createWonderland() {
    const nsec = 'nsec1z9t0mdgv0ku3ysstwvv0p77tj77e9xchdyj88sdj9auzze534sesqy3t26'
    const metaData = new NostrUserProfileMetaData('Wonderland', 'The best place to have tea')
    const relays = [normalizeRelayUrl('wss://relay.wl.lxc')]
    await createCommunity(nsec, metaData, relays)
}

export async function createTranscodingBot() {
    const nsec = 'nsec17c0r3dwpf22vf6gw4qzldneqj9caukgs7ugea8qdsljsx3ulrm9s2kn0sc'
    const metaData = new NostrUserProfileMetaData('TranscodingBot', 'Transcoder of the arts', 'bob.jpg')
    return await createService(nsec, metaData)
}

async function getTorrentHash(torrent: Torrent): Promise<string> {
    return new Promise(resolve => {
        if (torrent.infoHash !== undefined) resolve(torrent.infoHash)

        torrent.on('infoHash', () => {
            resolve(torrent.infoHash)
        })
    })
}

describe('Setup tests', () => {

    before(async () => {
        const ssh = new Client()

        await new Promise((resolve) => {
            ssh.on('ready', async () => {
                for (const path of ['relay.lxc', 'relay.wl.lxc'])
                    await new Promise((resolve) => {
                        ssh.exec(`cd /var/tmp/strfry/${path}; ../bin/strfry delete --age 0`, (err, stream) => {
                            if (err) throw err
                            stream.on('close', () => {
                                console.log('✅ Command Executed')
                                resolve(true)
                            }).on('data', (data: any) => {
                                console.log('📄 Output:', data.toString())
                            }).stderr.on('data', (data) => {
                                console.log('❌ Stderr:', data.toString())
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

    it('SetUp Alice', async function() {
        this.timeout(10000)
        await createAlice()
    })

    it('SetUp Bob', async function() {
        this.timeout(10000)
        await createBob()
    })

    it('SetUp Wonderland', async function() {
        this.timeout(10000)
        await createWonderland()
        // let's create Wonderland
    })

    it('SetUp Bot', async function() {
        this.timeout(10000)
        await createTranscodingBot()
    })

    it('See if Alice can see Bot', async function() {
        this.timeout(10000)
        const alice = await createAlice()

        const [key, profile] = alice.globalNostrContext.profileService.nip01Map.value.entries()
            .find(([, event]) => event.type === UserType.SERVICE) ?? [undefined, undefined]

        expect(key).to.not.be.undefined
        expect(profile).to.not.be.undefined
    })

    it('Transcode and asset', async function() {
        this.timeout(100000)
        const alice = await createAlice()


        const botConfig = new BotConfig()
        const ts = await TranscodingService.create(botConfig)

        const [key, profile] = alice.globalNostrContext.profileService.nip01Map.value.entries()
            .find(([, event]) => event.type === UserType.SERVICE) ?? [undefined, undefined]

        expect(key).to.not.be.undefined
        expect(profile).to.not.be.undefined

        const ncsc = new NostrCommunityServiceClient(ts.service.community, alice.identity)

        // Start the test
        const origFile = '/tmp/tbs01e06.mkv'
        const imdbId = 'tt1835736'

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

        const event = new Nip9999SeederTorrentTransformationRequestEvent(pubkey, 'The Borgias XXXX', hash, tr)
        const {dss, pub} = ncsc.request(event)

        dss.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
            const resp = Nip9999SeederTorrentTransformationResponseEvent.buildFromEvent(event)
            console.log(resp)
        })
    })
})
