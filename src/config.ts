import fs, {readFileSync} from 'node:fs'
import {normalizeRelayUrl} from '@red-token/welshman/util'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

export class BotConfig {
    public readonly nsec: string
    public readonly communityPubkey: string
    public readonly comRelay: string[]
    public readonly botDir: string
    public readonly uploadDir: string
    public readonly transcodingDir: string
    public readonly seedingDir: string
    public readonly globalRelay: string[]

    constructor() {

        const alternativeConfigFileNames = ['config.devel.json', 'config.json', 'config.default.json']

        const confFile = alternativeConfigFileNames
            .find(fullFileName => fs.existsSync(fullFileName))

        if (!confFile) {
            throw new ReferenceError('conf file not found')
        }

        const config = readFileSync(confFile, 'utf8')
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

        if (Array.isArray(parsed.globalRelay)) {
            if (parsed.globalRelay.length === 0) {
                throw new Error('comRelay array must not be empty')
            }
            this.globalRelay = parsed.globalRelay.map((relay: unknown) => {
                if (typeof relay !== 'string') {
                    throw new Error('Each comRelay element must be a string')
                }
                return normalizeRelayUrl(relay)
            })
        } else if (typeof parsed.globalRelay === 'string') {
            this.globalRelay = [normalizeRelayUrl(parsed.globalRelay)]
        } else {
            throw new Error('comRelay must be a string or an array of strings')
        }

        this.botDir = typeof parsed.botDir === 'string' ? parsed.botDir : '/tmp/iz-seeder-bot'
        this.uploadDir = typeof parsed.uploadDir === 'string' ? parsed.uploadDir : '/tmp/iz-seeder-bot/upload'
        this.transcodingDir =
            typeof parsed.transcodingDir === 'string' ? parsed.transcodingDir : '/tmp/iz-seeder-bot/transcoding'
        this.seedingDir = typeof parsed.seedingDir === 'string' ? parsed.seedingDir : '/var/tmp/iz-seeder-bot/seeding'
    }
}
