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
package de.cuioss.nifi.rest.config;

import de.cuioss.http.security.database.ApacheCVEAttackDatabase;
import de.cuioss.http.security.database.AttackTestCase;
import de.cuioss.http.security.database.ModSecurityCRSAttackDatabase;
import de.cuioss.http.security.database.OWASPTop10AttackDatabase;
import de.cuioss.test.generator.Generators;
import de.cuioss.test.generator.TypedGenerator;
import de.cuioss.test.generator.junit.EnableGeneratorController;
import de.cuioss.test.generator.junit.parameterized.TypeGeneratorSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ArgumentsSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnableGeneratorController
@DisplayName("RoutePattern")
class RoutePatternTest {

    @Nested
    @DisplayName("Placeholder Detection")
    class PlaceholderDetection {

        @ParameterizedTest
        @ValueSource(strings = {"/api/{id}", "/api/{id}/sub", "/api/v1/{a}/{b}/status"})
        @DisplayName("Should detect placeholders in templates with curly braces")
        void shouldDetectPlaceholders(String template) {
            assertTrue(RoutePattern.containsPlaceholders(template),
                    "Template with braces should be detected");
        }

        @ParameterizedTest
        @ValueSource(strings = {"/api/users", "/api/v1/data", "/metrics", "/"})
        @DisplayName("Should report no placeholders for plain templates")
        void shouldReportNoPlaceholders(String template) {
            assertFalse(RoutePattern.containsPlaceholders(template),
                    "Plain template should not be detected");
        }

        @Test
        @DisplayName("Should report no placeholders for null path")
        void shouldReportNoPlaceholdersForNull() {
            assertFalse(RoutePattern.containsPlaceholders(null),
                    "Null path should not be detected");
        }
    }

    @Nested
    @DisplayName("Single Parameter Matching")
    class SingleParameterMatching {

        @ParameterizedTest
        @TypeGeneratorSource(value = SingleParameterValueGenerator.class, count = 5)
        @DisplayName("Should match and extract a single generated parameter value")
        void shouldMatchSingleParameter(String value) {
            var pattern = RoutePattern.compile("/api/v1/personalprozesse/{processid}/status");

            var result = pattern.match("/api/v1/personalprozesse/" + value + "/status");

            assertTrue(result.isPresent(), "Path should match the pattern");
            assertEquals(Map.of("processid", value), result.get(),
                    "Extracted parameter should match the generated value");
        }

        public static final class SingleParameterValueGenerator implements TypedGenerator<String> {

            private final TypedGenerator<String> letters = Generators.letterStrings(1, 16);

            @Override
            public String next() {
                return letters.next();
            }

            @Override
            public Class<String> getType() {
                return String.class;
            }
        }

        @Test
        @DisplayName("Should expose the ordered parameter names")
        void shouldExposeParameterNames() {
            var pattern = RoutePattern.compile("/api/{id}/resource");

            assertEquals(List.of("id"), pattern.parameterNames(),
                    "Parameter names should be exposed");
            assertEquals("/api/{id}/resource", pattern.template(),
                    "Template should be retained");
        }

        @Test
        @DisplayName("Should not match when a literal segment differs")
        void shouldNotMatchDifferentLiteral() {
            var pattern = RoutePattern.compile("/api/{id}/status");

            var result = pattern.match("/api/12345/state");

            assertTrue(result.isEmpty(), "Differing literal segment should not match");
        }

        @Test
        @DisplayName("Should not match when a path segment is missing")
        void shouldNotMatchMissingSegment() {
            var pattern = RoutePattern.compile("/api/{id}/status");

            var result = pattern.match("/api/12345");

            assertTrue(result.isEmpty(), "Missing trailing segment should not match");
        }

        @Test
        @DisplayName("Should not match when the placeholder spans multiple segments")
        void shouldNotMatchMultiSegmentValue() {
            var pattern = RoutePattern.compile("/api/{id}/status");

            var result = pattern.match("/api/12/34/status");

            assertTrue(result.isEmpty(), "A slash in the value should not match a single segment");
        }
    }

    @Nested
    @DisplayName("Multiple Parameter Matching")
    class MultipleParameterMatching {

        @ParameterizedTest
        @TypeGeneratorSource(value = TenantUserGenerator.class, count = 5)
        @DisplayName("Should match and extract multiple generated parameter values")
        void shouldMatchMultipleParameters(TenantUser pair) {
            var pattern = RoutePattern.compile("/api/{tenant}/users/{userId}");

            var result = pattern.match("/api/" + pair.tenant() + "/users/" + pair.userId());

            assertTrue(result.isPresent(), "Path should match the multi-parameter pattern");
            assertEquals(Map.of("tenant", pair.tenant(), "userId", pair.userId()), result.get(),
                    "Both generated parameters should be extracted");
        }

        public record TenantUser(String tenant, String userId) {
        }

        public static final class TenantUserGenerator implements TypedGenerator<TenantUser> {

            private final TypedGenerator<String> letters = Generators.letterStrings(1, 12);

            @Override
            public TenantUser next() {
                return new TenantUser(letters.next(), letters.next());
            }

            @Override
            public Class<TenantUser> getType() {
                return TenantUser.class;
            }
        }

        @Test
        @DisplayName("Should preserve parameter declaration order")
        void shouldPreserveParameterOrder() {
            var pattern = RoutePattern.compile("/{a}/{b}/{c}");

            assertEquals(List.of("a", "b", "c"), pattern.parameterNames(),
                    "Parameter order should be preserved");
        }
    }

    @Nested
    @DisplayName("Constrained Parameter Matching")
    class ConstrainedParameterMatching {

        @ParameterizedTest
        @CsvSource({
                "/api/{id:\\d+}/status, /api/12345/status, 12345",
                "/api/{code:[A-Z]{3}}/x, /api/ABC/x, ABC",
                "/api/{slug:[a-z-]+}/y, /api/my-route/y, my-route"
        })
        @DisplayName("Should match segments satisfying the constraint")
        void shouldMatchConstrainedSegment(String template, String path, String expected) {
            var pattern = RoutePattern.compile(template);

            var result = pattern.match(path);

            assertTrue(result.isPresent(), "Conforming segment should match");
            assertEquals(expected, result.get().values().iterator().next(),
                    "Extracted value should match");
        }

        @ParameterizedTest
        @CsvSource({
                "/api/{id:\\d+}/status, /api/abc/status",
                "/api/{code:[A-Z]{3}}/x, /api/abcd/x",
                "/api/{id:\\d+}/status, /api/12a/status"
        })
        @DisplayName("Should not match segments violating the constraint")
        void shouldNotMatchNonConformingSegment(String template, String path) {
            var pattern = RoutePattern.compile(template);

            var result = pattern.match(path);

            assertTrue(result.isEmpty(), "Non-conforming segment should not match");
        }
    }

    @Nested
    @DisplayName("Literal Templates")
    class LiteralTemplates {

        @Test
        @DisplayName("Should compile and match a template with no placeholders")
        void shouldMatchLiteralTemplate() {
            var pattern = RoutePattern.compile("/api/users");

            var result = pattern.match("/api/users");

            assertTrue(result.isPresent(), "Literal template should match its own path");
            assertTrue(result.get().isEmpty(), "Literal match should extract no parameters");
            assertTrue(pattern.parameterNames().isEmpty(), "Literal template has no parameters");
        }

        @Test
        @DisplayName("Should treat regex metacharacters in literals as literal")
        void shouldQuoteLiteralMetacharacters() {
            var pattern = RoutePattern.compile("/api/a.b/{id}");

            assertTrue(pattern.match("/api/a.b/7").isPresent(),
                    "Literal dot should match a dot");
            assertTrue(pattern.match("/api/axb/7").isEmpty(),
                    "Literal dot should not match an arbitrary character");
        }
    }

    @Nested
    @DisplayName("Null Handling")
    class NullHandling {

        @Test
        @DisplayName("Should return empty for a null request path")
        void shouldReturnEmptyForNullPath() {
            var pattern = RoutePattern.compile("/api/{id}");

            Optional<Map<String, String>> result = pattern.match(null);

            assertTrue(result.isEmpty(), "Null request path should not match");
        }
    }

    @Nested
    @DisplayName("Malformed Template Rejection")
    class MalformedTemplateRejection {

        @Test
        @DisplayName("Should reject a null template")
        void shouldRejectNullTemplate() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile(null),
                    "Null template should be rejected");
            assertTrue(exception.getMessage().contains("null"),
                    "Message should mention null");
        }

        @Test
        @DisplayName("Should reject an unclosed brace")
        void shouldRejectUnclosedBrace() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{id/status"),
                    "Unclosed brace should be rejected");
            assertTrue(exception.getMessage().contains("Unclosed"),
                    "Message should mention the unclosed brace");
        }

        @Test
        @DisplayName("Should reject an unbalanced closing brace")
        void shouldRejectUnbalancedClosingBrace() {
            assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/id}/status"),
                    "Unbalanced closing brace should be rejected");
        }

        @Test
        @DisplayName("Should reject a duplicate parameter name")
        void shouldRejectDuplicateName() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{id}/x/{id}"),
                    "Duplicate parameter name should be rejected");
            assertTrue(exception.getMessage().contains("Duplicate"),
                    "Message should mention the duplicate");
        }

        @Test
        @DisplayName("Should reject an empty parameter name")
        void shouldRejectEmptyName() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{}/status"),
                    "Empty parameter name should be rejected");
            assertTrue(exception.getMessage().contains("Empty"),
                    "Message should mention the empty name");
        }

        @Test
        @DisplayName("Should reject an invalid constraint regex")
        void shouldRejectInvalidConstraintRegex() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{id:[}/status"),
                    "Invalid constraint regex should be rejected");
            assertTrue(exception.getMessage().contains("constraint"),
                    "Message should mention the constraint");
        }

        @Test
        @DisplayName("Should reject a non-identifier parameter name")
        void shouldRejectNonIdentifierName() {
            assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{1id}/status"),
                    "Parameter name starting with a digit should be rejected");
        }

        @Test
        @DisplayName("Should reject a parameter name containing underscore")
        void shouldRejectUnderscoreInName() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{user_id}/status"),
                    "Parameter name with underscore should be rejected (Java named groups disallow underscores)");
            assertTrue(exception.getMessage().contains("Invalid parameter name"),
                    "Message should describe the invalid name");
        }

        @Test
        @DisplayName("Should reject an empty constraint")
        void shouldRejectEmptyConstraint() {
            var exception = assertThrows(IllegalArgumentException.class,
                    () -> RoutePattern.compile("/api/{id:}/status"),
                    "Empty constraint should be rejected");
            assertTrue(exception.getMessage().contains("Empty constraint"),
                    "Message should mention the empty constraint");
        }
    }

    @Nested
    @DisplayName("Adversarial Parameter Matching")
    class AdversarialParameterMatching {

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(OWASPTop10AttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle OWASP attack value in a parameter segment safely")
        void shouldHandleOwaspAttackValue(AttackTestCase testCase) {
            assertMatchHandlesAttackSafely(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ApacheCVEAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle Apache CVE attack value in a parameter segment safely")
        void shouldHandleApacheCveAttackValue(AttackTestCase testCase) {
            assertMatchHandlesAttackSafely(testCase);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ArgumentsSource(ModSecurityCRSAttackDatabase.ArgumentsProvider.class)
        @DisplayName("Should handle ModSecurity CRS attack value in a parameter segment safely")
        void shouldHandleModSecurityAttackValue(AttackTestCase testCase) {
            assertMatchHandlesAttackSafely(testCase);
        }

        /**
         * Feeds an attack string into a single {@code {id}} parameter segment and
         * asserts {@link RoutePattern#match} handles it safely: it never throws, and
         * when an attack string contains a path separator it must NOT over-match a
         * single-segment placeholder (a {@code {id}} segment matches exactly one path
         * segment, so a value carrying a {@code /} cannot satisfy it).
         */
        private void assertMatchHandlesAttackSafely(AttackTestCase testCase) {
            var pattern = RoutePattern.compile("/api/{id}/status");
            String attack = testCase.attackString();

            var result = assertDoesNotThrow(
                    () -> pattern.match("/api/" + attack + "/status"),
                    "RoutePattern.match must not throw for: " + testCase.attackDescription());

            if (attack.contains("/")) {
                assertTrue(result.isEmpty(),
                        "A multi-segment attack value must not match a single-segment placeholder: "
                                + testCase.attackDescription());
            } else if (result.isPresent()) {
                assertEquals(attack, result.get().get("id"),
                        "When matched, the extracted value must equal the input verbatim (no silent rewrite)");
            }
        }
    }
}
