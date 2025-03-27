import {generateSecretKey, getPublicKey, nip19} from 'nostr-tools'

describe('MyTest2', () => {
    before(function () {
        console.log("MyTest2");
    })

    // NSec nsec1gdraq2julszrgygm5zf7e02rng6jguxmr5uuxy7wnyex9yszkwesrfnu3m
    // NPub npub1kecwpcs0k6m7j6crfyfecqc4p45j5aqrexrqnxs64h6x0k4x0yysrx2y6f
    // PublicKey b670e0e20fb6b7e96b0349139c03150d692a7403c986099a1aadf467daa67909

    it('Lets upload something', async () => {
        // const privateKey = generateSecretKey()
        // const publicKey = getPublicKey(privateKey)
        //
        // console.log("NSec", nip19.nsecEncode(privateKey))
        // console.log("NPub", nip19.npubEncode(publicKey))
        // console.log("PublicKey", publicKey)

        // const relays: string[][] = [['sfff', '2323'], ['sfff2222', '2324444443']]
        const relays: string[][] = []

        const test = relays.map(relay => {
            return ['r', ...relay]
        })

        console.log(test)


    })
})
