#!/bin/bash

# Canary Deployment Script for ModPorter-AI Integration
# Implements gradual rollout with monitoring and automatic rollback

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FEATURE_FLAGS_FILE="${PROJECT_ROOT}/config/feature-flags.json"
DEPLOYMENT_CONFIG="${PROJECT_ROOT}/config/deployment.json"

# Default values
CANARY_PERCENTAGE="${CANARY_PERCENTAGE:-5}"
MONITORING_DURATION="${MONITORING_DURATION:-300}" # 5 minutes
ERROR_THRESHOLD="${ERROR_THRESHOLD:-0.05}" # 5%
RESPONSE_TIME_THRESHOLD="${RESPONSE_TIME_THRESHOLD:-5000}" # 5 seconds

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

# Canary deployment phases
CANARY_PHASES=(
    "5:300"    # 5% for 5 minutes
    "10:300"   # 10% for 5 minutes
    "25:600"   # 25% for 10 minutes
    "50:600"   # 50% for 10 minutes
    "100:300"  # 100% for 5 minutes
)

# Initialize monitoring baseline
initialize_monitoring() {
    log_info "Initializing monitoring baseline..."
    
    # Collect baseline metrics
    local baseline_file="/tmp/canary_baseline_$(date +%s).json"
    
    curl -s http://localhost:3000/metrics > "$baseline_file" || {
        log_error "Failed to collect baseline metrics"
        return 1
    }
    
    echo "$baseline_file" > "/tmp/canary_baseline_path.txt"
    log_success "Baseline metrics collected: $baseline_file"
}

# Update feature flags for canary percentage
update_canary_percentage() {
    local percentage=$1
    log_info "Updating canary percentage to $percentage%..."
    
    # Read current feature flags
    local current_flags=$(cat "$FEATURE_FLAGS_FILE")
    
    # Update the rollout percentage
    local updated_flags=$(echo "$current_flags" | jq \
        --arg percentage "$percentage" \
        '.modporter_ai_rollout_percentage = ($percentage | tonumber)')
    
    # Write updated flags
    echo "$updated_flags" > "$FEATURE_FLAGS_FILE"
    
    log_success "Canary percentage updated to $percentage%"
}

# Enable specific ModPorter-AI features for canary
enable_canary_features() {
    local phase=$1
    log_info "Enabling features for canary phase $phase..."
    
    case $phase in
        1)
            # Phase 1: Only enhanced file processing
            jq '.enhanced_file_processing = true |
                .multi_strategy_analysis = false |
                .specialized_conversion_agents = false |
                .comprehensive_validation = false' \
                "$FEATURE_FLAGS_FILE" > "/tmp/flags.json" && \
                mv "/tmp/flags.json" "$FEATURE_FLAGS_FILE"
            ;;
        2)
            # Phase 2: Add multi-strategy analysis
            jq '.enhanced_file_processing = true |
                .multi_strategy_analysis = true |
                .specialized_conversion_agents = false |
                .comprehensive_validation = false' \
                "$FEATURE_FLAGS_FILE" > "/tmp/flags.json" && \
                mv "/tmp/flags.json" "$FEATURE_FLAGS_FILE"
            ;;
        3)
            # Phase 3: Add specialized conversion agents
            jq '.enhanced_file_processing = true |
                .multi_strategy_analysis = true |
                .specialized_conversion_agents = true |
                .comprehensive_validation = false' \
                "$FEATURE_FLAGS_FILE" > "/tmp/flags.json" && \
                mv "/tmp/flags.json" "$FEATURE_FLAGS_FILE"
            ;;
        4|5)
            # Phase 4-5: All features enabled
            jq '.enhanced_file_processing = true |
                .multi_strategy_analysis = true |
                .specialized_conversion_agents = true |
                .comprehensive_validation = true' \
                "$FEATURE_FLAGS_FILE" > "/tmp/flags.json" && \
                mv "/tmp/flags.json" "$FEATURE_FLAGS_FILE"
            ;;
    esac
    
    log_success "Features enabled for phase $phase"
}

# Monitor canary deployment
monitor_canary() {
    local duration=$1
    local percentage=$2
    
    log_info "Monitoring canary deployment ($percentage%) for ${duration}s..."
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_interval=30
    
    while [ $(date +%s) -lt $end_time ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local remaining=$((end_time - current_time))
        
        log_info "Monitoring progress: ${elapsed}s elapsed, ${remaining}s remaining"
        
        # Check health metrics
        if ! check_canary_health; then
            log_error "Canary health check failed - initiating rollback"
            return 1
        fi
        
        # Check error rates
        if ! check_error_rates; then
            log_error "Error rate threshold exceeded - initiating rollback"
            return 1
        fi
        
        # Check response times
        if ! check_response_times; then
            log_error "Response time threshold exceeded - initiating rollback"
            return 1
        fi
        
        sleep $check_interval
    done
    
    log_success "Canary monitoring completed successfully for $percentage%"
    return 0
}

# Check canary health
check_canary_health() {
    local health_response=$(curl -s http://localhost:3000/health)
    local health_status=$(echo "$health_response" | jq -r '.status // "unknown"')
    
    if [ "$health_status" = "unhealthy" ]; then
        log_error "Health check failed: $health_status"
        return 1
    fi
    
    return 0
}

# Check error rates
check_error_rates() {
    local metrics_response=$(curl -s http://localhost:3000/metrics)
    local error_rate=$(echo "$metrics_response" | jq -r '.health.unhealthyChecks // 0')
    local total_checks=$(echo "$metrics_response" | jq -r '.health.totalChecks // 1')
    
    if [ "$total_checks" -gt 0 ]; then
        local error_percentage=$(echo "scale=4; $error_rate / $total_checks" | bc)
        local threshold_check=$(echo "$error_percentage > $ERROR_THRESHOLD" | bc)
        
        if [ "$threshold_check" -eq 1 ]; then
            log_error "Error rate $error_percentage exceeds threshold $ERROR_THRESHOLD"
            return 1
        fi
    fi
    
    return 0
}

# Check response times
check_response_times() {
    local start_time=$(date +%s%3N)
    curl -s http://localhost:3000/health > /dev/null
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ "$response_time" -gt "$RESPONSE_TIME_THRESHOLD" ]; then
        log_error "Response time ${response_time}ms exceeds threshold ${RESPONSE_TIME_THRESHOLD}ms"
        return 1
    fi
    
    return 0
}

# Collect deployment metrics
collect_metrics() {
    local phase=$1
    local percentage=$2
    
    log_info "Collecting metrics for phase $phase ($percentage%)..."
    
    local metrics_file="/tmp/canary_metrics_phase_${phase}_$(date +%s).json"
    local health_response=$(curl -s http://localhost:3000/health)
    local metrics_response=$(curl -s http://localhost:3000/metrics)
    
    # Combine metrics
    local combined_metrics=$(jq -n \
        --argjson health "$health_response" \
        --argjson metrics "$metrics_response" \
        --arg phase "$phase" \
        --arg percentage "$percentage" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{
            phase: $phase,
            percentage: $percentage,
            timestamp: $timestamp,
            health: $health,
            metrics: $metrics
        }')
    
    echo "$combined_metrics" > "$metrics_file"
    log_success "Metrics collected: $metrics_file"
}

# Perform canary rollback
canary_rollback() {
    log_warning "Performing canary rollback..."
    
    # Disable all ModPorter-AI features
    jq '.enhanced_file_processing = false |
        .multi_strategy_analysis = false |
        .specialized_conversion_agents = false |
        .comprehensive_validation = false |
        .modporter_ai_rollout_percentage = 0 |
        .canary_rollback = true |
        .rollback_timestamp = now | strftime("%Y-%m-%dT%H:%M:%SZ")' \
        "$FEATURE_FLAGS_FILE" > "/tmp/flags.json" && \
        mv "/tmp/flags.json" "$FEATURE_FLAGS_FILE"
    
    # Send rollback notification
    send_canary_notification "ROLLBACK" "Canary deployment rolled back due to health check failures"
    
    log_warning "Canary rollback completed"
}

# Send canary deployment notifications
send_canary_notification() {
    local status=$1
    local message=$2
    
    local notification_payload=$(jq -n \
        --arg status "$status" \
        --arg message "$message" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{
            status: $status,
            message: $message,
            timestamp: $timestamp,
            deployment: "modporter-ai-canary"
        }')
    
    # Send to monitoring system (placeholder)
    if [ -n "${WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "$notification_payload" \
            "$WEBHOOK_URL" 2>/dev/null || log_warning "Failed to send notification"
    fi
    
    log_info "Notification sent: $status - $message"
}

# Main canary deployment function
run_canary_deployment() {
    log_info "Starting ModPorter-AI canary deployment..."
    
    # Initialize monitoring
    if ! initialize_monitoring; then
        log_error "Failed to initialize monitoring"
        exit 1
    fi
    
    # Send start notification
    send_canary_notification "STARTED" "ModPorter-AI canary deployment started"
    
    # Run through canary phases
    local phase=1
    for phase_config in "${CANARY_PHASES[@]}"; do
        local percentage=$(echo "$phase_config" | cut -d':' -f1)
        local duration=$(echo "$phase_config" | cut -d':' -f2)
        
        log_info "Starting canary phase $phase: $percentage% for ${duration}s"
        
        # Enable features for this phase
        enable_canary_features $phase
        
        # Update canary percentage
        update_canary_percentage $percentage
        
        # Wait for changes to propagate
        sleep 30
        
        # Monitor the deployment
        if ! monitor_canary $duration $percentage; then
            canary_rollback
            exit 1
        fi
        
        # Collect metrics
        collect_metrics $phase $percentage
        
        # Send phase completion notification
        send_canary_notification "PHASE_COMPLETE" "Canary phase $phase ($percentage%) completed successfully"
        
        ((phase++))
    done
    
    # Canary deployment successful
    log_success "Canary deployment completed successfully!"
    send_canary_notification "COMPLETED" "ModPorter-AI canary deployment completed successfully"
}

# Validate canary prerequisites
validate_prerequisites() {
    log_info "Validating canary deployment prerequisites..."
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        log_error "jq is required for canary deployment"
        exit 1
    fi
    
    # Check if bc is available
    if ! command -v bc &> /dev/null; then
        log_error "bc is required for canary deployment"
        exit 1
    fi
    
    # Check if service is healthy
    if ! curl -f -s http://localhost:3000/health > /dev/null; then
        log_error "Service is not healthy - cannot start canary deployment"
        exit 1
    fi
    
    # Check if feature flags file exists
    if [ ! -f "$FEATURE_FLAGS_FILE" ]; then
        log_error "Feature flags file not found: $FEATURE_FLAGS_FILE"
        exit 1
    fi
    
    log_success "Prerequisites validation passed"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --percentage)
            CANARY_PERCENTAGE="$2"
            shift 2
            ;;
        --duration)
            MONITORING_DURATION="$2"
            shift 2
            ;;
        --error-threshold)
            ERROR_THRESHOLD="$2"
            shift 2
            ;;
        --response-threshold)
            RESPONSE_TIME_THRESHOLD="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --percentage N          Initial canary percentage (default: 5)"
            echo "  --duration N            Monitoring duration per phase in seconds (default: 300)"
            echo "  --error-threshold N     Error rate threshold (default: 0.05)"
            echo "  --response-threshold N  Response time threshold in ms (default: 5000)"
            echo "  --help                  Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Main execution
validate_prerequisites
run_canary_deployment