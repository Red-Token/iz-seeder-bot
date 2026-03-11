import {generateSecretKey, getPublicKey, nip19} from "nostr-tools";

describe('MyTest', () => {
    before(function () {
    });

    it('Lets upload something', async () => {
        const secKey = generateSecretKey()
        const nsec = nip19.nsecEncode(secKey)
        console.log(nsec)

        const bigFishNSec = 'nsec16lc2cn2gzgf3vcv20lwkqquprqujpkq9pj0wcxmnw8scxh6j0yrqlc9ae0';
        const decodedNSec = nip19.decode(bigFishNSec)
        const bigFishPubKey = getPublicKey(decodedNSec.data);
        console.log(bigFishPubKey)
    })
})
