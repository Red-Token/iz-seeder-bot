import {DynamicPublisher} from 'iz-nostrlib/ses'
import {Nip9999SeederTorrentTransformationResponseEvent} from 'iz-nostrlib/seederbot'
import {Torrent} from 'webtorrent'


export async function waitForInfoHash(torrent: Torrent): Promise<string> {
    return new Promise((resolve, reject) => {
        if (torrent.infoHash !== undefined && torrent.infoHash !== null) {
            resolve(torrent.infoHash)
        }

        torrent.on('infoHash', () => {
            resolve(torrent.infoHash)
        })

        torrent.on('error', (err) => {
            reject(err)
        })
    })
}

export async function wait(time: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

type RequestState = {
    state: string,
    seq: number,
    total: number,
    progress: number,
    message: string,
    final: boolean,
}

export type RequestStateUpdate = {
    state?: string,
    seq?: number,
    total?: number,
    progress?: number,
    message?: string,
    final?: boolean,
}


export class RequestStateProgressTracker {
    private _requestState: RequestState = {state: '', seq: 0, message: '', total: 0, final: false, progress: 0}

    constructor(
        private readonly id: string,
        private readonly publisher: DynamicPublisher
    ) {
    }

    set requestState(state: RequestState) {
        this._requestState = state
        this.report()
    }

    update(update: RequestStateUpdate, tags: string[][] = []) {
        this._requestState = {...this._requestState, ...update}
        this.report(tags)
    }

    private report(tags: string[][] = []) {
        const e2 = new Nip9999SeederTorrentTransformationResponseEvent(this._requestState, this.id, tags)
        this.publisher.publish(e2)
    }
}
