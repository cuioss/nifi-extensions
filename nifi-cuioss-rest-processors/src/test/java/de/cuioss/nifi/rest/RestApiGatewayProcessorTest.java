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

import de.cuioss.nifi.jwt.test.TestJwtIssuerConfigService;
import de.cuioss.nifi.rest.server.JettyServerManager;
import de.cuioss.sheriff.oauth.core.test.TestTokenHolder;
import de.cuioss.sheriff.oauth.core.test.generator.TestTokenGenerators;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("RestApiGatewayProcessor")
@EnableTestLogger
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

        tokenHolder = TestTokenGenerators.accessTokens().next();
        mockConfigService.configureValidToken(tokenHolder.asAccessTokenContent());

        httpClient = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        // Stop the processor (stops Jetty)
        if (testRunner != null) {
            testRunner.stop();
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
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.JWT_ISSUER_CONFIG_SERVICE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.MAX_REQUEST_SIZE));
            assertTrue(descriptors.contains(RestApiGatewayConstants.Properties.REQUEST_QUEUE_SIZE));
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/users"))
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            // Send to users
            httpClient.send(
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/users"))
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
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
                    HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health?page=1&limit=10"))
                            .header("Authorization", "Bearer " + tokenHolder.getRawToken())
                            .GET().build(),
                    HttpResponse.BodyHandlers.ofString());

            testRunner.run(1, false, false);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship("health").getFirst();
            flowFile.assertAttributeEquals("http.query.page", "1");
            flowFile.assertAttributeEquals("http.query.limit", "10");
        }
    }

    @Nested
    @DisplayName("Logging")
    class Logging {

        @Test
        @DisplayName("Should log server started")
        void shouldLogServerStarted() throws Exception {
            testRunner.run(1, false, true);
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.INFO, "REST-1:");
        }
    }

    private int getServerPort() {
        var processor = (RestApiGatewayProcessor) testRunner.getProcessor();
        // Access through reflection since we need the port from the serverManager
        try {
            var field = RestApiGatewayProcessor.class.getDeclaredField("serverManager");
            field.setAccessible(true);
            var mgr = (JettyServerManager) field.get(processor);
            return mgr.getPort();
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Could not get server port", e);
        }
    }
}
