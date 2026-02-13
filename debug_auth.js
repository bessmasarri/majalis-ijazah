const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const BASE_URL = 'http://localhost:3000';

async function testAuth() {
    try {
        console.log('1. Attempting Login...');
        const loginRes = await client.post(`${BASE_URL}/login`, {
            email: 'sheikh@example.com',
            password: '123456'
        });

        console.log(`Login Status: ${loginRes.status}`);
        console.log('Redirect check:', loginRes.request.res.responseUrl); // Axios follows redirects by default

        // After login, we should be at dashboard or redirected there.
        // Let's explicitly check /create-session
        console.log('\n2. Accessing /create-session...');
        const createRes = await client.get(`${BASE_URL}/create-session`);

        console.log(`Create Session Status: ${createRes.status}`);
        console.log('Current URL:', createRes.request.res.responseUrl);

        if (createRes.data.includes('إنشاء مجلس جديد')) {
            console.log('SUCCESS: Accessed Create Session page.');
        } else if (createRes.request.res.responseUrl.includes('/login')) {
            console.error('FAILURE: Redirected back to login.');
        } else {
            console.error('FAILURE: Unexpected page content.');
        }

    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
    }
}

testAuth();
