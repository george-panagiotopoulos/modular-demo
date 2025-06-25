#!/bin/bash

# Configuration
FRONTEND_PORT=3011
BACKEND_PORT=5011
FRONTEND_DIR="modular-banking-frontend"
BACKEND_DIR="demoflow-backend"

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
    case "$(uname -s)" in
        Linux*)     echo "Linux";;
        Darwin*)    echo "macOS";;
        CYGWIN*|MINGW*|MSYS*) echo "Windows";;
        *)          echo "Unknown";;
    esac
}

OS=$(detect_os)
log_info "Detected OS: $OS"

# Function to kill processes on specific ports
cleanup_ports() {
    local port=$1
    local service_name=$2
    
    log_info "Cleaning up processes on port $port for $service_name..."
    
    if [ "$OS" = "macOS" ]; then
        # macOS using lsof
        local pids=$(lsof -ti :$port 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null
            log_success "Killed processes on port $port"
        else
            log_info "No processes found on port $port"
        fi
    elif [ "$OS" = "Linux" ]; then
        # Linux using netstat and kill
        local pids=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null
            log_success "Killed processes on port $port"
        else
            # Alternative method using fuser
            if command -v fuser >/dev/null 2>&1; then
                fuser -k $port/tcp 2>/dev/null
                log_success "Cleaned up port $port using fuser"
            else
                log_info "No processes found on port $port"
            fi
        fi
    else
        log_warning "Port cleanup not supported on $OS"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    local dir=$1
    local service_name=$2
    
    log_info "Installing dependencies for $service_name..."
    
    if [ -d "$dir" ]; then
        cd "$dir"
        if [ -f "package.json" ]; then
            npm install
            if [ $? -eq 0 ]; then
                log_success "Dependencies installed for $service_name"
            else
                log_error "Failed to install dependencies for $service_name"
                exit 1
            fi
        else
            log_warning "No package.json found in $dir"
        fi
        cd ..
    else
        log_error "Directory $dir not found"
        exit 1
    fi
}

# Start backend
start_backend() {
    log_info "Starting backend server on port $BACKEND_PORT..."
    
    cd "$BACKEND_DIR"
    
    # Use the main .env file from the root directory
    if [ ! -f "../.env" ]; then
        log_error "Main .env file not found in root directory"
        exit 1
    fi
    
    # Start backend in background with environment from main .env file
    PORT=$BACKEND_PORT npm start > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    
    cd ..
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if backend is running
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log_success "Backend server started (PID: $BACKEND_PID)"
    else
        log_error "Failed to start backend server"
        exit 1
    fi
}

# Start frontend
start_frontend() {
    log_info "Starting frontend server on port $FRONTEND_PORT..."
    
    cd "$FRONTEND_DIR"
    
    # Set environment variables for frontend
    export PORT=$FRONTEND_PORT
    export REACT_APP_BACKEND_URL="http://localhost:$BACKEND_PORT"
    
    # Start frontend in background
    npm start > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    
    cd ..
    
    # Wait a moment for server to start
    sleep 5
    
    # Check if frontend is running
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        log_success "Frontend server started (PID: $FRONTEND_PID)"
    else
        log_error "Failed to start frontend server"
        exit 1
    fi
}

# Display status
display_status() {
    log_info "Application Status:"
    echo "=================================="
    echo "Frontend: http://localhost:$FRONTEND_PORT"
    echo "Backend:  http://localhost:$BACKEND_PORT"
    echo "Backend Health: http://localhost:$BACKEND_PORT/health"
    echo "=================================="
    log_info "Logs are being written to frontend.log and backend.log"
    log_info "PIDs are stored in frontend.pid and backend.pid"
}

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Shutting down applications..."
    
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill $FRONTEND_PID
            log_success "Frontend server stopped"
        fi
        rm -f frontend.pid
    fi
    
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            log_success "Backend server stopped"
        fi
        rm -f backend.pid
    fi
    
    # Final port cleanup
    cleanup_ports $FRONTEND_PORT "Frontend"
    cleanup_ports $BACKEND_PORT "Backend"
    
    log_success "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    log_info "Starting ModularBankingDemo application..."
    
    # Clean up any existing processes
    cleanup_ports $FRONTEND_PORT "Frontend"
    cleanup_ports $BACKEND_PORT "Backend"
    
    # Check prerequisites
    check_prerequisites
    
    # Install dependencies
    install_dependencies "$BACKEND_DIR" "Backend"
    install_dependencies "$FRONTEND_DIR" "Frontend"
    
    # Start services
    start_backend
    start_frontend
    
    # Display status
    display_status
    
    # Keep script running and tail logs
    log_info "Press Ctrl+C to stop all services"
    log_info "Tailing logs (Press Ctrl+C to stop)..."
    
    # Tail both log files
    tail -f frontend.log backend.log 2>/dev/null &
    TAIL_PID=$!
    
    # Wait for interrupt
    wait
}

# Run main function
main 