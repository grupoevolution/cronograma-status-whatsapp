const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('cronograma.db');

// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS cronograma (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia INTEGER NOT NULL,
        horario TEXT NOT NULL,
        tipo_midia TEXT NOT NULL,
        url_midia TEXT,
        texto TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Constants
const WEBHOOK_URL = 'https://n8n.flowzap.fun/webhook/cronograma-status';
const INSTANCIAS = ['GABY01', 'GABY02', 'GABY03', 'GABY04', 'GABY05', 'GABY06', 'GABY07', 'GABY08', 'GABY09'];

// Helper function to get current cycle day (1-15)
function getCurrentCycleDay() {
    const now = new Date();
    const dayOfMonth = now.getDate();
    return ((dayOfMonth - 1) % 15) + 1;
}

// Helper function to send webhook
async function sendWebhook(data) {
    try {
        await axios.post(WEBHOOK_URL, data);
        console.log(`Webhook enviado: ${JSON.stringify(data)}`);
    } catch (error) {
        console.error('Erro ao enviar webhook:', error.message);
    }
}

// Function to process scheduled content
async function processScheduledContent() {
    const currentDay = getCurrentCycleDay();
    const currentTime = new Date().toTimeString().substring(0, 5); // HH:MM format
    
    db.all(
        "SELECT * FROM cronograma WHERE dia = ? AND horario = ?",
        [currentDay, currentTime],
        async (err, rows) => {
            if (err) {
                console.error('Erro na consulta:', err);
                return;
            }
            
            for (const row of rows) {
                // Send to all instances
                for (const instancia of INSTANCIAS) {
                    const webhookData = {
                        instancia: instancia,
                        tipo: row.tipo_midia,
                        url_midia: row.url_midia,
                        texto: row.texto
                    };
                    
                    await sendWebhook(webhookData);
                    
                    // If it's image+text or video+text, send text as separate status
                    if (row.tipo_midia === 'img_text' || row.tipo_midia === 'vid_text') {
                        setTimeout(async () => {
                            const textData = {
                                instancia: instancia,
                                tipo: 'texto',
                                url_midia: null,
                                texto: row.texto
                            };
                            await sendWebhook(textData);
                        }, 5000); // Wait 5 seconds between posts
                    }
                }
            }
        }
    );
}

// Cron job to run every minute
cron.schedule('* * * * *', () => {
    processScheduledContent();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all scheduled content
app.get('/api/cronograma', (req, res) => {
    db.all("SELECT * FROM cronograma ORDER BY dia, horario", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add new scheduled content
app.post('/api/cronograma', (req, res) => {
    const { dia, horario, tipo_midia, url_midia, texto } = req.body;
    
    if (!dia || !horario || !tipo_midia) {
        res.status(400).json({ error: 'Dia, horário e tipo de mídia são obrigatórios' });
        return;
    }
    
    db.run(
        "INSERT INTO cronograma (dia, horario, tipo_midia, url_midia, texto) VALUES (?, ?, ?, ?, ?)",
        [dia, horario, tipo_midia, url_midia, texto],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                id: this.lastID,
                message: 'Conteúdo agendado com sucesso!'
            });
        }
    );
});

// Delete scheduled content
app.delete('/api/cronograma/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM cronograma WHERE id = ?", [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Conteúdo removido com sucesso!' });
    });
});

// Update scheduled content
app.put('/api/cronograma/:id', (req, res) => {
    const { id } = req.params;
    const { dia, horario, tipo_midia, url_midia, texto } = req.body;
    
    db.run(
        "UPDATE cronograma SET dia = ?, horario = ?, tipo_midia = ?, url_midia = ?, texto = ? WHERE id = ?",
        [dia, horario, tipo_midia, url_midia, texto, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Conteúdo atualizado com sucesso!' });
        }
    );
});

// Get current cycle status
app.get('/api/status', (req, res) => {
    const currentDay = getCurrentCycleDay();
    const currentTime = new Date().toTimeString().substring(0, 5);
    
    res.json({
        dia_atual: currentDay,
        horario_atual: currentTime,
        instancias: INSTANCIAS
    });
});

// Manual trigger for testing
app.post('/api/trigger-test', async (req, res) => {
    const { dia, horario } = req.body;
    
    db.all(
        "SELECT * FROM cronograma WHERE dia = ? AND horario = ?",
        [dia, horario],
        async (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            let sent = 0;
            for (const row of rows) {
                for (const instancia of INSTANCIAS) {
                    const webhookData = {
                        instancia: instancia,
                        tipo: row.tipo_midia,
                        url_midia: row.url_midia,
                        texto: row.texto
                    };
                    
                    await sendWebhook(webhookData);
                    sent++;
                    
                    if (row.tipo_midia === 'img_text' || row.tipo_midia === 'vid_text') {
                        setTimeout(async () => {
                            const textData = {
                                instancia: instancia,
                                tipo: 'texto',
                                url_midia: null,
                                texto: row.texto
                            };
                            await sendWebhook(textData);
                        }, 5000);
                        sent++;
                    }
                }
            }
            
            res.json({ message: `${sent} webhooks enviados para teste` });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
