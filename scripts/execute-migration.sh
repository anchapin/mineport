#!/bin/bash

# Enhanced CI/CD Pipeline Migration Execution Script
# 
# This script orchestrates the complete migration from basic to enhanced
# CI/CD pipeline with proper monitoring, rollback capabilities, and
# comprehensive validation.

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/migration-execution.log"
MIGRATION_STATE_FILE="$PROJECT_ROOT/.github/migration-state.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    log "ERROR" "Migration failed. Check $LOG_FILE for details."
    exit 1
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

# Set up error handling
trap cleanup EXIT
trap 'error_exit "Script interrupted by user"' INT TERM

# Banner
print_banner() {
    echo -e "${BLUE}"
    echo "=================================================================="
    echo "    Enhanced CI/CD Pipeline Migration Execution"
    echo "=================================================================="
    echo -e "${NC}"
    echo "This script will migrate your CI/CD pipeline from basic to enhanced"
    echo "configuration with comprehensive monitoring and rollback capabilities."
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("node" "npm" "gh" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "Required tool '$tool' is not installed"
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    if ! node -e "process.exit(require('semver').gte('$node_version', '$required_version') ? 0 : 1)" 2>/dev/null; then
        error_exit "Node.js version $required_version or higher is required (found: $node_version)"
    fi
    
    # Check GitHub CLI authentication
    if ! gh auth status &> /dev/null; then
        error_exit "GitHub CLI is not authenticated. Run 'gh auth login' first."
    fi
    
    # Check repository access
    if ! gh repo view &> /dev/null; then
        error_exit "Cannot access repository. Check your GitHub permissions."
    fi
    
    # Check for required files
    local required_files=(
        ".github/workflows/ci-enhanced.yml"
        ".github/workflows/security.yml"
        ".github/workflows/deploy.yml"
        "scripts/feature-flag-manager.js"
        "scripts/migration-orchestrator.js"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            error_exit "Required file not found: $file"
        fi
    done
    
    log "INFO" "All prerequisites satisfied ✓"
}

# Validate current system state
validate_current_state() {
    log "INFO" "Validating current system state..."
    
    # Check if migration is already in progress
    if [[ -f "$MIGRATION_STATE_FILE" ]]; then
        local current_phase=$(jq -r '.currentPhase // "null"' "$MIGRATION_STATE_FILE" 2>/dev/null)
        if [[ "$current_phase" != "null" && "$current_phase" != "completed" ]]; then
            log "WARN" "Migration appears to be in progress (phase: $current_phase)"
            read -p "Do you want to continue from current state? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "INFO" "Migration cancelled by user"
                exit 0
            fi
        fi
    fi
    
    # Check current workflow status
    log "INFO" "Checking current workflow status..."
    local recent_runs=$(gh run list --limit 5 --json conclusion,status)
    local failed_runs=$(echo "$recent_runs" | jq '[.[] | select(.conclusion == "failure")] | length')
    
    if [[ "$failed_runs" -gt 2 ]]; then
        log "WARN" "Multiple recent workflow failures detected ($failed_runs)"
        read -p "Continue with migration despite failures? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "Migration cancelled due to workflow failures"
        fi
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log "WARN" "Uncommitted changes detected in repository"
        read -p "Continue with uncommitted changes? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "Please commit or stash changes before migration"
        fi
    fi
    
    log "INFO" "Current system state validated ✓"
}

# Create backup of current configuration
create_backup() {
    log "INFO" "Creating backup of current configuration..."
    
    local backup_dir="$PROJECT_ROOT/.github/workflows-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup existing workflows
    if [[ -d "$PROJECT_ROOT/.github/workflows" ]]; then
        cp -r "$PROJECT_ROOT/.github/workflows"/* "$backup_dir/" 2>/dev/null || true
        log "INFO" "Workflows backed up to: $backup_dir"
    fi
    
    # Backup package.json and other config files
    local config_files=("package.json" "package-lock.json" "tsconfig.json" "vitest.config.ts")
    for file in "${config_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            cp "$PROJECT_ROOT/$file" "$backup_dir/"
        fi
    done
    
    # Create backup manifest
    cat > "$backup_dir/backup-manifest.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git branch --show-current)",
    "backup_reason": "Enhanced CI/CD pipeline migration",
    "files_backed_up": $(find "$backup_dir" -type f -name "*.yml" -o -name "*.json" -o -name "*.ts" | jq -R . | jq -s .)
}
EOF
    
    log "INFO" "Backup completed ✓"
    echo "$backup_dir" > "$PROJECT_ROOT/.github/last-backup-path"
}

# Initialize migration environment
initialize_migration() {
    log "INFO" "Initializing migration environment..."
    
    # Install dependencies if needed
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        log "INFO" "Installing dependencies..."
        cd "$PROJECT_ROOT"
        npm ci
    fi
    
    # Make scripts executable
    chmod +x "$SCRIPT_DIR"/*.js
    chmod +x "$SCRIPT_DIR"/*.sh
    
    # Initialize feature flags
    log "INFO" "Initializing feature flag system..."
    cd "$PROJECT_ROOT"
    node "$SCRIPT_DIR/feature-flag-manager.js" list > /dev/null
    
    # Initialize migration orchestrator
    log "INFO" "Initializing migration orchestrator..."
    node "$SCRIPT_DIR/migration-orchestrator.js" status > /dev/null
    
    log "INFO" "Migration environment initialized ✓"
}

# Execute migration phases
execute_migration() {
    log "INFO" "Starting migration execution..."
    
    cd "$PROJECT_ROOT"
    
    # Start migration orchestrator
    log "INFO" "Starting migration orchestrator..."
    if ! node "$SCRIPT_DIR/migration-orchestrator.js" start; then
        error_exit "Failed to start migration orchestrator"
    fi
    
    log "INFO" "Migration Phase 1 initiated ✓"
    log "INFO" "Enhanced CI workflow is now active"
    
    # Wait for initial validation
    log "INFO" "Waiting for initial validation (60 seconds)..."
    sleep 60
    
    # Check initial phase status
    local phase_status=$(node "$SCRIPT_DIR/migration-orchestrator.js" status | jq -r '.migrationState.currentPhase // "unknown"')
    log "INFO" "Current migration phase: $phase_status"
    
    # Monitor initial phase
    monitor_phase_progress
}

# Monitor phase progress
monitor_phase_progress() {
    log "INFO" "Monitoring phase progress..."
    
    local max_wait_time=1800  # 30 minutes
    local check_interval=60   # 1 minute
    local elapsed_time=0
    
    while [[ $elapsed_time -lt $max_wait_time ]]; do
        # Check phase status
        local status_output=$(node "$SCRIPT_DIR/migration-orchestrator.js" status 2>/dev/null || echo '{}')
        local current_phase=$(echo "$status_output" | jq -r '.migrationState.currentPhase // "unknown"')
        local is_monitoring=$(echo "$status_output" | jq -r '.isMonitoring // false')
        
        log "INFO" "Phase: $current_phase, Monitoring: $is_monitoring, Elapsed: ${elapsed_time}s"
        
        # Check if phase completed or failed
        if [[ "$current_phase" == "completed" ]]; then
            log "INFO" "Migration completed successfully! 🎉"
            return 0
        fi
        
        # Check for rollback
        local rollback_count=$(echo "$status_output" | jq -r '.migrationState.rollbackHistory | length // 0')
        if [[ "$rollback_count" -gt 0 ]]; then
            log "WARN" "Rollback detected during migration"
            handle_rollback_situation
            return 1
        fi
        
        # Check recent workflow runs
        check_workflow_health
        
        sleep $check_interval
        elapsed_time=$((elapsed_time + check_interval))
    done
    
    log "WARN" "Phase monitoring timeout reached"
    return 1
}

# Check workflow health
check_workflow_health() {
    local recent_runs=$(gh run list --limit 3 --json conclusion,status,workflowName 2>/dev/null || echo '[]')
    local failed_runs=$(echo "$recent_runs" | jq '[.[] | select(.conclusion == "failure")] | length')
    
    if [[ "$failed_runs" -gt 1 ]]; then
        log "WARN" "Multiple workflow failures detected ($failed_runs)"
        
        # Get failure details
        local failure_details=$(echo "$recent_runs" | jq -r '.[] | select(.conclusion == "failure") | .workflowName' | head -3)
        log "WARN" "Failed workflows: $failure_details"
        
        # Consider automatic rollback
        if [[ "$failed_runs" -gt 2 ]]; then
            log "ERROR" "Critical failure threshold reached - initiating automatic rollback"
            initiate_automatic_rollback
            return 1
        fi
    fi
    
    return 0
}

# Handle rollback situation
handle_rollback_situation() {
    log "WARN" "Handling rollback situation..."
    
    # Get rollback details
    local rollback_info=$(node "$SCRIPT_DIR/migration-orchestrator.js" status | jq -r '.migrationState.rollbackHistory[-1] // {}')
    local rollback_reason=$(echo "$rollback_info" | jq -r '.reason // "unknown"')
    local rollback_phase=$(echo "$rollback_info" | jq -r '.phase // "unknown"')
    
    log "WARN" "Rollback reason: $rollback_reason"
    log "WARN" "Rollback phase: $rollback_phase"
    
    # Send notification
    send_notification "ROLLBACK" "Migration rollback occurred: $rollback_reason"
    
    # Wait for system stabilization
    log "INFO" "Waiting for system stabilization (120 seconds)..."
    sleep 120
    
    # Validate rollback success
    if validate_rollback_success; then
        log "INFO" "Rollback completed successfully"
        log "INFO" "System restored to previous state"
    else
        log "ERROR" "Rollback validation failed"
        error_exit "System may be in inconsistent state - manual intervention required"
    fi
}

# Initiate automatic rollback
initiate_automatic_rollback() {
    log "WARN" "Initiating automatic rollback..."
    
    cd "$PROJECT_ROOT"
    if node "$SCRIPT_DIR/migration-orchestrator.js" rollback; then
        log "INFO" "Automatic rollback initiated successfully"
    else
        log "ERROR" "Automatic rollback failed"
        error_exit "Critical: Automatic rollback failed - immediate manual intervention required"
    fi
}

# Validate rollback success
validate_rollback_success() {
    log "INFO" "Validating rollback success..."
    
    # Check workflow status
    local workflow_list=$(gh workflow list --json name,state)
    local active_workflows=$(echo "$workflow_list" | jq '[.[] | select(.state == "active")] | length')
    
    if [[ "$active_workflows" -eq 0 ]]; then
        log "ERROR" "No active workflows found after rollback"
        return 1
    fi
    
    # Check recent runs
    sleep 30  # Wait for potential new runs
    local recent_run=$(gh run list --limit 1 --json conclusion)
    local last_conclusion=$(echo "$recent_run" | jq -r '.[0].conclusion // "null"')
    
    if [[ "$last_conclusion" == "failure" ]]; then
        log "WARN" "Last workflow run failed after rollback"
        return 1
    fi
    
    log "INFO" "Rollback validation successful ✓"
    return 0
}

# Send notification
send_notification() {
    local type=$1
    local message=$2
    
    log "INFO" "Sending notification: $type - $message"
    
    # In a real implementation, this would send to Slack, email, etc.
    # For now, just log the notification
    echo "NOTIFICATION [$type]: $message" >> "$LOG_FILE"
}

# Generate migration report
generate_migration_report() {
    log "INFO" "Generating migration report..."
    
    cd "$PROJECT_ROOT"
    
    # Generate comprehensive report
    if node "$SCRIPT_DIR/migration-orchestrator.js" report; then
        log "INFO" "Migration report generated successfully"
    else
        log "WARN" "Failed to generate migration report"
    fi
    
    # Generate system validation report
    if [[ -f "$SCRIPT_DIR/run-system-validation.js" ]]; then
        log "INFO" "Running system validation..."
        if node "$SCRIPT_DIR/run-system-validation.js"; then
            log "INFO" "System validation completed successfully"
        else
            log "WARN" "System validation completed with warnings"
        fi
    fi
}

# Cleanup and finalization
finalize_migration() {
    log "INFO" "Finalizing migration..."
    
    # Generate final reports
    generate_migration_report
    
    # Create migration summary
    local migration_status=$(node "$SCRIPT_DIR/migration-orchestrator.js" status 2>/dev/null || echo '{}')
    local current_phase=$(echo "$migration_status" | jq -r '.migrationState.currentPhase // "unknown"')
    local rollback_count=$(echo "$migration_status" | jq -r '.migrationState.rollbackHistory | length // 0')
    
    log "INFO" "Migration Summary:"
    log "INFO" "  Final Phase: $current_phase"
    log "INFO" "  Rollback Count: $rollback_count"
    log "INFO" "  Log File: $LOG_FILE"
    
    # Send final notification
    if [[ "$current_phase" == "completed" ]]; then
        send_notification "SUCCESS" "Migration completed successfully"
        log "INFO" "🎉 Migration completed successfully!"
    else
        send_notification "PARTIAL" "Migration partially completed (phase: $current_phase)"
        log "WARN" "⚠️  Migration partially completed"
    fi
    
    log "INFO" "Migration execution finished"
}

# Interactive mode functions
interactive_mode() {
    echo -e "${BLUE}Interactive Migration Mode${NC}"
    echo "This mode allows you to control the migration process step by step."
    echo ""
    
    while true; do
        echo "Available actions:"
        echo "1. Check prerequisites"
        echo "2. Create backup"
        echo "3. Start migration"
        echo "4. Check status"
        echo "5. Advance phase"
        echo "6. Rollback"
        echo "7. Generate report"
        echo "8. Exit"
        echo ""
        
        read -p "Select action (1-8): " -n 1 -r
        echo ""
        
        case $REPLY in
            1)
                check_prerequisites
                ;;
            2)
                create_backup
                ;;
            3)
                initialize_migration
                execute_migration
                ;;
            4)
                node "$SCRIPT_DIR/migration-orchestrator.js" status | jq .
                ;;
            5)
                node "$SCRIPT_DIR/migration-orchestrator.js" advance
                ;;
            6)
                node "$SCRIPT_DIR/migration-orchestrator.js" rollback
                ;;
            7)
                generate_migration_report
                ;;
            8)
                log "INFO" "Exiting interactive mode"
                break
                ;;
            *)
                echo "Invalid selection"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        echo ""
    done
}

# Main execution
main() {
    print_banner
    
    # Parse command line arguments
    local mode="auto"
    local skip_validation=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --interactive|-i)
                mode="interactive"
                shift
                ;;
            --skip-validation)
                skip_validation=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  -i, --interactive     Run in interactive mode"
                echo "  --skip-validation     Skip pre-migration validation"
                echo "  -h, --help           Show this help message"
                echo ""
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
    
    log "INFO" "Starting migration execution in $mode mode"
    
    if [[ "$mode" == "interactive" ]]; then
        interactive_mode
    else
        # Automatic mode
        check_prerequisites
        
        if [[ "$skip_validation" != true ]]; then
            validate_current_state
        fi
        
        create_backup
        initialize_migration
        execute_migration
        finalize_migration
    fi
    
    log "INFO" "Migration execution script completed"
}

# Run main function
main "$@"