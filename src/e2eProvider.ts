import {
  HexString,
  Address,
  utils,
  Cell,
  TransactionWithStatus,
  Block,
  Script, HashType, OutPoint, values, blockchain, CellDep
} from "@ckb-lumos/base";
import {
  helpers,
  WitnessArgs,
  hd,
} from "@ckb-lumos/lumos";
import {Indexer} from "@ckb-lumos/ckb-indexer";
import {
  CKBIndexerQueryOptions,
  OtherQueryOptions,
} from "@ckb-lumos/ckb-indexer/lib/type";
import {common, dao, deploy, MultisigScript, parseFromInfo} from "@ckb-lumos/common-scripts";
import {bytes} from "@ckb-lumos/codec";
import {Buffer} from 'buffer';

import {
  TransactionSkeleton,
  parseAddress,
  sealTransaction,
  encodeToAddress, TransactionSkeletonType,
} from "@ckb-lumos/helpers";
import {key} from "@ckb-lumos/hd";
import {
  ScriptConfigs,
  createConfig,
  Config,
  predefined,
  initializeConfig, getConfig, ScriptConfig,
} from "@ckb-lumos/config-manager";
import {RPC} from "@ckb-lumos/rpc";
import {BI, BIish} from "@ckb-lumos/bi";
import {Account, AccountMulti, asyncSleep, Options, randomSecp256k1Account} from "./utils";
import {FaucetQueue} from "./faucetQueue";
import {readFileSync, writeFileSync} from "fs";
import * as fs from 'fs';
import {LUMOS_CONFIG_PATH} from "./constants";
import {ScriptValue} from "@ckb-lumos/base/lib/values";


type LockScriptLike = Address | Script;

export enum DeployType {
  data,
  typeId,
  data2
}

export class E2EProvider {
  readonly pollIntervalMs: number;
  public indexer: Indexer;
  public rpc: RPC;
  protected faucetQueue: FaucetQueue;

  constructor(options: {
    indexer: Indexer;
    rpc: RPC;
    pollIntervalMs?: number;
    faucetQueue: FaucetQueue;
  }) {
    const {indexer, rpc, faucetQueue, pollIntervalMs = 1000} = options;

    this.indexer = indexer;
    this.rpc = rpc;
    this.pollIntervalMs = pollIntervalMs;
    this.faucetQueue = faucetQueue;
  }

  public async getGenesisScriptConfig(): Promise<ScriptConfigs> {
    const genesisBlock = await this.rpc.getBlockByNumber("0x0");

    const secp256k1DepTxHash = genesisBlock.transactions[1].hash;
    const secp256k1TypeScript = genesisBlock.transactions[0].outputs[1].type;
    const secp256k1TypeHash = utils.computeScriptHash(secp256k1TypeScript!);

    const daoDepTxHash = genesisBlock.transactions[0].hash;
    const daoTypeScript = genesisBlock.transactions[0].outputs[2].type;
    const daoTypeHash = utils.computeScriptHash(daoTypeScript!);

    return {
      SECP256K1_BLAKE160: {
        HASH_TYPE: "type",
        CODE_HASH: secp256k1TypeHash,
        TX_HASH: secp256k1DepTxHash!,
        INDEX: "0x0",
        DEP_TYPE: "depGroup",
      },
      SECP256K1_BLAKE160_MULTISIG: {
        CODE_HASH: '0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8',
        HASH_TYPE: 'type',
        TX_HASH: secp256k1DepTxHash!,
        INDEX: '0x1',
        DEP_TYPE: 'depGroup',
        SHORT_ID: 1
      },
      DAO: {
        HASH_TYPE: "type",
        CODE_HASH: daoTypeHash,
        TX_HASH: daoDepTxHash!,
        INDEX: "0x2",
        DEP_TYPE: "code",
      },
    };
  }

  public async loadLocalConfig(): Promise<Config> {
    if (checkFileExists(LUMOS_CONFIG_PATH)) {
      console.log("config exist")
      initializeConfig(this.getLocalConfig())
      return getConfig()
    }
    const _genesisConfig = await this.getGenesisScriptConfig();
    const CONFIG = createConfig({
      PREFIX: "ckt",
      SCRIPTS: {
        ...predefined.AGGRON4.SCRIPTS,
        ..._genesisConfig,
      },
    });
    initializeConfig(CONFIG);
    writeFileSync(LUMOS_CONFIG_PATH, JSON.stringify(CONFIG))
    return CONFIG;
  }

  public updateConfigFile(scriptKey: string, script: ScriptConfig) {
    let configMap = this.getLocalConfig()
    configMap["SCRIPTS"][scriptKey] = script
    writeFileSync(LUMOS_CONFIG_PATH, JSON.stringify(configMap))
    initializeConfig(configMap)
  }
  public  getLocalConfig(){
    let config = readFileSync(LUMOS_CONFIG_PATH, "utf-8")
    let configMap = JSON.parse(config)
    return configMap
  }


  public async claimCKB(options: {
    claimer: LockScriptLike;
    amount?: BI;
  }): Promise<string> {
    const {claimer, amount = BI.from(1000 * 10 ** 8)} = options;
    const {value: idlePk, onRelease} = await this.faucetQueue.pop();

    try {
      const txHash = await this.transferCKB({
        to: typeof claimer === "string" ? claimer : encodeToAddress(claimer),
        fromPk: idlePk,
        amount,
      });

      await this.waitTransactionCommitted(txHash);
      onRelease();
      return txHash;
    } catch (e) {
      console.error(e);
      onRelease();
      await asyncSleep(3000);
      return this.claimCKB(options);
    }
  }

  // wait for transaction status to be committed
  public async waitTransactionCommitted(
      txHash: string,
      options: {
        timeout?: number;
      } = {}
  ): Promise<TransactionWithStatus> {
    const {timeout = 60 * 1000} = options;

    let tx = await this.rpc.getTransaction(txHash);
    if (!tx) {
      throw new Error(`not found tx: ${txHash}`);
    }

    let duration = 0;
    while (
        tx.txStatus.status === "pending" ||
        tx.txStatus.status === "proposed"
        ) {
      if (duration > timeout) {
        throw new Error(`wait transaction committed timeout ${txHash}`);
      }
      await asyncSleep(this.pollIntervalMs);
      duration += this.pollIntervalMs;
      tx = await this.rpc.getTransaction(txHash);
    }

    if (tx.txStatus.status !== "committed") {
      throw new Error("transaction status is not committed");
    }

    let rpcTip = Number(await this.rpc.getTipBlockNumber());
    let indexerTip = Number((await this.indexer.tip()).blockNumber);

    while (rpcTip > indexerTip) {
      await asyncSleep(this.pollIntervalMs);
      rpcTip = Number(await this.rpc.getTipBlockNumber());
      indexerTip = Number((await this.indexer.tip()).blockNumber);
    }

    return tx;
  }

  // wait for the block height to greater than or equal to a given value
  public async waitForBlock(options: {
    relative: boolean;
    value: number;
  }): Promise<void> {
    const {relative, value} = options;

    const getCurrentBlock = async () =>
        parseInt(await this.rpc.getTipBlockNumber());

    let currentBlockNumber = await getCurrentBlock();

    const targetBlockNumber = relative ? currentBlockNumber + value : value;

    while (currentBlockNumber < targetBlockNumber) {
      await asyncSleep(this.pollIntervalMs);
      currentBlockNumber = await getCurrentBlock();
    }
  }

  // wait for the epoch to greater than or equal to a given value
  //FIXME use generate_epoch rpc method
  public async waitForEpoch(options: {
    relative: boolean;
    value: number;
  }): Promise<void> {
    const {relative, value} = options;

    const getCurrentepoch = async () =>
        parseInt((await this.rpc.getCurrentEpoch()).number);

    let currentEpochNumber = await getCurrentepoch();

    const targetEpochNumber = relative ? currentEpochNumber + value : value;

    while (currentEpochNumber < targetEpochNumber) {
      await asyncSleep(this.pollIntervalMs);
      currentEpochNumber = await getCurrentepoch();
    }
  }

  public async getBlockByTxHash(txHash: string): Promise<Block> {
    const tx = await this.waitTransactionCommitted(txHash);

    return this.rpc.getBlock(tx.txStatus.blockHash!);
  }

  public async getCapacities(address: Address): Promise<BI> {
    const cells = await this.findCells({lock: parseAddress(address)});

    return cells.reduce((a, b) => a.add(b.cellOutput.capacity), BI.from(0));
  }

  public async findCells(
      queries: CKBIndexerQueryOptions,
      otherQueryOptions?: OtherQueryOptions
  ): Promise<Cell[]> {
    const cellCollector = this.indexer.collector(queries, otherQueryOptions);

    const cells: Cell[] = [];
    for await (const cell of cellCollector.collect()) {
      cells.push(cell);
    }

    return cells;
  }

  public async transferCKB(options: {
    to: Address;
    fromPk: HexString;
    amount: BIish;
  }): Promise<string> {
    const from = randomSecp256k1Account(options.fromPk);

    let txSkeleton = TransactionSkeleton({cellProvider: this.indexer});

    txSkeleton = await common.transfer(
        txSkeleton,
        [from.address],
        options.to,
        options.amount
    );

    txSkeleton = await common.payFeeByFeeRate(txSkeleton, [from.address], 1000);

    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, from.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);

    return this.rpc.sendTransaction(tx, "passthrough");
  }

  public async daoDeposit(options: {
    fromPk: HexString;
    amount?: BIish;
  }): Promise<string> {
    const {fromPk, amount = BI.from(1000 * 10 ** 8)} = options;
    const from = randomSecp256k1Account(fromPk);

    let txSkeleton = TransactionSkeleton({cellProvider: this.indexer});

    txSkeleton = await dao.deposit(
        txSkeleton,
        from.address,
        from.address,
        amount
    );

    txSkeleton = await common.payFeeByFeeRate(txSkeleton, [from.address], 1000);

    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, from.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);

    return this.rpc.sendTransaction(tx, "passthrough");
  }

  public async getCellByOutPoint(outpoint: OutPoint): Promise<Cell> {
    const tx = await this.rpc.getTransaction(outpoint.txHash)
    console.log("[debug]:", tx)
    if (!tx) {
      throw new Error(`not found tx: ${outpoint.txHash}`)
    }
    console.log("[debug]:", tx.txStatus.blockHash!)
    const block = await this.rpc.getBlock(tx.txStatus.blockHash!)

    return {
      cellOutput: tx.transaction.outputs[0],
      data: tx.transaction.outputsData[0],
      outPoint: outpoint,
      blockHash: tx.txStatus.blockHash,
      blockNumber: block!.header.number,
    }
  }

  public async daoWithdraw(fromPk: HexString, depositOutpoint: OutPoint):Promise<string> {
    const from = randomSecp256k1Account(fromPk);
    const depositCell = await this.getCellByOutPoint(depositOutpoint);
    let txSkeleton = TransactionSkeleton({cellProvider: this.indexer});

    txSkeleton = await dao.withdraw(
        txSkeleton,
        depositCell,
        from.address
    );

    txSkeleton = await common.payFeeByFeeRate(txSkeleton, [from.address], 1000);

    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, from.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);

    return this.rpc.sendTransaction(tx, "passthrough");
  }

  public async daoUnlock(fromPk: HexString, depositOutpoint: OutPoint, withdrawOutpoint: OutPoint):Promise<string> {
    const from = randomSecp256k1Account(fromPk);
    const depositCell = await this.getCellByOutPoint(depositOutpoint);
    const withdrawCell = await this.getCellByOutPoint(withdrawOutpoint);
    let txSkeleton = TransactionSkeleton({cellProvider: this.indexer});

    txSkeleton = await dao.unlock(
        txSkeleton,
        depositCell,
        withdrawCell,
        from.address,
        from.privKey
    );

    txSkeleton = await common.payFeeByFeeRate(txSkeleton, [from.address], 1000);

    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, from.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);

    return this.rpc.sendTransaction(tx, "passthrough");
  }


  public async generateAccountFromMultisigInfo(fromInfo: MultisigScript): Promise<AccountMulti> {
    let LocalConfig = await getConfig();
    const {fromScript, multisigScript} = parseFromInfo(fromInfo, {
      config: LocalConfig,
    });
    return {
      fromScript,
      multisigScript,
    };
  }

  public async multisigTransfer(options: Options, multiAccountCapacity: BIish, fee: BIish): Promise<string>{
    let txSkeleton = helpers.TransactionSkeleton({cellProvider: this.indexer});
    let LocalConfig = await getConfig();
    const { fromScript, multisigScript } = await this.generateAccountFromMultisigInfo(options.fromInfo);
    await this.claimCKB({claimer: fromScript, amount: BI.from(multiAccountCapacity)});
    const toScript = helpers.parseAddress(options.toAddress, { config: LocalConfig });
    const neededCapacity = BI.from(options.amount).add(fee); //additional ckb for tx fee
    let collectedSum = BI.from(0);
    const collected: Cell[] = [];
    const collector = this.indexer.collector({ lock: fromScript, type: "empty" });
    for await (const cell of collector.collect()) {
      collectedSum = collectedSum.add(cell.cellOutput.capacity);
      collected.push(cell);
      if (collectedSum >= neededCapacity) break;
    }

    if (collectedSum < neededCapacity) {
      console.log(`debug ${collectedSum}, ${neededCapacity}`)
      throw new Error("Not enough CKB");
    }

    const transferOutput: Cell = {
      cellOutput: {
        capacity: BI.from(options.amount).toHexString(),
        lock: toScript,
      },
      data: "0x",
    };

    const changeOutput: Cell = {
      cellOutput: {
        capacity: collectedSum.sub(neededCapacity).toHexString(),
        lock: fromScript,
      },
      data: "0x",
    };

    txSkeleton = txSkeleton.update("inputs", (inputs) => inputs.push(...collected));
    txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(transferOutput, changeOutput));
    txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
        cellDeps.push(<CellDep>{
          outPoint: {
            txHash: LocalConfig.SCRIPTS.SECP256K1_BLAKE160_MULTISIG?.TX_HASH,
            index: LocalConfig.SCRIPTS.SECP256K1_BLAKE160_MULTISIG?.INDEX,
          },
          depType: LocalConfig.SCRIPTS.SECP256K1_BLAKE160_MULTISIG?.DEP_TYPE,
        })
    );

    const firstIndex = txSkeleton
        .get("inputs")
        .findIndex((input) =>
            new ScriptValue(input.cellOutput.lock, { validate: false }).equals(
                new ScriptValue(fromScript, { validate: false })
            )
        );
    if (firstIndex !== -1) {
      while (firstIndex >= txSkeleton.get("witnesses").size) {
        txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.push("0x"));
      }
      let witness: string = txSkeleton.get("witnesses").get(firstIndex)!;
      let newWitnessArgs: WitnessArgs;
      const SECP_SIGNATURE_PLACEHOLDER =
          "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

      newWitnessArgs = {
        lock: "0x" + multisigScript!.slice(2) + SECP_SIGNATURE_PLACEHOLDER.slice(2).repeat(options.fromInfo.M),
      };

      if (witness !== "0x") {
        const witnessArgs = blockchain.WitnessArgs.unpack(bytes.bytify(witness))
        const lock = witnessArgs.lock;
        if (!!lock && !!newWitnessArgs.lock && !bytes.equal(lock, newWitnessArgs.lock)) {
          throw new Error("Lock field in first witness is set aside for signature!");
        }
        const inputType = witnessArgs.inputType;
        if (!!inputType) {
          newWitnessArgs.inputType = inputType;
        }
        const outputType = witnessArgs.outputType;
        if (!!outputType) {
          newWitnessArgs.outputType = outputType;
        }
      }
      witness = bytes.hexify(blockchain.WitnessArgs.pack(newWitnessArgs))
      txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.set(firstIndex, witness));
    }

    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;

    let pubkeyHashN: string = "";
    options.fromInfo.publicKeyHashes.forEach((publicKeyHash) => {
      pubkeyHashN += publicKeyHash.slice(2);
    });

    let sigs: string = "";
    options.privKeys.forEach((privKey) => {
      if (privKey !== "") {
        let sig = hd.key.signRecoverable(message!, privKey);
        sig = sig.slice(2);
        sigs += sig;
      }
    });

    sigs =
        "0x00" +
        ("00" + options.fromInfo.R.toString(16)).slice(-2) +
        ("00" + options.fromInfo.M.toString(16)).slice(-2) +
        ("00" + options.fromInfo.publicKeyHashes.length.toString(16)).slice(-2) +
        pubkeyHashN +
        sigs;

    const tx = helpers.sealTransaction(txSkeleton, [sigs]);
    const hash = await this.rpc.sendTransaction(tx, "passthrough");
    console.log("The transaction hash is", hash);

    return hash;

  }


  public async sendAndSignTxSkeleton(txSkeleton: TransactionSkeletonType, fee: number = 1000, account: Account) {
    txSkeleton = await common.payFeeByFeeRate(txSkeleton, [account.address], fee);
    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, account.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);
    return this.rpc.sendTransaction(tx, "passthrough");
  }

  public async deployContract(options: {
    account: Account,
    contractName: string,
    contractPath: string,
    deployType: HashType
  }) {
    const contractBuffer = readFileSync(options.contractPath);
    console.log("contract length:", contractBuffer.length)
    let deployResult: {
      txSkeleton: TransactionSkeletonType;
      scriptConfig: ScriptConfig;
    };

    // switch (options.deployType) {
    if (options.deployType == "type") {
      deployResult = await deploy.generateDeployWithTypeIdTx(
          {
            cellProvider: this.indexer,
            scriptBinary: contractBuffer,
            fromInfo: options.account.address,
          });
      deployResult.scriptConfig.HASH_TYPE = options.deployType
      console.log(deployResult.scriptConfig.TX_HASH)
      this.updateConfigFile(options.contractName, deployResult.scriptConfig)
    } else if (options.deployType == "data" || options.deployType == "data1" || options.deployType == "data2") {
      deployResult = await deploy.generateDeployWithDataTx(
          {
            cellProvider: this.indexer,
            scriptBinary: contractBuffer,
            fromInfo: options.account.address,
          });
      deployResult.scriptConfig.HASH_TYPE = options.deployType
      console.log(deployResult.scriptConfig.TX_HASH)
      this.updateConfigFile(options.contractName, deployResult.scriptConfig)
    } else {
      throw new Error("not support")
    }


    // @ts-ignore
    let txSkeleton = common.prepareSigningEntries(deployResult.txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)?.message;
    const Sig = key.signRecoverable(message!, options.account.privKey);
    const tx = sealTransaction(txSkeleton, [Sig]);
    let tx_hash = await this.rpc.sendTransaction(tx, "passthrough");
    console.log('deploy hash:', tx_hash)
    return tx_hash
  }

  public async getDeployScriptConfig(txHash: string, outputIndex: number, deployType: HashType): Promise<ScriptConfig> {
    // todo get txHash
    // get
    const tx = await this.rpc.getTransaction(txHash)
    switch (deployType) {
      case "data" || "data1" || "data2":
        const data = tx.transaction.outputsData[outputIndex];
        let codeHash1 = utils.ckbHash(bytes.bytify(data));

        return {
          CODE_HASH: codeHash1,
          HASH_TYPE: deployType,
          TX_HASH: txHash,
          INDEX: "0x0",
          DEP_TYPE: "code",
        };
      case "type":

        // @ts-ignore
        let codeHash = utils.computeScriptHash(tx.transaction.outputs[outputIndex].type);
        return {
          CODE_HASH: codeHash,
          HASH_TYPE: deployType,
          TX_HASH: txHash,
          INDEX: BI.from(outputIndex).toHexString(),
          DEP_TYPE: "code",
        }
    }
    throw new Error("not support ")
  }

  public async saveChainContract(txHash: string, outputIndex: number, decPath: string) {
    const tx = await this.rpc.getTransaction(txHash)
    let data = tx.transaction.outputsData[outputIndex].replace("0x", "");
    const buffer = Buffer.from(data, 'hex');
    writeFileSync(decPath, buffer)
  }

}

export function hexToUint8Array(hexInput: Buffer) {
  let hex = hexInput.toString();  // 将输入转换为十六进制字符串
  console.log('hex:', hex)
  // 确保 hex 字符串的长度是偶数
  if (hex.length % 2 != 0) {
    hex = '0' + hex;
  }

  let bytes = [];

  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }

  return new Uint8Array(bytes);
}


function checkFileExists(filePath: string): boolean {
  try {
    // 使用 fs.accessSync 来检查文件是否存在
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}