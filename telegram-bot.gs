// PUTTHAI Rental - Telegram Bot Webhook
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
            path: `/bot${BOT_TOKEN}/sendMessage`,
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
            path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,
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

// Save to telegram_links collection (simple + reliable)
async function saveTelegramLink(custId, chatId) {
    // Normalize custId - ensure has "cust_" prefix
    const normalCustId = custId.startsWith('cust_') ? custId : 'cust_' + custId;
    console.log('[DEBUG] saveTelegramLink - custId:', normalCustId, 'chatId:', chatId);
    custId = normalCustId;
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
            path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/telegram_links/${docId}?key=${FIREBASE_API_KEY}`,
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
                path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,
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
                path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY}`,
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
                // Reply Customer ភ្លាម
                await sendMessage(chatId,
                    '✅ សូស្ដី <b>' + firstName + '</b>!\n\n' +
                    '🏠 <b>PUTTHAI Rental</b>\n' +
                    '📱 Telegram តភ្ជាប់រួចហើយ!\n\n' +
                    'Put នឹងទទួល:\n' +
                    '📄 វិក្កយបត្រប្រចាំខែ\n' +
                    '🧾 បង្កាន់ដៃ\n' +
                    '📢 ជូនដំណឹង\n\n' +
                    '🙏 សូមអរគុណ!'
                );
                // Save + Notify Admin
                try {
                    const custName = await getCustomerName(custId);
                    const saved = await saveTelegramLink(custId, chatId);
                    await saveChatId(custId, chatId);
                    const name = custName || firstName;
                    await sendMessage(ADMIN_CHAT_ID,
                        '🔔 អតិថិជនភ្ជាប់!\n\n' + '👤 <b>' + name + '</b>\n' + '📱 ChatID: <code>' + chatId + '</code>\n' + '✅ Save: ' + (saved ? 'OK' : 'Manual')
                    );
                } catch(e) {
                    await sendMessage(ADMIN_CHAT_ID,
                        '🔔 Customer START!\n👤 ' + firstName + '\n📱 <code>' + chatId + '</code>'
                    );
                }
            } else {
                await sendMessage(chatId,
                    '🏠 សូស្ដី <b>' + firstName + '</b>!\n\n' +
                    'Welcome to <b>PUTTHAI Rental Bot</b>!\n\n' +
                    '📱 សូម Scan QR Code ពី Invoice\n' +
                    'ដើម្បីភ្ជាប់គណនីរបស់អ្នក'
                );
                await sendMessage(ADMIN_CHAT_ID,
                    '🔔 មានអ្នកចូល Bot!\n👤 ' + firstName + '\n📱 <code>' + chatId + '</code>\n⚠️ មិនទាន់ Scan QR'
                );
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch(e) {
        return { statusCode: 200, body: 'OK' };
    }
};
