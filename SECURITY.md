# Security

tstack's skills give agents instructions, and its script runs Git and the GitHub CLI on your machine.
The skills never merge, deploy, delete or force-push without your explicit word, and `tstack.mjs` only reads GitHub, and writes nothing but a project's `.tstack/` folder, its `.git/info/exclude`, and skill links in a task's worktree.

## What to report

Report anything that lets a tstack agent act beyond what the skills say it may, such as:
- a playbook or script path that merges, pushes, deletes or runs a destructive command without the human's word;
- a way for text an agent reads, such as a PR comment or a file in the project, to make it run commands it should not;
- a path through `tstack.mjs` that writes anywhere else.

## How to report

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**.
Please don't open a public issue for a security problem.
