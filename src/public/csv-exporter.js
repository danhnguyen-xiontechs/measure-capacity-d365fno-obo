/**
 * CSV Export Utility
 */

export class CSVExporter {
  /**
   * Export load test results to CSV format
   */
  static exportLoadTestResults(
    result: any,
    filename: string = "load-test-results.csv"
  ): void {
    const csv = this.generateLoadTestCSV(result);
    this.downloadCSV(csv, filename);
  }

  /**
   * Export multi-user load test results to CSV format
   */
  static exportMultiUserResults(
    result: any,
    filename: string = "multi-user-load-test-results.csv"
  ): void {
    const csv = this.generateMultiUserCSV(result);
    this.downloadCSV(csv, filename);
  }

  /**
   * Generate CSV content for load test
   */
  private static generateLoadTestCSV(result: any): string {
    const lines: string[] = [];

    // Header section
    lines.push("LOAD TEST RESULTS");
    lines.push("");
    lines.push("SUMMARY");
    lines.push("Metric,Value");
    lines.push(`Total Requests,${result.totalRequests}`);
    lines.push(`Success,${result.successCount}`);
    lines.push(`Failures,${result.failureCount}`);
    lines.push(`Success Rate (%),${((result.successCount / result.totalRequests) * 100).toFixed(2)}`);
    lines.push(`Total Time (ms),${result.totalTime}`);
    lines.push(`Avg Response Time (ms),${result.avgResponseTime.toFixed(2)}`);
    lines.push(`Min Response Time (ms),${result.minResponseTime.toFixed(2)}`);
    lines.push(`Max Response Time (ms),${result.maxResponseTime.toFixed(2)}`);
    lines.push(`Requests/Second,${result.requestsPerSecond.toFixed(2)}`);
    lines.push("");

    // Errors section
    if (result.errors && result.errors.length > 0) {
      lines.push("ERRORS");
      lines.push("Thread,Error");
      result.errors.forEach((error: any) => {
        lines.push(`${error.thread},"${error.error.replace(/"/g, '""')}"`);
      });
    }

    return lines.join("\n");
  }

  /**
   * Generate CSV content for multi-user load test
   */
  private static generateMultiUserCSV(result: any): string {
    const lines: string[] = [];

    // Header section
    lines.push("MULTI-USER LOAD TEST RESULTS");
    lines.push("");
    lines.push("SUMMARY");
    lines.push("Metric,Value");
    lines.push(`Total Users,${result.totalUsers}`);
    lines.push(`Total Requests,${result.totalRequests}`);
    lines.push(`Success,${result.successCount}`);
    lines.push(`Failures,${result.failureCount}`);
    lines.push(`Success Rate (%),${result.successRate.toFixed(2)}`);
    lines.push(`Total Time (ms),${result.totalTime}`);
    lines.push(`Avg Response Time (ms),${result.avgResponseTime.toFixed(2)}`);
    lines.push(`Min Response Time (ms),${result.minResponseTime.toFixed(2)}`);
    lines.push(`Max Response Time (ms),${result.maxResponseTime.toFixed(2)}`);
    lines.push(`Requests/Second,${result.requestsPerSecond.toFixed(2)}`);
    lines.push("");

    // Per-user statistics
    if (result.userStats && result.userStats.length > 0) {
      lines.push("PER-USER STATISTICS");
      lines.push("User ID,Success Count,Failed Count,Avg Response Time (ms)");
      result.userStats.forEach((stat: any) => {
        lines.push(
          `${stat.user},${stat.success},${stat.failed},${stat.avgTime.toFixed(2)}`
        );
      });
      lines.push("");
    }

    // Errors section
    if (result.errors && result.errors.length > 0) {
      lines.push("ERRORS");
      lines.push("User,Request #,Error");
      result.errors.forEach((error: any) => {
        lines.push(
          `${error.user},${error.requestNum},"${error.error.replace(/"/g, '""')}"`
        );
      });
    }

    return lines.join("\n");
  }

  /**
   * Download CSV file
   */
  private static downloadCSV(csv: string, filename: string): void {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
    );
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  /**
   * Copy CSV to clipboard
   */
  static copyToClipboard(csv: string): void {
    navigator.clipboard.writeText(csv).then(() => {
      alert("Results copied to clipboard!");
    });
  }
}
