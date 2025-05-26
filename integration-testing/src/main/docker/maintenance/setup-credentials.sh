#!/bin/bash

# Exit on error
set -e

# Function to configure Single User credentials
setup_single_user_credentials() {
    echo "Setting up predefined NiFi credentials..."
    
    # Default credentials if not provided via environment variables
    local username=${SINGLE_USER_CREDENTIALS_USERNAME:-admin}
    local password=${SINGLE_USER_CREDENTIALS_PASSWORD:-adminadminadmin}
    
    # Log the configuration (without the actual password)
    echo "Configuring Single User credentials with username: $username"
    
    # Use NiFi's built-in tool to set the credentials before NiFi starts
    ${NIFI_HOME}/bin/nifi.sh set-single-user-credentials "$username" "$password"
    
    echo "NiFi credentials configured successfully!"
}

# Execute the function to set up credentials
setup_single_user_credentials

# Continue with the regular entrypoint command
exec "$@"