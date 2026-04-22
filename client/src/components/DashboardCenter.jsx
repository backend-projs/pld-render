import { Calendar, MoreHorizontal } from 'lucide-react';
import './DashboardCenter.css';

export default function DashboardCenter() {
  const activities = [
    { id: 1, title: 'Session 1', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
    { id: 2, title: 'Session 2', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
    { id: 3, title: 'Session 3', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated', yellow: true },
    { id: 4, title: 'Session 6', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
    { id: 5, title: 'Session 2', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
    { id: 6, title: 'Session 3', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
    { id: 7, title: 'Session 4', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated', yellow: true },
    { id: 8, title: 'Session 5', date: 'April 20', desc: 'This is an example of a recent session description text.', status: 'Postulated' },
  ];

  // SVG chart path for line chart
  const chartPath = "M 0,80 L 40,75 L 80,85 L 120,60 L 160,65 L 200,55 L 240,50 L 280,45 L 320,55 L 360,40 L 400,30 L 440,20 L 480,10";
  const areaPath = "M 0,80 L 40,75 L 80,85 L 120,60 L 160,65 L 200,55 L 240,50 L 280,45 L 320,55 L 360,40 L 400,30 L 440,20 L 480,10 L 480,100 L 0,100 Z";

  // Progress ring calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = 30;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="dashboard-center">
      {/* Top Cards */}
      <div className="top-cards">
        {/* Welcome Card */}
        <div className="welcome-card">
          <p className="welcome-label">Welcome</p>
          <h1 className="welcome-title">Welcome</h1>
          <p className="welcome-subtitle">Somi slabenaaestia your a cari linesilkun.</p>
          <button className="btn-session">Go to Session</button>
        </div>

        {/* Performance Overview Card */}
        <div className="performance-card">
          <div className="performance-header">
            <h3 className="performance-title">Performance Overview</h3>
            <div className="legend">
              <span className="legend-dot"></span>
              <span>Average Completion</span>
            </div>
          </div>

          <div className="chart-container">
            <div className="y-labels">
              <span>500</span>
              <span>200</span>
              <span>100</span>
            </div>
            <svg className="chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                  <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.05)" />
              <path d={areaPath} className="chart-area" />
              <path d={chartPath} className="chart-line" />
            </svg>
            <div className="chart-labels">
              <span>50</span>
              <span>100</span>
              <span>200</span>
              <span>300</span>
              <span>400</span>
              <span>500</span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Session Section */}
      <h2 className="section-title">Current Session</h2>
      <div className="session-cards">
        {/* Ongoing Session Card */}
        <div className="ongoing-card">
          <div className="card-header">
            <h3 className="card-title">Ongoing Session</h3>
            <button className="menu-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="ongoing-content">
            <div className="progress-ring-container">
              <svg className="progress-ring" width="100" height="100">
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <circle
                  className="progress-ring-bg"
                  cx="50"
                  cy="50"
                  r={radius}
                />
                <circle
                  className="progress-ring-fill"
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <span className="progress-text">30%</span>
            </div>

            <div className="session-stats">
              <div className="stat-item">
                <span className="stat-dot"></span>
                <span>Points Scored</span>
              </div>
              <div className="stat-item">
                <span className="stat-dot yellow"></span>
                <span>Streaks - 8 | 13</span>
              </div>
              <p className="ray-time">Ray Time now 84:30</p>
            </div>
          </div>

          <button className="btn-session" style={{ marginTop: '1rem' }}>Go to Session</button>
        </div>

        {/* Next Session Card */}
        <div className="next-session-card">
          <div className="card-header">
            <h3 className="card-title">Next Session</h3>
            <button className="menu-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="next-session-content">
            <div className="next-info">
              <Calendar size={18} className="calendar-icon" />
              <span>Saturday, April 5 - 2025 1:20 PM</span>
            </div>
            <div className="completion-info">
              <span className="completion-dot"></span>
              <span>Average Completion = 60%</span>
            </div>
            <button className="btn-calendar">View Calendar</button>
          </div>
        </div>
      </div>

      {/* Recent Activities Section */}
      <div className="activities-header">
        <div className="activities-title-group">
          <h3 className="section-title">Recent Activities</h3>
          <p className="activities-subtitle">Recent Activities</p>
        </div>
        <button className="btn-delete">Delete All</button>
      </div>

      <div className="activities-grid">
        {activities.map((activity) => (
          <div key={activity.id} className={`activity-card ${activity.yellow ? 'yellow' : ''}`}>
            <div className="activity-header">
              <div className="activity-icon">
                <span></span>
                <span></span>
              </div>
              <h4 className="activity-title">{activity.title}</h4>
              <span className="activity-date">{activity.date}</span>
            </div>
            <div className="activity-desc">
              <span className="desc-icon"></span>
              <p>{activity.desc}</p>
            </div>
            <div className="activity-status">
              <span className="status-dot"></span>
              {activity.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
