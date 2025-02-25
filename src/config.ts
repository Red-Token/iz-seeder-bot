import {readFileSync} from 'node:fs'
import {normalizeRelayUrl} from '@welshman/util'

export class BotConfig {
    public readonly nsec: string
    public readonly communityPubkey: string
    public readonly comRelay: string[]
    public readonly uploadDir: string
    public readonly transcodingDir: string
    public readonly seedingDir: string

    constructor() {
        const config = readFileSync('./config.json', 'utf8')
        const parsed = JSON.parse(config)

        if (typeof parsed.nsec !== 'string') {
            throw new Error('nsec must be a string')
        }
        this.nsec = parsed.nsec

        if (typeof parsed.communityPubkey !== 'string') {
            throw new Error('communityPubkey must be a string')
        }
        this.communityPubkey = parsed.communityPubkey

        if (Array.isArray(parsed.comRelay)) {
            if (parsed.comRelay.length === 0) {
                throw new Error('comRelay array must not be empty')
            }
            this.comRelay = parsed.comRelay.map((relay: unknown) => {
                if (typeof relay !== 'string') {
                    throw new Error('Each comRelay element must be a string')
                }
                return normalizeRelayUrl(relay)
            })
        } else if (typeof parsed.comRelay === 'string') {
            this.comRelay = [normalizeRelayUrl(parsed.comRelay)]
        } else {
            throw new Error('comRelay must be a string or an array of strings')
        }

        this.uploadDir = typeof parsed.uploadDir === 'string' ? parsed.uploadDir : '/tmp/iz-seeder-bot/upload'
        this.transcodingDir =
            typeof parsed.transcodingDir === 'string' ? parsed.transcodingDir : '/tmp/iz-seeder-bot/transcoding'
        this.seedingDir = typeof parsed.seedingDir === 'string' ? parsed.seedingDir : '/var/tmp/iz-seeder-bot/seeding'
    }
}
