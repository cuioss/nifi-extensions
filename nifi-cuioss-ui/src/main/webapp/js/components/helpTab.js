'use strict';

/**
 * Help Tab Component for JWT Authenticator UI
 *
 * Provides comprehensive documentation and guidance for configuring
 * and using the MultiIssuerJWTTokenAuthenticator processor.
 *
 * @module components/helpTab
 */

import { createLogger } from '../utils/logger.js';
import { UI_TEXT } from '../utils/constants.js';
import { translate } from '../utils/i18n.js';

const logger = createLogger('HelpTab');

/**
 * Initializes the help tab component
 * @returns {void}
 */
export const init = () => {
    logger.info('Initializing help tab');

    // Create the help tab content if it doesn't exist
    if (document.getElementById('jwt-help-content') === null) {
        logger.info('Creating help tab content...');
        createHelpContent();
        // Initialize collapsible sections only after creating content
        initializeCollapsibles();
    } else {
        logger.info('Help tab content already exists, skipping creation');
    }
};

/**
 * Creates the help tab content structure
 */
const createHelpContent = () => {
    const helpHtml = `
        <div id="jwt-help-content" class="jwt-tab-content help-tab" data-testid="help-tab-content">
            <div class="help-header">
                <h2>${translate(UI_TEXT.I18N_KEYS.HELP_TITLE)}</h2>
            </div>
            
            <div class="help-sections">
                <div class="help-section">
                    <h4 class="collapsible-header active">
                        <i class="fa fa-chevron-down"></i> Getting Started
                    </h4>
                    <div class="collapsible-content show">
                        <p>The MultiIssuerJWTTokenAuthenticator processor validates JWT tokens from 
                        multiple issuers. Follow these steps to configure:</p>
                        <ol>
                            <li>Add at least one issuer configuration</li>
                            <li>Configure the JWKS URL or file path for each issuer</li>
                            <li>Set up authorization rules (optional)</li>
                            <li>Test your configuration using the Token Verification tab</li>
                        </ol>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Issuer Configuration
                    </h4>
                    <div class="collapsible-content">
                        <h5>Dynamic Properties</h5>
                        <p>Each issuer is configured using dynamic properties with the pattern:</p>
                        <code>jwt.issuer.&lt;issuer-name&gt;.jwks.url</code>
                        
                        <h5>Example Configurations</h5>
                        <div class="example-config">
                            <strong>Keycloak:</strong><br>
                            <code>jwt.issuer.keycloak.jwks.url = <br>
                                &nbsp;&nbsp;https://keycloak.example.com/realms/myrealm/<br>
                                &nbsp;&nbsp;protocol/openid-connect/certs
                            </code>
                        </div>
                        
                        <div class="example-config">
                            <strong>Auth0:</strong><br>
                            <code>jwt.issuer.auth0.jwks.url = 
                                https://yourdomain.auth0.com/.well-known/jwks.json</code>
                        </div>
                        
                        <div class="example-config">
                            <strong>Local File:</strong><br>
                            <code>jwt.issuer.local.jwks.file = /path/to/jwks.json</code>
                        </div>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Authorization Rules
                    </h4>
                    <div class="collapsible-content">
                        <p>Control access based on JWT claims using these properties:</p>
                        
                        <h5>Required Scopes</h5>
                        <p>Specify scopes that must be present in the token:</p>
                        <code>Required Scopes = read write admin</code>
                        
                        <h5>Required Roles</h5>
                        <p>Specify roles that must be present in the token:</p>
                        <code>Required Roles = user manager</code>
                        
                        <h5>Flow File Attributes</h5>
                        <p>The processor adds these attributes to flow files:</p>
                        <ul>
                            <li><code>jwt.subject</code> - Token subject (user)</li>
                            <li><code>jwt.issuer</code> - Token issuer</li>
                            <li><code>jwt.scopes</code> - Space-separated scopes</li>
                            <li><code>jwt.roles</code> - Space-separated roles</li>
                            <li><code>jwt.authorized</code> - true/false based on rules</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Token Verification
                    </h4>
                    <div class="collapsible-content">
                        <p>Use the Token Verification tab to test JWT tokens:</p>
                        <ol>
                            <li>Paste a JWT token in the input field</li>
                            <li>Click "Verify Token"</li>
                            <li>Review the validation results</li>
                        </ol>
                        
                        <h5>Common Issues</h5>
                        <ul>
                            <li><strong>Invalid Signature:</strong> Check that the JWKS URL is 
                            correct</li>
                            <li><strong>Token Expired:</strong> Generate a new token</li>
                            <li><strong>Unknown Issuer:</strong> Add the issuer configuration</li>
                            <li><strong>Missing Scopes:</strong> Ensure token contains required 
                            scopes</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Troubleshooting
                    </h4>
                    <div class="collapsible-content">
                        <h5>JWKS Loading Issues</h5>
                        <ul>
                            <li>Verify network connectivity to JWKS endpoints</li>
                            <li>Check SSL/TLS certificates for HTTPS endpoints</li>
                            <li>Ensure file paths are absolute for local JWKS files</li>
                            <li>Use the JWKS Validation button to test endpoints</li>
                        </ul>
                        
                        <h5>Performance Tips</h5>
                        <ul>
                            <li>JWKS are cached for 5 minutes by default</li>
                            <li>Use local JWKS files for better performance</li>
                            <li>Monitor the Metrics tab for performance data</li>
                        </ul>
                        
                        <h5>Security Best Practices</h5>
                        <ul>
                            <li>Always use HTTPS for JWKS endpoints</li>
                            <li>Rotate signing keys regularly</li>
                            <li>Implement proper authorization rules</li>
                            <li>Monitor failed validations in the Metrics tab</li>
                        </ul>
                    </div>
                </div>
                
                <div class="help-section">
                    <h4 class="collapsible-header">
                        <i class="fa fa-chevron-right"></i> Additional Resources
                    </h4>
                    <div class="collapsible-content">
                        <ul class="resource-links">
                            <li><a href="https://jwt.io/introduction"
                                   target="_blank" rel="noopener noreferrer">
                                <i class="fa fa-external-link"></i> JWT Introduction
                            </a></li>
                            <li><a href="https://tools.ietf.org/html/rfc7517"
                                   target="_blank" rel="noopener noreferrer">
                                <i class="fa fa-external-link"></i> JWK Specification
                            </a></li>
                            <li><a href="https://nifi.apache.org/docs.html"
                                   target="_blank" rel="noopener noreferrer">
                                <i class="fa fa-external-link"></i> Apache NiFi Docs
                            </a></li>
                        </ul>
                        
                        <div class="help-footer">
                            <p><strong>Version:</strong> 1.0.0</p>
                            <p><strong>Support:</strong> support@cuioss.de</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append to the help tab pane
    const helpTabPane = document.getElementById('help');
    logger.info('Help tab pane found:', !!helpTabPane);
    if (helpTabPane) {
        logger.info('Appending help content to tab pane');
        helpTabPane.innerHTML = helpHtml;
        logger.info('Help content appended, new length:', helpTabPane.innerHTML.length);
    } else {
        // Fallback: append to container if tab pane doesn't exist
        logger.warn('Help tab pane not found, appending to container');
        const container = document.getElementById('jwt-validator-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', helpHtml);
        }
    }
};

/**
 * Initializes collapsible sections behavior
 */
const initializeCollapsibles = () => {
    for (const header of document.querySelectorAll('.collapsible-header')) {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            const icon = this.querySelector('i.fa');

            // Toggle active state
            this.classList.toggle('active');

            // Toggle content visibility
            if (content?.classList.contains('collapsible-content')) {
                content.classList.toggle('show');
            }

            // Toggle icon
            if (icon) {
                if (this.classList.contains('active')) {
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-down');
                } else {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-right');
                }
            }

            logger.debug('Toggled help section:', this.textContent.trim());
        });
    }
};

/**
 * Cleans up the help tab component
 */
export const cleanup = () => {
    logger.debug('Cleaning up help tab');
    // Event listeners are automatically removed when elements are removed
};

/**
 * Gets the display name for this tab
 * @returns {string} Tab display name
 */
export const getDisplayName = () => {
    return translate(UI_TEXT.I18N_KEYS.HELP_TAB_NAME);
};
