// server.js
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // your MySQL username
    password: 'Ammar@2716', // your MySQL password
    database: 'exam'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// User registration
app.post('/api/register', async (req, res) => {
    const { username, email, password, role } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        
        db.execute(query, [username, email, hashedPassword, role || 'student'], (err, results) => {
            if (err) {
                return res.status(400).json({ error: 'User already exists' });
            }
            res.status(201).json({ message: 'User created successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM users WHERE username = ?';
    db.execute(query, [username], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: { id: user.id, username: user.username, role: user.role } 
        });
    });
});

// Get all quizzes
app.get('/api/quizzes', authenticateToken, (req, res) => {
    const query = 'SELECT * FROM quizzes';
    db.execute(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get quiz questions
app.get('/api/quizzes/:id/questions', authenticateToken, (req, res) => {
    const quizId = req.params.id;
    const query = 'SELECT id, question_text, option_a, option_b, option_c, option_d, points FROM questions WHERE quiz_id = ?';
    
    db.execute(query, [quizId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Submit quiz results
app.post('/api/results', authenticateToken, (req, res) => {
    const { quiz_id, score, total_questions, time_taken } = req.body;
    const user_id = req.user.id;
    
    const query = 'INSERT INTO results (user_id, quiz_id, score, total_questions, time_taken) VALUES (?, ?, ?, ?, ?)';
    
    db.execute(query, [user_id, quiz_id, score, total_questions, time_taken], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Results saved successfully', result_id: results.insertId });
    });
});

// Get user results
app.get('/api/results', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    const query = `
        SELECT r.*, q.title 
        FROM results r 
        JOIN quizzes q ON r.quiz_id = q.id 
        WHERE r.user_id = ? 
        ORDER BY r.completed_at DESC
    `;
    
    db.execute(query, [user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Admin routes - Add quiz
app.post('/api/admin/quizzes', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, description, category, time_limit } = req.body;
    const created_by = req.user.id;
    
    const query = 'INSERT INTO quizzes (title, description, category, time_limit, created_by) VALUES (?, ?, ?, ?, ?)';
    
    db.execute(query, [title, description, category, time_limit, created_by], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Quiz created successfully', quiz_id: results.insertId });
    });
});

// Admin routes - Add question
app.post('/api/admin/questions', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, points } = req.body;
    
    const query = 'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    db.execute(query, [quiz_id, question_text, option_a, option_b, option_c, option_d, correct_answer, points], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Question added successfully' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});