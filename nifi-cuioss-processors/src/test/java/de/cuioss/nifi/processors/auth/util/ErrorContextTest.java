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

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the ErrorContext utility class.
 */
class ErrorContextTest {

    @Test
    void testBasicErrorContext() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .buildMessage("Test error occurred");

        assertTrue(message.contains("Test error occurred"));
        assertTrue(message.contains("Component=TestComponent"));
        assertTrue(message.contains("Operation=testOperation"));
    }

    @Test
    void testErrorContextWithCode() {
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
    void testErrorContextWithContext() {
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
    void testErrorContextWithCause() {
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
    void testErrorContextWithNestedCause() {
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
    void testErrorContextWithLongValue() {
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
    void testErrorContextWithNullValue() {
        String message = ErrorContext.forComponent("TestComponent")
                .operation("testOperation")
                .build()
                .with("nullValue", null)
                .buildMessage("Test error");

        assertTrue(message.contains("Test error"));
        assertFalse(message.contains("nullValue")); // Null values should be ignored
    }

    @Test
    void testAllErrorCodes() {
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
}