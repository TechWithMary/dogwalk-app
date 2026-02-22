import BaseAgent from '../BaseAgent.js';
import { createClient } from '@supabase/supabase-js';

class BackendAgent extends BaseAgent {
  constructor() {
    super('BackendAgent', {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
    this.supabase = null;
    this.user = null;
  }

  async initialize() {
    this.setStatus('initializing');
    try {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
      this.log('Supabase client initialized');
      
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.user = session?.user || null;
        if (event === 'SIGNED_IN') this.setStatus('authenticated');
        if (event === 'SIGNED_OUT') this.setStatus('ready');
      });
      
      this.setStatus('ready');
      this.log('Backend agent initialized successfully');
    } catch (error) {
      this.handleError(error, 'initialization');
      throw error;
    }
  }

  getUser() {
    return this.user;
  }

  async getProfile(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    } catch (error) {
      this.handleError(error, 'getProfile');
      throw error;
    }
  }

  async getMyWalkerProfile() {
    try {
      const user = this.getUser();
      if (!user) return null;

      const { data, error } = await this.supabase
        .from('walkers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error) {
      this.handleError(error, 'getMyWalkerProfile');
      throw error;
    }
  }

  async createPaymentPreference(amount, title) {
    try {
      const { data, error } = await this.supabase.functions.invoke('create-payment-intent', {
        body: { amount, title },
      });

      if (error) throw error;
      if (!data.preferenceId) throw new Error("Server response did not include a preferenceId.");

      return data.preferenceId;
    } catch (error) {
      this.handleError(error, 'createPaymentPreference');
      throw error;
    }
  }
}

export default BackendAgent;
