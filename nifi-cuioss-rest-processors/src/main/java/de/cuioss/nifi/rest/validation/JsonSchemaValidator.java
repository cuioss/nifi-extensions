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
package de.cuioss.nifi.rest.validation;

import de.cuioss.tools.logging.CuiLogger;
import dev.harrel.jsonschema.Validator;
import dev.harrel.jsonschema.ValidatorFactory;
import dev.harrel.jsonschema.providers.JakartaJsonNode;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Validates JSON request bodies against JSON Schema (Draft 2020-12).
 * <p>
 * Wraps {@code dev.harrel:json-schema} with the Jakarta JSON-P provider.
 * Schema sources are resolved eagerly at construction time: values starting
 * with {@code &#123;} are treated as inline JSON, all others as file paths.
 * The compiled validator is thread-safe and can be shared across Jetty handler threads.
 */
public class JsonSchemaValidator {

    private static final CuiLogger LOGGER = new CuiLogger(JsonSchemaValidator.class);

    private final Validator validator;
    private final Map<String, URI> schemaUris;

    /**
     * Creates a new validator, eagerly loading and compiling all schemas.
     *
     * @param routeSchemas mapping of route name to schema source (inline JSON or file path)
     * @throws IllegalStateException if any schema file cannot be read or any schema is invalid
     */
    public JsonSchemaValidator(Map<String, String> routeSchemas) {
        ValidatorFactory factory = new ValidatorFactory()
                .withJsonNodeFactory(new JakartaJsonNode.Factory());
        this.validator = factory.createValidator();
        Map<String, URI> uris = new HashMap<>();

        for (Map.Entry<String, String> entry : routeSchemas.entrySet()) {
            String routeName = entry.getKey();
            String schemaSource = entry.getValue();
            String schemaContent = resolveSchemaContent(routeName, schemaSource);
            URI schemaUri = validator.registerSchema(schemaContent);
            uris.put(routeName, schemaUri);
        }

        this.schemaUris = Collections.unmodifiableMap(uris);
    }

    private static String resolveSchemaContent(String routeName, String schemaSource) {
        if (schemaSource.strip().startsWith("{")) {
            LOGGER.info("Registered inline JSON Schema for route '%s'", routeName);
            return schemaSource;
        }
        try {
            Path schemaPath = Path.of(schemaSource).normalize();
            String content = Files.readString(schemaPath, StandardCharsets.UTF_8);
            LOGGER.info("Registered JSON Schema for route '%s' from %s", routeName, schemaPath);
            return content;
        } catch (IOException e) {
            throw new IllegalStateException(
                    "Failed to read JSON Schema file for route '%s': %s".formatted(routeName, schemaSource), e);
        }
    }

    /**
     * Validates a JSON body against the schema configured for the given route.
     *
     * @param routeName the route name to look up the schema for
     * @param body      the JSON request body bytes
     * @return empty list if valid or no schema configured; list of violations if invalid
     */
    public List<SchemaViolation> validate(String routeName, byte[] body) {
        URI schemaUri = schemaUris.get(routeName);
        if (schemaUri == null) {
            return List.of();
        }

        String json = new String(body, StandardCharsets.UTF_8);
        try {
            Validator.Result result = validator.validate(schemaUri, json);
            if (result.isValid()) {
                return List.of();
            }
            return result.getErrors().stream()
                    .map(error -> new SchemaViolation(
                            error.getInstanceLocation(),
                            error.getError()))
                    .toList();
        } catch (Exception e) {
            // Unparseable JSON or other validation infrastructure error
            return List.of(new SchemaViolation("", "Invalid JSON: " + e.getMessage()));
        }
    }

    /**
     * Checks whether a schema is registered for the given route.
     *
     * @param routeName the route name
     * @return {@code true} if a schema is registered
     */
    public boolean hasSchema(String routeName) {
        return schemaUris.containsKey(routeName);
    }
}
