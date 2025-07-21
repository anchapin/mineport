/**
 * AdminDashboard Component
 * 
 * This component provides an admin dashboard for monitoring and managing conversion jobs.
 * It includes the JobMonitoringPanel component and other admin functionality.
 * 
 * Implements requirements:
 * - 7.2: Process multiple conversion requests in parallel
 * - 7.4: Provide real-time status updates for conversion jobs
 * - 7.5: Provide comprehensive error reporting
 */

import React, { useState } from 'react';
import { JobMonitoringPanel } from '../components/JobMonitoringPanel';
import { ConversionAPIService } from '../services/ConversionAPIService';

interface AdminDashboardProps {
  /**
   * API service for conversion operations
   */
  apiService: ConversionAPIService;
}

/**
 * AdminDashboard component
 */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  apiService,
}) => {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'jobs' | 'settings' | 'logs'>('jobs');
  
  // Function to fetch all jobs
  const fetchJobs = async () => {
    try {
      // This is a mock implementation
      // In a real application, this would call an admin API endpoint
      const response = await fetch('/api/admin/jobs');
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }
  };
  
  // Function to cancel a job
  const cancelJob = async (jobId: string) => {
    try {
      return await apiService.cancelConversion(jobId);
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      throw error;
    }
  };
  
  // Function to update job priority
  const updateJobPriority = async (jobId: string, priority: number) => {
    try {
      // This is a mock implementation
      // In a real application, this would call an admin API endpoint
      const response = await fetch(`/api/admin/jobs/${jobId}/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update job priority: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating priority for job ${jobId}:`, error);
      throw error;
    }
  };
  
  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      
      {/* Navigation tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          Job Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          System Settings
        </button>
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          System Logs
        </button>
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'jobs' && (
          <JobMonitoringPanel 
            fetchJobs={fetchJobs}
            cancelJob={cancelJob}
            updateJobPriority={updateJobPriority}
            refreshInterval={5000}
          />
        )}
        
        {activeTab === 'settings' && (
          <div className="settings-panel">
            <h2>System Settings</h2>
            <p>System settings functionality will be implemented in a future task.</p>
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div className="logs-panel">
            <h2>System Logs</h2>
            <p>System logs functionality will be implemented in a future task.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;