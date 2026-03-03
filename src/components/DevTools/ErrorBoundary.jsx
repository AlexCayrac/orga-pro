import React from 'react';
import PropTypes from 'prop-types';
import { errorHandler } from '../../utils/errorHandler';

/**
 * Composant Error Boundary pour capturer les erreurs React
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorHandler.captureError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react-error-boundary',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorContainer}>
          <h2>Une erreur s'est produite</h2>
          <details style={styles.details}>
            <summary>Détails de l'erreur</summary>
            <pre>{this.state.error.toString()}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            Recharger l'application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  errorContainer: {
    padding: '20px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  details: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  button: {
    marginTop: '10px',
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default ErrorBoundary;

ErrorBoundary.propTypes = {
  children: PropTypes.node,
};
