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
import {NostrCommunityService} from "./test/nostrCommunityService.js";
import {Nip9999SeederTorrentTransformationRequestEvent} from "./test/Nip9999SeederControllEvents.js";
import WebTorrent from "webtorrent";
import SimplePeer from "simple-peer";

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
    }
});


setContext({
    net: getDefaultNetContext(),
    app: getDefaultAppContext()
});

const url = 'wss://relay.stream.labs.h3.se';
const relays = [normalizeRelayUrl(url)];

const aliceNSec = 'nsec18c4t7czha7g7p9cm05ve4gqx9cmp9w2x6c06y6l4m52jrry9xp7sl2su9x'
const aliceSignerData: SignerData = {type: SignerType.NIP01, nsec: aliceNSec}

// const bobNSec = 'nsec1zsp48upz3vd64lwhx7me8utrxyfxuzdwvxhfld2q0ehs0ya9mlxs47v64q';
// const bobSignerData: SignerData = {type: SignerType.NIP01, nsec: bobNSec};

console.log("aliceSignerData", aliceSignerData);

const community = new Community('iz-stream', relays, 'https://img.freepik.com/free-psd/close-up-delicious-apple_23-2151868338.jpg')
const ci = new CommunityIdentity(community, await asyncCreateWelshmanSession(aliceSignerData))

const ncs = new NostrCommunityService(community, ci)

ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
    console.log(event)

    if (event.kind === Nip9999SeederTorrentTransformationRequestEvent.KIND) {
        const req = Nip9999SeederTorrentTransformationRequestEvent.build(event)

        const torrent = wt.seed(req.x, options)

        torrent.on('download', (bytes) => {
            console.log(bytes)
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
    }
})
