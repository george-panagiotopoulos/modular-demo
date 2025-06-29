#!/bin/bash

# Source .env for configuration
set -a
[ -f .env ] && . .env
set +a

# Set project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Configuration
FRONTEND_PORT=${FRONTEND_PORT:-3011}
BACKEND_PORT=${BACKEND_PORT:-5011}
JOLT_PORT=${JOLT_PORT:-8081}
FRONTEND_DIR="${FRONTEND_DIR:-modular-banking-frontend}"
BACKEND_DIR="${BACKEND_DIR:-demoflow-backend}"
JOLT_DIR="${JOLT_DIR:-tools/jolt-service}"
MAVEN_BIN="$PROJECT_ROOT/tools/maven/apache-maven-3.9.6/bin/mvn"

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
    
    # Check Java
    if ! command -v java >/dev/null 2>&1; then
        log_error "Java is not installed. Please install Java 11 or higher first."
        exit 1
    fi
    
    # Check Maven (local)
    if [ ! -x "$MAVEN_BIN" ]; then
        log_error "Local Maven binary not found or not executable at $MAVEN_BIN. Please check your tools/maven installation."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    local dir=$1
    local service_name=$2
    
    log_info "Installing dependencies for $service_name..."
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"
    
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

# Install Maven dependencies
install_maven_dependencies() {
    local dir=$1
    local service_name=$2
    
    log_info "Installing Maven dependencies for $service_name..."
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"
    
    if [ -d "$dir" ]; then
        cd "$dir"
        if [ -f "pom.xml" ]; then
            "$MAVEN_BIN" clean compile
            if [ $? -eq 0 ]; then
                log_success "Maven dependencies installed for $service_name"
            else
                log_error "Failed to install Maven dependencies for $service_name"
                exit 1
            fi
        else
            log_warning "No pom.xml found in $dir"
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
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"
    
    # Debug output
    echo "DEBUG: BACKEND_DIR='$BACKEND_DIR'"
    ls -ld "$BACKEND_DIR"
    
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory $BACKEND_DIR not found"
        exit 1
    fi
    
    cd "$BACKEND_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $BACKEND_DIR"
        exit 1
    fi
    
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
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Frontend directory $FRONTEND_DIR not found"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $FRONTEND_DIR"
        exit 1
    fi
    
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

# Start JOLT service
start_jolt_service() {
    log_info "Starting JOLT service on port $JOLT_PORT..."
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"
    
    if [ ! -d "$JOLT_DIR" ]; then
        log_error "JOLT directory $JOLT_DIR not found"
        exit 1
    fi
    
    cd "$JOLT_DIR"
    
    # Check if pom.xml exists
    if [ ! -f "pom.xml" ]; then
        log_error "pom.xml not found in $JOLT_DIR"
        exit 1
    fi
    
    # Build the JAR file
    "$MAVEN_BIN" clean package -DskipTests
    if [ $? -ne 0 ]; then
        log_error "Failed to build JOLT service"
        exit 1
    fi
    
    # Start JOLT service in background
    java -jar target/jolt-service-0.0.1-SNAPSHOT.jar > ../jolt.log 2>&1 &
    JOLT_PID=$!
    echo $JOLT_PID > ../jolt.pid
    
    cd ..
    
    # Wait a moment for server to start
    sleep 5
    
    # Check if JOLT service is running
    if kill -0 $JOLT_PID 2>/dev/null; then
        log_success "JOLT service started (PID: $JOLT_PID)"
    else
        log_error "Failed to start JOLT service"
        exit 1
    fi
}

# Display status
display_status() {
    log_info "Application Status:"
    echo "=================================="
    echo "Frontend: http://localhost:$FRONTEND_PORT"
    echo "Backend:  http://localhost:$BACKEND_PORT"
    echo "JOLT Service: http://localhost:$JOLT_PORT"
    echo "Backend Health: http://localhost:$BACKEND_PORT/health"
    echo "JOLT Transform: http://localhost:$JOLT_PORT/transform"
    echo "=================================="
    log_info "Logs are being written to frontend.log, backend.log, and jolt.log"
    log_info "PIDs are stored in frontend.pid, backend.pid, and jolt.pid"
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
    
    if [ -f "jolt.pid" ]; then
        JOLT_PID=$(cat jolt.pid)
        if kill -0 $JOLT_PID 2>/dev/null; then
            kill $JOLT_PID
            log_success "JOLT service stopped"
        fi
        rm -f jolt.pid
    fi
    
    # Final port cleanup
    cleanup_ports $FRONTEND_PORT "Frontend"
    cleanup_ports $BACKEND_PORT "Backend"
    cleanup_ports $JOLT_PORT "JOLT Service"
    
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
    cleanup_ports $JOLT_PORT "JOLT Service"
    
    # Check prerequisites
    check_prerequisites
    
    # Install dependencies
    install_dependencies "$BACKEND_DIR" "Backend"
    install_dependencies "$FRONTEND_DIR" "Frontend"
    
    # Install Maven dependencies
    install_maven_dependencies "$JOLT_DIR" "JOLT Service"
    
    # Start services
    start_backend
    start_frontend
    start_jolt_service
    
    # Display status
    display_status
    
    # Keep script running and tail logs
    log_info "Press Ctrl+C to stop all services"
    log_info "Tailing logs (Press Ctrl+C to stop)..."
    
    # Tail both log files
    tail -f frontend.log backend.log jolt.log 2>/dev/null &
    TAIL_PID=$!
    
    # Wait for interrupt
    wait
}

# Run main function
main 