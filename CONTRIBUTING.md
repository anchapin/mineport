# Contributing to Minecraft Mod Converter

Thank you for your interest in contributing to the Minecraft Mod Converter! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Requirements](#documentation-requirements)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Architecture Guidelines](#architecture-guidelines)

## Code of Conduct

This project adheres to a code of conduct that promotes a welcoming and inclusive environment. By participating, you agree to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback and collaboration
- Respect different viewpoints and experiences
- Report any unacceptable behavior to the maintainers

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. Read the [Developer Setup Guide](docs/developer-setup-guide.md)
2. Set up your development environment
3. Familiarized yourself with the project architecture
4. Reviewed existing issues and pull requests

### First Contribution

For your first contribution, consider:

1. **Good First Issues**: Look for issues labeled `good-first-issue`
2. **Documentation**: Improve documentation or add examples
3. **Tests**: Add missing tests or improve test coverage
4. **Bug Fixes**: Fix small, well-defined bugs

## Development Process

### Workflow Overview

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally
3. **Create** a feature branch from `main`
4. **Make** your changes following our guidelines
5. **Test** your changes thoroughly
6. **Commit** with descriptive messages
7. **Push** to your fork
8. **Create** a pull request

### Branch Naming

Use descriptive branch names with prefixes:

```
feature/add-texture-atlas-generation
fix/resolve-memory-leak-in-parser
docs/update-api-documentation
refactor/simplify-error-handling
test/add-integration-tests-for-pipeline
```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(assets): implement texture atlas generation

Add support for generating texture atlases from individual texture files.
This improves performance by reducing the number of texture files in the
final addon package.

Closes #123
```

```
fix(logic): resolve API mapping cache invalidation

The API mapping cache was not being properly invalidated when mappings
were updated, causing stale data to be used in translations.

Fixes #456
```

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript configuration**:
   - Enable `strict: true`
   - No `any` types without explicit justification
   - Prefer interfaces over type aliases for object shapes

2. **Naming Conventions**:
   - Classes: `PascalCase` (e.g., `AssetTranslationModule`)
   - Functions/methods: `camelCase` (e.g., `translateAssets`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
   - Interfaces: `PascalCase` (e.g., `ConversionResult`)
   - Types: `PascalCase` (e.g., `JobStatus`)

3. **File Organization**:
   - One main export per file
   - Group related functionality
   - Use barrel exports (`index.ts`) for modules
   - Keep files focused and reasonably sized

### Code Style

1. **Use ESLint and Prettier**:
   ```bash
   npm run lint:fix
   npm run format
   ```

2. **Function Guidelines**:
   - Keep functions small and focused
   - Use descriptive parameter names
   - Prefer pure functions when possible
   - Handle errors explicitly

3. **Error Handling**:
   - Use the standardized error interfaces
   - Provide meaningful error messages
   - Include context for debugging
   - Use appropriate error severity levels

### JSDoc Documentation

All public APIs must have JSDoc comments:

```typescript
/**
 * Converts Java assets to Bedrock format.
 * 
 * This method processes all asset types (textures, models, sounds, particles)
 * and converts them to their Bedrock equivalents while maintaining quality
 * and compatibility.
 * 
 * @param javaAssets - Collection of Java assets to convert
 * @returns Promise resolving to conversion result with Bedrock assets and notes
 * @throws {ConversionError} When asset conversion fails
 * 
 * @example
 * ```typescript
 * const result = await module.translateAssets({
 *   textures: [texture1, texture2],
 *   models: [model1],
 *   sounds: [sound1]
 * });
 * ```
 * 
 * @since 1.0.0
 */
public async translateAssets(javaAssets: JavaAssetCollection): Promise<AssetTranslationResult> {
  // Implementation
}
```

## Testing Guidelines

### Test Requirements

1. **Unit Tests**: Required for all new functions and classes
2. **Integration Tests**: Required for module interactions
3. **End-to-End Tests**: Required for complete workflows
4. **Performance Tests**: Required for performance-critical code

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AssetTranslationModule } from '../AssetTranslationModule';

describe('AssetTranslationModule', () => {
  let module: AssetTranslationModule;

  beforeEach(() => {
    module = new AssetTranslationModule();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('translateAssets', () => {
    it('should convert textures successfully', async () => {
      // Arrange
      const javaAssets = createMockJavaAssets();

      // Act
      const result = await module.translateAssets(javaAssets);

      // Assert
      expect(result.bedrockAssets.textures).toHaveLength(2);
      expect(result.conversionNotes).toHaveLength(0);
    });

    it('should handle conversion errors gracefully', async () => {
      // Arrange
      const invalidAssets = createInvalidAssets();

      // Act & Assert
      await expect(module.translateAssets(invalidAssets))
        .rejects.toThrow(ConversionError);
    });
  });
});
```

### Test Coverage

- Maintain minimum 80% code coverage
- Focus on critical paths and edge cases
- Test error conditions and recovery
- Include performance regression tests

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/modules/assets/AssetTranslationModule.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Documentation Requirements

### Required Documentation

1. **JSDoc Comments**: All public APIs
2. **README Updates**: For new features or significant changes
3. **Architecture Documentation**: For architectural changes
4. **Migration Guides**: For breaking changes

### Documentation Standards

1. **Clear and Concise**: Use simple, direct language
2. **Examples**: Include code examples for complex features
3. **Up-to-Date**: Keep documentation synchronized with code
4. **Accessible**: Consider different skill levels

### Documentation Validation

```bash
# Validate JSDoc coverage
npm run docs:validate

# Add missing JSDoc comments
npm run docs:add
```

## Pull Request Process

### Before Submitting

1. **Ensure tests pass**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```

2. **Update documentation** as needed

3. **Add changelog entry** for significant changes

4. **Rebase** your branch on the latest `main`

### Pull Request Template

```markdown
## Description
Brief description of the changes and their purpose.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows the project's coding standards
- [ ] Self-review of code completed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] Documentation updated as needed
- [ ] No new warnings introduced
- [ ] Tests pass locally

## Related Issues
Closes #123
Relates to #456
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one maintainer reviews the code
3. **Testing**: Reviewers may test the changes locally
4. **Approval**: Changes must be approved before merging

### Review Criteria

- Code quality and adherence to standards
- Test coverage and quality
- Documentation completeness
- Performance impact
- Security considerations
- Backward compatibility

## Issue Reporting

### Bug Reports

Use the bug report template and include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **Environment information** (OS, Node version, etc.)
5. **Error messages** and stack traces
6. **Minimal reproduction case** if possible

### Feature Requests

Use the feature request template and include:

1. **Problem description** the feature would solve
2. **Proposed solution** or approach
3. **Alternative solutions** considered
4. **Use cases** and examples
5. **Implementation considerations**

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good-first-issue`: Good for newcomers
- `help-wanted`: Extra attention is needed
- `question`: Further information is requested

## Architecture Guidelines

### Design Principles

1. **Modularity**: Keep components focused and loosely coupled
2. **Testability**: Design for easy testing and mocking
3. **Extensibility**: Allow for future enhancements
4. **Performance**: Consider performance implications
5. **Security**: Follow security best practices

### Adding New Modules

1. **Follow the module pattern** established in existing modules
2. **Implement required interfaces** for pipeline integration
3. **Add comprehensive tests** for the module
4. **Update documentation** and architectural diagrams
5. **Consider error handling** and reporting

### Service Integration

1. **Use dependency injection** for service dependencies
2. **Implement proper interfaces** for service contracts
3. **Handle configuration** through ConfigurationService
4. **Add monitoring and logging** as appropriate

### Database Changes

1. **Design for backward compatibility** when possible
2. **Provide migration scripts** for schema changes
3. **Consider performance impact** of queries
4. **Add appropriate indexes** for query optimization

## Security Guidelines

### Security Considerations

1. **Input Validation**: Validate all external inputs
2. **Authentication**: Implement proper authentication where needed
3. **Authorization**: Check permissions for sensitive operations
4. **Data Sanitization**: Sanitize data before processing
5. **Error Information**: Don't expose sensitive information in errors

### Security Review

Security-sensitive changes require additional review:

- Authentication and authorization changes
- Input validation modifications
- External API integrations
- File system operations
- Database query modifications

## Performance Guidelines

### Performance Considerations

1. **Measure First**: Profile before optimizing
2. **Async Operations**: Use async/await for I/O operations
3. **Memory Management**: Avoid memory leaks and excessive usage
4. **Caching**: Implement appropriate caching strategies
5. **Batch Operations**: Process data in batches when possible

### Performance Testing

```bash
# Run performance benchmarks
npm run benchmark

# Generate performance report
npm run benchmark:report
```

## Release Process

### Version Management

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Create release tag
5. Deploy to staging
6. Deploy to production
7. Create GitHub release

## Getting Help

### Resources

1. **Documentation**: Check the `docs/` directory
2. **Issues**: Search existing GitHub issues
3. **Discussions**: Use GitHub Discussions for questions
4. **Architecture**: Review architectural decision records

### Contact

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: [security@your-org.com](mailto:security@your-org.com) for security issues

## Recognition

Contributors are recognized in:

- `CONTRIBUTORS.md` file
- Release notes for significant contributions
- GitHub contributor statistics
- Project documentation acknowledgments

Thank you for contributing to the Minecraft Mod Converter!