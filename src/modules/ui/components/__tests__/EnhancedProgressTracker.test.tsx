/**
 * Enhanced Progress Tracker Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedProgressTracker } from '../EnhancedProgressTracker';
import { ConversionStage, ProgressInfo } from '../EnhancedConversionUI';

describe('EnhancedProgressTracker', () => {
  const createMockProgress = (overrides: Partial<ProgressInfo> = {}): ProgressInfo => ({
    overall: 50,
    stages: [],
    currentStage: 'analyzing',
    estimatedTimeRemaining: 120,
    startTime: new Date(Date.now() - 60000), // 1 minute ago
    ...overrides
  });

  const createMockStage = (overrides: Partial<ConversionStage> = {}): ConversionStage => ({
    name: 'analyzing',
    status: 'running',
    progress: 75,
    details: {
      description: 'Analyzing mod structure with multi-strategy extraction',
      currentTask: 'Extracting registry names',
      subTasks: [
        { name: 'Parse JAR file', completed: true },
        { name: 'Extract registry names', completed: false, progress: 60 },
        { name: 'Analyze textures', completed: false }
      ]
    },
    ...overrides
  });

  describe('Overall Progress Display', () => {
    it('should display overall progress percentage', () => {
      const progress = createMockProgress({ overall: 75 });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should display elapsed time when start time is provided', () => {
      const progress = createMockProgress({
        startTime: new Date(Date.now() - 90000) // 1.5 minutes ago
      });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText(/Elapsed: 1m 30s/)).toBeInTheDocument();
    });

    it('should display estimated time remaining', () => {
      const progress = createMockProgress({ estimatedTimeRemaining: 180 });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText(/ETA: 3m 0s/)).toBeInTheDocument();
    });

    it('should show progress bar with correct width', () => {
      const progress = createMockProgress({ overall: 60 });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toHaveStyle('width: 60%');
    });
  });

  describe('Stage Progress Display', () => {
    it('should display all conversion stages', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ name: 'analyzing' });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Check for stage labels
      expect(screen.getByText('Initialize')).toBeInTheDocument();
      expect(screen.getByText('Validate')).toBeInTheDocument();
      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('Logic')).toBeInTheDocument();
      expect(screen.getByText('Package')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('should highlight current active stage', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ name: 'converting_assets' });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      const activeStage = document.querySelector('.stage.active');
      expect(activeStage).toBeInTheDocument();
    });

    it('should show completed stages with checkmarks', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ name: 'converting_assets' });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Earlier stages should show as completed
      const completedStages = document.querySelectorAll('.stage.completed');
      expect(completedStages.length).toBeGreaterThan(0);
    });

    it('should show failed stage with error icon', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ 
        name: 'analyzing', 
        status: 'failed' 
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('❌')).toBeInTheDocument();
    });

    it('should display stage progress percentage for active stage', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ 
        name: 'analyzing',
        status: 'running',
        progress: 65
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  describe('Stage Details Display', () => {
    it('should display current stage description', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Analyzing mod structure with multi-strategy extraction'
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('Analyzing mod structure with multi-strategy extraction')).toBeInTheDocument();
    });

    it('should display current task when available', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Analyzing mod structure',
          currentTask: 'Extracting registry names from bytecode'
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('Extracting registry names from bytecode')).toBeInTheDocument();
    });

    it('should display sub-tasks when available', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Processing assets',
          subTasks: [
            { name: 'Convert textures', completed: true },
            { name: 'Convert models', completed: false, progress: 40 },
            { name: 'Convert sounds', completed: false }
          ]
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText('Convert textures')).toBeInTheDocument();
      expect(screen.getByText('Convert models')).toBeInTheDocument();
      expect(screen.getByText('Convert sounds')).toBeInTheDocument();
      expect(screen.getByText('(40%)')).toBeInTheDocument();
    });

    it('should show completed sub-tasks with checkmarks', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Processing',
          subTasks: [
            { name: 'Task 1', completed: true },
            { name: 'Task 2', completed: false }
          ]
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      const completedTasks = document.querySelectorAll('.sub-task.completed');
      expect(completedTasks).toHaveLength(1);
    });

    it('should display technical metadata when available', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Processing',
          metadata: {
            filesProcessed: 15,
            registryNamesFound: 8,
            texturesDetected: 12
          }
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Check for metadata section
      expect(screen.getByText('Technical Details')).toBeInTheDocument();
    });
  });

  describe('Progress Ring Animation', () => {
    it('should show progress ring for active stage with progress', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        name: 'analyzing',
        status: 'running',
        progress: 75
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      const progressRing = document.querySelector('.progress-ring');
      expect(progressRing).toBeInTheDocument();
    });

    it('should not show progress ring for stages without progress', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        name: 'analyzing',
        status: 'running',
        progress: 0
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      const progressRing = document.querySelector('.progress-ring');
      expect(progressRing).not.toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format seconds correctly', () => {
      const progress = createMockProgress({
        startTime: new Date(Date.now() - 45000) // 45 seconds ago
      });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText(/Elapsed: 45s/)).toBeInTheDocument();
    });

    it('should format minutes and seconds correctly', () => {
      const progress = createMockProgress({
        startTime: new Date(Date.now() - 125000) // 2 minutes 5 seconds ago
      });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      expect(screen.getByText(/Elapsed: 2m 5s/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for progress elements', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Check for progress bar accessibility
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar?.parentElement).toHaveClass('progress-bar-container');
    });

    it('should provide screen reader friendly stage information', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Stage information should be accessible
      expect(screen.getByText('Analyzing mod structure with multi-strategy extraction')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing start time gracefully', () => {
      const progress = createMockProgress({ startTime: undefined });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Should not crash and should not show elapsed time
      expect(screen.queryByText(/Elapsed:/)).not.toBeInTheDocument();
    });

    it('should handle missing estimated time gracefully', () => {
      const progress = createMockProgress({ estimatedTimeRemaining: undefined });
      const currentStage = createMockStage();

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Should not crash and should not show ETA
      expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
    });

    it('should handle empty sub-tasks array', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({
        details: {
          description: 'Processing',
          subTasks: []
        }
      });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Should not show sub-tasks section
      expect(screen.queryByText('Tasks:')).not.toBeInTheDocument();
    });

    it('should handle unknown stage names', () => {
      const progress = createMockProgress();
      const currentStage = createMockStage({ name: 'unknown_stage' as any });

      render(<EnhancedProgressTracker progress={progress} currentStage={currentStage} />);

      // Should not crash and should show the stage name
      expect(screen.getByText('Conversion Progress')).toBeInTheDocument();
    });
  });
});