### Autopilot-stack

**Main runs this program; it is not a lead's playbook.** For "autopilot-stack", "stack them, don't ship", and "build the stack, I'll land it". The sibling of [Autopilot-full](autopilot-full.md): the same leads and the same audits, but nothing merges. The deliverable is one linear stack of verified PRs that the human reviews and lands.

1. **Hold the human's gates.** State-then-wait, so a request to state the plan is not a go. Record the queue and its order in `<home>/autopilot-<name>.md`. On the human's stop, every lead takes an immediate hold.
2. **Build the chain in order.** Launch one lead per item, in the stack's order, each in its own task with `pr` delivery:
   - the first item's lead branches from the default branch, and its PR targets the default branch;
   - each later item's lead branches from the previous item's task branch at its verified head, and its PR targets that branch.

   Launch the next lead once the previous PR is stack-ready, so it builds on verified code. Each brief adds: open the PR ready as soon as the first verified stage is committed, babysit it in `drive` mode until it is green, and report stack-ready with the head SHA.
3. **Audit each link.** A PR enters the stack only with a clean audit, as Autopilot-full step 4 says, with stack-ready in place of merge-ready. Nothing enters the stack unverified.
4. **Never merge, arm auto-merge, or close.** A clean audit appends the PR to the chain, in the human's order.
5. **Absorb drift without rewriting history.** When the default branch moves, bring it into the root PR with `gh pr update-branch <root>`, then cascade down the chain, bringing each parent into its child the same way. These are merges, never force-pushes. When a merge conflicts in a lead's files, that lead resolves it on its own branch. After each update, compare every link's patch-id with its audited one as [Shipping](shipping.md#landing-main) does, and send any link whose patch changed back through step 3. Re-run checks after every update, even when the patch-id is unchanged.
6. **Deliver the chain.** Give the human the stack's root and tip URLs, with each link's audit summary in its PR as a comment. The human reviews and lands it, bottom up, or asks main to land it under [Shipping](shipping.md).

**Choosing between the autopilots.** Autopilot-full when the PRs are independent and the human grants merging. Autopilot-stack when the human wants to review before landing, when the work is sequenced or coupled, or when the human keeps the merges.

**Reply:** links to the stack's root and tip, a one-line audit summary per link, and anything parked or excluded with the reason.
