import {normalizeRelayUrl} from "@welshman/util";

const url = 'wss://relay.lxc';

export class BotConfig {
    comRelay = [normalizeRelayUrl(url)]
    nsec = 'nsec1p5p9ax0uftre04ewgxntkca4jurj2zlhjed46nwr22xs652vgtss84jeep'
    communityPubkey = '76e75c0c50ce7ef714b76eaf06d6a06a29d296d5bb86270818675a669938dbe2'
    uploadDir = '/tmp/iz-seeder-bot/upload'
    transcodingDir = '/tmp/iz-seeder-bot/transcoding'
    seedingDir = '/var/tmp/iz-seeder-bot/seeding'
}
