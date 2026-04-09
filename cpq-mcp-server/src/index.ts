/**
 * CPQ MCP Server
 *
 * Replaces the Salesforce CPQ managed package with an agent-native,
 * composable framework. Exposes CPQ capabilities as MCP tools that any
 * MCP-compatible client (AgentForce, Claude, custom LLM agents) can call.
 *
 * Runtime: Bun — run with `bun src/index.ts` or `bun --watch src/index.ts`
 * Bun loads .env automatically; no dotenv import needed.
 *
 * Author: Justin Stroud
 *
 * Architecture:
 *   MCP Client (AgentForce / Claude)
 *     └── MCP Protocol (JSON-RPC)
 *           └── CPQ MCP Server (this file)
 *                 ├── Product Tools   → Salesforce Product2 / PricebookEntry
 *                 ├── Pricing Engine  → Custom Metadata pricing rules
 *                 └── Quote Tools     → Standard Quote / QuoteLineItem objects
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  GetProductCatalogSchema,
  ConfigureProductSchema,
  ValidateConfigurationSchema,
  handleGetProductCatalog,
  handleConfigureProduct,
  handleValidateConfiguration,
} from './tools/productTools.js';

import {
  CreateQuoteSchema,
  GetQuoteSchema,
  SubmitForApprovalSchema,
  handleCreateQuote,
  handleGetQuote,
  handleSubmitForApproval,
} from './tools/quoteTools.js';

// ─── Server Initialization ────────────────────────────────────────────────────

const server = new McpServer({
  name: 'cpq-mcp-server',
  version: '0.1.0',
});

// ─── Product & Configuration Tools ───────────────────────────────────────────

server.tool(
  'get_product_catalog',
  'Retrieve available products and their list prices from Salesforce. ' +
  'Filter by pricebook, product family, or search term.',
  GetProductCatalogSchema.shape,
  async (input) => {
    const result = await handleGetProductCatalog(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'configure_product',
  'Apply configuration rules to a product selection. ' +
  'Returns valid option sets and available choices for each option group.',
  ConfigureProductSchema.shape,
  async (input) => {
    const result = await handleConfigureProduct(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'validate_configuration',
  'Validate a proposed product configuration against constraint rules. ' +
  'Returns pass/fail with specific reasons for any violations.',
  ValidateConfigurationSchema.shape,
  async (input) => {
    const result = await handleValidateConfiguration(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// ─── Quote Management Tools ───────────────────────────────────────────────────

server.tool(
  'create_quote',
  'Create a Salesforce Quote with line items. ' +
  'Each line item is automatically priced by the pricing engine, applying volume ' +
  'and term discounts from Custom Metadata rules. Returns quote ID, net price, ' +
  'and whether approvals are required.',
  CreateQuoteSchema.shape,
  async (input) => {
    const result = await handleCreateQuote(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'get_quote',
  'Retrieve a Salesforce Quote with its line items and current approval status.',
  GetQuoteSchema.shape,
  async (input) => {
    const result = await handleGetQuote(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'submit_for_approval',
  'Submit a quote through the Salesforce Approval Process. ' +
  'Returns the approval process instance ID for status tracking.',
  SubmitForApprovalSchema.shape,
  async (input) => {
    const result = await handleSubmitForApproval(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// ─── Stub Tools (demonstrating interface completeness) ───────────────────────

server.tool(
  'get_bundle_options',
  'Return eligible product bundles for a given seed product and customer context. ' +
  'Uses CPQ_Bundle_Rule__mdt to determine valid combinations.',
  {
    productId: z.string().describe('Seed product ID'),
    opportunityId: z.string().describe('Opportunity for customer context'),
    customerSegment: z.string().describe('e.g., Enterprise, SMB, Public Sector'),
  },
  async (input) => ({
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        message: 'Bundle evaluation — full implementation reads CPQ_Bundle_Rule__mdt',
        productId: input.productId,
        bundleOptions: [
          { bundleName: 'Enterprise Suite', includes: ['Product A', 'Product B', 'Support'], discount: '15%' },
          { bundleName: 'Core + Support', includes: ['Product A', 'Standard Support'], discount: '8%' },
        ],
      }, null, 2),
    }],
  })
);

server.tool(
  'get_approval_requirements',
  'Check what approvals are required for a quote before submission.',
  {
    quoteId: z.string().describe('Quote ID to evaluate'),
  },
  async (input) => ({
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        quoteId: input.quoteId,
        requiresApproval: false,
        approvalSteps: [],
        message: 'Full implementation evaluates CPQ_Approval_Threshold__mdt against quote discount',
      }, null, 2),
    }],
  })
);

// ─── Transport & Start ────────────────────────────────────────────────────────

const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);
  console.error('CPQ MCP Server running. Listening for MCP connections via stdio.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
