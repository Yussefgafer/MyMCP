#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
PROJECT_PATH=$(pwd)
SRC_DIR="src"
STABLE_DIST_DIR="stable_build/dist"
STABLE_BUILD_ENTRY="$STABLE_DIST_DIR/index.js"
TOOLS_HASH_FILE=".tools_hash_stable"
SERVER_LOG_FILE="server.log"

# --- Helper Functions ---
log_script() {
    # This logs to standard error, keeping standard out clean
    echo "[SCRIPT] $1" >&2
}

# Use lsof for reliable port checking on standard Linux
find_available_port() {
    local port=3000
    while [ $port -le 3010 ]; do
        if ! lsof -i :$port >/dev/null; then
            log_script "✅ Port $port is available."
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    log_script "❌ No available port found in range 3000-3010."
    return 1
}

wait_for_server() {
    local port=$1
    local pid=$2
    log_script "Waiting for server (PID: $pid) on port $port to become healthy..."
    for i in {1..15}; do
        # First, check if the process is still alive
        if ! kill -0 $pid 2>/dev/null; then
            log_script "❌ Server process (PID: $pid) died unexpectedly."
            return 1
        fi
        # If alive, check health endpoint
        if curl --silent --fail http://localhost:$port/health >/dev/null 2>&1; then
            log_script "✅ Server is healthy!"
            return 0
        fi
        sleep 1
    done
    log_script "❌ Server did not become healthy in time."
    return 1
}

stop_server_processes() {
    log_script "Stopping any running server instances..."
    # A bit more aggressive to catch all node/bun processes related to the project
    pkill -f "bun-files-mcp" || true
    sleep 1
}

# --- Main Execution ---
stop_server_processes

# Always start with a clean log file
> "$SERVER_LOG_FILE"

# 1. Calculate Hashes
NEW_HASH=$( [ -f "$SRC_DIR/tools/index.ts" ] && sha256sum "$SRC_DIR/tools/index.ts" | awk '{print $1}' || echo "" )
OLD_HASH=$( [ -f "$TOOLS_HASH_FILE" ] && cat "$TOOLS_HASH_FILE" || echo "" )

# 2. Decide whether to build or use cache
if [ "$NEW_HASH" = "$OLD_HASH" ] && [ -n "$NEW_HASH" ] && [ -f "$STABLE_BUILD_ENTRY" ]; then
    log_script "🔄 Hash matches. Starting cached build..."
    SERVER_TO_RUN=$STABLE_BUILD_ENTRY
else
    log_script "🛠️ Hash mismatch or no stable build. Building new version..."
    
    TEMP_BUILD="temp_build_$(date +%s)"
    mkdir -p "$TEMP_BUILD"
    
    # Copy files and build
    cp -r package*.json tsconfig.json rslib.config.ts src "$TEMP_BUILD/"
    (
        cd "$TEMP_BUILD"
        log_script "Installing dependencies..."
        bun install
        log_script "Building project..."
        bun run build
    ) # The 'set -e' will handle errors here
    
    log_script "✅ Build successful. Testing new build..."
    
    # Test the new build
    TEST_BUILD_ENTRY="$TEMP_BUILD/dist/index.js"
    PORT_FOR_TEST=$(find_available_port)
    
    PORT=$PORT_FOR_TEST nohup bun run "$TEST_BUILD_ENTRY" >> "$SERVER_LOG_FILE" 2>&1 &
    TEST_PID=$!
    
    if wait_for_server $PORT_FOR_TEST $TEST_PID; then
        log_script "✨ New build is healthy. Promoting to stable."
        stop_server_processes
        rm -rf "$STABLE_DIST_DIR"
        mv "$TEMP_BUILD/dist" "$STABLE_DIST_DIR"
        echo "$NEW_HASH" > "$TOOLS_HASH_FILE"
        SERVER_TO_RUN=$STABLE_BUILD_ENTRY
    else
        log_script "⏪ New build failed. Rolling back to previous stable version."
        stop_server_processes
        if [ -f "$STABLE_BUILD_ENTRY" ]; then
            SERVER_TO_RUN=$STABLE_BUILD_ENTRY
        else
            log_script "💀 No stable version available to roll back to. Exiting."
            rm -rf "$TEMP_BUILD"
            exit 1
        fi
    fi
    rm -rf "$TEMP_BUILD"
fi

# 3. Final Start
if [ -z "$SERVER_TO_RUN" ]; then
    log_script "💀 Could not determine which server version to run. Exiting."
    exit 1
fi

FINAL_PORT=$(find_available_port)
log_script "🚀 Starting final server from '$SERVER_TO_RUN' on port $FINAL_PORT..."

PORT=$FINAL_PORT nohup bun run "$SERVER_TO_RUN" >> "$SERVER_LOG_FILE" 2>&1 &
FINAL_PID=$!

# Final verification
sleep 2
if ! kill -0 $FINAL_PID 2>/dev/null; then
    log_script "💀 Final server process failed to start. Check '$SERVER_LOG_FILE' for errors."
    exit 1
fi

log_script "✅ Server is running successfully (PID: $FINAL_PID) on port $FINAL_PORT."
if command -v notify-send &> /dev/null; then
    notify-send "MCP Server" "Server is running on port $FINAL_PORT"
fi
