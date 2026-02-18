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

import de.cuioss.nifi.ui.util.ComponentConfigReader.ComponentConfig;
import de.cuioss.nifi.ui.util.ComponentConfigReader.ComponentType;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import jakarta.servlet.http.HttpServletRequest;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.junit.jupiter.api.*;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

/**
 * Tests for {@link ComponentInfoServlet} using embedded Jetty + REST Assured.
 * Uses a test subclass to stub the component config resolution.
 */
@EnableTestLogger
@DisplayName("ComponentInfoServlet tests")
class ComponentInfoServletTest {

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

    @BeforeAll
    static void startServer() throws Exception {
        EmbeddedServletTestSupport.startServer(ctx ->
                ctx.addServlet(new ServletHolder(new ComponentInfoServlet() {
                    @Override
                    protected ComponentConfig resolveComponentConfig(
                            String processorId, HttpServletRequest request) {
                        RuntimeException ex = configException.get();
                        if (ex != null) throw ex;
                        return componentConfig.get();
                    }
                }), "/component-info"));
    }

    @AfterAll
    static void stopServer() throws Exception {
        EmbeddedServletTestSupport.stopServer();
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
            given()
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

            given()
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

            given()
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

            given()
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
            given()
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }

        @Test
        @DisplayName("Should return 400 for blank processor ID")
        void shouldReturn400ForBlankProcessorId() {
            given()
                    .header("X-Processor-Id", "  ")
                    .when()
                    .get("/component-info")
                    .then()
                    .statusCode(400)
                    .body("error", containsString("Missing processor ID"));
        }
    }
}
