# Integration Tests

This directory contains integration tests that test complex interactions between components, timing-sensitive operations, and real worker thread behavior.

## Test Categories

### Worker Pool Integration Tests
- **File**: `worker-pool-integration.test.ts`
- **Purpose**: Tests complex WorkerPool functionality that requires real timing and worker thread coordination
- **Includes**:
  - Worker lifecycle management
  - Task statistics and monitoring
  - Task prioritization with real queuing
  - Task cancellation scenarios
  - Error handling and recovery

### Other Integration Tests
- **Conversion Pipeline**: End-to-end conversion workflows
- **Module Interactions**: Cross-module communication and data flow
- **Infrastructure**: Database, cache, and external service integration

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run specific integration test file
npx vitest run tests/integration/worker-pool-integration.test.ts --config vitest.integration.config.ts
```

## Configuration

Integration tests use a separate Vitest configuration (`vitest.integration.config.ts`) with:
- **Longer timeouts**: 30s test timeout, 10s hook timeout
- **Retry logic**: Failed tests are retried up to 2 times
- **Thread pool**: Up to 4 threads for parallel execution
- **Separate reporting**: Results go to `test-results/integration-results.json`

## Best Practices

### When to Write Integration Tests
- Complex timing-sensitive operations
- Multi-component workflows
- Real worker thread or process coordination
- External service interactions
- End-to-end feature validation

### When to Keep as Unit Tests
- Pure function testing
- Single component behavior
- Mocked dependencies
- Fast, deterministic operations

### Writing Reliable Integration Tests
1. **Use real timeouts**: Don't rely on fake timers for timing-sensitive tests
2. **Add proper cleanup**: Always clean up resources in `afterEach`
3. **Handle async operations**: Use proper `await` and promise handling
4. **Add retry logic**: Integration tests can be flaky due to timing
5. **Use longer timeouts**: Give operations time to complete naturally
6. **Test error scenarios**: Include failure and recovery testing

## Troubleshooting

### Common Issues
- **Timing failures**: Increase timeouts or add small delays for coordination
- **Resource leaks**: Ensure proper cleanup in `afterEach` hooks
- **Flaky tests**: Add retry logic or improve test isolation
- **CI failures**: Tests may behave differently in CI environments

### Debugging Tips
- Run tests individually to isolate issues
- Add debug logging for timing-sensitive operations
- Use `test.only()` to focus on specific failing tests
- Check resource usage and cleanup

## Migration from Unit Tests

When moving tests from unit to integration:

1. **Remove fake timers**: Use real `setTimeout` and `Promise` timing
2. **Add cleanup**: Implement proper resource cleanup
3. **Increase timeouts**: Use realistic timeouts for operations
4. **Update assertions**: Account for real timing variations
5. **Add error handling**: Test both success and failure scenarios

## CI Integration

Integration tests run separately in the CI pipeline:
- Parallel execution with unit tests
- Separate reporting and artifacts
- Retry logic for flaky tests
- Longer timeout allowances
- Matrix testing across different environments