import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/')}>
        <div className="navbar-logo">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.2" fill="white" />
            <circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" />
          </svg>
        </div>
        <span className="navbar-name">Camarin</span>
      </div>

      <div className="navbar-right">
        <span className="navbar-email">{user?.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
