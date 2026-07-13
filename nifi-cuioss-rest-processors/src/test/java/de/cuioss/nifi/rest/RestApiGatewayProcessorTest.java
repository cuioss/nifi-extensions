/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.rest;

import de.cuioss.http.security.core.UrlSecurityFailureType;
import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.http.security.monitoring.SecurityEventCounter;
import de.cuioss.nifi.jwt.config.ConfigurationManager;
import de.cuioss.nifi.jwt.config.JwtAuthenticationConfig;
import de.cuioss.nifi.jwt.config.JwtIssuerConfigService;
import de.cuioss.nifi.jwt.test.TestJwtIssuerConfigService;
import de.cuioss.nifi.rest.handler.GatewaySecurityEvents;
import de.cuioss.sheriff.token.validation.domain.token.AccessTokenContent;
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
import de.cuioss.sheriff.token.validation.test.TestTokenHolder;
import de.cuioss.sheriff.token.validation.test.generator.TestTokenGenerators;
import de.cuioss.test.generator.Generators;
import de.cuioss.test.generator.TypedGenerator;
import de.cuioss.test.generator.junit.EnableGeneratorController;
import de.cuioss.test.generator.junit.parameterized.TypeGeneratorSource;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.apache.nifi.controller.AbstractControllerService;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ArgumentsSource;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RestApiGatewayProcessor")
@EnableTestLogger
@EnableGeneratorController
class RestApiGatewayProcessorTest {

    private static final String CS_ID = "jwt-config-service";

    private TestRunner testRunner;
    private TestJwtIssuerConfigService mockConfigService;
    private TestTokenHolder tokenHolder;
    private HttpClient httpClient;

    @BeforeEach
    void setUp() throws Exception {
        testRunner = TestRunners.newTestRunner(RestApiGatewayProcessor.class);

        mockConfigService = new TestJwtIssuerConfigService();
        testRunner.addControllerService(CS_ID, mockConfigService);
        testRunner.enableControllerService(mockConfigService);

        testRunner.setProperty(RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);
        testRunner.setProperty(RestApiGatewayConstants.Properties.LISTENING_PORT, "0");
        testRunner.setProperty(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE, "50");
        testRunner.setProperty(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE, "1048576");

        // Configure routes
        testRunner.setProperty("restapi.health.path", "/api/health");
        testRunner.setProperty("restapi.health.methods", "GET");
        testRunner.setProperty("restapi.users.path", "/api/users");
        testRunner.setProperty("restapi.users.methods", "GET,POST");
        testRunner.setProperty("restapi.userdetail.path", "/api/users/{userId}/orders/{orderId}");
        testRunner.setProperty("restapi.userdetail.methods", "GET");
        testRunner.setProperty("restapi.userdetail.success-outcome", "userdetail");

        tokenHolder = TestTokenGenerators.accessTokens().next();
        mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

        httpClient = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    }

    @AfterEach
    void tearDown() {
        // Stop the processor (stops Jetty)
        if (testRunner != null) {
            testRunner.stop();
        }
    }

    @Nested
    @DisplayName("Empty Route Configuration")
    class EmptyRouteConfiguration {

        @Test
        @DisplayName("Should clear relationships and skip server start when no routes are configured")
        void shouldHandleScheduleWithoutRoutes() throws Exception {
            var runner = TestRunners.newTestRunner(RestApiGatewayProcessor.class);
            var configService = new TestJwtIssuerConfigService();
            runner.addControllerService(CS_ID, configService);
            runner.enableControllerService(configService);
            runner.setProperty(RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);
            runner.setProperty(RestApiGatewayConstants.Properties.LISTENING_PORT, "0");

            try {
                runner.run(1, false, true);

                var processor = (RestApiGatewayProcessor) runner.getProcessor();
                assertFalse(processor.serverManager.isRunning(),
                        "Embedded server must not start when no routes are configured");
                assertEquals(
                        Set.of(RestApiGatewayConstants.Relationships.FAILURE),
                        processor.getRelationships(),
                        "Only the FAILURE relationship remains without routes; ATTACHMENTS is advertised "
                                + "only when a cache client is configured (I14)");
            } finally {
                runner.stop();
            }
        }
    }

    @Nested
    @DisplayName("Property Descriptors")
    class PropertyDescriptors {

        @Test
        @DisplayName("Should return all static properties")
        void shouldReturnAllStaticProperties() {
            var descriptors = testRunner.getProcessor().getPropertyDescriptors();
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.LISTENING_PORT));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.LISTENING_HOST));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.SSL_CONTEXT_SERVICE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_ENABLED));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_AUTH_MODE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_ROLES));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_HEALTH_REQUIRED_SCOPES));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_ENABLED));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_AUTH_MODE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_ROLES));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MANAGEMENT_METRICS_REQUIRED_SCOPES));
        }

        @Test
        @DisplayName("Should support restapi.* dynamic properties")
        void shouldSupportRestapiDynamicProperties() {
            // Properties are already set — verify they were accepted
            testRunner.assertValid();
        }
    }

    @Nested
    @DisplayName("Relationships")
    class Relationships {

        @Test
        @DisplayName("Should include failure relationship")
        void shouldIncludeFailureRelationship() {
            var relationships = testRunner.getProcessor().getRelationships();
            assertTrue(relationships.contains(RestApiGatewayConstants.Relationships.FAILURE));
        }
    }

    @Nested
    @DisplayName("Tracking / Cache Client Contract (M4, I14)")
    class CacheClientContract {

        @Test
        @DisplayName("M4: a tracked route without a cache client is invalid")
        void shouldBeInvalidWhenTrackingWithoutCacheClient() {
            testRunner.setProperty("restapi.tracked.path", "/api/tracked");
            testRunner.setProperty("restapi.tracked.methods", "POST");
            testRunner.setProperty("restapi.tracked.tracking-mode", "simple");

            testRunner.assertNotValid();
        }

        @Test
        @DisplayName("M4/I14: a tracked route with a cache client is valid and advertises ATTACHMENTS")
        void shouldBeValidAndAdvertiseAttachmentsWithCacheClient() throws Exception {
            var cache = new de.cuioss.nifi.rest.handler.RequestStatusStoreTest.InMemoryMapCacheClient();
            testRunner.addControllerService("cache", cache);
            testRunner.enableControllerService(cache);
            testRunner.setProperty(
                    RestApiGatewayConstants.Properties.DISTRIBUTED_MAP_CACHE_CLIENT, "cache");
            testRunner.setProperty("restapi.tracked.path", "/api/tracked");
            testRunner.setProperty("restapi.tracked.methods", "POST");
            testRunner.setProperty("restapi.tracked.tracking-mode", "simple");

            testRunner.assertValid();
            testRunner.run(1, false, true);
            try {
                assertTrue(testRunner.getProcessor().getRelationships()
                                .contains(RestApiGatewayConstants.Relationships.ATTACHMENTS),
                        "ATTACHMENTS must be advertised when a cache client is configured");
            } finally {
                testRunner.stop();
            }
        }
    }

    @Nested
    @DisplayName("End-to-End Request Processing")
    class EndToEnd {

        @Test
        @DisplayName("Should create FlowFile from GET request")
        void shouldCreateFlowFileFromGetRequest() throws Exception {
            // Start the processor (starts Jetty)
            testRunner.run(1, false, true);

            // Get the actual port
            int port = getServerPort();
            assertTrue(port > 0, "Server should be running on a port");

            // Send HTTP request
            var response = httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());

            // Trigger onTrigger to process the queued request
            testRunner.run(1, false, false);

            // Verify FlowFile
            var healthFiles = testRunner.getFlowFilesForRelationship("health");
            assertEquals(1, healthFiles.size());

            MockFlowFile flowFile = healthFiles.getFirst();
            flowFile.assertAttributeEquals(RestApiAttributes.ROUTE_NAME, "health");
            flowFile.assertAttributeEquals(RestApiAttributes.HTTP_METHOD, "GET");
            flowFile.assertAttributeEquals(RestApiAttributes.HTTP_REQUEST_URI, "/api/health");
            flowFile.assertAttributeExists("jwt.subject");
            flowFile.assertAttributeExists("jwt.issuer");

            // GET should have empty content
            flowFile.assertContentEquals("");
        }

        @Test
        @DisplayName("Should create FlowFile from POST request with body")
        void shouldCreateFlowFileFromPostRequest() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            var response = httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/users"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString("{\"name\":\"test\"}"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(202, response.statusCode());

            testRunner.run(1, false, false);

            var usersFiles = testRunner.getFlowFilesForRelationship("users");
            assertEquals(1, usersFiles.size());

            MockFlowFile flowFile = usersFiles.getFirst();
            flowFile.assertAttributeEquals(RestApiAttributes.ROUTE_NAME, "users");
            flowFile.assertAttributeEquals(RestApiAttributes.HTTP_METHOD, "POST");
            flowFile.assertAttributeEquals(RestApiAttributes.CONTENT_TYPE, "application/json");
            flowFile.assertContentEquals("{\"name\":\"test\"}");
        }

        @Test
        @DisplayName("Should route to correct relationship")
        void shouldRouteToCorrectRelationship() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            // Send to health
            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Send to users
            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/users"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Process both
            testRunner.run(2, false, false);

            assertEquals(1, testRunner.getFlowFilesForRelationship("health").size());
            assertEquals(1, testRunner.getFlowFilesForRelationship("users").size());
        }
    }

    @Nested
    @DisplayName("Authentication Integration")
    class AuthenticationIntegration {

        @Test
        @DisplayName("Should return 401 via HTTP for invalid token")
        void shouldReturn401ViaHttpForInvalidToken() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            var response = httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .GET().build(), // No Authorization header
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(401, response.statusCode());

            // No FlowFile should be created
            testRunner.run(1, false, false);
            assertTrue(testRunner.getFlowFilesForRelationship("health").isEmpty());
        }
    }

    @Nested
    @DisplayName("FlowFile Attributes")
    class FlowFileAttributes {

        @Test
        @DisplayName("Should map JWT claims to attributes")
        void shouldMapJwtClaimsToAttributes() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("health").getFirst();
            flowFile.assertAttributeExists("jwt.issuer");
            flowFile.assertAttributeExists("jwt.validatedAt");
        }

        @Test
        @DisplayName("Should set query parameters")
        void shouldSetQueryParameters() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health?page=1&limit=10"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("health").getFirst();
            flowFile.assertAttributeEquals("http.query.page", "1");
            flowFile.assertAttributeEquals("http.query.limit", "10");
        }

        @Test
        @DisplayName("Should exclude credential-bearing headers from FlowFile attributes (N26)")
        void shouldExcludeCredentialHeadersFromAttributes() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .header("Cookie", "session=secret")
                            .header("X-Api-Key", "top-secret-key")
                            .header("X-Custom-Header", "keepme")
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("health").getFirst();
            // Credential-bearing headers must never leak into http.header.* attributes / provenance.
            flowFile.assertAttributeNotExists(RestApiAttributes.HEADER_PREFIX + "cookie");
            flowFile.assertAttributeNotExists(RestApiAttributes.HEADER_PREFIX + "x-api-key");
            flowFile.assertAttributeNotExists(RestApiAttributes.HEADER_PREFIX + "authorization");
            // A non-sensitive custom header is still forwarded.
            flowFile.assertAttributeEquals(RestApiAttributes.HEADER_PREFIX + "x-custom-header", "keepme");
        }

        @ParameterizedTest
        @TypeGeneratorSource(value = UserOrderGenerator.class, count = 5)
        @DisplayName("Should set generated path parameters from a pattern-matched route")
        void shouldSetPathParameters(UserOrder pair) throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            httpClient.send(
                    HttpRequest.newBuilder(URI.create(
                            "http://127.0.0.1:" + port + "/api/users/" + pair.userId() + "/orders/"
                                    + pair.orderId()))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("userdetail").getFirst();
            flowFile.assertAttributeEquals(RestApiAttributes.PATH_PARAM_PREFIX + "userId", pair.userId());
            flowFile.assertAttributeEquals(RestApiAttributes.PATH_PARAM_PREFIX + "orderId", pair.orderId());
        }

        public record UserOrder(String userId, String orderId) {
        }

        public static final class UserOrderGenerator implements TypedGenerator<UserOrder> {

            private final TypedGenerator<String> letters = Generators.letterStrings(1, 12);

            @Override
            public UserOrder next() {
                return new UserOrder(letters.next(), letters.next());
            }

            @Override
            public Class<UserOrder> getType() {
                return UserOrder.class;
            }
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle OWASP attack in path parameter safely")
        void shouldHandleOwaspAttackInPathParameter(AttackTestCase testCase) throws Exception {
            assertAttackPathParameterHandledSafely(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle Apache CVE attack in path parameter safely")
        void shouldHandleApacheCveAttackInPathParameter(AttackTestCase testCase) throws Exception {
            assertAttackPathParameterHandledSafely(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle ModSecurity CRS attack in path parameter safely")
        void shouldHandleModSecurityAttackInPathParameter(AttackTestCase testCase) throws Exception {
            assertAttackPathParameterHandledSafely(testCase);
        }

        /**
         * Feeds an attack string into the {@code {userId}} path-parameter segment and
         * asserts the gateway handles it safely: either the security pipeline / route
         * matcher rejects it (non-2xx, no FlowFile) or — when the value is matched — the
         * extracted path-parameter attribute equals the input verbatim (no silent
         * rewrite). The gateway must never crash, and an attack value carrying a path
         * separator must not over-match the single-segment placeholder.
         */
        private void assertAttackPathParameterHandledSafely(AttackTestCase testCase) throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();
            String attack = testCase.attackString();
            String encoded = URLEncoder.encode(attack, StandardCharsets.UTF_8);

            int status;
            try {
                var response = httpClient.send(
                        HttpRequest.newBuilder(URI.create(
                                "http://127.0.0.1:" + port + "/api/users/" + encoded + "/orders/1"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                status = response.statusCode();
            } catch (IllegalArgumentException e) {
                // Attack string produced a URI the client refused to build — rejected at
                // the transport level, which counts as safe handling.
                return;
            }

            testRunner.run(1, false, false);

            var userdetailFiles = testRunner.getFlowFilesForRelationship("userdetail");
            if (status == 200 && !userdetailFiles.isEmpty()) {
                userdetailFiles.getFirst().assertAttributeEquals(
                        RestApiAttributes.PATH_PARAM_PREFIX + "userId", attack);
            }
        }

        @Test
        @DisplayName("Should not set path parameter attributes for exact-matched routes")
        void shouldNotSetPathParametersForExactRoutes() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();

            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("health").getFirst();
            flowFile.assertAttributeNotExists(RestApiAttributes.PATH_PARAM_PREFIX + "userId");
        }
    }

    @Nested
    @DisplayName("Logging")
    class Logging {

        @Test
        @DisplayName("Should log server started")
        void shouldLogServerStarted() {
            testRunner.run(1, false, true);
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO, "REST-1:");
        }
    }

    @Nested
    @DisplayName("External Config Loading")
    class ExternalConfigLoading {

        @Test
        @DisplayName("Should load routes from external config file")
        void shouldLoadRoutesFromExternalConfig(@TempDir Path tempDir) throws Exception {
            // Create config file with a route
            writeConfigFile(tempDir, """
                    restapi.external.path=/api/external
                    restapi.external.methods=GET
                    restapi.external.success-outcome=external
                    """);

            // Set up processor with external config and NO NiFi dynamic route properties
            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            runner.run(1, false, true);
            try {
                int port = processor.serverManager.getPort();

                var response = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/external"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());

                assertEquals(200, response.statusCode());

                runner.run(1, false, false);
                assertEquals(1, runner.getFlowFilesForRelationship("external").size());

                LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO, "REST-10:");
            } finally {
                runner.stop();
            }
        }

        @Test
        @DisplayName("Should merge external and NiFi routes")
        void shouldMergeExternalAndNifiRoutes(@TempDir Path tempDir) throws Exception {
            writeConfigFile(tempDir, """
                    restapi.external.path=/api/external
                    restapi.external.methods=GET
                    restapi.external.success-outcome=external
                    """);

            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            // Also add a NiFi dynamic property route
            runner.setProperty("restapi.nifi-route.path", "/api/nifi-route");
            runner.setProperty("restapi.nifi-route.methods", "GET");
            runner.setProperty("restapi.nifi-route.success-outcome", "nifi-route");

            runner.run(1, false, true);
            try {
                int port = processor.serverManager.getPort();

                // Both routes should work
                var externalResponse = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/external"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(200, externalResponse.statusCode());

                var nifiResponse = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/nifi-route"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(200, nifiResponse.statusCode());

                runner.run(2, false, false);
                assertEquals(1, runner.getFlowFilesForRelationship("external").size());
                assertEquals(1, runner.getFlowFilesForRelationship("nifi-route").size());
            } finally {
                runner.stop();
            }
        }

        @Test
        @DisplayName("NiFi properties should override config file")
        void nifiPropertiesShouldOverrideConfigFile(@TempDir Path tempDir) throws Exception {
            // Config file defines route with GET only
            writeConfigFile(tempDir, """
                    restapi.myroute.path=/api/myroute
                    restapi.myroute.methods=GET
                    restapi.myroute.success-outcome=myroute
                    """);

            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            // NiFi overrides methods to POST
            runner.setProperty("restapi.myroute.path", "/api/myroute");
            runner.setProperty("restapi.myroute.methods", "POST");
            runner.setProperty("restapi.myroute.success-outcome", "myroute");

            runner.run(1, false, true);
            try {
                int port = processor.serverManager.getPort();

                // GET should NOT work (NiFi override says POST only)
                var getResponse = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/myroute"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(405, getResponse.statusCode());

                // POST should work
                var postResponse = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/myroute"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .header("Content-Type", "application/json")
                                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(202, postResponse.statusCode());

                // Verify FlowFile creation for the successful POST
                runner.run(1, false, false);
                assertEquals(1, runner.getFlowFilesForRelationship("myroute").size());
            } finally {
                runner.stop();
            }
        }

        @Test
        @DisplayName("Should work without config file (NiFi-only)")
        void shouldWorkWithoutConfigFile(@TempDir Path tempDir) throws Exception {
            // Empty temp dir — no config file
            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            // Only NiFi dynamic properties
            runner.setProperty("restapi.nifionly.path", "/api/nifionly");
            runner.setProperty("restapi.nifionly.methods", "GET");
            runner.setProperty("restapi.nifionly.success-outcome", "nifionly");

            runner.run(1, false, true);
            try {
                int port = processor.serverManager.getPort();

                var response = httpClient.send(
                        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/nifionly"))
                                .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                                .GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode());

                runner.run(1, false, false);
                assertEquals(1, runner.getFlowFilesForRelationship("nifionly").size());
            } finally {
                runner.stop();
            }
        }

        @Test
        @DisplayName("Should expose external config relationships before scheduling")
        void shouldExposeExternalConfigRelationshipsBeforeScheduling(@TempDir Path tempDir) throws Exception {
            writeConfigFile(tempDir, """
                    restapi.data.path=/api/data
                    restapi.data.methods=GET
                    restapi.data.success-outcome=data
                    restapi.admin.path=/api/admin
                    restapi.admin.methods=GET
                    restapi.admin.success-outcome=admin
                    """);

            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            // Call getRelationships() WITHOUT scheduling — simulates NiFi framework calling before @OnScheduled
            var relationships = processor.getRelationships();
            var relationshipNames = relationships.stream()
                    .map(Relationship::getName)
                    .collect(Collectors.toSet());

            assertTrue(relationshipNames.contains("failure"), "Should always contain failure");
            assertTrue(relationshipNames.contains("data"), "Should contain 'data' from external config");
            assertTrue(relationshipNames.contains("admin"), "Should contain 'admin' from external config");
        }

        @Test
        @DisplayName("Should merge external and NiFi relationships on schedule")
        void shouldMergeExternalAndNifiRelationshipsOnSchedule(@TempDir Path tempDir) throws Exception {
            writeConfigFile(tempDir, """
                    restapi.ext-route.path=/api/ext
                    restapi.ext-route.methods=GET
                    restapi.ext-route.success-outcome=ext-route
                    """);

            var runner = createRunner();
            var processor = (RestApiGatewayProcessor) runner.getProcessor();
            processor.configurationManager = new ConfigurationManager(tempDir.toString() + "/");

            // Add NiFi dynamic property route
            runner.setProperty("restapi.nifi-route.path", "/api/nifi");
            runner.setProperty("restapi.nifi-route.methods", "GET");
            runner.setProperty("restapi.nifi-route.success-outcome", "nifi-route");

            runner.run(1, false, true);
            try {
                var relationships = processor.getRelationships();
                var relationshipNames = relationships.stream()
                        .map(Relationship::getName)
                        .collect(Collectors.toSet());

                assertTrue(relationshipNames.contains("failure"), "Should always contain failure");
                assertTrue(relationshipNames.contains("ext-route"), "Should contain 'ext-route' from external config");
                assertTrue(relationshipNames.contains("nifi-route"), "Should contain 'nifi-route' from NiFi properties");
            } finally {
                runner.stop();
            }
        }

        private TestRunner createRunner() throws Exception {
            var runner = TestRunners.newTestRunner(RestApiGatewayProcessor.class);
            runner.addControllerService(CS_ID, mockConfigService);
            runner.enableControllerService(mockConfigService);
            runner.setProperty(RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE, CS_ID);
            runner.setProperty(RestApiGatewayConstants.Properties.LISTENING_PORT, "0");
            runner.setProperty(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE, "50");
            runner.setProperty(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE, "1048576");
            return runner;
        }

        private void writeConfigFile(Path tempDir, String content) throws IOException {
            Path confDir = tempDir.resolve("conf");
            Files.createDirectories(confDir);
            Files.writeString(confDir.resolve("cui-nifi-extensions.properties"), content);
        }
    }

    @Nested
    @DisplayName("Counter Bridge (Tier A)")
    class CounterBridge {

        private static final String MISSING_BEARER_COUNTER =
                RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "missing_bearer_token";

        @Test
        @DisplayName("Should bridge a gateway security event to a NiFi counter after onTrigger")
        void shouldBridgeGatewayEventToNifiCounter() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();
            sendUnauthenticated(port);

            testRunner.run(1, false, false);

            assertEquals(1L, testRunner.getCounterValue(MISSING_BEARER_COUNTER),
                    "Unauthenticated request should surface one missing_bearer_token NiFi counter");
        }

        @Test
        @DisplayName("Should flush event deltas on an idle trigger with no queued request")
        void shouldFlushDeltasOnIdleTrigger() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();
            sendUnauthenticated(port);

            // Idle tick: the 401 response created no FlowFile, so the queue is empty —
            // the counter must still publish from the early-return path in onTrigger.
            testRunner.run(1, false, false);

            assertTrue(testRunner.getFlowFilesForRelationship("health").isEmpty(),
                    "Unauthenticated request must not create a FlowFile");
            assertEquals(1L, testRunner.getCounterValue(MISSING_BEARER_COUNTER),
                    "Idle trigger must still flush the missing_bearer_token delta");
        }

        @Test
        @DisplayName("Should not double-count across triggers with no new events")
        void shouldNotDoubleCountAcrossTriggers() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();
            sendUnauthenticated(port);

            testRunner.run(1, false, false);
            long afterFirst = testRunner.getCounterValue(MISSING_BEARER_COUNTER);
            testRunner.run(1, false, false);
            testRunner.run(1, false, false);

            assertEquals(1L, afterFirst, "First flush should publish exactly one event");
            assertEquals(1L, testRunner.getCounterValue(MISSING_BEARER_COUNTER),
                    "Subsequent idle triggers must not republish the same cumulative count");
        }

        @Test
        @DisplayName("Should bridge a distinct event type (route-not-found) to its own NiFi counter")
        void shouldBridgeDistinctEventType() throws Exception {
            testRunner.run(1, false, true);
            int port = getServerPort();
            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/does-not-exist"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            String routeNotFoundCounter =
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "route_not_found";
            assertEquals(1L, testRunner.getCounterValue(routeNotFoundCounter),
                    "A 404 request should surface one route_not_found NiFi counter");
        }

        @Test
        @DisplayName("Should derive counter names through the stable Counters convention")
        void shouldDeriveStableCounterNames() {
            String name = RestApiGatewayConstants.Counters.counterName(
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX,
                    GatewaySecurityEvents.EventType.AUTH_FAILED.name());

            assertEquals("gateway.events.auth_failed", name,
                    "Counter name must be the prefix plus the lower-cased event identifier");
        }

        private void sendUnauthenticated(int port) throws Exception {
            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/health"))
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());
        }
    }

    /**
     * White-box coverage for {@link RestApiGatewayProcessor#publishCounterDeltas} that drives the
     * three event sources directly (gateway / cui-http transport / token-sheriff token validation)
     * without an HTTP round-trip. Each source is set on the processor's package-private
     * {@code AtomicReference} holders, then {@code publishCounterDeltas} is invoked with a
     * {@link MockProcessSession} whose backing {@link SharedSessionState} exposes the resulting
     * NiFi counter values. This isolates the cumulative-delta math, the per-source counter-name
     * derivation, and the null-source guards from the embedded-server paths.
     */
    @Nested
    @DisplayName("Counter Bridge (direct, all sources)")
    class CounterBridgeDirect {

        private RestApiGatewayProcessor processor;
        private SharedSessionState sessionState;

        @BeforeEach
        void initProcessor() {
            processor = new RestApiGatewayProcessor();
            sessionState = new SharedSessionState(processor, new AtomicLong(0));
        }

        private MockProcessSession newSession() {
            return new MockProcessSession(sessionState, processor, null);
        }

        @Test
        @DisplayName("Should publish a gateway event source delta to its NiFi counter")
        void shouldPublishGatewaySource() {
            // Arrange
            var gatewayEvents = new GatewaySecurityEvents();
            gatewayEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_ROLE_DENIED);
            gatewayEvents.increment(GatewaySecurityEvents.EventType.AUTHZ_ROLE_DENIED);
            processor.gatewaySecurityEvents.set(gatewayEvents);

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert
            assertEquals(2L, sessionState.getCounterValue(
                            RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "authz_role_denied"),
                    "Gateway counter must equal the cumulative source count");
        }

        @Test
        @DisplayName("Should publish a cui-http transport-security source delta to its NiFi counter")
        void shouldPublishHttpSecuritySource() {
            // Arrange
            var httpEvents = new SecurityEventCounter();
            httpEvents.increment(UrlSecurityFailureType.PATH_TRAVERSAL_DETECTED);
            httpEvents.increment(UrlSecurityFailureType.PATH_TRAVERSAL_DETECTED);
            httpEvents.increment(UrlSecurityFailureType.PATH_TRAVERSAL_DETECTED);
            processor.httpSecurityEvents.set(httpEvents);

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert
            assertEquals(3L, sessionState.getCounterValue(
                            RestApiGatewayConstants.Counters.HTTP_SECURITY_PREFIX + "path_traversal_detected"),
                    "HTTP security counter must equal the cumulative source count");
        }

        @Test
        @DisplayName("Should publish an token-sheriff token-validation source delta to its NiFi counter")
        void shouldPublishTokenValidationSource() {
            // Arrange
            var tokenCounter = new de.cuioss.sheriff.token.validation.security.SecurityEventCounter();
            tokenCounter.increment(
                    de.cuioss.sheriff.token.validation.security.SecurityEventCounter.EventType.TOKEN_EXPIRED);
            processor.configService.set(new CounterStubConfigService(tokenCounter));

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert
            assertEquals(1L, sessionState.getCounterValue(
                            RestApiGatewayConstants.Counters.TOKEN_VALIDATION_PREFIX + "token_expired"),
                    "Token-validation counter must equal the cumulative source count");
        }

        @Test
        @DisplayName("Should publish all three sources in a single trigger")
        void shouldPublishAllThreeSourcesAtOnce() {
            // Arrange
            var gatewayEvents = new GatewaySecurityEvents();
            gatewayEvents.increment(GatewaySecurityEvents.EventType.QUEUE_FULL);
            processor.gatewaySecurityEvents.set(gatewayEvents);

            var httpEvents = new SecurityEventCounter();
            httpEvents.increment(UrlSecurityFailureType.NULL_BYTE_INJECTION);
            processor.httpSecurityEvents.set(httpEvents);

            var tokenCounter = new de.cuioss.sheriff.token.validation.security.SecurityEventCounter();
            tokenCounter.increment(
                    de.cuioss.sheriff.token.validation.security.SecurityEventCounter.EventType.SIGNATURE_VALIDATION_FAILED);
            processor.configService.set(new CounterStubConfigService(tokenCounter));

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert
            assertEquals(1L, sessionState.getCounterValue(
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "queue_full"));
            assertEquals(1L, sessionState.getCounterValue(
                    RestApiGatewayConstants.Counters.HTTP_SECURITY_PREFIX + "null_byte_injection"));
            assertEquals(1L, sessionState.getCounterValue(
                    RestApiGatewayConstants.Counters.TOKEN_VALIDATION_PREFIX + "signature_validation_failed"));
        }

        @Test
        @DisplayName("Should publish only the incremental delta across successive triggers")
        void shouldPublishOnlyIncrementalDelta() {
            // Arrange
            var gatewayEvents = new GatewaySecurityEvents();
            processor.gatewaySecurityEvents.set(gatewayEvents);
            String counter =
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "missing_bearer_token";

            // Act + Assert — first trigger publishes 2
            gatewayEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            gatewayEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            processor.publishCounterDeltas(newSession());
            assertEquals(2L, sessionState.getCounterValue(counter));

            // Second trigger with no new events must not republish
            processor.publishCounterDeltas(newSession());
            assertEquals(2L, sessionState.getCounterValue(counter),
                    "No new events must keep the cumulative NiFi counter unchanged");

            // Third trigger after one more event publishes only the +1 delta
            gatewayEvents.increment(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN);
            processor.publishCounterDeltas(newSession());
            assertEquals(3L, sessionState.getCounterValue(counter),
                    "Only the incremental delta must be added to the cumulative NiFi counter");
        }

        @Test
        @DisplayName("Should re-baseline without a negative counter when the cumulative source rolls back")
        void shouldReBaselineOnRollback() {
            // Arrange — a stub source whose cumulative count we can drive up then down to simulate
            // a rollback/reset of the underlying gateway counter (e.g. a processor restart).
            var rollbackEvents = new RollbackGatewaySecurityEvents();
            processor.gatewaySecurityEvents.set(rollbackEvents);
            String counter =
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "missing_bearer_token";

            // Act + Assert — first trigger publishes the full cumulative 5
            rollbackEvents.setCount(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN, 5L);
            processor.publishCounterDeltas(newSession());
            assertEquals(5L, sessionState.getCounterValue(counter),
                    "First trigger must publish the full cumulative count");

            // Source rolls back to 2 — no negative adjustCounter must be published, the NiFi
            // counter must stay at 5, and the lower value must become the new baseline.
            rollbackEvents.setCount(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN, 2L);
            processor.publishCounterDeltas(newSession());
            assertEquals(5L, sessionState.getCounterValue(counter),
                    "A rollback must never decrement the cumulative NiFi counter");

            // After re-baselining at 2, the next genuine increase to 4 publishes only the +2 delta
            // (4 - 2), so the cumulative NiFi counter advances 5 -> 7, not 5 -> 9.
            rollbackEvents.setCount(GatewaySecurityEvents.EventType.MISSING_BEARER_TOKEN, 4L);
            processor.publishCounterDeltas(newSession());
            assertEquals(7L, sessionState.getCounterValue(counter),
                    "Post-rollback delta must be measured from the re-baselined value");
        }

        @Test
        @DisplayName("Should not publish a counter when the very first observed value is a rollback to a lower count")
        void shouldNotPublishNegativeOnFirstRollbackObservation() {
            // Arrange — first observed value is non-zero, then drops below it before any publish
            // could have stored a higher baseline, exercising the previous==null then decrease path.
            var rollbackEvents = new RollbackGatewaySecurityEvents();
            processor.gatewaySecurityEvents.set(rollbackEvents);
            String counter =
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "queue_full";
            rollbackEvents.setCount(GatewaySecurityEvents.EventType.QUEUE_FULL, 3L);
            processor.publishCounterDeltas(newSession());
            rollbackEvents.setCount(GatewaySecurityEvents.EventType.QUEUE_FULL, 0L);

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert — the rollback to 0 keeps the cumulative NiFi counter at its prior 3
            assertEquals(3L, sessionState.getCounterValue(counter),
                    "A rollback to zero must not subtract from the cumulative NiFi counter");
        }

        @Test
        @DisplayName("Should no-op when all sources are unset (null guards)")
        void shouldNoOpWhenSourcesUnset() {
            // Arrange — fresh processor: all three AtomicReferences hold null

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert — no counter is ever created
            assertNull(sessionState.getCounterValue(
                            RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "missing_bearer_token"),
                    "Null gateway source must not publish any counter");
        }

        @Test
        @DisplayName("Should treat an empty token-validation counter optional as a no-op")
        void shouldHandleEmptyTokenCounterOptional() {
            // Arrange — config service present but its counter optional is empty
            processor.configService.set(new TestJwtIssuerConfigService());
            var gatewayEvents = new GatewaySecurityEvents();
            gatewayEvents.increment(GatewaySecurityEvents.EventType.AUTH_FAILED);
            processor.gatewaySecurityEvents.set(gatewayEvents);

            // Act
            processor.publishCounterDeltas(newSession());

            // Assert — gateway source still publishes; absent token counter is silently skipped
            assertEquals(1L, sessionState.getCounterValue(
                    RestApiGatewayConstants.Counters.GATEWAY_EVENT_PREFIX + "auth_failed"));
            assertNull(sessionState.getCounterValue(
                            RestApiGatewayConstants.Counters.TOKEN_VALIDATION_PREFIX + "token_expired"),
                    "Empty token-validation optional must not create a counter");
        }
    }

    @Nested
    @DisplayName("Counter name derivation")
    class CounterNameDerivation {

        @ParameterizedTest(name = "[{index}] {0}{1} -> {2}")
        @CsvSource({
                "gateway.events.,MISSING_BEARER_TOKEN,gateway.events.missing_bearer_token",
                "gateway.token.,TOKEN_EXPIRED,gateway.token.token_expired",
                "gateway.http.security.,PATH_TRAVERSAL_DETECTED,gateway.http.security.path_traversal_detected"
        })
        @DisplayName("Should lower-case the event identifier and concatenate it to the prefix")
        void shouldDeriveCounterName(String prefix, String eventName, String expected) {
            assertEquals(expected,
                    RestApiGatewayConstants.Counters.counterName(prefix, eventName),
                    "Counter name must be the prefix plus the lower-cased event identifier");
        }
    }

    /**
     * Minimal {@link JwtIssuerConfigService} stub that surfaces a pre-populated token-sheriff
     * {@code SecurityEventCounter} so the token-validation publish path in
     * {@link RestApiGatewayProcessor#publishCounterDeltas} can be exercised directly. The shared
     * {@link TestJwtIssuerConfigService} always returns an empty counter optional, so it cannot
     * drive that branch.
     */
    /**
     * {@link GatewaySecurityEvents} stub whose per-event cumulative count can be driven up
     * <em>and</em> down via {@link #setCount}, simulating a rollback/reset of the underlying
     * source counter (e.g. a processor restart). The real {@code GatewaySecurityEvents} only
     * exposes monotonic {@code increment}, so it cannot drive the re-baseline branch in
     * {@link RestApiGatewayProcessor#publishCounterDeltas}.
     */
    private static final class RollbackGatewaySecurityEvents extends GatewaySecurityEvents {

        private final Map<EventType, Long> counts = new EnumMap<>(EventType.class);

        private void setCount(EventType eventType, long value) {
            counts.put(eventType, value);
        }

        @Override
        public Map<EventType, Long> getAllCounts() {
            return Map.copyOf(counts);
        }
    }

    private static final class CounterStubConfigService extends AbstractControllerService
            implements JwtIssuerConfigService {

        private final de.cuioss.sheriff.token.validation.security.SecurityEventCounter counter;

        private CounterStubConfigService(
                de.cuioss.sheriff.token.validation.security.SecurityEventCounter counter) {
            this.counter = counter;
        }

        @Override
        public AccessTokenContent validateToken(String rawToken) throws TokenValidationException {
            throw new UnsupportedOperationException("not used in counter-bridge tests");
        }

        @Override
        public JwtAuthenticationConfig getAuthenticationConfig() {
            return new JwtAuthenticationConfig(16384, Set.of(), true);
        }

        @Override
        public Optional<de.cuioss.sheriff.token.validation.security.SecurityEventCounter> getSecurityEventCounter() {
            return Optional.of(counter);
        }
    }

    private int getServerPort() {
        var processor = (RestApiGatewayProcessor) testRunner.getProcessor();
        return processor.serverManager.getPort();
    }
}
