import { SetMetadata } from '@nestjs/common';

export const ADD_EXPLORER_LINKS_KEY = 'addExplorerLinks';

export interface ExplorerLinkConfig {
  txHashField?: string;
  accountFields?: string[];
  assetFields?: string[];
}

/**
 * Decorator to automatically add explorer links to response
 * @param config Configuration for which fields to enhance
 */
export const AddExplorerLinks = (config: ExplorerLinkConfig = {}) =>
  SetMetadata(ADD_EXPLORER_LINKS_KEY, {
    txHashField: config.txHashField || 'txHash',
    accountFields: config.accountFields || ['fromAccount', 'toAccount', 'account'],
    assetFields: config.assetFields || [],
  });
