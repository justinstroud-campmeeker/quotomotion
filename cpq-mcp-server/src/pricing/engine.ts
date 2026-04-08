/**
 * Pricing Engine
 *
 * This is the heart of the CPQ MCP Server. Instead of opaque managed package
 * logic, pricing rules are evaluated here — transparently, in logged sequence,
 * against Custom Metadata fetched from Salesforce.
 *
 * Every pricing decision is traceable. Every rule application is auditable.
 */

import { getPricingRules } from '../salesforce/client.js';

export interface PricingInput {
  productId: string;
  pricebookEntryId: string;
  listPrice: number;
  quantity: number;
  termMonths?: number;
  customerSegment?: string;
  opportunityId?: string;
}

export interface DiscountApplication {
  ruleId: string;
  ruleName: string;
  ruleType: 'volume' | 'term' | 'promotional' | 'manual';
  discountPercent: number;
  appliedAmount: number;
  requiresApproval: boolean;
  reason: string;
}

export interface PricingResult {
  productId: string;
  listPrice: number;
  quantity: number;
  totalListPrice: number;
  discountsApplied: DiscountApplication[];
  totalDiscount: number;
  netPrice: number;
  unitNetPrice: number;
  requiresApproval: boolean;
  approvalReason?: string;
  pricingTrace: string[];
}

/**
 * Main pricing calculation entry point.
 * Applies all eligible rules in priority order and returns a full audit trail.
 */
export async function calculatePrice(input: PricingInput): Promise<PricingResult> {
  const trace: string[] = [];
  const discountsApplied: DiscountApplication[] = [];

  const totalListPrice = input.listPrice * input.quantity;
  trace.push(`Base price: $${input.listPrice} × ${input.quantity} = $${totalListPrice}`);

  // Apply volume discounts
  const volumeDiscounts = await applyVolumeDiscounts(input, trace);
  discountsApplied.push(...volumeDiscounts);

  // Apply term discounts (if multi-year deal)
  if (input.termMonths && input.termMonths > 12) {
    const termDiscounts = await applyTermDiscounts(input, trace);
    discountsApplied.push(...termDiscounts);
  }

  // Calculate net
  const totalDiscountPercent = discountsApplied.reduce(
    (sum, d) => sum + d.discountPercent, 0
  );

  // Cap combined discount at 100%
  const effectiveDiscountPercent = Math.min(totalDiscountPercent, 100);
  const totalDiscount = totalListPrice * (effectiveDiscountPercent / 100);
  const netPrice = totalListPrice - totalDiscount;
  const unitNetPrice = netPrice / input.quantity;

  trace.push(`Total discount: ${effectiveDiscountPercent.toFixed(2)}% = -$${totalDiscount.toFixed(2)}`);
  trace.push(`Net price: $${netPrice.toFixed(2)} ($${unitNetPrice.toFixed(2)}/unit)`);

  // Determine approval requirements
  const requiresApproval = discountsApplied.some((d) => d.requiresApproval);
  const approvalReason = requiresApproval
    ? discountsApplied
        .filter((d) => d.requiresApproval)
        .map((d) => d.reason)
        .join('; ')
    : undefined;

  if (requiresApproval) {
    trace.push(`⚠ Approval required: ${approvalReason}`);
  }

  return {
    productId: input.productId,
    listPrice: input.listPrice,
    quantity: input.quantity,
    totalListPrice,
    discountsApplied,
    totalDiscount,
    netPrice,
    unitNetPrice,
    requiresApproval,
    approvalReason,
    pricingTrace: trace,
  };
}

/**
 * Applies volume-based discount tiers from Custom Metadata.
 * Replaces CPQ's PriceRule/PriceAction objects entirely.
 */
async function applyVolumeDiscounts(
  input: PricingInput,
  trace: string[]
): Promise<DiscountApplication[]> {
  const rules = await getPricingRules('Volume');
  const applied: DiscountApplication[] = [];

  for (const rule of rules) {
    const min = (rule.MinQuantity__c as number) ?? 0;
    const max = (rule.MaxQuantity__c as number) ?? Infinity;

    if (input.quantity >= min && input.quantity <= max) {
      const discountPercent = rule.DiscountPercent__c as number;
      const appliedAmount = input.listPrice * input.quantity * (discountPercent / 100);
      const requiresApproval = (rule.ApprovalRequired__c as boolean) ?? false;

      trace.push(
        `Volume rule "${rule.MasterLabel}" matched (qty ${min}-${max}): ${discountPercent}% discount`
      );

      applied.push({
        ruleId: rule.Id as string,
        ruleName: rule.MasterLabel as string,
        ruleType: 'volume',
        discountPercent,
        appliedAmount,
        requiresApproval,
        reason: requiresApproval
          ? `Volume discount of ${discountPercent}% exceeds self-approval threshold`
          : '',
      });
    }
  }

  return applied;
}

/**
 * Applies term-length discounts (e.g., 5% for 2-year, 10% for 3-year).
 * Rules stored in CPQ_Discount_Tier__mdt with RuleType__c = 'Term'.
 */
async function applyTermDiscounts(
  input: PricingInput,
  trace: string[]
): Promise<DiscountApplication[]> {
  if (!input.termMonths) return [];

  const rules = await getPricingRules('Term');
  const applied: DiscountApplication[] = [];

  for (const rule of rules) {
    const minMonths = (rule.MinQuantity__c as number) ?? 0;
    const maxMonths = (rule.MaxQuantity__c as number) ?? Infinity;

    if (input.termMonths >= minMonths && input.termMonths <= maxMonths) {
      const discountPercent = rule.DiscountPercent__c as number;
      const appliedAmount = input.listPrice * input.quantity * (discountPercent / 100);

      trace.push(
        `Term rule "${rule.MasterLabel}" matched (${input.termMonths} months): ${discountPercent}% discount`
      );

      applied.push({
        ruleId: rule.Id as string,
        ruleName: rule.MasterLabel as string,
        ruleType: 'term',
        discountPercent,
        appliedAmount,
        requiresApproval: false,
        reason: '',
      });
    }
  }

  return applied;
}
