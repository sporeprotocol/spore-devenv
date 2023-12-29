import {initializeConfig, predefined} from "@ckb-lumos/config-manager";

export const CKB_HOST = `127.0.0.1`;
export const CKB_RPC_PORT = 8114;


export const CKB_RPC_URL = `http://${CKB_HOST}:${CKB_RPC_PORT}`;

export const CKB_MAIN_NET_RPC_URL = "https://mainnet.ckbapp.dev/";

export const CKB_TEST_NET_RPC_URL = "https://testnet.ckbapp.dev/";

export const LUMOS_CONFIG_PATH = "lumos.json"

export const MNEMONIC = "brush scan basic know movie next time soccer speak loop balcony describe"
// from docker/ckb/dev.toml [[genesis.system_cells]]
initializeConfig(predefined.AGGRON4);

export const GENESIS_CELL_PRIVATEKEYS = [
    "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc",
    "0x63d86723e08f0f813a36ce6aa123bb2289d90680ae1e99d4de8cdb334553f24d",
];
