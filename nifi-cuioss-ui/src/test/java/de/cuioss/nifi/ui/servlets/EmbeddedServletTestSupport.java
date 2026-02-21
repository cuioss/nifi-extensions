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

import io.restassured.specification.RequestSpecification;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.eclipse.jetty.ee11.servlet.ServletContextHandler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;

import java.io.IOException;
import java.util.function.Consumer;

import static io.restassured.RestAssured.given;

/**
 * Shared test infrastructure for embedded Jetty + REST Assured servlet tests.
 * Each test class calls {@link #startServer} in {@code @BeforeAll} with a
 * configurator lambda and stores the returned {@link ServerHandle}. The handle
 * encapsulates the Jetty server and its allocated port, avoiding global
 * {@code RestAssured} state mutation and enabling future parallel test execution.
 */
final class EmbeddedServletTestSupport {

    private EmbeddedServletTestSupport() {
        // utility
    }

    /**
     * Handle to a running embedded Jetty server. Provides a per-instance
     * {@link RequestSpecification} instead of mutating global REST Assured state.
     */
    record ServerHandle(Server server, int port) implements AutoCloseable {

        /**
         * Returns a REST Assured {@link RequestSpecification} bound to this server's
         * host and port. Use this instead of the static {@code given()}.
         */
        RequestSpecification spec() {
            return given().baseUri("http://localhost").port(port);
        }

        @Override
        public void close() throws Exception {
            if (server != null && server.isRunning()) {
                server.stop();
            }
        }
    }

    /**
     * Starts an embedded Jetty server with dynamic port allocation.
     *
     * @param configurator configures the {@link ServletContextHandler} with filters/servlets
     * @return a {@link ServerHandle} encapsulating the server and its port
     */
    static ServerHandle startServer(Consumer<ServletContextHandler> configurator) throws Exception {
        Server server = new Server();
        ServerConnector connector = new ServerConnector(server);
        connector.setPort(0);
        server.addConnector(connector);

        ServletContextHandler context = new ServletContextHandler("/");
        configurator.accept(context);
        server.setHandler(context);

        server.start();
        int port = connector.getLocalPort();
        return new ServerHandle(server, port);
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
