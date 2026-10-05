# CONTEXT.md format

```md
# {Context name}

{One or two sentences on what this context is and why it exists.}

## Language

**Order**:
A customer's request to buy one or more products.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request
```

## Rules

- Pick one word per concept and list the rejected synonyms under `_Avoid_`.
- Define what the term is, not what it does, in one or two sentences.
- Include only terms specific to this project.
  General programming concepts such as timeouts or error types stay out even when the project uses them heavily.
- Group terms under subheadings when natural clusters appear; a flat list is fine otherwise.

## Context map

A multi-context project lists its contexts and their relationships in a root `CONTEXT-MAP.md`:

```md
# Context map

## Contexts

- Ordering (`src/ordering/CONTEXT.md`): receives and tracks customer orders
- Billing (`src/billing/CONTEXT.md`): generates invoices and takes payments

## Relationships

- Ordering to Billing: Ordering emits `OrderPlaced`; Billing consumes it to open an invoice
```
