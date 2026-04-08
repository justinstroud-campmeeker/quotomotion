/**
 * Product & Configuration Tools
 * Exposed via MCP for agent consumption.
 */

import { z } from 'zod';
import { getActiveProducts } from '../salesforce/client.js';

// ─── Tool Input Schemas ───────────────────────────────────────────────────────

export const GetProductCatalogSchema = z.object({
  pricebookId: z.string().optional().describe(
    'Salesforce Pricebook2 ID. Defaults to standard pricebook if omitted.'
  ),
  productFamily: z.string().optional().describe(
    'Filter by product family (e.g., "Hardware", "Software", "Support")'
  ),
  searchTerm: z.string().optional().describe(
    'Optional keyword filter on product name or code'
  ),
});

export const ConfigureProductSchema = z.object({
  productId: z.string().describe('Product2 ID to configure'),
  selectedOptions: z.record(z.string()).optional().describe(
    'Key-value map of option group name to selected option value'
  ),
  quantity: z.number().positive().describe('Quantity being configured'),
  opportunityId: z.string().optional().describe(
    'Opportunity ID for context-aware configuration rules'
  ),
});

export const ValidateConfigurationSchema = z.object({
  productId: z.string().describe('Product2 ID'),
  configuration: z.record(z.unknown()).describe('Configuration to validate'),
  quantity: z.number().positive(),
});

// ─── Tool Handlers ────────────────────────────────────────────────────────────

/**
 * get_product_catalog
 * Returns available products with their list prices.
 * Replaces CPQ's ProductSearch/ProductFilter functionality.
 */
export async function handleGetProductCatalog(
  input: z.infer<typeof GetProductCatalogSchema>
) {
  const entries = await getActiveProducts(input.pricebookId, input.productFamily);

  let results = entries.map((entry) => ({
    pricebookEntryId: entry.Id,
    productId: entry.Product2Id,
    name: entry.Product2.Name,
    productCode: entry.Product2.ProductCode,
    family: entry.Product2.Family,
    description: entry.Product2.Description,
    listPrice: entry.UnitPrice,
  }));

  // Apply optional keyword filter
  if (input.searchTerm) {
    const term = input.searchTerm.toLowerCase();
    results = results.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.productCode?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
    );
  }

  return {
    totalCount: results.length,
    products: results,
  };
}

/**
 * configure_product
 * Applies configuration rules to a product selection.
 * Returns valid option sets and any constraint violations.
 *
 * NOTE: Full implementation reads configuration rules from CMDT.
 * Stub demonstrates the interface contract.
 */
export async function handleConfigureProduct(
  input: z.infer<typeof ConfigureProductSchema>
) {
  // In full implementation: load CPQ_Bundle_Rule__mdt records for this product,
  // evaluate required/excluded option rules, return valid combinations.

  return {
    productId: input.productId,
    quantity: input.quantity,
    configuration: input.selectedOptions ?? {},
    validationStatus: 'valid',
    availableOptionGroups: [
      // Placeholder — real impl queries CMDT and ProductOption records
      {
        groupName: 'Support Tier',
        required: true,
        options: ['Standard', 'Premium', 'Enterprise'],
        selectedValue: input.selectedOptions?.['Support Tier'] ?? null,
      },
      {
        groupName: 'License Term',
        required: true,
        options: ['12 months', '24 months', '36 months'],
        selectedValue: input.selectedOptions?.['License Tier'] ?? null,
      },
    ],
    configurationWarnings: [],
  };
}

/**
 * validate_configuration
 * Runs constraint rules against a proposed configuration.
 * Returns pass/fail with specific reasons for any violations.
 */
export async function handleValidateConfiguration(
  input: z.infer<typeof ValidateConfigurationSchema>
) {
  // Full implementation: evaluate CPQ_Bundle_Rule__mdt constraint rules
  // For demo: check required fields are populated

  const violations: string[] = [];
  const config = input.configuration as Record<string, unknown>;

  if (!config['Support Tier']) {
    violations.push('Support Tier is required but not selected');
  }
  if (!config['License Term']) {
    violations.push('License Term is required but not selected');
  }

  return {
    isValid: violations.length === 0,
    violations,
    productId: input.productId,
    quantity: input.quantity,
  };
}
