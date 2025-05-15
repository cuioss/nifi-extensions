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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.HashMap;
import java.util.Map;


import org.apache.nifi.util.MockFlowFile;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Test class for {@link JWTTokenAuthenticator}.
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
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_HEADER, "Authorization");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with Authorization header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer " + token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(JWTTokenAuthenticator.SUCCESS, 1);
        testRunner.assertTransferCount(JWTTokenAuthenticator.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(JWTTokenAuthenticator.SUCCESS).get(0);

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test extracting token from custom header")
    void extractTokenFromCustomHeader() {
        // Setup
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_LOCATION, "CUSTOM_HEADER");
        testRunner.setProperty(JWTTokenAuthenticator.CUSTOM_HEADER_NAME, "X-JWT-Token");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with custom header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.x-jwt-token", token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(JWTTokenAuthenticator.SUCCESS, 1);
        testRunner.assertTransferCount(JWTTokenAuthenticator.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(JWTTokenAuthenticator.SUCCESS).get(0);

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test extracting token from flow file content")
    void extractTokenFromFlowFileContent() {
        // Setup
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_LOCATION, "FLOW_FILE_CONTENT");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with token as content
        testRunner.enqueue(token);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(JWTTokenAuthenticator.SUCCESS, 1);
        testRunner.assertTransferCount(JWTTokenAuthenticator.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(JWTTokenAuthenticator.SUCCESS).get(0);

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        flowFile.assertAttributeExists("jwt.extractedAt");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }

    @Test
    @DisplayName("Test failure when no token is found")
    void failureWhenNoTokenFound() {
        // Setup
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_HEADER, "Authorization");

        // Create flow file without Authorization header
        testRunner.enqueue("test data");

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(JWTTokenAuthenticator.SUCCESS, 0);
        testRunner.assertTransferCount(JWTTokenAuthenticator.FAILURE, 1);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(JWTTokenAuthenticator.FAILURE).get(0);

        // Verify attributes
        flowFile.assertAttributeExists("jwt.error.reason");
        assertNotNull(flowFile.getAttribute("jwt.error.reason"));
    }

    @Test
    @DisplayName("Test extracting token with Bearer prefix")
    void extractTokenWithBearerPrefix() {
        // Setup
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_LOCATION, "AUTHORIZATION_HEADER");
        testRunner.setProperty(JWTTokenAuthenticator.TOKEN_HEADER, "Authorization");
        testRunner.setProperty(JWTTokenAuthenticator.BEARER_TOKEN_PREFIX, "Bearer");

        // Sample JWT token
        String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Create flow file with Authorization header
        Map<String, String> attributes = new HashMap<>();
        attributes.put("http.headers.authorization", "Bearer " + token);
        testRunner.enqueue("test data", attributes);

        // Run the processor
        testRunner.run();

        // Verify results
        testRunner.assertTransferCount(JWTTokenAuthenticator.SUCCESS, 1);
        testRunner.assertTransferCount(JWTTokenAuthenticator.FAILURE, 0);

        // Get the output flow file
        MockFlowFile flowFile = testRunner.getFlowFilesForRelationship(JWTTokenAuthenticator.SUCCESS).get(0);

        // Verify attributes
        flowFile.assertAttributeExists("jwt.token");
        assertEquals(token, flowFile.getAttribute("jwt.token"));
    }
}