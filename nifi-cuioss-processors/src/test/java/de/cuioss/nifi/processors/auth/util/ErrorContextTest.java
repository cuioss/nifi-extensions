/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.processors.auth.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the ErrorContext utility class.
 *
 * @see <a href="https://github.com/cuioss/nifi-extensions/tree/main/doc/specification/error-handling.adoc">Error Handling Specification</a>
 */
class ErrorContextTest {

    @Test
    void basicErrorContext() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .buildMessage("Test error occurred");

        assertTrue(message.contains("Test error occurred"));
        assertTrue(message.contains("Component=TestComponent"));
        assertTrue(message.contains("Operation=testOperation"));
    }

    @Test
    void errorContextWithCode() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .errorCode(ErrorContext.ErrorCodes.VALIDATION_ERROR)
                .build()
                .buildMessage("Validation failed");

        assertTrue(message.contains("Validation failed"));
        assertTrue(message.contains("ErrorCode=" + ErrorContext.ErrorCodes.VALIDATION_ERROR));
        assertTrue(message.contains("Component=TestComponent"));
        assertTrue(message.contains("Operation=testOperation"));
    }

    @Test
    void errorContextWithContext() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .with("key1", "value1")
                .with("key2", 42)
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertTrue(message.contains("key1=value1"));
        assertTrue(message.contains("key2=42"));
    }

    @Test
    void errorContextWithCause() {
        Exception cause = new IllegalArgumentException("Invalid argument");
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .cause(cause)
                .build()
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertTrue(message.contains("Caused by: IllegalArgumentException"));
        assertTrue(message.contains("Invalid argument"));
    }

    @Test
    void errorContextWithNestedCause() {
        Exception rootCause = new IllegalStateException("Root cause");
        Exception cause = new RuntimeException("Wrapped exception", rootCause);

        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .cause(cause)
                .build()
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertTrue(message.contains("Caused by: RuntimeException"));
        assertTrue(message.contains("Root cause: IllegalStateException"));
        assertTrue(message.contains("Root cause"));
    }

    @Test
    void errorContextWithLongValue() {
        String longValue = "a".repeat(150);
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .with("longValue", longValue)
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertTrue(message.contains("longValue="));
        assertTrue(message.contains("..."));
        assertFalse(message.contains(longValue)); // Should be truncated
    }

    @Test
    void errorContextWithNullValue() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .with("nullValue", null)
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertFalse(message.contains("nullValue")); // Null values should be ignored
    }

    @Test
    void allErrorCodes() {
        // Verify all error codes are defined
        assertNotNull(ErrorContext.ErrorCodes.CONFIGURATION_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.VALIDATION_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.PROCESSING_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.SECURITY_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.IO_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.AUTHENTICATION_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.AUTHORIZATION_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.TOKEN_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.NETWORK_ERROR);
        assertNotNull(ErrorContext.ErrorCodes.RESOURCE_ERROR);
    }

    @Nested
    @DisplayName("Robustness Tests")
    class RobustnessTests {

        @Test
        @DisplayName("Should handle circular exception cause chain without infinite loop")
        void shouldHandleCircularCauseChain() {
            // Create circular cause chain: A -> B -> A
            Exception exA = new RuntimeException("A");
            Exception exB = new RuntimeException("B", exA);
            try {
                var causeField = Throwable.class.getDeclaredField("cause");
                causeField.setAccessible(true);
                causeField.set(exA, exB);
            } catch (Exception ignored) {
                // If reflection fails, skip this test scenario
                return;
            }

            // Should not infinite-loop — completes within reasonable time
            String message = ErrorContext.forComponent("TestComponent")
                    .operation("testOperation")
                    .cause(exA)
                    .build()
                    .buildMessage("Circular test");

            assertNotNull(message);
            assertTrue(message.contains("Circular test"));
        }

        @Test
        @DisplayName("Should return unmodifiable context map")
        void shouldReturnUnmodifiableContextMap() {
            ErrorContext ctx = ErrorContext.forComponent("TestComponent")
                    .operation("testOperation")
                    .build()
                    .with("key1", "value1");

            Map<String, Object> contextMap = ctx.getContext();
            assertThrows(UnsupportedOperationException.class,
                    () -> contextMap.put("newKey", "newValue"));
        }

        @Test
        @DisplayName("Should reject context keys with invalid characters")
        void shouldRejectInvalidContextKeys() {
            ErrorContext ctx = ErrorContext.forComponent("TestComponent")
                    .operation("testOperation")
                    .build()
                    .with("valid-key", "value1")
                    .with("key with spaces", "value2")
                    .with("key\nnewline", "value3")
                    .with(null, "value4");

            // Only the valid key should be present
            assertEquals(1, ctx.getContext().size());
            assertTrue(ctx.getContext().containsKey("valid-key"));
        }
    }
}