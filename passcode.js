require('dotenv').config();
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
});
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

async function sendEmailOtp(email) {
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false
    });

    const redisKey = `otp:${email}`;
    const OTP_TTL_SECONDS = 300;
    try {
        await redis.set(redisKey, otp, { ex: OTP_TTL_SECONDS });
    } catch (error) {
        console.error("Redis SET failed:", error);
        return false;
    }

    const mailOptions = {
        from: 'Schediazo Grocer',
        to: email,
        subject: 'Your One-Time Login Code',
        html: `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grocer App OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif; background-color: #f6f6f6;">

    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; max-width: 600px;">
                    
                    <tr>
                        <td align="center" style="background-color: #242424; color: #ffffff; padding: 20px 0;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Grocer App OTP Code</h1>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="background-color: #e0e0e0; padding: 40px 20px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">You have received the following OTP code:<br>With 5 Minutes Expiration</p>
                            
                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto;">
                                <tr>
                                    <td align="center" style="letter-spacing: 8px; background-color: #ffc107; color: #000000; padding: 20px 40px; font-size: 30px; font-weight: bold; border-radius: 4px;">
                                        ${otp}
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0 0; font-size: 14px; color: #333333;">If this code has been sent to you accidentally, please ignore it.</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="background-color: #242424; color: #ffffff; padding: 20px 10px;">
                            <p style="margin: 0; font-size: 10px; line-height: 1.4;">
                                Please be aware of Phishing and Spam Emails. Do not click links or share OTPs<br>even if someone asks or if it's sent to you accidentally.<br>Copyright Schediazo.com
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html> 
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        await redis.del(redisKey);
        return false;
    }
}
async function verifyEmailOtp(email, userOtp) {
    const redisKey = `otp:${email}`;
    const storedOtp = await redis.get(redisKey);
    if (!storedOtp) {
        return false;
    }
    if (storedOtp === userOtp) {
        await redis.del(redisKey);
        return true;
    }
    return false;
}

module.exports = { sendEmailOtp, verifyEmailOtp };