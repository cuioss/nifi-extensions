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

import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.DispatcherType;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.EnumSet;
import java.util.UUID;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link ProcessorIdValidationFilter} using embedded Jetty + REST Assured.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/security.adoc">Security Specification</a>
 */
@EnableTestLogger
@DisplayName("Processor ID Validation Filter Tests")
class ProcessorIdValidationFilterTest {

    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    private static final String COMPONENT_ID_HEADER = "X-Component-Id";
    private static final String ENDPOINT = "/nifi-api/processors/jwt/validate";

    @BeforeAll
    static void startServer() throws Exception {
        EmbeddedServletTestSupport.startServer(ctx -> {
            ctx.addFilter(ProcessorIdValidationFilter.class, "/nifi-api/processors/jwt/*",
                    EnumSet.of(DispatcherType.REQUEST));
            ctx.addServlet(new ServletHolder(new EmbeddedServletTestSupport.PassthroughServlet()),
                    "/nifi-api/processors/jwt/*");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
    }

    @Nested
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should allow request with valid processor ID header")
        void shouldAllowRequestWithValidProcessorId() {
            given()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }

        @Test
        @DisplayName("Should reject request when processor ID is null")
        void shouldRejectRequestWhenProcessorIdIsNull() {
            given()
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(401)
                    .contentType(containsString("application/json"))
                    .body("error", notNullValue())
                    .body("valid", equalTo(false))
                    .body("accessible", equalTo(false));
        }

        static Stream<Arguments> invalidProcessorIdCases() {
            return Stream.of(
                    Arguments.of("", "Missing or empty processor ID header", "empty string"),
                    Arguments.of("   ", "Missing or empty processor ID header", "whitespace"),
                    Arguments.of("not-a-valid-uuid", "Invalid processor ID format", "non-UUID")
            );
        }

        @ParameterizedTest(name = "Should reject request when processor ID is {2}")
        @MethodSource("invalidProcessorIdCases")
        @DisplayName("Should reject request with invalid processor ID")
        void shouldRejectRequestWithInvalidProcessorId(String processorId,
                String expectedMessage, String scenario) {
            given()
                    .header(PROCESSOR_ID_HEADER, processorId)
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(401)
                    .body("error", containsString(expectedMessage));
        }

        @Test
        @DisplayName("Should reject empty processor ID on verify-token endpoint")
        void shouldRejectEmptyProcessorIdOnVerifyToken() {
            given()
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(401)
                    .body("error", containsString("Missing or empty processor ID header"));
        }
    }

    @Nested
    @DisplayName("Component ID Fallback Tests")
    class ComponentIdFallbackTests {

        @Test
        @DisplayName("Should accept request with valid X-Component-Id when X-Processor-Id is absent")
        void shouldAcceptComponentIdHeader() {
            given()
                    .header(COMPONENT_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }

        @Test
        @DisplayName("Should prefer X-Processor-Id over X-Component-Id")
        void shouldPreferProcessorIdOverComponentId() {
            given()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .header(COMPONENT_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }

        @Test
        @DisplayName("Should reject request when both headers are missing")
        void shouldRejectWhenBothHeadersMissing() {
            given()
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(401)
                    .body("error", containsString("Missing or empty processor ID header"));
        }

        @Test
        @DisplayName("Should reject invalid UUID in X-Component-Id fallback")
        void shouldRejectInvalidComponentId() {
            given()
                    .header(COMPONENT_ID_HEADER, "not-a-uuid")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(401)
                    .body("error", containsString("Invalid processor ID format"));
        }
    }

    @Nested
    @DisplayName("JSON Error Response Tests")
    class JsonErrorResponseTests {

        @Test
        @DisplayName("Should return valid JSON structure in error response")
        void shouldReturnValidJsonStructureInErrorResponse() {
            given()
                    .header(PROCESSOR_ID_HEADER, "")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(401)
                    .contentType(containsString("application/json"))
                    .body("error", notNullValue())
                    .body("valid", equalTo(false))
                    .body("accessible", equalTo(false));
        }
    }

    @Nested
    @DisplayName("Edge Case Tests")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle null servlet path gracefully")
        void shouldPassWithValidProcessorIdOnAnyPath() {
            given()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .get("/nifi-api/processors/jwt/some-other-path")
                    .then()
                    .statusCode(200);
        }
    }
}
