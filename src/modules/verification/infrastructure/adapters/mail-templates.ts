interface OtpEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function renderOtpEmail(otp: string, locale: string = 'es-AR'): OtpEmailContent {
  const templates: Record<string, OtpEmailContent> = {
    'es-AR': {
      subject: `Tu código de verificación: ${otp}`,
      html: `<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verificación de correo</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #323232; }
    table { border-collapse: collapse; }
    .container { max-width: 600px; margin: 0 auto; background-color: #000000cc; border-radius: 12px; }
    .logo { padding: 20px; text-align: center; }
    .title { font-size: 22px; font-weight: bold; color: #fff; text-align: center; padding-bottom: 10px; }
    .text { font-size: 16px; line-height: 1.5; color: #fff; text-align: center; padding: 0 20px 20px 20px; }
    .otp { display: inline-block; font-size: 24px; font-weight: bold; color: #000; background-color: #d9ad16cc; padding: 10px 20px; border-radius: 8px; letter-spacing: 8px; margin: 0 auto 30px auto; text-align: center; }
    .footer { font-size: 12px; color: #bbbbbb; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <table width="100%" bgcolor="#323232">
    <tr>
      <td align="center">
        <table class="container" width="100%">
          <tr>
            <td class="logo">
              <img src="https://i.imgur.com/Pl66QjH.png" alt="chabit logo" width="180" style="display:block; margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td class="title">Verifica tu correo electrónico</td>
          </tr>
          <tr>
            <td class="text">
              ¡Gracias por registrarte en <strong>Chabit</strong> 🎉<br />
              Solo queda un paso para activar tu cuenta. Por favor, copia y pega el siguiente código para verificar tu correo:
            </td>
          </tr>
          <tr>
            <td align="center">
              <div class="otp">${otp}</div>
            </td>
          </tr>
          <tr>
            <td class="footer">
              Si no solicitaste esta verificación, puedes ignorar este mensaje.<br />
              &copy; 2025 Chabit. Todos los derechos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Hola,\nTu código de verificación es: ${otp}\nVence en 10 minutos.\nSi no fuiste vos, ignora este correo.\n\nEquipo Chabit`,
    },
    en: {
      subject: `Your verification code: ${otp}`,
      html: `<html>
<body style="font-family: Arial, sans-serif; line-height: 1.5;">
  <p>Hello,</p>
  <p>Your verification code is:</p>
  <div style="display:inline-block;background-color:#000;color:#fff;font-size:24px;font-weight:bold;padding:10px 20px;border-radius:8px;letter-spacing:4px;">${otp}</div>
  <p>Expires in 10 minutes.<br>If this wasn't you, ignore this email.</p>
  <hr>
  <p>Chabit Team</p>
  <p style="font-size:12px;color:gray;">This is an automated email, please do not reply.</p>
</body>
</html>`,
      text: `Hello,\nYour verification code is: ${otp}\nExpires in 10 minutes.\nIf this wasn't you, ignore this email.\n\nChabit Team`,
    },
  };

  return templates[locale] ?? templates['es-AR'];
}
