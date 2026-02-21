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
package de.cuioss.nifi.integration;

import io.restassured.builder.RequestSpecBuilder;
import io.restassured.config.RestAssuredConfig;
import io.restassured.config.SSLConfig;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import lombok.experimental.UtilityClass;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Shared utilities for Custom UI WAR integration tests. Provides processor
 * discovery via the NiFi REST API and REST Assured request specification
 * building with bearer token authentication.
 *
 * <p><strong>Authentication approach:</strong> Uses only the
 * {@code Authorization: Bearer} header (no cookies). NiFi's
 * {@code StandardBearerTokenResolver} checks the header first, and omitting
 * the {@code __Secure-Authorization-Bearer} cookie avoids triggering NiFi's
 * CSRF protection ({@code CsrfCookieRequestMatcher} only activates when
 * that cookie is present).
 */
@UtilityClass
class CustomUITestSupport {

    /**
     * Discovers a processor ID from the NiFi flow by processor name substring.
     * Queries the process group status API recursively and returns the UUID of
     * the first processor whose name contains the given substring.
     *
     * @param client                 the HTTPS-capable HTTP client
     * @param bearerToken            the NiFi bearer token
     * @param processorNameSubstring substring to match in processor names
     * @return the processor UUID
     */
    static String discoverProcessorId(HttpClient client, String bearerToken,
            String processorNameSubstring) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(IntegrationTestSupport.NIFI_API_BASE
                        + "/flow/process-groups/root/status?recursive=true"))
                .GET()
                .header("Authorization", "Bearer " + bearerToken)
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Process group status request failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));

        JsonObject root = Json.createReader(new StringReader(response.body())).readObject();
        JsonObject aggregateSnapshot = root
                .getJsonObject("processGroupStatus")
                .getJsonObject("aggregateSnapshot");

        return IntegrationTestSupport.findProcessorInSnapshot(aggregateSnapshot, processorNameSubstring)
                .map(proc -> proc.getJsonObject("processorStatusSnapshot").getString("id"))
                .orElseGet(() -> {
                    fail("No processor found with name containing '%s' in the NiFi flow"
                            .formatted(processorNameSubstring));
                    return null; // unreachable
                });
    }

    /**
     * Discovers the Custom UI WAR base URL by querying the NiFi REST API for the
     * processor's bundle version and constructing the WAR context path. NiFi
     * deploys WARs using the filename without extension as context path, e.g.
     * {@code nifi-cuioss-ui-1.0-SNAPSHOT.war} → {@code /nifi-cuioss-ui-1.0-SNAPSHOT}.
     *
     * @param client      the HTTPS-capable HTTP client
     * @param bearerToken the NiFi bearer token
     * @param processorId the processor UUID whose NAR bundles the Custom UI WAR
     * @return the Custom UI base URL (e.g. {@code https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT})
     */
    static String discoverCustomUIBasePath(HttpClient client, String bearerToken,
            String processorId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(IntegrationTestSupport.NIFI_API_BASE + "/processors/" + processorId))
                .GET()
                .header("Authorization", "Bearer " + bearerToken)
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(),
                "Processor details request failed with status %d: %s"
                        .formatted(response.statusCode(), response.body()));

        JsonObject component = Json.createReader(new StringReader(response.body()))
                .readObject().getJsonObject("component");
        String version = component.getJsonObject("bundle").getString("version");

        // NiFi WAR context path convention: the artifact ID followed by a dash and version
        return IntegrationTestSupport.NIFI_BASE + "/nifi-cuioss-ui-" + version;
    }

    /**
     * Builds a REST Assured {@link RequestSpecification} pre-configured with:
     * <ul>
     *   <li>Base URI = Custom UI base path</li>
     *   <li>Relaxed HTTPS validation (trust-all for Docker self-signed certs)</li>
     *   <li>{@code Authorization: Bearer <jwt>} header</li>
     *   <li>{@code X-Processor-Id: <uuid>} header</li>
     *   <li>{@code Content-Type: application/json}</li>
     * </ul>
     *
     * <p>No cookies are sent intentionally — NiFi's {@code CsrfCookieRequestMatcher}
     * only activates CSRF protection when the {@code __Secure-Authorization-Bearer}
     * cookie is present. Using only the header avoids CSRF requirements.
     *
     * @param customUIBase the Custom UI base URL
     * @param bearerToken  the NiFi bearer token (JWT)
     * @param processorId  a valid processor UUID
     * @return a fully configured request specification
     */
    static RequestSpecification buildAuthSpec(String customUIBase,
            String bearerToken, String processorId) {
        return new RequestSpecBuilder()
                .setBaseUri(customUIBase)
                .setConfig(RestAssuredConfig.config()
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation()))
                .addHeader("Authorization", "Bearer " + bearerToken)
                .addHeader("X-Processor-Id", processorId)
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .build();
    }

    /**
     * Builds a REST Assured {@link RequestSpecification} for requests that have
     * valid NiFi authentication but no {@code X-Processor-Id} header. Used for
     * security tests that verify the filter rejects requests without proper
     * processor headers.
     *
     * @param customUIBase the Custom UI base URL
     * @param bearerToken  the NiFi bearer token (JWT)
     * @return a request specification with NiFi auth but no processor ID
     */
    static RequestSpecification buildSessionOnlySpec(String customUIBase,
            String bearerToken) {
        return new RequestSpecBuilder()
                .setBaseUri(customUIBase)
                .setConfig(RestAssuredConfig.config()
                        .sslConfig(SSLConfig.sslConfig().relaxedHTTPSValidation()))
                .addHeader("Authorization", "Bearer " + bearerToken)
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .build();
    }
}
