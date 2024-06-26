import { config } from 'dotenv';
import { resolve } from 'path';
import { e2eProvider } from '../src/config';
import { BI } from '@ckb-lumos/bi';
import { randomSecp256k1Account } from '../src/utils';

let accountCharlie = process.env.VITE_ACCOUNT_CHARLIE;
let accountAlice = process.env.VITE_ACCOUNT_ALICE;
let accountBob = process.env.VITE_ACCOUNT_BOB;

// Check if environment variables are empty
if (!accountCharlie || !accountAlice || !accountBob) {
    // Load environment variables from .env file
    config({ path: resolve(__dirname, '../.env') });

    // Reassign the values after loading from .env
    accountCharlie = process.env.VITE_ACCOUNT_CHARLIE;
    accountAlice = process.env.VITE_ACCOUNT_ALICE;
    accountBob = process.env.VITE_ACCOUNT_BOB;
}

// Use try...catch to handle errors
try {
// If after loading .env file, environment variables are still empty, throw an error
    if (!accountCharlie || !accountAlice || !accountBob) {
        throw new Error('Missing account information. Please check environment variables.');
    }
} catch (error) {
    console.error('error message:', (error as Error).message);
}

const CHARLIE = randomSecp256k1Account(accountCharlie);
const ALICE = randomSecp256k1Account(accountAlice);
const BOB = randomSecp256k1Account(accountBob);

describe('CKBytes', function () {
    it('should have claimed CKBytes for charlie/alice/bob', async () => {
        await e2eProvider.claimCKB({ claimer: CHARLIE.address, amount: BI.from(10000000 * 10 ** 8) });
        await e2eProvider.claimCKB({ claimer: ALICE.address, amount: BI.from(10000000 * 10 ** 8) });
        await e2eProvider.claimCKB({ claimer: BOB.address, amount: BI.from(10000000 * 10 ** 8) });
    });
});
