/**
 * PUTTHAI Rental — Telegram Webhook Function
 * Netlify Serverless Function (Node.js)
 */

'use strict';

var https = require('https');

// ── Environment Variables ──
var BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
var FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || '';
var FIREBASE_TOKEN = process.env.FIREBASE_TOKEN || '';

// ── Send Telegram Message ──
function sendMessage(chatId, text, callback) {
    try {
        var body = JSON.stringify({
            chat_id: chatId,
            text: text
        });

        var req = https.request({
            hostname: 'api.telegram.org',
            path: '/bot' + BOT_TOKEN + '/sendMessage',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, function(res) {
            var data = '';
            res.on('data', function(d) { data += d; });
            res.on('end', function() {
                console.log('Telegram response:', data);
                if (callback) callback(null);
            });
        });

        req.on('error', function(e) {
            console.error('Telegram request error:', e.message);
            if (callback) callback(null);
        });

        req.write(body);
        req.end();

    } catch(e) {
        console.error('sendMessage error:', e.message);
        if (callback) callback(null);
    }
}

// ── Save ChatId to Firestore ──
function saveLink(chatId, custId, callback) {
    try {
        if (!FIREBASE_PROJECT) {
            console.error('FIREBASE_PROJECT_ID not set');
            if (callback) callback(null);
            return;
        }

        var body = JSON.stringify({
            fields: {
                chatId:    { stringValue: String(chatId) },
                custId:    { stringValue: String(custId) },
                linkedAt:  { stringValue: new Date().toISOString() }
            }
        });

        var path = '/v1/projects/' + FIREBASE_PROJECT +
                   '/databases/(default)/documents/telegram_links/' + chatId;

        var headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };

        // Use Authorization token if available
        if (FIREBASE_TOKEN) {
            headers['Authorization'] = 'Bearer ' + FIREBASE_TOKEN;
        }

        var req = https.request({
            hostname: 'firestore.googleapis.com',
            path: path,
            method: 'PATCH',
            headers: headers
        }, function(res) {
            var data = '';
            res.on('data', function(d) { data += d; });
            res.on('end', function() {
                console.log('Firestore response status:', res.statusCode);
                if (callback) callback(null);
            });
        });

        req.on('error', function(e) {
            console.error('Firestore request error:', e.message);
            if (callback) callback(null);
        });

        req.write(body);
        req.end();

    } catch(e) {
        console.error('saveLink error:', e.message);
        if (callback) callback(null);
    }
}

// ── Main Handler ──
exports.handler = function(event, context, callback) {
    var ok = { statusCode: 200, body: 'OK' };

    try {
        // Only accept POST
        if (event.httpMethod !== 'POST') {
            console.log('Non-POST request, ignoring');
            return callback(null, ok);
        }

        // Check BOT_TOKEN
        if (!BOT_TOKEN) {
            console.error('TELEGRAM_BOT_TOKEN not set');
            return callback(null, ok);
        }

        // Parse body
        if (!event.body) {
            console.log('Empty body');
            return callback(null, ok);
        }

        var body;
        try {
            body = JSON.parse(event.body);
        } catch(e) {
            console.error('JSON parse error:', e.message);
            return callback(null, ok);
        }

        // Validate message
        if (!body || !body.message) {
            console.log('No message in body');
            return callback(null, ok);
        }

        var msg = body.message;

        if (!msg.from || !msg.from.id) {
            console.log('No from.id in message');
            return callback(null, ok);
        }

        var chatId = msg.from.id;
        var text = (msg.text || '').trim();

        console.log('Received message from chatId:', chatId, 'text:', text);

        // ── Handle Commands ──
        if (text.indexOf('/start') === 0) {
            var parts = text.split(' ');
            var param = (parts[1] || '').trim();

            if (param.indexOf('cust_') === 0) {
                var custId = param.replace('cust_', '');
                console.log('Linking chatId', chatId, 'to custId', custId);

                saveLink(chatId, custId, function() {
                    sendMessage(chatId,
                        'PUTTHAI Rental\n\n' +
                        'បានភ្ជាប់រួចរាល់!\n\n' +
                        'អ្នកនឹងទទួល Invoice តាម Telegram នេះ។',
                        function() { callback(null, ok); }
                    );
                });

            } else {
                sendMessage(chatId,
                    'PUTTHAI Rental Bot\n\n' +
                    'សូមស្គែន QR Code លើ Invoice\n' +
                    'ដើម្បីភ្ជាប់គណនី\n\n' +
                    'Chat ID: ' + chatId,
                    function() { callback(null, ok); }
                );
            }

        } else if (text === '/mychatid') {
            sendMessage(chatId,
                'Chat ID: ' + chatId,
                function() { callback(null, ok); }
            );

        } else {
            sendMessage(chatId,
                'PUTTHAI Rental Bot\n\n' +
                '/mychatid - មើល Chat ID\n\n' +
                'ស្គែន QR Code លើ Invoice',
                function() { callback(null, ok); }
            );
        }

    } catch(e) {
        console.error('Handler error:', e.message);
        return callback(null, ok);
    }
};
