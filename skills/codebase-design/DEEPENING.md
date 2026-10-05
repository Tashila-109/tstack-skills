# Deepening

How to merge a cluster of shallow modules into one deep module, given what it depends on.
The terms come from [codebase design](SKILL.md).

## Dependency categories

Classify each dependency of the candidate.
The category decides how the deepened module is tested across its seam.

1. In-process: pure computation or in-memory state with no I/O.
   Merge the modules and test through the new interface directly, with no adapter.
2. Local stand-in: a dependency with a local test double, such as PGLite for Postgres or an in-memory filesystem.
   Test the deepened module with the stand-in running in the suite.
   The seam stays internal, with no port on the module's interface.
3. Remote but owned: your own service across a network.
   Define a port at the seam and inject the transport as an adapter: HTTP or a queue in production, in-memory in tests.
   The logic stays in one deep module even though it is deployed across the network.
4. Third party: a service you do not control, such as a payment provider.
   Inject it as a port and give tests a mock adapter.

## Seam discipline

- Add a port only when at least two adapters are justified, usually production and test.
  A single-adapter seam is indirection.
- A deep module may have internal seams used by its own tests.
  Keep them out of its interface.

## Tests: replace, don't layer

- Write new tests at the deepened module's interface.
- Delete the old unit tests on the shallow modules once the interface tests cover their behavior.
- Assert on observable outcomes through the interface, not on internal state.
- A test that must change when the implementation changes is testing past the interface.
