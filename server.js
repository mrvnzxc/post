const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// MySQL Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',           // Default XAMPP user
    password: '',           // Default XAMPP password (empty)
    database: 'post',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// POST endpoint to create ticket
app.post('/api/tickets', async (req, res) => {
    let connection;
    
    try {
        const { project, ticket } = req.body;
        
        // Validate required fields
        if (!project || !ticket) {
            return res.status(400).json({
                success: false,
                message: 'Missing project or ticket data'
            });
        }
        
        connection = await pool.getConnection();
        
        // Start transaction
        await connection.beginTransaction();
        
        // Insert Project (or get existing)
        const [projectRows] = await connection.query(
            `INSERT INTO projects (name, url, api_url) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [project.name, project.url, project.api_url]
        );
        const projectId = projectRows.insertId || projectRows[0]?.id;
        
        // Insert Ticket
        const [ticketResult] = await connection.query(
            `INSERT INTO tickets (
                project_id, ticket_no, type, platform, module, submodule,
                date_detected, current_state, desired_state, purpose, status,
                remarks, page_url, reporter_name, reporter_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        
        const ticketId = ticketResult.insertId;
        
        // Insert Evidence (if provided)
        if (ticket.evidence && ticket.evidence.length > 0) {
            for (const evidence of ticket.evidence) {
                await connection.query(
                    `INSERT INTO evidence (ticket_id, name, size, uploaded_at, url)
                     VALUES (?, ?, ?, ?, ?)`,
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
        await connection.commit();
        
        res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            ticket_id: ticketId,
            project_id: projectId
        });
        
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error creating ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating ticket: ' + error.message
        });
    } finally {
        if (connection) {
            await connection.releaseConnection();
        }
    }
});

// GET endpoint to retrieve all tickets (bonus)
app.get('/api/tickets', async (req, res) => {
    let connection;
    
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        connection = await pool.getConnection();
        
        // Get tickets with related data
        const [tickets] = await connection.query(
            `SELECT t.*, p.name as project_name, p.url as project_url, p.api_url
             FROM tickets t
             LEFT JOIN projects p ON t.project_id = p.id
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        
        // Get total count
        const [countResult] = await connection.query(
            'SELECT COUNT(*) as total FROM tickets'
        );
        
        // Get evidence for each ticket
        const ticketsWithEvidence = await Promise.all(
            tickets.map(async (ticket) => {
                const [evidence] = await connection.query(
                    'SELECT name, size, uploaded_at, url FROM evidence WHERE ticket_id = ?',
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
        if (connection) {
            await connection.releaseConnection();
        }
    }
});

// GET single ticket by ID
app.get('/api/tickets/:id', async (req, res) => {
    let connection;
    
    try {
        connection = await pool.getConnection();
        
        const [tickets] = await connection.query(
            `SELECT t.*, p.name as project_name, p.url as project_url, p.api_url
             FROM tickets t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.id = ?`,
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
        const [evidence] = await connection.query(
            'SELECT name, size, uploaded_at, url FROM evidence WHERE ticket_id = ?',
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
        if (connection) {
            await connection.releaseConnection();
        }
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
║   Database: MySQL (post) via XAMPP             ║
╚════════════════════════════════════════════════╝

📝 API Endpoints:
   POST   /api/tickets        - Create a new ticket
   GET    /api/tickets        - Get all tickets
   GET    /api/tickets/:id    - Get single ticket
   GET    /api/health         - Health check
   GET    /                   - Web interface

🔗 Open http://localhost:${PORT} in your browser
    `);
});

// Error handling
process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
});
