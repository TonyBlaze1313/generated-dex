import configData from "./hydra.config.json";
import {
  getActiveModuleMetadata as getStaticActiveModuleMetadata,
  normalizeEnabledModules,
  ModuleMetadata,
  MODULE_METADATA_LIST,
} from "./moduleMetadata";

export type { ModuleMetadata };

export interface HydraConfig {
  configVersion?: string;
  name: string;
  chain: string;
  chainId: number;
  network: string;
  deployedAt: string;
  deployer: string;
  modules?: string[] | Record<string, boolean>;
  enabledModules?: string[];
  tokenAName?: string;
  tokenASymbol?: string;
  tokenBName?: string;
  tokenBSymbol?: string;
  tokens: Array<{ symbol: string; name: string; address: string }>;
  pool: {
    volatileFeeBps: number;
    stableFeeBps: number;
    supportedPairs: string[];
  };
  liquidity: {
    initialAmountA: string;
    initialAmountB: string;
  };
  gasConfig: Record<string, any>;
  contracts: Record<string, string>;
  moduleMetadata?: Record<string, ModuleMetadata>;
  verification?: {
    network: string;
    timestamp: string;
    deployer: string;
    totalContracts: number;
    passedContracts: number;
    failedContracts: number;
    valid: boolean;
    results: Array<{
      name: string;
      contractName: string;
      address?: string;
      codePresent: boolean;
      passed: boolean;
      checks: Array<{ description: string; passed: boolean; actual: string; expected?: string; error?: string }>;
    }>;
  };
  generatedAt: string;
}

const CURRENT_CONFIG_VERSION = "1.0.0";

export const hydraConfig = configData as unknown as HydraConfig;

function assertHydraConfigVersion(config: HydraConfig) {
  if (!config.configVersion) {
    console.warn(`⚠️  config file missing configVersion. Expected ${CURRENT_CONFIG_VERSION}.`);
    return;
  }

  if (config.configVersion !== CURRENT_CONFIG_VERSION) {
    console.warn(
      `⚠️  config file version mismatch: found ${config.configVersion}, expected ${CURRENT_CONFIG_VERSION}. Please regenerate or update the config.`
    );
  }
}

export function getEnabledHydraModuleKeys(): string[] {
  assertHydraConfigVersion(hydraConfig);
  return normalizeEnabledModules(hydraConfig.modules ?? hydraConfig.enabledModules);
}

export function getConfigModuleMetadata(): ModuleMetadata[] {
  const configMetadata = hydraConfig.moduleMetadata ?? {};
  const merged = Object.values(configMetadata).map((metadata) => ({
    ...(MODULE_METADATA_LIST.find((item) => item.key === metadata.key) || {}),
    ...metadata,
  })) as ModuleMetadata[];

  const fallback = MODULE_METADATA_LIST.filter(
    (item) => !merged.some((metadata) => metadata.key === item.key)
  );

  return [...merged, ...fallback];
}

export function getActiveHydraModuleMetadata(): ModuleMetadata[] {
  assertHydraConfigVersion(hydraConfig);
  const enabledKeys = new Set(getEnabledHydraModuleKeys());
  return getConfigModuleMetadata().filter((metadata) => enabledKeys.has(metadata.key));
}

export function getHydraModuleMetadataById(moduleId: number): ModuleMetadata | undefined {
  return getConfigModuleMetadata().find((metadata) => metadata.id === moduleId);
}

export function getHydraModuleMetadataByKey(moduleKey: string): ModuleMetadata | undefined {
  return getConfigModuleMetadata().find((metadata) => metadata.key === moduleKey);
}

export const tokenAName = hydraConfig.tokenAName || hydraConfig.tokens?.[0]?.name || 'TokenA';
export const tokenASymbol = hydraConfig.tokenASymbol || hydraConfig.tokens?.[0]?.symbol || 'TKA';
export const tokenBName = hydraConfig.tokenBName || hydraConfig.tokens?.[1]?.name || 'TokenB';
export const tokenBSymbol = hydraConfig.tokenBSymbol || hydraConfig.tokens?.[1]?.symbol || 'TKB';

export function getHydraVerificationReport() {
  return hydraConfig.verification;
}
