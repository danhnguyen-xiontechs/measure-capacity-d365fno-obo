import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, JWTVerifyResult } from "jose";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * D365Connector handles authentication and requests to Dynamics 365 Finance and Operations (FO)
 * - uses Entra ID OBO flow to get FO access tokens
 * - caches tokens for performance
 * - provides CRUD methods for FO entities
 * - includes Express middleware for JWT validation
 * - escapes OData literals
 * 
 * @example
 * const d365 = new D365Connector();
 * app.use(d365.authMiddleware);
 * const employees = await d365.readRecord("EmployeesV2", "$top=10");
 * const newEmp = await d365.createRecord("EmployeesV2", { PersonnelNumber: "123", WorkerName: "John Doe" });
 * await d365.updateRecord("EmployeesV2", "PersonnelNumber='123'", { WorkerName: "Jane Doe" });
 * await d365.deleteRecord("EmployeesV2", "PersonnelNumber='123'");
 */
export class D365Connector {
  private TENANT_ID = process.env.TENANT_ID || "";
  private API_EAS_CLIENT_ID = process.env.API_EAS_CLIENT_ID || "";
  private API_EAS_CLIENT_SECRET = process.env.API_EAS_CLIENT_SECRET || "";
  private FO_URL = (process.env.FO_URL || "").replace(/\/$/, "");
  private API_EXPECTED_AUDIENCE = process.env.API_EXPECTED_AUDIENCE || `api://${this.API_EAS_CLIENT_ID}`;

  private requestContext = new AsyncLocalStorage<{ userAssertionJwt?: string }>();
  private oboCache = new Map<string, { accessToken: string; expiresAt: number }>();

  private ISSUER_V2 = `https://login.microsoftonline.com/${this.TENANT_ID}/v2.0`;
  private ISSUER_V1 = `https://sts.windows.net/${this.TENANT_ID}/`;
  private jwksV2 = createRemoteJWKSet(new URL(`${this.ISSUER_V2}/discovery/v2.0/keys`));
  private jwksV1 = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${this.TENANT_ID}/discovery/keys`));
  private userToken = '';
  constructor() {
    if (!this.TENANT_ID || !this.API_EAS_CLIENT_ID || !this.API_EAS_CLIENT_SECRET || !this.FO_URL) {
      console.warn("Missing required environment variables for Entra ID OBO and FO_URL.");
    }
  }

  getCurrentContext() {
    //return this.requestContext.getStore() || {};
    return this.userToken;
  }

  setToken(token: string) {
    // const ctx = this.getCurrentContext();
    // ctx.userAssertionJwt = token;
    this.userToken = token;    
  }

  async validateInboundJwt(token: string): Promise<JWTVerifyResult["payload"]> {
    try {
      const result = await jwtVerify(token, this.jwksV2, { audience: this.API_EXPECTED_AUDIENCE });
      if ([this.ISSUER_V2, this.ISSUER_V1].includes(String(result.payload.iss))) return result.payload;
    } catch { }
    const result = await jwtVerify(token, this.jwksV1, { audience: this.API_EXPECTED_AUDIENCE });
    if ([this.ISSUER_V2, this.ISSUER_V1].includes(String(result.payload.iss))) return result.payload;
    return Promise.reject("Unexpected issuer");
  }

  async getFoAccessTokenFromObo(assertionJwt: string): Promise<string> {
    const cacheKey = crypto.createHash("sha256").update(assertionJwt + "|" + this.FO_URL).digest("hex");
    const cached = this.oboCache.get(cacheKey);
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt - 60 > now) return cached.accessToken;

    const params = new URLSearchParams({
      client_id: this.API_EAS_CLIENT_ID,
      client_secret: this.API_EAS_CLIENT_SECRET,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      requested_token_use: "on_behalf_of",
      scope: `${this.FO_URL}/.default`,
      assertion: assertionJwt,
    });

    const tokenResp = await fetch(`https://login.microsoftonline.com/${this.TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    
    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      return Promise.reject(`OBO token exchange failed: ${tokenResp.status} ${errorText}`);
    }
    
    const json = (await tokenResp.json()) as { access_token: string; expires_in: number };
    const expiresAt = now + (json.expires_in || 3600);
    this.oboCache.set(cacheKey, { accessToken: json.access_token, expiresAt });
    return json.access_token;
  }

  async fetchFo(pathname: string, init?: RequestInit) {
    const ctx = this.getCurrentContext();
    //console.log('token: ', ctx);
    if (!ctx) return Promise.reject("Missing user assertion for OBO");
    const foToken = await this.getFoAccessTokenFromObo(ctx);
    
    const url = `${this.FO_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${foToken}`);
    headers.set("Accept", "application/json");
    if (init?.body && !headers.get("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(url, { ...init, headers });
  }

  // CREATE
  async createRecord(entityName: string, data: any) {
    const resp = await this.fetchFo(`/data/${entityName}`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      console.error(`Create failed: ${resp.status} ${await resp.text()}`);
      return { error: `Create failed: ${resp.status}` };
    }
    return await resp.json();
  }

  // READ (single or collection)
  async readRecord(entityName: string, query?: string) {
    const url = query
      ? `/data/${entityName}?${query}`
      : `/data/${entityName}`;
    const resp = await this.fetchFo(url, { method: "GET" });

    if (!resp.ok) {
      //console.error(`Network error calling F&O: ${resp.status} ${await resp.text()}`);
      throw new Error(`Network error calling F&O: ${resp.status} ${await resp.text()}`);
    }
    return resp;
  }

  // UPDATE (PATCH in OData)
  async updateRecord(entityName: string, key: string, data: any) {
    const resp = await this.fetchFo(`/data/${entityName}(${key})`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      console.error(`Update failed: ${resp.status} ${await resp.text()}`);
      return { error: `Update failed: ${resp.status}` };
    }
    return await resp.json();
  }

  // DELETE
  async deleteRecord(entityName: string, key: string) {
    const resp = await this.fetchFo(`/data/${entityName}(${key})`, {
      method: "DELETE",
    });

    if (!resp.ok) {
      console.error(`Delete failed: ${resp.status} ${await resp.text()}`);
      return { error: `Delete failed: ${resp.status}` };
    }
    return await resp.json();
  }

  // middleware auth
  authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers["authorization"];
    if (!auth || Array.isArray(auth)) {
      res.status(200).json({ isSuccess: false, message: "Missing Authorization header" });
      return;
    }

    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match) {
      res.status(200).json({ isSuccess: false, message: "Invalid Authorization header" });
      return;
    }

    const token = match[1];
    if (!token) {
      res.status(200).json({ isSuccess: false, message: "Missing token" });
      return;
    }
    this.validateInboundJwt(token)
      .then(() => this.requestContext.run({ userAssertionJwt: token }, () => next()))
      .catch((err) => {
        console.error("JWT validation failed", err);
        return res.status(200).json({ isSuccess: false, message: "Unauthorized - Invalid or expired token" });
      });
  };

  escapeODataLiteral(value: string) {
    return value.replace(/'/g, "''");
  }
}