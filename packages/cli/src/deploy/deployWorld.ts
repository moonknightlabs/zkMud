import { Account, Chain, Client, Hex, Transport } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { ensureWorldFactory } from "./ensureWorldFactory";
import WorldFactoryAbi from "@latticexyz/world/out/WorldFactory.sol/WorldFactory.abi.json" assert { type: "json" };
import { writeContract } from "@latticexyz/common";
import { debug } from "./debug";
import { logsToWorldDeploy } from "./logsToWorldDeploy";
import { WorldDeploy } from "./common";

export async function deployWorld(
  client: Client<Transport, Chain | undefined, Account>,
  deployerAddress: Hex,
  salt: Hex,
  withWorldProxy?: boolean,
): Promise<WorldDeploy> {
  const worldFactory = await ensureWorldFactory(client, deployerAddress, withWorldProxy);

  debug("deploying world");
  const tx = await writeContract(client, {
    chain: client.chain ?? null,
    address: worldFactory,
    abi: WorldFactoryAbi,
    functionName: "deployWorld",
    args: [salt],
  });

  debug("waiting for world deploy");
  const receipt = await waitForTransactionReceipt(client, { hash: tx });
  if (receipt.status !== "success") {
    console.error("world deploy failed", receipt);
    throw new Error("world deploy failed");
  }

  const deploy = logsToWorldDeploy(receipt.logs);
  debug("deployed world to", deploy.address, "at block", deploy.deployBlock);

  debug("registering Module functions");

  const registerTx = await writeContract(client, {
    chain: client.chain ?? null,
    address: worldFactory,
    abi: WorldFactoryAbi,
    functionName: "registerModuleFunctions",
    args: [deploy.address],
  });

  debug("waiting for register module function");
  const registerReceipt = await waitForTransactionReceipt(client, { hash: registerTx });
  if (registerReceipt.status !== "success") {
    console.error("register function failed", registerReceipt);
    throw new Error("register function failed");
  }

  return { ...deploy, stateBlock: registerReceipt.blockNumber };
}
