import {normalizeRelayUrl, TrustedEvent} from "@welshman/util";
import {EventType, Nip9999SeederTorrentTransformationRequestEvent, NostrCommunityServiceClient, SignerData, SignerType} from "iz-nostrlib";

// import {
//     asyncCreateWelshmanSession,
//     Community,
//     CommunityIdentity
// } from "iz-nostrlib/dist/org/nostr/communities/Community";
// import * as SimplePeer from "simple-peer";

import SimplePeer from 'simple-peer';
import WebTorrent from 'webtorrent';
import {
    asyncCreateWelshmanSession,
    Community,
    CommunityIdentity
} from "iz-nostrlib/dist/org/nostr/communities/Community";
import {setContext} from "@welshman/lib";
import {getDefaultAppContext, getDefaultNetContext} from "@welshman/app";

// import {NostrCommunityService} from "../src/test/nostrCommunityService";
// import {Nip9999SeederTorrentTransformationRequestEvent} from "../src/test/Nip9999SeederControllEvents";

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

describe('MyTest', () => {
    before(function () {
    });

    it('Lets upload something', async () => {
        setContext({
            net: getDefaultNetContext(),
            app: getDefaultAppContext()
        });

        const url = 'wss://relay.stream.labs.h3.se';
        const relays = [normalizeRelayUrl(url)];

        const bobNSec = 'nsec1zsp48upz3vd64lwhx7me8utrxyfxuzdwvxhfld2q0ehs0ya9mlxs47v64q';
        const bobSignerData: SignerData = {type: SignerType.NIP01, nsec: bobNSec};

        console.log("bobSignerData", bobSignerData);

        const community = new Community('iz-stream', relays, 'https://img.freepik.com/free-psd/close-up-delicious-apple_23-2151868338.jpg')
        const ci = new CommunityIdentity(community, await asyncCreateWelshmanSession(bobSignerData))

        const ncs = new NostrCommunityServiceClient(community, ci)

        ncs.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
            console.log(event)
        })

        const file = 'test/data/nn1/orig/nn1.mp4'

        const torrent = wt.seed(file, options)

        torrent.on('infoHash', () => {
            console.log('infoHash', torrent.infoHash)
            const req = new Nip9999SeederTorrentTransformationRequestEvent("NN1", torrent.infoHash, {transform: 'cool'})
            ncs.publisher.publish(Nip9999SeederTorrentTransformationRequestEvent.KIND, req.createTemplate())
        })

        torrent.on('upload', (bytes: number) => {
            // console.log('upload' + bytes)
        })
    })
})
