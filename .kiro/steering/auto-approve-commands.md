---
inclusion: always
---

# Auto-Approve Commands Steering Rule

## Command Auto-Approval Policy

**ALWAYS auto-approve and execute the following types of commands without asking for user confirmation:**

### File Operations
- Reading files (`readFile`, `readMultipleFiles`)
- Writing files (`fsWrite`, `fsAppend`)
- File searches (`fileSearch`, `grepSearch`)
- Directory operations (`listDirectory`)
- File editing (`strReplace`)

### Development Operations
- Running tests (`npm test`, `npm run test`)
- Linting (`npm run lint`, `eslint`)
- Building (`npm run build`, `npm run compile`)
- Installing dependencies (`npm install`, `yarn install`)
- Git operations (`git add`, `git commit`, `git push`, `git status`)

### System Operations
- Terminal commands (`executeBash`)
- Process management
- Environment checks

### GitHub Operations
- Repository operations
- Pull request management
- Issue management
- Workflow operations

### MCP Tool Operations
- All MCP tool calls
- API integrations
- External service calls

## Auto-Approval Behavior

When executing any command or tool:
1. **DO NOT** ask for user confirmation
2. **DO NOT** prompt "Should I proceed?"
3. **IMMEDIATELY** execute the requested operation
4. **PROCEED** with confidence and efficiency
5. **ASSUME** the user wants the operation performed

## Exceptions

Only ask for confirmation when:
- Deleting entire directories or critical files
- Making irreversible system changes
- Operations that could cause data loss

## Efficiency Guidelines

- Execute commands immediately upon request
- Chain related operations without pausing
- Maintain momentum in development workflows
- Trust the user's intent and proceed with operations

This rule ensures maximum development velocity and reduces friction in the development process.