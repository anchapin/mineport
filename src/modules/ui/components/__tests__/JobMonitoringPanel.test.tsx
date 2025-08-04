/**
 * Tests for JobMonitoringPanel component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JobMonitoringPanel } from '../JobMonitoringPanel.js';
import { ConversionJob } from '../../../../types/services.js';

// Mock jobs data
const mockJobs: ConversionJob[] = [
  {
    id: 'job_1',
    input: {
      modFile: 'test-mod.jar',
      outputPath: '/output',
      options: {
        targetMinecraftVersion: '1.19',
        compromiseStrategy: 'balanced',
        includeDocumentation: true,
        optimizeAssets: true
      }
    },
    status: 'pending',
    progress: 0,
    priority: 1,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z')
  },
  {
    id: 'job_2',
    input: {
      modFile: 'another-mod.jar',
      outputPath: '/output',
      options: {
        targetMinecraftVersion: '1.19',
        compromiseStrategy: 'balanced',
        includeDocumentation: true,
        optimizeAssets: true
      }
    },
    status: 'processing',
    progress: 45,
    priority: 2,
    createdAt: new Date('2023-01-01T09:30:00Z'),
    updatedAt: new Date('2023-01-01T09:35:00Z')
  },
  {
    id: 'job_3',
    input: {
      modFile: 'completed-mod.jar',
      outputPath: '/output',
      options: {
        targetMinecraftVersion: '1.19',
        compromiseStrategy: 'balanced',
        includeDocumentation: true,
        optimizeAssets: true
      }
    },
    status: 'completed',
    progress: 100,
    priority: 1,
    createdAt: new Date('2023-01-01T08:00:00Z'),
    updatedAt: new Date('2023-01-01T08:10:00Z'),
    completedAt: new Date('2023-01-01T08:10:00Z')
  }
];

// Mock functions
const mockFetchJobs = jest.fn().mockResolvedValue(mockJobs);
const mockCancelJob = jest.fn().mockResolvedValue(true);
const mockUpdateJobPriority = jest.fn().mockResolvedValue(true);

describe('JobMonitoringPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with job data', async () => {
    render(
      <JobMonitoringPanel
        fetchJobs={mockFetchJobs}
        cancelJob={mockCancelJob}
        updateJobPriority={mockUpdateJobPriority}
        refreshInterval={10000} // Long interval to avoid auto-refresh during test
      />
    );

    // Check that fetchJobs was called
    expect(mockFetchJobs).toHaveBeenCalledTimes(1);

    // Wait for jobs to be displayed
    await waitFor(() => {
      expect(screen.getByText('job_1')).toBeInTheDocument();
      expect(screen.getByText('job_2')).toBeInTheDocument();
      expect(screen.getByText('job_3')).toBeInTheDocument();
    });

    // Check that job statuses are displayed
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();

    // Check that progress bars are displayed
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(3);
  });

  it('allows filtering jobs by status', async () => {
    render(
      <JobMonitoringPanel
        fetchJobs={mockFetchJobs}
        cancelJob={mockCancelJob}
        updateJobPriority={mockUpdateJobPriority}
        refreshInterval={10000}
      />
    );

    // Wait for jobs to be displayed
    await waitFor(() => {
      expect(screen.getByText('job_1')).toBeInTheDocument();
    });

    // Filter by completed status
    fireEvent.change(screen.getByLabelText(/filter by status/i), {
      target: { value: 'completed' }
    });

    // Check that only completed job is displayed
    expect(screen.queryByText('job_1')).not.toBeInTheDocument();
    expect(screen.queryByText('job_2')).not.toBeInTheDocument();
    expect(screen.getByText('job_3')).toBeInTheDocument();
  });

  it('allows cancelling a job', async () => {
    render(
      <JobMonitoringPanel
        fetchJobs={mockFetchJobs}
        cancelJob={mockCancelJob}
        updateJobPriority={mockUpdateJobPriority}
        refreshInterval={10000}
      />
    );

    // Wait for jobs to be displayed
    await waitFor(() => {
      expect(screen.getByText('job_1')).toBeInTheDocument();
    });

    // Find and click the cancel button for the pending job
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);

    // Check that cancelJob was called with the correct job ID
    expect(mockCancelJob).toHaveBeenCalledWith('job_1');
  });

  it('allows updating job priority', async () => {
    render(
      <JobMonitoringPanel
        fetchJobs={mockFetchJobs}
        cancelJob={mockCancelJob}
        updateJobPriority={mockUpdateJobPriority}
        refreshInterval={10000}
      />
    );

    // Wait for jobs to be displayed
    await waitFor(() => {
      expect(screen.getByText('job_1')).toBeInTheDocument();
    });

    // Find and click the edit button for the pending job
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Find the priority input and change its value
    const priorityInput = screen.getByRole('spinbutton');
    fireEvent.change(priorityInput, { target: { value: '5' } });

    // Click the save button
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Check that updateJobPriority was called with the correct job ID and priority
    expect(mockUpdateJobPriority).toHaveBeenCalledWith('job_1', 5);
  });

  it('displays error message when fetchJobs fails', async () => {
    const mockFetchJobsError = jest.fn().mockRejectedValue(new Error('Failed to fetch jobs'));

    render(
      <JobMonitoringPanel
        fetchJobs={mockFetchJobsError}
        cancelJob={mockCancelJob}
        updateJobPriority={mockUpdateJobPriority}
        refreshInterval={10000}
      />
    );

    // Wait for error message to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch jobs')).toBeInTheDocument();
    });
  });
});