import WebTorrent from 'webtorrent'
import SimplePeer from 'simple-peer'

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

export const wt = new WebTorrent({
    tracker: {
        rtcConfig: {
            ...SimplePeer.config,
            ...rtcConfig
        }
    }
})
