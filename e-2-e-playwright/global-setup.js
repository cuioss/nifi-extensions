/**
 * @fileoverview Playwright Global Auth Setup
 * Authenticates with NiFi once, saves storageState for all test projects,
 * and verifies processor deployment (one-time API checks).
 *
 * Run as a Playwright "setup" project so that functional, self-test, and
 * accessibility projects can depend on it and reuse the authenticated session.
 *
 * Prerequisites: wait-for-containers.sh has already verified that NiFi's API
 * is fully ready (/nifi-api/access/config returns 200). The retries here are
 * a safety net for edge cases, not the primary readiness mechanism.
 */

import { test as setup, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { CONSTANTS } from './utils/constants.js';
import { testLogger } from './utils/test-logger.js';

const AUTH_DIR = join(dirname(new URL(import.meta.url).pathname), '.auth');
const STATE_FILE = join(AUTH_DIR, 'state.json');
const CONTEXT_FILE = join(AUTH_DIR, 'test-context.json');

// Safety-net retry constants (wait-for-containers.sh handles the primary wait)
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

setup.setTimeout(120_000);

setup('authenticate and verify preconditions', async ({ page }) => {
  mkdirSync(AUTH_DIR, { recursive: true });
  testLogger.info('Setup', 'Starting global auth setup...');

  // ------- 1. Wait for NiFi login system (safety net) -------
  // The bash wait-for-containers.sh already checked /nifi-api/access/config,
  // so this should succeed on the first attempt. Retries cover edge cases
  // like brief network hiccups between container and host.
  let requestToken = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto('/nifi');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const cookies = await page.context().cookies();
      requestToken = cookies.find(c => c.name === '__Secure-Request-Token')?.value;
    } catch {
      requestToken = null;
    }

    if (requestToken) {
      testLogger.info('Setup', `CSRF token obtained after ${attempt} attempt(s)`);
      break;
    }

    testLogger.info('Setup', `NiFi login not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`);
    await page.waitForTimeout(RETRY_DELAY_MS);
  }
  expect(requestToken, 'CSRF token must be present — is NiFi fully started?').toBeTruthy();

  // ------- 2. Authenticate via API -------
  const tokenResponse = await page.request.post('/nifi-api/access/token', {
    headers: {
      'Request-Token': requestToken,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    form: {
      username: CONSTANTS.AUTH.USERNAME,
      password: CONSTANTS.AUTH.PASSWORD,
    },
  });
  expect(tokenResponse.ok(), 'Login API must succeed').toBe(true);

  const jwtToken = await tokenResponse.text();
  expect(jwtToken.length, 'JWT token must be non-empty').toBeGreaterThan(0);
  testLogger.info('Setup', 'Authentication successful');

  // Set auth header for subsequent in-page requests
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${jwtToken}` });

  await page.evaluate(token => {
    window.__jwtToken = token;
    window.__authorizationHeader = `Bearer ${token}`;
  }, jwtToken);

  // Navigate to canvas to establish the session
  await page.goto('/nifi');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible({ timeout: 15000 });

  // ------- 3. Verify processor deployment via API -------
  const typesResult = await page.evaluate(async () => {
    const resp = await fetch('/nifi-api/flow/processor-types', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { ok: false };
    const data = await resp.json();
    return { ok: true, data };
  });

  const isDeployed =
    typesResult.ok &&
    (typesResult.data?.processorTypes || []).some(
      t =>
        t.type?.includes('MultiIssuerJWTTokenAuthenticator') ||
        t.bundle?.artifact?.includes('cuioss'),
    );
  expect(isDeployed, 'MultiIssuerJWTTokenAuthenticator must be deployed').toBe(true);
  testLogger.info('Setup', 'Processor deployment verified');

  // ------- 4. Resolve process-group IDs -------
  const rootResult = await page.evaluate(async () => {
    const resp = await fetch('/nifi-api/flow/process-groups/root', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.processGroupFlow?.id || data.id || 'root';
  });

  let jwtPipelineGroupId = null;
  let gatewayGroupId = null;

  if (rootResult) {
    const groupsResult = await page.evaluate(async rootId => {
      const resp = await fetch(`/nifi-api/process-groups/${rootId}/process-groups`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.processGroups || [];
    }, rootResult);

    const jwtGroup = groupsResult.find(g => g.component?.name === 'JWT Auth Pipeline');
    const gatewayGroup = groupsResult.find(g => g.component?.name === 'REST API Gateway');
    jwtPipelineGroupId = jwtGroup?.id || null;
    gatewayGroupId = gatewayGroup?.id || null;
  }

  // ------- 5. Save test context for other tests to read -------
  const testContext = {
    rootGroupId: rootResult,
    jwtPipelineGroupId,
    gatewayGroupId,
    processorDeployed: isDeployed,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(CONTEXT_FILE, JSON.stringify(testContext, null, 2));
  testLogger.info('Setup', `Test context saved: ${JSON.stringify(testContext)}`);

  // ------- 6. Save storageState (cookies + localStorage) -------
  await page.context().storageState({ path: STATE_FILE });
  testLogger.info('Setup', `Storage state saved to ${STATE_FILE}`);
});
