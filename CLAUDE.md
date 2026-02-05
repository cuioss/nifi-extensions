# Claude Code Configuration

All AI development guidelines for this project are located in: **`agents.md`**

This file contains:
- Project overview and architecture
- Development environment setup
- Testing instructions and standards
- Code style guidelines (Java and JavaScript)
- Pre-commit checklist and PR instructions
- Common development tasks
- Quick reference commands

Please refer to `agents.md` for complete guidance when working on this NiFi Extensions project.

## Git Workflow

All cuioss repositories have branch protection on `main`. Direct pushes to `main` are never allowed. Always use this workflow:

1. Create a feature branch: `git checkout -b <branch-name>`
2. Commit changes: `git add <files> && git commit -m "<message>"`
3. Push the branch: `git push -u origin <branch-name>`
4. Create a PR: `gh pr create --repo cuioss/nifi-extensions --head <branch-name> --base main --title "<title>" --body "<body>"`
5. Enable auto-merge: `gh pr merge --repo cuioss/nifi-extensions --auto --squash --delete-branch`
6. Wait for merge (check every ~60s): `while gh pr view --repo cuioss/nifi-extensions --json state -q '.state' | grep -q OPEN; do sleep 60; done`
7. Return to main: `git checkout main && git pull`

## Temporary Files

- Use `.plan/temp/` for ALL temporary files (covered by `Write(.plan/**)` permission - avoids permission prompts)