/**
 * Agent Registry - Centralized agent management
 * Coordinates all agents and provides unified interface
 */

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.initialized = false;
  }

  /**
   * Register an agent
   * @param {string} name - Agent name
   * @param {Object} agent - Agent instance
   */
  register(name, agent) {
    this.agents.set(name, agent);
    console.log(`🤖 Agent ${name} registered`);
  }

  /**
   * Get an agent by name
   * @param {string} name - Agent name
   * @returns {Object} Agent instance
   */
  get(name) {
    return this.agents.get(name);
  }

  /**
   * Initialize all agents
   */
  async initializeAll() {
    if (this.initialized) return;

    console.log('🚀 Initializing all agents...');
    
    for (const [name, agent] of this.agents) {
      try {
        if (agent.initialize) {
          await agent.initialize();
          console.log(`✅ Agent ${name} initialized`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize agent ${name}:`, error);
      }
    }

    this.initialized = true;
    console.log('🎉 All agents initialized');
  }

  /**
   * Get agent status
   * @returns {Object} Status of all agents
   */
  getStatus() {
    const status = {};
    for (const [name, agent] of this.agents) {
      status[name] = {
        initialized: agent.initialized || false,
        status: agent.status || 'unknown',
        lastActivity: agent.lastActivity || null
      };
    }
    return status;
  }

  /**
   * Shutdown all agents
   */
  async shutdownAll() {
    console.log('🛑 Shutting down all agents...');
    
    for (const [name, agent] of this.agents) {
      try {
        if (agent.shutdown) {
          await agent.shutdown();
          console.log(`🛑 Agent ${name} shutdown`);
        }
      } catch (error) {
        console.error(`❌ Failed to shutdown agent ${name}:`, error);
      }
    }

    this.agents.clear();
    this.initialized = false;
    console.log('🔴 All agents shutdown');
  }
}

// Global registry instance
export const agentRegistry = new AgentRegistry();

export default AgentRegistry;