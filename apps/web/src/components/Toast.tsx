interface ToastProps {
  title: string;
  message: string;
  type: 'warning' | 'success';
  onClick?: () => void;
  onDismiss?: () => void;
}

export default function Toast({ title, message, type, onClick, onDismiss }: ToastProps) {
  return (
    <div
      className={`toast toast-${type}`}
      onClick={onClick}
      role="alert"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="toast-title">{title}</div>
          <div className="toast-message">{message}</div>
        </div>
        {onDismiss && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{ marginLeft: 'var(--space-2)', padding: '2px 6px' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
