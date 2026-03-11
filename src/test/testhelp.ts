import {Client} from 'ssh2'
import fs from 'node:fs'
import {Nip01UserMetaDataEvent, NostrUserProfileMetaData, UserType} from 'iz-nostrlib/nip01'
import {Actor} from '../service/Actor.js'
import {expect} from 'chai'
import {DynamicPublisher, SignerData, SignerType} from 'iz-nostrlib/ses'
import {asyncCreateWelshmanSession, GlobalNostrContext, Identifier, Identity} from 'iz-nostrlib/communities'
import {Nip65RelayListMetadataEvent} from 'iz-nostrlib/nip65'
import {BotConfig} from '../config.js'
import {TranscodingService} from '../service/TranscodingService.js'
import {normalizeRelayUrl} from '@red-token/welshman/util'
import {wait} from '../util/util.js'

const url = 'wss://relay.lxc'
const globalRelays = [normalizeRelayUrl(url)]

export async function resetRelays() {
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
}

export async function createIndividual(nsec: string, metadata: NostrUserProfileMetaData) {
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

export async function createService(nsec: string, metaData: NostrUserProfileMetaData) {
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
    return await createIndividual(nsec, metaData)
}

export async function createWonderland() {
    const nsec = 'nsec1z9t0mdgv0ku3ysstwvv0p77tj77e9xchdyj88sdj9auzze534sesqy3t26'
    const metaData = new NostrUserProfileMetaData('Wonderland', 'The best place to have tea')
    const relays = [normalizeRelayUrl('wss://relay.wl.lxc')]
    return await createCommunity(nsec, metaData, relays)
}

export async function createTranscodingBot() {
    const nsec = 'nsec17c0r3dwpf22vf6gw4qzldneqj9caukgs7ugea8qdsljsx3ulrm9s2kn0sc'
    const metaData = new NostrUserProfileMetaData('TranscodingBot', 'Transcoder of the arts', 'bob.jpg')
    return await createService(nsec, metaData)
}

