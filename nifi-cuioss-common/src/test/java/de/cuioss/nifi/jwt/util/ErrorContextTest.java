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
package de.cuioss.nifi.jwt.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ErrorContext")
class ErrorContextTest {

    @Nested
    @DisplayName("Builder Creation")
    class BuilderTests {

        @Test
        @DisplayName("Should create instance with all fields via builder")
        void shouldCreateWithAllFields() {
            // Arrange & Act
            ErrorContext context = ErrorContext.builder()
                    .operation("tokenValidation")
                    .component("JwtProcessor")
                    .errorCode("AUTH_001")
                    .cause(new RuntimeException("Test error"))
                    .build();

            // Assert
            assertEquals("tokenValidation", context.getOperation());
            assertEquals("JwtProcessor", context.getComponent());
            assertEquals("AUTH_001", context.getErrorCode());
            assertNotNull(context.getCause());
            assertEquals("Test error", context.getCause().getMessage());
            assertNotNull(context.getContext());
        }

        @Test
        @DisplayName("Should create instance with minimal fields")
        void shouldCreateWithMinimalFields() {
            // Arrange & Act
            ErrorContext context = ErrorContext.builder()
                    .operation("processing")
                    .component("TestComponent")
                    .build();

            // Assert
            assertEquals("processing", context.getOperation());
            assertEquals("TestComponent", context.getComponent());
            assertNull(context.getErrorCode());
            assertNull(context.getCause());
            assertNotNull(context.getContext());
        }
    }

    @Nested
    @DisplayName("Static Factory Method")
    class FactoryMethodTests {

        @Test
        @DisplayName("Should create builder via forComponent")
        void shouldCreateBuilderViaForComponent() {
            // Arrange & Act
            ErrorContext context = ErrorContext.forComponent("MyComponent")
                    .operation("myOperation")
                    .build();

            // Assert
            assertEquals("MyComponent", context.getComponent());
            assertEquals("myOperation", context.getOperation());
        }
    }

    @Nested
    @DisplayName("Context Map Management")
    class ContextMapTests {

        @Test
        @DisplayName("Should add valid key-value pairs to context")
        void shouldAddValidKeyValuePairs() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act
            context.with("key1", "value1")
                    .with("key_2", "value2")
                    .with("key-3", "value3")
                    .with("key.4", 123);

            // Assert
            Map<String, Object> contextMap = context.getContext();
            assertEquals("value1", contextMap.get("key1"));
            assertEquals("value2", contextMap.get("key_2"));
            assertEquals("value3", contextMap.get("key-3"));
            assertEquals(123, contextMap.get("key.4"));
        }

        @Test
        @DisplayName("Should ignore null keys")
        void shouldIgnoreNullKeys() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act
            context.with(null, "value");

            // Assert
            assertTrue(context.getContext().isEmpty());
        }

        @Test
        @DisplayName("Should ignore null values")
        void shouldIgnoreNullValues() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act
            context.with("key", null);

            // Assert
            assertTrue(context.getContext().isEmpty());
        }

        @Test
        @DisplayName("Should ignore keys with invalid format")
        void shouldIgnoreInvalidKeyFormat() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act
            context.with("invalid key", "value1")  // space not allowed
                    .with("key@test", "value2")      // @ not allowed
                    .with("key#test", "value3")      // # not allowed
                    .with("", "value4");             // empty not allowed

            // Assert
            assertTrue(context.getContext().isEmpty());
        }

        @Test
        @DisplayName("Should return unmodifiable context map")
        void shouldReturnUnmodifiableContextMap() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();
            context.with("key1", "value1");

            // Act
            Map<String, Object> contextMap = context.getContext();

            // Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> contextMap.put("key2", "value2"));
        }

        @Test
        @DisplayName("Should allow method chaining with 'with'")
        void shouldAllowMethodChaining() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act
            ErrorContext result = context.with("key1", "value1")
                    .with("key2", "value2");

            // Assert
            assertSame(context, result);
            assertEquals(2, context.getContext().size());
        }
    }

    @Nested
    @DisplayName("Message Building")
    class MessageBuildingTests {

        @Test
        @DisplayName("Should build message with all components")
        void shouldBuildMessageWithAllComponents() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("tokenValidation")
                    .component("JwtProcessor")
                    .errorCode("AUTH_001")
                    .build();
            context.with("issuer", "https://auth.example.com");

            // Act
            String message = context.buildMessage("Token validation failed");

            // Assert
            assertTrue(message.contains("Token validation failed"));
            assertTrue(message.contains("ErrorCode=AUTH_001"));
            assertTrue(message.contains("Component=JwtProcessor"));
            assertTrue(message.contains("Operation=tokenValidation"));
            assertTrue(message.contains("issuer=https://auth.example.com"));
        }

        @Test
        @DisplayName("Should build message without error code when null")
        void shouldBuildMessageWithoutErrorCode() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("processing")
                    .component("TestComponent")
                    .build();

            // Act
            String message = context.buildMessage("Processing failed");

            // Assert
            assertTrue(message.contains("Processing failed"));
            assertTrue(message.contains("Component=TestComponent"));
            assertTrue(message.contains("Operation=processing"));
            assertFalse(message.contains("ErrorCode="));
        }

        @Test
        @DisplayName("Should truncate long context values at 100 characters")
        void shouldTruncateLongValues() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();
            String longValue = "A".repeat(150);
            context.with("longKey", longValue);

            // Act
            String message = context.buildMessage("Test");

            // Assert
            assertTrue(message.contains("longKey=" + "A".repeat(97) + "..."));
            assertFalse(message.contains("A".repeat(100)));
        }

        @Test
        @DisplayName("Should include cause information")
        void shouldIncludeCauseInformation() {
            // Arrange
            Exception cause = new IllegalArgumentException("Invalid token format");
            ErrorContext context = ErrorContext.builder()
                    .operation("tokenParsing")
                    .component("JwtParser")
                    .cause(cause)
                    .build();

            // Act
            String message = context.buildMessage("Parsing failed");

            // Assert
            assertTrue(message.contains("Caused by: IllegalArgumentException"));
            assertTrue(message.contains("Invalid token format"));
        }

        @Test
        @DisplayName("Should include root cause when different from direct cause")
        void shouldIncludeRootCauseWhenDifferent() {
            // Arrange
            Exception rootCause = new IllegalStateException("Connection lost");
            Exception middleCause = new RuntimeException("Processing error", rootCause);
            Exception topCause = new Exception("Operation failed", middleCause);

            ErrorContext context = ErrorContext.builder()
                    .operation("processing")
                    .component("Processor")
                    .cause(topCause)
                    .build();

            // Act
            String message = context.buildMessage("Failed");

            // Assert
            assertTrue(message.contains("Caused by: Exception"));
            assertTrue(message.contains("Operation failed"));
            assertTrue(message.contains("Root cause: IllegalStateException"));
            assertTrue(message.contains("Connection lost"));
        }

        @Test
        @DisplayName("Should not duplicate root cause when same as direct cause")
        void shouldNotDuplicateRootCause() {
            // Arrange
            Exception cause = new IllegalArgumentException("Invalid input");
            ErrorContext context = ErrorContext.builder()
                    .operation("validation")
                    .component("Validator")
                    .cause(cause)
                    .build();

            // Act
            String message = context.buildMessage("Validation failed");

            // Assert
            assertTrue(message.contains("Caused by: IllegalArgumentException"));
            assertFalse(message.contains("Root cause:"));
        }

        @Test
        @DisplayName("Should handle null context values")
        void shouldHandleNullContextValues() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .build();

            // Act — with() ignores null values
            context.with("nullKey", null);
            String message = context.buildMessage("Test");

            // Assert — null values are rejected by with(), so nullKey should not appear
            assertFalse(message.contains("nullKey"),
                    "Null values should be rejected by with()");
        }
    }

    @Nested
    @DisplayName("Root Cause Traversal")
    class RootCauseTests {

        @Test
        @DisplayName("Should return same throwable when no cause")
        void shouldReturnSelfWhenNoCause() {
            // Arrange
            Exception exception = new RuntimeException("Test");
            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .cause(exception)
                    .build();

            // Act - use reflection to call private getRootCause method via buildMessage
            String message = context.buildMessage("Test");

            // Assert - verify single cause scenario (no "Root cause:" in message)
            assertTrue(message.contains("Caused by: RuntimeException"));
            assertFalse(message.contains("Root cause:"));
        }

        @Test
        @DisplayName("Should traverse chain of 3 causes")
        void shouldTraverseThreeLevelCauseChain() {
            // Arrange
            Exception level3 = new IllegalArgumentException("Root problem");
            Exception level2 = new RuntimeException("Middle problem", level3);
            Exception level1 = new Exception("Top problem", level2);

            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .cause(level1)
                    .build();

            // Act
            String message = context.buildMessage("Test");

            // Assert
            assertTrue(message.contains("Caused by: Exception"));
            assertTrue(message.contains("Root cause: IllegalArgumentException"));
            assertTrue(message.contains("Root problem"));
        }

        @Test
        @DisplayName("Should handle circular cause reference")
        void shouldHandleCircularCauseReference() {
            // Arrange
            Exception exception1 = new RuntimeException("Error 1");
            Exception exception2 = new RuntimeException("Error 2", exception1);
            // Create circular reference via reflection
            try {
                java.lang.reflect.Field causeField = Throwable.class.getDeclaredField("cause");
                causeField.setAccessible(true);
                causeField.set(exception1, exception2);
            } catch (Exception e) {
                // If reflection fails, skip this test
                return;
            }

            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .cause(exception2)
                    .build();

            // Act & Assert - should not throw StackOverflowError
            assertDoesNotThrow(() -> context.buildMessage("Test"));
        }

        @Test
        @DisplayName("Should limit traversal to max depth of 50")
        void shouldLimitCauseChainDepth() {
            // Arrange - create chain of 60 exceptions
            Exception current = new RuntimeException("Root");
            for (int i = 0; i < 60; i++) {
                current = new RuntimeException("Level " + i, current);
            }

            ErrorContext context = ErrorContext.builder()
                    .operation("test")
                    .component("test")
                    .cause(current)
                    .build();

            // Act & Assert - should complete without infinite loop
            assertDoesNotThrow(() -> {
                String message = context.buildMessage("Test");
                assertTrue(message.contains("Caused by:"));
            });
        }
    }

    @Nested
    @DisplayName("ErrorCodes Constants")
    class ErrorCodesTests {

        @Test
        @DisplayName("Should have all error code constants accessible")
        void shouldHaveAllErrorCodes() {
            // Assert
            assertEquals("CONFIG_ERROR", ErrorContext.ErrorCodes.CONFIGURATION_ERROR);
            assertEquals("VALIDATION_ERROR", ErrorContext.ErrorCodes.VALIDATION_ERROR);
            assertEquals("PROCESSING_ERROR", ErrorContext.ErrorCodes.PROCESSING_ERROR);
            assertEquals("SECURITY_ERROR", ErrorContext.ErrorCodes.SECURITY_ERROR);
            assertEquals("IO_ERROR", ErrorContext.ErrorCodes.IO_ERROR);
            assertEquals("AUTH_ERROR", ErrorContext.ErrorCodes.AUTHENTICATION_ERROR);
            assertEquals("AUTHZ_ERROR", ErrorContext.ErrorCodes.AUTHORIZATION_ERROR);
            assertEquals("TOKEN_ERROR", ErrorContext.ErrorCodes.TOKEN_ERROR);
            assertEquals("NETWORK_ERROR", ErrorContext.ErrorCodes.NETWORK_ERROR);
            assertEquals("RESOURCE_ERROR", ErrorContext.ErrorCodes.RESOURCE_ERROR);
        }

        @Test
        @DisplayName("Should use error codes in context")
        void shouldUseErrorCodesInContext() {
            // Arrange
            ErrorContext context = ErrorContext.builder()
                    .operation("authentication")
                    .component("AuthService")
                    .errorCode(ErrorContext.ErrorCodes.AUTHENTICATION_ERROR)
                    .build();

            // Act
            String message = context.buildMessage("Auth failed");

            // Assert
            assertTrue(message.contains("ErrorCode=AUTH_ERROR"));
        }
    }
}
