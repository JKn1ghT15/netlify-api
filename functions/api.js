import express from 'express';
import serverless from 'serverless-http';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Cargar variables de entorno en desarrollo local
dotenv.config();

const app = express();
const router = express.Router();

// Middlewares fundamentales
app.use(express.json());

// Helper para validar formato de correo electronico
function esCorreoValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// -------------------------------------------------------------
// Endpoint 1: Obtener la hora del servidor
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Endpoint 2: Envio de correo electronico
// -------------------------------------------------------------
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    // Validacion defensiva de datos de entrada
    if (!to || !subject || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Parametros obligatorios faltantes: to, subject y message son requeridos.'
      });
    }

    if (!esCorreoValido(to)) {
      return res.status(400).json({
        status: 'error',
        message: 'El formato de correo en el campo "to" no es valido.'
      });
    }

    // Comprobacion de configuracion en variables de entorno
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({
        status: 'error',
        message: 'Servicio de correo no configurado en el servidor (variables de entorno ausentes).'
      });
    }

    // Creacion del transporte SMTP con Nodemailer
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    // Envio del mensaje
    const info = await transporter.sendMail({
      from: EMAIL_FROM || `"API Serverless" <${SMTP_USER}>`,
      to,
      subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2b2d42;">Mensaje Transaccional</h2>
          <p>${message}</p>
          <hr />
          <small style="color: #888;">Enviado mediante Netlify Express API Serverless a las ${new Date().toUTCString()}</small>
        </div>
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
    console.error('Error al procesar envio de correo:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Fallo interno al despachar el correo.',
      details: error.message
    });
  }
});

// Anclar el router al prefijo base /api
app.use('/api', router);

// Exportar como handler serverless (SIN app.listen)
export const handler = serverless(app);