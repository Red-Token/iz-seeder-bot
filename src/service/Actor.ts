import {DynamicPublisher, SignerData, SignerType} from '@nostream/sdk/ses'
import {asyncCreateWelshmanSession, GlobalNostrContext, Identifier, Identity} from '@nostream/sdk/communities'
import {Nip01UserMetaDataEvent, NostrUserProfileMetaData, UserType} from '@nostream/sdk/nip01'
import {Nip65RelayListMetadataEvent} from '@nostream/sdk/nip65'

export class Actor {
    private _gdp: DynamicPublisher
    public identity: Identity

    static async asyncCreateParams(nsec: string, globalRelays: string[]) {
        const gnc = new GlobalNostrContext(globalRelays)
        const signerData: SignerData = {type: SignerType.NIP01, nsec: nsec}
        const id = new Identifier(await asyncCreateWelshmanSession(signerData))
        return {id, gnc}
    }

    static async asyncCreate(nsec: string, globalRelays: string[]) {
        const {id, gnc} = await Actor.asyncCreateParams(nsec, globalRelays)
        return new Actor(id, gnc)
    }

    constructor(identifier: Identifier, public globalNostrContext: GlobalNostrContext) {
        this.identity = new Identity(globalNostrContext, identifier)
        this._gdp = new DynamicPublisher(globalNostrContext.profileService, this.identity)
    }

    updateProfile(metadata: NostrUserProfileMetaData, type = UserType.INDIVIDUAL, capabilities: string[][] = []) {
        const metaDataEvent = new Nip01UserMetaDataEvent(metadata, type, capabilities)
        this._gdp.publish(metaDataEvent)
    }

    updateRelayList(relayList: string[][]) {
        const relayListEvent = new Nip65RelayListMetadataEvent(relayList)
        this._gdp.publish(relayListEvent)
    }
}
