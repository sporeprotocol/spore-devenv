import {RPC} from "@ckb-lumos/rpc";
import {Indexer} from "@ckb-lumos/ckb-indexer";
import {FileFaucetQueue} from "@ckb-lumos/e2e-test/src/faucetQueue";
import {CKB_MAIN_NET_RPC_URL, CKB_RPC_URL, CKB_TEST_NET_RPC_URL} from "./constants";
import {E2EProvider} from "./e2eProvider";

export const rpc = new RPC(CKB_RPC_URL);
export const indexer = new Indexer(CKB_RPC_URL);

export const main_rpc = new RPC(CKB_MAIN_NET_RPC_URL);
export const main_indexer = new Indexer(CKB_MAIN_NET_RPC_URL);

export const test_rpc = new RPC(CKB_TEST_NET_RPC_URL);
export const test_indexer = new Indexer(CKB_TEST_NET_RPC_URL);


export const e2eProvider = new E2EProvider({
    indexer,
    rpc,
    faucetQueue: FileFaucetQueue.getInstance(),
});

export const e2eMainNetProvider = new E2EProvider({
    indexer: main_indexer,
    rpc: main_rpc,
    faucetQueue: FileFaucetQueue.getInstance(),
});

export const e2eTestNetProvider = new E2EProvider({
    indexer: test_indexer,
    rpc: test_rpc,
    faucetQueue: FileFaucetQueue.getInstance(),
});

beforeAll(async () => {
    await e2eProvider.loadLocalConfig();
})