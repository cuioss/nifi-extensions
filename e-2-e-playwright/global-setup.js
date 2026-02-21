/**
 * @fileoverview Playwright Global Auth Setup
 * Authenticates with NiFi once, saves storageState for all test projects,
 * and verifies processor deployment (one-time API checks).
 *
 * Run as a Playwright "setup" project so that functional, self-test, and
 * accessibility projects can depend on it and reuse the authenticated session.
 */

import { test as setup, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { CONSTANTS } from './utils/constants.js';
import { testLogger } from './utils/test-logger.js';

const AUTH_DIR = join(dirname(new URL(import.meta.url).pathname), '.auth');
const STATE_FILE = join(AUTH_DIR, 'state.json');
const CONTEXT_FILE = join(AUTH_DIR, 'test-context.json');

setup.setTimeout(180_000); // NiFi cold-start: up to 60s API wait + 60s CSRF wait

setup('authenticate and verify preconditions', async ({ page }) => {
  // Ensure .auth directory exists
  mkdirSync(AUTH_DIR, { recursive: true });

  testLogger.info('Setup', 'Starting global auth setup...');

  // ------- 1. Wait for NiFi to become accessible (retries for cold start) -------
  const MAX_RETRIES = 30;
  const RETRY_DELAY_MS = 2000;
  let isAccessible = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const diagResponse = await page.request.get(
        CONSTANTS.SERVICE_URLS.NIFI_SYSTEM_DIAGNOSTICS,
        { timeout: 5000, failOnStatusCode: false }
      );
      isAccessible =
        diagResponse &&
        ((diagResponse.status() >= 200 && diagResponse.status() < 400) ||
          diagResponse.status() === 401);
    } catch {
      isAccessible = false;
    }

    if (isAccessible) {
      testLogger.info('Setup', `NiFi accessible after ${attempt} attempt(s)`);
      break;
    }

    testLogger.info('Setup', `NiFi not ready (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`);
    await page.waitForTimeout(RETRY_DELAY_MS);
  }

  expect(isAccessible, 'NiFi must be accessible within 60s').toBe(true);

  // ------- 2. Navigate and obtain CSRF token -------
  // NiFi may serve the splash screen before the login page is ready.
  // Retry until the CSRF cookie appears (set only by the real app, not splash).
  let requestToken = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await page.goto('/nifi');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const cookies = await page.context().cookies();
    requestToken = cookies.find(c => c.name === '__Secure-Request-Token')?.value;
    if (requestToken) {
      testLogger.info('Setup', `CSRF token obtained after ${attempt} attempt(s)`);
      break;
    }

    testLogger.info('Setup', `CSRF token not yet available (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
    await page.waitForTimeout(RETRY_DELAY_MS);
  }
  expect(requestToken, 'CSRF token must be present').toBeTruthy();

  // ------- 3. Authenticate via API -------
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

  // Set auth header for subsequent in-page requests
  await page.setExtraHTTPHeaders({ Authorization: `Bearer ${jwtToken}` });

  // Store token in window so ProcessorApiManager can pick it up
  await page.evaluate(token => {
    window.__jwtToken = token;
    window.__authorizationHeader = `Bearer ${token}`;
  }, jwtToken);

  // Navigate to canvas to establish the session
  await page.goto('/nifi');
  await page.waitForLoadState('domcontentloaded');

  // Verify we are authenticated
  await expect(page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)).toBeVisible({ timeout: 15000 });
  testLogger.info('Setup', 'Authentication successful');

  // ------- 4. Verify processor deployment via API -------
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

  // ------- 5. Resolve process-group IDs -------
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

  // ------- 6. Save test context for other tests to read -------
  const testContext = {
    rootGroupId: rootResult,
    jwtPipelineGroupId,
    gatewayGroupId,
    processorDeployed: isDeployed,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(CONTEXT_FILE, JSON.stringify(testContext, null, 2));
  testLogger.info('Setup', `Test context saved: ${JSON.stringify(testContext)}`);

  // ------- 7. Save storageState (cookies + localStorage) -------
  await page.context().storageState({ path: STATE_FILE });
  testLogger.info('Setup', `Storage state saved to ${STATE_FILE}`);
});
