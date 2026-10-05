---
name: codebase-design
description: Shared vocabulary for designing deep modules. Use when designing or improving a module's interface, finding deepening opportunities, placing a seam, making code more testable, or when another skill needs the deep-module vocabulary.
---

# Codebase design

Design deep modules: a lot of behavior behind a small interface, at a clean seam, tested through that interface.
Callers get leverage, maintainers get locality, and tests get one place to stand.

## Glossary

Use these terms exactly, so designs, briefs, and reviews speak one language.

**Module**: anything with an interface and an implementation, at any scale: a function, a class, a package, or a slice across tiers.
_Avoid_: unit, component, service.

**Interface**: everything a caller must know to use the module correctly: the types, plus invariants, ordering, error modes, required configuration, and performance.
_Avoid_: API, signature.

**Implementation**: the code inside a module.

**Depth**: how much behavior a caller or test can use per unit of interface it must learn.
A module is deep when a small interface hides a lot of behavior, and shallow when the interface is nearly as complex as the implementation.

**Seam**: the place where a module's interface lives, where behavior can change without editing the callers.
Where the seam goes is its own decision, separate from what sits behind it.
_Avoid_: boundary.

**Adapter**: a concrete thing that satisfies an interface at a seam.
The word names the role, not the size.

**Leverage**: what callers get from depth: more capability per unit of interface learned.

**Locality**: what maintainers get from depth: change, bugs, and verification concentrate in one module.

## Principles

- Depth belongs to the interface.
  A deep module can be built from small parts; they stay out of its interface.
- Apply the deletion test: imagine deleting the module.
  If complexity vanishes, it was a pass-through.
  If complexity reappears in every caller, it earns its place.
- The interface is the test surface.
  Callers and tests cross the same seam; a test that needs to reach past the interface signals the wrong shape.
- One adapter is a hypothetical seam, and two adapters make a real one.
  Add a seam only when something varies across it, usually production and test.

When shaping an interface, ask whether it can have fewer methods, simpler parameters, or hide more inside.

## Testable interfaces

Accept dependencies instead of creating them:

```typescript
function processOrder(order: Order, gateway: PaymentGateway) {}
```

Return results instead of producing side effects:

```typescript
function calculateDiscount(cart: Cart): Discount {}
```

A smaller interface needs fewer tests and simpler setup.

## Going deeper

- [Deepening](DEEPENING.md): merging shallow modules given their dependencies, seam discipline, and replacing old tests.
- [Design it twice](DESIGN-IT-TWICE.md): comparing radically different interfaces before choosing one.
