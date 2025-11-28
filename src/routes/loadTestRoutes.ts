import { Router, Request, Response } from "express";
import { LoadTestService, LoadTestConfig } from "../services/loadTestService";
import { MultiUserLoadTestService, MultiUserLoadTestConfig } from "../services/multiUserLoadTestService";

const router = Router();

/**
 * POST /api/loadtest/run
 * Run load test on a specified URL
 * 
 * @example
 * POST /api/loadtest/run
 * {
 *   "url": "http://localhost:3000/api/test",
 *   "method": "GET",
 *   "numThreads": 100,
 *   "requestsPerThread": 10,
 *   "timeout": 30000
 * }
 */
router.post("/run", async (req: Request, res: Response) => {
  const {
    url,
    method = "GET",
    headers = {},
    body = null,
    numThreads,
    requestsPerThread = 1,
    timeout = 30000,
    bearerToken,
  } = req.body;

  try {
    // Validate required fields
    if (!url || !numThreads) {
      return res.status(400).json({
        error: "Missing required fields: url, numThreads",
      });
    }

    if (numThreads > 100000) {
      return res.status(400).json({
        error: "numThreads cannot exceed 100000",
      });
    }

    const config: LoadTestConfig = {
      url,
      method,
      headers,
      body,
      numThreads,
      requestsPerThread,
      timeout,
      bearerToken,
    };

    const result = await LoadTestService.runLoadTest(config);
    return res.json({
      success: true,
      data: result,
      formatted: LoadTestService.formatResults(result),
    });
  } catch (error) {
    console.error("Load test error:", error);
    const errorMsg = error instanceof Error ? error.message : "Load test failed";
    
    // Return partial result with error instead of failing completely
    const partialResult = {
      url: url,
      method: method,
      totalRequests: numThreads * requestsPerThread,
      successCount: 0,
      failureCount: numThreads * requestsPerThread,
      totalTime: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [{ thread: 0, error: `API call failed: ${errorMsg}` }],
      requestDetails: [],
    };
    
    return res.json({
      success: false,
      data: partialResult,
      formatted: LoadTestService.formatResults(partialResult),
    });
  }
});

/**
 * POST /api/loadtest/multi-user
 * Run load test with multiple users
 * 
 * @example
 * POST /api/loadtest/multi-user
 * {
 *   "url": "http://localhost:3000/api/test",
 *   "method": "GET",
 *   "numUsers": 100,
 *   "requestsPerUser": 100,
 *   "userTokens": ["token1", "token2", ...],
 *   "timeout": 30000
 * }
 */
router.post("/multi-user", async (req: Request, res: Response) => {
  const {
    url,
    method = "GET",
    headers = {},
    body = null,
    numUsers,
    requestsPerUser = 1,
    timeout = 30000,
    userTokens = [],
  } = req.body;

  try {
    // Validate required fields
    if (!url || !numUsers) {
      return res.status(400).json({
        error: "Missing required fields: url, numUsers",
      });
    }

    if (numUsers > 100000) {
      return res.status(400).json({
        error: "numUsers cannot exceed 100000",
      });
    }

    if (requestsPerUser > 100000) {
      return res.status(400).json({
        error: "requestsPerUser cannot exceed 100000",
      });
    }

    const config: MultiUserLoadTestConfig = {
      url,
      method,
      headers,
      body,
      numUsers,
      requestsPerUser,
      timeout,
      userTokens,
    };

    const result = await MultiUserLoadTestService.runMultiUserLoadTest(config);
    return res.json({
      success: true,
      data: result,
      formatted: MultiUserLoadTestService.formatResults(result),
    });
  } catch (error) {
    console.error("Multi-user load test error:", error);
    const errorMsg = error instanceof Error ? error.message : "Multi-user load test failed";
    
    // Return partial result with error instead of failing completely
    const partialResult = {
      url: url,
      method: method,
      numUsers: numUsers,
      totalUsers: numUsers,
      totalRequests: numUsers * requestsPerUser,
      successCount: 0,
      failureCount: numUsers * requestsPerUser,
      successRate: 0,
      totalTime: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [{ user: 0, requestNum: 0, error: `API call failed: ${errorMsg}` }],
      requestDetails: [],
      userStats: [],
    };
    
    return res.json({
      success: false,
      data: partialResult,
      formatted: MultiUserLoadTestService.formatResults(partialResult),
    });
  }
});

/**
 * GET /api/loadtest/health
 * Simple health check endpoint for testing
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
