import {AbstractNipMiniEvent, safeFindSingleTagValue} from "iz-nostrlib/dist/org/nostr/AbstractNipEvent";
import {HashedEvent, TrustedEvent} from "@welshman/util";

export class Nip9999SeederTorrentTransformationRequestEvent extends AbstractNipMiniEvent {
    static KIND: number = 9999;

    static build(event: HashedEvent) {
        return new Nip9999SeederTorrentTransformationRequestEvent(
            safeFindSingleTagValue(event, 'title'),
            safeFindSingleTagValue(event, 'x'),
            JSON.parse(event.content),
            [],
            event
        )
    }

    constructor(
        public title: string,
        public x: string,
        public content: any,
        tags: string[][] = [],
        event?: TrustedEvent) {
        super(tags, event);
    }

    createTemplate() {
        const tags = [
            ...this.tags,
            ['title', this.title],
            ['x', this.x],
        ];

        return {
            content: JSON.stringify(this.content),
            tags
        }
    }
}

export class Nip9999SeederTorrentTransformationResponseEvent extends AbstractNipMiniEvent {
    static KIND: number = 9998;

    static build(event: HashedEvent) {
        return new Nip9999SeederTorrentTransformationResponseEvent(
            JSON.parse(event.content),
            safeFindSingleTagValue(event, 'd'),
            [],
            event
        )
    }

    constructor(public state: any, public id: string, tags: string[][] = [], event?: TrustedEvent) {
        super([...tags], event);
    }

    createTemplate() {
        const tags = [
            ...this.tags,
            ['e', this.id, '', 'root'],
            ['d', this.id],
        ];

        return {
            content: JSON.stringify(this.state),
            tags
        }
    }
}
