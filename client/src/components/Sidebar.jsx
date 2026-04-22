import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Calendar, History, HelpCircle, MessageSquare, Trophy, LogOut, LayoutDashboard, Brain, FileText, Menu, Megaphone, Code } from "lucide-react";
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../context/ConfirmContext';
import "./Sidebar.css";

const menuItems = [
  { name: "Students", path: "/students", icon: <Users size={20} />, mentorOnly: true },
  { name: "Calendar", path: "/calendar", icon: <Calendar size={20} />, mentorOnly: true },
  { name: "History", path: "/history", icon: <History size={20} />, mentorOnly: true },
  { name: "Questions", path: "/questions", icon: <HelpCircle size={20} />, mentorOnly: true },
  { name: "Workshops", path: "/workshops", icon: <Code size={20} /> },
  { name: "Announcements", path: "/announcements", icon: <Megaphone size={20} /> },
  { name: "Performance Reports", path: "/student-reports", icon: <FileText size={20} />, studentOnly: true },
  { name: "AI Practice Mode", path: "/practice", icon: <Brain size={20} />, studentOnly: true },
  { name: "Discord", path: "https://discord.com", icon: <MessageSquare size={20} />, external: true },
  { name: "Leader Board", path: "/leaderboard", icon: <Trophy size={20} /> },
];


export default function Sidebar({ isOpen, onClose }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { confirm } = useConfirm();

  const isStudent = user?.role === 'student';

  const filteredMenuItems = menuItems.filter(item => {
    if (item.mentorOnly && isStudent) return false;
    if (item.studentOnly && !isStudent) return false;
    return true;
  });

  const isActive = (path) => {
    if (path === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(path);
  };

  const handleExternalClick = async (e, path, name) => {
    if (name === "Discord") {
      e.preventDefault();
      const confirmLeave = await confirm("Do you want to go to Discord?");
      if (confirmLeave) {
        window.open(path, "_blank");
      }
    }
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-top">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="logo-container">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="sidebar-avatar" />
            ) : (
              <img
                src={`https://ui-avatars.com/api/?name=${user?.username || 'PLD'}&background=ef4444&color=fff&rounded=true&bold=true`}
                alt="Avatar"
                className="sidebar-avatar"
              />
            )}
          </div>
          <span className="logo-text">{isStudent ? 'PLD Student' : 'PLD Mentor'}</span>
        </div>

        <ul className="menu">
          {filteredMenuItems.map((item) => (
            <li key={item.name}>
              {item.external ? (
                <a
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-item"
                  onClick={(e) => handleExternalClick(e, item.path, item.name)}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="sidebar-menu-text">{item.name}</span>
                </a>
              ) : (
                <Link
                  to={item.path}
                  className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) {
                      onClose();
                    }
                  }}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="sidebar-menu-text">{item.name}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="sidebar-bottom">
          <button className="btn-logout" onClick={logout}>
            <span className="icon"><LogOut size={20} /></span>
            <span className="sidebar-menu-text">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

