# CPQ MCP Server for Salesforce
## Replacing the Managed Package with an Agent-Native Framework

**Author:** Justin Stroud
**Date:** April 2026

---

## The Problem with Salesforce CPQ Today

Salesforce CPQ is delivered as a managed package. That model made sense in 2016. It does not make sense in 2026, and here's why:

**Opacity.** Pricing logic lives inside a package you cannot inspect, version, or meaningfully debug. *When something breaks — and it does — you're at the mercy of Salesforce Support and release schedules you don't control.*

**Governor Limit Overhead.** The managed package executes in your org's context, consuming DML operations, SOQL queries, CPU time, and heap allocation. On high-volume orgs, CPQ alone can account for 30–40% of governor limit consumption on quote-heavy transactions.

**AI Incompatibility.** The managed package was not designed to be called by an agent. It has no clean API surface for an LLM to reason about. *AgentForce can trigger Flows that touch CPQ, but there's no conversational interface to pricing logic, product rules, or quote generation.* You can't ask an agent "what's the best bundle for this customer given their current contract?" and have CPQ answer meaningfully.

**Lock-in.** Every customization is a workaround. Price rules, product rules, and configuration options live in managed objects you can't refactor. Migrations are painful. Upgrades are risky.

---

## The Solution: CPQ as an MCP Server

Model Context Protocol (MCP) defines a standard interface for exposing capabilities as tools that AI agents can call. An MCP server for CPQ externalizes the entire CPQ domain — product configuration, pricing logic, quote generation, approval routing — as a set of composable, inspectable, agent-callable tools.

The managed package is replaced not with another black box, but with a transparent service layer that:

- Lives outside the managed package constraint entirely
- Reads and writes Salesforce data directly via the REST/Bulk API
- Exposes pricing and configuration logic as versioned, testable TypeScript
- Can be invoked by AgentForce, Claude, or any MCP-compatible client
- Persists custom pricing rules in Custom Metadata (CMDT) — fully org-deployable, fully version-controlled

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Client Layer                          │
│         (AgentForce Agent / Claude / Custom LLM Client)          │
└────────────────────────────┬────────────────────────────────────┘
                             │  MCP Protocol (JSON-RPC over stdio/SSE)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CPQ MCP Server (Bun/TypeScript)               │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Product Tools   │  │  Pricing Engine  │  │  Quote Tools  │  │
│  │                 │  │                  │  │               │  │
│  │ get_catalog     │  │ calculate_price  │  │ create_quote  │  │
│  │ configure_item  │  │ apply_discounts  │  │ get_quote     │  │
│  │ validate_config │  │ evaluate_bundles │  │ submit_quote  │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                    │                     │           │
│  ┌────────▼────────────────────▼─────────────────────▼───────┐  │
│  │                   Salesforce Adapter                        │  │
│  │         (REST API / Bulk API / Custom Metadata)             │  │
│  └─────────────────────────────┬──────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Salesforce Org                             │
│                                                                  │
│   Product2 / PricebookEntry    Opportunity / OpportunityLineItem │
│   Custom Metadata (Pricing Rules, Discount Tiers, Bundles)      │
│   Quote / QuoteLineItem (standard objects, no CPQ package)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Exposed Tools (MCP Interface)

### Product & Configuration

| Tool | Description |
|------|-------------|
| `get_product_catalog` | Returns available products filtered by segment, pricebook, or feature flags |
| `configure_product` | Applies configuration rules to a product selection; returns valid option sets |
| `validate_configuration` | Runs constraint rules against a proposed configuration; returns pass/fail with reasons |
| `get_bundle_options` | Returns eligible bundles given a seed product and customer context |

### Pricing Engine

| Tool | Description |
|------|-------------|
| `calculate_price` | Computes list price, applicable discounts, and net price for a configuration |
| `apply_discount` | Applies a manual or rule-driven discount; enforces approval thresholds |
| `get_approval_requirements` | Returns what approvals are needed for a given quote before submission |
| `evaluate_promo_eligibility` | Checks active promotions against customer/opportunity context |

### Quote Management

| Tool | Description |
|------|-------------|
| `create_quote` | Creates a Quote with QuoteLineItems in Salesforce from a finalized configuration |
| `get_quote` | Retrieves quote details including line items, pricing, and approval status |
| `submit_for_approval` | Submits a quote through the configured approval chain |
| `generate_quote_document` | Triggers document generation (PDF) via a Flow or external template engine |

---

## Pricing Rules: From Black Box to Custom Metadata

One of the most important architectural decisions in this framework is where pricing logic lives. In the managed package, it lives in package-owned objects you can't meaningfully control. Here, it lives in Custom Metadata types (CMDT) that are:

- Deployable via SFDX
- Version-controlled in source
- Readable at runtime without DML limits
- Modifiable by admins without code changes

Example CMDT types:

```
CPQ_Discount_Tier__mdt       — volume/term discount schedules
CPQ_Bundle_Rule__mdt         — which products can/must be bundled
CPQ_Approval_Threshold__mdt  — discount % above which approval is required
CPQ_Promo__mdt               — time-bounded promotional pricing rules
```

The pricing engine reads these at runtime and applies them in a deterministic, testable, logged sequence. Every pricing decision is auditable.

---

## The AI Advantage

This is where the architectural shift becomes genuinely transformative. An agent using this MCP server can have a conversation like:

> *"The customer is renewing a 3-year Enterprise contract. They have 450 seats. What's the best bundle for them, and can I approve the discount myself or do I need sign-off?"*

The agent calls `get_bundle_options`, then `calculate_price`, then `get_approval_requirements` — in sequence, with context carried between calls. It returns a structured answer with the recommended configuration, net price, and whether the rep has approval authority.

This is not possible with the managed package. There is no interface for it. The CPQ MCP server makes it the default experience.

> This is borne out with on-the-ground experience. To interface with Salesforce CPQ, you have to interact with the framework via a motley crew of opaque objects and components.

---

## Why This Matters at Scale

For a multi-billion dollar organization, the managed package model introduces three scaling risks:

1. **Upgrade risk** — Managed package upgrades in production orgs require extensive regression testing. With this framework, the pricing engine and its rules are under your version control. You control the release schedule.

2. **Governor limit headroom** — Removing the managed package's query and DML footprint frees significant governor limit capacity for high-volume quote operations.

3. **Vendor dependency** — CPQ licensing is a recurring cost with contractual lock-in. Replacing it with an open, internal framework eliminates that dependency entirely.

---

## Current State of This Prototype

The skeleton code (see `cpq-mcp-server/`) demonstrates:

- MCP server initialization with tool registration
- Full tool schema definitions for all major CPQ capabilities
- Salesforce connection via jsforce with credential handling
- Working implementations of `get_product_catalog`, `calculate_price`, and `create_quote`
- Custom Metadata pricing rule evaluation (stub with realistic structure)
- Error handling and response formatting per MCP spec

**Runtime: Bun.** The server uses [Bun](https://bun.sh) as its JavaScript runtime — not Node. Bun loads `.env` natively (no dotenv dependency), runs TypeScript directly without a compile step, and has a substantially smaller attack surface. Start the server with `bun src/index.ts` or `bun --watch src/index.ts` for development.

The remaining tools are stubbed with documented interfaces. They'll get fleshed out if there is interest in this solution.

