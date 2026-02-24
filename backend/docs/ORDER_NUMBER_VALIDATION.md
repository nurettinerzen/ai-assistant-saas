# Order Number Validation Contract

## Scope
This contract is used by `customer_data_lookup` across channels.

## Accepted Formats
- `ORD-123456`
- `ORDER_2024_001`
- `SIP 987654`
- `123456` (plain numeric ID)

## Validation Rules
- Supported prefixes: `ORD`, `ORDER`, `SIP`, `SIPARIS`
- Prefix body must be numeric (separators like `-`, `_`, space are allowed)
- Plain numeric identifiers are accepted
- Unknown alpha prefixes and alpha segments in body are rejected

## Rejected Examples
- `ORD-TEST-7890` (contains alpha segment in numeric body)
- `XYZ9999` (unsupported prefix)

## UX Contract on `VALIDATION_ERROR`
When order format is invalid, response must:
- Ask exactly one field (order number)
- Include one example format (`ORD-123456`)
- Persist with `messageType=clarification` (not `assistant_claim`)

## Test Data Guidance
- Happy-path tests must use env-backed real data:
  - `ORDER_NUMBER_VALID`
  - `ORDER_PHONE_LAST4` (for deterministic verification-complete flows)
- If required env vars are missing, scenarios should `SKIP`, not fail.
- `ORD-TEST-*` style identifiers are test/fake format and belong only in `VALIDATION_ERROR` scenarios.

