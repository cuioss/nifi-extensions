---
name: deploy
description: Build, deploy, and test NiFi E2E environment (Docker containers)
user-invocable: true
allowed-tools: Bash, Read
---

# NiFi E2E Deployment Skill

Manages the Docker-based NiFi + Keycloak test environment for E2E testing.

## Parameters

Optional argument selects the workflow:
- `/deploy` or `/deploy status` — Show container status
- `/deploy start` — First-time start (build NAR + start containers)
- `/deploy redeploy` — Redeploy after code changes (rebuild NAR + restart NiFi only)
- `/deploy test` — Run E2E Playwright tests (containers must be running)
- `/deploy test <file>` — Run specific E2E test file
- `/deploy stop` — Stop all containers
- `/deploy full` — Full CI workflow: stop → build → start → test → stop
- `/deploy troubleshoot` — Diagnose common issues

## Workflow

### Step 1: Determine Action

Parse the argument to determine which workflow to execute. Default (no args) = show status.

### Step 2: Execute Action

#### status (default)
```bash
./integration-testing/src/main/docker/check-status.sh --quiet
```

#### start
```bash
./integration-testing/src/main/docker/run-and-deploy.sh
```
Builds NAR, copies to `target/nifi-deploy/`, starts Keycloak + NiFi.
NiFi takes ~60-80s to become healthy. URLs after start:
- NiFi: https://localhost:9095/nifi (testUser / drowssap)
- Keycloak: http://localhost:9080 (admin / admin)

#### redeploy
```bash
./integration-testing/src/main/docker/redeploy-nifi.sh
```
Rebuilds NAR, copies to deploy dir, runs `docker compose restart nifi`.
Wait ~60-80s for NiFi to become healthy.
Verify: `./integration-testing/src/main/docker/check-status.sh`

#### test [file]
```bash
cd e-2-e-playwright && npm run playwright:test [-- tests/<file>.spec.js]
```
Containers MUST be running. Use `/deploy start` first if needed.

#### stop
```bash
cd integration-testing/src/main/docker && docker compose down -v
```

#### full
```bash
cd integration-testing/src/main/docker && docker compose down -v
cd <project-root>
./mvnw clean install
./mvnw verify -Pintegration-tests -pl e-2-e-playwright -am
```
IMPORTANT: Maven manages its own container lifecycle. Do NOT have manually-started containers running.

#### troubleshoot
Check for common issues in order:
1. `docker ps` — Are containers running? Any orphaned containers on ports 7777/9095/9443?
2. `docker compose -f integration-testing/src/main/docker/docker-compose.yml ps` — Container states
3. Port conflicts: `lsof -i :7777 -i :9095 -i :9443 2>/dev/null`
4. NiFi logs: `docker logs docker-nifi-1 --tail 50`
5. NAR loaded: `docker logs docker-nifi-1 2>&1 | grep -i cuioss`

## Critical Rules

- Maven E2E (`./mvnw verify -Pintegration-tests`) automatically stops existing containers before starting fresh ones (via fixed `deploy-and-start.sh`)
- After `./mvnw clean install`, the NAR in `target/nifi-deploy/` is stale — must run `/deploy redeploy` to update running containers
- NiFi loads NARs only at startup — code changes require container restart, not just file copy
- The `target/nifi-deploy/` directory is volume-mounted into the NiFi container

## Key Paths

| Path | Purpose |
|------|---------|
| `target/nifi-deploy/` | NAR deployment dir (Docker volume mount) |
| `integration-testing/src/main/docker/docker-compose.yml` | Docker Compose config |
| `integration-testing/src/main/docker/*.sh` | Local deployment scripts |
| `e-2-e-playwright/scripts/*.sh` | Maven-phase scripts |
| `e-2-e-playwright/target/test-results/` | Test artifacts |

## NiFi Custom UI Browser Verification

The Custom UI runs inside an iframe. To access it manually:
1. Navigate to `https://localhost:9095/nifi/`
2. Double-click process group to enter it
3. Right-click processor → look for "Advanced" menu item
4. If not visible: click "Configure" → click Custom UI icon (top-right of dialog, red sticky-note icon)
5. Custom UI loads in iframe with `?id={processorId}` query parameter
