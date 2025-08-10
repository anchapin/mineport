/**
 * API Mapping Management Panel
 *
 * Admin interface component for managing API mappings.
 * Provides functionality for viewing, adding, editing, and importing/exporting mappings.
 */

import React, { useState, useEffect } from 'react';
import { APIMapping, MappingFilter } from '../../../types/api.js';
import {
  MappingValidationResult,
  BulkOperationResult,
  MappingStatistics,
} from '../../../services/APIMappingAdminService.js';

interface APIMappingManagementPanelProps {
  onMappingAdd?: (mapping: APIMapping) => Promise<void>;
  onMappingUpdate?: (mapping: APIMapping) => Promise<void>;
  onMappingDelete?: (mappingId: string) => Promise<void>;
  onMappingsImport?: (jsonData: string) => Promise<void>;
  onMappingsExport?: (filter?: MappingFilter) => Promise<string>;
  onValidateMapping?: (mapping: APIMapping) => MappingValidationResult;
  onGetStatistics?: () => Promise<MappingStatistics>;
  onGetMappings?: (filter?: MappingFilter) => Promise<APIMapping[]>;
}

export const APIMappingManagementPanel: React.FC<APIMappingManagementPanelProps> = ({
  onMappingAdd,
  onMappingUpdate,
  onMappingDelete,
  onMappingsImport,
  onMappingsExport,
  onValidateMapping,
  onGetStatistics,
  onGetMappings,
}) => {
  const [mappings, setMappings] = useState<APIMapping[]>([]);
  const [statistics, setStatistics] = useState<MappingStatistics | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<APIMapping | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filter, setFilter] = useState<MappingFilter>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<MappingValidationResult | null>(null);

  // Load mappings and statistics on component mount
  useEffect(() => {
    loadMappings();
    loadStatistics();
  }, [filter]);

  const loadMappings = async () => {
    if (!onGetMappings) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onGetMappings(filter);
      setMappings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!onGetStatistics) return;

    try {
      const stats = await onGetStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleMappingSubmit = async (mapping: APIMapping) => {
    if (!onMappingAdd && !onMappingUpdate) return;

    setLoading(true);
    setError(null);

    try {
      if (isEditing && onMappingUpdate) {
        await onMappingUpdate(mapping);
      } else if (!isEditing && onMappingAdd) {
        await onMappingAdd(mapping);
      }

      setSelectedMapping(null);
      setIsEditing(false);
      await loadMappings();
      await loadStatistics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingDelete = async (mappingId: string) => {
    if (!onMappingDelete) return;

    if (!confirm('Are you sure you want to delete this mapping?')) return;

    setLoading(true);
    setError(null);

    try {
      await onMappingDelete(mappingId);
      await loadMappings();
      await loadStatistics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mapping');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!onMappingsExport) return;

    try {
      const jsonData = await onMappingsExport(filter);

      // Create download link
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `api-mappings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export mappings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onMappingsImport) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const jsonData = await file.text();
      await onMappingsImport(jsonData);
      await loadMappings();
      await loadStatistics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import mappings');
    } finally {
      setLoading(false);
    }
  };

  const validateCurrentMapping = () => {
    if (!selectedMapping || !onValidateMapping) return;

    const result = onValidateMapping(selectedMapping);
    setValidationResult(result);
  };

  return (
    <div className="api-mapping-management-panel">
      <div className="panel-header">
        <h2>API Mapping Management</h2>
        <div className="panel-actions">
          <button
            onClick={() => {
              setSelectedMapping({
                id: '',
                javaSignature: '',
                bedrockEquivalent: '',
                conversionType: 'direct',
                notes: '',
                version: '1.0.0',
                lastUpdated: new Date(),
              });
              setIsEditing(false);
              setValidationResult(null);
            }}
            className="btn btn-primary"
          >
            Add New Mapping
          </button>
          <button onClick={handleExport} className="btn btn-secondary">
            Export Mappings
          </button>
          <label className="btn btn-secondary">
            Import Mappings
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Statistics Panel */}
      {statistics && (
        <div className="statistics-panel">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Mappings:</span>
              <span className="stat-value">{statistics.totalMappings}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Direct:</span>
              <span className="stat-value">{statistics.byConversionType.direct || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Wrapper:</span>
              <span className="stat-value">{statistics.byConversionType.wrapper || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Complex:</span>
              <span className="stat-value">{statistics.byConversionType.complex || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Impossible:</span>
              <span className="stat-value">{statistics.byConversionType.impossible || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <div className="filter-panel">
        <h3>Filters</h3>
        <div className="filter-controls">
          <select
            value={filter.conversionType || ''}
            onChange={(e) =>
              setFilter({ ...filter, conversionType: (e.target.value as any) || undefined })
            }
          >
            <option value="">All Types</option>
            <option value="direct">Direct</option>
            <option value="wrapper">Wrapper</option>
            <option value="complex">Complex</option>
            <option value="impossible">Impossible</option>
          </select>

          <input
            type="text"
            placeholder="Search..."
            value={filter.search || ''}
            onChange={(e) => setFilter({ ...filter, search: e.target.value || undefined })}
          />

          <input
            type="text"
            placeholder="Version..."
            value={filter.version || ''}
            onChange={(e) => setFilter({ ...filter, version: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Mappings List */}
      <div className="mappings-list">
        <h3>Mappings ({mappings.length})</h3>
        {loading ? (
          <div className="loading">Loading mappings...</div>
        ) : (
          <div className="mappings-table">
            <table>
              <thead>
                <tr>
                  <th>Java Signature</th>
                  <th>Bedrock Equivalent</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="java-signature">{mapping.javaSignature}</td>
                    <td className="bedrock-equivalent">{mapping.bedrockEquivalent}</td>
                    <td className={`conversion-type type-${mapping.conversionType}`}>
                      {mapping.conversionType}
                    </td>
                    <td>{mapping.version}</td>
                    <td>{mapping.lastUpdated.toLocaleDateString()}</td>
                    <td className="actions">
                      <button
                        onClick={() => {
                          setSelectedMapping(mapping);
                          setIsEditing(true);
                          setValidationResult(null);
                        }}
                        className="btn btn-sm btn-secondary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleMappingDelete(mapping.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mapping Editor Modal */}
      {selectedMapping && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Mapping' : 'Add New Mapping'}</h3>
              <button
                onClick={() => {
                  setSelectedMapping(null);
                  setValidationResult(null);
                }}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
            </div>

            <div className="modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleMappingSubmit(selectedMapping);
                }}
              >
                <div className="form-group">
                  <label>ID:</label>
                  <input
                    type="text"
                    value={selectedMapping.id}
                    onChange={(e) => setSelectedMapping({ ...selectedMapping, id: e.target.value })}
                    required
                    disabled={isEditing}
                  />
                </div>

                <div className="form-group">
                  <label>Java Signature:</label>
                  <input
                    type="text"
                    value={selectedMapping.javaSignature}
                    onChange={(e) =>
                      setSelectedMapping({ ...selectedMapping, javaSignature: e.target.value })
                    }
                    required
                    placeholder="e.g., net.minecraft.entity.Entity.getPosition"
                  />
                </div>

                <div className="form-group">
                  <label>Bedrock Equivalent:</label>
                  <input
                    type="text"
                    value={selectedMapping.bedrockEquivalent}
                    onChange={(e) =>
                      setSelectedMapping({ ...selectedMapping, bedrockEquivalent: e.target.value })
                    }
                    required
                    placeholder="e.g., entity.location or UNSUPPORTED"
                  />
                </div>

                <div className="form-group">
                  <label>Conversion Type:</label>
                  <select
                    value={selectedMapping.conversionType}
                    onChange={(e) =>
                      setSelectedMapping({
                        ...selectedMapping,
                        conversionType: e.target.value as any,
                      })
                    }
                    required
                  >
                    <option value="direct">Direct</option>
                    <option value="wrapper">Wrapper</option>
                    <option value="complex">Complex</option>
                    <option value="impossible">Impossible</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Version:</label>
                  <input
                    type="text"
                    value={selectedMapping.version}
                    onChange={(e) =>
                      setSelectedMapping({ ...selectedMapping, version: e.target.value })
                    }
                    required
                    placeholder="e.g., 1.0.0"
                  />
                </div>

                <div className="form-group">
                  <label>Notes:</label>
                  <textarea
                    value={selectedMapping.notes}
                    onChange={(e) =>
                      setSelectedMapping({ ...selectedMapping, notes: e.target.value })
                    }
                    rows={3}
                    placeholder="Description of the mapping and any special considerations"
                  />
                </div>

                {selectedMapping.exampleUsage && (
                  <>
                    <div className="form-group">
                      <label>Java Example:</label>
                      <textarea
                        value={selectedMapping.exampleUsage.java}
                        onChange={(e) =>
                          setSelectedMapping({
                            ...selectedMapping,
                            exampleUsage: {
                              ...selectedMapping.exampleUsage!,
                              java: e.target.value,
                            },
                          })
                        }
                        rows={2}
                        placeholder="Java code example"
                      />
                    </div>

                    <div className="form-group">
                      <label>Bedrock Example:</label>
                      <textarea
                        value={selectedMapping.exampleUsage.bedrock}
                        onChange={(e) =>
                          setSelectedMapping({
                            ...selectedMapping,
                            exampleUsage: {
                              ...selectedMapping.exampleUsage!,
                              bedrock: e.target.value,
                            },
                          })
                        }
                        rows={2}
                        placeholder="Bedrock JavaScript code example"
                      />
                    </div>
                  </>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={validateCurrentMapping}
                    className="btn btn-secondary"
                  >
                    Validate
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : isEditing ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>

              {/* Validation Results */}
              {validationResult && (
                <div className="validation-results">
                  <h4>Validation Results</h4>
                  <div
                    className={`validation-status ${validationResult.isValid ? 'valid' : 'invalid'}`}
                  >
                    Status: {validationResult.isValid ? 'Valid' : 'Invalid'}
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="validation-errors">
                      <h5>Errors:</h5>
                      <ul>
                        {validationResult.errors.map((error, index) => (
                          <li key={index} className="error">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="validation-warnings">
                      <h5>Warnings:</h5>
                      <ul>
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index} className="warning">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .api-mapping-management-panel {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .panel-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-primary {
          background-color: #007bff;
          color: white;
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .statistics-panel {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
        }

        .filter-panel {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .filter-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-controls select,
        .filter-controls input {
          padding: 6px 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }

        .mappings-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th,
        td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }

        th {
          background-color: #f8f9fa;
          font-weight: 600;
        }

        .java-signature {
          font-family: monospace;
          font-size: 12px;
        }

        .bedrock-equivalent {
          font-family: monospace;
          font-size: 12px;
        }

        .conversion-type {
          text-transform: capitalize;
          font-weight: 500;
        }

        .type-direct {
          color: #28a745;
        }
        .type-wrapper {
          color: #ffc107;
        }
        .type-complex {
          color: #fd7e14;
        }
        .type-impossible {
          color: #dc3545;
        }

        .actions {
          display: flex;
          gap: 5px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: white;
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #dee2e6;
        }

        .modal-body {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .validation-results {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }

        .validation-status.valid {
          color: #28a745;
          font-weight: 600;
        }

        .validation-status.invalid {
          color: #dc3545;
          font-weight: 600;
        }

        .validation-errors .error {
          color: #dc3545;
        }

        .validation-warnings .warning {
          color: #ffc107;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};
