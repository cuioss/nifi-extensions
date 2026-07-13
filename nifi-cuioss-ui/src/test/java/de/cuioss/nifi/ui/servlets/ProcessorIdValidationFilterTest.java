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

import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link ProcessorIdValidationFilter} using embedded Jetty + REST Assured.
 * <p>
 * The filter delegates to the shared {@link ProcessorIdHeaderValidator}, so it applies the
 * identical processor-ID rule (cui-http header-value pipeline plus the
 * {@code [A-Za-z0-9_-]+} allow-list) and the identical 400-JSON {@code {"error": ...}}
 * response contract used by the component-facing servlets. Only the {@code X-Processor-Id}
 * header is honoured; {@code X-Component-Id} is no longer consumed.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/architecture/gateway.adoc">Gateway Architecture</a>
 */
@EnableTestLogger
@DisplayName("Processor ID Validation Filter Tests")
class ProcessorIdValidationFilterTest {

    private static final String PROCESSOR_ID_HEADER = "X-Processor-Id";
    private static final String COMPONENT_ID_HEADER = "X-Component-Id";
    private static final String ENDPOINT = "/nifi-api/processors/jwt/validate";

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            ctx.addFilter(ProcessorIdValidationFilter.class, "/nifi-api/processors/jwt/*",
                    EnumSet.of(DispatcherType.REQUEST));
            ctx.addServlet(new ServletHolder(new EmbeddedServletTestSupport.PassthroughServlet()),
                    "/nifi-api/processors/jwt/*");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @Nested
    @DisplayName("Processor ID Validation Tests")
    class ProcessorIdValidationTests {

        @Test
        @DisplayName("Should allow request with valid processor ID header")
        void shouldAllowRequestWithValidProcessorId() {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }

        @Test
        @DisplayName("Should allow a non-UUID but allow-list-clean identifier (single rule, not strict UUID)")
        void shouldAllowAllowListCleanIdentifier() {
            // The shared rule is the identifier allow-list, not strict UUID parsing, so a
            // clean identifier such as "abc-123_XYZ" is accepted uniformly across filter and
            // servlets.
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, "abc-123_XYZ")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }

        @Test
        @DisplayName("Should reject request when processor ID header is absent with 400 JSON")
        void shouldRejectRequestWhenProcessorIdIsNull() {
            handle.spec()
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Missing processor ID"));
        }

        static Stream<Arguments> blankProcessorIdCases() {
            return Stream.of(
                    Arguments.of("", "empty string"),
                    Arguments.of("   ", "whitespace")
            );
        }

        @ParameterizedTest(name = "Should reject blank processor ID: {1}")
        @MethodSource("blankProcessorIdCases")
        @DisplayName("Should reject blank processor ID with 400 Missing processor ID")
        void shouldRejectBlankProcessorId(String processorId, String scenario) {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, processorId)
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        static Stream<Arguments> illegalProcessorIdCases() {
            return Stream.of(
                    Arguments.of("../../../etc/passwd", "path traversal"),
                    Arguments.of("id with spaces", "spaces"),
                    Arguments.of("bad$id!", "special characters")
            );
        }

        @ParameterizedTest(name = "Should reject illegal processor ID: {1}")
        @MethodSource("illegalProcessorIdCases")
        @DisplayName("Should reject illegal processor ID with 400 Invalid header value")
        void shouldRejectIllegalProcessorId(String processorId, String scenario) {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, processorId)
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Invalid header value"));
        }

        @Test
        @DisplayName("Should reject missing processor ID on verify-token endpoint")
        void shouldRejectMissingProcessorIdOnVerifyToken() {
            handle.spec()
                    .when()
                    .post("/nifi-api/processors/jwt/verify-token")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }
    }

    @Nested
    @DisplayName("X-Component-Id is no longer consumed")
    class ComponentIdNotConsumedTests {

        @Test
        @DisplayName("Should ignore X-Component-Id and reject when X-Processor-Id is absent")
        void shouldIgnoreComponentIdHeader() {
            // X-Component-Id is not consumed by any servlet, so the filter no longer accepts
            // it. A request carrying only a valid X-Component-Id is rejected for the missing
            // X-Processor-Id header.
            handle.spec()
                    .header(COMPONENT_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should honour X-Processor-Id even when X-Component-Id is also present")
        void shouldHonourProcessorIdWhenComponentIdAlsoPresent() {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .header(COMPONENT_ID_HEADER, "irrelevant-value")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(200)
                    .body(equalTo("OK"));
        }
    }

    @Nested
    @DisplayName("JSON Error Response Tests")
    class JsonErrorResponseTests {

        @Test
        @DisplayName("Should return uniform 400 JSON error structure")
        void shouldReturnValidJsonStructureInErrorResponse() {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, "")
                    .when()
                    .post(ENDPOINT)
                    .then()
                    .statusCode(400)
                    .contentType(containsString("application/json"))
                    .body("error", notNullValue());
        }
    }

    @Nested
    @DisplayName("Edge Case Tests")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should pass a valid processor ID on any matched path")
        void shouldPassWithValidProcessorIdOnAnyPath() {
            handle.spec()
                    .header(PROCESSOR_ID_HEADER, UUID.randomUUID().toString())
                    .when()
                    .get("/nifi-api/processors/jwt/some-other-path")
                    .then()
                    .statusCode(200);
        }
    }
}
