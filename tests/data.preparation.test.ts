import {e2eProvider} from "../src/config";
import {BI} from "@ckb-lumos/bi";
import { randomSecp256k1Account} from "../src/utils";

const accountCharlie = process.env.VITE_ACCOUNT_CHARLIE;
const accountAlice = process.env.VITE_ACCOUNT_ALICE;

if (!accountCharlie || !accountAlice) {
    throw new Error('Missing account information. Please check environment variables.');
}

const CHARLIE = randomSecp256k1Account(accountCharlie);
const ALICE = randomSecp256k1Account(accountAlice);

describe('CKBytes', function () {
    it("should have claimed CKBytes for charlie/alice", async () => {
        await e2eProvider.claimCKB({ claimer: CHARLIE.address, amount: BI.from(1000000 * 10 ** 8) });
        await e2eProvider.claimCKB({ claimer: ALICE.address, amount: BI.from(1000000 * 10 ** 8) });
    })
});
