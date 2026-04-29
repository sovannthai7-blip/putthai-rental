Const https = require('https');

const BOT_TOKEN = '8689603493:AAESjzErIj0gb6iLA0gmUDUj16O22rzp-VQ';
const OWNER_UID = 'vnS4H9c5HBOvBqUxUKpTqho0aMt2';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || '';

async function sendMessage(chatId, text) {
    return new Promise((resolve) => {
        const body = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
        const req = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${BOT_TOKEN}/sendMessage`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}

async function saveTelegramLink(chatId, custId, firstName) {
    return new Promise((resolve) => {
        const body = JSON.stringify({
            fields: {
                chatId: { stringValue: String(chatId) },
                custId: { stringValue: custId },
                firstName: { stringValue: firstName },
                linkedAt: { stringValue: new Date().toISOString() }
            }
        });
        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/telegram_links/${chatId}`,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve(data));
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 200, body: 'OK' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 200, body: 'OK' };
    }

    const msg = body.message;
    if (!msg) return { statusCode: 200, body: 'OK' };

    const chatId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const text = (msg.text || '').trim();

    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const param = parts[1] || '';

        if (param.startsWith('cust_')) {
            const custId = param.replace('cust_', '');
            await saveTelegramLink(chatId, custId, firstName);
            await sendMessage(chatId,
                `🏠 <b>សូមស្វាគមន៍មកកាន់ PUTTHAI Rental!</b>\n\n` +
                `✅ ការភ្ជាប់របស់អ្នករួចរាល់ហើយ!\n\n` +
                `ពីនេះទៅ អ្នកនឹងទទួលបាន:\n` +
                `📄 វិក្កយបត្រ និង វិញ្ញាបនបត្រ\n` +
                `🔔 ការជូនដំណឹងជំពាក់ប្រាក់\n\n` +
                `🏠 PUTTHAI Rental System`
            );
        } else {
            await sendMessage(chatId,
                `🏠 <b>PUTTHAI Rental Bot</b>\n\n` +
                `សូមស្គែន QR Code លើ Invoice របស់អ្នក\n` +
                `ដើម្បីភ្ជាប់គណនី ✅\n\n` +
                `📱 Chat ID របស់អ្នក:\n<code>${chatId}</code>\n` +
                `(ប្រាប់ Admin ដើម្បីភ្ជាប់ដោយខ្លួនឯង)`
            );
        }
    } else if (text === '/mychatid') {
        await sendMessage(chatId,
            `📱 <b>Chat ID របស់អ្នក:</b>\n` +
            `<code>${chatId}</code>\n\n` +
            `ប្រាប់ Admin ដើម្បីភ្ជាប់គណនី`
        );
    } else {
        await sendMessage(chatId,
            `🏠 <b>PUTTHAI Rental Bot</b>\n\n` +
            `Commands:\n` +
            `• /mychatid — មើល Chat ID\n\n` +
            `ស្គែន QR Code លើ Invoice ដើម្បីភ្ជាប់ ✅`
        );
    }

    return { statusCode: 200, body: 'OK' };
};
