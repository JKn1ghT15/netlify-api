import express from 'express';
import serverless from 'serverless-http';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const router = express.Router();

app.use(express.json());


function esCorreoValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}


function autenticarApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const secretKey = process.env.API_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({
      status: 'error',
      message: 'API_SECRET_KEY no está configurada en el servidor.'
    });
  }

  if (!apiKey || apiKey !== secretKey) {
    return res.status(401).json({
      status: 'error',
      message: 'No autorizado. La cabecera x-api-key es inválida o inexistente.'
    });
  }

  next();
}


router.get('/time', (req, res) => {
  const now = new Date();

  return res.status(200).json({
    status: 'success',
    data: {
      serverTimeISO: now.toISOString(),
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      formatted: now.toUTCString(),
      platform: 'Netlify Functions (AWS Lambda)'
    }
  });
});


router.post('/send-email', autenticarApiKey, async (req, res) => {
  try {
    const { to, subject, message, senderName } = req.body;

    
    if (!to || !subject || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Parámetros obligatorios faltantes: to, subject y message son requeridos.'
      });
    }

    if (!esCorreoValido(to)) {
      return res.status(400).json({
        status: 'error',
        message: 'El formato de correo en el campo "to" no es válido.'
      });
    }

    
    const sanitizedSubject = subject.replace(/[\r\n]/g, '');

  
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({
        status: 'error',
        message: 'Servicio de correo no configurado en el servidor (variables de entorno ausentes).'
      });
    }

   
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    
    const nombreRemitente = senderName ? senderName.trim() : 'Sistema Serverless';

    const info = await transporter.sendMail({
      from: EMAIL_FROM || `"${nombreRemitente}" <${SMTP_USER}>`,
      to,
      subject: sanitizedSubject,
      text: message,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
            .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e1e4e8; }
            .header { background-color: #00c7b7; color: #ffffff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 20px; }
            .content { padding: 30px; color: #333333; line-height: 1.6; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e1e4e8; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Notificación Transaccional</h1>
            </div>
            <div class="content">
              <p>Hola,</p>
              <p>${message}</p>
              <p>Atentamente,<br><strong>${nombreRemitente}</strong></p>
            </div>
            <div class="footer">
              Enviado automáticamente desde Netlify Express API Serverless el ${new Date().toUTCString()}
            </div>
          </div>
        </body>
        </html>
      `
    });

    return res.status(200).json({
      status: 'success',
      message: 'Correo despachado satisfactoriamente.',
      data: {
        messageId: info.messageId,
        recipient: to
      }
    });

  } catch (error) {
    console.error('Error al procesar envío de correo:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Fallo interno al despachar el correo.',
      details: error.message
    });
  }
});

app.use('/api', router);

export const handler = serverless(app);