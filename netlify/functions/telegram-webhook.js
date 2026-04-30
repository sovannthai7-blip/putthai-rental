const https = require('https');

// ប្រើប្រាស់ Environment Variables ដើម្បីសុវត្ថិភាព
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8689603493:AAESjzErIj0gb6iLA0gmUDUj16O22rzp-VQ';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'room-rental-kh';

/**
 * ផ្ញើសារទៅកាន់ Telegram
 */
function sendMessage(chatId, text, callback) {
    const body = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    });

    const options = {
        hostname: 'api.telegram.org',
        Path: '/bot' + BOT_TOKEN + '/sendMessage',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => { if (callback) callback(null, data); });
    });

    req.on('error', (e) => { if (callback) callback(e); });
    req.write(body);
    req.end();
}

/**
 * រក្សាទុកទិន្នន័យទៅ Firestore
 */
function saveLink(chatId, custId, firstName, callback) {
    const body = JSON.stringify({
        fields: {
            chatId: { stringValue: String(chatId) },
            custId: { stringValue: String(custId) },
            firstName: { stringValue: String(firstName) },
            linkedAt: { stringValue: new Date().toISOString() }
        }
    });

    // Firestore REST API Path
    const path = `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/telegram_links/${chatId}`;

    const options = {
        hostname: 'firestore.googleapis.com',
        path: path,
        method: 'PATCH', // ប្រើ PATCH ដើម្បីបញ្ចូល ឬ Update ទិន្នន័យ
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => { if (callback) callback(null, data); });
    });

    req.on('error', (e) => { if (callback) callback(e); });
    req.write(body);
    req.end();
}

/**
 * Lambda/Function Handler
 */
exports.handler = function(event, context, callback) {
    // ត្រួតពិនិត្យថាជា POST Request ឬអត់
    if (event.httpMethod !== 'POST') {
        return callback(null, { statusCode: 200, body: 'OK' });
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch(e) {
        return callback(null, { statusCode: 200, body: 'OK' });
    }

    const msg = body.message;
    if (!msg) {
        return callback(null, { statusCode: 200, body: 'OK' });
    }

    const chatId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const text = (msg.text || '').trim();

    // ត្រួតពិនិត្យ Command /start
    if (text.indexOf('/start') === 0) {
        const parts = text.split(' ');
        const param = parts[1] || '';

        // បើមាន Parameter ដូចជា /start cust_123
        if (param.indexOf('cust_') === 0) {
            const custId = param.replace('cust_', '');
            saveLink(chatId, custId, firstName, () => {
                sendMessage(chatId,
                    '🏠 <b>សូមស្វាគមន៍មកកាន់ PUTTHAI Rental!</b>\n\n' +
                    'បានភ្ជាប់រួចរាល់ ✅\n\n' +
                    'អ្នកនឹងទទួលបាន Invoice និង Receipt\n' +
                    'តាម Telegram នេះដោយស្វ័យប្រវត្តិ។\n\n' +
                    '🏠 <i>PUTTHAI Rental System</i>',
                    () => callback(null, { statusCode: 200, body: 'OK' })
                );
            });
        } else {
            // បើចុច /start ធម្មតា
            sendMessage(chatId,
                '🏠 <b>PUTTHAI Rental Bot</b>\n\n' +
                'សូមស្គែន QR Code លើ Invoice របស់អ្នក\n' +
                'ដើម្បីភ្ជាប់គណនី ✅\n\n' +
                'Chat ID របស់អ្នក: <code>' + chatId + '</code>\n' +
                '(ផ្ញើលេខនេះទៅ Admin ដើម្បីភ្ជាប់ដោយផ្ទាល់)',
                () => callback(null, { statusCode: 200, body: 'OK' })
            );
        }
    } 
    // Command មើល Chat ID
    else if (text === '/mychatid') {
        sendMessage(chatId,
            '📱 Chat ID របស់អ្នកគឺ: <code>' + chatId + '</code>',
            () => callback(null, { statusCode: 200, body: 'OK' })
        );
    } 
    // សារផ្សេងៗ
    else {
        sendMessage(chatId,
            '🏠 <b>PUTTHAI Rental Bot</b>\n\n' +
            'Commands ដែលអាចប្រើបាន:\n' +
            '• /mychatid - ដើម្បីមើល Chat ID\n\n' +
            'សូមស្គែន QR Code លើវិក្កយបត្រដើម្បីភ្ជាប់គណនី។',
            () => callback(null, { statusCode: 200, body: 'OK' })
        );
    }
};
