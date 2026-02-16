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

import io.restassured.RestAssured;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.eclipse.jetty.ee11.servlet.ServletContextHandler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;

import java.io.IOException;
import java.util.function.Consumer;

/**
 * Shared test infrastructure for embedded Jetty + REST Assured servlet tests.
 * Each test class calls {@link #startServer} in {@code @BeforeAll} with a
 * configurator lambda and {@link #stopServer} in {@code @AfterAll}.
 */
final class EmbeddedServletTestSupport {

    private EmbeddedServletTestSupport() {
        // utility
    }

    private static Server server;

    /**
     * Starts an embedded Jetty server with dynamic port allocation.
     *
     * @param configurator configures the {@link ServletContextHandler} with filters/servlets
     * @return the allocated port
     */
    static int startServer(Consumer<ServletContextHandler> configurator) throws Exception {
        server = new Server();
        ServerConnector connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);

        ServletContextHandler context = new ServletContextHandler("/");
        configurator.accept(context);
        server.setHandler(context);

        server.start();
        int port = connector.getLocalPort();

        RestAssured.baseURI = "http://localhost";
        RestAssured.port = port;
        return port;
    }

    /**
     * Stops the embedded Jetty server and resets REST Assured state.
     */
    static void stopServer() throws Exception {
        RestAssured.reset();
        if (server != null && server.isRunning()) {
            server.stop();
        }
        server = null;
    }

    /**
     * Minimal servlet that returns 200 OK — used as a downstream target behind filters.
     */
    static class PassthroughServlet extends HttpServlet {
        @Override
        protected void service(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            resp.setStatus(HttpServletResponse.SC_OK);
            resp.setContentType("text/plain");
            resp.getWriter().write("OK");
        }
    }
}
