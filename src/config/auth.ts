import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";

dotenv.config();

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

export async function getAccessToken(): Promise<string> {
    const now = Date.now();

    if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
        return cachedToken;
    }

    const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

    const body = qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: `${process.env.DATAVERSE_URL}/.default`,
        grant_type: "client_credentials"
    });
console.log('hello: ' , body);

    const { data } = await axios.post(url, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in - 60) * 1000;

    return cachedToken!;
}
