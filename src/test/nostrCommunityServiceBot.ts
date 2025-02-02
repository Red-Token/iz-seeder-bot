import {EventType, Publisher, Subscription, SynchronisedSession} from "iz-nostrlib";
import {Community, CommunityIdentity} from "iz-nostrlib/dist/org/nostr/communities/Community";
import {TrustedEvent} from "@welshman/util";
import {
    Nip9999SeederTorrentTransformationRequestEvent,
    Nip9999SeederTorrentTransformationResponseEvent
} from "./Nip9999SeederControllEvents";

export class NostrCommunityServiceBot {
    public session: SynchronisedSession
    public subscriptions: Subscription[] = []
    public publisher: Publisher;

    constructor(public community: Community, public communityIdentity: CommunityIdentity) {
        this.session = new SynchronisedSession(community.relays)

        const nowInSeconds = Math.floor(Date.now() / 1000);

        for (const relay of community.relays) {
            const sub = new Subscription(
                this.session,
                [
                    {
                        kinds: [Nip9999SeederTorrentTransformationRequestEvent.KIND],
                        since: nowInSeconds,
                        // authors: [page.params.pubkey]
                    }
                ],
                [relay]
            );

            this.subscriptions.push(sub)
        }

        this.publisher = new Publisher(this.session, communityIdentity)

        // this.session.eventStream.emitter.on(EventType.DISCOVERED, (event: TrustedEvent) => {
        // })
    }
}
