// ════════════════════════════════════════════
// PUTTHAI Rental — Telegram Bot (Google Apps Script)
// ════════════════════════════════════════════

const BOT_TOKEN = '8689603493:AAESjzErIj0gb6iLA0gmUDUj16O22rzp-VQ';
const API_KEY   = 'AIzaSyDXhozODBbLA5cnSH8bxfxjjTxxlk1xGaI';
const PROJECT_ID = 'room-rental-kh';
const OWNER_UID  = 'vnS4H9c5HBOvBqUxUKpTqho0aMt2';
const ADMIN_CHAT_ID = '2079207099';

// ════════════════════════════════
// MAIN WEBHOOK HANDLER
// ════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const msg  = data.message;
    if (!msg) return ContentService.createTextOutput('OK');

    const chatId    = msg.chat.id.toString();
    const text      = msg.text || '';
    const firstName = msg.from.first_name || 'Customer';

    if (text.startsWith('/start')) {
      const custId = text.split(' ')[1] || '';
      Logger.log('[START] chatId:' + chatId + ' custId:' + custId);

      if (custId) {
        // Check if already linked
        const checkUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
            '/databases/(default)/documents/telegram_links/' + chatId + '?key=' + API_KEY;
        const res = UrlFetchApp.fetch(checkUrl, { method: 'GET', muteHttpExceptions: true });
        const existing = JSON.parse(res.getContentText());

        if (existing.fields) {
          sendMessage(chatId, '\uD83D\uDC4B \u178F\u17D0\u1780\u1794\u17B6\u1793\u178E\u17D2\u1787\u17B6\u1794\u1794\u17D2\u179A\u1794\u17D2\u179A\u1786\u17D2\u178E\u179A\u17BD\u1785\u17A0\u17C2\u1799\u17E1');
        } else {
          // 1. Save to telegram_links
          saveTelegramLink(custId, chatId, firstName);

          // 2. Update customer record in users collection
          const custName = updateCustomerTelegramChatId(custId, chatId);

          // 3. Reply Customer
          const name = custName || firstName;
          sendMessage(chatId,
            '\u2705 \u179F\u1BD0\u179F\u17D0\u178F\u17B7 <b>' + name + '</b>!\n\n' +
            '\uD83C\uDFE0 <b>PUTTHAI Rental</b>\n' +
            '\uD83D\uDCF1 Telegram \u178F\u17D0\u1786\u1799\u17BC\u1785\u17A0\u17C2\u1799!\n\n' +
            'Put \u1793\u17D0\u1784\u179A\u17D2\u179A\u1786\u17BE:\n' +
            '\uD83D\uDCC4 \u179C\u17B7\u1780\u17D2\u1780\u1799\u1794\u178F\u17D2\u179A\u1794\u17D2\u179A\u1785\u17B6\u1781\u17C2\n' +
            '\uD83E\uDDFE \u1794\u1784\u17D2\u1780\u17B6\u1793\u17D0\u178A\u17C2\n' +
            '\uD83D\uDCE2 \u1787\u17BC\u1793\u178A\u17C6\u1793\u17B9\u1784\n\n' +
            '\uD83D\uDE4F \u179F\u17BC\u1798\u17A2\u179A\u1782\u17BB\u178E!'
          );

          // 4. Notify Admin
          sendMessage(ADMIN_CHAT_ID,
            '\uD83D\uDD14 \u17A2\u178F\u17B7\u1790\u1787\u1793\u1794\u17B6\u1793\u178E\u17D2\u1787\u17B6\u1794\u17CB!\n\n' +
            '\uD83D\uDC64 <b>' + (custName || firstName) + '</b>\n' +
            '\uD83D\uDCF1 ChatID: <code>' + chatId + '</code>\n' +
            '\uD83C\uDD94 custId: <code>' + custId + '</code>\n' +
            '\u2705 Save: OK'
          );

          Logger.log('[LINKED] custId:' + custId + ' chatId:' + chatId + ' name:' + (custName||firstName));
        }
      } else {
        // General /start — no QR
        sendMessage(chatId,
          '\uD83C\uDFE0 \u179F\u1BD0\u179F\u17D0\u178F\u17B7 <b>' + firstName + '</b>!\n\n' +
          'Welcome to <b>PUTTHAI Rental Bot</b>!\n\n' +
          '\uD83D\uDCF1 \u179F\u17BC\u1798 Scan QR Code \u1796\u17B8 Invoice\n' +
          '\u178A\u17BE\u1798\u17D2\u1794\u17B7\u178E\u17D2\u1787\u17B6\u1794\u1782\u178E\u1793\u17B8\u179A\u1794\u179F\u17CB\u17A2\u17D2\u1793\u1780\u17D0'
        );
        sendMessage(ADMIN_CHAT_ID,
          '\uD83D\uDD14 \u1798\u17B6\u1793\u17A2\u17D2\u1793\u1780\u1785\u17BC\u179B Bot!\n' +
          '\uD83D\uDC64 ' + firstName + '\n' +
          '\uD83D\uDCF1 <code>' + chatId + '</code>\n' +
          '\u26A0\uFE0F \u1798\u17B7\u1793\u178F\u17B6\u1793\u17CB Scan QR'
        );
      }
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
    Logger.log('Error: ' + err.toString());
    return ContentService.createTextOutput('OK');
  }
}

// ════════════════════════════════
// Save to telegram_links collection
// ════════════════════════════════
function saveTelegramLink(custId, chatId, firstName) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
      '/databases/(default)/documents/telegram_links/' + chatId + '?key=' + API_KEY;

  const doc = {
    fields: {
      chatId:    { stringValue: chatId },
      custId:    { stringValue: custId },
      firstName: { stringValue: firstName || '' },
      linkedAt:  { timestampValue: new Date().toISOString() },
      active:    { booleanValue: true }
    }
  };

  UrlFetchApp.fetch(url, {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify(doc),
    muteHttpExceptions: true
  });
  Logger.log('[saveTelegramLink] chatId:' + chatId + ' custId:' + custId);
}

// ════════════════════════════════
// Update customer.telegramChatId in users collection
// ════════════════════════════════
function updateCustomerTelegramChatId(custId, chatId) {
  try {
    const userUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
        '/databases/(default)/documents/users/' + OWNER_UID + '?key=' + API_KEY;

    const res = UrlFetchApp.fetch(userUrl, { method: 'GET', muteHttpExceptions: true });
    const userData = JSON.parse(res.getContentText());

    if (!userData.fields || !userData.fields.customers) {
      Logger.log('[updateCustomer] No customers field');
      return null;
    }

    const customers = userData.fields.customers.arrayValue.values || [];
    let updated = false;
    let custName = null;

    const newCustomers = customers.map(c => {
      const fields = c.mapValue ? c.mapValue.fields : null;
      if (!fields) return c;
      if (fields.id && fields.id.stringValue === custId) {
        updated = true;
        custName = fields.name ? fields.name.stringValue : null;
        fields.telegramChatId = { stringValue: chatId };
        Logger.log('[updateCustomer] Found customer: ' + custName);
      }
      return c;
    });

    if (updated) {
      // PATCH only customers field
      UrlFetchApp.fetch(userUrl + '&updateMask.fieldPaths=customers', {
        method: 'PATCH',
        contentType: 'application/json',
        payload: JSON.stringify({
          fields: {
            customers: { arrayValue: { values: newCustomers } }
          }
        }),
        muteHttpExceptions: true
      });
      Logger.log('[updateCustomer] Updated ' + custId + ' → chatId:' + chatId);
    } else {
      Logger.log('[updateCustomer] custId not found: ' + custId);
    }

    return custName;
  } catch (err) {
    Logger.log('[updateCustomer] Error: ' + err.toString());
    return null;
  }
}

// ════════════════════════════════
// Send Telegram Message
// ════════════════════════════════
function sendMessage(chatId, text) {
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('[sendMessage] Error: ' + err.toString());
  }
}

// ════════════════════════════════
// Setup Webhook
// ════════════════════════════════
function setWebhook() {
  const webhookUrl = ScriptApp.getService().getUrl();
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + BOT_TOKEN + '/setWebhook?url=' + encodeURIComponent(webhookUrl)
  );
  Logger.log('[setWebhook] ' + res.getContentText());
}

function doGet() {
  return ContentService.createTextOutput('PUTTHAI Bot is running!');
}
