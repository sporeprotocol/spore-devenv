import {e2eMainNetProvider, e2eProvider} from "../src/config";
import {MNEMONIC} from "../src/constants";
import {AddressType} from "@ckb-lumos/hd";
import {BI} from "@ckb-lumos/bi";
import {getSecp256k1Account} from "../src/utils";
const fs = require('fs');

const CHARLIE = getSecp256k1Account(MNEMONIC, AddressType.Change, 1);
const ALICE = getSecp256k1Account(MNEMONIC, AddressType.Change, 2);



describe('SUDT', function () {
    it("should have claimed CKBytes for alice", async () => {
        // Assuming e2eProvider, alice, and BI are properly set up in your project
        await e2eProvider.claimCKB({ claimer: CHARLIE.address, amount: BI.from(1000000 * 10 ** 8) });
        await e2eProvider.claimCKB({ claimer: ALICE.address, amount: BI.from(1000000 * 10 ** 8) });
        console.log("CHARLIE.address:" + CHARLIE.address);
        console.log("ALICE.address:" + ALICE.address);
        console.log("CHARLIE.privKey:" + CHARLIE.privKey);
        console.log("alice.privKey:" + ALICE.privKey);
        let existingData;
        try {
            existingData = JSON.parse(fs.readFileSync('lumos.json', 'utf-8'));
        } catch (error) {
            // @ts-ignore
            console.error('Error reading lumos.json:', error.message);
            existingData = {};
        }

        const newData = {
            CHARLIE: {
                privKey: CHARLIE.privKey
            },
            ALICE: {
                privKey: ALICE.privKey
            },
            ...existingData
        };

        const jsonData = JSON.stringify(newData, null, 2);

        fs.writeFileSync('lumos.json', jsonData);

        console.log('Data has been added to lumos.json');
    })
});