# Ticket Management System - Testing Environment

A complete web-based ticket management system with HTML/CSS/JavaScript frontend and Node.js backend for testing before deploying to production.

## 📋 Features

- ✅ HTML form with all data types from your API response
- ✅ CSS styling with modern UI/UX
- ✅ JavaScript form handling and validation
- ✅ Node.js/Express backend with MySQL integration
- ✅ POST endpoint for creating tickets
- ✅ GET endpoints for retrieving tickets
- ✅ CORS enabled for frontend-backend communication
- ✅ Transaction support for data consistency
- ✅ Evidence file tracking (multiple files per ticket)

## 📁 Project Structure

```
posttry/
├── index.html          # Web form interface
├── style.css           # CSS styling
├── script.js           # Frontend JavaScript
├── server.js           # Node.js backend
├── database.sql        # MySQL schema
├── package.json        # Project dependencies
└── README.md           # This file
```

## 🚀 Quick Start Setup

### 1. Database Setup

1. Open phpMyAdmin (http://localhost/phpmyadmin)
2. Click "New" or "Create new database"
3. Name it: `post`
4. Click create
5. Click on the new `post` database
6. Click the "SQL" tab
7. Copy and paste the contents of `database.sql`
8. Click "Go" or "Execute"

### 2. Backend Setup

1. Install Node.js from https://nodejs.org/ (if not already installed)
2. Open Command Prompt/PowerShell in the `posttry` folder
3. Run these commands:

```bash
npm install
npm start
```

You should see:
```
╔════════════════════════════════════════════════╗
║   Ticket Management System Server              ║
║   Running on http://localhost:3000             ║
║   Database: MySQL (post) via XAMPP             ║
╚════════════════════════════════════════════════╝
```

### 3. Access the Application

Open your browser and go to: **http://localhost:3000**

## 🛠️ API Endpoints

### Create a Ticket (POST)
```
POST http://localhost:3000/api/tickets
```

**Request Body:**
```json
{
    "project": {
        "name": "MoBilis",
        "url": "https://mobilis.brigada.net",
        "api_url": "https://api.mobilis.brigada.net"
    },
    "ticket": {
        "ticket_no": "TKT-2026-0001",
        "type": "bug",
        "platform": "MoBilis",
        "module": "Documents",
        "submodule": "documents routing",
        "date_detected": "2026-09-16",
        "current_state": "fix documents routing",
        "desired_state": "document routing",
        "purpose": "for proper documents routing etc etc",
        "status": "open",
        "remarks": null,
        "page_url": "https://mobilis.brigada.net/app/documents",
        "reporter": {
            "name": "Super Admin",
            "role": "admin"
        },
        "evidence": [
            {
                "name": "Screenshot 2026-09-16 140624.png",
                "size": 10115,
                "uploaded_at": "2026-09-16T06:06:40.534Z",
                "url": "https://api.mobilis.brigada.net/api/public/tickets/evidence/..."
            }
        ]
    }
}
```

### Get All Tickets (GET)
```
GET http://localhost:3000/api/tickets?limit=100&offset=0
```

### Get Single Ticket (GET)
```
GET http://localhost:3000/api/tickets/:id
```

### Health Check (GET)
```
GET http://localhost:3000/api/health
```

## 💾 Database Schema

### Projects Table
- `id` (Primary Key)
- `name` (Unique)
- `url`
- `api_url`
- `created_at`
- `updated_at`

### Tickets Table
- `id` (Primary Key)
- `project_id` (Foreign Key)
- `ticket_no` (Unique)
- `type` (ENUM: bug, feature, enhancement, documentation)
- `platform`
- `module`
- `submodule`
- `date_detected`
- `current_state` (Text)
- `desired_state` (Text)
- `purpose` (Text)
- `status` (ENUM: open, in_progress, resolved, closed)
- `remarks` (Optional Text)
- `page_url`
- `reporter_name`
- `reporter_role`
- `created_at`
- `updated_at`

### Evidence Table
- `id` (Primary Key)
- `ticket_id` (Foreign Key)
- `name`
- `size` (Bytes)
- `uploaded_at`
- `url`
- `created_at`

## 🔧 Supported Data Types

| Field | Type | Example |
|-------|------|---------|
| ticket_no | String | TKT-2026-0001 |
| type | Enum | bug, feature, enhancement, documentation |
| platform | String | MoBilis |
| module | String | Documents |
| date_detected | Date | 2026-09-16 |
| current_state | Text/Long Text | Description of issue |
| status | Enum | open, in_progress, resolved, closed |
| reporter | Object | { name: String, role: String } |
| evidence | Array | Array of file objects |
| remarks | String/Nullable | Optional notes |

## 🧪 Testing with cURL

Create a ticket:
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "name": "MoBilis",
      "url": "https://mobilis.brigada.net",
      "api_url": "https://api.mobilis.brigada.net"
    },
    "ticket": {
      "ticket_no": "TKT-2026-0002",
      "type": "bug",
      "platform": "MoBilis",
      "module": "Documents",
      "submodule": "documents routing",
      "date_detected": "2026-09-16",
      "current_state": "System routing issue",
      "desired_state": "Proper routing",
      "purpose": "Testing",
      "status": "open",
      "remarks": null,
      "page_url": "https://mobilis.brigada.net/app/documents",
      "reporter": {
        "name": "Test User",
        "role": "admin"
      },
      "evidence": []
    }
  }'
```

Retrieve all tickets:
```bash
curl http://localhost:3000/api/tickets
```

## 📝 Notes for Production Deployment

When deploying to production:

1. **Change MySQL credentials** in `server.js` to use actual user/password
2. **Update frontend URL** in `script.js` from `localhost:3000` to your production endpoint
3. **Add authentication** (JWT, API keys)
4. **Enable HTTPS** (SSL certificates)
5. **Add validation** and sanitization
6. **Implement rate limiting**
7. **Add error logging and monitoring**
8. **Use environment variables** for sensitive config
9. **Add API documentation** (Swagger/OpenAPI)
10. **Implement pagination** for large datasets

## 🐛 Troubleshooting

### "Cannot connect to database"
- Make sure XAMPP MySQL is running
- Check MySQL port (default 3306)
- Verify database `post` exists

### "Port 3000 already in use"
- Change port in `server.js` and `script.js`
- Or kill the process using port 3000

### "CORS error"
- Ensure `cors` package is installed
- Check that frontend and backend URLs are correct

### Form not submitting
- Open browser console (F12)
- Check for JavaScript errors
- Verify server is running
- Check Network tab in DevTools

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Node.js mysql2 Package](https://github.com/sidorares/node-mysql2)
- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 📄 License

This is a testing/development project for MoBilis Ticket System.
