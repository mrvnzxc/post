const express = require('express');
const { Pool, types } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Load DATABASE_URL from .env when running locally (Vercel provides it as an environment variable)
try {
    process.loadEnvFile();
} catch {}

const app = express();
const PORT = process.env.PORT || 3000;

// Return DATE columns as 'YYYY-MM-DD' strings instead of timezone-shifted JS Dates
types.setTypeParser(types.builtins.DATE, (value) => value);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Postgres Connection Pool (via Supabase transaction pooler)
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env locally or to the Vercel project environment variables.');
}

// Supabase signs its pooler certificate with its own root CA, so trust that CA explicitly
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: fs.readFileSync(path.join(__dirname, 'supabase-ca.crt'), 'utf8') }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST endpoint to create ticket
app.post('/api/tickets', async (req, res) => {
    let client;

    try {
        const { project, ticket } = req.body;

        // Validate required fields
        if (!project || !ticket) {
            return res.status(400).json({
                success: false,
                message: 'Missing project or ticket data'
            });
        }

        client = await pool.connect();

        // Start transaction
        await client.query('BEGIN');

        // Insert Project (or get existing)
        const projectResult = await client.query(
            `INSERT INTO projects (name, url, api_url) VALUES ($1, $2, $3)
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [project.name, project.url, project.api_url]
        );
        const projectId = projectResult.rows[0].id;

        // Insert Ticket
        const ticketResult = await client.query(
            `INSERT INTO tickets (
                project_id, ticket_no, type, platform, module, submodule,
                date_detected, current_state, desired_state, purpose, status,
                remarks, page_url, reporter_name, reporter_role
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id`,
            [
                projectId,
                ticket.ticket_no,
                ticket.type,
                ticket.platform,
                ticket.module,
                ticket.submodule,
                ticket.date_detected,
                ticket.current_state,
                ticket.desired_state,
                ticket.purpose,
                ticket.status,
                ticket.remarks || null,
                ticket.page_url,
                ticket.reporter.name,
                ticket.reporter.role
            ]
        );

        const ticketId = ticketResult.rows[0].id;

        // Insert Evidence (if provided)
        if (ticket.evidence && ticket.evidence.length > 0) {
            for (const evidence of ticket.evidence) {
                await client.query(
                    `INSERT INTO evidence (ticket_id, name, size, uploaded_at, url)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        ticketId,
                        evidence.name,
                        evidence.size,
                        evidence.uploaded_at,
                        evidence.url
                    ]
                );
            }
        }

        // Commit transaction
        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            ticket_id: ticketId,
            project_id: projectId
        });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating ticket: ' + error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// GET endpoint to retrieve all tickets (bonus)
app.get('/api/tickets', async (req, res) => {
    let client;

    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        client = await pool.connect();

        // Get tickets with related data
        const { rows: tickets } = await client.query(
            `SELECT t.*, p.name as project_name, p.url as project_url, p.api_url
             FROM tickets t
             LEFT JOIN projects p ON t.project_id = p.id
             ORDER BY t.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        // Get total count
        const { rows: countResult } = await client.query(
            'SELECT COUNT(*)::int as total FROM tickets'
        );

        // Get evidence for each ticket
        const ticketsWithEvidence = await Promise.all(
            tickets.map(async (ticket) => {
                const { rows: evidence } = await client.query(
                    'SELECT name, size, uploaded_at, url FROM evidence WHERE ticket_id = $1',
                    [ticket.id]
                );

                return {
                    ...ticket,
                    evidence: evidence || []
                };
            })
        );

        res.json({
            project: {
                name: tickets[0]?.project_name || 'Unknown',
                url: tickets[0]?.project_url || '',
                api_url: tickets[0]?.api_url || ''
            },
            total: countResult[0].total,
            limit: limit,
            offset: offset,
            tickets: ticketsWithEvidence
        });

    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tickets: ' + error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// GET single ticket by ID
app.get('/api/tickets/:id', async (req, res) => {
    let client;

    try {
        if (!/^\d+$/.test(req.params.id)) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        client = await pool.connect();

        const { rows: tickets } = await client.query(
            `SELECT t.*, p.name as project_name, p.url as project_url, p.api_url
             FROM tickets t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.id = $1`,
            [req.params.id]
        );

        if (tickets.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        const ticket = tickets[0];

        // Get evidence
        const { rows: evidence } = await client.query(
            'SELECT name, size, uploaded_at, url FROM evidence WHERE ticket_id = $1',
            [ticket.id]
        );

        res.json({
            ...ticket,
            evidence: evidence || []
        });

    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ticket: ' + error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// PATCH endpoint to update a ticket's status
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

app.patch('/api/tickets/:id', async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        const { status } = req.body || {};

        if (!TICKET_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be one of: ' + TICKET_STATUSES.join(', ')
            });
        }

        const { rows } = await pool.query(
            `UPDATE tickets SET status = $1 WHERE id = $2
             RETURNING id, ticket_no, status, updated_at`,
            [status, req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        res.json({
            success: true,
            message: 'Status updated',
            ticket: rows[0]
        });

    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating ticket status: ' + error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running on port ' + PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   Ticket Management System Server              ║
║   Running on http://localhost:${PORT}           ║
║   Database: Supabase (PostgreSQL)              ║
╚════════════════════════════════════════════════╝

📝 API Endpoints:
   POST   /api/tickets        - Create a new ticket
   GET    /api/tickets        - Get all tickets
   GET    /api/tickets/:id    - Get single ticket
   PATCH  /api/tickets/:id    - Update ticket status
   GET    /api/health         - Health check
   GET    /                   - Web interface

🔗 Open http://localhost:${PORT} in your browser
    `);
});

// Error handling
process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
});
