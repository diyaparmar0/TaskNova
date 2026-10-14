
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

app.use(cors({
  origin: process.env.CLIENT_URL?.split(',') || '*',
  credentials: true
}));

app.use(express.json());

const q = (text, params = []) => pool.query(text, params);

const hash = (password) => bcrypt.hash(password, 10);

const tokenFor = (user) =>
  jwt.sign(
    {
      id: user.id,
      orgId: user.org_id,
      role: user.role,
      name: user.name,
      email: user.email
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '2h' }
  );

async function init() {
  await q(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      org_id INTEGER REFERENCES organizations(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity (
      id SERIAL PRIMARY KEY,
      org_id INTEGER REFERENCES organizations(id),
      user_id INTEGER REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const org = await q(
    'SELECT id FROM organizations LIMIT 1'
  );

  let orgId;

  if (org.rowCount === 0) {
    const createdOrg = await q(
      'INSERT INTO organizations(name) VALUES($1) RETURNING id',
      ['Nova Labs']
    );
    orgId = createdOrg.rows[0].id;
  } else {
    orgId = org.rows[0].id;
  }

  const existingUsers = await q(
    'SELECT id FROM users WHERE org_id = $1 LIMIT 1',
    [orgId]
  );

  if (existingUsers.rowCount === 0) {
    const demoPassword = await hash('Demo@123');

    await q(
      `INSERT INTO users(org_id, name, email, password, role)
       VALUES
       ($1, $2, $3, $4, $5),
       ($1, $6, $7, $4, $5),
       ($1, $8, $9, $4, $5)`,
      [
        orgId,
        'Alex Morgan',
        'demo@tasknova.app',
        demoPassword,
        'admin',
        'Sam Rivera',
        'sam@tasknova.app',
        'Mia Chen',
        'mia@tasknova.app'
      ]
    );
  }

  const users = await q(
    'SELECT id, name FROM users WHERE org_id = $1 ORDER BY id',
    [orgId]
  );

  const existingProjects = await q(
    'SELECT id FROM projects WHERE org_id = $1 LIMIT 1',
    [orgId]
  );

  if (existingProjects.rowCount === 0) {
    const project1 = await q(
      `INSERT INTO projects(org_id, name, description)
       VALUES($1, $2, $3) RETURNING id`,
      [orgId, 'Website Redesign', 'Refresh the company website']
    );

    const project2 = await q(
      `INSERT INTO projects(org_id, name, description)
       VALUES($1, $2, $3) RETURNING id`,
      [orgId, 'Mobile Experience', 'Improve the mobile application']
    );

    const user1 = users.rows[0]?.id || null;
    const user2 = users.rows[1]?.id || user1;

    await q(
      `INSERT INTO tasks
       (project_id, org_id, title, description, status, priority, assignee_id)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7),
       ($1, $2, $8, $9, $10, $11, $12),
       ($2, $2, $13, $14, $15, $16, $17),
       ($2, $2, $18, $19, $20, $21, $22)`,
      [
        project1.rows[0].id, orgId,
        'Create homepage wireframes', 'Prepare homepage design',
        'todo', 'high', user1,
        'Review design system', 'Check reusable UI components',
        'in_progress', 'medium', user2,
        'Build mobile navigation', 'Implement navigation menu',
        'todo', 'high', user1,
        'Test responsive screens', 'Verify screens on different devices',
        'done', 'low', user2
      ]
    );

    await q(
      `INSERT INTO activity(org_id, user_id, message)
       VALUES($1, $2, $3), ($1, $4, $5)`,
      [
        orgId, user1, 'created the Website Redesign project',
        user2, 'joined the TaskNova workspace'
      ]
    );
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET || 'dev-secret'
    );
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await q(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (
      result.rowCount === 0 ||
      !(await bcrypt.compare(password, result.rows[0].password))
    ) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    res.json({
      token: tokenFor(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.org_id
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const result = await q(
      `SELECT id, name, email, role, org_id
       FROM users WHERE id = $1 AND org_id = $2`,
      [req.user.id, req.user.orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not load user' });
  }
});

app.get('/api/summary', auth, async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const [projects, tasks, members] = await Promise.all([
      q('SELECT COUNT(*)::int AS count FROM projects WHERE org_id = $1', [orgId]),
      q('SELECT status, COUNT(*)::int AS count FROM tasks WHERE org_id = $1 GROUP BY status', [orgId]),
      q('SELECT COUNT(*)::int AS count FROM users WHERE org_id = $1', [orgId])
    ]);

    res.json({
      projects: projects.rows[0].count,
      members: members.rows[0].count,
      tasks: tasks.rows.reduce((sum, row) => sum + row.count, 0),
      taskStatuses: Object.fromEntries(
        tasks.rows.map(row => [row.status, row.count])
      )
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not load summary' });
  }
});

app.get('/api/projects', auth, async (req, res) => {
  try {
    const result = await q(
      `SELECT p.*, COUNT(t.id)::int AS task_count
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.org_id = $1
       GROUP BY p.id
       ORDER BY p.id DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load projects' });
  }
});

app.post('/api/projects', auth, async (req, res) => {
  try {
    const { name, description = '' } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await q(
      `INSERT INTO projects(org_id, name, description)
       VALUES($1, $2, $3) RETURNING *`,
      [req.user.orgId, name.trim(), description]
    );

    await q(
      'INSERT INTO activity(org_id, user_id, message) VALUES($1, $2, $3)',
      [req.user.orgId, req.user.id, `created project ${name.trim()}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not create project' });
  }
});

app.get('/api/users', auth, async (req, res) => {
  try {
    const result = await q(
      `SELECT id, name, email, role
       FROM users WHERE org_id = $1 ORDER BY id`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load users' });
  }
});

app.get('/api/tasks', auth, async (req, res) => {
  try {
    const result = await q(
      `SELECT t.*, p.name AS project_name, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.org_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load tasks' });
  }
});

app.post('/api/tasks', auth, async (req, res) => {
  try {
    const {
      title,
      description = '',
      project_id,
      status = 'todo',
      priority = 'medium',
      assignee_id = null,
      due_date = null
    } = req.body;

    if (!title?.trim() || !project_id) {
      return res.status(400).json({
        error: 'Task title and project are required'
      });
    }

    const project = await q(
      'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
      [project_id, req.user.orgId]
    );

    if (!project.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await q(
      `INSERT INTO tasks
       (project_id, org_id, title, description, status, priority, assignee_id, due_date)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        project_id, req.user.orgId, title.trim(), description,
        status, priority, assignee_id, due_date
      ]
    );

    await q(
      'INSERT INTO activity(org_id, user_id, message) VALUES($1, $2, $3)',
      [req.user.orgId, req.user.id, `created task ${title.trim()}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create task error:', error.message);
    res.status(500).json({ error: 'Could not create task' });
  }
});

app.patch('/api/tasks/:id', auth, async (req, res) => {
  try {
    const allowed = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'];
    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        values.push(req.body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No task fields provided' });
    }

    values.push(req.params.id, req.user.orgId);

    const result = await q(
      `UPDATE tasks SET ${fields.join(', ')}
       WHERE id = $${values.length - 1} AND org_id = $${values.length}
       RETURNING *`,
      values
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not update task' });
  }
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
  try {
    const result = await q(
      'DELETE FROM tasks WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.id, req.user.orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete task' });
  }
});

app.get('/api/activity', auth, async (req, res) => {
  try {
    const result = await q(
      `SELECT a.*, u.name AS user_name
       FROM activity a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.org_id = $1
       ORDER BY a.created_at DESC LIMIT 20`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load activity' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TaskNova API running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('TaskNova startup failed:', error);
    process.exit(1);
  });
