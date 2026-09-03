---
name: release
description: Cut a project release — bump project.yml version, open and merge the release PR, wait for the automated Release workflow, then reformat the generated GitHub release notes
user-invocable: true
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

# Release Skill

Cuts a new project release end-to-end: determine the version, open the version-bump PR
that triggers the release, merge it, wait for the automated Release workflow, verify the
release landed, and reformat the auto-generated GitHub release notes.

## How the release is wired (read first)

The release is **fully automated by GitHub Actions**. `.github/workflows/release.yml`
triggers on a **merged pull request that changes `.github/project.yml`**:

```yaml
on:
  pull_request:
    types: [closed]
    paths:
      - '.github/project.yml'
```

So this skill never runs Maven release goals by hand. Its job is to produce and merge the
correct `project.yml` change; the reusable `cuioss-organization` release workflow does the
tagging, Maven Central deploy, and GitHub release creation.

Observed timings (use these as the basis for the waits below):
- PR gating checks: **Maven Build ~6–10 min, Integration Tests ~3.5 min, End-to-End Tests ~10–12 min** → end-to-end is the long pole, so a full green PR takes **~12–15 min**.
- Release workflow itself: **~6 min**, but Maven Central propagation and the GitHub release publish can lag → allow **up to ~30 min** before treating it as stuck.

## Workflow

### Step 1 — Determine the version number

Read the current release block:

```bash
# project.yml holds both numbers
```
Read `.github/project.yml` and look at:
- `release.current-version` (e.g. `0.4.0`)
- `release.next-version` (e.g. `0.5.0-SNAPSHOT`)

**Default rule:** the release version is `next-version` with `-SNAPSHOT` stripped
(normally a minor bump of the current version, e.g. `0.4.0` → `0.5.0`). The new
`next-version` is the next minor bump plus `-SNAPSHOT` (e.g. `0.6.0-SNAPSHOT`).

**Ask the user** (AskUserQuestion) only if in doubt — e.g. the numbers don't follow the
`X.Y.0` minor-bump pattern, a patch/major release is plausible, or `current-version` and
`next-version` are inconsistent. Otherwise state the determined version and proceed.

### Step 2 — Determine current status (clean to release?)

```bash
gh pr list --repo cuioss/nifi-extensions --state open --json number,title,isDraft
```
- **No open PRs** → good, proceed.
- **Open PRs exist** → these would normally be merged before a release. Surface the list
  and **ask the user** whether to proceed anyway or wait. Do not silently ignore them.

Also confirm the working tree is clean (`git status --porcelain`) before branching.

### Step 3 — Pull current main

```bash
git checkout main && git pull --ff-only origin main
```

### Step 4 — Create the release branch

Branch name uses the `chore/` prefix (required — the Maven CI workflow only triggers on
`main`, `feature/*`, `fix/*`, `chore/*`, `release/*`, `dependabot/**`; other prefixes skip
the `build` check and block auto-merge):

```bash
git checkout -b chore/release_<version>   # e.g. chore/release_0.5.0
```

### Step 5 — Update `.github/project.yml`

Edit the `release` block:
- `current-version:` → the version determined in Step 1 (e.g. `0.5.0`)
- `next-version:` → next minor + `-SNAPSHOT` (e.g. `0.6.0-SNAPSHOT`)

Leave everything else untouched.

### Step 6 — NiFi badge in README.adoc (only if NiFi changed)

Determine whether this release cycle included an **Apache NiFi version bump**. Compare the
NiFi badge currently in `README.adoc` (the `Apache%20NiFi-<version>` badge, around **line 9**)
against the NiFi version now in the build:

```bash
# current managed NiFi version
grep -E 'version\.nifi|nifi-extension-bundles' pom.xml
```
If the NiFi version in the build differs from the badge, update the badge line:

```
image:https://img.shields.io/badge/Apache%20NiFi-<NEW_VERSION>-1f6aa5[Apache NiFi,link=https://nifi.apache.org/]
```
If NiFi did not change, leave README.adoc alone.

### Step 7 — Commit, push, open PR

```bash
git add .github/project.yml
git diff --quiet HEAD -- README.adoc || git add README.adoc   # stage only if NiFi badge changed
git commit -m "chore(release): prepare release <version>"
git push -u origin chore/release_<version>
gh pr create --repo cuioss/nifi-extensions --base main \
  --label "skip-bot-review" \
  --title "chore(release): prepare release <version>" \
  --body "Bump current-version to <version>, next-version to <next>-SNAPSHOT. Triggers the automated Release workflow on merge."
```

The release PR is a mechanical version bump (`project.yml` + optional README badge) — no
code review is necessary, so it carries the **`skip-bot-review`** label to skip bot review.

Use the project commit convention: `Co-Authored-By: Claude <noreply@anthropic.com>` (no
model name / no "Generated with Claude Code" footer).

### Step 8 — Wait for PR checks (~15 min)

Watch the checks rather than blindly sleeping; the end-to-end suite is the long pole
(~12 min):

```bash
gh pr checks <pr#> --repo cuioss/nifi-extensions --watch
```
If using a scheduled/loop wait, poll roughly every few minutes up to ~15 min.

In practice the *release* PR is usually much faster (~1 min): it touches only
`.github/project.yml` and `README.adoc`, so the `check-changes` gates skip the build,
integration-test and e2e jobs. Watch the checks rather than assuming the full ~15 min —
but if a heavy job does run (e.g. the badge edit is bundled with other changes), let it
finish.

### Step 9 — Handle PR comments / failures (if any)

- If a check fails, read the failing run's log (`gh run view <id> --log-failed`), fix the
  cause on the branch, push, and re-wait. **Never** merge a red PR.
- If reviewers leave comments (`gh pr view <pr#> --comments`), address them on the branch.
- Re-run Step 8 after any push.

### Step 10 — Merge → release starts automatically

Once checks are green and comments resolved:

```bash
gh pr merge <pr#> --repo cuioss/nifi-extensions --squash
```

> **Note — `main` is behind the org-managed merge queue (`main-merge-queue`).** The command
> above **enqueues** the PR; it is not merged immediately. `--delete-branch` is rejected by
> the queue (it auto-deletes the head branch itself), so it is omitted. After
> `gh pr merge ... --squash`, poll until the PR reports `MERGED` before expecting the Release
> workflow to fire:
>
> ```bash
> gh pr view <pr#> --repo cuioss/nifi-extensions --json state --jq .state
> ```
>
> The Release workflow itself is unaffected: `cuioss-release-bot` is a bypass actor on
> `main-merge-queue`, so its direct push of the release commit + tag succeeds.

Merging this PR (it touches `.github/project.yml`) fires `release.yml` automatically — do
**not** dispatch the release manually unless the auto-trigger demonstrably did not fire.

### Step 11 — Wait for the Release workflow (~30 min)

```bash
gh run list --repo cuioss/nifi-extensions --workflow "Release" --limit 3 \
  --json status,conclusion,displayTitle,databaseId
# then watch the in-progress run
gh run watch <databaseId> --repo cuioss/nifi-extensions
```
The workflow itself runs ~6 min; allow up to ~30 min for tag + GitHub release publish +
Maven Central propagation before treating it as stuck.

### Step 12 — Verify the release landed

```bash
gh release view <version> --repo cuioss/nifi-extensions \
  --json tagName,name,createdAt,body
git fetch --tags && git tag --list <version>
```
Confirm the tag exists and a GitHub release for `<version>` was created. If it did not
appear, inspect the Release workflow run log before proceeding.

### Step 13 — Reformat the generated release notes

The Release workflow creates the GitHub release with **auto-generated** notes (a flat
`## What's Changed` list). Rewrite them in place using the **house format below**, then
push the update:

```bash
mkdir -p .plan/temp
gh release view <version> --repo cuioss/nifi-extensions --json body --jq .body > .plan/temp/release-<version>-orig.md
# ...build the reformatted body in .plan/temp/release-<version>.md...
# run the mandatory duplicate check below, THEN publish:
gh release edit <version> --repo cuioss/nifi-extensions --notes-file .plan/temp/release-<version>.md
```

#### House format rules (apply exactly)

1. **Three top-level groups, in this order:** `## Apache NiFi`, `## Features & Enhancements`,
   and `## Dependency Updates`.
2. **Apache NiFi is the headline** — the NiFi version is the single most important fact in
   a release, so it gets its **own top-level section at the very top**, never a bullet buried
   under dependencies. Open it with a one-line statement of the target version, then the PR
   line(s):

   ```
   ## Apache NiFi

   This release targets **Apache NiFi <new>** (previously <old>).

   * <PR line(s)>
   ```

   If NiFi did **not** change in this cycle, state the unchanged version on the same one-line
   form and omit the PR line. Never also list NiFi under `### Infra`.
3. **Features & Enhancements** — group functional PRs by theme with `###` subheadings, e.g.:
   - `### REST & Routing`
   - `### Security`
   - `### API & Code Quality` — also the home for refactor/standards/cleanup recipes
     (e.g. `refactor-to-profile-standards` belongs here, **not** under build/tooling)
   - `### Build & Dependency Governance` — build-file correctness and dependency-hygiene
     changes (e.g. guarding artifact families against version splits, Maven profile fixes)
   - `### Testing & Standards`
   - `### Documentation`
   Adapt theme headings to the actual PRs; omit empty sections.
4. **Dependency Updates** — group by type with `###` subheadings:
   - `### Java` — Java libraries (e.g. lombok, junit, parsson, token-sheriff-validation)
   - `### JavaScript` — npm deps (in `/nifi-cuioss-ui` or `/e-2-e-playwright`)
   - `### Infra` — platform/build/CI: build plugins (e.g. sonar-maven-plugin), the Maven
     wrapper, org workflow bumps. **Not** Apache NiFi — that has its own top section (rule 2).
5. **Collapse by library identity — one line per library, spanning the full range.** The unit
   of collapsing is the *library*, not the PR title. Merge into a single line whenever the
   PRs concern the same library, including all three of these shapes:
   - **Version chains** — `A → B → C` becomes one line `A → C` (e.g. three
     `token-sheriff-validation` bumps `0.6.0 → 0.7.0 → 0.8.0` become one `0.6.0 → 0.8.0`).
   - **Same library in several directories** — `eslint` bumped in `/nifi-cuioss-ui` *and*
     `/e-2-e-playwright` is **one** line naming both directories, not two lines. The titles
     differ only by the directory suffix, so do not wait for identical titles.
   - **One upstream bump landing as several coordinates** — when a single upstream release
     arrives as separate PRs against different coordinates (e.g. the `version.nifi` property
     and the `org.apache.nifi:nifi-extension-bundles` parent), that is **one** bump: one line
     naming the coordinates in parentheses.

   Carry every merged PR's URL onto the surviving line, comma-separated.
6. **Recover versions the title omits.** Dependabot sometimes truncates a title to
   `bump <lib> in /<dir>` with no versions (it does this when several deps must move
   together). Never publish a dependency line without a version range: read the PR body
   (`gh pr view <n> --repo cuioss/nifi-extensions --json body --jq .body | head -6`, which
   states `Updates \`<lib>\` from X to Y`) and use those versions when computing the range.
7. **Remove all OpenRewrite bumps and friends** — drop every `rewrite-maven-plugin`,
   `rewrite-migrate-java`, `rewrite-testing-frameworks`, and related OpenRewrite dependency PR.
8. **Remove internal tooling churn** — drop PRs that only touch dev/build orchestration with
   no user-facing effect: `marshal.json`/plan-marshall config migrations, plan-marshall build
   wiring, `.plan/**` architecture data, internal dev-skill changes, and the mechanical
   version-bump PR itself.
9. Preserve each kept PR line in its original `* <title> by @author in <url>` shape. Rules 5
   and 6 **override** verbatimness where they conflict: rewrite the title's version range to
   span the collapsed chain, and name the several directories or coordinates on the surviving
   line.
10. Keep the trailing `**Full Changelog**: ...compare/<prev>...<version>` line.

#### Verify before publishing (mandatory)

The rules above are easy to under-apply — a duplicate survives whenever two PRs touch one
library under differing titles. After building the notes file and **before**
`gh release edit`, assert that every library appears exactly once:

```bash
grep -oE '(bump|update) [^ ]+ (from|in)' .plan/temp/release-<version>.md \
  | sort | uniq -c | sort -rn | head
```

Every count must be `1`. Any count `>1` is an unmerged duplicate — collapse it per rule 5 and
re-run. Also confirm no dependency line is missing a version range (rule 6), and that
`grep -E '^##' ` on the file lists `## Apache NiFi` first (rule 2).

### Step 14 — Done

Report: released version, release URL, the PR number, whether the NiFi badge changed, and a
short summary of how many dependency PRs were collapsed/removed during note reformatting.

## Critical rules

- The release is triggered by **merging a `.github/project.yml` change** — never hand-run
  Maven release goals.
- Branch prefix **must** be `chore/` (or another CI-accepted prefix) or the build check skips
  and auto-merge is blocked.
- Never merge a red PR; fix and re-wait.
- Temporary files go under `.plan/temp/`.
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`; no PR footer line.
