import express from 'express'
import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'
import fetch from 'node-fetch'  
import crypto from 'crypto'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000


// Middleware to parse incoming JSON
app.use(express.json())

// Define POST route to create a BoxPay session
app.post('/create-session', async (req, res) => {
    const url = `${process.env.BOXPAY_API_URL}/${process.env.MERCHANT_ID}/sessions`
    const token = process.env.API_KEY
    const businessUnitCode = process.env.BUSINESS_UNIT_CODE

    const body = {
        "context": {
            "countryCode": "IN",
            "legalEntity": {
                "code": businessUnitCode
            },
            "orderId": "test12",
            "localCode": "fr-FR"
        },
        "paymentType": "S",
        "money": {
            "amount": "7568.50",
            "currencyCode": "INR"
        },
        "shopper": {
            "uniqueReference": "UNIQUE_SHOPPER"
        },
        "frontendReturnUrl": "https://boxpay-3.onrender.com/api/success",
        "frontendBackUrl": "https://boxpay-3.onrender.com/api/failure",
        "statusNotifyUrl": "https://boxpay-3.onrender.com/api/store-payment-response"
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('Session created:', data)
        res.status(200).json(data)
    } catch (error) {
        console.error('Error creating session:', error)
        res.status(500).json({ error: 'Failed to create session', details: error.message })
    }
})

// API endpoint to receive data from main.js
app.post('/api/store-payment-response', async (req, res) => {

    console.log('Received a request at /api/store-payment-response');
    console.log('Headers:', req.headers);
    console.log('Request Body:', req.body);

    const paymentResponse = req.body;

    if (!paymentResponse) {
        console.error('No payment response received');
        return res.status(400).send('No payment data received');
    }

    console.log('Received paymentResponse:', paymentResponse);

    // Ensure the 'x-signature' header exists
    const receivedSignature = req.headers['x-signature'];
    if (!receivedSignature) {
        return res.status(403).send('Signature header missing');
    }

    const boxpaySaltKey = process.env.SALT_KEY;

    // Construct the signature text as required by BoxPay's documentation
    const signatureText = [
        boxpaySaltKey,
        paymentResponse.legalEntityCode,
        paymentResponse.orderId,
        paymentResponse.transactionId,
        paymentResponse.operationId,
        paymentResponse.eventId,
        paymentResponse.countryCode,
        paymentResponse.status.status,
        paymentResponse.money.currencyCode,
        paymentResponse.money.amount
    ].join('');

    // Hash the signature text using SHA-256
    const hash = crypto.createHash('sha256');
    const calculatedSignature  = hash.update(signatureText, 'utf8').digest('hex');


    // Verify if the signature matches
    if (receivedSignature == calculatedSignature ) {
          // Log the received signature and the calculated signature for debugging
          console.log('Received Signature:', receivedSignature);
          console.log('Calculated Signature:', calculatedSignature );
          console.log('Payment data ', paymentResponse)
          return res.status(200).send('Payment data and signature verified')
    }
    else {
      return res.status(403).send('Invalid signature');
    }
});

app.get('/api/success', async (req, res) => {
    console.log('Payment successfull')
    return res.status(200).send('Payment successfull')
});

app.get('/api/failure', async (req, res) => {
    console.log('Payment failure')
    return res.status(200).send('Payment failure')
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
