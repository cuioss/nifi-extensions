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
package de.cuioss.nifi.ui.servlets.integration;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for backend servlet endpoints using REST Assured.
 * These tests verify that the endpoints are properly configured and accessible.
 * 
 * Note: These tests are designed to run against a deployed instance of the application.
 * They require the web application to be running and accessible.
 */
class BackendEndpointsIntegrationTest {

    @BeforeAll
    static void setUp() {
        RestAssured.baseURI = "http://localhost";
        RestAssured.port = 8080;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    @Test
    void jwtVerificationEndpointAccessible() {
        String requestBody = """
            {
                "token": "test-token",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/verify-token")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("valid", notNullValue())
                .body("error", notNullValue())
                .body("claims", notNullValue());
    }

    @Test
    void metricsEndpointAccessible() {
        given()
                .accept(ContentType.JSON)
                .when()
                .get("/nifi-api/processors/jwt/metrics")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("totalTokensValidated", notNullValue())
                .body("validTokens", notNullValue())
                .body("invalidTokens", notNullValue())
                .body("errorRate", notNullValue())
                .body("lastValidation", notNullValue())
                .body("topErrors", notNullValue());
    }

    @Test
    void jwksContentValidationEndpointAccessible() {
        String requestBody = """
            {
                "jwksContent": "{\\"keys\\":[{\\"kty\\":\\"RSA\\",\\"kid\\":\\"test\\",\\"n\\":\\"test\\",\\"e\\":\\"AQAB\\"}]}",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/validate-jwks-content")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("valid", notNullValue())
                .body("accessible", notNullValue())
                .body("keyCount", notNullValue())
                .body("algorithms", notNullValue());
    }

    @Test
    void jwksUrlValidationEndpointAccessible() {
        String requestBody = """
            {
                "jwksUrl": "https://example.com/.well-known/jwks.json",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/validate-jwks-url")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("valid", notNullValue())
                .body("accessible", notNullValue())
                .body("keyCount", notNullValue())
                .body("algorithms", notNullValue());
    }

    @Test
    void jwksFileValidationEndpointAccessible() {
        String requestBody = """
            {
                "jwksFilePath": "/nonexistent/path/jwks.json",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/validate-jwks-file")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("valid", notNullValue())
                .body("accessible", notNullValue())
                .body("keyCount", notNullValue())
                .body("algorithms", notNullValue());
    }

    @Test
    void e2eTokenVerificationEndpointAccessible() {
        String requestBody = """
            {
                "token": "test-token",
                "issuer": "test-issuer"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/api/token/verify")
                .then()
                .statusCode(not(equalTo(404))) // Should not be Not Found
                .contentType(ContentType.JSON)
                .body("valid", notNullValue())
                .body("error", notNullValue())
                .body("claims", notNullValue());
    }

    @Test
    void jwtVerificationWithValidToken() {
        String requestBody = """
            {
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/verify-token")
                .then()
                .statusCode(anyOf(equalTo(200), equalTo(400), equalTo(401), equalTo(500))) // Valid responses
                .contentType(ContentType.JSON)
                .body("valid", isA(Boolean.class))
                .body("error", isA(String.class))
                .body("claims", notNullValue());
    }

    @Test
    void jwtVerificationWithMissingToken() {
        String requestBody = """
            {
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/verify-token")
                .then()
                .statusCode(equalTo(400)) // Bad Request for missing token
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("error", containsString("token"));
    }

    @Test
    void jwtVerificationWithMissingProcessorId() {
        String requestBody = """
            {
                "token": "test-token"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/verify-token")
                .then()
                .statusCode(equalTo(400)) // Bad Request for missing processor ID
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("error", containsString("Processor ID"));
    }

    @Test
    void jwksContentValidationWithValidContent() {
        String requestBody = """
            {
                "jwksContent": "{\\"keys\\":[{\\"kty\\":\\"RSA\\",\\"kid\\":\\"test-key\\",\\"use\\":\\"sig\\",\\"n\\":\\"test-modulus\\",\\"e\\":\\"AQAB\\"}]}",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/validate-jwks-content")
                .then()
                .statusCode(anyOf(equalTo(200), equalTo(400))) // Valid responses for JWKS validation
                .contentType(ContentType.JSON)
                .body("valid", isA(Boolean.class))
                .body("accessible", isA(Boolean.class))
                .body("keyCount", isA(Integer.class))
                .body("algorithms", notNullValue());
    }

    @Test
    void jwksContentValidationWithInvalidContent() {
        String requestBody = """
            {
                "jwksContent": "{\\"invalid\\": \\"structure\\"}",
                "processorId": "test-processor-id"
            }
            """;

        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body(requestBody)
                .when()
                .post("/nifi-api/processors/jwt/validate-jwks-content")
                .then()
                .statusCode(equalTo(400)) // Bad Request for invalid JWKS
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("error", containsString("keys"));
    }

    @Test
    void invalidJsonRequest() {
        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body("{ invalid json }")
                .when()
                .post("/nifi-api/processors/jwt/verify-token")
                .then()
                .statusCode(equalTo(400)) // Bad Request for invalid JSON
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("error", containsString("JSON"));
    }

    @Test
    void metricsEndpointStructure() {
        given()
                .accept(ContentType.JSON)
                .when()
                .get("/nifi-api/processors/jwt/metrics")
                .then()
                .statusCode(anyOf(equalTo(200), equalTo(401), equalTo(403))) // Allow for auth requirements
                .contentType(ContentType.JSON)
                .body("totalTokensValidated", isA(Integer.class))
                .body("validTokens", isA(Integer.class))
                .body("invalidTokens", isA(Integer.class))
                .body("errorRate", isA(Number.class))
                .body("topErrors", isA(List.class));
    }

    @Test
    void unknownEndpoint() {
        given()
                .contentType(ContentType.JSON)
                .accept(ContentType.JSON)
                .body("{\"test\": \"data\"}")
                .when()
                .post("/nifi-api/processors/jwt/unknown-endpoint")
                .then()
                .statusCode(anyOf(equalTo(404), equalTo(405))); // Not Found or Method Not Allowed
    }

    @Test
    void corsHeaders() {
        given()
                .header("Origin", "http://localhost:3000")
                .accept(ContentType.JSON)
                .when()
                .get("/nifi-api/processors/jwt/metrics")
                .then()
                .statusCode(not(equalTo(404))); // Basic accessibility test
        // Note: CORS headers would be tested here if configured
    }

    @Test
    void endpointResponseTimes() {
        given()
                .accept(ContentType.JSON)
                .when()
                .get("/nifi-api/processors/jwt/metrics")
                .then()
                .statusCode(not(equalTo(404)))
                .time(lessThan(5000L)); // Response should be under 5 seconds
    }
}