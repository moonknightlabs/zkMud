import { SchemaToPrimitives, decodeValueArgs, encodeKey } from "@latticexyz/protocol-parser/internal";
import { WorldDeploy, worldAbi } from "./common";
import { Client, Hex } from "viem";
import { readContract } from "viem/actions";
import { Table } from "./configToTables";

export async function getTableValue<table extends Table>({
  client,
  worldDeploy,
  table,
  key,
}: {
  readonly client: Client;
  readonly worldDeploy: WorldDeploy;
  readonly table: table;
  readonly key: SchemaToPrimitives<table["keySchema"]>;
}): Promise<SchemaToPrimitives<table["valueSchema"]>> {
  const [staticData, encodedLengths, dynamicData] = (await readContract(client, {
    blockNumber: worldDeploy.stateBlock,
    address: worldDeploy.address,
    abi: worldAbi,
    functionName: "getRecord",
    args: [table.tableId, encodeKey(table.keySchema, key)],
    // TODO: remove cast once https://github.com/wevm/viem/issues/2125 is resolved
  })) as [Hex, Hex, Hex];
  return decodeValueArgs(table.valueSchema, {
    staticData,
    encodedLengths,
    dynamicData,
  });
}
