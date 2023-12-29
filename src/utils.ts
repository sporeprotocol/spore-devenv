import { Script } from "@ckb-lumos/base";
import { encodeToAddress } from "@ckb-lumos/helpers";
import { randomBytes } from "crypto";
import {AddressType, ExtendedPrivateKey, key, mnemonic} from "@ckb-lumos/hd";
import { getConfig } from "@ckb-lumos/config-manager";
import { hexify } from "@ckb-lumos/codec/lib/bytes";
import {MultisigScript, parseFromInfo} from "@ckb-lumos/common-scripts";
import {BIish} from "@ckb-lumos/bi";

// secp256k1 private key is 32-bytes length
export const generateRandomPrivateKey = (): string => hexify(randomBytes(32));

export function asyncSleep(ms: number): Promise<unknown> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Account {
  lockScript: Script;
  address: string;
  pubKey: string;
  privKey: string;
}

export type AccountMulti = {
  fromScript: Script;
  multisigScript: string | undefined;
};

export function generateMofNMultisigInfo(R: number, M: number, publicKeyHashes: string[]): MultisigScript {
  return {
    R,
    M,
    publicKeyHashes,
  };
}

export interface Options {
  fromInfo: MultisigScript;
  toAddress: string;
  amount: BIish;
  privKeys: string[];
}

export const randomSecp256k1Account = (privKey?: string): Account => {
  const _privKey = (() => {
    if (privKey) {
      return privKey;
    }

    return generateRandomPrivateKey();
  })();

  const pubKey = key.privateToPublic(_privKey);
  const args = key.publicKeyToBlake160(pubKey);
  const template = getConfig().SCRIPTS["SECP256K1_BLAKE160"]!;
  const lockScript = {
    codeHash: template.CODE_HASH,
    hashType: template.HASH_TYPE,
    args: args,
  };

  const address = encodeToAddress(lockScript);

  return {
    lockScript,
    address,
    pubKey,
    privKey: _privKey,
  };
};

export const getSecp256k1Account = (mm: string, type: AddressType, index: number): Account => {
  const seed = mnemonic.mnemonicToSeedSync(mm)
  const extendedPrivateKey = ExtendedPrivateKey.fromSeed(seed)
  let priv = extendedPrivateKey.privateKeyInfo(AddressType.Change, index)
  return randomSecp256k1Account(priv.privateKey)
}
