package de.cuioss.nifi;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class HelloTest {

    @Test
    void test() {
        assertEquals("Hello cui", new Hello().hello("cui"));
    }

}
