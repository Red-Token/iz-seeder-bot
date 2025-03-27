import {DynamicPublisher} from 'iz-nostrlib/ses'
import {Nip9999SeederTorrentTransformationResponseEvent} from 'iz-nostrlib/seederbot'

export class RequestStateProgressTracker {
    constructor(
        private readonly id: string,
        private readonly publisher: DynamicPublisher
    ) {
    }

    updateState(state: any, tags: string[][] = []) {
        const e2 = new Nip9999SeederTorrentTransformationResponseEvent(state, this.id, tags)
        this.publisher.publish(e2)
    }
}
