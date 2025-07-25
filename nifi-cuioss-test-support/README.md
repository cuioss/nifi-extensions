# NiFi Test Support Module

This module provides test utilities and examples for testing Apache NiFi processors, particularly those that use dynamic properties.

## Problem Statement

When testing NiFi processors that use dynamic properties, the standard `TestRunner` has a limitation:
- `TestRunner.setProperty()` allows setting dynamic properties
- However, `ProcessContext.getProperties()` from the TestRunner may not return these dynamic properties
- This causes issues for processors that iterate over all properties in `onScheduled()` method

## Solution

This module provides two approaches to solve this problem:

### Approach 1: Use MockProcessContext Directly

Instead of relying on TestRunner's ProcessContext, create a MockProcessContext directly for testing the onScheduled() method:

```java
// Create MockProcessContext directly
MockProcessContext context = new MockProcessContext(processor);

// Set dynamic properties
context.setProperty("issuer.test.jwks-url", "https://example.com/jwks");
context.setProperty("issuer.test.issuer", "test-issuer");

// Call onScheduled directly
processor.onScheduled(context);

// Continue with TestRunner for onTrigger testing
TestRunner testRunner = TestRunners.newTestRunner(processor);
// ... configure and run tests
```

### Approach 2: Create a Testable Processor Wrapper

Extend your processor to capture the dynamic properties during testing:

```java
private static class TestableProcessor extends YourProcessor {
    private Map<String, String> capturedProperties = new HashMap<>();
    
    @Override
    public void onScheduled(ProcessContext context) {
        // Capture dynamic properties for verification
        context.getProperties().forEach((desc, value) -> {
            if (desc.getName().startsWith("issuer.")) {
                capturedProperties.put(desc.getName(), value);
            }
        });
        super.onScheduled(context);
    }
}
```

## Usage Example

See `ExampleDynamicPropertyTest.java` for complete examples of both approaches.

## Helper Utilities

The `DynamicPropertyTestHelper` class provides convenience methods for:
- Setting multiple dynamic properties with a common prefix
- Configuring issuer properties for JWT processors
- Creating ProcessContext instances with proper dynamic property support

## Dependencies

Add this module as a test dependency in your processor module:

```xml
<dependency>
    <groupId>de.cuioss.nifi</groupId>
    <artifactId>nifi-cuioss-test-support</artifactId>
    <version>1.0-SNAPSHOT</version>
    <scope>test</scope>
</dependency>
```

## Future Improvements

Once the TestRunner limitation is fixed in Apache NiFi (if ever), this module can be simplified or deprecated.