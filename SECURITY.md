# Security Policy

## Supported Versions

We take security seriously and provide security updates for the following versions of Minecraft Mod Converter:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

As this project is in early development (pre-1.0), we currently support only the latest minor version. Once we reach version 1.0, we will provide security updates for the current major version and the previous major version.

## Reporting a Vulnerability

We appreciate your efforts to responsibly disclose security vulnerabilities. Please follow these guidelines when reporting security issues:

### How to Report

**For security vulnerabilities, please do NOT create a public GitHub issue.** Instead, please report security vulnerabilities through one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](https://github.com/[owner]/minecraft-mod-converter/security) of this repository
   - Click "Report a vulnerability"
   - Fill out the security advisory form with detailed information

2. **Email** (Alternative)
   - Send an email to: [security@example.com] (replace with actual contact)
   - Use the subject line: "Security Vulnerability in Minecraft Mod Converter"
   - Include detailed information about the vulnerability

### What to Include

When reporting a security vulnerability, please provide:

- **Description**: A clear description of the vulnerability
- **Impact**: Potential impact and severity assessment
- **Reproduction**: Step-by-step instructions to reproduce the issue
- **Environment**: Version information and system details
- **Proof of Concept**: Code or screenshots demonstrating the vulnerability (if applicable)
- **Suggested Fix**: Any ideas for how to fix the vulnerability (optional)

### Response Timeline

We are committed to responding to security reports promptly:

- **Initial Response**: Within 48 hours of receiving the report
- **Status Update**: Within 7 days with our assessment and planned timeline
- **Resolution**: We aim to resolve critical vulnerabilities within 30 days
- **Disclosure**: Coordinated disclosure after the fix is available

## Responsible Disclosure

We follow responsible disclosure practices:

1. **Confidentiality**: We will keep your report confidential until a fix is available
2. **Credit**: We will credit you in our security advisory (unless you prefer to remain anonymous)
3. **Coordination**: We will work with you to understand the issue and validate the fix
4. **Public Disclosure**: We will publicly disclose the vulnerability only after:
   - A fix has been developed and released
   - Sufficient time has passed for users to update (typically 30 days)
   - Coordination with the reporter

## Security Best Practices for Contributors

If you're contributing to this project, please follow these security guidelines:

### Code Security

- **Input Validation**: Always validate and sanitize user inputs
- **Dependency Management**: Keep dependencies up to date and audit regularly
- **Error Handling**: Don't expose sensitive information in error messages
- **Authentication**: Use secure authentication mechanisms where applicable
- **Data Protection**: Handle sensitive data (like mod files) securely

### Development Practices

- **Code Review**: All code changes must be reviewed before merging
- **Testing**: Include security tests for new features
- **Static Analysis**: Run security linters and static analysis tools
- **Secrets Management**: Never commit secrets, API keys, or credentials
- **Logging**: Be careful not to log sensitive information

### Dependency Security

- Run `npm audit` regularly to check for known vulnerabilities
- Use `npm run security:scan` to run our security test suite
- Update dependencies promptly when security patches are available
- Review new dependencies for security implications

### Reporting Security Issues in Dependencies

If you discover a security vulnerability in one of our dependencies:

1. Check if it's already reported in the dependency's security advisories
2. If not, report it to the dependency maintainers first
3. Create an issue in our repository to track the dependency update
4. Consider if we need to implement workarounds while waiting for a fix

## Security Features

This project includes several security features:

- **Input Validation**: Comprehensive validation of mod files and user inputs
- **Sandboxing**: Mod processing runs in isolated environments
- **Audit Logging**: Security-relevant events are logged for monitoring
- **Dependency Scanning**: Automated scanning for vulnerable dependencies
- **Static Analysis**: Code security analysis in our CI/CD pipeline

## Security Testing

We maintain a comprehensive security testing suite:

- **Unit Tests**: Security-focused unit tests in `tests/security/`
- **Integration Tests**: End-to-end security validation
- **Dependency Auditing**: Regular automated dependency security scans
- **Static Analysis**: Automated code security analysis

To run security tests locally:

```bash
npm run security:scan
```

## Security Updates

When security updates are released:

- **Critical**: Immediate patch release with security advisory
- **High**: Patch release within 7 days
- **Medium/Low**: Included in next regular release

Security updates will be clearly marked in our [CHANGELOG.md](CHANGELOG.md) and announced through:

- GitHub Security Advisories
- Release notes
- Project README updates

## Questions?

If you have questions about this security policy or need clarification on security practices, please:

- Create a public GitHub issue for general security questions
- Use the private reporting methods above for potential vulnerabilities
- Review our [Contributing Guidelines](CONTRIBUTING.md) for development security practices

Thank you for helping keep Minecraft Mod Converter secure!