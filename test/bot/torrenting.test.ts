import {TranscodingBot} from '../../src/bot/TranscodingBot.js'
import {BotConfig} from '../../src/config.js'
import {wt} from '../../src/wt/IZWebTorrent.js'

describe('Torrenting Test', () => {
    before(async () => {
    })

    it('should be cool to', async () => {
        const cfg = new BotConfig()
        const bot: TranscodingBot = new TranscodingBot(cfg, wt)
        await bot.loadTorrents()
    })

    after(async () => {
    })
})
