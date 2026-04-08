/**
 * Quote Management Tools
 * Exposed via MCP for agent consumption.
 *
 * Creates and manages Salesforce Quotes using standard objects only.
 * No CPQ managed package objects required.
 */

import { z } from 'zod';
import { createQuoteWithLineItems, getSalesforceConnection } from '../salesforce/client.js';
import { calculatePrice, PricingResult } from '../pricing/engine.js';

// ─── Tool Input Schemas ───────────────────────────────────────────────────────

export const CreateQuoteSchema = z.object({
  opportunityId: z.string().describe('Salesforce Opportunity ID to attach quote to'),
  quoteName: z.string().describe('Name for this quote'),
  pricebookId: z.string().describe('Pricebook2 ID to use for pricing'),
  lineItems: z.array(z.object({
    pricebookEntryId: z.string(),
    productId: z.string(),
    quantity: z.number().positive(),
    manualUnitPrice: z.number().optional().describe(
      'Override unit price. If omitted, price is calculated by the pricing engine.'
    ),
    termMonths: z.number().optional().describe('Contract term in months'),
  })).min(1).describe('Line items to include in the quote'),
});

export const GetQuoteSchema = z.object({
  quoteId: z.string().describe('Salesforce Quote ID'),
});

export const SubmitForApprovalSchema = z.object({
  quoteId: z.string().describe('Quote ID to submit'),
  comments: z.string().optional().describe('Optional comments for the approver'),
});

// ─── Tool Handlers ────────────────────────────────────────────────────────────

/**
 * create_quote
 * Runs each line item through the pricing engine, then creates the
 * Quote and QuoteLineItems in Salesforce.
 *
 * Returns the Quote ID, total price, and a summary of discounts applied.
 */
export async function handleCreateQuote(
  input: z.infer<typeof CreateQuoteSchema>
) {
  const pricingResults: PricingResult[] = [];

  // Run every line item through the pricing engine
  for (const item of input.lineItems) {
    // Fetch list price from pricebook entry (simplified — real impl queries SF)
    const listPrice = item.manualUnitPrice ?? 100; // Placeholder list price

    const pricing = await calculatePrice({
      productId: item.productId,
      pricebookEntryId: item.pricebookEntryId,
      listPrice,
      quantity: item.quantity,
      termMonths: item.termMonths,
    });

    pricingResults.push(pricing);
  }

  const requiresApproval = pricingResults.some((p) => p.requiresApproval);

  // Create the quote in Salesforce
  const lineItemsForSF = input.lineItems.map((item, idx) => ({
    Product2Id: item.productId,
    PricebookEntryId: item.pricebookEntryId,
    Quantity: item.quantity,
    UnitPrice: pricingResults[idx].unitNetPrice,
    Description: `Net price after ${pricingResults[idx].discountsApplied.length} discount rule(s)`,
  }));

  const quoteId = await createQuoteWithLineItems(
    input.opportunityId,
    input.quoteName,
    input.pricebookId,
    lineItemsForSF
  );

  const totalNetPrice = pricingResults.reduce((sum, p) => sum + p.netPrice, 0);
  const totalListPrice = pricingResults.reduce((sum, p) => sum + p.totalListPrice, 0);

  return {
    quoteId,
    quoteName: input.quoteName,
    totalListPrice,
    totalNetPrice,
    totalDiscount: totalListPrice - totalNetPrice,
    requiresApproval,
    approvalReasons: pricingResults
      .filter((p) => p.requiresApproval)
      .map((p) => p.approvalReason),
    lineItemSummary: pricingResults.map((p, idx) => ({
      productId: p.productId,
      quantity: p.quantity,
      listPrice: p.listPrice,
      netPrice: p.netPrice,
      discountsApplied: p.discountsApplied.map((d) => ({
        rule: d.ruleName,
        percent: d.discountPercent,
      })),
    })),
  };
}

/**
 * get_quote
 * Retrieves a Quote with its line items and current approval status.
 */
export async function handleGetQuote(input: z.infer<typeof GetQuoteSchema>) {
  const conn = await getSalesforceConnection();

  const quote = await conn.sobject('Quote').retrieve(input.quoteId) as Record<string, unknown>;

  const lineItemsResult = await conn.query<Record<string, unknown>>(
    `SELECT Id, Product2Id, Product2.Name, Quantity, UnitPrice, TotalPrice, Description
     FROM QuoteLineItem
     WHERE QuoteId = '${input.quoteId}'`
  );

  return {
    quoteId: input.quoteId,
    quoteName: quote.Name,
    status: quote.Status,
    opportunityId: quote.OpportunityId,
    totalPrice: quote.TotalPrice,
    lineItems: lineItemsResult.records.map((li) => ({
      id: li.Id,
      productName: (li.Product2 as Record<string, unknown>)?.Name ?? 'Unknown',
      quantity: li.Quantity,
      unitPrice: li.UnitPrice,
      totalPrice: li.TotalPrice,
    })),
  };
}

/**
 * submit_for_approval
 * Submits a quote through the Salesforce Approval Process.
 * Returns the approval process instance ID for tracking.
 */
export async function handleSubmitForApproval(
  input: z.infer<typeof SubmitForApprovalSchema>
) {
  const conn = await getSalesforceConnection();

  const result = await (conn as any).requestPost('/services/data/v59.0/process/approvals/', {
    requests: [{
      actionType: 'Submit',
      contextId: input.quoteId,
      comments: input.comments ?? 'Submitted via CPQ MCP Server',
    }],
  });

  return {
    submitted: true,
    quoteId: input.quoteId,
    approvalInstanceId: result?.results?.[0]?.instanceId ?? null,
    message: 'Quote submitted for approval. Approver has been notified.',
  };
}
