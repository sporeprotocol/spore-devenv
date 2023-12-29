import { spawn, execSync } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import {replaceContentSync, retry} from "@ckb-lumos/utils";
import { RPC } from "@ckb-lumos/rpc";
import killPort from "kill-port";
import {
  ckb,
  download,
  getDefaultDownloadDestination,
  lightClient,
} from "@ckb-lumos/runner";
import {
  CKB_RPC_PORT,
  CKB_RPC_URL,
} from "../src/constants";

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
}

main();
