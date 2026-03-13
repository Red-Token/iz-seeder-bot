import {
    Nip9999SeederTorrentTransformationRequestEvent,
    NostrCommunityServiceBot,
} from '@nostream/sdk/seederbot'
import {
    CommunityNostrContext,
    GlobalNostrContext,
    Identifier,
} from '@nostream/sdk/communities'
import {TranscodingBot} from '../bot/TranscodingBot.js'
import {BotConfig} from '../config.js'
import WebTorrent from 'webtorrent'
import {RequestStateProgressTracker, wait} from '../util/util.js'
import {wt} from '../wt/IZWebTorrent.js'
import {EventType} from '@nostream/sdk'
import {TrustedEvent} from '@red-token/welshman/util'
import {Actor} from './Actor.js'
import {NostrUserProfileMetaData, UserType} from '@nostream/sdk/nip01'

export class TranscodingService extends Actor {
    public bot: TranscodingBot
    public service: NostrCommunityServiceBot

    constructor(identifier: Identifier, public gnc: GlobalNostrContext, community: CommunityNostrContext, botConfig: BotConfig, wt: WebTorrent.Instance) {
        super(identifier, gnc)
        this.bot = new TranscodingBot(botConfig, wt)
        this.service = new NostrCommunityServiceBot(community, this.identity)

        console.info('[seeder-bot] service initialized', {
            identityPubkey: this.identity.pubkey,
            communityRelays: this.service.community.relays.value
        })

        // The event handler
        this.service.session.eventStream.emitter.on(EventType.DISCOVERED, async (event: TrustedEvent) => {
            console.info('[seeder-bot] discovered event', {
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                created_at: event.created_at
            })

            const ne = Nip9999SeederTorrentTransformationRequestEvent.buildFromEvent(event)
            console.info('[seeder-bot] transformation request parsed', {
                requestEventId: event.id,
                title: ne.title,
                torrentHash: ne.x,
                pTag: ne.p
            })

            await this.bot.transcode(ne, new RequestStateProgressTracker(event.id, this.service.publisher))
        })
    }

    static async create(botConfig: BotConfig) {
        const {id, gnc} = await Actor.asyncCreateParams(botConfig.nsec, botConfig.globalRelay)

        console.info('[seeder-bot] actor params created', {
            pubkey: id.pubkey,
            globalRelay: botConfig.globalRelay
        })

        // Wait for the global context to load all the profiles
        await wait(2000)
        const communityNostrContext = new CommunityNostrContext(botConfig.communityPubkey, gnc)

        if (communityNostrContext.relays.value.length === 0) {
            communityNostrContext.relays.value = [...botConfig.comRelay]
            console.info('[seeder-bot] community relays fallback applied from bot config', {
                fallbackRelays: communityNostrContext.relays.value
            })
        }

        console.info('[seeder-bot] community context ready', {
            communityPubkey: botConfig.communityPubkey,
            communityRelays: communityNostrContext.relays.value
        })

        return new TranscodingService(id, gnc, communityNostrContext, botConfig, wt)
    }

    async register(meta: NostrUserProfileMetaData, relays: string[][]) {
        super.updateProfile(meta, UserType.SERVICE, [['nip9999']])
        this.updateRelayList(this.service.community.relays.value.map(r => [r]))

        console.info('[seeder-bot] register invoked', {
            profileName: meta.name,
            relayList: this.service.community.relays.value
        })
    }

    async updateProfile(meta: NostrUserProfileMetaData, type = UserType.SERVICE, capabilities: string[][] = [['nip9999']]) {
        super.updateProfile(meta, type, capabilities)
    }
}
