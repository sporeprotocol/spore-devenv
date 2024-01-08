import { spawn } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { retry} from "@ckb-lumos/utils";
import { RPC } from "@ckb-lumos/rpc";
import {
  ckb,
  download,
  getDefaultDownloadDestination,
} from "@ckb-lumos/runner";
import {
  CKB_RPC_PORT,
  CKB_RPC_URL,
  GENESIS_CELL_PRIVATEKEYS,
} from "../src/constants";
import {Indexer} from "@ckb-lumos/ckb-indexer";
import {E2EProvider} from "../src/e2eProvider";
import {FileFaucetQueue} from "../src/faucetQueue";
import {randomSecp256k1Account} from "../src/utils";
import {BI} from "@ckb-lumos/bi";

const MODULE_PATH = join(__dirname, "..");
const CKB_CWD = pathTo("tmp/ckb");
const LIGHT_CLIENT_CWD = pathTo("tmp/light-client");

function pathTo(subPath: string): string {
  return join(MODULE_PATH, subPath);
}

async function main() {
  console.log("pkill port ")
  // await killPort(CKB_RPC_PORT).catch(() => {});
  // await killPort(8118).catch(() => {});
  console.log("rm cmd")
  rmSync(CKB_CWD, { recursive: true, force: true });
  rmSync(LIGHT_CLIENT_CWD, { recursive: true, force: true });
  mkdirSync(CKB_CWD, { recursive: true });
  mkdirSync(LIGHT_CLIENT_CWD, { recursive: true });
  console.log("get download url ")
  const ckbReleaseUrl = ckb.getReleaseUrl({ version: "v0.111.0" });
  const ckbDownloadDest = getDefaultDownloadDestination(ckbReleaseUrl);
  let ckbBinaryPath = ckb.findBinaryPath(ckbDownloadDest);
  console.log("download ckb:",ckbReleaseUrl)
  console.log("download ckb pat:",ckbDownloadDest)
  if (!ckbBinaryPath) {
    await download(ckbReleaseUrl, ckbDownloadDest);
    ckbBinaryPath = ckb.findBinaryPath(ckbDownloadDest);
    if (!ckbBinaryPath) {
      throw new Error("CKB binary not found");
    }
  }
  console.log("config for ckb")
  ckb.generateConfigSync(ckbBinaryPath, {
    rpcPort: CKB_RPC_PORT,
    cwd: CKB_CWD,
  });
  console.log("modify epoch_duration_target");
  const specs_dev_path =  'specs/dev.toml';
  const modify_epoch_duration_target_command = `sed -ie  's/epoch_duration_target = 14400/epoch_duration_target = 8/g' ${specs_dev_path}`;
  const child = spawn(modify_epoch_duration_target_command, {shell: true, cwd: CKB_CWD});
  child.on('close', (code) => {
    if (code === 0) {
      console.log('modify epoch_duration_target successfully');
    } else {
      console.error(`modify epoch_duration_target failed with code ${code}`);
    }
  });
  console.log("start ckb")
  const ckbProcess = spawn(ckbBinaryPath, ["run", "--indexer"], {
    cwd: CKB_CWD,
  });
  const ckbMinerProcess = spawn(ckbBinaryPath, ["miner"], {
    cwd: CKB_CWD,
  });

  const ckbRpc = new RPC(CKB_RPC_URL);
  const tipBlock = await retry(
    () =>
      ckbRpc.getTipBlockNumber().then((res) => {
        if (Number(res) <= 0) return Promise.reject();
        return res;
      }),
    {
      timeout: 30_000,
      delay: 100,
      retries: 100,
    }
  );

  console.info("CKB started", tipBlock);

  // process.exit();
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
      contractName: "CLUSTER",
      contractPath: "spore-contract/build/release/cluster"
    },
    {
      contractName: "CLUSTER_AGENT",
      contractPath: "spore-contract/build/release/cluster_agent"
    },
    {
      contractName: "CLUSTER_PROXY",
      contractPath: "spore-contract/build/release/cluster_proxy"
    },
    {
      contractName: "SPORE_EXTENSION_LUA",
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
