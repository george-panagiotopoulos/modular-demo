#!/bin/bash

# Modular Banking Demo - Application Stop Script
# ===============================================
# This script stops both the frontend and backend applications gracefully

# Configuration
FRONTEND_PORT=3011
BACKEND_PORT=5011
JOLT_PORT=8081

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="mac"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
}

# Function to stop processes by PID files
stop_by_pid() {
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            log_info "Stopping frontend (PID: $FRONTEND_PID)..."
            kill $FRONTEND_PID 2>/dev/null
            sleep 2
            if kill -0 $FRONTEND_PID 2>/dev/null; then
                log_warning "Force killing frontend process..."
                kill -9 $FRONTEND_PID 2>/dev/null
            fi
            log_success "Frontend stopped"
        else
            log_warning "Frontend process not running"
        fi
        rm -f frontend.pid
    else
        log_info "No frontend PID file found"
    fi

    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            log_info "Stopping backend (PID: $BACKEND_PID)..."
            kill $BACKEND_PID 2>/dev/null
            sleep 2
            if kill -0 $BACKEND_PID 2>/dev/null; then
                log_warning "Force killing backend process..."
                kill -9 $BACKEND_PID 2>/dev/null
            fi
            log_success "Backend stopped"
        else
            log_warning "Backend process not running"
        fi
        rm -f backend.pid
    else
        log_info "No backend PID file found"
    fi

    if [ -f "jolt.pid" ]; then
        JOLT_PID=$(cat jolt.pid)
        if kill -0 $JOLT_PID 2>/dev/null; then
            log_info "Stopping JOLT service (PID: $JOLT_PID)..."
            kill $JOLT_PID 2>/dev/null
            sleep 2
            if kill -0 $JOLT_PID 2>/dev/null; then
                log_warning "Force killing JOLT service process..."
                kill -9 $JOLT_PID 2>/dev/null
            fi
            log_success "JOLT service stopped"
        else
            log_warning "JOLT service process not running"
        fi
        rm -f jolt.pid
    else
        log_info "No JOLT service PID file found"
    fi
}

# Function to kill processes on specific ports
cleanup_ports() {
    log_info "Cleaning up processes on ports $FRONTEND_PORT, $BACKEND_PORT, and $JOLT_PORT..."
    
    if [[ "$OS" == "mac" ]]; then
        # macOS - use lsof
        if lsof -ti:$FRONTEND_PORT >/dev/null 2>&1; then
            log_warning "Killing remaining processes on port $FRONTEND_PORT"
            lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
        fi
        
        if lsof -ti:$BACKEND_PORT >/dev/null 2>&1; then
            log_warning "Killing remaining processes on port $BACKEND_PORT"
            lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
        fi
        
        if lsof -ti:$JOLT_PORT >/dev/null 2>&1; then
            log_warning "Killing remaining processes on port $JOLT_PORT"
            lsof -ti:$JOLT_PORT | xargs kill -9 2>/dev/null || true
        fi
    elif [[ "$OS" == "linux" ]]; then
        # Linux - use netstat and kill
        if netstat -tlnp 2>/dev/null | grep ":$FRONTEND_PORT " >/dev/null; then
            log_warning "Killing remaining processes on port $FRONTEND_PORT"
            fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
        fi
        
        if netstat -tlnp 2>/dev/null | grep ":$BACKEND_PORT " >/dev/null; then
            log_warning "Killing remaining processes on port $BACKEND_PORT"
            fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
        fi
        
        if netstat -tlnp 2>/dev/null | grep ":$JOLT_PORT " >/dev/null; then
            log_warning "Killing remaining processes on port $JOLT_PORT"
            fuser -k $JOLT_PORT/tcp 2>/dev/null || true
        fi
    else
        log_warning "Port cleanup not implemented for $OS"
    fi
    
    log_success "Port cleanup completed"
}

# Main execution
main() {
    echo "=========================================="
    echo "  Modular Banking Demo - Stop Script"
    echo "=========================================="
    echo ""
    
    # Detect OS
    detect_os
    
    # Stop processes by PID files first
    stop_by_pid
    
    # Clean up any remaining processes on the ports
    cleanup_ports
    
    # Clean up log files
    if [ -f "frontend.log" ]; then
        rm -f frontend.log
        log_info "Removed frontend.log"
    fi
    
    if [ -f "backend.log" ]; then
        rm -f backend.log
        log_info "Removed backend.log"
    fi
    
    if [ -f "jolt.log" ]; then
        rm -f jolt.log
        log_info "Removed jolt.log"
    fi
    
    echo ""
    log_success "All applications stopped successfully!"
    echo ""
}

# Run main function
main "$@" 