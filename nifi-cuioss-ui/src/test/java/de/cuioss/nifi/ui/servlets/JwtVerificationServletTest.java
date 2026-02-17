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
package de.cuioss.nifi.ui.servlets;

import de.cuioss.nifi.ui.service.JwtValidationService;
import de.cuioss.nifi.ui.service.JwtValidationService.TokenValidationResult;
import de.cuioss.sheriff.oauth.core.domain.token.AccessTokenContent;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.easymock.EasyMock.*;
import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link JwtVerificationServlet} using embedded Jetty + REST Assured.
 * <p>
 * Uses a configurable {@link JwtValidationService} test double injected via
 * constructor. Each test sets the desired behavior before making HTTP requests.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/jwt-rest-api.adoc">JWT REST API Specification</a>
 */
@EnableTestLogger
@DisplayName("JwtVerificationServlet tests")
class JwtVerificationServletTest {

    private static final String ENDPOINT = "/nifi-api/processors/jwt/verify-token";

    /**
     * Configurable token verification behavior — each test sets this before
     * making HTTP requests.
     */
    @FunctionalInterface
    interface TokenVerifier {
        TokenValidationResult verify(String token, String processorId) throws Exception;
    }

    private static volatile TokenVerifier currentVerifier;

    @BeforeAll
    static void startServer() throws Exception {
        NiFiWebConfigurationContext dummyContext = createNiceMock(NiFiWebConfigurationContext.class);
        replay(dummyContext);

        EmbeddedServletTestSupport.startServer(ctx -> {
            JwtVerificationServlet servlet = new JwtVerificationServlet(
                    new JwtValidationService(dummyContext) {
                        @Override
                        public TokenValidationResult verifyToken(String token, String processorId,
                                HttpServletRequest request)
                                throws IllegalArgumentException, IllegalStateException {
                            try {
                                return currentVerifier.verify(token, processorId);
                            } catch (IllegalArgumentException | IllegalStateException e) {
                                throw e;
                            } catch (Exception e) {
                                throw new IllegalStateException(e);
                            }
                        }
                    });
            ctx.addServlet(new ServletHolder(servlet), ENDPOINT);
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
    }

    @Test
    @DisplayName("Should return valid response for valid token")
    void validTokenVerification() {
        currentVerifier = (token, processorId) -> {
            TokenValidationResult result = TokenValidationResult.success(null);
            result.setIssuer("test-issuer");
            result.setScopes(List.of("read", "write"));
            result.setRoles(List.of("admin"));
            result.setAuthorized(true);
            return result;
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(true))
                .body("issuer", equalTo("test-issuer"));
    }

    @Test
    @DisplayName("Should return invalid response for invalid token")
    void invalidTokenVerification() {
        currentVerifier = (token, processorId) ->
                TokenValidationResult.failure("Invalid token signature");

        given()
                .contentType("application/json")
                .body("""
                        {"token":"invalid-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid token signature"));
    }

    @Test
    @DisplayName("Should return 401 for expired token")
    void expiredTokenVerification() {
        currentVerifier = (token, processorId) ->
                TokenValidationResult.failure("Token expired at 2025-01-01T00:00:00Z");

        given()
                .contentType("application/json")
                .body("""
                        {"token":"expired-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(401)
                .body("valid", equalTo(false))
                .body("error", containsString("expired"));
    }

    static Stream<Arguments> badRequestProvider() {
        return Stream.of(
                Arguments.of("{\"processorId\": \"test-processor-id\"}", "Missing required field: token"),
                Arguments.of("{\"token\": \"test-token\"}", "Processor ID cannot be empty"),
                Arguments.of("{ invalid json }", "Invalid JSON format"),
                Arguments.of("{\"token\": \"\", \"processorId\": \"test-processor-id\"}", "Token cannot be empty"),
                Arguments.of("{\"token\": \"test-token\", \"processorId\": \"\"}", "Processor ID cannot be empty")
        );
    }

    @ParameterizedTest(name = "Bad request: {1}")
    @MethodSource("badRequestProvider")
    @DisplayName("Should reject bad requests")
    void shouldRejectBadRequest(String requestJson, String expectedError) {
        // Service should not be called for bad requests
        currentVerifier = (token, processorId) -> {
            throw new AssertionError("Service should not have been called");
        };

        given()
                .contentType("application/json")
                .body(requestJson)
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString(expectedError));
    }

    @Test
    @DisplayName("Should return 500 for service IllegalStateException")
    void serviceException() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalStateException("Service not available");
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(500)
                .body("valid", equalTo(false))
                .body("error", containsString("Service not available"));
    }

    @Test
    @DisplayName("Should return 400 for service IllegalArgumentException")
    void illegalArgumentFromService() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalArgumentException("Invalid processor configuration");
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(400)
                .body("valid", equalTo(false))
                .body("error", containsString("Invalid request"));
    }

    @Test
    @DisplayName("Should return 500 for service communication error (wrapped as IllegalStateException)")
    void communicationErrorFromService() {
        currentVerifier = (token, processorId) -> {
            throw new IllegalStateException("Connection refused");
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"test-token","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(500)
                .body("valid", equalTo(false))
                .body("error", containsString("Service not available"));
    }

    @Test
    @DisplayName("Should return claims from valid token with AccessTokenContent")
    void validTokenWithClaimsMap() {
        currentVerifier = (token, processorId) -> {
            AccessTokenContent mockTokenContent = createNiceMock(AccessTokenContent.class);
            expect(mockTokenContent.getSubject()).andReturn(Optional.of("test-subject")).anyTimes();
            expect(mockTokenContent.getIssuer()).andReturn("test-issuer").anyTimes();
            expect(mockTokenContent.getExpirationTime()).andReturn(OffsetDateTime.now().plusHours(1)).anyTimes();
            expect(mockTokenContent.getRoles()).andReturn(List.of("admin")).anyTimes();
            expect(mockTokenContent.getScopes()).andReturn(List.of("read")).anyTimes();
            replay(mockTokenContent);

            TokenValidationResult result = TokenValidationResult.success(mockTokenContent);
            result.setAuthorized(true);
            return result;
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"eyJhbGciOiJSUzI1NiJ9.test.sig","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(true))
                .body("issuer", equalTo("test-issuer"))
                .body("claims.sub", equalTo("test-subject"));
    }

    @Test
    @DisplayName("Should return empty claims when tokenContent is null")
    void validTokenWithNullIssuerAndEmptyScopes() {
        currentVerifier = (token, processorId) -> TokenValidationResult.success(null);

        given()
                .contentType("application/json")
                .body("""
                        {"token":"test-token-minimal","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("authorized", equalTo(false))
                .body("claims.size()", equalTo(0));
    }

    @Test
    @DisplayName("Should handle null issuer in claims")
    void validTokenWithNullIssuerInClaims() {
        currentVerifier = (token, processorId) -> {
            AccessTokenContent mockTokenContent = createNiceMock(AccessTokenContent.class);
            expect(mockTokenContent.getSubject()).andReturn(Optional.of("test-subject")).anyTimes();
            expect(mockTokenContent.getIssuer()).andReturn(null).anyTimes();
            expect(mockTokenContent.getExpirationTime()).andReturn(OffsetDateTime.now().plusHours(1)).anyTimes();
            expect(mockTokenContent.getRoles()).andReturn(List.of()).anyTimes();
            expect(mockTokenContent.getScopes()).andReturn(List.of()).anyTimes();
            replay(mockTokenContent);

            TokenValidationResult result = TokenValidationResult.success(mockTokenContent);
            result.setAuthorized(true);
            return result;
        };

        given()
                .contentType("application/json")
                .body("""
                        {"token":"test-token-null-issuer","processorId":"test-processor-id"}""")
                .when()
                .post(ENDPOINT)
                .then()
                .statusCode(200)
                .body("valid", equalTo(true))
                .body("claims", hasKey("iss"));
    }
}
