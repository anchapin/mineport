#!/bin/bash

# ModPorter-AI Integration Rollback Script
# This script handles rolling back ModPorter-AI deployments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ROLLBACK_REASON="${ROLLBACK_REASON:-manual}"
FEATURE_FLAGS_FILE="${PROJECT_ROOT}/config/feature-flags.json"
BACKUP_DIR="${PROJECT_ROOT}/backups"

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

# Create backup directory if it doesn't exist
ensure_backup_directory() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup current state before rollback
backup_current_state() {
    log_info "Backing up current state before rollback..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/pre_rollback_$timestamp"

    mkdir -p "$backup_path"

    # Backup feature flags
    if [ -f "$FEATURE_FLAGS_FILE" ]; then
        cp "$FEATURE_FLAGS_FILE" "$backup_path/feature-flags.json"
    fi

    # Backup configuration
    if [ -f "$PROJECT_ROOT/config/deployment.json" ]; then
        cp "$PROJECT_ROOT/config/deployment.json" "$backup_path/deployment.json"
    fi

    # Backup database schema (dump structure only)
    if command -v pg_dump &> /dev/null; then
        pg_dump --schema-only --no-owner --no-privileges \
            -h "${DB_HOST:-localhost}" \
            -p "${DB_PORT:-5432}" \
            -U "${DB_USER:-postgres}" \
            -d "${DB_NAME:-mineport}" \
            > "$backup_path/schema_backup.sql" 2>/dev/null || log_warning "Database backup failed"
    fi

    log_success "Current state backed up to: $backup_path"
    echo "$backup_path" > "$BACKUP_DIR/latest_backup.txt"
}

# Disable ModPorter-AI features via feature flags
disable_modporter_features() {
    log_info "Disabling ModPorter-AI features..."

    # Create rollback feature flags configuration
    local rollback_flags='{
        "enhanced_file_processing": false,
        "multi_strategy_analysis": false,
        "specialized_conversion_agents": false,
        "comprehensive_validation": false,
        "modporter_ai_rollout_percentage": 0,
        "rollback_mode": true,
        "rollback_reason": "'$ROLLBACK_REASON'",
        "rollback_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }'

    echo "$rollback_flags" > "$FEATURE_FLAGS_FILE"
    log_success "ModPorter-AI features disabled"
}

# Rollback database migrations
rollback_database() {
    log_info "Rolling back database migrations..."

    if [ -f "$PROJECT_ROOT/scripts/run-migrations.js" ]; then
        node "$PROJECT_ROOT/scripts/run-migrations.js" down
        log_success "Database migrations rolled back"
    else
        log_warning "Migration script not found, skipping database rollback"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting services..."

    if command -v systemctl &> /dev/null; then
        sudo systemctl restart mineport
        log_success "Services restarted"
    elif command -v pm2 &> /dev/null; then
        pm2 restart mineport
        log_success "PM2 services restarted"
    else
        log_warning "No service manager found, manual restart required"
    fi
}

# Verify rollback success
verify_rollback() {
    log_info "Verifying rollback success..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        # Check if service is responding
        if curl -f -s http://localhost:3000/health > /dev/null; then
            # Check if ModPorter-AI features are disabled
            local health_response=$(curl -s http://localhost:3000/health)

            if echo "$health_response" | grep -q '"rollback_mode":true'; then
                log_success "Rollback verification passed"
                return 0
            fi
        fi

        log_info "Rollback verification attempt $attempt/$max_attempts failed, retrying in 10s..."
        sleep 10
        ((attempt++))
    done

    log_error "Rollback verification failed after $max_attempts attempts"
    return 1
}

# Clean up temporary files and caches
cleanup_after_rollback() {
    log_info "Cleaning up after rollback..."

    # Clear any ModPorter-AI specific caches
    if [ -d "$PROJECT_ROOT/temp" ]; then
        find "$PROJECT_ROOT/temp" -name "*modporter*" -type f -delete 2>/dev/null || true
    fi

    # Clear Node.js cache (if using PM2 or similar)
    if command -v pm2 &> /dev/null; then
        pm2 flush mineport 2>/dev/null || true
    fi

    log_success "Cleanup completed"
}

# Send rollback notification
send_rollback_notification() {
    log_info "Sending rollback notification..."

    local message="ModPorter-AI rollback completed
Environment: ${DEPLOYMENT_ENV:-production}
Reason: $ROLLBACK_REASON
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Status: Success"

    # Send to monitoring system (placeholder)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || log_warning "Failed to send Slack notification"
    fi

    # Log to system
    logger "ModPorter-AI rollback completed: $ROLLBACK_REASON"

    log_success "Rollback notification sent"
}

# Emergency rollback function (fastest possible rollback)
emergency_rollback() {
    log_warning "Performing emergency rollback..."

    # Immediately disable all ModPorter-AI features
    echo '{"enhanced_file_processing":false,"multi_strategy_analysis":false,"specialized_conversion_agents":false,"comprehensive_validation":false,"modporter_ai_rollout_percentage":0,"emergency_rollback":true}' > "$FEATURE_FLAGS_FILE"

    # Force restart services
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart mineport
    elif command -v pm2 &> /dev/null; then
        pm2 restart mineport
    fi

    log_warning "Emergency rollback completed - manual verification required"
}

# Gradual rollback function (reduces traffic gradually)
gradual_rollback() {
    log_info "Performing gradual rollback..."

    local percentages=(50 25 10 5 0)

    for percentage in "${percentages[@]}"; do
        log_info "Reducing ModPorter-AI traffic to $percentage%..."

        # Update feature flags with reduced percentage
        local gradual_flags='{
            "enhanced_file_processing": true,
            "multi_strategy_analysis": true,
            "specialized_conversion_agents": true,
            "comprehensive_validation": true,
            "modporter_ai_rollout_percentage": '$percentage',
            "gradual_rollback": true
        }'

        echo "$gradual_flags" > "$FEATURE_FLAGS_FILE"

        # Wait for changes to take effect
        sleep 30

        # Check error rates
        if ! check_error_rates; then
            log_warning "Error rates still high at $percentage%, continuing rollback..."
        else
            log_info "Error rates acceptable at $percentage%"
            if [ $percentage -gt 0 ]; then
                log_info "Rollback can be stopped here if desired"
                read -p "Continue rollback? (y/n): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log_info "Rollback stopped at $percentage%"
                    return 0
                fi
            fi
        fi
    done

    log_success "Gradual rollback completed"
}

# Check error rates (placeholder implementation)
check_error_rates() {
    # This would integrate with your monitoring system
    # For now, we'll simulate a check
    local error_rate=$(curl -s http://localhost:3000/metrics | jq -r '.health.unhealthyChecks // 0' 2>/dev/null || echo "0")

    if [ "$error_rate" -le 1 ]; then
        return 0
    else
        return 1
    fi
}

# Main rollback function
main() {
    local rollback_type="${1:-standard}"

    log_info "Starting ModPorter-AI rollback (type: $rollback_type, reason: $ROLLBACK_REASON)..."

    ensure_backup_directory

    case "$rollback_type" in
        "emergency")
            emergency_rollback
            ;;
        "gradual")
            backup_current_state
            gradual_rollback
            verify_rollback
            cleanup_after_rollback
            send_rollback_notification
            ;;
        "standard"|*)
            backup_current_state
            disable_modporter_features
            rollback_database
            restart_services
            verify_rollback
            cleanup_after_rollback
            send_rollback_notification
            ;;
    esac

    log_success "ModPorter-AI rollback completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            ROLLBACK_TYPE="$2"
            shift 2
            ;;
        --reason)
            ROLLBACK_REASON="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--type TYPE] [--reason REASON] [--help]"
            echo "  --type TYPE      Rollback type (standard|gradual|emergency)"
            echo "  --reason REASON  Reason for rollback"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Set default rollback type
ROLLBACK_TYPE="${ROLLBACK_TYPE:-standard}"

# Run main function
main "$ROLLBACK_TYPE"
