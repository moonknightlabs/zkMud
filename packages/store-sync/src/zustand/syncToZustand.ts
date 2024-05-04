import { ResolvedStoreConfig, Tables, resolveConfig } from "@latticexyz/store/internal";
import { SyncOptions, SyncResult, storeTables, worldTables } from "../common";
import { createStoreSync } from "../createStoreSync";
import { ZustandStore } from "./createStore";
import { createStore } from "./createStore";
import { createStorageAdapter } from "./createStorageAdapter";
import { Address } from "viem";
import { SyncStep } from "../SyncStep";
import { Store as StoreConfig } from "@latticexyz/store";
import { storeToV1 } from "@latticexyz/store/config/v2";

type AllTables<config extends StoreConfig, extraTables extends Tables | undefined> = ResolvedStoreConfig<
  storeToV1<config>
>["tables"] &
  (extraTables extends Tables ? extraTables : Record<never, never>) &
  typeof storeTables &
  typeof worldTables;

type SyncToZustandOptions<config extends StoreConfig, extraTables extends Tables | undefined> = SyncOptions & {
  // require address for now to keep the data model + retrieval simpler
  address: Address;
  config: config;
  tables?: extraTables;
  store?: ZustandStore<AllTables<config, extraTables>>;
  startSync?: boolean;
};

type SyncToZustandResult<config extends StoreConfig, extraTables extends Tables | undefined> = SyncResult & {
  tables: AllTables<config, extraTables>;
  useStore: ZustandStore<AllTables<config, extraTables>>;
  stopSync: () => void;
};

export async function syncToZustand<config extends StoreConfig, extraTables extends Tables | undefined>({
  config,
  tables: extraTables,
  store,
  startSync = true,
  ...syncOptions
}: SyncToZustandOptions<config, extraTables>): Promise<SyncToZustandResult<config, extraTables>> {
  // TODO: migrate this once we redo config to return fully resolved tables (https://github.com/latticexyz/mud/issues/1668)
  // TODO: move store/world tables into `resolveConfig`
  const resolvedConfig = resolveConfig(storeToV1(config as StoreConfig));
  const tables = {
    ...resolvedConfig.tables,
    ...extraTables,
    ...storeTables,
    ...worldTables,
  } as unknown as AllTables<config, extraTables>;

  const useStore = store ?? createStore({ tables });
  const storageAdapter = createStorageAdapter({ store: useStore });

  const storeSync = await createStoreSync({
    storageAdapter,
    ...syncOptions,
    onProgress: (syncProgress) => {
      // already live, no need for more progress updates
      if (useStore.getState().syncProgress.step === SyncStep.LIVE) return;
      useStore.setState(() => ({ syncProgress }));
    },
  });

  const sub = startSync ? storeSync.storedBlockLogs$.subscribe() : null;
  const stopSync = (): void => {
    sub?.unsubscribe();
  };

  return {
    ...storeSync,
    tables,
    useStore,
    stopSync,
  };
}
