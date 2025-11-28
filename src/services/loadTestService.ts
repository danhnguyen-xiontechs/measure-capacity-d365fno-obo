/**
 * Load Test Service - Test API with high concurrent requests (threads)
 */

export interface LoadTestConfig {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  numThreads: number;
  requestsPerThread?: number;
  timeout?: number;
  bearerToken?: string; // Optional bearer token
}

export interface RequestDetail {
  threadId: number;
  requestNum: number;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  success: boolean;
  error?: string;
}

export interface LoadTestResult {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalTime: number; // ms
  avgResponseTime: number; // ms
  minResponseTime: number; // ms
  maxResponseTime: number; // ms
  requestsPerSecond: number;
  errors: Array<{ thread: number; error: string }>;
  requestDetails: RequestDetail[]; // Add detailed request info
  url?: string; // Add API endpoint
  method?: string; // Add HTTP method
}

export class LoadTestService {
  /**
   * Run load test on API
   * @param config Load test configuration
   * @returns Load test results
   */
  static async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const {
      url,
      method = "GET",
      headers = {},
      body = null,
      numThreads,
      requestsPerThread = 1,
      timeout = 30000,
      bearerToken,
    } = config;

    const result: LoadTestResult = {
      totalRequests: numThreads * requestsPerThread,
      successCount: 0,
      failureCount: 0,
      totalTime: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [],
      requestDetails: [],
      url,
      method,
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();

    // Create promises for all requests
    const threadPromises = [];
    for (let threadId = 0; threadId < numThreads; threadId++) {
      const threadPromise = this.executeThread(
        threadId,
        url,
        method,
        headers,
        body,
        requestsPerThread,
        timeout,
        result,
        responseTimes,
        bearerToken
      );
      threadPromises.push(threadPromise);
    }

    // Wait for all threads to complete
    await Promise.allSettled(threadPromises);

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

    return result;
  }

  /**
   * Execute requests in a single thread
   */
  private static async executeThread(
    threadId: number,
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    requestsPerThread: number,
    timeout: number,
    result: LoadTestResult,
    responseTimes: number[],
    bearerToken?: string
  ): Promise<void> {
    for (let i = 0; i < requestsPerThread; i++) {
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

        // Add bearer token if provided
        if (bearerToken) {
          requestHeaders["Authorization"] = `Bearer ${bearerToken}`;
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
          success = true;
        } else {
          result.failureCount++;
          error = `HTTP ${response.status}: ${response.statusText}`;
          if (result.errors.length < 50) {
            result.errors.push({
              thread: threadId,
              error,
            });
          }
        }
      } catch (err) {
        endTime = Date.now();
        result.failureCount++;
        error = err instanceof Error ? err.message : String(err);
        if (result.errors.length < 50) {
          result.errors.push({
            thread: threadId,
            error,
          });
        }
      }

      // Store request detail
      result.requestDetails.push({
        threadId,
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
   * Format load test results for display
   */
  static formatResults(result: LoadTestResult): string {
    return `
╔════════════════════════════════════════╗
║       LOAD TEST RESULTS                ║
╚════════════════════════════════════════╝

Total Requests:       ${result.totalRequests}
Success:              ${result.successCount}
Failures:             ${result.failureCount}
Success Rate:         ${((result.successCount / result.totalRequests) * 100).toFixed(2)}%

Total Time:           ${result.totalTime}ms
Avg Response Time:    ${result.avgResponseTime.toFixed(2)}ms
Min Response Time:    ${result.minResponseTime.toFixed(2)}ms
Max Response Time:    ${result.maxResponseTime.toFixed(2)}ms
Requests/Second:      ${result.requestsPerSecond.toFixed(2)}

${
  result.errors.length > 0
    ? `Errors (first 10):
${result.errors
  .slice(0, 10)
  .map((e) => `  - Thread ${e.thread}: ${e.error}`)
  .join("\n")}`
    : ""
}
    `.trim();
  }
}
