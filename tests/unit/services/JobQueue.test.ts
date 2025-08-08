import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueue } from '../../../src/services/JobQueue.js';

describe('JobQueue', () => {
  let jobQueue: JobQueue;

  beforeEach(() => {
    jobQueue = new JobQueue({ maxConcurrent: 2 });
  });

  it('should add jobs to the queue', () => {
    const job = jobQueue.addJob('test', { data: 'test data' });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.type).toBe('test');
    expect(job.data).toEqual({ data: 'test data' });
    expect(job.status).toBe('processing'); // Should be processing since maxConcurrent is 2

    const jobs = jobQueue.getJobs();
    expect(jobs.length).toBe(1);
  });

  it('should process jobs up to maxConcurrent limit', () => {
    const job1 = jobQueue.addJob('test', { data: 'test1' });
    const job2 = jobQueue.addJob('test', { data: 'test2' });
    const job3 = jobQueue.addJob('test', { data: 'test3' });

    expect(job1.status).toBe('processing');
    expect(job2.status).toBe('processing');
    expect(job3.status).toBe('pending');

    const processingJobs = jobQueue.getJobs({ status: 'processing' });
    expect(processingJobs.length).toBe(2);

    const pendingJobs = jobQueue.getJobs({ status: 'pending' });
    expect(pendingJobs.length).toBe(1);
  });

  it('should mark jobs as completed', () => {
    const job = jobQueue.addJob('test', { data: 'test data' });
    jobQueue.completeJob(job.id, { result: 'success' });

    const completedJob = jobQueue.getJob(job.id);
    expect(completedJob?.status).toBe('completed');
    expect(completedJob?.result).toEqual({ result: 'success' });
  });

  it('should mark jobs as failed', () => {
    const job = jobQueue.addJob('test', { data: 'test data' });
    const error = new Error('Test error');
    jobQueue.failJob(job.id, error);

    const failedJob = jobQueue.getJob(job.id);
    expect(failedJob?.status).toBe('failed');
    expect(failedJob?.error).toBe(error);
  });

  it('should process next job when one completes', () => {
    const job1 = jobQueue.addJob('test', { data: 'test1' });
    jobQueue.addJob('test', { data: 'test2' }); // job2 - not directly used
    const job3 = jobQueue.addJob('test', { data: 'test3' });

    // Initially job3 should be pending
    expect(job3.status).toBe('pending');

    // Complete job1
    jobQueue.completeJob(job1.id);

    // Now job3 should be processing
    const updatedJob3 = jobQueue.getJob(job3.id);
    expect(updatedJob3?.status).toBe('processing');
  });

  it('should sort jobs by priority', () => {
    const lowPriorityJob = jobQueue.addJob('test', { data: 'low' }, 1);
    const highPriorityJob = jobQueue.addJob('test', { data: 'high' }, 10);
    const mediumPriorityJob = jobQueue.addJob('test', { data: 'medium' }, 5);

    // Complete the first two jobs to make room for the third
    jobQueue.completeJob(lowPriorityJob.id);
    jobQueue.completeJob(highPriorityJob.id);

    // Now the medium priority job should be processing
    const updatedMediumJob = jobQueue.getJob(mediumPriorityJob.id);
    expect(updatedMediumJob?.status).toBe('processing');

    // Add a new high priority job
    const newHighPriorityJob = jobQueue.addJob('test', { data: 'new high' }, 15);

    // Add a new low priority job
    const newLowPriorityJob = jobQueue.addJob('test', { data: 'new low' }, 2);

    // The new high priority job should be processing, the new low priority job should be pending
    expect(newHighPriorityJob.status).toBe('processing');
    expect(newLowPriorityJob.status).toBe('pending');
  });

  it('should emit events when job status changes', () => {
    const addedListener = vi.fn();
    const processListener = vi.fn();
    const completedListener = vi.fn();
    const failedListener = vi.fn();

    jobQueue.on('job:added', addedListener);
    jobQueue.on('job:process', processListener);
    jobQueue.on('job:completed', completedListener);
    jobQueue.on('job:failed', failedListener);

    const job = jobQueue.addJob('test', { data: 'test data' });

    expect(addedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: job.id,
        type: 'test',
      })
    );

    expect(processListener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: job.id,
        status: 'processing',
      })
    );

    jobQueue.completeJob(job.id, { result: 'success' });

    expect(completedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: job.id,
        status: 'completed',
        result: { result: 'success' },
      })
    );

    const job2 = jobQueue.addJob('test', { data: 'test data 2' });
    jobQueue.failJob(job2.id, new Error('Test error'));

    expect(failedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: job2.id,
        status: 'failed',
        error: expect.any(Error),
      })
    );
  });

  it('should provide queue statistics', () => {
    const job1 = jobQueue.addJob('test', { data: 'test1' });
    const job2 = jobQueue.addJob('test', { data: 'test2' });
    jobQueue.addJob('test', { data: 'test3' }); // job3 - not directly used

    jobQueue.completeJob(job1.id);
    jobQueue.failJob(job2.id, new Error('Test error'));

    const stats = jobQueue.getStats();

    expect(stats.pending).toBe(0);
    expect(stats.processing).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
  });
});
