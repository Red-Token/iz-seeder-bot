import {
    EventType,
    Nip9999SeederTorrentTransformationRequestEvent, Nip9999SeederTorrentTransformationResponseEvent,
    NostrCommunityServiceClient,
    SignerType
} from "iz-nostrlib";
import SimplePeer from 'simple-peer';
import WebTorrent from 'webtorrent';
import {setContext} from "@welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@welshman/app";
import {asyncCreateWelshmanSession, Identifier, Identity} from "iz-nostrlib/dist/org/nostr/communities/Identity.js";
import {GlobalNostrContext} from "iz-nostrlib/dist/org/nostr/communities/GlobalNostrContext.js";
import {CommunityNostrContext} from "iz-nostrlib/dist/org/nostr/communities/CommunityNostrContext.js";
// import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {getPublicKey, nip19} from "nostr-tools";
// import {BotConfig} from "../src/config";
// import {SignerData} from "iz-nostrlib/src/org/nostr/ses/SynchronisedSession";
import {expect} from "chai";
import {DynamicSynchronisedSession} from "iz-nostrlib/dist/org/nostr/ses/DynamicSynchronisedSession.js";
import {DynamicSubscription} from "iz-nostrlib/dist/org/nostr/ses/DynamicSubscription.js";
import {safeFindOptionalMultiTagValue} from "iz-nostrlib/dist/org/nostr/AbstractNipEvent.js";
import {DynamicPublisher} from "iz-nostrlib/dist/org/nostr/ses/DynamicPublisher.js";
import {Nip35TorrentEvent} from "iz-nostrlib/dist/org/nostr/nip35/Nip35TorrentEvent.js";


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


// TODO FIX THIS
export type SignerData = {
    type: SignerType,
    nsec?: string,
    pubkey?: string,
    relays?: string[],
    rpubkey?: string,
    secret?: string,
}


const url = 'wss://relay.lxc';

// TODO FIX THIS
export class BotConfig {
    comRelay = [url]
    nsec: string = 'nsec1p5p9ax0uftre04ewgxntkca4jurj2zlhjed46nwr22xs652vgtss84jeep'
    communityPubkey = '76e75c0c50ce7ef714b76eaf06d6a06a29d296d5bb86270818675a669938dbe2'
    uploadDir = '/tmp/iz-seeder-bot/upload'
    transcodingDir = '/tmp/iz-seeder-bot/transcoding'
    seedingDir = '/var/tmp/iz-seeder-bot/seeding'
}

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
    }
});


export async function wait(time: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

describe('MyTest', () => {
    before(function () {
    });

    it('Lets upload something', async () => {
        setContext({
            net: getDefaultNetContext(),
            app: getDefaultAppContext()
        });

        // const url = 'wss://relay.stream.labs.h3.se';
        // const relays = [normalizeRelayUrl(url)];

        const bobNSec = 'nsec1zsp48upz3vd64lwhx7me8utrxyfxuzdwvxhfld2q0ehs0ya9mlxs47v64q';
        const bobSignerData: SignerData = {type: SignerType.NIP01, nsec: bobNSec};

        const botConfig = new BotConfig()
        const botSeckey = nip19.decode(botConfig.nsec)

        if (botSeckey.type !== 'nsec')
            throw Error('')

        const botPubkey = getPublicKey(botSeckey.data)

        console.log("bobSignerData", bobSignerData);

        const ws = await asyncCreateWelshmanSession(bobSignerData)
        const bi = new Identifier(ws)

        const gnc = GlobalNostrContext.instance

        const bfNsec = 'nsec16lc2cn2gzgf3vcv20lwkqquprqujpkq9pj0wcxmnw8scxh6j0yrqlc9ae0'
        const bfSeckey = nip19.decode(bfNsec)
        const bfPubkey = getPublicKey(bfSeckey.data)

        console.log(bfPubkey);
        expect(bfPubkey).eq(botConfig.communityPubkey)

        gnc.profileService.nip65Map.value.get(bfPubkey)

        // TODO: This sould work idependend of the world!
        await wait(2000)


        // const bgi = new Identity(gnc, botIdentifier)
        const cnc = new CommunityNostrContext(botConfig.communityPubkey, gnc)
        const cni = new Identity(gnc, bi)
        const ncs = new NostrCommunityServiceClient(cnc, cni)
        const dss = new DynamicSynchronisedSession(cnc.relays)
        const dp = new DynamicPublisher(dss,cni)

        const title = "Big Buck Bunny"

        // ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event) => {
        //     console.log(event)
        // })

        // const file = 'test/data/nn1/orig/nn1.mp4'
        const imdbid = 'tt1254207'
        const file = 'test/data/bbb/orig/bbb_sunflower_2160p_60fps_normal.mp4'

        const torrent = wt.seed(file, options)


        torrent.on('infoHash', () => {
            console.log('infoHash', torrent.infoHash)
            console.log('metadata: ' + torrent.magnetURI);
            const req = new Nip9999SeederTorrentTransformationRequestEvent(botPubkey, title, torrent.infoHash, {transform: 'cool'})
            // const req = new Nip9999SeederTorrentTransformationRequestEvent(botPubkey, "NN1", torrent.infoHash, {transform: 'cool'})
            const {dss, pub} = ncs.request(req)

            dss.eventStream.emitter.on(EventType.DISCOVERED, (event) => {
                console.log("KABOM" + event)
                const obj = JSON.parse(event.content)

                if (obj.final) {
                    const xs: string[] = safeFindOptionalMultiTagValue(event, 'x')
                    console.log(xs)

                    xs.forEach(x => {
                        const ev: Nip35TorrentEvent = new Nip35TorrentEvent(title, x, 'sfsdfsdfsdf',[],[],[`imdb:${imdbid}`] )
                        dp.publish(ev)
                    })

                }
            })


        })

        torrent.on('metadata', () => {
            console.log('metadata: ' + torrent.magnetURI);
        })

        torrent.on('upload', (bytes: number) => {
            // console.log('upload' + bytes)
        })
    })
})
