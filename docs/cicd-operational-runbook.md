# CI/CD Pipeline Operational Runbook

## Overview

This runbook provides step-by-step operational procedures for managing the enhanced GitHub Actions CI/CD pipeline. It covers routine operations, maintenance tasks, and incident response procedures.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Maintenance](#weekly-maintenance)
3. [Monthly Reviews](#monthly-reviews)
4. [Incident Response](#incident-response)
5. [Performance Monitoring](#performance-monitoring)
6. [Security Operations](#security-operations)
7. [Deployment Procedures](#deployment-procedures)
8. [Rollback Procedures](#rollback-procedures)

## Daily Operations

### Morning Health Check

**Frequency:** Daily at 9:00 AM
**Duration:** 10 minutes
**Responsible:** DevOps Engineer on duty

#### Checklist

1. **Pipeline Status Review**
   ```bash
   # Check last 24 hours of workflow runs
   gh run list --limit 50 --created ">=$(date -d '1 day ago' --iso-8601)"

   # Count failures
   gh run list --status failure --limit 20 --created ">=$(date -d '1 day ago' --iso-8601)"
   ```

2. **Performance Metrics**
   ```bash
   # Check average build times
   ./scripts/analyze-build-times.sh --since="24 hours ago"

   # Review cache hit rates
   ./scripts/cache-performance-report.sh --daily
   ```

3. **Security Status**
   ```bash
   # Check for new vulnerabilities
   npm audit --audit-level high

   # Review security scan results
   gh run list --workflow=security.yml --limit 5
   ```

4. **Resource Utilization**
   ```bash
   # Check GitHub Actions usage
   gh api /repos/:owner/:repo/actions/billing/usage

   # Monitor runner queue times
   ./scripts/monitor-runner-queues.sh
   ```

#### Actions Required

- [ ] Document any failures or anomalies
- [ ] Create issues for recurring problems
- [ ] Update team on pipeline status
- [ ] Escalate critical issues immediately

### Deployment Monitoring

**Frequency:** Continuous during business hours
**Responsible:** DevOps Engineer on duty

#### Monitoring Tasks

1. **Active Deployment Tracking**
   ```bash
   # Monitor active deployments
   gh run list --workflow=deploy.yml --status in_progress

   # Check deployment health
   ./scripts/check-deployment-health.sh
   ```

2. **Post-Deployment Validation**
   ```bash
   # Verify deployment success
   curl -f https://api.modporter.ai/health

   # Check error rates
   ./scripts/check-error-rates.sh --since="15 minutes ago"
   ```

3. **Rollback Readiness**
   ```bash
   # Ensure rollback scripts are ready
   ./scripts/validate-rollback-readiness.sh

   # Check previous version availability
   ./scripts/check-artifact-availability.sh
   ```

## Weekly Maintenance

### Pipeline Performance Review

**Frequency:** Every Monday at 10:00 AM
**Duration:** 30 minutes
**Responsible:** DevOps Team Lead

#### Tasks

1. **Performance Analysis**
   ```bash
   # Generate weekly performance report
   ./scripts/generate-weekly-performance-report.sh

   # Analyze trends
   ./scripts/analyze-performance-trends.sh --weeks=4
   ```

2. **Cache Optimization**
   ```bash
   # Review cache effectiveness
   ./scripts/cache-optimization-report.sh

   # Clean up stale caches
   gh cache delete --all --older-than 7d
   ```

3. **Resource Usage Review**
   ```bash
   # Check GitHub Actions minutes usage
   gh api /repos/:owner/:repo/actions/billing/usage

   # Optimize workflow efficiency
   ./scripts/workflow-efficiency-analysis.sh
   ```

#### Deliverables

- Weekly performance report
- Cache optimization recommendations
- Resource usage summary
- Action items for improvements

### Security Review

**Frequency:** Every Wednesday at 2:00 PM
**Duration:** 45 minutes
**Responsible:** Security Engineer + DevOps Engineer

#### Tasks

1. **Vulnerability Assessment**
   ```bash
   # Run comprehensive security scan
   ./scripts/comprehensive-security-scan.sh

   # Review dependency vulnerabilities
   npm audit --json > security-audit.json
   ```

2. **Secret Management Review**
   ```bash
   # Audit repository secrets
   gh secret list

   # Check for secret rotation needs
   ./scripts/check-secret-rotation.sh
   ```

3. **Access Control Review**
   ```bash
   # Review workflow permissions
   ./scripts/audit-workflow-permissions.sh

   # Check branch protection rules
   gh api /repos/:owner/:repo/branches/main/protection
   ```

#### Deliverables

- Security assessment report
- Secret rotation schedule
- Access control recommendations
- Compliance status update

### Dependency Management

**Frequency:** Every Friday at 11:00 AM
**Duration:** 20 minutes
**Responsible:** Development Team Lead

#### Tasks

1. **Dependency Updates Review**
   ```bash
   # Check for available updates
   npm outdated

   # Review automated dependency PRs
   gh pr list --label "dependencies"
   ```

2. **Security Patch Assessment**
   ```bash
   # Check for security patches
   npm audit --audit-level moderate

   # Review npm audit recommendations
   npm audit --json | jq '.vulnerabilities' | head -10
   ```

3. **Update Approval Process**
   ```bash
   # Test dependency updates
   ./scripts/test-dependency-updates.sh

   # Approve low-risk updates
   ./scripts/approve-safe-updates.sh
   ```

## Monthly Reviews

### Comprehensive Pipeline Assessment

**Frequency:** First Monday of each month
**Duration:** 2 hours
**Responsible:** DevOps Team + Development Team Leads

#### Agenda

1. **Performance Metrics Review (30 minutes)**
    - Build time trends
    - Test execution performance
    - Deployment frequency and success rates
    - Cache effectiveness analysis

2. **Security Posture Assessment (30 minutes)**
    - Vulnerability trends
    - Security scan effectiveness
    - Compliance status
    - Incident review

3. **Cost Analysis (20 minutes)**
    - GitHub Actions usage costs
    - Resource optimization opportunities
    - ROI analysis

4. **Process Improvements (40 minutes)**
    - Workflow optimization opportunities
    - Tool evaluation
    - Team feedback integration
    - Roadmap planning

#### Deliverables

- Monthly pipeline health report
- Performance improvement plan
- Security recommendations
- Cost optimization strategy
- Process improvement roadmap

### Disaster Recovery Testing

**Frequency:** Last Friday of each month
**Duration:** 1 hour
**Responsible:** DevOps Team

#### Test Scenarios

1. **Complete Pipeline Failure**
   ```bash
   # Simulate pipeline failure
   ./scripts/simulate-pipeline-failure.sh

   # Test manual deployment process
   ./scripts/test-manual-deployment.sh

   # Verify recovery procedures
   ./scripts/test-pipeline-recovery.sh
   ```

2. **Security Breach Simulation**
   ```bash
   # Simulate secret compromise
   ./scripts/simulate-secret-breach.sh

   # Test incident response
   ./scripts/test-incident-response.sh

   # Verify recovery time
   ./scripts/measure-recovery-time.sh
   ```

3. **Rollback Testing**
   ```bash
   # Test automated rollback
   ./scripts/test-automated-rollback.sh

   # Test manual rollback
   ./scripts/test-manual-rollback.sh

   # Verify data consistency
   ./scripts/verify-rollback-integrity.sh
   ```

## Incident Response

### Severity Levels

#### P0 - Critical (Production Down)
- **Response Time:** Immediate (< 5 minutes)
- **Resolution Time:** < 1 hour
- **Escalation:** Immediate to on-call engineer and management

#### P1 - High (Degraded Performance)
- **Response Time:** < 15 minutes
- **Resolution Time:** < 4 hours
- **Escalation:** To on-call engineer within 30 minutes

#### P2 - Medium (Non-Critical Issues)
- **Response Time:** < 1 hour
- **Resolution Time:** < 24 hours
- **Escalation:** During business hours

#### P3 - Low (Minor Issues)
- **Response Time:** < 4 hours
- **Resolution Time:** < 72 hours
- **Escalation:** Next business day

### Incident Response Procedures

#### P0 - Critical Incident Response

1. **Immediate Actions (0-5 minutes)**
   ```bash
   # Assess impact
   curl -f https://api.modporter.ai/health

   # Check service status
   kubectl get pods -l app=modporter-ai

   # Notify team
   ./scripts/send-critical-alert.sh "P0 Incident: Production down"
   ```

2. **Stabilization (5-15 minutes)**
   ```bash
   # Attempt quick fix
   ./scripts/quick-fix-common-issues.sh

   # If unsuccessful, initiate rollback
   ./scripts/emergency-rollback.sh

   # Monitor recovery
   ./scripts/monitor-service-recovery.sh
   ```

3. **Communication (Ongoing)**
   ```bash
   # Update status page
   ./scripts/update-status-page.sh "Investigating service disruption"

   # Notify stakeholders
   ./scripts/notify-stakeholders.sh --severity=P0
   ```

#### P1 - High Priority Response

1. **Assessment (0-15 minutes)**
   ```bash
   # Gather information
   ./scripts/collect-incident-data.sh

   # Analyze logs
   ./scripts/analyze-recent-logs.sh --hours=2

   # Identify root cause
   ./scripts/identify-root-cause.sh
   ```

2. **Mitigation (15-60 minutes)**
   ```bash
   # Apply temporary fix
   ./scripts/apply-temporary-fix.sh

   # Monitor effectiveness
   ./scripts/monitor-fix-effectiveness.sh

   # Prepare permanent solution
   ./scripts/prepare-permanent-fix.sh
   ```

### Post-Incident Procedures

#### Incident Documentation

1. **Create Incident Report**
   ```bash
   # Generate incident report template
   ./scripts/create-incident-report.sh --incident-id=$INCIDENT_ID

   # Collect timeline data
   ./scripts/collect-incident-timeline.sh --incident-id=$INCIDENT_ID
   ```

2. **Root Cause Analysis**
   ```bash
   # Analyze contributing factors
   ./scripts/analyze-contributing-factors.sh

   # Identify systemic issues
   ./scripts/identify-systemic-issues.sh
   ```

3. **Action Items**
   ```bash
   # Create improvement tasks
   ./scripts/create-improvement-tasks.sh --incident-id=$INCIDENT_ID

   # Schedule follow-up reviews
   ./scripts/schedule-followup-reviews.sh
   ```

## Performance Monitoring

### Key Performance Indicators (KPIs)

#### Build Performance
- **Build Success Rate:** > 95%
- **Average Build Time:** < 5 minutes
- **Cache Hit Rate:** > 80%

#### Test Performance
- **Test Success Rate:** > 98%
- **Average Test Time:** < 3 minutes
- **Flaky Test Rate:** < 2%

#### Deployment Performance
- **Deployment Success Rate:** > 99%
- **Deployment Frequency:** > 10 per day
- **Lead Time for Changes:** < 2 hours
- **Mean Time to Recovery:** < 30 minutes

### Monitoring Procedures

#### Real-time Monitoring

1. **Dashboard Monitoring**
   ```bash
   # Check pipeline dashboard
   open https://github.com/owner/repo/actions

   # Monitor custom metrics
   ./scripts/check-custom-metrics.sh
   ```

2. **Alert Configuration**
   ```yaml
   # Example alert configuration
   alerts:
     - name: "High Build Failure Rate"
       condition: "failure_rate > 10%"
       action: "notify_team"
     - name: "Slow Build Times"
       condition: "avg_build_time > 10m"
       action: "investigate"
   ```

#### Performance Analysis

1. **Trend Analysis**
   ```bash
   # Generate performance trends
   ./scripts/generate-performance-trends.sh --days=30

   # Identify performance regressions
   ./scripts/identify-performance-regressions.sh
   ```

2. **Bottleneck Identification**
   ```bash
   # Analyze build bottlenecks
   ./scripts/analyze-build-bottlenecks.sh

   # Identify slow tests
   ./scripts/identify-slow-tests.sh
   ```

## Security Operations

### Daily Security Tasks

1. **Vulnerability Monitoring**
   ```bash
   # Check for new vulnerabilities
   npm audit --audit-level high

   # Generate detailed audit report
   npm audit --json > detailed-security-audit.json
   ```

2. **Secret Scanning**
   ```bash
   # Scan for secrets
   gitleaks detect --source . --verbose

   # Check for exposed credentials
   ./scripts/check-exposed-credentials.sh
   ```

### Weekly Security Tasks

1. **Security Scan Review**
   ```bash
   # Review security scan results
   ./scripts/review-security-scans.sh --week

   # Update security policies
   ./scripts/update-security-policies.sh
   ```

2. **Access Control Audit**
   ```bash
   # Audit repository access
   gh api /repos/:owner/:repo/collaborators

   # Review workflow permissions
   ./scripts/audit-workflow-permissions.sh
   ```

### Security Incident Response

1. **Immediate Response**
   ```bash
   # Isolate affected systems
   ./scripts/isolate-affected-systems.sh

   # Revoke compromised credentials
   ./scripts/revoke-compromised-credentials.sh
   ```

2. **Investigation**
   ```bash
   # Collect forensic data
   ./scripts/collect-forensic-data.sh

   # Analyze attack vectors
   ./scripts/analyze-attack-vectors.sh
   ```

3. **Recovery**
   ```bash
   # Implement security fixes
   ./scripts/implement-security-fixes.sh

   # Verify system integrity
   ./scripts/verify-system-integrity.sh
   ```

## Deployment Procedures

### Standard Deployment Process

1. **Pre-deployment Checks**
   ```bash
   # Verify all tests pass
   npm test

   # Run security scans
   npm audit --audit-level high

   # Check deployment readiness
   ./scripts/check-deployment-readiness.sh
   ```

2. **Staging Deployment**
   ```bash
   # Deploy to staging
   ./scripts/deploy-to-staging.sh

   # Run smoke tests
   ./scripts/run-smoke-tests.sh --environment=staging

   # Validate deployment
   ./scripts/validate-staging-deployment.sh
   ```

3. **Production Deployment**
   ```bash
   # Deploy to production
   ./scripts/deploy-to-production.sh

   # Monitor deployment
   ./scripts/monitor-production-deployment.sh

   # Verify health
   ./scripts/verify-production-health.sh
   ```

### Canary Deployment Process

1. **Canary Release**
   ```bash
   # Start canary deployment
   ./scripts/start-canary-deployment.sh --percentage=10

   # Monitor canary metrics
   ./scripts/monitor-canary-metrics.sh
   ```

2. **Progressive Rollout**
   ```bash
   # Increase canary traffic
   ./scripts/increase-canary-traffic.sh --percentage=50

   # Continue monitoring
   ./scripts/monitor-canary-health.sh
   ```

3. **Full Rollout**
   ```bash
   # Complete rollout
   ./scripts/complete-canary-rollout.sh

   # Verify full deployment
   ./scripts/verify-full-deployment.sh
   ```

## Rollback Procedures

### Automated Rollback

1. **Trigger Conditions**
    - Health check failures
    - Error rate > 5%
    - Response time > 2x baseline
    - Critical security vulnerability

2. **Rollback Process**
   ```bash
   # Automatic rollback trigger
   if [[ $ERROR_RATE > 5 ]]; then
     ./scripts/trigger-automatic-rollback.sh
   fi

   # Monitor rollback progress
   ./scripts/monitor-rollback-progress.sh
   ```

### Manual Rollback

1. **Emergency Rollback**
   ```bash
   # Immediate rollback
   ./scripts/emergency-rollback.sh --version=previous

   # Verify rollback success
   ./scripts/verify-rollback-success.sh
   ```

2. **Planned Rollback**
   ```bash
   # Scheduled rollback
   ./scripts/planned-rollback.sh --version=v1.2.3 --schedule="2024-01-15 02:00"

   # Notify stakeholders
   ./scripts/notify-rollback-completion.sh
   ```

### Post-Rollback Procedures

1. **Verification**
   ```bash
   # Verify system stability
   ./scripts/verify-system-stability.sh

   # Check data integrity
   ./scripts/check-data-integrity.sh
   ```

2. **Investigation**
   ```bash
   # Analyze rollback cause
   ./scripts/analyze-rollback-cause.sh

   # Create improvement plan
   ./scripts/create-improvement-plan.sh
   ```

---

## Contact Information

### Escalation Matrix

| Severity | Primary Contact | Secondary Contact | Management |
|----------|----------------|-------------------|------------|
| P0 | On-call Engineer | DevOps Team Lead | Engineering Manager |
| P1 | DevOps Engineer | Senior DevOps Engineer | DevOps Team Lead |
| P2 | Assigned Engineer | DevOps Team | Team Lead |
| P3 | Development Team | DevOps Team | - |

### Communication Channels

- **Slack:** #devops-alerts (P0/P1), #devops (P2/P3)
- **Email:** devops@company.com
- **Phone:** On-call rotation number
- **Status Page:** https://status.company.com

---

*This operational runbook is maintained by the DevOps team. Last updated: $(date)*
