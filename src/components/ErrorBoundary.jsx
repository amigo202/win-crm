import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 32, textAlign: 'center', fontFamily: "'Rubik', sans-serif",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h3 style={{ color: 'var(--text)', fontSize: 18, marginBottom: 8 }}>שגיאה בטעינת העמוד</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, maxWidth: 400 }}>
            {this.state.error?.message || 'אירעה שגיאה לא צפויה'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 600,
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
            }}
          >
            נסה שוב
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
