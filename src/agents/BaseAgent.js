/**
 * Base Agent Class
 * Common functionality for all agents
 */

class BaseAgent {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.initialized = false;
    this.status = 'idle';
    this.lastActivity = null;
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: []
    };
  }

  /**
   * Initialize the agent
   * @abstract
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Shutdown the agent
   * @abstract
   */
  async shutdown() {
    throw new Error('shutdown() must be implemented by subclass');
  }

  /**
   * Update agent status
   * @param {string} status - New status
   */
  setStatus(status) {
    this.status = status;
    this.lastActivity = new Date();
    console.log(`🤖 ${this.name}: Status changed to ${status}`);
  }

  /**
   * Log activity
   * @param {string} activity - Activity description
   * @param {Object} data - Additional data
   */
  log(activity, data = {}) {
    this.lastActivity = new Date();
    console.log(`📝 ${this.name}: ${activity}`, data);
  }

  /**
   * Record metrics
   * @param {string} type - Metric type
   * @param {number} value - Metric value
   */
  recordMetric(type, value) {
    if (this.metrics[type] !== undefined) {
      if (Array.isArray(this.metrics[type])) {
        this.metrics[type].push(value);
        // Keep only last 100 entries
        if (this.metrics[type].length > 100) {
          this.metrics[type].shift();
        }
      } else {
        this.metrics[type] += value;
      }
    }
  }

  /**
   * Get agent metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgResponseTime: this.metrics.responseTime.length > 0
        ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
        : 0
    };
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  async healthCheck() {
    return {
      name: this.name,
      status: this.status,
      initialized: this.initialized,
      lastActivity: this.lastActivity,
      metrics: this.getMetrics()
    };
  }

  /**
   * Handle errors
   * @param {Error} error - Error to handle
   * @param {string} context - Error context
   */
  handleError(error, context = 'unknown') {
    this.recordMetric('errors', 1);
    console.error(`❌ ${this.name} error in ${context}:`, error);
    this.setStatus('error');
  }
}

export default BaseAgent;