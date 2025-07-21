/**
 * JobMonitoringPanel Component
 * 
 * This component provides an admin interface for monitoring and managing conversion jobs.
 * It displays a list of jobs with their statuses, allows for job prioritization,
 * and provides job cancellation functionality.
 * 
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 * - 7.5: Provide comprehensive error reporting
 */

import React, { useState, useEffect } from 'react';
import { ConversionJob, JobStatus } from '../../../types/services';

interface JobMonitoringPanelProps {
  /**
   * Function to fetch all jobs
   */
  fetchJobs: () => Promise<ConversionJob[]>;
  
  /**
   * Function to cancel a job
   */
  cancelJob: (jobId: string) => Promise<boolean>;
  
  /**
   * Function to update job priority
   */
  updateJobPriority: (jobId: string, priority: number) => Promise<boolean>;
  
  /**
   * Auto-refresh interval in milliseconds
   */
  refreshInterval?: number;
}

/**
 * JobMonitoringPanel component for admin job management
 */
export const JobMonitoringPanel: React.FC<JobMonitoringPanelProps> = ({
  fetchJobs,
  cancelJob,
  updateJobPriority,
  refreshInterval = 5000, // Default refresh every 5 seconds
}) => {
  // State for jobs
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  
  // State for loading status
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for error message
  const [error, setError] = useState<string | null>(null);
  
  // State for job being edited (for priority)
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // State for new priority value
  const [newPriority, setNewPriority] = useState<number>(1);
  
  // State for filter
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  
  // Load jobs on component mount and at regular intervals
  useEffect(() => {
    // Function to load jobs
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedJobs = await fetchJobs();
        setJobs(loadedJobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Load jobs immediately
    loadJobs();
    
    // Set up interval for auto-refresh
    const intervalId = setInterval(loadJobs, refreshInterval);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchJobs, refreshInterval]);
  
  // Handle job cancellation
  const handleCancelJob = async (jobId: string) => {
    try {
      setError(null);
      const success = await cancelJob(jobId);
      
      if (success) {
        // Update job status in the UI immediately for better UX
        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId 
              ? { ...job, status: 'cancelled' as JobStatus } 
              : job
          )
        );
      } else {
        setError(`Failed to cancel job ${jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to cancel job ${jobId}`);
    }
  };
  
  // Handle priority update
  const handleUpdatePriority = async (jobId: string) => {
    try {
      setError(null);
      const success = await updateJobPriority(jobId, newPriority);
      
      if (success) {
        // Update job priority in the UI immediately for better UX
        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId 
              ? { ...job, priority: newPriority } 
              : job
          )
        );
        setEditingJobId(null);
      } else {
        setError(`Failed to update priority for job ${jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update priority for job ${jobId}`);
    }
  };
  
  // Filter jobs based on selected status
  const filteredJobs = statusFilter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === statusFilter);
  
  return (
    <div className="job-monitoring-panel">
      <h2>Job Monitoring and Management</h2>
      
      {/* Filter controls */}
      <div className="filter-controls">
        <label htmlFor="status-filter">Filter by status:</label>
        <select 
          id="status-filter" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
        >
          <option value="all">All Jobs</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && <div className="loading-indicator">Loading jobs...</div>}
      
      {/* Jobs table */}
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Priority</th>
            <th>Created At</th>
            <th>Updated At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredJobs.length === 0 ? (
            <tr>
              <td colSpan={7} className="no-jobs">
                {isLoading ? 'Loading jobs...' : 'No jobs found'}
              </td>
            </tr>
          ) : (
            filteredJobs.map(job => (
              <tr key={job.id} className={`job-row status-${job.status}`}>
                <td>{job.id}</td>
                <td>{job.status}</td>
                <td>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${job.progress}%` }}
                    ></div>
                    <span>{job.progress}%</span>
                  </div>
                </td>
                <td>
                  {editingJobId === job.id ? (
                    <div className="priority-editor">
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        value={newPriority} 
                        onChange={(e) => setNewPriority(parseInt(e.target.value, 10))}
                      />
                      <button onClick={() => handleUpdatePriority(job.id)}>Save</button>
                      <button onClick={() => setEditingJobId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="priority-display">
                      <span>{job.priority || 1}</span>
                      {(job.status === 'pending') && (
                        <button 
                          className="edit-priority-button"
                          onClick={() => {
                            setEditingJobId(job.id);
                            setNewPriority(job.priority || 1);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td>{new Date(job.createdAt).toLocaleString()}</td>
                <td>{new Date(job.updatedAt).toLocaleString()}</td>
                <td>
                  {(job.status === 'pending' || job.status === 'processing') && (
                    <button 
                      className="cancel-job-button"
                      onClick={() => handleCancelJob(job.id)}
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <button 
                      className="view-result-button"
                      onClick={() => window.location.href = `/results/${job.id}`}
                    >
                      View Result
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Job statistics */}
      <div className="job-statistics">
        <h3>Job Statistics</h3>
        <ul>
          <li>Total Jobs: {jobs.length}</li>
          <li>Pending: {jobs.filter(job => job.status === 'pending').length}</li>
          <li>Processing: {jobs.filter(job => job.status === 'processing').length}</li>
          <li>Completed: {jobs.filter(job => job.status === 'completed').length}</li>
          <li>Failed: {jobs.filter(job => job.status === 'failed').length}</li>
          <li>Cancelled: {jobs.filter(job => job.status === 'cancelled').length}</li>
        </ul>
      </div>
    </div>
  );
};

export default JobMonitoringPanel;