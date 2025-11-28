/**
 * Multi-User Load Test Service
 * Supports simulating multiple concurrent users with different tokens
 */

export interface MultiUserLoadTestConfig {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  numUsers: number;
  requestsPerUser: number;
  timeout?: number;
  userTokens?: string[]; // Tokens for each user
}

export interface UserRequestDetail {
  userId: number;
  requestNum: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  success: boolean;
  error?: string;
}

export interface MultiUserLoadTestResult {
  totalRequests: number;
  totalUsers: number;
  successCount: number;
  failureCount: number;
  totalTime: number; // ms
  avgResponseTime: number; // ms
  minResponseTime: number; // ms
  maxResponseTime: number; // ms
  requestsPerSecond: number;
  successRate: number;
  errors: Array<{ user: number; requestNum: number; error: string }>;
  userStats: Array<{ user: number; success: number; failed: number; avgTime: number }>;
  requestDetails: UserRequestDetail[]; // Add detailed request info
  url?: string; // Add API endpoint
  method?: string; // Add HTTP method
  numUsers?: number; // Number of users
}

export class MultiUserLoadTestService {
  /**
   * Run multi-user load test on API
   * @param config Load test configuration
   * @returns Load test results
   */
  static async runMultiUserLoadTest(
    config: MultiUserLoadTestConfig
  ): Promise<MultiUserLoadTestResult> {
    const {
      url,
      method = "GET",
      headers = {},
      body = null,
      numUsers,
      requestsPerUser,
      timeout = 30000,
      userTokens = [],
    } = config;

    const result: MultiUserLoadTestResult = {
      totalRequests: numUsers * requestsPerUser,
      totalUsers: numUsers,
      successCount: 0,
      failureCount: 0,
      totalTime: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      successRate: 0,
      errors: [],
      userStats: Array(numUsers)
        .fill(null)
        .map((_, i) => ({ user: i, success: 0, failed: 0, avgTime: 0 })),
      requestDetails: [],
      url,
      method,
      numUsers,
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();

    // Create promises for all users
    const userPromises = [];
    for (let userId = 0; userId < numUsers; userId++) {
      const userToken = userTokens[userId % userTokens.length];
      const userPromise = this.executeUser(
        userId,
        url,
        method,
        headers,
        body,
        requestsPerUser,
        timeout,
        result,
        responseTimes,
        userToken
      );
      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.allSettled(userPromises);

    const endTime = Date.now();
    result.totalTime = endTime - startTime;

    // Calculate statistics
    if (responseTimes.length > 0) {
      result.avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      result.minResponseTime = Math.min(...responseTimes);
      result.maxResponseTime = Math.max(...responseTimes);
    }

    result.requestsPerSecond =
      (result.totalRequests / result.totalTime) * 1000;
    result.successRate =
      (result.successCount / result.totalRequests) * 100;

    // Calculate per-user stats
    for (const userStat of result.userStats) {
      const userResponseTimes = responseTimes.filter(
        (_, i) => Math.floor(i / requestsPerUser) === userStat.user
      );
      if (userResponseTimes.length > 0) {
        userStat.avgTime =
          userResponseTimes.reduce((a, b) => a + b, 0) /
          userResponseTimes.length;
      }
    }

    return result;
  }

  /**
   * Execute requests from a single user
   */
  private static async executeUser(
    userId: number,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    requestsPerUser: number,
    timeout: number,
    result: MultiUserLoadTestResult,
    responseTimes: number[],
    userToken?: string
  ): Promise<void> {
    for (let i = 0; i < requestsPerUser; i++) {
      const startTime = Date.now();
      let endTime = startTime;
      let status = 0;
      let success = false;
      let error: string | undefined;

      try {
        const requestHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...headers,
        };

        // Add user token to Authorization header if provided
        if (userToken) {
          requestHeaders["Authorization"] = `Bearer ${userToken}`;
        }

        const response = await Promise.race([
          fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(
              () => reject(new Error("Request timeout")),
              timeout
            )
          ),
        ]);

        endTime = Date.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);
        status = response.status;

        if (response.ok) {
          result.successCount++;
          result.userStats[userId].success++;
          success = true;
        } else {
          result.failureCount++;
          result.userStats[userId].failed++;
          error = `HTTP ${response.status}: ${response.statusText}`;
          if (result.errors.length < 50) {
            result.errors.push({
              user: userId,
              requestNum: i,
              error,
            });
          }
        }
      } catch (err) {
        endTime = Date.now();
        result.failureCount++;
        result.userStats[userId].failed++;
        error = err instanceof Error ? err.message : String(err);
        if (result.errors.length < 50) {
          result.errors.push({
            user: userId,
            requestNum: i,
            error,
          });
        }
      }

      // Store request detail
      result.requestDetails.push({
        userId,
        requestNum: i,
        startTime,
        endTime,
        duration: endTime - startTime,
        status,
        success,
        error,
      });
    }
  }

  /**
   * Format multi-user load test results for display
   */
  static formatResults(result: MultiUserLoadTestResult): string {
    const topUsers = result.userStats
      .sort((a, b) => b.success - a.success)
      .slice(0, 5)
      .map(
        (u) =>
          `  User ${u.user}: ${u.success} success, ${u.failed} failed, ${u.avgTime.toFixed(2)}ms avg`
      )
      .join("\n");

    return `
╔════════════════════════════════════════╗
║   MULTI-USER LOAD TEST RESULTS         ║
╚════════════════════════════════════════╝

Total Users:          ${result.totalUsers}
Total Requests:       ${result.totalRequests}
Success:              ${result.successCount}
Failures:             ${result.failureCount}
Success Rate:         ${result.successRate.toFixed(2)}%

Total Time:           ${result.totalTime}ms
Avg Response Time:    ${result.avgResponseTime.toFixed(2)}ms
Min Response Time:    ${result.minResponseTime.toFixed(2)}ms
Max Response Time:    ${result.maxResponseTime.toFixed(2)}ms
Requests/Second:      ${result.requestsPerSecond.toFixed(2)}

Top 5 Users:
${topUsers}

${
  result.errors.length > 0
    ? `Errors (first 10):
${result.errors
  .slice(0, 10)
  .map((e) => `  - User ${e.user} Req${e.requestNum}: ${e.error}`)
  .join("\n")}`
    : ""
}
    `.trim();
  }
}
