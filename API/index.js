const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let mensagensPorContato = {};
let mensagensNaoLidas = {};
const mensagensProcessadas = new Set();
let waitingContacts = [];
let attendingContacts = [];

// Funções para persistência dos dados
const salvarDados = () => {
    const dados = {
        mensagensPorContato,
        mensagensNaoLidas,
        waitingContacts,
        attendingContacts
    };
    fs.writeFileSync('dados.json', JSON.stringify(dados, null, 2));
};

const carregarDados = () => {
    if (fs.existsSync('dados.json')) {
        const dados = JSON.parse(fs.readFileSync('dados.json'));
        mensagensPorContato = dados.mensagensPorContato || {};
        mensagensNaoLidas = dados.mensagensNaoLidas || {};
        waitingContacts = dados.waitingContacts || [];
        attendingContacts = dados.attendingContacts || [];
    }
};

carregarDados();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

let sock;
let qrCode = null;

async function getContactInfo(id, pushName = null) {
    try {
        const profilePicUrl = await sock.profilePictureUrl(id, 'image').catch(() => null);
        return {
            nome: pushName || id,
            foto: profilePicUrl || "default.png"
        };
    } catch (error) {
        console.error("Erro ao buscar informações do contato:", error);
        return { nome: id, foto: "default.png" };
    }
}

async function salvarOuAtualizarContato({ id, nome, foto }) {
    try {
        const numero = id.replace(/@s\.whatsapp\.net$/, '');

        const existente = await prisma.contato.findUnique({
            where: { numero }
        });

        if (existente) {
            await prisma.contato.update({
                where: { numero },
                data: { nome, foto }
            });
        } else {
            await prisma.contato.create({
                data: {
                    numero,
                    nome,
                    foto
                }
            });
        }
    } catch (error) {
        console.error("Erro ao salvar contato:", error);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    sock = makeWASocket({ auth: state });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            qrCode = qr;
            io.emit('qrCode', qr);
            fs.writeFileSync(path.join(__dirname, 'qr_code.txt'), qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
            else {
                sock = null;
                io.emit('status', 'DISCONNECTED');
            }
        } else if (connection === 'open') {
            io.emit('status', { status: 'CONNECTED', number: sock.user.id });
            qrCode = null;
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const message = msg.messages[0];

            // Ignorar grupos, status, chamadas, e mensagens de broadcast
            if (
                message.key.fromMe ||
                message.key.remoteJid.includes('@g.us') || // grupo
                message.key.remoteJid === 'status@broadcast' || // status
                message.key.remoteJid.endsWith('@broadcast') || // outros broadcasts
                !message.message // mensagens vazias (chamadas geralmente são assim)
            ) return;

            const msgId = message.key.id;
            if (mensagensProcessadas.has(msgId)) return;
            mensagensProcessadas.add(msgId);

            const sender = message.key.remoteJid;
            const contactInfo = await getContactInfo(sender);
            await salvarOuAtualizarContato({ id: sender, nome: contactInfo.nome, foto: contactInfo.foto });
            const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!mensagensPorContato[sender]) mensagensPorContato[sender] = [];

            function extrairTexto(msg) {
                if (!msg.message) return "(sem texto)";
                if (msg.message.conversation) return msg.message.conversation;
                if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
                if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
                if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
                if (msg.message.buttonsResponseMessage?.selectedButtonId) return `[Botão] ${msg.message.buttonsResponseMessage.selectedButtonId}`;
                if (msg.message.listResponseMessage?.title) return `[Lista] ${msg.message.listResponseMessage.title}`;
                if (msg.message.templateButtonReplyMessage?.selectedId) return `[Template] ${msg.message.templateButtonReplyMessage.selectedId}`;
                return "(sem texto)";
            }

            const novaMensagem = {
                texto: extrairTexto(message),
                tipo: "recebida",
                hora,
            };

            mensagensPorContato[sender].push(novaMensagem);

            if (!mensagensNaoLidas[sender]) mensagensNaoLidas[sender] = 0;
            mensagensNaoLidas[sender]++;

            function limparNome(jid) {
                return jid.replace(/@s\.whatsapp\.net$/, '');
            }

            function limparNumero(jid) {
                return jid.replace(/@s\.whatsapp\.net$/, '');
            }

            const novoContato = {
                id: sender,
                nome: limparNome(sender),
                foto: contactInfo.foto,
                hora,
                numero: limparNumero(sender),
                naoLidas: mensagensNaoLidas[sender],
            };

            const indexAguardando = waitingContacts.findIndex(c => c.id === sender);
            const indexAtendendo = attendingContacts.findIndex(c => c.id === sender);

            // if (indexAtendendo !== -1) {
            //     attendingContacts[indexAtendendo] = novoContato;
            // } else if (indexAguardando !== -1) {
            //     waitingContacts[indexAguardando] = novoContato;
            // } else {
            //     waitingContacts.push(novoContato);
            // }

            if (indexAtendendo !== -1) {
                attendingContacts[indexAtendendo] = novoContato;
            
                // REMOVER DO AGUARDANDO
                waitingContacts = waitingContacts.filter(c => c.id !== sender);
            
            } else if (indexAguardando !== -1) {
                waitingContacts[indexAguardando] = novoContato;
            
            } else {
                waitingContacts.push(novoContato);
            }            

            io.emit("newMessage", novoContato);
            io.emit("novaMensagem", {
                contato: sender,
                mensagem: novaMensagem
            });

            salvarDados();

        } catch (error) {
            console.error("Erro ao processar mensagem:", error);
        }
    });
}

connectToWhatsApp();

app.get('/generate-qr', (req, res) => {
    const qrPath = path.join(__dirname, 'qr_code.txt');
    if (fs.existsSync(qrPath)) {
        const qr = fs.readFileSync(qrPath, 'utf-8');
        res.json({ qr });
    } else {
        res.status(404).json({ error: 'QR Code não disponível' });
    }
});

app.get('/contacts', (req, res) => {
    res.json({ waiting: waitingContacts, attending: attendingContacts });
});

app.get('/status', (req, res) => {
    if (sock?.user?.id) {
        res.json({ connected: true, phoneNumber: sock.user.id });
    } else {
        res.json({ connected: false });
    }
});

app.post('/attend-contact', (req, res) => {
    const { id } = req.body;
    const index = waitingContacts.findIndex(c => c.id === id);
    if (index !== -1) {
        const contact = waitingContacts.splice(index, 1)[0];
        attendingContacts.push(contact);
        io.emit("updateContacts", { waiting: waitingContacts, attending: attendingContacts });
        salvarDados();
        return res.json({ success: true });
    }
    res.status(400).json({ error: "Contato não encontrado" });
});

app.post("/finish-contact", (req, res) => {
    const { id } = req.body;
    const index = attendingContacts.findIndex(c => c.id === id);
    if (index !== -1) {
        attendingContacts.splice(index, 1);
        io.emit("updateContacts", { waiting: waitingContacts, attending: attendingContacts });
        salvarDados();
    }
    res.sendStatus(200);
});

app.get("/messages/:numero", (req, res) => {
    const numero = req.params.numero;
    const mensagens = mensagensPorContato[numero] || [];
    mensagensNaoLidas[numero] = 0;
    salvarDados();
    res.json(mensagens);
});

app.post("/send-message", async (req, res) => {
    const { numero, texto } = req.body;
    if (!numero || !texto) {
        return res.status(400).json({ error: "Número e texto são obrigatórios." });
    }

    try {
        await sock.sendMessage(numero, { text: texto });
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (!mensagensPorContato[numero]) mensagensPorContato[numero] = [];

        const novaMensagem = {
            texto,
            tipo: "enviada",
            hora
        };

        mensagensPorContato[numero].push(novaMensagem);
        io.emit("novaMensagem", { contato: numero, mensagem: novaMensagem });
        salvarDados();

        res.sendStatus(200);
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ error: "Erro ao enviar mensagem." });
    }
});

app.get('/contatos', async (req, res) => {

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    try {
        const contatos = await prisma.contato.findMany({
            skip,
            take: limit,
            orderBy: { atualizadoEm: 'desc' },
            where: {
                numero: {}
            }
        });
        res.json(contatos);
    } catch (error) {
        console.error("Erro ao buscar contatos:", error);
        res.status(500).json({ error: "Erro ao buscar contatos" });
    }
});

io.on("connection", (socket) => {
    socket.on("zerarNaoLidas", (idContato) => {
        mensagensNaoLidas[idContato] = 0;

        waitingContacts = waitingContacts.map(contato =>
            contato.id === idContato ? { ...contato, naoLidas: 0 } : contato
        );

        attendingContacts = attendingContacts.map(contato =>
            contato.id === idContato ? { ...contato, naoLidas: 0 } : contato
        );

        io.emit("updateContacts", {
            waiting: waitingContacts,
            attending: attendingContacts
        });

        salvarDados();
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});