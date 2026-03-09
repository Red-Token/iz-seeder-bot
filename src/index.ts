import {BotConfig} from './config.js'
import {setContext} from '@red-token/welshman/lib'
import {getDefaultAppContext, getDefaultNetContext} from '@red-token/welshman/app'
import {TranscodingService} from './service/TranscodingService.js'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function log(message: string, data?: unknown) {
    if (data === undefined) {
        console.info(`[seeder-bot] ${message}`)
        return
    }

    console.info(`[seeder-bot] ${message}`, data)
}

try {
    log('starting bot process')

    const botConfig = new BotConfig()
    log('config loaded', {
        comRelay: botConfig.comRelay,
        globalRelay: botConfig.globalRelay,
        trackerAnnounce: botConfig.trackerAnnounce,
        communityPubkey: botConfig.communityPubkey,
        uploadDir: botConfig.uploadDir,
        transcodingDir: botConfig.transcodingDir,
        seedingDir: botConfig.seedingDir
    })

    setContext({
        net: getDefaultNetContext(),
        app: getDefaultAppContext()
    })
    log('welshman context initialized')

    const ts = await TranscodingService.create(botConfig)
    log('transcoding service created')

    await ts.register(botConfig.profile, [botConfig.comRelay])
    log('service profile/relay registration published')

    await ts.bot.loadTorrents()
    log('existing seeding torrents loaded')

    log('bot is ready and waiting for transformation requests')
} catch (error) {
    console.error('[seeder-bot] fatal startup error', error)
    process.exit(1)
}
