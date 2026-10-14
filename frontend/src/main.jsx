
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Users,
  Activity,
  Plus,
  Search,
  LogOut,
  ChevronDown,
  Clock3,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  X,
  ArrowUpRight
} from 'lucide-react';
import './styles.css';

const API = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');

async function api(path, opts = {}) {
  const token = localStorage.getItem('tasknova_token');

  let res;

  try {
    res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch {
    throw new Error(
      'Cannot connect to the server. Make sure the backend is running on port 5000.'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${res.status})`
    );
  }

  return data;
}

const initials = (name) =>
  name?.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase() || '?';

function Login({ onLogin }) {
  const [email, setEmail] = useState('demo@tasknova.app');
  const [password, setPassword] = useState('Demo@123');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('tasknova_token', data.token);
      onLogin(data.user);
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="brand">
          <span className="logo-mark">F</span>
          <b>TaskNova</b>
        </div>

        <div className="art-copy">
          <span className="eyebrow">TEAM OPERATING SYSTEM</span>
          <h1>Turn work into <span>momentum.</span></h1>
          <p>
            A focused workspace for teams to plan projects, assign work
            and see progress without the noise.
          </p>

          <div className="mini-stats">
            <div><b>94%</b><span>on track</span></div>
            <div><b>24h</b><span>avg. response</span></div>
            <div><b>3.8x</b><span>faster handoffs</span></div>
          </div>
        </div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand">
          <span className="logo-mark">F</span>
          <b>TaskNova</b>
        </div>

        <span className="eyebrow">WELCOME BACK</span>
        <h2>Sign in to your workspace</h2>
        <p className="muted">Use the demo account to explore the full product.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {err && (
          <div className="error">
            <AlertCircle size={16} />
            {err}
          </div>
        )}

        <button className="primary full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-box">
          <span>Demo account</span>
          <b>demo@tasknova.app</b>
          <small>Password: Demo@123</small>
        </div>
      </form>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('tasknova_token');

    if (token) {
      api('/me')
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('tasknova_token');
        });
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, page]);

  async function refresh() {
    try {
      const [s, p, t, m, a] = await Promise.all([
        api('/summary'),
        api('/projects'),
        api('/tasks'),
        api('/users'),
        api('/activity')
      ]);

      setSummary(s);
      setProjects(p);
      setTasks(t);
      setMembers(m);
      setActivity(a);
    } catch (error) {
      if (/session|token|unauthorized/i.test(error.message)) {
        logout();
      } else {
        notify(error.message);
      }
    }
  }

  function logout() {
    localStorage.removeItem('tasknova_token');
    setUser(null);
    setSummary(null);
    setProjects([]);
    setTasks([]);
    setMembers([]);
    setActivity([]);
  }

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  }

  async function addProject(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    try {
      await api('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          color: form.get('color')
        })
      });

      setModal(null);
      await refresh();
      notify('Project created');
    } catch (error) {
      notify(error.message);
    }
  }

  // FIX: Use the exact field names expected by the backend.
  async function addTask(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const projectId = form.get('projectId');
    const title = form.get('title')?.toString().trim();

    if (!projectId) {
      notify('Please create or select a project first.');
      return;
    }

    if (!title) {
      notify('Please enter a task title.');
      return;
    }

    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          title,
          description: form.get('description') || '',
          priority: form.get('priority') || 'medium',
          assignee_id: form.get('assigneeId') || null,
          due_date: form.get('dueDate') || null
        })
      });

      setModal(null);
      await refresh();
      notify('Task created');
    } catch (error) {
      notify(error.message);
    }
  }

  async function changeStatus(id, status) {
    try {
      await api(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await refresh();
      notify('Task updated');
    } catch (error) {
      notify(error.message);
    }
  }

  async function delTask(id) {
    if (!window.confirm('Delete this task?')) return;

    try {
      await api(`/tasks/${id}`, { method: 'DELETE' });
      await refresh();
      notify('Task deleted');
    } catch (error) {
      notify(error.message);
    }
  }

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === 'all' || task.status === filter) &&
          `${task.title} ${task.project_name} ${task.assignee_name || ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [tasks, filter, query]
  );

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span className="logo-mark">F</span>
          <b>TaskNova</b>
        </div>

        <div className="workspace">
          <div className="workspace-icon">N</div>
          <div><b>Nova Labs</b><span>Workspace</span></div>
          <ChevronDown size={15} />
        </div>

        <nav>
          <span className="nav-label">WORKSPACE</span>
          <Nav active={page === 'overview'} icon={<LayoutDashboard />}
            text="Overview" onClick={() => setPage('overview')} />
          <Nav active={page === 'tasks'} icon={<CheckSquare />}
            text="Tasks" badge={summary?.tasks?.total}
            onClick={() => setPage('tasks')} />
          <Nav active={page === 'projects'} icon={<FolderKanban />}
            text="Projects" onClick={() => setPage('projects')} />
          <Nav active={page === 'team'} icon={<Users />}
            text="Team" onClick={() => setPage('team')} />

          <span className="nav-label">INSIGHTS</span>
          <Nav active={page === 'activity'} icon={<Activity />}
            text="Activity" onClick={() => setPage('activity')} />
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">{initials(user.name)}</div>
            <div><b>{user.name}</b><span>{user.role}</span></div>
            <button className="icon-btn" onClick={logout} title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="eyebrow">NOVA LABS / {page.toUpperCase()}</span>
            <h1>
              {page === 'overview'
                ? `Good morning, ${user.name?.split(' ')[0] || 'there'}.`
                : page[0].toUpperCase() + page.slice(1)}
            </h1>
          </div>

          <div className="header-actions">
            <div className="search">
              <Search size={17} />
              <input
                placeholder="Search tasks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>

            <button className="primary" onClick={() => {
              if (!projects.length) {
                notify('Create a project before adding a task.');
                setPage('projects');
                setModal('project');
              } else {
                setModal('task');
              }
            }}>
              <Plus size={17} /> New task
            </button>
          </div>
        </header>

        {page === 'overview' && (
          <Overview summary={summary} projects={projects} tasks={tasks}
            activity={activity} setPage={setPage} changeStatus={changeStatus} />
        )}

        {page === 'tasks' && (
          <Tasks tasks={filtered} filter={filter} setFilter={setFilter}
            changeStatus={changeStatus} delTask={delTask} />
        )}

        {page === 'projects' && (
          <Projects projects={projects} onAdd={() => setModal('project')} />
        )}

        {page === 'team' && <Team members={members} />}

        {page === 'activity' && <ActivityPage activity={activity} />}
      </main>

      {modal === 'task' && (
        <Modal title="Create a task" onClose={() => setModal(null)}>
          <form className="form" onSubmit={addTask}>
            <label>
              Task title
              <input name="title" placeholder="e.g. Review onboarding copy" required />
            </label>

            <label>
              Project
              <select name="projectId" required defaultValue="">
                <option value="" disabled>Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="two">
              <label>
                Priority
                <select name="priority" defaultValue="medium">
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label>
                Assignee
                <select name="assigneeId" defaultValue="">
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Due date
              <input name="dueDate" type="date" />
            </label>

            <label>
              Description
              <textarea name="description" rows="4"
                placeholder="What needs to be done?" />
            </label>

            <button className="primary full" disabled={!projects.length}>
              Create task
            </button>
          </form>
        </Modal>
      )}

      {modal === 'project' && (
        <Modal title="Create a project" onClose={() => setModal(null)}>
          <form className="form" onSubmit={addProject}>
            <label>
              Project name
              <input name="name" placeholder="e.g. Product Launch" required />
            </label>

            <label>
              Description
              <textarea name="description" rows="4"
                placeholder="What is this project about?" />
            </label>

            <label>
              Accent color
              <input name="color" type="color" defaultValue="#7c5cff" />
            </label>

            <button className="primary full">Create project</button>
          </form>
        </Modal>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Nav({ icon, text, badge, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {React.cloneElement(icon, { size: 18 })}
      <span>{text}</span>
      {badge != null && <em>{badge}</em>}
    </button>
  );
}

function Overview({ summary, projects, tasks, activity, setPage, changeStatus }) {
  if (!summary) return <div className="loading">Loading workspace…</div>;

  const total = summary.tasks?.total || 0;
  const done = summary.tasks?.done || 0;
  const progress = summary.tasks?.progress || 0;

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">TODAY · OCT 14, 2026</span>
          <h2>Keep the team moving.</h2>
          <p>Here’s what needs your attention across Nova Labs.</p>
        </div>

        <div className="hero-progress">
          <div><b>{total ? Math.round(done / total * 100) : 0}%</b><span>completed</span></div>
          <div className="ring"><span>{done}</span><small>/ {total}</small></div>
        </div>
      </section>

      <div className="metrics">
        <Metric label="Total tasks" value={total}
          sub={`${progress} in progress`} icon={<CheckSquare />} />
        <Metric label="Active projects" value={summary.projects}
          sub="Across workspace" icon={<FolderKanban />} />
        <Metric label="Team members" value={summary.users}
          sub="Collaborating" icon={<Users />} />
        <Metric label="Due today" value={summary.dueToday}
          sub="Needs attention" icon={<Clock3 />} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <div><h3>My work</h3><p>Recent tasks across your projects</p></div>
            <button className="text-btn" onClick={() => setPage('tasks')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="task-list">
            {tasks.slice(0, 5).map((task) => (
              <TaskRow key={task.id} t={task} changeStatus={changeStatus} />
            ))}
            {!tasks.length && <div className="empty">No tasks yet.</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h3>Projects</h3><p>Progress at a glance</p></div>
            <button className="text-btn" onClick={() => setPage('projects')}>
              All projects <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="project-list">
            {projects.slice(0, 4).map((project) => {
              const percent = project.task_count
                ? Math.round(project.done_count / project.task_count * 100)
                : 0;

              return (
                <div className="project-row" key={project.id}>
                  <span className="dot" style={{ background: project.color }} />
                  <div><b>{project.name}</b><small>{project.task_count} tasks</small></div>
                  <div className="bar">
                    <i style={{ width: `${percent}%`, background: project.color }} />
                  </div>
                  <strong>{percent}%</strong>
                </div>
              );
            })}
            {!projects.length && <div className="empty">No projects yet.</div>}
          </div>
        </section>
      </div>

      <section className="panel activity-panel">
        <div className="panel-head">
          <div><h3>Recent activity</h3><p>Latest changes in your workspace</p></div>
          <button className="text-btn" onClick={() => setPage('activity')}>
            View activity <ArrowUpRight size={14} />
          </button>
        </div>
        <ActivityList items={activity.slice(0, 5)} />
      </section>
    </>
  );
}

function Metric({ label, value, sub, icon }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><b>{value ?? 0}</b><small>{sub}</small></div>
    </div>
  );
}

function TaskRow({ t, changeStatus }) {
  return (
    <div className="task-row">
      <button
        className={`check ${t.status}`}
        onClick={() => changeStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
        title="Toggle completion"
      >
        {t.status === 'done' ? <CheckCircle2 size={18} /> : <span />}
      </button>

      <div className="task-main">
        <b className={t.status === 'done' ? 'strike' : ''}>{t.title}</b>
        <span><i style={{ background: t.project_color }} />
          {t.project_name} · {t.assignee_name || 'Unassigned'}
        </span>
      </div>

      <Priority p={t.priority} />
      <span className={`status ${t.status}`}>{t.status.replace('-', ' ')}</span>
    </div>
  );
}

function Priority({ p }) {
  return <span className={`priority ${p}`}>{p}</span>;
}

function Tasks({ tasks, filter, setFilter, changeStatus, delTask }) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div><h3>All tasks</h3><p>Manage work across every project.</p></div>
        <div className="filters">
          {['all', 'todo', 'in-progress', 'done'].map((value) => (
            <button
              className={filter === value ? 'selected' : ''}
              onClick={() => setFilter(value)}
              key={value}
            >
              {value === 'all' ? 'All' : value.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="table">
        <div className="table-head">
          <span>Task</span><span>Project</span><span>Assignee</span>
          <span>Priority</span><span>Status</span><span />
        </div>

        {tasks.map((task) => (
          <div className="table-row" key={task.id}>
            <div className="task-cell">
              <button
                className={`check ${task.status}`}
                onClick={() => changeStatus(
                  task.id, task.status === 'done' ? 'todo' : 'done'
                )}
              >
                {task.status === 'done' ? <CheckCircle2 size={17} /> : <span />}
              </button>
              <b className={task.status === 'done' ? 'strike' : ''}>{task.title}</b>
            </div>

            <span><i className="tiny-dot" style={{ background: task.project_color }} />
              {task.project_name}
            </span>
            <span>{task.assignee_name || '—'}</span>
            <Priority p={task.priority} />

            <select
              value={task.status}
              onChange={(e) => changeStatus(task.id, e.target.value)}
              aria-label={`Status for ${task.title}`}
            >
              <option value="todo">Todo</option>
              <option value="in-progress">In progress</option>
              <option value="done">Done</option>
            </select>

            <button className="icon-btn danger" onClick={() => delTask(task.id)}
              title="Delete task">
              <MoreHorizontal size={17} />
            </button>
          </div>
        ))}

        {!tasks.length && <div className="empty">No tasks match your filters.</div>}
      </div>
    </section>
  );
}

function Projects({ projects, onAdd }) {
  return (
    <section className="cards-page">
      <div className="project-cards">
        {projects.map((project) => {
          const percent = project.task_count
            ? Math.round(project.done_count / project.task_count * 100)
            : 0;

          return (
            <div className="project-card" key={project.id}>
              <div className="project-top">
                <span className="project-symbol" style={{ background: project.color }}>
                  <FolderKanban size={20} />
                </span>
                <span className="pill">{project.status}</span>
              </div>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <div className="project-meta">
                <span>{project.done_count}/{project.task_count} tasks complete</span>
                <b>{percent}%</b>
              </div>
              <div className="bar big">
                <i style={{ width: `${percent}%`, background: project.color }} />
              </div>
            </div>
          );
        })}

        <button type="button" className="project-card add-card" onClick={onAdd}>
          <Plus size={26} />
          <b>New project</b>
          <span>Create a workspace project.</span>
        </button>
      </div>
    </section>
  );
}

function Team({ members }) {
  return (
    <section className="cards-page">
      <div className="team-grid">
        {members.map((member) => (
          <div className="member-card" key={member.id}>
            <div className="avatar large">{member.avatar || initials(member.name)}</div>
            <div><h3>{member.name}</h3><p>{member.email}</p></div>
            <span className="role-pill">{member.role}</span>
            <div className="member-line"><span>Workspace access</span><b>Active</b></div>
          </div>
        ))}
        {!members.length && <div className="empty">No team members found.</div>}
      </div>
    </section>
  );
}

function ActivityPage({ activity }) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div><h3>Workspace activity</h3><p>A chronological feed of important changes.</p></div>
      </div>
      <ActivityList items={activity} />
    </section>
  );
}

function ActivityList({ items }) {
  return (
    <div className="activity-list">
      {items.map((item) => (
        <div className="activity-item" key={item.id}>
          <div className="avatar small">
            {item.user_avatar || initials(item.user_name)}
          </div>
          <div>
            <b>{item.user_name}</b> <span>{item.message}</span>
            <small>
              {new Date(item.created_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </small>
          </div>
        </div>
      ))}
      {!items.length && <div className="empty">No recent activity.</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
