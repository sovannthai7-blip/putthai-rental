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
            path: /bot${BOT_TOKEN}/sendMessage,
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
            path: /v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY},
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
            path: /v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/telegram_links/${docId}?key=${FIREBASE_API_KEY},
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
                path: /v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY},
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
                path: /v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/users/${OWNER_UID}?key=${FIREBASE_API_KEY},
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
                    \u2705 \u179F\u1BD0\u179F\u17D0\u178F\u17B7 <b>${firstName}</b>!\n\n +
                    \uD83C\uDFE0 <b>PUTTHAI Rental</b>\n +
                    \uD83D\uDCF1 Telegram \u178F\u17D0\u1786\u1799\u17BC\u1785\u17A0\u17C2\u1799!\n\n +
                    Put \u1793\u17D0\u1784\u179A\u17D2\u179A\u1786\u17BE\u178A:\n +
                    \uD83D\uDCC4 \u179C\u17B7\u1780\u17D2\u1780\u1799\u1794\u178F\u17D2\u179A\u1794\u17D2\u179A\u1785\u17B6\u1781\u17C2\n +
                    \uD83E\uDDFE \u1794\u1784\u17D2\u1780\u17B6\u1793\u17D0\u178A\u17C2\n +
                    \uD83D\uDCE2 \u1787\u17BC\u1793\u178A\u17C6\u1793\u17B9\u1784\n\n +
                    \uD83D\uDE4F \u179F\u17BC\u1798\u17A2\u179A\u1782\u17BB\u178E!
                );
                // Save + Notify Admin
                try {
                    const custName = await getCustomerName(custId);
                    const saved = await saveTelegramLink(custId, chatId);
                    await saveChatId(custId, chatId);
                    const name = custName || firstName;
                    await sendMessage(ADMIN_CHAT_ID,
                        \uD83D\uDD14 \u17A2\u178F\u17B7\u1790\u1787\u1793\u1794\u17B6\u1793\u178E\u17D2\u1787\u17B6\u1794\u17CB!\n\n +
                        \uD83D\uDC64 <b>${name}</b>\n +
                        \uD83D\uDCF1 ChatID: <code>${chatId}</code>\n +
                        \u2705 Save: ${saved ? 'OK' : 'Manual'}
                    );
                } catch(e) {
                    await sendMessage(ADMIN_CHAT_ID,
                        \uD83D\uDD14 Customer START!\n\uD83D\uDC64 ${firstName}\n\uD83D\uDCF1 <code>${chatId}</code>
                    );
                }
            } else {
                await sendMessage(chatId,
                    \uD83C\uDFE0 \u179F\u1BD0\u179F\u17D0\u178F\u17B7 <b>${firstName}</b>!\n\n +
                    Welcome to <b>PUTTHAI Rental Bot</b>!\n\n +
                    \uD83D\uDCF1 \u179F\u17BC\u1798 Scan QR Code \u1796\u17B8 Invoice\n +
                    \u178A\u17BE\u1798\u17D2\u1794\u17B7\u178E\u17D2\u1787\u17B6\u1794\u1782\u178E\u1793\u17B8\u179A\u1794\u179F\u17CB\u17A2\u17D2\u1793\u1780\u17D0
                );
                await sendMessage(ADMIN_CHAT_ID,
                    \uD83D\uDD14 \u1798\u17B6\u1793\u17A2\u17D2\u1793\u1780\u1785\u17BC\u179B Bot!\n\uD83D\uDC64 ${firstName}\n\uD83D\uDCF1 <code>${chatId}</code>\n\u26A0\uFE0F \u1798\u17B7\u1793\u178F\u17B6\u1793\u17CB Scan QR
                );
            }
        }
        return { statusCode: 200, body: 'OK' };
    } catch(e) {
        return { statusCode: 200, body: 'OK' };
    }
};
