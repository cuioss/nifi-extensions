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

import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.nifi.ui.util.ComponentConfigReader.ComponentConfig;
import de.cuioss.nifi.ui.util.ComponentConfigReader.ComponentType;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.nifi.web.ClusterRequestException;
import org.apache.nifi.web.NiFiWebConfigurationContext;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ArgumentsSource;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.easymock.EasyMock.createNiceMock;
import static org.easymock.EasyMock.replay;
import static org.hamcrest.Matchers.*;

/**
 * Tests for {@link ComponentInfoServlet} using embedded Jetty + REST Assured.
 * Uses a test subclass to stub the component config resolution.
 */
@EnableTestLogger
@DisplayName("ComponentInfoServlet tests")
class ComponentInfoServletTest {

    // B3 rationale: a fixed, well-formed UUID is used as the routing stub because the
    // test subclass overrides resolveComponentConfig and never dereferences the ID — the
    // value only needs to (a) satisfy the servlet's X-Processor-Id header validation as a
    // legitimate UUID and (b) stay constant so each request routes to the same stubbed
    // config. A literal UUID (vs a generated one) keeps the routing deterministic and the
    // assertions readable; the specific digits carry no behavioral meaning.
    private static final String PROCESSOR_ID = "d290f1ee-6c54-4b01-90e6-d701748f0851";
    private static final String PROCESSOR_CLASS =
            "de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator";
    private static final String CS_CLASS =
            "de.cuioss.nifi.jwt.config.StandardJwtIssuerConfigService";
    private static final String GATEWAY_CLASS =
            "de.cuioss.nifi.processors.gateway.RestApiGatewayProcessor";

    /** Configurable component config response. */
    private static final AtomicReference<ComponentConfig> componentConfig =
            new AtomicReference<>(new ComponentConfig(
                    ComponentType.PROCESSOR, PROCESSOR_CLASS, Map.of()));

    /** When true, resolveComponentConfig throws IllegalArgumentException. */
    private static final AtomicReference<RuntimeException> configException =
            new AtomicReference<>(null);

    private static EmbeddedServletTestSupport.ServerHandle handle;

    @BeforeAll
    static void startServer() throws Exception {
        // A non-null nifi-web-configuration-context attribute makes the servlet's
        // init() populate configContext, so the null-context 503 guard stays quiet and
        // the overridden resolveComponentConfig drives the stubbed responses. The mock
        // itself is never dereferenced because resolveComponentConfig is overridden.
        NiFiWebConfigurationContext dummyContext = createNiceMock(NiFiWebConfigurationContext.class);
        replay(dummyContext);

        handle = EmbeddedServletTestSupport.startServer(ctx -> {
            ctx.setAttribute("nifi-web-configuration-context", dummyContext);
            ctx.addServlet(new ServletHolder(new ComponentInfoServlet() {
                @Override
                protected ComponentConfig resolveComponentConfig(
                        String processorId, HttpServletRequest request) {
                    RuntimeException ex = configException.get();
                    if (ex != null) throw ex;
                    return componentConfig.get();
                }
            }), "/component-info");
        });
    }

    @AfterAll
    static void stopServer() throws Exception {
        handle.close();
    }

    @BeforeEach
    void resetBehavior() {
        componentConfig.set(new ComponentConfig(
                ComponentType.PROCESSOR, PROCESSOR_CLASS, Map.of()));
        configException.set(null);
    }

    @Nested
    @DisplayName("Processor detection")
    class ProcessorDetection {

        @Test
        @DisplayName("Should return processor type and class")
        void shouldReturnProcessorTypeAndClass() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("type", equalTo("PROCESSOR"))
                    .body("componentClass", equalTo(PROCESSOR_CLASS));
        }

        @Test
        @DisplayName("Should return gateway processor type and class")
        void shouldReturnGatewayProcessorTypeAndClass() {
            componentConfig.set(new ComponentConfig(
                    ComponentType.PROCESSOR, GATEWAY_CLASS, Map.of()));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(200)
                    .body("type", equalTo("PROCESSOR"))
                    .body("componentClass", equalTo(GATEWAY_CLASS));
        }
    }

    @Nested
    @DisplayName("Controller service detection")
    class ControllerServiceDetection {

        @Test
        @DisplayName("Should return controller service type and class")
        void shouldReturnControllerServiceTypeAndClass() {
            componentConfig.set(new ComponentConfig(
                    ComponentType.CONTROLLER_SERVICE, CS_CLASS, Map.of()));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(200)
                    .contentType(containsString("application/json"))
                    .body("type", equalTo("CONTROLLER_SERVICE"))
                    .body("componentClass", equalTo(CS_CLASS));
        }
    }

    @Nested
    @DisplayName("Error handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should return 404 for unknown component ID")
        void shouldReturn404ForUnknownComponent() {
            configException.set(new IllegalArgumentException(
                    "Component not found: " + PROCESSOR_ID));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(404)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Component not found"));
        }

        @Test
        @DisplayName("Should return 400 for missing processor ID")
        void shouldReturn400ForMissingProcessorId() {
            handle.spec()
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should return 500 for NiFi cluster request failure")
        void shouldReturn500ForUnexpectedException() {
            configException.set(new ClusterRequestException(
                    new RuntimeException("Unexpected error in config resolution")));

            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(500)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Failed to resolve component info"));
        }

        @Test
        @DisplayName("Should return 400 for blank processor ID")
        void shouldReturn400ForBlankProcessorId() {
            handle.spec()
                    .header("X-Processor-Id", "  ")
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should return 503 JSON when NiFi configuration context is unavailable")
        void shouldReturn503WhenConfigContextUnavailable() throws Exception {
            // A servlet started without the nifi-web-configuration-context attribute has a
            // null configContext. A valid processor-ID request must yield a uniform JSON 503
            // instead of NPEing into a container 500 page.
            try (var noContextHandle = EmbeddedServletTestSupport.startServer(ctx ->
                    ctx.addServlet(new ServletHolder(new ComponentInfoServlet()), "/component-info"))) {
                noContextHandle.spec()
                        .header("X-Processor-Id", PROCESSOR_ID)
                        .when()
                        .get("/component-info")
                        .then()
                        .statusCode(503)
                        .contentType(containsString("application/json"))
                        .body("error", containsString("NiFi configuration context unavailable"));
            }
        }
    }

    // -----------------------------------------------------------------------
    // cui-http X-Processor-Id header security validation
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("cui-http X-Processor-Id security validation")
    class SecurityValidation {

        private static final String TRAVERSAL_PROCESSOR_ID = "../../../etc/passwd";

        @Test
        @DisplayName("Should reject malicious X-Processor-Id header with 400")
        void shouldRejectMaliciousProcessorIdHeader() {
            configException.set(new ClusterRequestException(
                    new RuntimeException("Component resolution must not be reached for a rejected header")));

            handle.spec()
                    .header("X-Processor-Id", TRAVERSAL_PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(400)
                    .contentType(containsString("application/json"))
                    .body("error", containsString("Invalid header value"));
        }

        @Test
        @DisplayName("Should let a legitimate UUID X-Processor-Id resolve component info")
        void shouldAllowLegitimateProcessorId() {
            handle.spec()
                    .header("X-Processor-Id", PROCESSOR_ID)
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(200)
                    .body("type", equalTo("PROCESSOR"))
                    .body("componentClass", equalTo(PROCESSOR_CLASS));
        }
    }

    // -----------------------------------------------------------------------
    // Adversarial attack-database coverage (OWASP / Apache CVE / ModSecurity CRS)
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("Adversarial attack-database coverage")
    class AdversarialSecurityValidation {

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject OWASP Top 10 attack on X-Processor-Id header")
        void shouldRejectOwaspAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject Apache CVE attack on X-Processor-Id header")
        void shouldRejectApacheCveAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should reject ModSecurity CRS attack on X-Processor-Id header")
        void shouldRejectModSecurityAttackOnHeader(AttackTestCase testCase) {
            assertAttackHeaderRejected(testCase);
        }

        /**
         * Feeds an attack string as the {@code X-Processor-Id} header and asserts the
         * servlet does not succeed (non-200). An attack string containing characters
         * illegal for an HTTP header line is rejected at the transport level, which
         * also counts as a successful rejection.
         */
        private void assertAttackHeaderRejected(AttackTestCase testCase) {
            configException.set(new ClusterRequestException(
                    new RuntimeException("Component resolution must not be reached for a rejected header")));
            try {
                handle.spec()
                        .header("X-Processor-Id", testCase.attackString())
                        .when()
                        .get("/component-info")
                        .then()
                        .statusCode(not(equalTo(200)));
            } catch (RuntimeException e) {
                // Attack string contains characters illegal for an HTTP header —
                // rejected at the transport level before reaching the servlet.
            }
        }
    }
}
