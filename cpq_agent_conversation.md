## Synopsis

As part of the instructions given to Claude while building this out and coming up with an architecture, it became clear that a practical example was needed in order to show how this tool would work in the wild.

At the end of the day, that is what it is: a tool (more specifically, a CPQ tool.) In this regard, there is little difference between using a tool like this and a tool like shell scripts. Integrating with tools is why MCP exists.

These are just a few examples. Other use cases include a Salesperson being proactive and running numbers against several accoouns to see how they can maximize the opportunities out there. Since how they are selling is just as important as what, this gives the Salesperson flexibility to consider soft parameters that would usually be part of their own arsenal. Building a quote in the current manner takes time, and time can cause doubt. 


# Sample Agent Conversation — CPQ MCP Server
## Scenario: Enterprise Renewal with Bundle Negotiation

*This transcript shows a salesperson working with an AgentForce agent that has been configured with the CPQ MCP Server tools. Italicized annotations show the tool calls the agent makes behind the scenes — invisible to the salesperson, but available to inspect in logs.*

---

### Context
Sarah is an account executive working on a renewal for Meridian Health Systems, a 3-year Enterprise customer. Their contract is up in 45 days. She's in Salesforce, opens the Opportunity, and activates the agent.

---

**Sarah:**
> Hey, I'm looking at the Meridian Health renewal — Opportunity ID is 006Qs000003xBzT. They've been with us 3 years, currently on 200 seats. They're asking about expanding to 450 seats with a 2-year term. What can I put in front of them?

*→ Agent calls `get_product_catalog` to retrieve Sarah's active pricebook entries.*
*→ Agent calls `get_bundle_options` with the current product ID and "Enterprise" customer segment.*

**Agent:**
> Pulled up Meridian's opportunity. Based on their current Enterprise product and the 450-seat expansion, here's what's available:
>
> **Current configuration:** 200 seats, Standard Support, annual term
>
> **Two bundle options come back for a 450-seat renewal:**
>
> **Option A — Enterprise Suite**
> Includes: Core Platform + Premium Support + Onboarding Services
> List price: $312,750/year
>
> **Option B — Core + Support**
> Includes: Core Platform + Standard Support
> List price: $274,500/year
>
> Want me to run the numbers on either of these with the 2-year term and 450 seats?

---

**Sarah:**
> Yeah, run Option A. And see what kind of discount I can give them — they're going to push back on price.

*→ Agent calls `calculate_price` with: productId for Enterprise Suite, quantity=450, termMonths=24.*
*→ Pricing engine evaluates CPQ_Discount_Tier__mdt (Volume rules) — 450 seats hits the 401–500 tier: 12% volume discount.*
*→ Pricing engine evaluates CPQ_Discount_Tier__mdt (Term rules) — 24-month term hits the 24-month tier: 5% term discount.*
*→ Engine computes combined discount, checks CPQ_Approval_Threshold__mdt — combined 17% is within the 20% self-approval threshold.*

**Agent:**
> Here's the full pricing breakdown for Option A at 450 seats, 2-year term:
>
> | | |
> |---|---|
> | List price (450 × $695) | $312,750 |
> | Volume discount (401–500 seats tier) | −12% / −$37,530 |
> | 2-year term discount | −5% / −$15,638 |
> | **Net price** | **$259,582/year** |
> | **Total contract value** | **$519,164** |
>
> **Good news:** The combined 17% discount is within your self-approval threshold. You can close this without going to your manager.
>
> The discount story is clean to tell Meridian — volume pricing for their growth plus a term commitment reward. Nothing arbitrary.
>
> Want me to build the quote, or do you want to explore what happens if they push for more?

---

**Sarah:**
> What if they want 20%? Is that still mine to give?

*→ Agent calls `get_approval_requirements` — evaluates CPQ_Approval_Threshold__mdt for 20% combined discount.*
*→ Result: 20% is exactly at the boundary — self-approval threshold is ≤20%, so 20% is still within limit. 21%+ requires manager approval.*

**Agent:**
> 20% is still yours to give — you're right at the edge of your threshold. Anything above 20% goes to your manager for sign-off.
>
> At 20% combined, here's what the numbers look like:
>
> | | |
> |---|---|
> | List price | $312,750 |
> | 20% combined discount | −$62,550 |
> | **Net price** | **$250,200/year** |
> | **Total contract value** | **$500,400** |
>
> That's a $500K deal you can close today. If Meridian wants to negotiate below $250K/year, you'd need your manager in the conversation.
>
> My suggestion: lead with the 17% (the "earned" number — volume + term), and position the extra 3% as a loyalty acknowledgment for the 3-year relationship. That's a more defensible story than just meeting their counteroffer.

---

**Sarah:**
> I like that framing. Let's go with 17% and build the quote. Name it "Meridian Health — Enterprise Renewal 2026."

*→ Agent calls `create_quote` with: opportunityId=006Qs000003xBzT, quoteName="Meridian Health — Enterprise Renewal 2026", pricebookId, and line items for Enterprise Suite at 450 seats, 24-month term.*
*→ Pricing engine re-runs to confirm discount calculation.*
*→ Agent calls Salesforce REST API — creates Quote record, creates QuoteLineItem records with net unit price applied.*

**Agent:**
> Quote created. Here's the summary:
>
> **Quote ID:** Q-2026-00847
> **Quote Name:** Meridian Health — Enterprise Renewal 2026
> **Status:** Draft
>
> **Line Items:**
> - Enterprise Suite — 450 seats × $575.74 net = $259,582/year
>   *(Volume: −12%, Term: −5%)*
>
> **Total contract value (2 years):** $519,164
> **Approval required:** No
>
> The quote is on the Opportunity now. Ready to send when you are — want me to trigger document generation, or are you reviewing it first?

---

**Sarah:**
> Generate the doc. I'll review before I send.

*→ Agent calls `generate_quote_document` — triggers the configured document generation Flow in Salesforce, which produces a PDF quote template.*

**Agent:**
> Document generated and attached to the quote. You'll find it under the Files related list on Q-2026-00847.
>
> One thing worth flagging: Meridian's contract expires in 45 days. If this goes to a second round of negotiation and they push above 20%, loop your manager in early — approval cycles can take 2–3 days and you don't want a timing issue on a $500K deal.

---

### What This Demonstrates

**For the interviewer:** Every response above required the agent to chain multiple tool calls, carry context forward between them, and synthesize the results into a natural language answer. The salesperson never saw a pricing form, never toggled between tabs, never had to know what a `PricebookEntry` is.

**The managed package cannot do this.** There is no conversational interface to CPQ pricing logic. A rep using standard Salesforce CPQ would have navigated to a Quote, manually added products, applied discounts through a UI, and checked approval rules in a separate screen — with no agent to help reason about strategy.

**The transparency point:** When the agent said "volume pricing for their growth plus a term commitment reward — nothing arbitrary," that's only possible because the pricing engine exposes *why* the discount was applied. The `pricingTrace` array in `calculate_price` powers that explanation. The managed package cannot tell you why it calculated a number.

**The audit story:** Every discount, every rule that fired, and every approval threshold check is logged. For a regulated industry like healthcare, that matters.
