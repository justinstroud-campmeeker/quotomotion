/**
 * Salesforce Client
 * Wraps jsforce to provide a clean async interface to the Salesforce REST API.
 * Credentials are loaded from environment variables — no hardcoded values.
 */

import jsforce from 'jsforce';

export interface SalesforceConfig {
  loginUrl: string;
  username: string;
  password: string;
  securityToken: string;
}

export interface SalesforceProduct {
  Id: string;
  Name: string;
  ProductCode: string;
  Description: string;
  Family: string;
  IsActive: boolean;
}

export interface PricebookEntry {
  Id: string;
  Product2Id: string;
  Pricebook2Id: string;
  UnitPrice: number;
  IsActive: boolean;
  Product2: SalesforceProduct;
}

export interface QuoteLineItemInput {
  QuoteId: string;
  Product2Id: string;
  PricebookEntryId: string;
  Quantity: number;
  UnitPrice: number;
  Description?: string;
}

let _connection: jsforce.Connection | null = null;

/**
 * Returns an authenticated jsforce connection, creating one if needed.
 * In production this would use OAuth2/Connected App, not password auth.
 */
export async function getSalesforceConnection(): Promise<jsforce.Connection> {
  if (_connection) return _connection;

  const config: SalesforceConfig = {
    loginUrl: process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com',
    username: process.env.SF_USERNAME ?? '',
    password: process.env.SF_PASSWORD ?? '',
    securityToken: process.env.SF_SECURITY_TOKEN ?? '',
  };

  if (!config.username || !config.password) {
    throw new Error('Salesforce credentials not configured. Set SF_USERNAME, SF_PASSWORD, and SF_SECURITY_TOKEN.');
  }

  const conn = new jsforce.Connection({ loginUrl: config.loginUrl });
  await conn.login(config.username, config.password + config.securityToken);
  _connection = conn;
  return conn;
}

/**
 * Fetches active products from a given pricebook.
 * Defaults to the standard pricebook if no ID is provided.
 */
export async function getActiveProducts(
  pricebookId?: string,
  productFamily?: string
): Promise<PricebookEntry[]> {
  const conn = await getSalesforceConnection();

  let query = `
    SELECT Id, Product2Id, Pricebook2Id, UnitPrice, IsActive,
           Product2.Id, Product2.Name, Product2.ProductCode,
           Product2.Description, Product2.Family, Product2.IsActive
    FROM PricebookEntry
    WHERE IsActive = true
    AND Product2.IsActive = true
  `;

  if (pricebookId) {
    query += ` AND Pricebook2Id = '${pricebookId}'`;
  } else {
    // Fall back to standard pricebook
    query += ` AND Pricebook2.IsStandard = true`;
  }

  if (productFamily) {
    query += ` AND Product2.Family = '${productFamily}'`;
  }

  const result = await conn.query<PricebookEntry>(query);
  return result.records;
}

/**
 * Creates a Quote in Salesforce and attaches line items.
 * Returns the created Quote ID.
 */
export async function createQuoteWithLineItems(
  opportunityId: string,
  quoteName: string,
  pricebookId: string,
  lineItems: Omit<QuoteLineItemInput, 'QuoteId'>[]
): Promise<string> {
  const conn = await getSalesforceConnection();

  // Create the Quote
  const quoteResult = await conn.sobject('Quote').create({
    Name: quoteName,
    OpportunityId: opportunityId,
    Pricebook2Id: pricebookId,
    Status: 'Draft',
  });

  if (!quoteResult.success) {
    throw new Error(`Failed to create quote: ${JSON.stringify(quoteResult.errors)}`);
  }

  const quoteId = quoteResult.id;

  // Create QuoteLineItems
  const lineItemRecords = lineItems.map((item) => ({
    ...item,
    QuoteId: quoteId,
  }));

  const lineItemResults = await conn.sobject('QuoteLineItem').create(lineItemRecords);

  const failures = (Array.isArray(lineItemResults) ? lineItemResults : [lineItemResults])
    .filter((r) => !r.success);

  if (failures.length > 0) {
    throw new Error(`Failed to create ${failures.length} line item(s): ${JSON.stringify(failures)}`);
  }

  return quoteId;
}

/**
 * Fetches Custom Metadata records for pricing rules.
 * CMDT is free from DML limits and ideal for rule storage.
 */
export async function getPricingRules(ruleType: string): Promise<Record<string, unknown>[]> {
  const conn = await getSalesforceConnection();

  const query = `
    SELECT Id, DeveloperName, MasterLabel, RuleType__c,
           MinQuantity__c, MaxQuantity__c, DiscountPercent__c,
           ApprovalRequired__c, IsActive__c
    FROM CPQ_Discount_Tier__mdt
    WHERE RuleType__c = '${ruleType}'
    AND IsActive__c = true
    ORDER BY MinQuantity__c ASC
  `;

  const result = await conn.query<Record<string, unknown>>(query);
  return result.records;
}
