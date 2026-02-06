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
package de.cuioss.nifi.processors.auth;

import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static de.cuioss.nifi.processors.auth.JWTProcessorConstants.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Test class for {@link JWTTokenAuthenticator}.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/technical-components.adoc">Technical Components Specification</a>
 */
class JWTTokenAuthenticatorTest {

    private TestRunner testRunner;

    @BeforeEach
    void setup() {
        testRunner = TestRunners.newTestRunner(JWTTokenAuthenticator.class);
    }

    @Test
    @DisplayName("Test extracting token from Authorization header")
    void extractTokenFromAuthorizationHeader() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with Authorization header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer " + token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 1);
        testRunner.assertTransferCount(Relationships.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test extracting token from custom header")
    void extractTokenFromCustomHeader() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.CUSTOM_HEADER);
        testRunner.setProperty(Properties.CUSTOM_HEADER_NAME, "X-JWT-Token");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with custom header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.x-jwt-token", token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 1);
        testRunner.assertTransferCount(Relationships.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test extracting token from flow file content")
    void extractTokenFromFlowFileContent() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.FLOW_FILE_CONTENT);

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with token as content
        testRunner.enqueue(token);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 1);
        testRunner.assertTransferCount(Relationships.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test failure when no token is found")
    void failureWhenNoTokenFound() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);

        // Create flow file without Authorization header
        testRunner.enqueue("test data");

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        testRunner.assertTransferCount(Relationships.FAILURE, 1);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.FAILURE).getFirst();

        // Verify attributes
        flowFile.assertAttributeExists("jwt.error.reason");
        assertNotNull(flowFile.getAttribute("jwt.error.reason"));
    }

    @Test
    @DisplayName("Test extracting token with Bearer prefix")
    void extractTokenWithBearerPrefix() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Bearer");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with Authorization header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer " + token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 1);
        testRunner.assertTransferCount(Relationships.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test failure when token is empty string")
    void failureWhenTokenIsEmpty() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);

        // Create flow file with empty Authorization header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "");
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        testRunner.assertTransferCount(Relationships.FAILURE, 1);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.FAILURE).getFirst();

        // Verify error attributes are set
        flowFile.assertAttributeExists("jwt.error.code");
        flowFile.assertAttributeExists("jwt.error.reason");
        flowFile.assertAttributeExists("jwt.error.category");
        assertEquals(JWTProcessorConstants.Error.Code.NO_TOKEN_FOUND, flowFile.getAttribute("jwt.error.code"));
        assertEquals(JWTProcessorConstants.Error.Category.EXTRACTION_ERROR, flowFile.getAttribute("jwt.error.category"));
    }

    @Test
    @DisplayName("Test failure when empty content in flow file")
    void failureWhenEmptyContent() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.FLOW_FILE_CONTENT);

        // Create flow file with empty content
        testRunner.enqueue("");

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        testRunner.assertTransferCount(Relationships.FAILURE, 1);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.FAILURE).getFirst();

        // Verify error attributes
        flowFile.assertAttributeExists("jwt.error.code");
        flowFile.assertAttributeExists("jwt.error.reason");
        flowFile.assertAttributeExists("jwt.error.category");
    }

    @Test
    @DisplayName("Test no flow file in queue")
    void noFlowFileInQueue() {
        // Setup
        testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
        testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);

        // Don't enqueue any flow file

        // Run the processor
        testRunner.run();

        // Verify no transfers
        testRunner.assertTransferCount(Relationships.SUCCESS, 0);
        testRunner.assertTransferCount(Relationships.FAILURE, 0);
    }

    @Nested
    @DisplayName("Content Size Limit Tests")
    class ContentSizeLimitTests {

        @Test
        @DisplayName("Should reject oversized flow file content")
        void shouldRejectOversizedFlowFileContent() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.FLOW_FILE_CONTENT);

            // Create content larger than 16KB limit
            String oversizedContent = "x".repeat(20_000);
            testRunner.enqueue(oversizedContent);

            testRunner.run();

            // Should route to FAILURE
            testRunner.assertTransferCount(Relationships.SUCCESS, 0);
            testRunner.assertTransferCount(Relationships.FAILURE, 1);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.FAILURE).getFirst();
            flowFile.assertAttributeExists(JWTAttributes.Error.REASON);
        }

        @Test
        @DisplayName("Should accept content within size limit")
        void shouldAcceptContentWithinSizeLimit() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.FLOW_FILE_CONTENT);

            // Normal JWT token content (well within 16KB)
            String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature";
            testRunner.enqueue(token);

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.FAILURE, 0);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            assertEquals(token, flowFile.getAttribute(JWTAttributes.Token.VALUE));
        }
    }

    @Nested
    @DisplayName("Bearer Prefix Tests")
    class BearerPrefixTests {

        @Test
        @DisplayName("Should use configured bearer prefix")
        void shouldUseConfiguredBearerPrefix() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
            testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);
            testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Token");

            String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature";

            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Token " + token);
            testRunner.enqueue("test data", attributes);

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.FAILURE, 0);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            assertEquals(token, flowFile.getAttribute(JWTAttributes.Token.VALUE));
        }

        @Test
        @DisplayName("Should not strip default prefix when custom prefix is configured")
        void shouldNotStripDefaultPrefixWhenCustomConfigured() {
            testRunner.setProperty(Properties.TOKEN_LOCATION, TokenLocation.AUTHORIZATION_HEADER);
            testRunner.setProperty(Properties.TOKEN_HEADER, Http.AUTHORIZATION_HEADER);
            testRunner.setProperty(Properties.BEARER_TOKEN_PREFIX, "Token");

            String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature";

            // Send with "Bearer" prefix but custom is set to "Token"
            Map<String, String> attributes = new HashMap<>();
            attributes.put("http.headers.authorization", "Bearer " + token);
            testRunner.enqueue("test data", attributes);

            testRunner.run();

            testRunner.assertTransferCount(Relationships.SUCCESS, 1);
            testRunner.assertTransferCount(Relationships.FAILURE, 0);

            MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(Relationships.SUCCESS).getFirst();
            // The "Bearer " should NOT be stripped since configured prefix is "Token"
            // The whole value "Bearer eyJ..." is returned as the token
            String extractedToken = flowFile.getAttribute(JWTAttributes.Token.VALUE);
            assertNotNull(extractedToken);
            // Should contain "Bearer" as part of the token since it wasn't stripped
            assertEquals("Bearer " + token, extractedToken);
        }
    }
}
