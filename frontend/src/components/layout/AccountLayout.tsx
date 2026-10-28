import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  LogOut,
  LayoutDashboard,
  Layers,
  Target,
  Route,
  CalendarDays,
  BookOpen,
  MessageCircle,
  Award,
  Bell,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/auth.client';
import { requestError } from '@/lib/http';

const navItems = [
  ['/dashboard', 'Overview', LayoutDashboard],
  ['/skills', 'My skills', Layers],
  ['/goals', 'My goals', Target],
  ['/roadmap', 'Roadmap', Route],
  ['/plan', 'Weekly plan', CalendarDays],
  ['/progress', 'Learning logs', BookOpen],
  ['/mentor', 'Mentor', MessageCircle],
  ['/certificates', 'Certificates', Award],
  ['/notifications', 'Notifications', Bell],
] as const;

export function AccountLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  async function logout() {
    setPending(true);
    setFailure('');
    try {
      await signOut();
    } catch (error) {
      setFailure(requestError(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className={`site-header account-header ${menuOpen ? 'menu-open' : ''}`}>
        <Link to="/" className="brand">
          <motion.span
            className="brand-mark"
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <ArrowUpRight size={20} />
          </motion.span>
          linkup<span className="brand-period">.</span>
        </Link>
        <Button
          className="mobile-menu-toggle"
          variant="outline"
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />} {menuOpen ? 'Close' : 'Menu'}
        </Button>
        <nav
          id="workspace-navigation"
          aria-label="Your workspace"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false);
          }}
        >
          <p className="nav-label">WORKSPACE</p>
          {navItems.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}>
              {({ isActive }) => (
                <motion.span
                  className="flex items-center gap-[13px] w-full"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                  {isActive && (
                    <motion.span
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-[#438b65]"
                      layoutId="nav-indicator"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>
        <motion.div
          className="sidebar-note"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="sidebar-note-icon">
            <Sparkles size={24} className="text-[#6f8a58]" />
          </span>
          <strong>Small steps. Real progress.</strong>
          <p>Your next chapter starts with a little time each week.</p>
        </motion.div>
        <Button variant="outline" onClick={() => void logout()} disabled={pending}>
          <LogOut size={15} aria-hidden="true" />
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
      </header>
      <div className="workspace-content" id="workspace-main" tabIndex={-1}>
        <div className="workspace-topbar">
          <span>Your learning workspace</span>
          <motion.span
            className="workspace-status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span />
            Learning, at your pace
          </motion.span>
        </div>
        <AnimatePresence mode="wait">
          {failure && (
            <motion.p
              className="form-error"
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {failure}
            </motion.p>
          )}
        </AnimatePresence>
        {children}
      </div>
    </div>
  );
}
