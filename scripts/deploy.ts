import { randomSecp256k1Account} from "../src/utils";
import {CKB_RPC_URL, GENESIS_CELL_PRIVATEKEYS} from "../src/constants";
import {RPC} from "@ckb-lumos/rpc";
import {Indexer} from "@ckb-lumos/ckb-indexer";
import {BI} from "@ckb-lumos/bi";
import {E2EProvider} from "../src/e2eProvider";
import {FileFaucetQueue} from "../src/faucetQueue";

async function main() {
    console.log("---main---")
    const rpc = new RPC(CKB_RPC_URL);
    const indexer = new Indexer(CKB_RPC_URL);

    const e2eProvider = new E2EProvider({
        indexer,
        rpc,
        faucetQueue: FileFaucetQueue.getInstance(),
    });
    await e2eProvider.loadLocalConfig();
    const deployAccount = randomSecp256k1Account(GENESIS_CELL_PRIVATEKEYS[1]);
    let deployContractList = [
        {
            contractName: "SPORE",
            contractPath: "spore-contract/build/release/spore"
        },
        {
            contractName: "SPORE_CLUSTER",
            contractPath: "spore-contract/build/release/cluster"
        },
        {
            contractName: "cluster_agent",
            contractPath: "spore-contract/build/release/cluster_agent"
        },
        {
            contractName: "cluster_proxy",
            contractPath: "spore-contract/build/release/cluster_proxy"
        },
        {
            contractName: "spore_extension_lua",
            contractPath: "spore-contract/build/release/spore_extension_lua"
        }
    ]
    for (let i = 0; i < deployContractList.length; i++) {
        let account = randomSecp256k1Account()
        await e2eProvider.claimCKB({
            claimer: account.lockScript,
            amount: BI.from(500000 * 10 ** 8)
        })
        let deployContract = deployContractList[i]
        // @ts-ignore
        let tx = await e2eProvider.deployContract({
            account: account,
            contractName: deployContract.contractName,
            contractPath: deployContract.contractPath,
            deployType: "type"
        })
        await e2eProvider.waitTransactionCommitted(tx)
        let ret = await e2eProvider.rpc.getTransaction(tx)
        console.log("contract name:",deployContract.contractName," hash",tx)
    }
    console.log("deploy successful")
    console.log("generate lumos config file path:lumos.json")
    console.log("tip number:",await e2eProvider.rpc.getTipBlockNumber())
}

main();
