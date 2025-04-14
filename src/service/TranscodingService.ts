import {
    Nip9999SeederTorrentTransformationRequestEvent,
    NostrCommunityServiceBot,
    NostrCommunityServiceClient
} from 'iz-nostrlib/seederbot'
import {DynamicPublisher, SignerData, SignerType} from 'iz-nostrlib/ses'
import {Nip01UserMetaDataEvent, NostrUserProfileMetaData, UserType} from 'iz-nostrlib/nip01'
import {Nip65RelayListMetadataEvent} from 'iz-nostrlib/nip65'
import {
    asyncCreateWelshmanSession,
    CommunityNostrContext,
    GlobalNostrContext,
    Identifier,
    Identity
} from 'iz-nostrlib/communities'
import {TranscodingBot} from '../bot/TranscodingBot.js'
import {BotConfig} from '../config.js'
import WebTorrent from 'webtorrent'
import {RequestStateProgressTracker, wait} from '../util/util.js'
import {wt} from '../wt/IZWebTorrent.js'
import {EventType} from 'iz-nostrlib'
import {TrustedEvent} from '@red-token/welshman/util'
import {Actor} from './Actor.js'

export class TranscodingService extends Actor {
    public bot: TranscodingBot
    public service: NostrCommunityServiceBot

    constructor(identifier: Identifier, public gnc: GlobalNostrContext, community: CommunityNostrContext, botConfig: BotConfig, wt: WebTorrent.Instance) {
        super(identifier, gnc)
        this.bot = new TranscodingBot(botConfig, wt)
        this.service = new NostrCommunityServiceBot(community, this.identity)

        // The event handler
        this.service.session.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
            const ne = Nip9999SeederTorrentTransformationRequestEvent.buildFromEvent(event)
            await this.bot.transcode(ne, new RequestStateProgressTracker(event.id, this.service.publisher))
        })
    }

    static async create(botConfig: BotConfig) {
        const {id, gnc} = await Actor.asyncCreateParams(botConfig.nsec, botConfig.globalRelay)

        // Wait for the global context to load all the profiles
        await wait(2000)
        const communityNostrContext = new CommunityNostrContext(botConfig.communityPubkey, gnc)

        return new TranscodingService(id, gnc, communityNostrContext, botConfig, wt)
    }

    async register(meta: NostrUserProfileMetaData, relays: string[][]) {
        super.updateProfile(meta, UserType.SERVICE, [['nip9999']])
        this.updateRelayList(this.service.community.relays.value.map(r => [r]))
    }

    async updateProfile(meta: NostrUserProfileMetaData, type = UserType.SERVICE, capabilities: string[][] = [['nip9999']]) {
        super.updateProfile(meta, type, capabilities)
    }

    // YES!!!!!
}
