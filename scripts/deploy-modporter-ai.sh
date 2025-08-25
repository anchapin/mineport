#!/bin/bash

# ModPorter-AI Integration Deployment Script
# This script handles the deployment of ModPorter-AI components to production

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
FEATURE_FLAGS_FILE="${PROJECT_ROOT}/config/feature-flags.json"
MIGRATION_DIR="${PROJECT_ROOT}/src/database/migrations"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if ! npx semver -r ">=$required_version" "$node_version" &> /dev/null; then
        log_error "Node.js version $node_version is below required $required_version"
        exit 1
    fi

    # Check npm dependencies
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_error "Dependencies not installed. Run 'npm install' first."
        exit 1
    fi

    # Check database connection
    if ! npm run db:check &> /dev/null; then
        log_error "Database connection failed"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if [ -f "$MIGRATION_DIR/001_modporter_ai_integration.sql" ]; then
        npm run db:migrate
        log_success "Database migrations completed"
    else
        log_warning "No migrations found to run"
    fi
}

# Build application
build_application() {
    log_info "Building application..."

    npm run build

    if [ $? -eq 0 ]; then
        log_success "Application build completed"
    else
        log_error "Application build failed"
        exit 1
    fi
}

# Run tests
run_tests() {
    log_info "Running deployment validation tests..."

    # Run unit tests
    npm run test:unit

    # Run integration tests
    npm run test:integration

    # Run security tests
    npm run test:security

    # Run smoke tests
    npm run test:smoke

    log_success "All tests passed"
}

# Configure feature flags
configure_feature_flags() {
    log_info "Configuring feature flags for $DEPLOYMENT_ENV..."

    local flags_config=""
    case "$DEPLOYMENT_ENV" in
        "canary")
            flags_config='{
                "enhanced_file_processing": true,
                "multi_strategy_analysis": false,
                "specialized_conversion_agents": false,
                "comprehensive_validation": false,
                "modporter_ai_rollout_percentage": 5
            }'
            ;;
        "staging")
            flags_config='{
                "enhanced_file_processing": true,
                "multi_strategy_analysis": true,
                "specialized_conversion_agents": false,
                "comprehensive_validation": false,
                "modporter_ai_rollout_percentage": 25
            }'
            ;;
        "production")
            flags_config='{
                "enhanced_file_processing": true,
                "multi_strategy_analysis": true,
                "specialized_conversion_agents": true,
                "comprehensive_validation": true,
                "modporter_ai_rollout_percentage": 100
            }'
            ;;
        *)
            log_error "Unknown deployment environment: $DEPLOYMENT_ENV"
            exit 1
            ;;
    esac

    echo "$flags_config" > "$FEATURE_FLAGS_FILE"
    log_success "Feature flags configured for $DEPLOYMENT_ENV"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to $DEPLOYMENT_ENV..."

    # Copy built files to deployment directory
    if [ -d "$PROJECT_ROOT/dist" ]; then
        cp -r "$PROJECT_ROOT/dist" "/opt/mineport/releases/$(date +%Y%m%d_%H%M%S)/"
        log_success "Application files deployed"
    else
        log_error "Build directory not found"
        exit 1
    fi

    # Restart services
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart mineport
        log_success "Services restarted"
    else
        log_warning "systemctl not available, manual service restart required"
    fi
}

# Health check
health_check() {
    log_info "Performing post-deployment health check..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3000/health > /dev/null; then
            log_success "Health check passed"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 10s..."
        sleep 10
        ((attempt++))
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Rollback function
rollback() {
    log_warning "Rolling back deployment..."

    # Restore previous feature flags
    if [ -f "$FEATURE_FLAGS_FILE.backup" ]; then
        mv "$FEATURE_FLAGS_FILE.backup" "$FEATURE_FLAGS_FILE"
        log_info "Feature flags restored"
    fi

    # Restart with previous version
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart mineport
        log_info "Services restarted with previous version"
    fi

    log_warning "Rollback completed"
}

# Main deployment function
main() {
    log_info "Starting ModPorter-AI deployment to $DEPLOYMENT_ENV..."

    # Backup current feature flags
    if [ -f "$FEATURE_FLAGS_FILE" ]; then
        cp "$FEATURE_FLAGS_FILE" "$FEATURE_FLAGS_FILE.backup"
    fi

    # Set trap for rollback on failure
    trap rollback ERR

    check_prerequisites
    run_migrations
    build_application
    run_tests
    configure_feature_flags
    deploy_application

    if health_check; then
        log_success "ModPorter-AI deployment completed successfully!"

        # Clean up backup
        rm -f "$FEATURE_FLAGS_FILE.backup"
    else
        log_error "Deployment failed health check"
        rollback
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--env ENV] [--skip-tests] [--help]"
            echo "  --env ENV      Deployment environment (canary|staging|production)"
            echo "  --skip-tests   Skip running tests during deployment"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
