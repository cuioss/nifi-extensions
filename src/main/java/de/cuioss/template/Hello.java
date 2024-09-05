package de.cuioss.template;

import lombok.ToString;

/**
 * @author Oliver Wolff
 *
 */
@ToString
public class Hello {

    /**
     * @param name to be greeted
     * @return the greeted String
     */
    public String hello(String name) {
        return "Hello " + name;
    }

}
