import {generateSecretKey, getPublicKey, nip19} from 'nostr-tools'

const sk = generateSecretKey()

const nsec = nip19.nsecEncode(sk)
const pk = getPublicKey(sk)
const npub = nip19.npubEncode(pk)

console.log(nsec)
console.log(pk)
console.log(npub)
