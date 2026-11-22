-- Rules the Prisma schema cannot express. Each one is named in a comment on
-- its model in schema.prisma; docs/DATABASE.md says why it exists.

-- One deployment is one shop. The row is created here, so the application
-- can always read it and only ever updates it.
ALTER TABLE "Business" ADD CONSTRAINT "Business_singleton" CHECK ("id" = 'main');
INSERT INTO "Business" ("id", "name", "updatedAt") VALUES ('main', 'Mi taller', CURRENT_TIMESTAMP);
ALTER TABLE "Business" ADD CONSTRAINT "Business_tax_rate_range" CHECK ("taxRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "Business" ADD CONSTRAINT "Business_warranty_not_negative" CHECK ("defaultWarrantyDays" >= 0);

-- Money and quantities that cannot be nonsense, whatever wrote them.
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_price_not_negative" CHECK ("unitPriceCents" >= 0);
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_totals_consistent"
  CHECK ("subtotalCents" >= 0 AND "taxCents" >= 0 AND "totalCents" = "subtotalCents" + "taxCents");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_not_negative"
  CHECK ("fromPriceCents" IS NULL OR "fromPriceCents" >= 0);
ALTER TABLE "FolioCounter" ADD CONSTRAINT "FolioCounter_last_positive" CHECK ("last" > 0);

-- A decided quote always says when and through which channel.
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_decision_recorded"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED') OR ("decidedAt" IS NOT NULL AND "decidedVia" IS NOT NULL));

-- "The quote the customer is looking at" is a single row: at most one quote
-- per order is live (sent or approved), and at most one is being drafted.
-- Two technicians sending at once, or a send racing an approval, end with
-- one of them refused by the database instead of two live quotes.
CREATE UNIQUE INDEX "Quote_one_live_per_order" ON "Quote" ("orderId") WHERE "status" IN ('SENT', 'APPROVED');
CREATE UNIQUE INDEX "Quote_one_draft_per_order" ON "Quote" ("orderId") WHERE "status" = 'DRAFT';

-- The order history is evidence: who approved what, and when. It can be
-- added to and never rewritten, by any role, the table owner included.
CREATE FUNCTION voltio_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "OrderEvent_append_only"
  BEFORE UPDATE OR DELETE ON "OrderEvent"
  FOR EACH ROW EXECUTE FUNCTION voltio_forbid_change();
