// PUTTHAI Rental — Telegram Bot Webhook
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8689603493:AAESjzErIj0gb6iLA0gmUDUj16O22rzp-VQ';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '2079207099';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDXhozODBbLA5cnSH8bxfxjjTxxlk1xGaI';
const FIREBASE_PROJECT = 'room-rental-kh';
const OWNER_UID = 'vnS4H9c5HBOvBqUxUKpTqho0aMt2';

function sendMessage(chatId, text) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${BOT_TOKEN}/sendMessage`,  // ✅ កែត្រូវ
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}

async function getCustomerName(custId) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,  // ✅ កែត្រូវ
            method: 'GET'
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const doc = JSON.parse(data);
                    const customers = doc.fields?.customers?.arrayValue?.values || [];
                    const cust = customers.find(c => c.mapValue?.fields?.id?.stringValue === custId);
                    resolve(cust ? cust.mapValue.fields.name?.stringValue : null);
                } catch(e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

async function saveTelegramLink(custId, chatId) {
    console.log('[DEBUG] saveTelegramLink - custId:', custId, 'chatId:', chatId);
    return new Promise((resolve) => {
        const docId = String(chatId);
        const body = JSON.stringify({
            fields: {
                chatId: { stringValue: String(chatId) },
                custId: { stringValue: String(custId) },
                linkedAt: { timestampValue: new Date().toISOString() }
            }
        });
        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/telegram_links/${docId}?key=${FIREBASE_API_KEY}`,  // ✅ កែត្រូវ
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.statusCode === 200));
        });
        req.on('error', () => resolve(false));
        req.write(body);
        req.end();
    });
}

async function saveChatId(custId, chatId) {
    try {
        const docRes = await new Promise((resolve) => {
            const req = https.request({
                hostname: 'firestore.googleapis.com',
                path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,  // ✅ កែត្រូវ
                method: 'GET'
            }, res => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(null); } });
            });
            req.on('error', () => resolve(null));
            req.end();
        });

        if (!docRes || !docRes.fields) return false;
        let customers = docRes.fields.customers?.arrayValue?.values || [];
        let found = false;
        customers = customers.map(c => {
            if (c.mapValue?.fields?.id?.stringValue === custId) {
                found = true;
                c.mapValue.fields.telegramChatId = { stringValue: String(chatId) };
            }
            return c;
        });

        if (!found) return false;

        const updateBody = JSON.stringify({
            fields: { ...docRes.fields, customers: { arrayValue: { values: customers } } }
        });

        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'firestore.googleapis.com',
                path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,  // ✅ កែត្រូវ
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(updateBody) }
            }, res => {
                res.on('data', () => {});
                res.on('end', () => resolve(res.statusCode === 200));
            });
            req.on('error', () => resolve(false));
            req.write(updateBody);
            req.end();
        });
    } catch(e) { return false; }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 200, body: 'PUTTHAI Bot OK' };
    }
    try {
        const update = JSON.parse(event.body || '{}');
        const msg = update.message;
        if (!msg) return { statusCode: 200, body: 'OK' };

        const chatId = msg.chat.id;
        const text = msg.text || '';
        const firstName = msg.from?.first_name || 'Customer';

        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            const custId = parts[1] || '';
            console.log('[DEBUG] /start received, text:', text);
            console.log('[DEBUG] custId extracted:', custId);
            console.log('[DEBUG] chatId:', chatId);

            if (custId) {
                await sendMessage(chatId,
                    `✅ សូមស្វាគមន៍ <b>${firstName}</b>!

🏠 <b>PUTTHAI Rental</b>
📱 Telegram បានភ្ជាប់ហើយ!

បន្តទៅរក:
📄 មើលកិច្ចសន្យាបច្ចុប្បន្ន
🧾 បង់ថ្លៃជួល
📢 ទទួលដំណឹង

🙏 សូមអរគុណ!`
                );
                try {
                    const custName = await getCustomerName(custId);
                    const saved = await saveTelegramLink(custId, chatId);
                    await saveChatId(custId, chatId);
                    const name = custName || firstName;
                    await sendMessage(ADMIN_CHAT_ID,
                        `🔔 អតិថិជនថ្មីភ្ជាប់ហើយ!

👤 <b>${name}</b>
📱 ChatID: <code>${chatId}</code>
✅ Save: ${saved ? 'OK' : 'Manual'}`
                    );
                } catch(e) {
                    await sendMessage(ADMIN_CHAT_ID,
                        `🔔 Customer START!
👤 ${firstName}
📱 <code>${chatId}</code>`
                    );
                }
            } else {
                await sendMessage(chatId,
                    `🏠 សូមស្វាគមន៍ <b>${firstName}</b>!

Welcome to <b>PUTTHAI Rental Bot</b>!

📱 សូម Scan QR Code ពី Invoice
ឬបញ្ចូលលេខកិច្ចសន្យាដើម្បីភ្ជាប់គណនី`
                );
                await sendMessage(ADMIN_CHAT_ID,
                    `🔔 អតិថិជនថ្មីបើក Bot!
👤 ${firstName}
📱 <code>${chatId}</code>
⚠️ មិនទាន់មាន Scan QR`
                );
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch(e) {
        return { statusCode: 200, body: 'OK' };
    }
};
