// const url = 'wss://relay.lxc';
import {normalizeRelayUrl} from "@red-token/welshman/util";

const gurl = 'wss://relay.pre-alfa.iz-stream.com'
const url = 'wss://relay.big-fish.communities.pre-alfa.iz-stream.com';

// const gurl = 'wss://relay.lxc'
// const url = 'wss://relay.bf.lxc';

export class BotConfig {
    globalRelay = [normalizeRelayUrl(gurl)];
    comRelay = [normalizeRelayUrl(url)]
    nsec = 'nsec1p5p9ax0uftre04ewgxntkca4jurj2zlhjed46nwr22xs652vgtss84jeep'
    communityPubkey = '76e75c0c50ce7ef714b76eaf06d6a06a29d296d5bb86270818675a669938dbe2'
    uploadDir = '/tmp/iz-seeder-bot/upload'
    transcodingDir = '/tmp/iz-seeder-bot/transcoding'
    seedingDir = '/var/tmp/iz-seeder-bot/seeding'
}
