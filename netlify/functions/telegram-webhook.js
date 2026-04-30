Var https = require('https');

var TOKEN = '8689603493:AAESjzErIj0gb6iLA0gmUDUj16O22rzp-VQ';
var PROJECT = 'room-rental-kh';

function send(chatId, text, done) {
    var body = JSON.stringify({ chat_id: chatId, text: text });
    var req = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + TOKEN + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, function(res) {
        res.on('data', function() {});
        res.on('end', function() { if (done) done(); });
    });
    req.on('error', function() { if (done) done(); });
    req.write(body);
    req.end();
}

function saveLink(chatId, custId, done) {
    var body = JSON.stringify({
        fields: {
            chatId: { stringValue: String(chatId) },
            custId: { stringValue: String(custId) },
            linkedAt: { stringValue: new Date().toISOString() }
        }
    });
    var req = https.request({
        hostname: 'firestore.googleapis.com',
        path: '/v1/projects/' + PROJECT + '/databases/(default)/documents/telegram_links/' + chatId,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
    }, function(res) {
        res.on('data', function() {});
        res.on('end', function() { if (done) done(); });
    });
    req.on('error', function() { if (done) done(); });
    req.write(body);
    req.end();
}

exports.handler = function(event, context, callback) {
    var ok = { statusCode: 200, body: 'OK' };

    if (event.httpMethod !== 'POST') {
        return callback(null, ok);
    }

    var body;
    try { body = JSON.parse(event.body); }
    catch(e) { return callback(null, ok); }

    var msg = body.message;
    if (!msg) return callback(null, ok);

    var chatId = msg.from.id;
    var text = (msg.text || '').trim();

    if (text.indexOf('/start') === 0) {
        var param = (text.split(' ')[1]) || '';
        if (param.indexOf('cust_') === 0) {
            var custId = param.replace('cust_', '');
            saveLink(chatId, custId, function() {
                send(chatId,
                    'PUTTHAI Rental\n\nភ្ជាប់រួចរាល់! \n\nអ្នកនឹងទទួល Invoice តាម Telegram នេះ។',
                    function() { callback(null, ok); }
                );
            });
        } else {
            send(chatId,
                'PUTTHAI Rental Bot\n\nសូមស្គែន QR Code លើ Invoice\nដើម្បីភ្ជាប់គណនី\n\nChat ID: ' + chatId,
                function() { callback(null, ok); }
            );
        }
    } else if (text === '/mychatid') {
        send(chatId, 'Chat ID: ' + chatId, function() { callback(null, ok); });
    } else {
        send(chatId,
            'PUTTHAI Rental Bot\n/mychatid - មើល Chat ID',
            function() { callback(null, ok); }
        );
    }
};
កុំឆ្លើយ
