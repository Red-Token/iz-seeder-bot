import {BotConfig} from '../../src/config.js'
import {TranscodingService} from '../../src/service/TranscodingService.js'

describe('Register Bot Test', () => {
    before(async () => {
    })

    it('should be cool to', async () => {
        const cfg = new BotConfig()
        const ts: TranscodingService = await TranscodingService.create(cfg)
        await ts.register(cfg.profile, [cfg.comRelay])
    })

    after(async () => {
    })
})
