import {BotConfig} from '../../src/config.js'
import {TranscodingService} from '../../src/service/TranscodingService.js'
import {Client} from 'ssh2'
import fs from 'node:fs'
import {createAlice, createBob, createTranscodingBot, createWonderland, resetRelays} from '../../src/test/testhelp.js'

describe('Register Bot Test', () => {
    const cfg = new BotConfig(['config.test.json'])

    before(async () => {
        //reset the relay
        await resetRelays()

        await createAlice()
        await createBob()
        await createWonderland()
        // await createTranscodingBot()
        
    })

    it('should be cool to', async () => {
        const ts: TranscodingService = await TranscodingService.create(cfg)
        await ts.register(cfg.profile, [cfg.comRelay])
    })

    after(async () => {
    })
})
